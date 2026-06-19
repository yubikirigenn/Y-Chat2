import { useEffect, useRef, useState } from 'react'
import { sendSignal, initSignaling, cleanupSignaling, SignalMessage } from '../lib/webrtc'

type CallManagerProps = {
  myId: string
  currentRoomId: string | null
  onIncomingCall: (roomId: string, callerId: string) => void
  onCallAccepted: (roomId: string) => void
  onCallRejected: (roomId: string) => void
  onCallEnded: (roomId: string, duration: number) => void
}

export function CallManager({ myId, currentRoomId, onIncomingCall, onCallAccepted, onCallRejected, onCallEnded }: CallManagerProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  
  const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)

  // Avoid dependency array infinite loops by using refs for callbacks and activeCallRoom
  const activeCallRoomRef = useRef<string | null>(null)
  useEffect(() => {
    activeCallRoomRef.current = activeCallRoom
  }, [activeCallRoom])

  const callbacksRef = useRef({ onIncomingCall, onCallAccepted, onCallRejected, onCallEnded })
  useEffect(() => {
    callbacksRef.current = { onIncomingCall, onCallAccepted, onCallRejected, onCallEnded }
  }, [onIncomingCall, onCallAccepted, onCallRejected, onCallEnded])

  useEffect(() => {
    remoteAudioRef.current = new Audio()
    remoteAudioRef.current.autoplay = true

    initSignaling(async (msg) => {
      const currentActiveRoom = activeCallRoomRef.current
      const { onIncomingCall, onCallAccepted, onCallRejected, onCallEnded } = callbacksRef.current

      // 自分のメッセージは無視
      if ('senderId' in msg && msg.senderId === myId) return
      if ('callerId' in msg && msg.callerId === myId) return
      if ('responderId' in msg && msg.responderId === myId) return

      if (msg.type === 'call-request') {
        onIncomingCall(msg.roomId, msg.callerId)
      }

      if (msg.type === 'call-accept') {
        if (msg.roomId === currentActiveRoom) {
          onCallAccepted(msg.roomId)
          setCallStartTime(Date.now())
          await startWebRTC(msg.roomId, true) // Caller creates offer
        }
      }

      if (msg.type === 'call-reject') {
        if (msg.roomId === currentActiveRoom) {
          onCallRejected(msg.roomId)
          endCall(msg.roomId)
        }
      }

      if (msg.type === 'call-hangup') {
        if (msg.roomId === currentActiveRoom) {
          // calculate duration using Date.now() manually or pass 0 and rely on final calc
          onCallEnded(msg.roomId, 0)
          endCall(msg.roomId)
        }
      }

      // WebRTC Signaling
      if (msg.roomId !== currentActiveRoom) return

      if (msg.type === 'webrtc-offer') {
        await startWebRTC(msg.roomId, false)
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        const answer = await pcRef.current?.createAnswer()
        await pcRef.current?.setLocalDescription(answer)
        sendSignal({ type: 'webrtc-answer', senderId: myId, roomId: msg.roomId, sdp: answer! })
      }

      if (msg.type === 'webrtc-answer') {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.sdp))
      }

      if (msg.type === 'webrtc-ice') {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate))
      }
    })

    return () => {
      cleanupSignaling()
      endCall(activeCallRoomRef.current || '')
    }
  }, [myId])

  const startWebRTC = async (roomId: string, isCaller: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      pcRef.current = pc

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0]
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: 'webrtc-ice', senderId: myId, roomId, candidate: event.candidate.toJSON() })
        }
      }

      if (isCaller) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({ type: 'webrtc-offer', senderId: myId, roomId, sdp: offer })
      }
    } catch (err) {
      console.error('WebRTC Setup Error:', err)
    }
  }

  const endCall = (roomId: string) => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    pcRef.current = null
    setActiveCallRoom(null)
    setCallStartTime(null)
  }

  // Public methods that App.tsx can trigger via a ref or by changing state, but 
  // since this is a component, it's easier to expose these via window or context.
  // We'll attach a global object for simplicity in this demo.
  useEffect(() => {
    ;(window as any).CallApi = {
      startCall: (roomId: string) => {
        setActiveCallRoom(roomId)
        sendSignal({ type: 'call-request', callerId: myId, roomId })
      },
      acceptCall: (roomId: string) => {
        setActiveCallRoom(roomId)
        setCallStartTime(Date.now())
        sendSignal({ type: 'call-accept', responderId: myId, roomId })
      },
      rejectCall: (roomId: string) => {
        sendSignal({ type: 'call-reject', responderId: myId, roomId })
      },
      hangUp: (roomId: string) => {
        const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0
        sendSignal({ type: 'call-hangup', senderId: myId, roomId })
        endCall(roomId)
        return duration
      }
    }
  }, [myId, callStartTime])

  return null
}

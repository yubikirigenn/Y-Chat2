import { useEffect, useRef, useState } from 'react'
import { sendSignal, initSignaling, cleanupSignaling, SignalMessage } from '../lib/webrtc'
import type { Room } from '../types'

type CallManagerProps = {
  myId: string
  rooms: Room[]
  currentRoomId: string | null
  onIncomingCall: (roomId: string, callerId: string) => void
  onCallAccepted: (roomId: string) => void
  onCallRejected: (roomId: string) => void
  onCallEnded: (roomId: string, duration: number) => void
}

export function CallManager({ myId, rooms, currentRoomId, onIncomingCall, onCallAccepted, onCallRejected, onCallEnded }: CallManagerProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  
  const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<number | null>(null)
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  // Avoid dependency array infinite loops by using refs for callbacks and activeCallRoom
  const activeCallRoomRef = useRef<string | null>(null)
  useEffect(() => {
    activeCallRoomRef.current = activeCallRoom
  }, [activeCallRoom])

  const roomsRef = useRef<Room[]>(rooms)
  useEffect(() => {
    roomsRef.current = rooms
  }, [rooms])

  const getRoomMemberIds = (roomId: string): string[] => {
    const room = roomsRef.current.find(r => r.id === roomId)
    return room ? room.memberIds : []
  }

  const callbacksRef = useRef({ onIncomingCall, onCallAccepted, onCallRejected, onCallEnded })
  useEffect(() => {
    callbacksRef.current = { onIncomingCall, onCallAccepted, onCallRejected, onCallEnded }
  }, [onIncomingCall, onCallAccepted, onCallRejected, onCallEnded])

  useEffect(() => {
    initSignaling(async (msg) => {
      const currentActiveRoom = activeCallRoomRef.current
      const { onIncomingCall, onCallAccepted, onCallRejected, onCallEnded } = callbacksRef.current

      // 自分のメッセージは無視
      if ('senderId' in msg && msg.senderId === myId) return
      if ('callerId' in msg && msg.callerId === myId) return
      if ('responderId' in msg && msg.responderId === myId) return

      // 自分が宛先に含まれていない場合は無視
      if (!msg.targetUserIds || !msg.targetUserIds.map(id => id.toLowerCase()).includes(myId.toLowerCase())) {
        return
      }

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
        const pc = pcRef.current
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            await processPendingCandidates()
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            sendSignal({ type: 'webrtc-answer', senderId: myId, roomId: msg.roomId, sdp: answer!, targetUserIds: getRoomMemberIds(msg.roomId) })
          } catch (err) {
            console.error('Error handling webrtc-offer:', err)
          }
        }
      }

      if (msg.type === 'webrtc-answer') {
        const pc = pcRef.current
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
            await processPendingCandidates()
          } catch (err) {
            console.error('Error handling webrtc-answer:', err)
          }
        }
      }

      if (msg.type === 'webrtc-ice') {
        const pc = pcRef.current
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate))
          } catch (err) {
            console.error('Failed to add ICE candidate directly:', err)
          }
        } else {
          pendingCandidatesRef.current.push(msg.candidate)
        }
      }
    })

    return () => {
      cleanupSignaling()
      endCall(activeCallRoomRef.current || '')
    }
  }, [myId])

  const processPendingCandidates = async () => {
    const pc = pcRef.current
    if (!pc || !pc.remoteDescription) return
    const candidates = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const cand of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch (err) {
        console.error('Failed to add pending ICE candidate:', err)
      }
    }
  }

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
          if (event.streams && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0]
          } else {
            let stream = remoteAudioRef.current.srcObject as MediaStream | null
            if (!stream || !(stream instanceof MediaStream)) {
              stream = new MediaStream()
              remoteAudioRef.current.srcObject = stream
            }
            stream.addTrack(event.track)
          }
          remoteAudioRef.current.play().catch(err => {
            console.warn('Audio play failed or blocked by autoplay policy:', err)
          })
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: 'webrtc-ice', senderId: myId, roomId, candidate: event.candidate.toJSON(), targetUserIds: getRoomMemberIds(roomId) })
        }
      }

      if (isCaller) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({ type: 'webrtc-offer', senderId: myId, roomId, sdp: offer, targetUserIds: getRoomMemberIds(roomId) })
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
    pendingCandidatesRef.current = []
  }

  // Public methods that App.tsx can trigger via a ref or by changing state, but 
  // since this is a component, it's easier to expose these via window or context.
  // We'll attach a global object for simplicity in this demo.
  useEffect(() => {
    ;(window as any).CallApi = {
      startCall: (roomId: string) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(() => {})
        }
        setActiveCallRoom(roomId)
        sendSignal({ type: 'call-request', callerId: myId, roomId, targetUserIds: getRoomMemberIds(roomId) })
      },
      acceptCall: (roomId: string) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.play().catch(() => {})
        }
        setActiveCallRoom(roomId)
        setCallStartTime(Date.now())
        sendSignal({ type: 'call-accept', responderId: myId, roomId, targetUserIds: getRoomMemberIds(roomId) })
      },
      rejectCall: (roomId: string) => {
        sendSignal({ type: 'call-reject', responderId: myId, roomId, targetUserIds: getRoomMemberIds(roomId) })
      },
      hangUp: (roomId: string) => {
        const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0
        sendSignal({ type: 'call-hangup', senderId: myId, roomId, targetUserIds: getRoomMemberIds(roomId) })
        endCall(roomId)
        return duration
      }
    }
  }, [myId, callStartTime])

  return (
    <audio
      ref={(el) => {
        remoteAudioRef.current = el
      }}
      style={{ display: 'none' }}
    />
  )
}

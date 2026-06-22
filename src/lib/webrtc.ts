import { supabase } from './supabase'

export type SignalMessage =
  | { type: 'call-request'; callerId: string; roomId: string; targetUserIds: string[] }
  | { type: 'call-accept'; responderId: string; roomId: string; targetUserIds: string[] }
  | { type: 'call-reject'; responderId: string; roomId: string; targetUserIds: string[] }
  | { type: 'call-hangup'; senderId: string; roomId: string; targetUserIds: string[] }
  | { type: 'webrtc-offer'; senderId: string; roomId: string; sdp: RTCSessionDescriptionInit; targetUserIds: string[] }
  | { type: 'webrtc-answer'; senderId: string; roomId: string; sdp: RTCSessionDescriptionInit; targetUserIds: string[] }
  | { type: 'webrtc-ice'; senderId: string; roomId: string; candidate: RTCIceCandidateInit; targetUserIds: string[] }

// 通話シグナリング用チャネル
let signalingChannel = supabase?.channel('webrtc-signaling')

export const initSignaling = (onSignal: (payload: SignalMessage) => void) => {
  if (!supabase) return

  signalingChannel = supabase.channel('webrtc-signaling')
  
  signalingChannel
    .on('broadcast', { event: 'signal' }, (payload) => {
      onSignal(payload.payload as SignalMessage)
    })
    .subscribe()
}

export const sendSignal = async (message: SignalMessage) => {
  if (!signalingChannel || !supabase) {
    console.warn('Supabase is not configured. Realtime signaling is disabled.')
    return
  }
  
  await signalingChannel.send({
    type: 'broadcast',
    event: 'signal',
    payload: message,
  })
}

export const cleanupSignaling = () => {
  if (signalingChannel && supabase) {
    supabase.removeChannel(signalingChannel)
    signalingChannel = undefined
  }
}

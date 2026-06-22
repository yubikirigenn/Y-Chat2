import { useEffect, useRef } from 'react'
import { supabase, hasSupabaseConfig } from './supabase'
import { api } from './api'
import type { AppData, Account, Friendship, Room } from '../types'

export function useSupabaseSync(
  data: AppData,
  setData: React.Dispatch<React.SetStateAction<AppData>>,
  accounts: Account[],
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>,
  friendships: Friendship[],
  setFriendships: React.Dispatch<React.SetStateAction<Friendship[]>>
) {
  const isLoadedRef = useRef(false)
  const prevUserIdRef = useRef<string | undefined>(undefined)
  const currentUserId = data.me?.id

  // userId変更時はinitialロードをリセット
  if (prevUserIdRef.current !== currentUserId) {
    isLoadedRef.current = false
    prevUserIdRef.current = currentUserId
  }

  // 1. 初回データフェッチ
  useEffect(() => {
    if (!hasSupabaseConfig || !currentUserId || isLoadedRef.current) return

    let mounted = true
    const load = async () => {
      try {
        const initial = await api.fetchInitialData(currentUserId)
        if (!mounted) return

        setAccounts(initial.friends.map(p => ({
          id: p.id,
          handle: p.handle,
          passwordHash: '',
          profile: p
        })))

        setFriendships(initial.friends.map(p => ({
          userId: currentUserId,
          friendId: p.id
        })))
        
        setData(prev => {
          // Supabaseのデータをマスターとし、ローカルのキャッシュ（prev）を上書きする
          // これにより、Supabase側で削除されたデータがローカルに残る問題（ゴースト）を防ぐ
          return {
            ...prev,
            me: initial.me ?? prev.me,
            rooms: initial.rooms,
            messages: initial.messages,
            friends: initial.friends
          }
        })
        isLoadedRef.current = true
      } catch (err) {
        console.error('Supabase initial fetch failed:', err)
      }
    }
    load()
    return () => { mounted = false }
  }, [currentUserId, setData, setAccounts, setFriendships])

  // 2. リアルタイムサブスクリプション
  useEffect(() => {
    if (!hasSupabaseConfig || !currentUserId) return

    const syncRoom = async (roomId: string) => {
      try {
        const { data: rData } = await supabase!
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle()
        if (!rData) {
          console.warn('syncRoom: Room not found in Supabase:', roomId)
          return
        }

        const { data: rmData } = await supabase!
          .from('room_members')
          .select('*')
          .eq('room_id', roomId)
        if (!rmData || rmData.length === 0) {
          console.warn('syncRoom: No members found for room:', roomId)
          return
        }

        const memberIds = rmData.map((rm: any) => rm.user_id)

        // 自分がこのルームのメンバーでない場合は無視する
        if (!memberIds.map((id: string) => id.toLowerCase()).includes(currentUserId.toLowerCase())) {
          return
        }

        const { data: accData } = await supabase!
          .from('accounts')
          .select('*')
          .in('id', memberIds)

        const profiles = (accData || []).map(a => ({
          id: a.id,
          name: a.name,
          handle: a.id,
          avatarSeed: a.avatar_seed,
          status: a.status || '',
          avatarUrl: a.avatar_url,
          accent: '#00c300',
        }))

        // accountsリストにマージ
        setAccounts(prev => {
          const updated = [...prev]
          profiles.forEach(p => {
            if (!updated.some(a => a.id === p.id)) {
              updated.push({ id: p.id, handle: p.id, passwordHash: '', profile: p })
            }
          })
          return updated
        })

        setData(prev => {
          if (prev.rooms.some(r => r.id === roomId)) return prev

          const room: Room = {
            id: rData.id,
            title: rData.title,
            memberIds,
            isGroup: rData.kind === 'group',
            pinned: false,
            muted: false,
            unread: rmData.find((rm: any) => rm.user_id === currentUserId)?.unread_count || 0,
            updatedAt: rData.updated_at
          }

          const newFriends = [...prev.friends]
          profiles.forEach(p => {
            if (p.id !== currentUserId && !newFriends.some(f => f.id === p.id)) {
              newFriends.push(p)
            }
          })

          return {
            ...prev,
            rooms: [room, ...prev.rooms],
            friends: newFriends
          }
        })
      } catch (err) {
        console.error('Failed to sync new room:', err)
      }
    }

    const channel = supabase!.channel('public:sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any
        
        setData(prev => {
          // 自分が参加していないルームのメッセージは追加しない
          if (!prev.rooms.some(r => r.id === newMsg.room_id)) return prev

          if (prev.messages.some(m => m.id === newMsg.id)) return prev

          const isFromMe = newMsg.sender_id?.toLowerCase() === currentUserId?.toLowerCase()
          const isCurrentRoom = prev.selectedRoomId === newMsg.room_id

          const newRooms = prev.rooms.map(r => {
            if (r.id !== newMsg.room_id) return r
            return {
              ...r,
              unread: (!isFromMe && !isCurrentRoom) ? r.unread + 1 : r.unread
            }
          })

          return {
            ...prev,
            rooms: newRooms,
            messages: [...prev.messages, {
              id: newMsg.id,
              roomId: newMsg.room_id,
              senderId: newMsg.sender_id,
              kind: newMsg.kind,
              text: newMsg.text,
              imageUrl: newMsg.image_url,
              readBy: newMsg.read_by || [],
              createdAt: newMsg.created_at
            }]
          }
        })

        // setDataのコールバック外で非同期実行する
        syncRoom(newMsg.room_id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMsg = payload.new as any
        setData(prev => ({
          ...prev,
          messages: prev.messages.map(m => m.id === updatedMsg.id ? {
            ...m,
            kind: updatedMsg.kind,
            text: updatedMsg.text,
            imageUrl: updatedMsg.image_url,
            readBy: updatedMsg.read_by || m.readBy
          } : m)
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_members' }, (payload) => {
        const newMember = payload.new as any
        if (newMember.user_id?.toLowerCase() === currentUserId?.toLowerCase()) {
          syncRoom(newMember.room_id)
        }
      })
      .subscribe((status) => {
        console.log('Realtime sync channel status:', status)
      })

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [currentUserId, setData, setAccounts])
}

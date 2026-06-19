import { supabase } from './supabase'
import type { Profile, Message, Room } from '../types'

// 認証・データ取得用API
export const api = {
  async login(handle: string, passwordRaw: string) {
    if (!supabase) throw new Error('Supabase is not configured')
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', handle)
      .eq('password', passwordRaw)
      .single()
      
    if (error || !data) throw new Error('ユーザーIDまたはパスワードが正しくありません。')
    return {
      id: data.id,
      name: data.name,
      handle: data.id,
      avatarSeed: data.avatar_seed,
      status: data.status || '',
      avatarUrl: data.avatar_url,
      accent: '#00c300',
    } as Profile
  },

  async signUp(handle: string, passwordRaw: string, name: string) {
    if (!supabase) throw new Error('Supabase is not configured')
    const seed = handle.replace('@', '')
    
    // Check if exists (case-insensitive to prevent PK conflicts if DB is case-insensitive, or just to prevent confusing duplicates)
    const { data: existing } = await supabase.from('accounts').select('id').ilike('id', handle).maybeSingle()
    if (existing) throw new Error('このユーザーIDはすでに使用されています。')

    const { data, error } = await supabase.from('accounts').insert([{
      id: handle,
      password: passwordRaw,
      name,
      avatar_seed: seed,
      status: 'はじめまして！よろしくね。'
    }]).select().single()

    if (error) throw new Error('アカウントの作成に失敗しました。')
    
    return {
      id: data.id,
      name: data.name,
      handle: data.id,
      avatarSeed: data.avatar_seed,
      status: data.status || '',
      accent: '#00c300',
    } as Profile
  },

  async searchAccount(handle: string) {
    if (!supabase) return null
    const { data } = await supabase.from('accounts').select('*').eq('id', handle).maybeSingle()
    if (!data) return null
    return {
      id: data.id,
      name: data.name,
      handle: data.id,
      avatarSeed: data.avatar_seed,
      status: data.status || '',
      avatarUrl: data.avatar_url,
      accent: '#00c300',
    } as Profile
  },

  async fetchInitialData(userId: string) {
    if (!supabase) throw new Error('Supabase is not configured')
    
    // 友達取得
    const { data: fData } = await supabase.from('friendships').select('friend_id').eq('user_id', userId)
    const friendIds = fData?.map((f: any) => f.friend_id) || []
    
    let friends: Profile[] = []
    if (friendIds.length > 0) {
      const { data: accData } = await supabase.from('accounts').select('*').in('id', friendIds)
      friends = (accData || []).map(a => ({
        id: a.id, name: a.name, handle: a.id, avatarSeed: a.avatar_seed, status: a.status || '', avatarUrl: a.avatar_url, accent: '#00c300'
      }))
    }

    // ルームとメンバー取得
    const { data: myRoomsData } = await supabase.from('room_members').select('room_id').eq('user_id', userId)
    const myRoomIds = myRoomsData?.map((r: any) => r.room_id) || []

    let rooms: Room[] = []
    let roomMembersMap = new Map<string, string[]>()
    if (myRoomIds.length > 0) {
      const { data: rData } = await supabase.from('rooms').select('*').in('id', myRoomIds)
      const { data: rmData } = await supabase.from('room_members').select('*').in('room_id', myRoomIds)
      
      const allMemberIds = new Set<string>()
      
      rmData?.forEach(rm => {
        if (!roomMembersMap.has(rm.room_id)) roomMembersMap.set(rm.room_id, [])
        roomMembersMap.get(rm.room_id)!.push(rm.user_id)
        allMemberIds.add(rm.user_id)
      })

      rooms = (rData || []).map(r => ({
        id: r.id,
        title: r.title,
        memberIds: roomMembersMap.get(r.id) || [],
        isGroup: r.kind === 'group',
        pinned: false,
        muted: false,
        unread: rmData?.find(rm => rm.room_id === r.id && rm.user_id === userId)?.unread_count || 0,
        updatedAt: r.updated_at
      }))

      // ルームメンバーのプロフィールも取得（友達以外のユーザー対応）
      const missingIds = Array.from(allMemberIds).filter(id => id !== userId && !friendIds.includes(id))
      if (missingIds.length > 0) {
        const { data: missingAccData } = await supabase.from('accounts').select('*').in('id', missingIds)
        const missingProfiles = (missingAccData || []).map(a => ({
          id: a.id, name: a.name, handle: a.id, avatarSeed: a.avatar_seed, status: a.status || '', avatarUrl: a.avatar_url, accent: '#00c300'
        }))
        friends = [...friends, ...missingProfiles] // キャッシュとしてfriendsに混ぜる（簡易実装）
      }
    }

    // メッセージ取得
    let messages: Message[] = []
    if (myRoomIds.length > 0) {
      const { data: mData } = await supabase.from('messages').select('*').in('room_id', myRoomIds).order('created_at', { ascending: true })
      messages = (mData || []).map(m => ({
        id: m.id,
        roomId: m.room_id,
        senderId: m.sender_id,
        kind: m.kind,
        text: m.text,
        imageUrl: m.image_url,
        readBy: m.read_by || [],
        createdAt: m.created_at
      }))
    }

    return { friends, rooms, messages }
  },

  async addFriend(userId: string, targetHandle: string) {
    if (!supabase) return null
    // 対象存在チェック
    const { data: target } = await supabase.from('accounts').select('*').eq('id', targetHandle).single()
    if (!target) throw new Error('ユーザーが見つかりません')
    if (target.id === userId) throw new Error('自分自身は追加できません')

    // Friendship 追加（双方向、すでに存在する場合は無視）
    await supabase.from('friendships').upsert([
      { user_id: userId, friend_id: target.id },
      { user_id: target.id, friend_id: userId }
    ], { onConflict: 'user_id,friend_id' })
    
    return {
      id: target.id, name: target.name, handle: target.id, avatarSeed: target.avatar_seed, status: target.status || '', avatarUrl: target.avatar_url, accent: '#00c300'
    } as Profile
  },

  async createRoom(roomId: string, memberIds: string[], isGroup: boolean, title?: string) {
    if (!supabase) return
    const now = new Date().toISOString()
    await supabase.from('rooms').insert([{ id: roomId, kind: isGroup ? 'group' : 'direct', title, updated_at: now }])
    const memberInserts = memberIds.map(id => ({ room_id: roomId, user_id: id }))
    await supabase.from('room_members').insert(memberInserts)
  },

  async sendMessage(msg: Message) {
    if (!supabase) return
    await supabase.from('messages').insert([{
      id: msg.id,
      room_id: msg.roomId,
      sender_id: msg.senderId || null,
      kind: msg.kind,
      text: msg.text,
      image_url: msg.imageUrl || null,
      read_by: msg.readBy,
      created_at: msg.createdAt
    }])
    await supabase.from('rooms').update({ updated_at: msg.createdAt }).eq('id', msg.roomId)
  },

  async removeMessage(msgId: string) {
    if (!supabase) return
    await supabase.from('messages').update({
      text: 'メッセージの送信を取り消しました',
      kind: 'system',
      sender_id: null,
      image_url: null
    }).eq('id', msgId)
  },

  async markAsRead(roomId: string, userId: string) {
    if (!supabase) return
    // 対象ルームの自分の未読を0にする
    await supabase.from('room_members').update({ unread_count: 0 }).eq('room_id', roomId).eq('user_id', userId)
    
    // 対象ルームの他人のメッセージのread_byに自分を追加
    // 注: 本格的な実装ではRPCを利用しますが、今回は簡易的に全メッセージを取得して更新します
    const { data } = await supabase.from('messages').select('id, read_by').eq('room_id', roomId)
    if (!data) return
    
    const unreadMsgs = data.filter(m => !(m.read_by || []).includes(userId))
    for (const msg of unreadMsgs) {
      await supabase.from('messages').update({ read_by: [...(msg.read_by || []), userId] }).eq('id', msg.id)
    }
  },

  async updateProfile(userId: string, name: string, status: string, avatarUrl?: string) {
    if (!supabase) return
    await supabase.from('accounts').update({ name, status, avatar_url: avatarUrl }).eq('id', userId)
  }
}

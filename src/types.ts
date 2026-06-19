export type TabKey = 'chats' | 'friends' | 'settings'

export type MessageKind = 'text' | 'image' | 'system'

export interface Profile {
  id: string
  name: string
  handle: string
  avatarSeed: string
  avatarUrl?: string | undefined
  status: string
  accent: string
  isMe?: boolean
}

export interface Room {
  id: string
  title: string
  memberIds: string[]
  isGroup: boolean
  pinned: boolean
  muted: boolean
  unread: number
  updatedAt: string
}

export interface Message {
  id: string
  roomId: string
  senderId: string | null
  kind: MessageKind
  text: string
  imageUrl?: string | undefined
  createdAt: string
  readBy: string[]
}

export interface Account {
  id: string
  handle: string
  passwordHash: string
  profile: Profile
}

export interface Friendship {
  userId: string
  friendId: string
}

export interface AppData {

  version: string
  darkMode: boolean
  me: Profile | null
  friends: Profile[]
  rooms: Room[]
  messages: Message[]
  selectedRoomId: string
  selectedTab: TabKey
  drafts: Record<string, string>
}


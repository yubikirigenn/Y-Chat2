import type { AppData, Message, Profile, Room, Account, Friendship } from './types'

const now = new Date('2026-06-18T10:10:00+09:00')
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString()

const me: Profile = {
  id: 'me',
  name: 'ゆびきり',
  handle: '@yubi',
  avatarSeed: 'yubi',
  status: '返信は気まぐれに、でもちゃんと返す。',
  accent: '#00c300',
  isMe: true,
}

const friends: Profile[] = [
  {
    id: 'mika',
    name: 'みか',
    handle: '@mika',
    avatarSeed: 'mika',
    status: '今はコーディング中',
    accent: '#ff7a59',
  },
  {
    id: 'haru',
    name: 'はる',
    handle: '@haru',
    avatarSeed: 'haru',
    status: '写真なら任せて',
    accent: '#4a90e2',
  },
  {
    id: 'so',
    name: 'そう',
    handle: '@so',
    avatarSeed: 'so',
    status: '既読はつくけど、すぐ返すとは言ってない',
    accent: '#9b59b6',
  },
  {
    id: 'yuma',
    name: 'ゆうま',
    handle: '@yuma',
    avatarSeed: 'yuma',
    status: '会議のあとで',
    accent: '#f39c12',
  },
  {
    id: 'nana',
    name: 'なな',
    handle: '@nana',
    avatarSeed: 'nana',
    status: 'LINEっぽいUI好き',
    accent: '#2ecc71',
  },
]

export const initialAccounts: Account[] = [
  {
    id: 'me',
    handle: '@yubi',
    passwordHash: 'yubi123',
    profile: me,
  },
  {
    id: 'mika',
    handle: '@mika',
    passwordHash: 'mika123',
    profile: friends[0]!,
  },
  {
    id: 'haru',
    handle: '@haru',
    passwordHash: 'haru123',
    profile: friends[1]!,
  },
  {
    id: 'so',
    handle: '@so',
    passwordHash: 'so123',
    profile: friends[2]!,
  },
  {
    id: 'yuma',
    handle: '@yuma',
    passwordHash: 'yuma123',
    profile: friends[3]!,
  },
  {
    id: 'nana',
    handle: '@nana',
    passwordHash: 'nana123',
    profile: friends[4]!,
  },
]

export const initialFriendships: Friendship[] = [
  { userId: 'me', friendId: 'mika' },
  { userId: 'me', friendId: 'haru' },
  { userId: 'me', friendId: 'so' },
  { userId: 'me', friendId: 'yuma' },
  { userId: 'me', friendId: 'nana' },
  { userId: 'mika', friendId: 'me' },
  { userId: 'haru', friendId: 'me' },
  { userId: 'so', friendId: 'me' },
  { userId: 'yuma', friendId: 'me' },
  { userId: 'nana', friendId: 'me' },
]

const rooms: Room[] = [

  {
    id: 'r1',
    title: 'みか',
    memberIds: ['me', 'mika'],
    isGroup: false,
    pinned: true,
    muted: false,
    unread: 2,
    updatedAt: minutesAgo(11),
  },
  {
    id: 'r2',
    title: 'Y-Chat制作会',
    memberIds: ['me', 'haru', 'so', 'yuma'],
    isGroup: true,
    pinned: false,
    muted: false,
    unread: 0,
    updatedAt: minutesAgo(36),
  },
  {
    id: 'r3',
    title: 'なな',
    memberIds: ['me', 'nana'],
    isGroup: false,
    pinned: false,
    muted: true,
    unread: 1,
    updatedAt: minutesAgo(90),
  },
]

const messages: Message[] = [
  {
    id: 'm1',
    roomId: 'r1',
    senderId: 'mika',
    kind: 'text',
    text: 'Y-Chat2、かなりLINEっぽくしてみるのいいね。',
    createdAt: minutesAgo(62),
    readBy: ['me'],
  },
  {
    id: 'm2',
    roomId: 'r1',
    senderId: 'me',
    kind: 'text',
    text: 'うん。まずは見た目と操作感をそろえるところから。',
    createdAt: minutesAgo(60),
    readBy: ['me', 'mika'],
  },
  {
    id: 'm3',
    roomId: 'r1',
    senderId: 'mika',
    kind: 'image',
    text: 'この色合い、かなりそれっぽい。',
    imageUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
          <defs>
            <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stop-color="#1e2a1e"/>
              <stop offset="100%" stop-color="#2a3c2a"/>
            </linearGradient>
          </defs>
          <rect width="720" height="420" fill="url(#g)"/>
          <rect x="60" y="58" width="600" height="304" rx="24" fill="#1e1e1e" opacity=".9"/>
          <circle cx="184" cy="182" r="58" fill="#00c300"/>
          <circle cx="366" cy="182" r="58" fill="#2a2a2a"/>
          <circle cx="548" cy="182" r="58" fill="#00c300" opacity=".72"/>
          <rect x="120" y="286" width="120" height="16" rx="8" fill="#2a3c2a"/>
          <rect x="303" y="286" width="120" height="16" rx="8" fill="#2a3c2a"/>
          <rect x="485" y="286" width="120" height="16" rx="8" fill="#2a3c2a"/>
        </svg>`
      ),
    createdAt: minutesAgo(57),
    readBy: ['me'],
  },
  {
    id: 'm4',
    roomId: 'r1',
    senderId: 'me',
    kind: 'text',
    text: '完成したらRenderでそのまま公開できるようにしておく。',
    createdAt: minutesAgo(55),
    readBy: ['me', 'mika'],
  },
  {
    id: 'm5',
    roomId: 'r2',
    senderId: null,
    kind: 'system',
    text: 'みか がグループに参加しました',
    createdAt: minutesAgo(49),
    readBy: ['me'],
  },
  {
    id: 'm6',
    roomId: 'r2',
    senderId: 'haru',
    kind: 'text',
    text: 'トーク一覧は左、会話は右。LINEの骨格はこれでいいと思う。',
    createdAt: minutesAgo(43),
    readBy: ['me', 'haru'],
  },
  {
    id: 'm7',
    roomId: 'r2',
    senderId: 'so',
    kind: 'text',
    text: '送信ボタンは小さくても押しやすいほうが使いやすい。',
    createdAt: minutesAgo(41),
    readBy: ['me'],
  },
  {
    id: 'm8',
    roomId: 'r3',
    senderId: 'nana',
    kind: 'text',
    text: 'サイドバーの密度はかなりLINE寄りにしたいね。',
    createdAt: minutesAgo(92),
    readBy: ['me'],
  },
  {
    id: 'm9',
    roomId: 'r3',
    senderId: 'me',
    kind: 'text',
    text: '了解。リストとバッジ、既読、入力欄のリズムを揃える。',
    createdAt: minutesAgo(89),
    readBy: ['me', 'nana'],
  },
]

export const demoData: Omit<AppData, 'me'> & { me: Profile | null } = {
  version: '0.2.0',
  darkMode: true,
  me: null,
  friends,
  rooms,
  messages,
  selectedRoomId: 'r1',
  selectedTab: 'chats',
  drafts: {},
}

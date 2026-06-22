import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import {
  BackIcon,
  BellSlashIcon,
  CallIcon,
  ChatDotsIcon,
  GearIcon,
  MoreIcon,
  PeopleIcon,
  PhotoIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
} from './components/Icons'
import { hasSupabaseConfig } from './lib/supabase'
import { demoData } from './mock'
import { loadState, resetState, saveState, loadAccounts, saveAccounts, loadFriendships, saveFriendships } from './storage'
import { api } from './lib/api'
import { useSupabaseSync } from './lib/useSupabaseSync'
import { CallManager } from './components/CallManager'
import type { AppData, Message, Profile, Room, TabKey, Account, Friendship } from './types'


type Attachment = {
  name: string
  url: string
  kind: 'image'
}

const APP_VERSION = '1.1.1'

const bottomTabs: Array<{ key: TabKey; label: string; icon: typeof ChatDotsIcon }> = [
  { key: 'chats', label: 'トーク', icon: ChatDotsIcon },
  { key: 'friends', label: '友だち', icon: PeopleIcon },
  { key: 'settings', label: '設定', icon: GearIcon },
]

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)

    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(value))
}

function stripDay(value: string) {
  return value.slice(0, 10)
}

function initials(name: string) {
  const chars = Array.from(name.trim())
  return chars.slice(0, chars.length > 1 && chars[0] && chars[0].length === 1 ? 2 : 1).join('')
}

function getPalette(seed: string) {
  const colors = [
    ['#00c300', '#00a800'],
    ['#ff8a5c', '#ff6a3d'],
    ['#4da3ff', '#2678d8'],
    ['#8b6cff', '#6c4cff'],
    ['#f2c94c', '#e3a800'],
    ['#21c7a8', '#119b84'],
  ]

  const index = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length
  return colors[index]!
}

function Avatar({
  profile,
  size = 44,
}: {
  profile: Profile
  size?: number
}) {
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        className="avatar"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
        }}
      />
    )
  }

  const [start, end] = getPalette(profile.avatarSeed)

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(160deg, ${start}, ${end})`,
      }}
      aria-hidden="true"
    >
      {initials(profile.name)}
    </div>
  )
}


function RoomAvatar({
  room,
  members,
  meId,
}: {
  room: Room
  members: Profile[]
  meId: string
}) {
  if (!room.isGroup) {
    const other = members.find((member) => member.id.toLowerCase() !== meId.toLowerCase())
    if (!other) {
      const otherId = room.memberIds.find(id => id.toLowerCase() !== meId.toLowerCase()) || 'User'
      const initialChar = otherId.replace('@', '').charAt(0).toUpperCase()
      return <div className="avatar avatar--empty" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initialChar}</div>
    }
    return <Avatar profile={other} size={44} />
  }

  const swatches = members.filter((member) => member.id.toLowerCase() !== meId.toLowerCase()).slice(0, 4)

  return (
    <div className="avatar avatar--group" aria-hidden="true">
      {swatches.map((member) => {
        const [start, end] = getPalette(member.avatarSeed)
        return (
          <span
            key={member.id}
            className="avatar__mini"
            style={{ background: `linear-gradient(160deg, ${start}, ${end})` }}
          >
            {initials(member.name)}
          </span>
        )
      })}
    </div>
  )
}


function formatReadState(message: Message, room: Room, meId: string) {
  if (message.senderId !== meId || message.kind === 'system') {
    return null
  }

  const readBy = message.readBy || []
  const readCount = readBy.filter((id) => id !== meId).length

  return room.isGroup ? `既読${readCount}` : readCount > 0 ? '既読' : ''
}


function MessageMeta({
  message,
  room,
  meId,
}: {
  message: Message
  room: Room
  meId: string
}) {
  const readState = formatReadState(message, room, meId)
  const time = formatClock(message.createdAt)

  if (!readState) {
    return (
      <div className="message__meta message__meta--theirs">
        <span className="message__time">{time}</span>
      </div>
    )
  }

  return (
    <div className="message__meta message__meta--mine">
      <span className="message__read">{readState}</span>
      <span className="message__time">{time}</span>
    </div>
  )
}

function App() {
  const compact = useMediaQuery('(max-width: 920px)')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const sendTimerRef = useRef<number | null>(null)

  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  )

  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const [data, setData] = useState<AppData>(() => loadState())
  const [accounts, setAccounts] = useState<Account[]>(() => loadAccounts())
  const [friendships, setFriendships] = useState<Friendship[]>(() => loadFriendships())

  // Supabaseのリアルタイム同期を開始
  useSupabaseSync(data, setData, accounts, setAccounts, friendships, setFriendships)

  const [filterText, setFilterText] = useState('')
  const [composerText, setComposerText] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'chat'>('sidebar')
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [isSearchFriendOpen, setIsSearchFriendOpen] = useState(false)
  const [newChatMode, setNewChatMode] = useState<'direct' | 'group'>('direct')
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [pickerText, setPickerText] = useState('')
  const [profileName, setProfileName] = useState(data.me?.name ?? '')
  const [profileStatus, setProfileStatus] = useState(data.me?.status ?? '')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(data.me?.avatarUrl ?? '')
  const [isProfileSaved, setIsProfileSaved] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const [callingRoomId, setCallingRoomId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<'dialing' | 'connected'>('dialing')
  const [callDuration, setCallDuration] = useState<number>(0)
  
  // 新規追加：着信ステート
  const [incomingCall, setIncomingCall] = useState<{roomId: string, callerId: string} | null>(null)

  const avatarFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setProfileAvatarUrl(data.me?.avatarUrl ?? '')
  }, [data.me?.avatarUrl])

  const handlePickAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      window.alert('画像ファイルを選んでください。')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url) return
      setProfileAvatarUrl(url)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }


  const myFriends = useMemo(() => {
    if (!data.me) return []
    const myId = data.me.id
    const friendIds = friendships
      .filter((f) => f.userId === myId)
      .map((f) => f.friendId)
    return accounts
      .filter((acc) => friendIds.includes(acc.id))
      .map((acc) => acc.profile)
  }, [data.me, friendships, accounts])

  const profiles = useMemo(() => {
    if (!data.me) return []
    return [data.me, ...myFriends]
  }, [data.me, myFriends])


  const profilesById = useMemo(() => {
    const map = new Map<string, Profile>()
    for (const acc of accounts) {
      map.set(acc.profile.id, acc.profile)
    }
    if (data.me) {
      map.set(data.me.id, data.me)
    }
    return map
  }, [accounts, data.me])

  const myRooms = useMemo(() => {
    if (!data.me) return []
    const myId = data.me.id
    return data.rooms.filter((room) => room.memberIds.includes(myId))
  }, [data.rooms, data.me])

  const selectedRoom = useMemo(
    () => myRooms.find((room) => room.id === data.selectedRoomId) ?? null,
    [myRooms, data.selectedRoomId],
  )

  const callingRoom = useMemo(
    () => (callingRoomId ? data.rooms.find((r) => r.id === callingRoomId) ?? null : null),
    [data.rooms, callingRoomId],
  )

  const selectedRoomMessages = useMemo(() => {
    if (!selectedRoom) return []
    return data.messages
      .filter((message) => message.roomId === selectedRoom.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }, [data.messages, selectedRoom])

  const visibleRooms = useMemo(() => {
    const term = filterText.trim().toLowerCase()
    const rooms = [...myRooms].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
      return right.updatedAt.localeCompare(left.updatedAt)
    })

    if (!term) {
      return rooms
    }

    return rooms.filter((room) => {
      const lastMessage = [...data.messages]
        .filter((message) => message.roomId === room.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const preview = lastMessage?.text ?? ''
      const participantNames = room.memberIds
        .map((id) => profilesById.get(id)?.name ?? '')
        .join(' ')

      return (
        room.title.toLowerCase().includes(term) ||
        preview.toLowerCase().includes(term) ||
        participantNames.toLowerCase().includes(term)
      )
    })
  }, [data.messages, myRooms, filterText, profilesById])


  const visibleFriends = useMemo(() => {
    const term = filterText.trim().toLowerCase()
    const friends = myFriends
    if (!term) return friends
    return friends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(term) ||
        friend.handle.toLowerCase().includes(term) ||
        friend.status.toLowerCase().includes(term)
      )
    })
  }, [myFriends, filterText])

  const groupableFriends = useMemo(() => {
    const term = pickerText.trim().toLowerCase()
    if (!term) return myFriends
    return myFriends.filter((friend) => {
      return (
        friend.name.toLowerCase().includes(term) ||
        friend.status.toLowerCase().includes(term) ||
        friend.handle.toLowerCase().includes(term)
      )
    })
  }, [myFriends, pickerText])

  const roomMemberProfiles = useMemo(() => {
    if (!selectedRoom) return []
    return selectedRoom.memberIds
      .map((id) => profilesById.get(id))
      .filter((profile): profile is Profile => Boolean(profile))
  }, [profilesById, selectedRoom])

  useEffect(() => {
    saveState(data)
  }, [data])

  useEffect(() => {
    saveAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    saveFriendships(friendships)
  }, [friendships])

  useEffect(() => {
    setProfileName(data.me?.name ?? '')
    setProfileStatus(data.me?.status ?? '')
  }, [data.me?.name, data.me?.status])

  useEffect(() => {
    if (!selectedRoom || !data.me) return

    // 実際にチャット画面を開いて見ているかチェック
    const isTabActive = data.selectedTab === 'chats'
    const isPanelActive = !compact || mobilePanel === 'chat'
    const isDocVisible = isDocumentVisible

    if (!isTabActive || !isPanelActive || !isDocVisible) return

    // 自分が送信者でなく、まだ既読にしていないメッセージがあるか判定
    const hasUnread = data.messages.some(
      (m) => m.roomId === selectedRoom.id && m.senderId?.toLowerCase() !== data.me!.id.toLowerCase() && !m.readBy.map(id => id.toLowerCase()).includes(data.me!.id.toLowerCase())
    )
    const room = data.rooms.find(r => r.id === selectedRoom.id)
    const hasUnreadCount = room ? room.unread > 0 : false

    if (hasUnread || hasUnreadCount) {
      api.markAsRead(selectedRoom.id, data.me.id).catch(err => {
        console.error('Failed to mark as read on Supabase', err)
      })
    }

    setData((prev) => {
      if (!prev.me) return prev

      let messagesChanged = false
      const messages = prev.messages.map((message) => {
        if (message.roomId !== selectedRoom.id) return message
        if (message.senderId?.toLowerCase() === prev.me!.id.toLowerCase()) return message
        if (message.readBy.map(id => id.toLowerCase()).includes(prev.me!.id.toLowerCase())) return message

        messagesChanged = true
        return {
          ...message,
          readBy: [...message.readBy, prev.me!.id],
        }
      })

      let roomsChanged = false
      const rooms = prev.rooms.map((room) => {
        if (room.id !== selectedRoom.id) return room
        if (room.unread === 0) return room
        roomsChanged = true
        return { ...room, unread: 0 }
      })

      if (!messagesChanged && !roomsChanged) return prev

      return { ...prev, messages, rooms }
    })
  }, [
    selectedRoom?.id,
    data.messages,
    data.rooms,
    data.me?.id,
    data.selectedTab,
    compact,
    mobilePanel,
    isDocumentVisible
  ])

  useEffect(() => {
    if (!compact) {
      setMobilePanel('sidebar')
      return
    }

    if (data.selectedTab !== 'chats') {
      setMobilePanel('sidebar')
      return
    }

    if (selectedRoom) {
      setMobilePanel('chat')
    }
  }, [compact, data.selectedTab, selectedRoom])

  useEffect(() => {
    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current)
      sendTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', data.darkMode ? 'dark' : 'light')
  }, [data.darkMode])

  const updateData = (updater: (current: AppData) => AppData) => {
    setData((current) => updater(current))
  }

  const setTab = (tab: TabKey) => {
    updateData((current) => ({ ...current, selectedTab: tab }))
    setIsInfoOpen(false)
    if (compact) {
      setMobilePanel('sidebar')
    }
  }

  const selectRoom = (roomId: string) => {
    updateData((current) => ({ ...current, selectedRoomId: roomId, selectedTab: 'chats' }))
    setIsInfoOpen(false)
    if (compact) {
      setMobilePanel('chat')
    }
  }

  const ensureDirectRoom = async (friendId: string) => {
    if (!data.me) return
    const friend = myFriends.find((item) => item.id === friendId)
    if (!friend) return

    const myId = data.me.id
    const existing = data.rooms.find(
      (room) =>
        !room.isGroup &&
        room.memberIds.length === 2 &&
        room.memberIds.includes(myId) &&
        room.memberIds.includes(friendId),
    )

    if (existing) {
      selectRoom(existing.id)
      return
    }

    const roomId = makeId('room')
    const now = new Date().toISOString()
    const welcome: Message = {
      id: makeId('msg'),
      roomId,
      senderId: null,
      kind: 'system',
      text: `${friend.name} とのトークを開始しました`,
      createdAt: now,
      readBy: [myId],
    }

    const room: Room = {
      id: roomId,
      title: friend.name,
      memberIds: [myId, friendId],
      isGroup: false,
      pinned: false,
      muted: false,
      unread: 0,
      updatedAt: now,
    }

    updateData((current) => ({
      ...current,
      rooms: [room, ...current.rooms],
      messages: [...current.messages, welcome],
      selectedRoomId: roomId,
      selectedTab: 'chats',
    }))
    setFilterText('')
    if (compact) {
      setMobilePanel('chat')
    }

    try {
      await api.createRoom(roomId, [myId, friendId], false)
      await api.sendMessage(welcome)
    } catch (err) {
      console.error('Failed to create direct room on Supabase', err)
    }
  }


  const togglePin = (roomId: string) => {
    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, pinned: !room.pinned } : room,
      ),
    }))
  }

  const toggleMute = (roomId: string) => {
    updateData((current) => ({
      ...current,
      rooms: current.rooms.map((room) =>
        room.id === roomId ? { ...room, muted: !room.muted } : room,
      ),
    }))
  }

  const clearRoom = (roomId: string) => {
    const room = data.rooms.find((item) => item.id === roomId)
    if (!room) return

    setConfirmDialog({
      message: `「${room.title}」の履歴を消しますか？`,
      onConfirm: () => {
        updateData((current) => ({
          ...current,
          messages: current.messages.filter((message) => message.roomId !== roomId),
          rooms: current.rooms.map((item) =>
            item.id === roomId ? { ...item, unread: 0, updatedAt: new Date().toISOString() } : item,
          ),
        }))
        setIsInfoOpen(false)
        setConfirmDialog(null)
      }
    })
  }

  const createMessage = ({
    roomId,
    senderId,
    kind,
    text,
    imageUrl,
    readBy,
  }: {
    roomId: string
    senderId: string | null
    kind: Message['kind']
    text: string
    imageUrl?: string | undefined
    readBy: string[]
  }) => {
    const createdAt = new Date().toISOString()
    const message: Message = {
      id: makeId('msg'),
      roomId,
      senderId,
      kind,
      text,
      imageUrl,
      createdAt,
      readBy,
    }

    updateData((current) => ({
      ...current,
      messages: [...current.messages, message],
      rooms: current.rooms.map((room) => {
        if (room.id !== roomId) return room
        return {
          ...room,
          updatedAt: createdAt,
          unread: room.id === current.selectedRoomId ? 0 : room.unread + 1,
        }
      }),
    }))

    // バックグラウンドでSupabaseに送信
    api.sendMessage(message).catch(err => console.error('Supabase send failed', err))

    return message
  }

  const startCall = () => {
    if (!selectedRoom || !data.me) return
    setCallingRoomId(selectedRoom.id)
    setCallStatus('dialing')
    setCallDuration(0)
    // WebRTCシグナリング呼び出し
    ;(window as any).CallApi?.startCall(selectedRoom.id)
  }

  const handleHangUp = (duration: number) => {
    if (callingRoomId) {
      // 通話終了処理
      const finalDuration = (window as any).CallApi?.hangUp(callingRoomId) ?? duration
      const minutes = Math.floor(finalDuration / 60)
      const seconds = finalDuration % 60
      const timeStr = finalDuration > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '不在着信'
      const msg = finalDuration > 0 ? `通話が終了しました (${timeStr})` : '通話をキャンセルしました'
      
      const message = createMessage({
        roomId: callingRoomId,
        senderId: '',
        kind: 'system',
        text: msg,
        readBy: [],
      })
      api.sendMessage(message).catch(err => console.error('Supabase send failed', err))
    }
    setCallingRoomId(null)
  }

  const acceptCall = () => {
    if (!incomingCall) return
    ;(window as any).CallApi?.acceptCall(incomingCall.roomId)
    setCallingRoomId(incomingCall.roomId)
    setCallStatus('connected')
    setCallDuration(0)
    setIncomingCall(null)
    updateData(prev => ({ ...prev, selectedRoomId: incomingCall.roomId, selectedTab: 'chats' }))
  }

  const rejectCall = () => {
    if (!incomingCall) return
    ;(window as any).CallApi?.rejectCall(incomingCall.roomId)
    setIncomingCall(null)
  }

  const sendComposer = () => {
    if (!selectedRoom || !data.me) return

    const text = composerText.trim()
    if (!text && !attachment) return

    const myId = data.me.id
    const readBy = [myId]
    createMessage({
      roomId: selectedRoom.id,
      senderId: myId,
      kind: attachment ? 'image' : 'text',
      text: attachment ? text || '写真を送信しました' : text,
      ...(attachment ? { imageUrl: attachment.url } : {}),
      readBy,
    })

    setComposerText('')
    setAttachment(null)
  }

  const removeMessage = (messageId: string) => {
    if (!data.me) return
    const target = data.messages.find((message) => message.id === messageId)
    if (!target || target.senderId !== data.me.id) return

    updateData((current) => ({
      ...current,
      messages: current.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              text: 'メッセージの送信を取り消しました',
              imageUrl: undefined,
              kind: 'system' as const,
              senderId: '',
            }
          : message
      ),
    }))

    // Supabase上のメッセージも取り消し状態に更新
    api.removeMessage(messageId).catch(err => console.error('Supabase remove failed', err))
  }


  const handlePickAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      window.alert('画像ファイルを選んでください。')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (!url) return
      setAttachment({ name: file.name, url, kind: 'image' })
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendComposer()
    }
  }

  const createGroup = () => {
    if (!data.me) return
    setModalError(null)

    const members = selectedMemberIds
      .map((id) => myFriends.find((friend) => friend.id === id))
      .filter((friend): friend is Profile => Boolean(friend))

    if (members.length < 2) {
      setModalError('グループは2人以上選んでください。')
      return
    }

    const title = newGroupName.trim() || members.map((member) => member.name).slice(0, 3).join('、')
    const roomId = makeId('room')
    const now = new Date().toISOString()
    const systemMessage: Message = {
      id: makeId('msg'),
      roomId,
      senderId: null,
      kind: 'system',
      text: `${title} を作成しました`,
      createdAt: now,
      readBy: [data.me.id],
    }

    const room: Room = {
      id: roomId,
      title,
      memberIds: [data.me.id, ...members.map((member) => member.id)],
      isGroup: true,
      pinned: false,
      muted: false,
      unread: 0,
      updatedAt: now,
    }

    updateData((current) => ({
      ...current,
      rooms: [room, ...current.rooms],
      messages: [...current.messages, systemMessage],
      selectedRoomId: roomId,
      selectedTab: 'chats',
    }))

    setNewGroupName('')
    setSelectedMemberIds([])
    setIsNewChatOpen(false)
    if (compact) {
      setMobilePanel('chat')
    }

    // バックグラウンドでSupabaseにルーム作成を同期
    api.createRoom(room.id, room.memberIds, room.isGroup, room.title)
      .then(() => api.sendMessage(systemMessage))
      .catch(err => console.error('Supabase room creation failed', err))
  }

  const saveProfile = () => {
    if (!data.me) return

    const name = profileName.trim()
    const status = profileStatus.trim()

    const updatedProfile = {
      ...data.me,
      name: name || data.me.name,
      status: status || data.me.status,
      avatarUrl: profileAvatarUrl || undefined,
    }

    setAccounts((prev) =>
      prev.map((acc) =>
        acc.id === data.me!.id ? { ...acc, profile: updatedProfile } : acc
      )
    )

    updateData((current) => ({
      ...current,
      me: updatedProfile,
    }))

    setIsProfileSaved(true)
    setTimeout(() => setIsProfileSaved(false), 2000)

    // Supabaseにプロフィール更新を同期
    api.updateProfile(data.me.id, updatedProfile.name, updatedProfile.status, updatedProfile.avatarUrl)
      .catch(err => console.error('Supabase profile update failed', err))
  }


  const restoreDemo = () => {
    setConfirmDialog({
      message: 'デモ状態を初期化しますか？',
      onConfirm: () => {
        resetState()
        window.localStorage.removeItem('y-chat2.accounts.v1')
        window.localStorage.removeItem('y-chat2.friendships.v1')

        const fresh = loadState()
        const freshAccounts = loadAccounts()
        const freshFriendships = loadFriendships()

        setAccounts(freshAccounts)
        setFriendships(freshFriendships)
        setData(fresh)
        setFilterText('')
        setComposerText('')
        setAttachment(null)
        setMobilePanel('sidebar')
        setIsInfoOpen(false)
        setIsNewChatOpen(false)
        setModalError(null)
        setConfirmDialog(null)
      }
    })
  }


  if (!data.me) {
    return (
      <AuthScreen
        accounts={accounts}
        onLogin={(meProfile) => {
          setData((prev) => ({
            ...prev,
            me: meProfile,
            selectedRoomId: '',
            selectedTab: 'chats',
          }))
        }}
        onSignUp={(newAccount) => {
          setAccounts((prev) => [...prev, newAccount])
          setData((prev) => ({
            ...prev,
            me: newAccount.profile,
            selectedRoomId: '',
            selectedTab: 'chats',
          }))
        }}
        darkMode={data.darkMode}
        onToggleDarkMode={(darkMode) => {
          setData((prev) => ({ ...prev, darkMode }))
        }}
      />
    )
  }

  const sidebarContent = (

    <div className="sidebar">
      <div className="sidebar__top">
        <div className="brand">
          <div className="brand__mark">Y</div>
          <div>
            <div className="brand__title">Y-Chat2</div>
          </div>
        </div>

        <button className="icon-button" type="button" onClick={() => setIsNewChatOpen(true)}>
          <PlusIcon className="icon" />
        </button>
      </div>

      <div className="tab-strip" role="tablist" aria-label="main navigation">
        {bottomTabs.map((tab) => {
          const Icon = tab.icon
          const active = data.selectedTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              className={`tab-strip__button ${active ? 'is-active' : ''}`}
              onClick={() => setTab(tab.key)}
            >
              <Icon className="icon icon--small" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {data.selectedTab !== 'settings' && (
        <label className="search-bar">
          <SearchIcon className="icon icon--small search-bar__icon" />
          <input
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            className="search-bar__input"
            placeholder={data.selectedTab === 'friends' ? '友だちを検索' : 'トークを検索'}
          />
        </label>
      )}

      <div className="sidebar__content">
        {data.selectedTab === 'chats' && (
          <section className="list-group">
            <div className="section-heading">
              <span>ピン留め</span>
              <span>{visibleRooms.filter((room) => room.pinned).length}</span>
            </div>
            <div className="room-list">
              {visibleRooms
                .filter((room) => room.pinned)
                .map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    current={room.id === data.selectedRoomId}
                    members={roomMemberProfilesFor(room, profilesById)}
                    messages={data.messages}
                    meId={data.me!.id}
                    onClick={() => selectRoom(room.id)}
                  />
                ))}
            </div>

            <div className="section-heading section-heading--spaced">
              <span>トーク</span>
              <span>{visibleRooms.filter((room) => !room.pinned).length}</span>
            </div>
            <div className="room-list">
              {visibleRooms
                .filter((room) => !room.pinned)
                .map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    current={room.id === data.selectedRoomId}
                    members={roomMemberProfilesFor(room, profilesById)}
                    messages={data.messages}
                    meId={data.me!.id}
                    onClick={() => selectRoom(room.id)}
                  />
                ))}
            </div>

          </section>
        )}

        {data.selectedTab === 'friends' && (
          <section className="friend-list">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span>友だち</span>
                <span>{visibleFriends.length}</span>
              </div>
              <button
                type="button"
                className="button"
                onClick={() => setIsSearchFriendOpen(true)}
                style={{ fontSize: '12.5px', height: '32px', minHeight: '32px', padding: '0 12px', borderRadius: '10px' }}
              >
                ID検索で追加
              </button>
            </div>
            {visibleFriends.map((friend) => (

              <button
                key={friend.id}
                type="button"
                className="friend-row"
                onClick={() => ensureDirectRoom(friend.id)}
              >
                <Avatar profile={friend} />
                <div className="friend-row__body">
                  <div className="friend-row__top">
                    <strong>{friend.name}</strong>
                    <span>{friend.handle}</span>
                  </div>
                </div>
              </button>
            ))}
          </section>
        )}

        {data.selectedTab === 'settings' && (
          <section className="settings">
            <div className="settings-card">
              <div className="settings-card__header">
                <Avatar profile={{ ...data.me!, avatarUrl: profileAvatarUrl }} size={56} />
                <div>
                  <h2>{data.me!.name}</h2>
                  <p>{data.me!.handle}</p>
                </div>
              </div>

              <div className="field">
                <span className="field__label">プロフィール画像</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    画像を選択
                  </button>
                  {profileAvatarUrl && (
                    <button
                      type="button"
                      className="button button--danger"
                      style={{ minHeight: '44px', color: 'var(--danger)' }}
                      onClick={() => setProfileAvatarUrl('')}
                    >
                      削除
                    </button>
                  )}
                </div>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handlePickAvatar}
                />
              </div>

              <label className="field">
                <span className="field__label">表示名</span>
                <input
                  className="field__input"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                />
              </label>
              <button 
                type="button" 
                className={`button ${isProfileSaved ? '' : 'button--primary'}`} 
                onClick={saveProfile}
                style={{ transition: 'all 0.3s ease', background: isProfileSaved ? 'var(--accent)' : '' }}
              >
                {isProfileSaved ? '変更しました ✓' : 'プロフィールを保存'}
              </button>
            </div>

            <div className="settings-card">
              <label className="switch-label">
                <span className="field__label" style={{ margin: 0 }}>ダークモード</span>
                <div className="switch">
                  <input
                    type="checkbox"
                    checked={data.darkMode}
                    onChange={(e) => updateData((curr) => ({ ...curr, darkMode: e.target.checked }))}
                  />
                  <span className="slider"></span>
                </div>
              </label>
            </div>



            <div className="settings-card">
              <button
                type="button"
                className="button button--danger"
                style={{ width: '100%' }}
                onClick={() => {
                  setConfirmDialog({
                    message: 'ログアウトしますか？',
                    onConfirm: () => {
                      setData((prev) => ({
                        ...prev,
                        me: null,
                      }))
                      setConfirmDialog(null)
                    }
                  })
                }}
              >
                ログアウト
              </button>
            </div>
          </section>
        )}

      </div>

      <div className="sidebar__footer">
        <span className="sidebar__hint">{APP_VERSION}</span>
      </div>
    </div>
  )

  const mainStage = selectedRoom ? (
    <div className="stage">
      <header className="chat-header">
        <div className="chat-header__left">
          {compact && (
            <button type="button" className="icon-button" onClick={() => setMobilePanel('sidebar')}>
              <BackIcon className="icon" />
            </button>
          )}
          <RoomAvatar room={selectedRoom} members={roomMemberProfiles} meId={data.me!.id} />
          <div className="chat-header__title">
            <strong>{
              !selectedRoom.isGroup
                ? (roomMemberProfiles.find((m) => m.id.toLowerCase() !== data.me?.id.toLowerCase())?.name 
                   ?? selectedRoom.memberIds.find((id) => id.toLowerCase() !== data.me?.id.toLowerCase()) 
                   ?? selectedRoom.title)
                : selectedRoom.title
            }</strong>
            <span>
              {selectedRoom.isGroup
                ? `${selectedRoom.memberIds.length}人のグループ`
                : selectedRoom.muted
                  ? '通知オフ'
                  : 'トーク中'}
            </span>
          </div>
        </div>

        <div className="chat-header__actions">
          <button type="button" className="icon-button" title="通話" onClick={startCall}>
            <CallIcon className="icon" />
          </button>
          <button type="button" className="icon-button" title="詳細" onClick={() => setIsInfoOpen(true)}>
            <MoreIcon className="icon" />
          </button>
        </div>
      </header>

      <main className="thread">
        {selectedRoomMessages.length === 0 ? (
          <div className="thread__empty">
            <strong>まだメッセージがありません</strong>
            <p>最初のひとことを送ってください。</p>
          </div>
        ) : (
          <>
            {selectedRoomMessages.map((message, index) => {
              const previous = selectedRoomMessages[index - 1]
              const showDate = !previous || stripDay(previous.createdAt) !== stripDay(message.createdAt)
              const sender = message.senderId ? profilesById.get(message.senderId) : null
              const mine = message.senderId === data.me!.id

              return (
                <div key={message.id}>
                  {showDate && <div className="day-divider">{formatDay(message.createdAt)}</div>}

                  {message.kind === 'system' ? (
                    <div className="system-note">{message.text}</div>
                  ) : (
                    <article className={`message-row ${mine ? 'message-row--mine' : 'message-row--theirs'}`}>
                      {!mine && sender && (
                        <div className="message-row__avatar">
                          <Avatar profile={sender} size={36} />
                        </div>
                      )}
                      
                      <div className="message-row__body">
                        {!mine && roomMemberProfiles.length > 2 && selectedRoom.isGroup && (
                          <span className="message-row__name">{sender?.name ?? '不明'}</span>
                        )}

                        <div className={`message-wrapper ${mine ? 'message-wrapper--mine' : 'message-wrapper--theirs'}`}>
                          <div className={`message ${mine ? 'message--mine' : 'message--theirs'}`}>
                            {message.imageUrl && <img src={message.imageUrl} alt="" className="message__image" />}
                            {message.text && (
                              <p className={`message__text ${message.imageUrl ? 'message__text--compact' : ''}`}>
                                {message.text}
                              </p>
                            )}
                          </div>
                          <MessageMeta message={message} room={selectedRoom} meId={data.me!.id} />
                        </div>
                        
                        {mine && (
                          <button
                            type="button"
                            className="message-row__delete"
                            onClick={() => removeMessage(message.id)}
                            title="自分のメッセージを削除"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </article>
                  )}
                </div>
              )
            })}
          </>
        )}
      </main>

      <footer className="composer">
        {attachment && (
          <div className="composer__attachment">
            <img src={attachment.url} alt={attachment.name} />
            <button
              type="button"
              className="composer__attachment-close"
              onClick={() => setAttachment(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="composer__bar">
          <button type="button" className="icon-button icon-button--soft" onClick={() => fileInputRef.current?.click()}>
            <PhotoIcon className="icon" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePickAttachment}
          />

          <textarea
            className="composer__input"
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="メッセージを入力"
            rows={1}
          />

          <button
            type="button"
            className="send-button"
            onClick={sendComposer}
            disabled={!composerText.trim() && !attachment}
          >
            <SendIcon className="icon icon--small" />
          </button>
        </div>
      </footer>

      {isInfoOpen && (
        <RoomDrawer
          room={selectedRoom}
          members={roomMemberProfiles}
          meId={data.me!.id}
          onClose={() => setIsInfoOpen(false)}
          onToggleMute={() => toggleMute(selectedRoom.id)}
          onTogglePin={() => togglePin(selectedRoom.id)}
          onClear={() => clearRoom(selectedRoom.id)}
        />
      )}
    </div>
  ) : (
    <div className="stage stage--empty">
      <div className="stage__empty">
        <div className="stage__empty-mark">Y</div>
        <strong>トークを選んでください</strong>
        <p>LINEに近いリズムで、左から相手を選んで右で会話します。</p>
      </div>
    </div>
  )

  const showChatPanel = !compact || (data.selectedTab === 'chats' && mobilePanel === 'chat' && Boolean(selectedRoom))



  return (
    <div className={`app-shell ${compact ? 'app-shell--compact' : ''}`}>
      {data.me && (
        <CallManager 
          myId={data.me.id}
          rooms={data.rooms}
          currentRoomId={callingRoomId}
          onIncomingCall={(roomId, callerId) => setIncomingCall({roomId, callerId})}
          onCallAccepted={(roomId) => {
            setCallingRoomId(roomId)
            setCallStatus('connected')
            setCallDuration(0)
          }}
          onCallRejected={() => setCallingRoomId(null)}
          onCallEnded={(roomId, duration) => {
            setCallingRoomId(null)
            if (duration > 0) {
              const minutes = Math.floor(duration / 60)
              const seconds = duration % 60
              createMessage({
                roomId,
                senderId: '',
                kind: 'system',
                text: `通話が終了しました (${minutes}:${seconds.toString().padStart(2, '0')})`,
                readBy: []
              })
            }
          }}
        />
      )}

      {incomingCall && (
        <div className="modal" style={{ zIndex: 150 }}>
          <button type="button" className="modal__backdrop" aria-label="close" onClick={rejectCall} />
          <section className="modal__dialog" style={{ maxWidth: '320px', padding: '30px', textAlign: 'center' }}>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <Avatar profile={profilesById.get(incomingCall.callerId) || { id: '', name: '不明', handle: '', avatarSeed: 'x', status: '', accent: '#ccc' }} size={80} />
            </div>
            <strong style={{ fontSize: '1.2rem', display: 'block', marginBottom: '8px' }}>
              {profilesById.get(incomingCall.callerId)?.name || '不明'}からの着信
            </strong>
            <p style={{ color: 'var(--muted)', marginBottom: '30px' }}>音声通話</p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button type="button" className="call-screen__hangup" onClick={rejectCall} style={{ width: 64, height: 64, border: 'none', cursor: 'pointer' }}>
                <CallIcon className="icon" />
              </button>
              <button type="button" className="call-screen__hangup" onClick={acceptCall} style={{ width: 64, height: 64, background: 'var(--accent)', boxShadow: '0 10px 30px rgba(0, 195, 0, 0.4)', border: 'none', cursor: 'pointer' }}>
                <CallIcon className="icon" />
              </button>
            </div>
          </section>
        </div>
      )}

      {callingRoom && (
        <CallScreen 
          room={callingRoom}
          members={callingRoom.memberIds
            .map((id) => profilesById.get(id))
            .filter((profile): profile is Profile => Boolean(profile)) ?? []}
          meId={data.me!.id}
          callStatus={callStatus}
          onHangUp={handleHangUp}
        />
      )}

      {!compact && sidebarContent}
      {!compact && mainStage}

      {compact && !showChatPanel && sidebarContent}
      {compact && showChatPanel && mainStage}

      {isNewChatOpen && (
        <NewChatModal
          friends={groupableFriends}
          members={selectedMemberIds}
          mode={newChatMode}
          groupName={newGroupName}
          error={modalError}
          query={pickerText}
          onClose={() => {
            setIsNewChatOpen(false)
            setModalError(null)
          }}
          onModeChange={setNewChatMode}
          onQueryChange={setPickerText}
          onGroupNameChange={setNewGroupName}
          onToggleMember={(memberId) => {
            setSelectedMemberIds((current) =>
              current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
            )
          }}
          onCreateGroup={createGroup}
          onOpenDirect={(friendId) => {
            ensureDirectRoom(friendId)
            setIsNewChatOpen(false)
            setModalError(null)
          }}
        />
      )}

      {isSearchFriendOpen && (
        <SearchFriendModal
          accounts={accounts}
          myFriends={myFriends}
          myProfile={data.me}
          onClose={() => setIsSearchFriendOpen(false)}
          onAddFriend={async (friend) => {
            try {
              // バックエンドに追加
              await api.addFriend(data.me!.id, friend.handle)
              
              // ローカルのaccountsリストにも追加しておく（これがないとmyFriendsに反映されない）
              setAccounts((prev) => {
                if (prev.some(a => a.id === friend.id)) return prev
                return [...prev, { id: friend.id, password: '', passwordHash: '', name: friend.name, handle: friend.handle, profile: friend }]
              })

              const newFriendships = [
                ...friendships,
                { userId: data.me!.id, friendId: friend.id },
                { userId: friend.id, friendId: data.me!.id },
              ]
              setFriendships(newFriendships)
            } catch (err) {
              console.error(err)
              alert('友達追加に失敗しました。')
            }
          }}
        />
      )}


      {confirmDialog && (
        <div className="modal" style={{ zIndex: 200 }}>
          <button type="button" className="modal__backdrop" aria-label="close" onClick={() => setConfirmDialog(null)} />
          <section className="modal__dialog" style={{ maxWidth: '320px', padding: '24px', textAlign: 'center' }}>
            <strong style={{ display: 'block', marginBottom: '20px', fontSize: '1.1rem' }}>{confirmDialog.message}</strong>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" className="button" onClick={() => setConfirmDialog(null)} style={{ flex: 1 }}>
                キャンセル
              </button>
              <button type="button" className="button button--danger" onClick={confirmDialog.onConfirm} style={{ flex: 1 }}>
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}


function roomMemberProfilesFor(room: Room, map: Map<string, Profile>) {
  return room.memberIds
    .map((id) => map.get(id))
    .filter((profile): profile is Profile => Boolean(profile))
}

function RoomRow({
  room,
  current,
  members,
  messages,
  meId,
  onClick,
}: {
  room: Room
  current: boolean
  members: Profile[]
  messages: Message[]
  meId: string
  onClick: () => void
}) {
  const lastMessage = [...messages]
    .filter((message) => message.roomId === room.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]

  const preview =
    lastMessage?.kind === 'image'
      ? '写真'
      : lastMessage?.kind === 'system'
        ? lastMessage.text
        : lastMessage?.text ?? '新しいトーク'

  return (
    <button
      type="button"
      className={`room-row ${current ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <RoomAvatar room={room} members={members} meId={meId} />


      <div className="room-row__body">
        <div className="room-row__top">
          <strong>{
            !room.isGroup
              ? (members.find((m) => m.id.toLowerCase() !== meId.toLowerCase())?.name 
                 ?? room.memberIds.find((id) => id.toLowerCase() !== meId.toLowerCase()) 
                 ?? room.title)
              : room.title
          }</strong>
          <span>{lastMessage ? formatClock(lastMessage.createdAt) : ''}</span>
        </div>

        <div className="room-row__bottom">
          <p className="room-row__preview">{preview}</p>
          <div className="room-row__flags">
            {room.pinned && <PinIcon className="icon icon--tiny" />}
            {room.muted && <BellSlashIcon className="icon icon--tiny" />}
            {room.unread > 0 && <span className="room-row__badge">{room.unread}</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

function RoomDrawer({
  room,
  members,
  meId,
  onClose,
  onToggleMute,
  onTogglePin,
  onClear,
}: {
  room: Room
  members: Profile[]
  meId: string
  onClose: () => void
  onToggleMute: () => void
  onTogglePin: () => void
  onClear: () => void
}) {
  return (
    <div className="drawer">
      <button type="button" className="drawer__overlay" aria-label="close" onClick={onClose} />
      <aside className="drawer__panel">
        <div className="drawer__header">
          <strong>トーク情報</strong>
          <button type="button" className="icon-button" onClick={onClose}>
            <BackIcon className="icon" />
          </button>
        </div>

        <div className="drawer__hero">
          <RoomAvatar room={room} members={members} meId={meId} />

          <div>
            <h2>{room.title}</h2>
            <p>{room.isGroup ? `${room.memberIds.length}人のグループ` : '1対1トーク'}</p>
          </div>
        </div>

        <div className="drawer__actions">
          <button type="button" className="button" onClick={onTogglePin}>
            {room.pinned ? 'ピン留め解除' : 'ピン留め'}
          </button>
          <button type="button" className="button" onClick={onToggleMute}>
            {room.muted ? '通知オン' : '通知オフ'}
          </button>
          <button type="button" className="button button--danger" onClick={onClear}>
            履歴を消去
          </button>
        </div>

        <div className="drawer__members">
          <div className="section-heading">
            <span>メンバー</span>
            <span>{members.length}</span>
          </div>
          {members.map((member) => (
            <div className="drawer__member" key={member.id}>
              <Avatar profile={member} size={40} />
              <div>
                <strong>{member.name}</strong>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

function NewChatModal({
  friends,
  members,
  mode,
  groupName,
  error,
  query,
  onClose,
  onModeChange,
  onQueryChange,
  onGroupNameChange,
  onToggleMember,
  onCreateGroup,
  onOpenDirect,
}: {
  friends: Profile[]
  members: string[]
  mode: 'direct' | 'group'
  groupName: string
  error: string | null
  query: string
  onClose: () => void
  onModeChange: (mode: 'direct' | 'group') => void
  onQueryChange: (value: string) => void
  onGroupNameChange: (value: string) => void
  onToggleMember: (memberId: string) => void
  onCreateGroup: () => void
  onOpenDirect: (friendId: string) => void
}) {
  return (
    <div className="modal">
      <button type="button" className="modal__backdrop" aria-label="close" onClick={onClose} />
      <section className="modal__dialog">
        <div className="modal__header">
          <strong>新しいトーク</strong>
          <button type="button" className="icon-button" onClick={onClose}>
            <BackIcon className="icon" />
          </button>
        </div>

        <div className="tab-strip tab-strip--modal">
          <button
            type="button"
            className={`tab-strip__button ${mode === 'direct' ? 'is-active' : ''}`}
            onClick={() => onModeChange('direct')}
          >
            1対1
          </button>
          <button
            type="button"
            className={`tab-strip__button ${mode === 'group' ? 'is-active' : ''}`}
            onClick={() => onModeChange('group')}
          >
            グループ
          </button>
        </div>

        <label className="search-bar search-bar--modal">
          <SearchIcon className="icon icon--small search-bar__icon" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="search-bar__input"
            placeholder="友だちを検索"
          />
        </label>

        {mode === 'direct' ? (
          <div className="modal__list">
            {friends.map((friend) => (
              <button
                type="button"
                key={friend.id}
                className="friend-row friend-row--modal"
                onClick={() => onOpenDirect(friend.id)}
              >
                <Avatar profile={friend} />
                <div className="friend-row__body">
                  <div className="friend-row__top">
                    <strong>{friend.name}</strong>
                    <span>{friend.handle}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="modal__group">
            <label className="field">
              <span className="field__label">グループ名</span>
              <input
                className="field__input"
                value={groupName}
                onChange={(event) => onGroupNameChange(event.target.value)}
                placeholder="新しいグループ"
              />
            </label>

            <div className="modal__list">
              {friends.map((friend) => (
                <label key={friend.id} className="friend-check">
                  <input
                    type="checkbox"
                    checked={members.includes(friend.id)}
                    onChange={() => onToggleMember(friend.id)}
                  />
                  <Avatar profile={friend} />
                  <div className="friend-row__body">
                    <div className="friend-row__top">
                      <strong>{friend.name}</strong>
                      <span>{friend.handle}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {error && <p className="modal__error">{error}</p>}

            <button type="button" className="button button--primary" onClick={onCreateGroup}>
              グループを作成
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export default App

function AuthScreen({
  accounts,
  onLogin,
  onSignUp,
  darkMode,
  onToggleDarkMode,
}: {
  accounts: Account[]
  onLogin: (profile: Profile) => void
  onSignUp: (account: Account) => void
  darkMode: boolean
  onToggleDarkMode: (dark: boolean) => void
}) {
  const [isLogin, setIsLogin] = useState(true)
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanHandle = handle.trim()
    const formattedHandle = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`
    const cleanName = name.trim()
    const cleanPassword = password.trim()

    if (!cleanHandle || cleanHandle === '@') {
      setError('ユーザーIDを入力してください。')
      return
    }
    if (!cleanPassword) {
      setError('パスワードを入力してください。')
      return
    }

    try {
      if (isLogin) {
        const profile = await api.login(formattedHandle, cleanPassword)
        onLogin(profile)
      } else {
        if (!cleanName) {
          setError('表示名を入力してください。')
          return
        }
        if (cleanHandle.length < 3) {
          setError('ユーザーIDは@を除いて3文字以上で入力してください。')
          return
        }

        const profile = await api.signUp(formattedHandle, cleanPassword, cleanName)
        
        const newAccount: Account = {
          id: profile.id,
          handle: profile.id,
          passwordHash: cleanPassword,
          profile
        }
        onSignUp(newAccount)
      }
    } catch (err: any) {
      setError(err.message || '通信エラーが発生しました')
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__bg" aria-hidden="true">
        <div className="auth-screen__circle auth-screen__circle--1"></div>
        <div className="auth-screen__circle auth-screen__circle--2"></div>
      </div>
      
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">Y</div>
          <h1>Y-Chat2</h1>
          <p>コミュニケーションを、もっとシンプルに。</p>
        </div>

        <div className="tab-strip tab-strip--modal">
          <button
            type="button"
            className={`tab-strip__button ${isLogin ? 'is-active' : ''}`}
            onClick={() => {
              setIsLogin(true)
              setError(null)
            }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={`tab-strip__button ${!isLogin ? 'is-active' : ''}`}
            onClick={() => {
              setIsLogin(false)
              setError(null)
            }}
          >
            アカウント作成
          </button>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <label className="field">
            <span className="field__label">ユーザーID</span>
            <div className="field__input-wrapper">
              <span className="field__prefix">@</span>
              <input
                className="field__input"
                type="text"
                placeholder="yubi"
                value={handle.replace('@', '')}
                onChange={(e) => setHandle(e.target.value)}
                required
              />
            </div>
          </label>

          {!isLogin && (
            <label className="field">
              <span className="field__label">表示名</span>
              <input
                className="field__input"
                type="text"
                placeholder="ゆびきり"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">パスワード</span>
            <input
              className="field__input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="auth-card__error">{error}</div>}

          <button type="submit" className="button button--primary auth-card__submit">
            {isLogin ? 'ログインする' : 'アカウントを作成する'}
          </button>
        </form>


      </div>
    </div>
  )
}

function CallScreen({
  room,
  members,
  meId,
  callStatus,
  onHangUp,
}: {
  room: Room
  members: Profile[]
  meId: string
  callStatus: 'dialing' | 'connected'
  onHangUp: (durationSeconds: number) => void
}) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (callStatus !== 'connected') {
      setDuration(0)
      return
    }
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [callStatus])

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="call-screen">
      <div className="call-screen__bg"></div>
      <div className="call-screen__content">
        <div className="call-screen__pulse-wrapper">
          <div className="call-screen__pulse"></div>
          <div className="call-screen__avatar" style={{ transform: 'scale(1.5)' }}>
            <RoomAvatar room={room} members={members} meId={meId} />
          </div>
        </div>
        <h2 className="call-screen__name">{room.title}</h2>
        <div className="call-screen__status">{callStatus === 'dialing' ? '発信中...' : formatDuration(duration)}</div>
      </div>
      
      <div className="call-screen__actions">
        <button
          type="button"
          className="call-screen__hangup"
          onClick={() => onHangUp(duration)}
          title="通話終了"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function SearchFriendModal({
  accounts,
  myFriends,
  myProfile,
  onClose,
  onAddFriend,
}: {
  accounts: Account[]
  myFriends: Profile[]
  myProfile: Profile
  onClose: () => void
  onAddFriend: (friend: Profile) => void
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Profile | null>(null)
  const [status, setStatus] = useState<'idle' | 'not_found' | 'is_me' | 'already_friend' | 'found'>('idle')

  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanQuery = query.trim()
    const formattedQuery = cleanQuery.startsWith('@') ? cleanQuery : `@${cleanQuery}`

    if (!cleanQuery) return

    if (formattedQuery.toLowerCase() === myProfile.handle.toLowerCase()) {
      setStatus('is_me')
      setResult(myProfile)
      return
    }

    setIsSearching(true)
    try {
      const foundProfile = await api.searchAccount(formattedQuery)

      if (!foundProfile) {
        setStatus('not_found')
        setResult(null)
        return
      }

      const isFriend = myFriends.some((f) => f.id === foundProfile.id)
      if (isFriend) {
        setStatus('already_friend')
      } else {
        setStatus('found')
      }
      setResult(foundProfile)
    } catch (err) {
      console.error(err)
      setStatus('not_found')
      setResult(null)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="modal" style={{ zIndex: 110 }}>
      <button type="button" className="modal__backdrop" aria-label="close" onClick={onClose} />
      <section className="modal__dialog" style={{ maxWidth: '440px' }}>
        <div className="modal__header">
          <strong>友だちをID検索</strong>
          <button type="button" className="icon-button" onClick={onClose}>
            <BackIcon className="icon" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="search-friend-form">
          <label className="search-bar search-bar--modal" style={{ flex: 1, margin: 0 }}>
            <SearchIcon className="icon icon--small search-bar__icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-bar__input"
              placeholder="ユーザーIDで検索 (例: mika)"
              autoFocus
            />
          </label>
          <button type="submit" className="button button--primary search-friend-btn">
            検索
          </button>
        </form>

        <div className="search-result-area">
          {status === 'not_found' && (
            <p className="search-result-message">ユーザーが見つかりませんでした。</p>
          )}

          {status === 'is_me' && result && (
            <div className="search-result-card">
              <Avatar profile={result} size={64} />
              <strong>{result.name} (あなた)</strong>
              <p>{result.handle}</p>
              <p className="search-result-hint">自分自身を追加することはできません。</p>
            </div>
          )}

          {status === 'already_friend' && result && (
            <div className="search-result-card">
              <Avatar profile={result} size={64} />
              <strong>{result.name}</strong>
              <p>{result.handle}</p>
              <p className="search-result-hint" style={{ color: 'var(--accent) !important' }}>既に追加されています。</p>
            </div>
          )}

          {status === 'found' && result && (
            <div className="search-result-card">
              <Avatar profile={result} size={64} />
              <strong>{result.name}</strong>
              <p>{result.handle}</p>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  onAddFriend(result)
                  onClose()
                }}
              >
                友だちに追加
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}


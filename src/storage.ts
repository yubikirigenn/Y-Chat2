import type { AppData, Account, Friendship } from './types'

const STORAGE_KEY = 'y-chat2.state.v2'
const ACCOUNTS_STORAGE_KEY = 'y-chat2.accounts.v2'
const FRIENDSHIPS_STORAGE_KEY = 'y-chat2.friendships.v2'

const emptyState: AppData = {
  version: '1.0.0',
  darkMode: true,
  me: null,
  friends: [],
  rooms: [],
  messages: [],
  selectedRoomId: '',
  selectedTab: 'chats',
  drafts: {},
}

export function loadAccounts(): Account[] {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    return JSON.parse(raw) as Account[]
  } catch {
    return []
  }
}

export function saveAccounts(accounts: Account[]) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
}

export function loadFriendships(): Friendship[] {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(FRIENDSHIPS_STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    return JSON.parse(raw) as Friendship[]
  } catch {
    return []
  }
}

export function saveFriendships(friendships: Friendship[]) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(FRIENDSHIPS_STORAGE_KEY, JSON.stringify(friendships))
}


export function loadState(): AppData {
  if (typeof window === 'undefined') {
    return emptyState
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return emptyState
  }

  try {
    const parsed = JSON.parse(raw) as AppData
    // 強制的にログアウト状態にするため、あるいは古いデータ形式をリセットするために
    // me がProfileオブジェクトとして保存されていたら初期化する
    if (parsed.me && typeof parsed.me === 'object' && 'id' in parsed.me && parsed.me.id === 'me') {
      window.localStorage.removeItem(STORAGE_KEY)
      return emptyState
    }

    return {
      ...emptyState,
      ...parsed,
      me: parsed.me ?? null,
      drafts: parsed.drafts ?? {},
    }
  } catch {
    return emptyState
  }
}

export function saveState(state: AppData) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY)
  window.localStorage.removeItem(FRIENDSHIPS_STORAGE_KEY)
}


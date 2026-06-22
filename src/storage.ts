import type { AppData, Account, Friendship } from './types'

const STORAGE_KEY = 'y-chat2.state.v2'
const ACCOUNTS_STORAGE_KEY = 'y-chat2.accounts.v2'
const FRIENDSHIPS_STORAGE_KEY = 'y-chat2.friendships.v2'

/** localStorage に保存するメッセージの上限数 */
const MAX_MESSAGES_IN_STORAGE = 500

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

/**
 * localStorage に安全に書き込む。
 * QuotaExceededError を catch し、失敗時は古いデータを削除してリトライする。
 */
function safeSave(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn(`[storage] QuotaExceededError for key "${key}" (size: ${(value.length / 1024).toFixed(1)}KB). Attempting cleanup...`)
      // 一番大きいキーを削除してリトライ
      try {
        cleanupStorage()
        window.localStorage.setItem(key, value)
        console.info(`[storage] Retry succeeded after cleanup for key "${key}"`)
        return true
      } catch (retryError) {
        console.error(`[storage] Retry also failed for key "${key}". Data will not be persisted locally.`, retryError)
        return false
      }
    }
    console.error(`[storage] Unexpected error writing key "${key}":`, e)
    return false
  }
}

/**
 * ストレージの空き容量を確保するためのクリーンアップ処理。
 * 1. state データのメッセージ数を削減する
 * 2. それでも足りなければ、他のキーのうち最も大きいものを削除する
 */
function cleanupStorage() {
  // まず state のメッセージを削減
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed.messages && parsed.messages.length > 100) {
        // 最新100件のみ残す
        parsed.messages = parsed.messages.slice(-100)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        console.info(`[storage] Trimmed messages in state to 100 entries`)
        return
      }
    }
  } catch {
    // state のクリーンアップが失敗したら、state 自体を削除
    window.localStorage.removeItem(STORAGE_KEY)
    console.warn(`[storage] Removed state key to free space`)
  }
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
  // アカウントデータからavatarUrlを除外して保存サイズを削減
  // (avatarUrlはSupabaseから毎回取得される)
  const slim = accounts.map(acc => ({
    ...acc,
    profile: {
      ...acc.profile,
      avatarUrl: isDataUrl(acc.profile.avatarUrl) ? undefined : acc.profile.avatarUrl,
    }
  }))
  safeSave(ACCOUNTS_STORAGE_KEY, JSON.stringify(slim))
}

/** data: で始まる巨大な Base64 URL かどうか判定 */
function isDataUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith('data:')
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
  safeSave(FRIENDSHIPS_STORAGE_KEY, JSON.stringify(friendships))
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

  // メッセージ数を制限して保存
  const trimmed: AppData = {
    ...state,
    messages: state.messages.length > MAX_MESSAGES_IN_STORAGE
      ? state.messages.slice(-MAX_MESSAGES_IN_STORAGE)
      : state.messages,
  }

  safeSave(STORAGE_KEY, JSON.stringify(trimmed))
}

export function resetState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  window.localStorage.removeItem(ACCOUNTS_STORAGE_KEY)
  window.localStorage.removeItem(FRIENDSHIPS_STORAGE_KEY)
}

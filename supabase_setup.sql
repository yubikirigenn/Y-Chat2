-- ==========================================
-- Y-Chat Supabase データベース構築スクリプト
-- このスクリプト全体をコピーして、Supabaseの「SQL Editor」で実行してください
-- ==========================================

-- 1. アカウントテーブル (Profiles)
-- カスタム認証（ユーザーIDとパスワード）を実現するため、標準のauth.usersではなく独自テーブルを使用します。
CREATE TABLE public.accounts (
  id TEXT PRIMARY KEY,               -- ユーザーID (例: @yubikiri)
  password TEXT NOT NULL,            -- パスワード（平文で保存しますが、実際の運用ではハッシュ化推奨）
  name TEXT NOT NULL,                -- 表示名
  status TEXT,                       -- ステータスメッセージ
  avatar_url TEXT,                   -- アバター画像のURL
  avatar_seed TEXT NOT NULL,         -- アバターの背景色生成用シード
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 友達関係テーブル (Friendships)
CREATE TABLE public.friendships (
  user_id TEXT REFERENCES public.accounts(id) ON DELETE CASCADE,
  friend_id TEXT REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

-- 3. ルームテーブル (Rooms)
CREATE TABLE public.rooms (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('direct', 'group')),
  title TEXT,                        -- グループの場合のタイトル
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ルームメンバーシップテーブル (Room Members)
CREATE TABLE public.room_members (
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.accounts(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,    -- ユーザーごとの未読数
  is_muted BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  PRIMARY KEY (room_id, user_id)
);

-- 5. メッセージテーブル (Messages)
CREATE TABLE public.messages (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id TEXT,                    -- システムメッセージの場合は空（またはNULL）
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'system')),
  text TEXT NOT NULL,
  image_url TEXT,
  read_by TEXT[] DEFAULT '{}',       -- 既読したユーザーのID配列
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==========================================
-- セキュリティ（RLS: Row Level Security）とリアルタイム設定
-- ==========================================

-- すべてのテーブルのRLSを有効化（今回はデモ用のため全アクセスを許可するポリシーを作成します）
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.accounts FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.friendships FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.rooms FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.room_members FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.messages FOR ALL USING (true);

-- リアルタイム通信 (Supabase Realtime) をメッセージとルーム向けに有効化
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;

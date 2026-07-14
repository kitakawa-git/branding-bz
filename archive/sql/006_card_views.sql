-- ============================================
-- 006: スマート名刺アクセス解析テーブル
-- ============================================
-- Supabase SQL Editor で実行してください

-- card_views テーブル作成
CREATE TABLE IF NOT EXISTS card_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  country TEXT,
  city TEXT
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_card_views_profile_id ON card_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_card_views_viewed_at ON card_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_card_views_ip_profile ON card_views(ip_address, profile_id);

-- RLS無効化（プロジェクト方針に合わせる）
ALTER TABLE card_views DISABLE ROW LEVEL SECURITY;

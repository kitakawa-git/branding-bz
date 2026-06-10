-- ビデオラーニング機能: 動画マスター + 視聴セッション
-- 既存テーブルと同方針: RLS 有効・全アクセスは service_role(API Route)経由、anon/authenticated 直アクセスは想定しない（ポリシー無し=拒否）
-- ※本番には MCP apply_migration で適用済み（version 20260603103841）。本ファイルは記録・fresh setup 用。

CREATE TABLE IF NOT EXISTS learning_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  youtube_video_id text NOT NULL,
  youtube_url text,
  thumbnail_url text,
  category text,
  duration_seconds int,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_videos_company ON learning_videos(company_id, sort_order);

CREATE TABLE IF NOT EXISTS learning_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES learning_videos(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  watched_seconds int NOT NULL DEFAULT 0,
  progress_percent int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_progress_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lvv_video ON learning_video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_lvv_profile_video ON learning_video_views(profile_id, video_id);
CREATE INDEX IF NOT EXISTS idx_lvv_company ON learning_video_views(company_id, created_at);

ALTER TABLE learning_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_video_views ENABLE ROW LEVEL SECURITY;
-- ポリシーは付与しない（service_role のみ読み書き可）

-- ビデオラーニング 階層化: カテゴリー（大分類）> テーマ（学習レベル）> 動画
-- RLS は既存 learning_* と同方針（service_role経由のみ・ポリシー無し）
-- ※本番には MCP apply_migration で適用済み（version 20260608065058）。本ファイルは記録・fresh setup 用。

CREATE TABLE IF NOT EXISTS learning_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_categories_company ON learning_categories(company_id, sort_order);

CREATE TABLE IF NOT EXISTS learning_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES learning_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_themes_category ON learning_themes(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_themes_company ON learning_themes(company_id);

-- 動画にテーマ参照を追加（テーマ削除時は theme_id=NULL＝未分類に戻る。動画は消さない）
ALTER TABLE learning_videos
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES learning_themes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_learning_videos_theme ON learning_videos(theme_id);

ALTER TABLE learning_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_themes ENABLE ROW LEVEL SECURITY;
-- ポリシーは付与しない（service_role のみ）

NOTIFY pgrst, 'reload schema';

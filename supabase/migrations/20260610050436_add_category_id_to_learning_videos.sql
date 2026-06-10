-- 動画にカテゴリー直接参照を追加（テーマ未選択でもカテゴリー単独で割り当て可能に）
-- テーマ所属動画は theme のカテゴリーが優先（整合のため補完）。カテゴリー削除時は NULL（未分類に戻る）
-- ※本番には MCP apply_migration で適用済み（version 20260610050436）。

ALTER TABLE learning_videos
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES learning_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_learning_videos_category ON learning_videos(category_id);

-- 既存: テーマ所属動画は、そのテーマのカテゴリーで category_id を補完
UPDATE learning_videos v
SET category_id = t.category_id
FROM learning_themes t
WHERE v.theme_id = t.id AND v.category_id IS DISTINCT FROM t.category_id;

NOTIFY pgrst, 'reload schema';

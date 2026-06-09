-- Step 6 Part B: brand_guidelines の理念4フィールド(mission/vision/values/action_guidelines)を DROP。
-- 表示・編集・AI はすべて philosophy_elements へ移行済み（Step 3/4・本番デプロイ済み）。dual-run 解消。
-- 事前バックアップ: 退避テーブルへ全社分を保存（万一の復元用。RLS有効・ポリシー無し=service_role限定）。

CREATE TABLE IF NOT EXISTS public.archive_brand_guidelines_philosophy_20260609 AS
SELECT company_id, mission, vision, "values", action_guidelines, now() AS archived_at
FROM public.brand_guidelines;

ALTER TABLE public.archive_brand_guidelines_philosophy_20260609 ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.archive_brand_guidelines_philosophy_20260609 IS
  'Step6 DROP前バックアップ: brand_guidelines.{mission,vision,values,action_guidelines} 全社分。philosophy_elements が正となったため退避。不要確認後に削除可。';

ALTER TABLE public.brand_guidelines
  DROP COLUMN IF EXISTS mission,
  DROP COLUMN IF EXISTS vision,
  DROP COLUMN IF EXISTS "values",
  DROP COLUMN IF EXISTS action_guidelines;

NOTIFY pgrst, 'reload schema';

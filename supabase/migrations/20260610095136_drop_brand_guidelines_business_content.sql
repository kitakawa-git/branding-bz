-- business_content の ID化 ステージ6: brand_guidelines.business_content を DROP。
-- 表示・編集・AI・整合性チェックは philosophy_elements の service 行へ移行済み（Stage 3/4・本番デプロイ済み）。dual-run 解消。
-- 事前バックアップ: 退避テーブルへ全社分を保存（万一の復元用。RLS有効・ポリシー無し=service_role限定）。
-- ※ business_content_sort（表示順設定）は残す。

CREATE TABLE IF NOT EXISTS public.archive_brand_guidelines_business_content_20260610 AS
SELECT company_id, business_content, now() AS archived_at
FROM public.brand_guidelines;

ALTER TABLE public.archive_brand_guidelines_business_content_20260610 ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.archive_brand_guidelines_business_content_20260610 IS
  'Stage6 DROP前バックアップ: brand_guidelines.business_content 全社分。philosophy_elements service 行が正となったため退避。不要確認後に削除可。';

ALTER TABLE public.brand_guidelines DROP COLUMN business_content;

NOTIFY pgrst, 'reload schema';

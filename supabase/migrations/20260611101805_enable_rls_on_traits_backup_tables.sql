-- traits 正規化/DROP のバックアップテーブル2つを PostgREST から遮断
-- get_advisors が ERROR (rls_disabled_in_public) を報告したため、
-- 既存 archive テーブル（archive_brand_guidelines_*）と同じ
-- 「RLS有効・ポリシーなし」パターンで API アクセスを遮断する。
-- SQL Editor / service role からの復旧用読み取りは引き続き可能。
ALTER TABLE public._backup_brand_guidelines_traits_20260611 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._backup_brand_personalities_traits_20260611 ENABLE ROW LEVEL SECURITY;

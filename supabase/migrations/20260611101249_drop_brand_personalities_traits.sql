-- brand_personalities.traits（レガシー）の廃止
-- 背景: traits の正は brand_guidelines.traits に一本化済み。
--   コード参照ゼロ（読みは tone_of_voice のみ、書き込みも traits を含まない）、
--   DB側参照ゼロ（view/function/policy/trigger/generated column 横断確認済み）。
--   実データは 3社が空配列・2社が brand_guidelines.traits の古い劣化コピーのみ。
-- select('*') の2箇所（admin/brand/verbal・lib/ci-manual/data-fetcher）は
--   返却カラムが減るだけで .traits を読まないため影響なし。

-- 1. 事前バックアップ（全社の company_id, traits を退避）
CREATE TABLE IF NOT EXISTS public._backup_brand_personalities_traits_20260611 AS
SELECT company_id, traits, now() AS backed_up_at
FROM public.brand_personalities;

-- 2. カラム削除
ALTER TABLE public.brand_personalities DROP COLUMN traits;

-- 3. PostgREST スキーマキャッシュ再読み込み
NOTIFY pgrst, 'reload schema';

-- traits score の 1〜5 スケール統一
-- 背景: デモシード（seed-demo-data-update.sql / seed-demo-data-expand.sql）が
--   テックブリッジ(128a1513)・ナチュラルキッチン(66b3f69c) に 100点系 score を投入していた。
--   表示側（ポータルレーダー domain[0,5]・管理画面 Input max5・CIマニュアル /5 表示）は全箇所5点固定。
-- 変換: score > 5 のエントリのみ GREATEST(1, round(score / 20))::int（90→5, 85→4, 80→4, 75→4）

-- 1. 事前バックアップ（全社の company_id, traits を退避）
CREATE TABLE IF NOT EXISTS public._backup_brand_guidelines_traits_20260611 AS
SELECT company_id, traits, now() AS backed_up_at
FROM public.brand_guidelines;

-- 2. score > 5 のエントリを 1〜5 に正規化（配列順序は WITH ORDINALITY で保持）
UPDATE public.brand_guidelines bg
SET traits = (
  SELECT jsonb_agg(
    CASE
      WHEN (t ? 'score')
        AND jsonb_typeof(t -> 'score') = 'number'
        AND (t ->> 'score')::numeric > 5
      THEN jsonb_set(
        t,
        '{score}',
        to_jsonb(GREATEST(1, round((t ->> 'score')::numeric / 20))::int)
      )
      ELSE t
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(bg.traits) WITH ORDINALITY AS e(t, ord)
)
WHERE bg.traits IS NOT NULL
  AND jsonb_typeof(bg.traits) = 'array'
  AND jsonb_array_length(bg.traits) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(bg.traits) t
    WHERE (t ? 'score')
      AND jsonb_typeof(t -> 'score') = 'number'
      AND (t ->> 'score')::numeric > 5
  );

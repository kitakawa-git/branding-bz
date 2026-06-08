-- 順序5 Step2: MEGUTAMA の companies.slogan を brand_guidelines.slogan へ移植（bgが空のため・消失防止）。
-- 非破壊: bg.slogan が空の MEGUTAMA のみ対象。他社・bg値ありは一切変更しない。
-- companies.slogan/mvv の DROP（順序5）に先立つデータ退避。
-- ※ MCP apply_migration（remote）で version 20260608152248 として適用済み。
UPDATE public.brand_guidelines bg
SET slogan = c.slogan, updated_at = now()
FROM public.companies c
WHERE bg.company_id = c.id
  AND c.id = '8f797cf0-1579-484b-8406-2ad59158b7d5'
  AND (bg.slogan IS NULL OR btrim(bg.slogan) = '')
  AND c.slogan IS NOT NULL AND btrim(c.slogan) <> '';

NOTIFY pgrst, 'reload schema';

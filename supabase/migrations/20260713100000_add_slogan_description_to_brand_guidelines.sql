-- スローガンに説明文を持たせる。ポータル「考え方」でスローガンの下に表示する。
-- 既存行に影響しない nullable text カラム。
ALTER TABLE public.brand_guidelines
  ADD COLUMN IF NOT EXISTS slogan_description text;

COMMENT ON COLUMN public.brand_guidelines.slogan_description IS 'スローガンの補足説明文（ポータル「考え方」でスローガン直下に表示）';

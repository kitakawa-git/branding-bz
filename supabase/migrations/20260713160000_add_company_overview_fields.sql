-- 会社概要ページ用の基本情報。管理画面「基本情報」で入力し、ポータル「会社について」で表示。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS founded text,          -- 設立（年月。例: 2011年4月）
  ADD COLUMN IF NOT EXISTS address text,          -- 所在地（本社住所）
  ADD COLUMN IF NOT EXISTS representative text;    -- 代表者

COMMENT ON COLUMN public.companies.founded IS '設立（年月）。ポータル「会社について」で表示';
COMMENT ON COLUMN public.companies.address IS '本社所在地。ポータル「会社について」で表示';
COMMENT ON COLUMN public.companies.representative IS '代表者名。ポータル「会社について」で表示';

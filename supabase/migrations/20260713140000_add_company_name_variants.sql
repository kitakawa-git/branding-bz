-- 企業名の表記バリエーション。管理画面「会社情報」で入力する。
-- name（企業名またはブランド名／表示名）はそのまま。以下は任意の補足表記。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS name_ja text,       -- 日本語表記
  ADD COLUMN IF NOT EXISTS name_en text,       -- 英語表記
  ADD COLUMN IF NOT EXISTS name_reading text;  -- 読み方（ふりがな）

COMMENT ON COLUMN public.companies.name_ja IS '企業名の日本語表記（会社情報で入力）';
COMMENT ON COLUMN public.companies.name_en IS '企業名の英語表記（会社情報で入力）';
COMMENT ON COLUMN public.companies.name_reading IS '企業名の読み方・ふりがな（会社情報で入力）';

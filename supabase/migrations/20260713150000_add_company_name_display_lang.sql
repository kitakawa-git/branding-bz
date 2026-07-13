-- 企業名の表示に日本語表記/英語表記どちらを使うかのトグル。
-- name は保存時にこの設定で選んだ表記へ自動同期する（スマート名刺・サイドバー等は name を読む）。
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS name_display_lang text NOT NULL DEFAULT 'ja';

COMMENT ON COLUMN public.companies.name_display_lang IS '企業名の表示に使う表記: ja=日本語表記 / en=英語表記。保存時に name へ同期';

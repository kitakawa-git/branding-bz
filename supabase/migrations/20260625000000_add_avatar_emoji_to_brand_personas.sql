-- ペルソナの顔アイコン（絵文字）を保存する離散カラム。
-- Persona Builder の確認画面で選択 → connect で書き込み、管理画面（ブランド戦略）で編集、ポータルで表示。
ALTER TABLE public.brand_personas ADD COLUMN IF NOT EXISTS avatar_emoji text;
COMMENT ON COLUMN public.brand_personas.avatar_emoji IS 'ペルソナの顔アイコン（絵文字）。Persona Builder→connect で書き込み、管理画面で編集、ポータルで表示。';

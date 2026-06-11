-- パーソナリティ診断のアーキタイプ（主・副人格）の本体格納先を追加
-- 背景: 診断出力のうちアーキタイプだけ本体に格納先がなく、連携してもポータルに表示できなかった。
-- 格納形式: {"primary": {"key","label","copy","description"}, "secondary": {同}}
--   label/copy は archetypes.ts 定義表（コピー定義v1）のスナップショット、description は AI企業固有文。
ALTER TABLE public.brand_personalities
  ADD COLUMN IF NOT EXISTS archetype jsonb;

COMMENT ON COLUMN public.brand_personalities.archetype IS
  'パーソナリティ診断のアーキタイプ。{primary:{key,label,copy,description}, secondary:{...}}。label/copyは定義表スナップショット、descriptionはAI企業固有文。NULL=未診断（後方互換）。';

NOTIFY pgrst, 'reload schema';

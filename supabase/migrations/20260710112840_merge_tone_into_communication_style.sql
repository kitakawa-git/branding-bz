-- tone_of_voice を communication_style へマージし、tone_of_voice カラムをDROP
-- 背景: バーバル画面で「トーンオブボイス」「コミュニケーションスタイル」の2見出しが分かれていたが、
--   意味論的に「どう伝えるか」で1テーマ。管理画面バーバルは元々 tone_of_voice のみ編集UIを持ち、
--   計測系(brand-score/generate-questions等)は tone_of_voice のみ読む。運用は実質1本化していた。
--   統一のため communication_style を残す方向でカラム統合する。
-- マージ規則:
--   両方あり → tone_of_voice ⏎⏎ communication_style（空行区切り。splitCommunicationStyle と互換）
--   toneのみ → tone_of_voice を communication_style に流入
--   commのみ → そのまま
--   両方NULL → そのまま
-- オントロジー影響: lib/brand/* (guardrails/relations/integrity/profiling) から参照ゼロで無影響

-- 1. 事前バックアップ（全社の tone_of_voice と communication_style を退避）
CREATE TABLE IF NOT EXISTS public._backup_brand_personalities_tone_20260710 AS
SELECT company_id, tone_of_voice, communication_style, now() AS backed_up_at
FROM public.brand_personalities;

-- バックアップテーブルは PostgREST 経由で公開しない（既存バックアップ手順と同パターン）
ALTER TABLE public._backup_brand_personalities_tone_20260710 ENABLE ROW LEVEL SECURITY;

-- 2. マージ: tone_of_voice の内容を communication_style に流入
UPDATE public.brand_personalities SET communication_style = CASE
  WHEN tone_of_voice IS NOT NULL AND length(trim(tone_of_voice)) > 0
       AND communication_style IS NOT NULL AND length(trim(communication_style)) > 0
    THEN trim(tone_of_voice) || E'\n\n' || trim(communication_style)
  WHEN tone_of_voice IS NOT NULL AND length(trim(tone_of_voice)) > 0
    THEN trim(tone_of_voice)
  ELSE communication_style
END
WHERE tone_of_voice IS NOT NULL;

-- 3. tone_of_voice カラムを削除
ALTER TABLE public.brand_personalities DROP COLUMN tone_of_voice;

-- 4. PostgREST スキーマキャッシュ再読み込み
NOTIFY pgrst, 'reload schema';

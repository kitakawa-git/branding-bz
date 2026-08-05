-- サーベイ詳細画面の各カードに添えるAI考察を保存する。
-- 表示のたびに生成すると費用と待ち時間がかかるため、生成結果をサーベイに持たせ、
-- 明示的な再生成まで使い回す。
--
-- insights の形:
--   { "overview": "…", "distribution": "…", "stages": "…", "funnel": "…" }
ALTER TABLE brand_surveys
  ADD COLUMN IF NOT EXISTS insights jsonb,
  ADD COLUMN IF NOT EXISTS insights_generated_at timestamptz;

COMMENT ON COLUMN brand_surveys.insights IS 'カード別のAI考察。キーは overview / distribution / stages / funnel';
COMMENT ON COLUMN brand_surveys.insights_generated_at IS 'AI考察を生成した時刻。集計が変わった際の鮮度判断に使う';

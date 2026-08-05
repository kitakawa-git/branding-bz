-- 市場調査の詳細画面の各カードに添えるAI考察を保存する。
-- brand_surveys.insights と同じ作り。表示のたびに生成すると費用と待ち時間が
-- かかるため、生成結果を調査に持たせ、明示的な再生成まで使い回す。
--
-- insights の形（データがある区画のキーだけが入る）:
--   { "stages": "…", "impression": "…", "personality": "…",
--     "contact": "…", "services": "…", "evaluation": "…" }

alter table market_surveys
  add column if not exists insights jsonb,
  add column if not exists insights_generated_at timestamptz;

comment on column market_surveys.insights is
  'カード別のAI考察。キーは stages / impression / personality / contact / services / evaluation';
comment on column market_surveys.insights_generated_at is
  'AI考察を生成した時刻。割り当てを変えた際の鮮度判断に使う';

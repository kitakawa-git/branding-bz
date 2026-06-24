-- ペルソナの Tier1 決定事実を離散カラム化（意思決定要因・購買障壁・ブランドへの期待）
-- 背景: Persona Builder の suggest-goals は decision_factors[] / buying_barriers[] / brand_expectations を
--       既に生成しているが、連携時は persona_data.goals に埋もれるだけで管理画面から編集できなかった。
--       pain_points / needs と同じ離散方針で露出する。persona_data は温存（二重持ち・正本は離散カラム側）。
alter table public.brand_personas
  add column if not exists decision_factors jsonb not null default '[]'::jsonb,
  add column if not exists buying_barriers  jsonb not null default '[]'::jsonb,
  add column if not exists brand_expectations text;

comment on column public.brand_personas.decision_factors is '意思決定要因（配列）。Persona Builder goals.decision_factors の離散カラム。';
comment on column public.brand_personas.buying_barriers  is '購買障壁（配列）。Persona Builder goals.buying_barriers の離散カラム。';
comment on column public.brand_personas.brand_expectations is 'ブランドへの期待（文）。Persona Builder goals.brand_expectations の離散カラム。';

-- PostgREST スキーマキャッシュ再読込
notify pgrst, 'reload schema';

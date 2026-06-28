-- STP分析で生成される「自社の強み」「競合分析」を companies に保存できるよう拡張
alter table public.companies
  add column if not exists strengths text,
  add column if not exists competitors_analysis jsonb not null default '[]'::jsonb;

comment on column public.companies.strengths is
  'STP分析で言語化した自社の強み（テキスト）。Step 3 targeting.strengths の連携先。';
comment on column public.companies.competitors_analysis is
  'STP分析で整理した各競合の特徴（[{name, traits}]）。Step 3 targeting.competitors_analysis の連携先。';

-- PostgREST スキーマキャッシュ再読込
notify pgrst, 'reload schema';

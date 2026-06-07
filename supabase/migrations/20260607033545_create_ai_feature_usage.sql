-- AI機能の利用ログテーブル（web_search等のコスト管理用・汎用ログ）
-- feature_key で機能を識別。将来 理念ジェネレーター/コピーAI 等が web_search を使う際も流用する。
create table if not exists public.ai_feature_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  feature_key text not null,
  used_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 月次利用回数カウント用の複合インデックス
create index if not exists idx_ai_feature_usage_company_feature_used
  on public.ai_feature_usage (company_id, feature_key, used_at);

-- RLS有効化のみ・ポリシー無し（＝deny-all、service_roleのみアクセス可）。learning_videos 等と同方針。
alter table public.ai_feature_usage enable row level security;

comment on table public.ai_feature_usage is 'AI機能の利用ログ（web_search等のコスト管理用）。feature_key で機能を識別。RLSはポリシー無し＝service_roleのみ。';
comment on column public.ai_feature_usage.feature_key is '機能識別子。例: competitor_suggest';
comment on column public.ai_feature_usage.metadata is '提案件数等の任意メタデータ。例: {"count": 4}';

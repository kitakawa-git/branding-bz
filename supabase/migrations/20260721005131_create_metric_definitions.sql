-- 指標辞書（metric_definitions）: 会社ごとに「指標の正式名・内部キー・単位」を一元管理する。
-- 目標フォーム（desired_evidence.achievement_rule）と測定値（proof_point_measurements）が
-- 同じ metric_key / 単位 を確実に共有できるようにするための辞書。
-- 非エンジニアは display_name（例「ブランド認知率」）で選び、metric_key は内部で自動生成する。
-- ※本番適用済み（version 20260721005131）。ここは適用済みSQLの記録。
create table if not exists public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_key text not null,
  display_name text not null,
  canonical_unit text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metric_def_key_fmt check (metric_key ~ '^[a-z0-9_]+$'),
  constraint metric_def_company_key_uk unique (company_id, metric_key)
);

create index if not exists idx_metric_def_company on public.metric_definitions (company_id);

alter table public.metric_definitions enable row level security;

-- superadmin は全操作可（is_current_user_superadmin 相当の EXISTS 判定）
create policy metric_def_superadmin_all on public.metric_definitions
  for all
  using (exists (select 1 from public.admin_users a where a.auth_id = (select auth.uid()) and a.is_superadmin = true))
  with check (exists (select 1 from public.admin_users a where a.auth_id = (select auth.uid()) and a.is_superadmin = true));

-- 自社の指標定義は admin_users / members が閲覧可
create policy metric_def_select on public.metric_definitions
  for select
  using (
    company_id in (
      select company_id from public.admin_users where auth_id = (select auth.uid())
      union
      select company_id from public.members where auth_id = (select auth.uid())
    )
  );

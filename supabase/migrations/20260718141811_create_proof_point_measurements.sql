-- 1) 複合FK の参照先を用意（proof_points）
alter table public.proof_points add constraint proof_points_company_id_uk unique (company_id, id);

-- 2) 測定値テーブル
create table public.proof_point_measurements (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  proof_point_id    uuid not null,
  metric_key        text not null,
  metric_label      text not null default '',
  metric_value      numeric not null,
  metric_unit       text not null,
  measured_at       date,
  measurement_scope text not null default '',
  source_reference  text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint ppm_company_pp_fk foreign key (company_id, proof_point_id)
    references public.proof_points(company_id, id) on delete cascade,           -- §14.3 同一company担保
  constraint ppm_metric_key_fmt check (metric_key ~ '^[a-z0-9_]+$'),            -- §2-7 正規化
  constraint ppm_value_finite   check (metric_value = metric_value)             -- NaN 排除（NaN<>NaN）
);
create index idx_ppm_company on public.proof_point_measurements(company_id);
create index idx_ppm_proof_point on public.proof_point_measurements(proof_point_id);
create index idx_ppm_company_key on public.proof_point_measurements(company_id, metric_key);

-- 3) RLS（proof_points 踏襲）
alter table public.proof_point_measurements enable row level security;
create policy ppm_select on public.proof_point_measurements for select
  using (company_id in (
    select company_id from public.admin_users where auth_id=(select auth.uid())
    union select company_id from public.members where auth_id=(select auth.uid())));
create policy ppm_superadmin_all on public.proof_point_measurements for all
  using (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true))
  with check (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true));

notify pgrst, 'reload schema';

-- 1) 判定記録（人間判断のみ）
create table public.desired_evidence_evaluations (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  desired_evidence_id    uuid not null,
  evaluation_source      text not null,
  achievement_state      text not null,
  progress_fraction      numeric,
  rule_hash              text not null,
  evidence_version_at_eval timestamptz not null,           -- §14.1 スナップショット
  valid_until            timestamptz,
  evaluated_by           uuid,
  evaluated_at           timestamptz not null default now(),
  reason                 text not null,
  is_current             boolean not null default true,
  superseded_at          timestamptz,
  constraint dee_company_de_fk foreign key (company_id, desired_evidence_id)
    references public.desired_evidence(company_id, id) on delete cascade,        -- §14.3
  constraint dee_source_chk check (evaluation_source in ('manual_review','automatic_override')),
  constraint dee_state_chk  check (achievement_state in ('unmet','partially_met','met')),  -- indeterminate不可 §6-4
  constraint dee_reason_req check (length(btrim(reason)) > 0),
  constraint dee_progress_range check (progress_fraction is null or (progress_fraction >= 0 and progress_fraction <= 1)),
  constraint dee_state_progress_consistent check (                               -- §6-4 手動 state×progress 整合
       (achievement_state='met'           and (progress_fraction is null or progress_fraction = 1))
    or (achievement_state='unmet'         and (progress_fraction is null or progress_fraction = 0))
    or (achievement_state='partially_met' and (progress_fraction is null or (progress_fraction > 0 and progress_fraction < 1)))
  )
);
create index idx_dee_company on public.desired_evidence_evaluations(company_id);
create index idx_dee_de on public.desired_evidence_evaluations(desired_evidence_id);

-- 2) 現行1件の部分ユニーク（§6-2）
create unique index uq_dee_current on public.desired_evidence_evaluations(desired_evidence_id) where is_current = true;

-- 3) RLS（proof_points 踏襲・measurements と同型。SELECTはsuperadminのみに絞る選択も可）
alter table public.desired_evidence_evaluations enable row level security;
create policy dee_select on public.desired_evidence_evaluations for select
  using (company_id in (
    select company_id from public.admin_users where auth_id=(select auth.uid())
    union select company_id from public.members where auth_id=(select auth.uid())));
create policy dee_superadmin_all on public.desired_evidence_evaluations for all
  using (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true))
  with check (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true));

-- 4) rule_hash / evidence_version をDB側で付与（§14.1/§14.2・生成主体をDBに一本化）
create or replace function public.dee_fill_snapshot()
returns trigger language plpgsql security definer set search_path to 'public','extensions' as $$
declare de public.desired_evidence%rowtype;
begin
  select * into de from public.desired_evidence where id = NEW.desired_evidence_id;
  if not found then raise exception 'desired_evidence % not found', NEW.desired_evidence_id; end if;
  NEW.rule_hash := encode(extensions.digest(de.achievement_rule::text, 'sha256'), 'hex');  -- jsonbはキー順正規化済
  NEW.evidence_version_at_eval := de.evidence_updated_at;
  return NEW;
end; $$;
create trigger trg_dee_fill_snapshot before insert on public.desired_evidence_evaluations
  for each row execute function public.dee_fill_snapshot();

-- 5) evidence_updated_at の bump トリガ群（§14.1）
create or replace function public.bump_de_evidence_version(p_de_ids uuid[])
returns void language sql security definer set search_path to 'public' as $$
  update public.desired_evidence set evidence_updated_at = now() where id = any(p_de_ids);
$$;

-- 5a) 測定値の追加/更新/削除 → 該当PPを verifies するDEを bump
create or replace function public.trg_ppm_bump() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare pp uuid; ids uuid[];
begin
  pp := coalesce(NEW.proof_point_id, OLD.proof_point_id);
  select array_agg(er.target_id) into ids from public.element_relations er
    where er.relation_type='verifies' and er.source_kind='proof_point' and er.source_id=pp and er.target_kind='desired_evidence';
  if ids is not null then perform public.bump_de_evidence_version(ids); end if;
  return null;
end; $$;
create trigger trg_ppm_bump_iud after insert or update or delete on public.proof_point_measurements
  for each row execute function public.trg_ppm_bump();

-- 5b) verifies 関係の追加/削除 → 対象DEを bump
create or replace function public.trg_verifies_bump() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare rt text; tk text; tid uuid;
begin
  rt := coalesce(NEW.relation_type, OLD.relation_type);
  tk := coalesce(NEW.target_kind, OLD.target_kind);
  tid:= coalesce(NEW.target_id, OLD.target_id);
  if rt='verifies' and tk='desired_evidence' then perform public.bump_de_evidence_version(array[tid]); end if;
  return null;
end; $$;
create trigger trg_verifies_bump_id after insert or delete on public.element_relations
  for each row execute function public.trg_verifies_bump();

-- 5c) proof_points 更新 → その PP が verifies するDEを bump
create or replace function public.trg_pp_bump() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare ids uuid[];
begin
  select array_agg(er.target_id) into ids from public.element_relations er
    where er.relation_type='verifies' and er.source_kind='proof_point' and er.source_id=NEW.id and er.target_kind='desired_evidence';
  if ids is not null then perform public.bump_de_evidence_version(ids); end if;
  return null;
end; $$;
create trigger trg_pp_bump_upd after update on public.proof_points
  for each row execute function public.trg_pp_bump();

notify pgrst, 'reload schema';

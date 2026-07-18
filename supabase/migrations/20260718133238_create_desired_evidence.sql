-- 1) テーブル
create table public.desired_evidence (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  title               text not null,
  description         text not null default '',
  importance_weight   numeric(4,2) not null default 1.00,
  achievement_rule    jsonb not null default '{}'::jsonb,
  verification_method text not null default '',
  milestone_note      text not null default '',
  execution_state     text not null default 'planned',
  evidence_updated_at timestamptz not null default now(),   -- §14.1（bump対象）
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint desired_evidence_weight_pos check (importance_weight > 0),
  constraint desired_evidence_exec_state check (execution_state in ('planned','in_progress','paused','cancelled')),
  constraint desired_evidence_rule_obj   check (jsonb_typeof(achievement_rule) = 'object'),
  constraint desired_evidence_company_id_uk unique (company_id, id)   -- §14.3 複合FKの参照先
);
create index idx_desired_evidence_company on public.desired_evidence(company_id);
create index idx_desired_evidence_company_sort on public.desired_evidence(company_id, sort_order);

-- 2) RLS（proof_points 踏襲）
alter table public.desired_evidence enable row level security;
create policy desired_evidence_select on public.desired_evidence for select
  using (company_id in (
    select company_id from public.admin_users where auth_id = (select auth.uid())
    union
    select company_id from public.members     where auth_id = (select auth.uid())));
create policy desired_evidence_superadmin_all on public.desired_evidence for all
  using (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true))
  with check (exists (select 1 from public.admin_users where auth_id=(select auth.uid()) and is_superadmin=true));

-- 3) ElementKind に desired_evidence を追加（source/target 両方の CHECK を貼り替え）
alter table public.element_relations drop constraint element_relations_source_kind_check;
alter table public.element_relations add  constraint element_relations_source_kind_check
  check (source_kind = any (array['philosophy_element','value_proposition','proof_point','governance_rule','persona','desired_evidence']));
alter table public.element_relations drop constraint element_relations_target_kind_check;
alter table public.element_relations add  constraint element_relations_target_kind_check
  check (target_kind = any (array['philosophy_element','value_proposition','proof_point','governance_rule','persona','desired_evidence']));

-- 4) 端点検証トリガに desired_evidence 分岐を追加（既存関数を拡張・他kindと同形）
create or replace function public.validate_element_relation_endpoints()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare src_table text; tgt_table text; ok boolean;
begin
  src_table := case NEW.source_kind
    when 'philosophy_element' then 'philosophy_elements'
    when 'value_proposition'  then 'value_propositions'
    when 'proof_point'        then 'proof_points'
    when 'governance_rule'    then 'governance_rules'
    when 'persona'            then 'brand_personas'
    when 'desired_evidence'   then 'desired_evidence'      -- 追加
  end;
  tgt_table := case NEW.target_kind
    when 'philosophy_element' then 'philosophy_elements'
    when 'value_proposition'  then 'value_propositions'
    when 'proof_point'        then 'proof_points'
    when 'governance_rule'    then 'governance_rules'
    when 'persona'            then 'brand_personas'
    when 'desired_evidence'   then 'desired_evidence'      -- 追加
  end;
  execute format('select exists(select 1 from public.%I where id=$1 and company_id=$2)', src_table) into ok using NEW.source_id, NEW.company_id;
  if not ok then raise exception 'element_relations: source (% / %) が company % に存在しません', NEW.source_kind, NEW.source_id, NEW.company_id using errcode='foreign_key_violation'; end if;
  execute format('select exists(select 1 from public.%I where id=$1 and company_id=$2)', tgt_table) into ok using NEW.target_id, NEW.company_id;
  if not ok then raise exception 'element_relations: target (% / %) が company % に存在しません', NEW.target_kind, NEW.target_id, NEW.company_id using errcode='foreign_key_violation'; end if;
  NEW.updated_at := now();
  return NEW;
end; $$;

notify pgrst, 'reload schema';

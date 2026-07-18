alter table public.value_propositions
  add column lifecycle_state text not null default 'current',
  add column promoted_by uuid,
  add column promoted_at timestamptz;
alter table public.value_propositions
  add constraint vp_lifecycle_chk check (lifecycle_state in ('target','transition_candidate','current','retired'));
create index idx_vp_company_lifecycle on public.value_propositions(company_id, lifecycle_state);
notify pgrst, 'reload schema';

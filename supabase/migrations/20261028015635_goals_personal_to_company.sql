-- 個人目標を会社目標に直接つなげられるようにする（チームを作らない会社向け）
-- 親にできるのは 個人→チーム、個人→会社、チーム→会社。KPI の寄与先は「親目標の KPI」なので、
-- 個人目標が会社目標につながっていれば、個人KPI → 会社KPI も寄与できる（goal_kpis_check_relations はそのまま）
create or replace function public.goals_check_relations()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent record;
begin
  if new.parent_goal_id is not null then
    if new.parent_goal_id = new.id then raise exception '目標の親に自分自身は指定できません'; end if;
    select level, company_id into parent from public.goals where id = new.parent_goal_id;
    if parent.company_id is distinct from new.company_id then raise exception '親の目標は同じ会社のものにしてください'; end if;
    if not (
      (new.level = 'personal' and parent.level in ('team', 'company'))
      or (new.level = 'team' and parent.level = 'company')
    ) then
      raise exception '親にできるのは、個人目標→チーム目標・会社目標、チーム目標→会社目標だけです';
    end if;
  end if;
  if new.period_id is not null and not exists (select 1 from public.goal_periods p where p.id = new.period_id and p.company_id = new.company_id) then
    raise exception '期間は同じ会社のものにしてください';
  end if;
  if new.team_id is not null and not exists (select 1 from public.teams t where t.id = new.team_id and t.company_id = new.company_id) then
    raise exception 'チームは同じ会社のものにしてください';
  end if;
  if new.behavior_guideline_id is not null and not exists (
    select 1 from public.philosophy_elements e
    where e.id = new.behavior_guideline_id and e.company_id = new.company_id and e.element_type = 'action_guideline'
  ) then
    raise exception '行動指針は同じ会社の行動指針から選んでください';
  end if;
  return new;
end $$;

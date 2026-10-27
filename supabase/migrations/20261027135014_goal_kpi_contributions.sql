-- KPI の寄与リンク（contributes_to_kpi_id）の整合と、寄与件数の RPC
-- 寄与できるのは「自分の目標の親目標の KPI」だけ（個人KPI→チームKPI、チームKPI→会社KPI）

-- 1. 保存時の検証（寄与先は親目標の KPI に限る）
create or replace function public.goal_kpis_check_relations()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_goal uuid;
begin
  select g.parent_goal_id into parent_goal from public.goals g where g.id = new.goal_id and g.company_id = new.company_id;
  if not found then
    raise exception 'KPI の会社と目標の会社が一致しません';
  end if;
  if new.contributes_to_kpi_id is not null then
    if new.contributes_to_kpi_id = new.id then raise exception 'KPI の寄与先に自分自身は指定できません'; end if;
    if parent_goal is null or not exists (
      select 1 from public.goal_kpis k where k.id = new.contributes_to_kpi_id and k.goal_id = parent_goal
    ) then
      raise exception '寄与先は、つながっている上位の目標の KPI から選んでください';
    end if;
  end if;
  return new;
end $$;

-- 2. 目標のつながり（parent_goal_id）を変えた・外したら、配下の KPI の寄与先のうち
--    新しい親目標の KPI でないものを外す（親目標の削除で parent_goal_id が NULL になったときも動く）
create or replace function public.goals_reset_kpi_contributions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.goal_kpis k
  set contributes_to_kpi_id = null, updated_at = now()
  where k.goal_id = new.id
    and k.contributes_to_kpi_id is not null
    and (new.parent_goal_id is null or not exists (
      select 1 from public.goal_kpis t where t.id = k.contributes_to_kpi_id and t.goal_id = new.parent_goal_id
    ));
  return null;
end $$;

drop trigger if exists goals_reset_kpi_contributions on public.goals;
create trigger goals_reset_kpi_contributions after update of parent_goal_id on public.goals
  for each row when (old.parent_goal_id is distinct from new.parent_goal_id)
  execute function public.goals_reset_kpi_contributions();

-- 3. 寄与件数（件数だけ返す。中身は返さない）
--    個人KPIは RLS で本人・リーダー・管理者しか見えないため、画面で数えると閲覧者で件数が変わる。
--    呼び出し者がその会社のメンバー（または管理者）でなければ何も返さない
create or replace function public.goal_kpi_contribution_counts(target_company_id uuid)
returns table (kpi_id uuid, contribution_count integer)
language sql stable security definer set search_path = public as $$
  select c.contributes_to_kpi_id, count(*)::integer
  from public.goal_kpis c
  where c.company_id = target_company_id
    and c.contributes_to_kpi_id is not null
    and (public.goal_is_company_member(target_company_id) or public.goal_is_company_admin(target_company_id))
  group by c.contributes_to_kpi_id
$$;

revoke all on function public.goal_kpi_contribution_counts(uuid) from public, anon;
grant execute on function public.goal_kpi_contribution_counts(uuid) to authenticated;
revoke all on function public.goals_reset_kpi_contributions() from public, anon, authenticated;

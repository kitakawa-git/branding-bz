-- 目標・KPI を「会社 → チーム → 個人」の3層にする（1/2）
-- personal_goals の退避（RENAME）はコードを goals に切り替えて本番反映した後の 2/2 で行う
-- （先に RENAME すると、デプロイ完了までの間、本番の目標画面がエラーになるため）

-- ============================================================
-- 0. 権限判定の関数（RLS から使う。SECURITY DEFINER で RLS の再帰と重い副問い合わせを避ける）
-- ============================================================
create or replace function public.goal_is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.auth_id = auth.uid() and m.company_id = target_company_id)
$$;

create or replace function public.goal_is_company_admin(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users a where a.auth_id = auth.uid() and a.company_id = target_company_id)
$$;

-- ============================================================
-- 1. goal_periods: 上位期間・「今の期間」は種類ごとに1つ・承認待ちの重複防止
-- ============================================================
alter table public.goal_periods
  add column if not exists parent_period_id uuid references public.goal_periods(id) on delete set null;

create index if not exists goal_periods_parent_period_id_idx on public.goal_periods(parent_period_id);

-- 会社の「年度」と、チーム・個人の「半期」が同時に「今の期間」になるため、会社ごとではなく種類ごとに1つ
create unique index if not exists goal_periods_one_current_per_type
  on public.goal_periods(company_id, type) where is_current;
-- 自動作成が二重に走って承認待ちが重複したことがある（ID INC. 2026-02-28・11ms差）
create unique index if not exists goal_periods_one_pending_per_type
  on public.goal_periods(company_id, type) where status = 'pending_approval';

create or replace function public.goal_periods_check_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_period_id is null then return new; end if;
  if new.parent_period_id = new.id then raise exception '期間の親に自分自身は指定できません'; end if;
  select company_id, type into p from public.goal_periods where id = new.parent_period_id;
  if p.company_id is distinct from new.company_id then raise exception '親の期間は同じ会社のものにしてください'; end if;
  if p.type <> 'year' then raise exception '親の期間は年度（year）にしてください'; end if;
  return new;
end $$;

drop trigger if exists goal_periods_check_parent on public.goal_periods;
create trigger goal_periods_check_parent before insert or update of parent_period_id, company_id
  on public.goal_periods for each row execute function public.goal_periods_check_parent();

-- ============================================================
-- 2. teams / team_members（リーダーは team_members.role='leader'。複数リーダー可）
-- ============================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists teams_company_id_idx on public.teams(company_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_id_idx on public.team_members(user_id);

-- チームに入れられるのは、そのチームの会社のメンバーだけ
create or replace function public.team_members_check_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.teams t join public.members m on m.company_id = t.company_id
    where t.id = new.team_id and m.auth_id = new.user_id
  ) then
    raise exception 'チームの会社に所属していないユーザーは追加できません';
  end if;
  return new;
end $$;

drop trigger if exists team_members_check_company on public.team_members;
create trigger team_members_check_company before insert or update on public.team_members
  for each row execute function public.team_members_check_company();

-- リーダー判定（team_members を見るので、テーブル作成の後に作る）
create or replace function public.goal_is_team_leader(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = target_team_id and tm.user_id = auth.uid() and tm.role = 'leader'
  )
$$;

-- 自分が、対象ユーザーの所属するいずれかのチームのリーダーか（個人目標の閲覧用）
create or replace function public.goal_is_leader_of_user(target_company_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members leader
    join public.team_members target on target.team_id = leader.team_id
    join public.teams t on t.id = leader.team_id
    where leader.user_id = auth.uid() and leader.role = 'leader'
      and target.user_id = target_user_id
      and t.company_id = target_company_id
  )
$$;

-- ============================================================
-- 3. goals（3層を1本に）
-- ============================================================
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_id uuid references public.goal_periods(id) on delete set null,
  level text not null check (level in ('company', 'team', 'personal')),
  team_id uuid references public.teams(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  parent_goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  behavior_guideline_id uuid references public.philosophy_elements(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_team_id_iff_team check ((level = 'team') = (team_id is not null)),
  constraint goals_owner_iff_personal check ((level = 'personal') = (owner_user_id is not null))
);
create index if not exists goals_company_level_idx on public.goals(company_id, level);
create index if not exists goals_period_id_idx on public.goals(period_id);
create index if not exists goals_team_id_idx on public.goals(team_id);
create index if not exists goals_owner_user_id_idx on public.goals(owner_user_id);
create index if not exists goals_parent_goal_id_idx on public.goals(parent_goal_id);
-- 個人目標は1人1期間1件（期間なしの移行前データも1件に数える）
create unique index if not exists goals_one_personal_per_period
  on public.goals(company_id, owner_user_id, period_id) nulls not distinct where level = 'personal';

-- 親の層（personal→team、team→company のみ・同じ会社）と、期間・チーム・行動指針が同じ会社かを確かめる
create or replace function public.goals_check_relations()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent record;
begin
  if new.parent_goal_id is not null then
    if new.parent_goal_id = new.id then raise exception '目標の親に自分自身は指定できません'; end if;
    select level, company_id into parent from public.goals where id = new.parent_goal_id;
    if parent.company_id is distinct from new.company_id then raise exception '親の目標は同じ会社のものにしてください'; end if;
    if not ((new.level = 'personal' and parent.level = 'team') or (new.level = 'team' and parent.level = 'company')) then
      raise exception '親にできるのは、個人目標→チーム目標、チーム目標→会社目標だけです';
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

drop trigger if exists goals_check_relations on public.goals;
create trigger goals_check_relations before insert or update on public.goals
  for each row execute function public.goals_check_relations();

-- 既存の個人目標を ID を変えずに移す
insert into public.goals (id, company_id, period_id, level, owner_user_id, title, created_by, created_at, updated_at)
select g.id, g.company_id, g.goal_period_id, 'personal', g.user_id, g.title, g.user_id,
       coalesce(g.created_at, now()), coalesce(g.updated_at, g.created_at, now())
from public.personal_goals g
on conflict (id) do nothing;

-- ============================================================
-- 4. goal_kpis: 親を goals に付け替え・上位KPIへの寄与リンク
-- ============================================================
alter table public.goal_kpis drop constraint if exists goal_kpis_goal_id_fkey;
alter table public.goal_kpis
  add constraint goal_kpis_goal_id_fkey foreign key (goal_id) references public.goals(id) on delete cascade;

alter table public.goal_kpis
  add column if not exists contributes_to_kpi_id uuid references public.goal_kpis(id) on delete set null;
create index if not exists goal_kpis_goal_id_idx on public.goal_kpis(goal_id);
create index if not exists goal_kpis_contributes_to_kpi_id_idx on public.goal_kpis(contributes_to_kpi_id);
comment on column public.goal_kpis.user_id is 'KPI を作成したユーザー（個人目標なら本人）';

create or replace function public.goal_kpis_check_relations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.goals g where g.id = new.goal_id and g.company_id = new.company_id) then
    raise exception 'KPI の会社と目標の会社が一致しません';
  end if;
  if new.contributes_to_kpi_id is not null then
    if new.contributes_to_kpi_id = new.id then raise exception 'KPI の寄与先に自分自身は指定できません'; end if;
    if not exists (select 1 from public.goal_kpis k where k.id = new.contributes_to_kpi_id and k.company_id = new.company_id) then
      raise exception '寄与先の KPI は同じ会社のものにしてください';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists goal_kpis_check_relations on public.goal_kpis;
create trigger goal_kpis_check_relations before insert or update on public.goal_kpis
  for each row execute function public.goal_kpis_check_relations();

-- 目標を編集できるか（goal_kpis の書き込みは親の目標の権限に従う）
create or replace function public.goal_can_edit(target_goal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.goals g
    where g.id = target_goal_id
      and (
        (g.level = 'company' and public.goal_is_company_admin(g.company_id))
        or (g.level = 'team' and (public.goal_is_company_admin(g.company_id) or public.goal_is_team_leader(g.team_id)))
        or (g.level = 'personal' and g.owner_user_id = auth.uid())
      )
  )
$$;

-- ============================================================
-- 5. RLS（すべて authenticated）
-- ============================================================
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.goals enable row level security;

revoke all on public.teams, public.team_members, public.goals from anon;

-- teams / team_members: 閲覧=自社全員 / 編集=管理者
create policy teams_select on public.teams for select to authenticated
  using (public.goal_is_company_member(company_id) or public.goal_is_company_admin(company_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.goal_is_company_admin(company_id));
create policy teams_update on public.teams for update to authenticated
  using (public.goal_is_company_admin(company_id)) with check (public.goal_is_company_admin(company_id));
create policy teams_delete on public.teams for delete to authenticated
  using (public.goal_is_company_admin(company_id));

create policy team_members_select on public.team_members for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_members.team_id
                 and (public.goal_is_company_member(t.company_id) or public.goal_is_company_admin(t.company_id))));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (exists (select 1 from public.teams t where t.id = team_members.team_id and public.goal_is_company_admin(t.company_id)));
create policy team_members_update on public.team_members for update to authenticated
  using (exists (select 1 from public.teams t where t.id = team_members.team_id and public.goal_is_company_admin(t.company_id)))
  with check (exists (select 1 from public.teams t where t.id = team_members.team_id and public.goal_is_company_admin(t.company_id)));
create policy team_members_delete on public.team_members for delete to authenticated
  using (exists (select 1 from public.teams t where t.id = team_members.team_id and public.goal_is_company_admin(t.company_id)));

-- goals
--   company: 閲覧=自社全員 / 編集=管理者
--   team:    閲覧=自社全員 / 編集=そのチームのリーダー＋管理者
--   personal: 閲覧=本人＋同じチームのリーダー＋管理者 / 編集=本人（削除は本人＋管理者。従来どおり）
--   会社・チーム目標の作成・編集はプラン（premium / enterprise）が必要（goal_periods・goal_kpis と同じ）
create policy goals_select on public.goals for select to authenticated
  using (
    (level in ('company', 'team') and (public.goal_is_company_member(company_id) or public.goal_is_company_admin(company_id)))
    or (level = 'personal' and (
      owner_user_id = (select auth.uid())
      or public.goal_is_company_admin(company_id)
      or public.goal_is_leader_of_user(company_id, owner_user_id)
    ))
  );
create policy goals_insert on public.goals for insert to authenticated
  with check (
    (level = 'company' and public.goal_is_company_admin(company_id)
      and public.company_plan_allows(company_id, array['premium', 'enterprise']))
    or (level = 'team' and (public.goal_is_company_admin(company_id) or public.goal_is_team_leader(team_id))
      and public.company_plan_allows(company_id, array['premium', 'enterprise']))
    or (level = 'personal' and owner_user_id = (select auth.uid()) and public.goal_is_company_member(company_id))
  );
create policy goals_update on public.goals for update to authenticated
  using (
    (level = 'company' and public.goal_is_company_admin(company_id))
    or (level = 'team' and (public.goal_is_company_admin(company_id) or public.goal_is_team_leader(team_id)))
    or (level = 'personal' and owner_user_id = (select auth.uid()))
  )
  with check (
    (level = 'company' and public.goal_is_company_admin(company_id)
      and public.company_plan_allows(company_id, array['premium', 'enterprise']))
    or (level = 'team' and (public.goal_is_company_admin(company_id) or public.goal_is_team_leader(team_id))
      and public.company_plan_allows(company_id, array['premium', 'enterprise']))
    or (level = 'personal' and owner_user_id = (select auth.uid()) and public.goal_is_company_member(company_id))
  );
create policy goals_delete on public.goals for delete to authenticated
  using (
    (level = 'company' and public.goal_is_company_admin(company_id))
    or (level = 'team' and (public.goal_is_company_admin(company_id) or public.goal_is_team_leader(team_id)))
    or (level = 'personal' and (owner_user_id = (select auth.uid()) or public.goal_is_company_admin(company_id)))
  );

-- goal_kpis: 親の目標の権限に従う（閲覧は親の目標が見えるか＝goals の RLS をそのまま使う）
drop policy if exists goal_kpis_select on public.goal_kpis;
drop policy if exists goal_kpis_insert on public.goal_kpis;
drop policy if exists goal_kpis_update on public.goal_kpis;
drop policy if exists goal_kpis_delete on public.goal_kpis;

create policy goal_kpis_select on public.goal_kpis for select to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_kpis.goal_id));
create policy goal_kpis_insert on public.goal_kpis for insert to authenticated
  with check (user_id = (select auth.uid()) and public.goal_can_edit(goal_id) and public.company_plan_allows(company_id, array['premium', 'enterprise']));
create policy goal_kpis_update on public.goal_kpis for update to authenticated
  using (public.goal_can_edit(goal_id))
  with check (public.goal_can_edit(goal_id) and public.company_plan_allows(company_id, array['premium', 'enterprise']));
create policy goal_kpis_delete on public.goal_kpis for delete to authenticated
  using (public.goal_can_edit(goal_id));

-- 関数は authenticated だけが使う（PUBLIC 経由で anon に実行権が残らないように）
revoke all on function public.goal_is_company_member(uuid) from public, anon;
revoke all on function public.goal_is_company_admin(uuid) from public, anon;
revoke all on function public.goal_is_team_leader(uuid) from public, anon;
revoke all on function public.goal_is_leader_of_user(uuid, uuid) from public, anon;
revoke all on function public.goal_can_edit(uuid) from public, anon;
grant execute on function public.goal_is_company_member(uuid) to authenticated;
grant execute on function public.goal_is_company_admin(uuid) to authenticated;
grant execute on function public.goal_is_team_leader(uuid) to authenticated;
grant execute on function public.goal_is_leader_of_user(uuid, uuid) to authenticated;
grant execute on function public.goal_can_edit(uuid) to authenticated;
revoke all on function public.goal_periods_check_parent() from public, anon, authenticated;
revoke all on function public.team_members_check_company() from public, anon, authenticated;
revoke all on function public.goals_check_relations() from public, anon, authenticated;
revoke all on function public.goal_kpis_check_relations() from public, anon, authenticated;

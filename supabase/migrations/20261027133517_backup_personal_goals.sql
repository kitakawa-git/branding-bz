-- 目標・KPI を「会社 → チーム → 個人」の3層にする（2/2）
-- コードが goals に切り替わって本番反映された後に、旧 personal_goals を退避する。
-- 1/2（20261027131859）の適用からデプロイ完了までの間に旧コードが personal_goals に書いた分を先に goals へ写す

-- 1. その間に旧テーブルへ追加された個人目標
insert into public.goals (id, company_id, period_id, level, owner_user_id, title, created_by, created_at, updated_at)
select g.id, g.company_id, g.goal_period_id, 'personal', g.user_id, g.title, g.user_id,
       coalesce(g.created_at, now()), coalesce(g.updated_at, g.created_at, now())
from public.personal_goals g
where not exists (select 1 from public.goals x where x.id = g.id)
on conflict do nothing;

-- 2. その間に旧テーブルで書き換えられた個人目標（旧のほうが新しいときだけ）
update public.goals x
set title = g.title, period_id = g.goal_period_id, updated_at = g.updated_at
from public.personal_goals g
where x.id = g.id and x.level = 'personal' and g.updated_at > x.updated_at;

-- 3. その間に旧テーブルで削除された個人目標（1/2 で移した行のうち、旧テーブルから消えたもの）
delete from public.goals x
where x.level = 'personal'
  and x.created_at < '2026-10-27 13:18:59+00'
  and not exists (select 1 from public.personal_goals g where g.id = x.id);

-- 4. 退避（中身は残す。API からは触れないようにする）
alter table public.personal_goals rename to _backup_personal_goals_20261027;
revoke all on public._backup_personal_goals_20261027 from anon, authenticated;

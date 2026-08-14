-- 書き込み系テーブルの RLS にプラン条件を足す（Phase 3b）。
--
-- 【なぜ RLS でやるか】
-- timeline / announcements / KPI はブラウザから supabase-js で直接テーブルを書いており、
-- requirePlan() を差せる API Route が存在しない。書き込み経路が RLS 一本に集約されて
-- いるので、ポリシーを直せば全経路が同時に塞がる（UI で隠すだけでは DevTools から通る）。
--
-- 【このマイグレーションの範囲】
-- プラン条件のみ。テナント分離は 20260814110000 / 20260814120000 で入れた条件を
-- そのまま残し、AND で足す。
--
-- 【対応する entitlements の feature】
--   timeline       → timeline_posts / timeline_likes / timeline_comments（standard〜）
--   announcements  → announcements（standard〜）
--   kpi            → goal_kpis / goal_periods（premium〜）
-- lib/billing/entitlements.ts の該当 feature に、このファイル名を相互参照として書いてある。
-- プラン構成を変えるときは両方を直すこと。
--
-- 【WITH CHECK だけに足す理由】
-- DELETE には WITH CHECK が無く、USING に足すと「解約したら自分の投稿を消せない」に
-- なってしまう。自分が作ったものを片付ける操作は残す。書き込み（INSERT / UPDATE）
-- だけをプランで止める。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   timeline_posts_insert     with check (user_id = (select auth.uid()))
--   timeline_posts_update     using (user_id = (select auth.uid()))
--                             with check (user_id = (select auth.uid()))
--   timeline_likes_insert     with check (user_id = (select auth.uid()))
--   timeline_comments_insert  with check (user_id = (select auth.uid()))
--   announcements_insert      with check (exists(admin_users で自社))
--   announcements_update      using  (exists(admin_users で自社))   ※ with check は無し
--   goal_kpis_insert          with check (user_id = uid and company_id in (members の自社))
--   goal_kpis_update          using (user_id = uid)
--                             with check (user_id = uid and company_id in (members の自社))
--   goal_periods_insert       with check (exists(admin_users で自社))
--   goal_periods_update       using / with check (exists(admin_users で自社))

-- ============================================================
-- 実効プランの判定関数
-- ============================================================
-- entitlements.getEffectivePlan と同じ考え方（期限切れは free に落とす）を SQL 側にも置く。
-- 10 本のポリシーに同じ式を書くと片方だけ直す事故が起きるため1関数にまとめる。
-- companies の SELECT ポリシーは anon/authenticated とも true なので security invoker で足りる。
create or replace function public.company_plan_allows(
  target_company_id uuid,
  allowed_plans text[]
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      select case
               when c.plan_expires_at is not null and c.plan_expires_at <= now() then 'free'
               else c.plan
             end
        from public.companies c
       where c.id = target_company_id
    ),
    'free'  -- 会社が見つからないときは free 扱い（安全側）
  ) = any(allowed_plans);
$$;

comment on function public.company_plan_allows(uuid, text[]) is
  '会社の実効プランが allowed_plans に含まれるか。plan_expires_at が過去なら free として判定する。lib/billing/entitlements.ts の getEffectivePlan と対。';

-- ============================================================
-- timeline（standard 以上）
-- ============================================================
drop policy if exists "timeline_posts_insert" on public.timeline_posts;
create policy "timeline_posts_insert" on public.timeline_posts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

drop policy if exists "timeline_posts_update" on public.timeline_posts;
create policy "timeline_posts_update" on public.timeline_posts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

drop policy if exists "timeline_likes_insert" on public.timeline_likes;
create policy "timeline_likes_insert" on public.timeline_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

drop policy if exists "timeline_comments_insert" on public.timeline_comments;
create policy "timeline_comments_insert" on public.timeline_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

-- ============================================================
-- announcements（standard 以上）
-- ============================================================
drop policy if exists "announcements_insert" on public.announcements;
create policy "announcements_insert" on public.announcements
  for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = announcements.company_id
    )
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

-- 旧 update は with check が無く、更新後の行が無検査だった。ここで付ける
drop policy if exists "announcements_update" on public.announcements;
create policy "announcements_update" on public.announcements
  for update to authenticated
  using (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = announcements.company_id
    )
  )
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = announcements.company_id
    )
    and company_plan_allows(company_id, array['standard','premium','enterprise'])
  );

-- ============================================================
-- KPI（premium 以上）
-- ============================================================
drop policy if exists "goal_kpis_insert" on public.goal_kpis;
create policy "goal_kpis_insert" on public.goal_kpis
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
    and company_plan_allows(company_id, array['premium','enterprise'])
  );

drop policy if exists "goal_kpis_update" on public.goal_kpis;
create policy "goal_kpis_update" on public.goal_kpis
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
    and company_plan_allows(company_id, array['premium','enterprise'])
  );

drop policy if exists "goal_periods_insert" on public.goal_periods;
create policy "goal_periods_insert" on public.goal_periods
  for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
    and company_plan_allows(company_id, array['premium','enterprise'])
  );

drop policy if exists "goal_periods_update" on public.goal_periods;
create policy "goal_periods_update" on public.goal_periods
  for update to authenticated
  using (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  )
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
    and company_plan_allows(company_id, array['premium','enterprise'])
  );

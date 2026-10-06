-- Good Action 投稿（timeline_*）とお知らせ（announcements）を Free に下ろす。
--
-- 【背景】
-- 261006_料金プラン改訂案_v1（案B・2026-10-06）で、Free を「5名のチームで、
-- ブランドを整えて社内で共有してみる」範囲まで広げることが決まった。
-- lib/billing/entitlements.ts の timeline / announcements を free=true に変えたが、
-- これらの書き込みは RLS 一本（20260814140000_rls_plan_conditions）でも塞いでいるため、
-- 両側そろえないと UI は通っても RLS で弾かれる。本マイグレーションは RLS 側を揃える。
--
-- 【このマイグレーションの範囲】
-- company_plan_allows の許可プランに 'free' と 'card' を足す（6ポリシー）：
--   timeline_posts_insert / timeline_posts_update
--   timeline_likes_insert
--   timeline_comments_insert
--   announcements_insert / announcements_update
-- card は販売終了だが、FEATURE_MATRIX で free と同じ扱いにそろえているため SQL でも揃える。
--
-- 【触らないもの】
--   goal_kpis / goal_periods（premium 以上のまま）
--   company_plan_allows 関数本体（契約内容は変えない）
--   他のテナント分離ポリシー（USING 側）
--
-- 【ロールバック】
-- 旧ポリシー定義（standard/premium/enterprise のみ）は 20260814140000_rls_plan_conditions.sql
-- に残っているため、必要なら各 drop policy / create policy を手で戻せる。

-- ============================================================
-- timeline（free まで）
-- ============================================================
drop policy if exists "timeline_posts_insert" on public.timeline_posts;
create policy "timeline_posts_insert" on public.timeline_posts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

drop policy if exists "timeline_posts_update" on public.timeline_posts;
create policy "timeline_posts_update" on public.timeline_posts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

drop policy if exists "timeline_likes_insert" on public.timeline_likes;
create policy "timeline_likes_insert" on public.timeline_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

drop policy if exists "timeline_comments_insert" on public.timeline_comments;
create policy "timeline_comments_insert" on public.timeline_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

-- ============================================================
-- announcements（free まで）
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
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

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
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
  );

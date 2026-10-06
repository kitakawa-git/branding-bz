-- ログインしていれば誰でも他社データを書き換えられた4表（companies / profiles / news /
-- value_propositions）の書き込みを、本来の範囲に絞る。
-- 棚卸し: docs/BRD-PROJECT-STATUS.md「RLS の USING (true) 棚卸し」（2026-09-23 その2）。
--
-- 【会社の判定】既存ポリシー（20260814140000_rls_plan_conditions 等）と同じく、
-- admin_users / members で auth.uid() の company_id と照合する。
-- superadmin は is_current_user_superadmin()（SECURITY DEFINER・anon には実行権なし）で判定するので、
-- それを呼ぶポリシーは必ず TO authenticated にする（PUBLIC だと anon で権限エラーになる）。
--
-- 【変えないもの】
--   - companies / profiles / news の SELECT（public_select）。名刺ページ（/card/[slug]）と
--     公開サイトが anon で読んでいるため、読み取りの絞り込みは別の段で行う。
--   - service_role 経由の書き込み（サインアップ・メンバー作成 API 等）は RLS を通らないので影響なし。
--
-- 【ブラウザ／ユーザーセッションからの書き込み経路（このポリシーで通す必要があるもの）】
--   companies         UPDATE: /admin/kpi・/admin/brand/strategy（自社管理者）、/superadmin/companies/[id]（superadmin）
--   profiles          INSERT/UPDATE: /admin/components/MemberForm、/admin/members の PATCH（自社管理者）
--                     UPDATE: /portal/profile（本人＝members.profile_id で紐づく行）
--   news              INSERT/UPDATE/DELETE: /superadmin/news（superadmin）
--   value_propositions SELECT: /portal/values・/portal/strategy（自社メンバー）、/admin/brand/strategy（自社管理者）、
--                     /superadmin/companies/*（superadmin）
--                     INSERT/UPDATE/DELETE: /admin/brand/strategy（自社管理者・REST 直叩き＋ユーザートークン）
--
-- 【ロールバック】旧定義
--   companies:  auth_write_insert (insert, authenticated, with check true)
--               auth_write_delete (delete, authenticated, using true)
--               companies_update_superadmin_or_own_admin (update, PUBLIC, 式は同じ)
--   profiles:   auth_write_insert / auth_write_update / auth_write_delete（authenticated, true）
--   news:       auth_write_insert / auth_write_update / auth_write_delete（authenticated, true）
--   value_propositions: auth_all (all, authenticated, using true, with check true)

-- ============================================================
-- companies
-- ============================================================
-- 作成はサインアップ・superadmin の API（service_role）経由のみ。authenticated の INSERT は不要
drop policy if exists "auth_write_insert" on public.companies;
drop policy if exists "auth_write_delete" on public.companies;

create policy "companies_delete_superadmin" on public.companies
  for delete to authenticated
  using (is_current_user_superadmin());

-- 式は変えず、対象ロールだけ PUBLIC → authenticated（anon で superadmin 関数を呼ばないため）
drop policy if exists "companies_update_superadmin_or_own_admin" on public.companies;
create policy "companies_update_superadmin_or_own_admin" on public.companies
  for update to authenticated
  using (
    is_current_user_superadmin()
    or id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  )
  with check (
    is_current_user_superadmin()
    or id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

-- ============================================================
-- profiles（名刺の中身）
-- ============================================================
drop policy if exists "auth_write_insert" on public.profiles;
drop policy if exists "auth_write_update" on public.profiles;
drop policy if exists "auth_write_delete" on public.profiles;

-- 自社管理者が自社の名刺を作る
create policy "profiles_insert_own_admin" on public.profiles
  for insert to authenticated
  with check (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

-- 自社管理者は自社の名刺を、メンバー本人は自分の名刺を更新できる。
-- 本人の条件は members.profile_id で紐づき、かつ同じ会社であること（会社をまたぐ付け替えは with check で弾く）
create policy "profiles_update_own_admin_or_self" on public.profiles
  for update to authenticated
  using (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    or exists (
      select 1 from members m
       where m.auth_id = (select auth.uid())
         and m.profile_id = profiles.id
         and m.company_id = profiles.company_id
    )
  )
  with check (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    or exists (
      select 1 from members m
       where m.auth_id = (select auth.uid())
         and m.profile_id = profiles.id
         and m.company_id = profiles.company_id
    )
  );

create policy "profiles_delete_own_admin" on public.profiles
  for delete to authenticated
  using (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

-- ============================================================
-- news（公開サイトのニュース）
-- ============================================================
drop policy if exists "auth_write_insert" on public.news;
drop policy if exists "auth_write_update" on public.news;
drop policy if exists "auth_write_delete" on public.news;

create policy "news_insert_superadmin" on public.news
  for insert to authenticated
  with check (is_current_user_superadmin());

create policy "news_update_superadmin" on public.news
  for update to authenticated
  using (is_current_user_superadmin())
  with check (is_current_user_superadmin());

create policy "news_delete_superadmin" on public.news
  for delete to authenticated
  using (is_current_user_superadmin());

-- ============================================================
-- value_propositions（提供価値）
-- ============================================================
drop policy if exists "auth_all" on public.value_propositions;

-- 読み: 自社のメンバー・管理者、superadmin
create policy "value_propositions_select_own_company" on public.value_propositions
  for select to authenticated
  using (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    or company_id in (select members.company_id from members where members.auth_id = (select auth.uid()))
  );

-- 書き: 自社管理者、superadmin
create policy "value_propositions_insert_own_admin" on public.value_propositions
  for insert to authenticated
  with check (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

create policy "value_propositions_update_own_admin" on public.value_propositions
  for update to authenticated
  using (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  )
  with check (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

create policy "value_propositions_delete_own_admin" on public.value_propositions
  for delete to authenticated
  using (
    is_current_user_superadmin()
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

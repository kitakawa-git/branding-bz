-- 公開読み取りの廃止: companies / brand_guidelines / brand_visuals / philosophy_elements の anon 向け SELECT を外す
--
-- ログイン前に読むのはサーバー側の /card/[slug] だけで、lib/public-card.ts が service_role で読む
-- （列と行を絞る）。anon に列や行を見せる設計はやめる。
-- 今後「公開ブランドページ」を作るときも anon の SELECT は戻さず、lib/public-card.ts に必要な列だけ足す。
-- design_tokens は会社別データを持たない全体設定なので変更しない。
--
-- 列単位の REVOKE はしない。company_plan_allows() が呼び出し元の権限で companies.plan を読むため。

-- ============================================================
-- 1. ログイン後の画面が読めなくならないよう、先に SELECT を追加する
-- ============================================================

-- companies: 自社（brand_guidelines_select と同じ所属判定）
create policy companies_select_own on public.companies
  for select
  to authenticated
  using (
    id in (
      select admin_users.company_id from public.admin_users
       where admin_users.auth_id = (select auth.uid())
      union
      select members.company_id from public.members
       where members.auth_id = (select auth.uid())
    )
  );

-- companies: superadmin は全社（/superadmin/companies ほか）
create policy companies_select_superadmin on public.companies
  for select
  to authenticated
  using (public.is_current_user_superadmin());

-- brand_guidelines: 自社分は既存の brand_guidelines_select で読める。
-- superadmin は全社（OutputTestPanel が他社分を読む）
create policy brand_guidelines_select_superadmin on public.brand_guidelines
  for select
  to authenticated
  using (public.is_current_user_superadmin());

-- 既存の自社用 SELECT を authenticated 向けに揃える（条件は変えない）
alter policy brand_guidelines_select on public.brand_guidelines to authenticated;
alter policy brand_visuals_select on public.brand_visuals to authenticated;

-- philosophy_elements: 自社
create policy philosophy_elements_select_own on public.philosophy_elements
  for select
  to authenticated
  using (
    company_id in (
      select admin_users.company_id from public.admin_users
       where admin_users.auth_id = (select auth.uid())
      union
      select members.company_id from public.members
       where members.auth_id = (select auth.uid())
    )
  );

-- philosophy_elements: superadmin ポリシーを authenticated 向けにする。
-- PUBLIC 向けのままだと、anon は is_current_user_superadmin() を実行できず、
-- 公開 SELECT を外したあと 0 件ではなく権限エラーになる
alter policy philosophy_elements_superadmin_all on public.philosophy_elements
  to authenticated
  using (public.is_current_user_superadmin())
  with check (public.is_current_user_superadmin());

-- ============================================================
-- 2. anon 向けの SELECT を外す
-- ============================================================
drop policy public_select on public.companies;
drop policy brand_guidelines_public_select on public.brand_guidelines;
drop policy brand_visuals_public_select on public.brand_visuals;
drop policy philosophy_elements_public_select on public.philosophy_elements;


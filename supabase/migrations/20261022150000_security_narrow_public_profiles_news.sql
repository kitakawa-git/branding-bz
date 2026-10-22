-- セキュリティ（指示書A タスク3・2026-10-22）: anon / public + true の SELECT を絞る（2表）
--   profiles: anon が email・phone を含む全員分を読めた（名刺を公開していない人も）
--             → anon は名刺を公開している行（card_enabled = true）だけ。
--               ログイン済みは自社（管理者・メンバー）＋名刺公開の行＋superadmin は全件
--   news:     anon が下書き（is_published = false）も読めた
--             → 公開記事だけ。superadmin は下書きも（/superadmin/news がブラウザから読む）
-- 公開ページ（/news・sitemap）は service_role で is_published を付けて読むので影響しない。
-- companies・brand_guidelines・brand_visuals・philosophy_elements は公開ブランドページで見せる範囲が
-- 決まってから別の migration で絞る（A-0 報告 §8-4）。

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists public_select on public.profiles;

create policy profiles_public_card_select on public.profiles
  for select to anon
  using (card_enabled = true);

create policy profiles_company_or_card_select on public.profiles
  for select to authenticated
  using (
    card_enabled = true
    or public.is_current_user_superadmin()
    or company_id in (
      select a.company_id from public.admin_users a where a.auth_id = (select auth.uid())
      union
      select m.company_id from public.members m where m.auth_id = (select auth.uid())
    )
  );

-- ============================================================
-- news
-- ============================================================
drop policy if exists public_select on public.news;

-- anon は is_current_user_superadmin() を実行できない（EXECUTE を外してある）ので、ロールごとに分ける
create policy news_published_select on public.news
  for select to anon
  using (is_published = true);

create policy news_published_or_superadmin_select on public.news
  for select to authenticated
  using (is_published = true or public.is_current_user_superadmin());

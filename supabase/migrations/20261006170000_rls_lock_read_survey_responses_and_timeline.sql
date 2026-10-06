-- サーベイ回答と Good Action（投稿・コメント・いいね）の読み取りを、本来の範囲に絞る。
-- 棚卸し: docs/BRD-PROJECT-STATUS.md「RLS の USING (true) 棚卸し」（2026-09-23 その2）。
--
-- 【brand_survey_responses】
-- 修正前: ログインしていれば全社の回答を読めた（auth_select）。更新・削除も誰でも可（auth_update / auth_delete）、
--         追加は未ログインでも可（anon_insert）。
-- 使われ方: 読み書きはすべて API Route の service_role 経由（inner-score / knowledge-gap / trend /
--         respond / import / snapshots / cron / superadmin の company-view）。ブラウザから直接触る画面は無い。
-- → authenticated / anon 向けのポリシーをすべて外す。RLS は有効のままなので、
--   service_role 以外からは読み書きできなくなる（回答の送信は /api/brand-score/surveys/[id]/respond が service_role で行う）。
--
-- 【timeline_posts / timeline_comments / timeline_likes】
-- 修正前: SELECT が PUBLIC・USING (true)。未ログインでも全社の投稿・コメント・いいねが読めた。
-- 使われ方: /portal・/portal/timeline・/admin/dashboard がブラウザ（ユーザーのトークン）で読む。
-- → 自社の有効なメンバーと自社の管理者だけが読めるようにする。
--   会社の判定は既存ポリシーと同じく members / admin_users で auth.uid() の company_id と照合。
--   書き込み（insert / update / delete）のポリシーは変えない（20261006120000 でプラン条件を設定済み）。
--
-- 【ロールバック】
--   brand_survey_responses: auth_select (select, authenticated, true) / auth_update (update, authenticated, true, true)
--                           / auth_delete (delete, authenticated, true) / anon_insert (insert, anon+authenticated, with check true)
--   timeline_*_select: (select, PUBLIC, using true)

-- ============================================================
-- brand_survey_responses（service_role のみ）
-- ============================================================
drop policy if exists "auth_select" on public.brand_survey_responses;
drop policy if exists "auth_update" on public.brand_survey_responses;
drop policy if exists "auth_delete" on public.brand_survey_responses;
drop policy if exists "anon_insert" on public.brand_survey_responses;

-- ============================================================
-- timeline_*（自社の有効なメンバー・管理者のみ読める）
-- ============================================================
drop policy if exists "timeline_posts_select" on public.timeline_posts;
create policy "timeline_posts_select" on public.timeline_posts
  for select to authenticated
  using (
    company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

drop policy if exists "timeline_comments_select" on public.timeline_comments;
create policy "timeline_comments_select" on public.timeline_comments
  for select to authenticated
  using (
    company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

drop policy if exists "timeline_likes_select" on public.timeline_likes;
create policy "timeline_likes_select" on public.timeline_likes
  for select to authenticated
  using (
    company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
    or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
  );

-- Good Action（timeline_posts / timeline_comments / timeline_likes）の書き込みを自社に限る。
--
-- 【見つかった穴】
-- insert / update の with check は「user_id が自分」と「その会社のプラン」しか見ておらず、
-- 所属していない会社の company_id を指定しても通った（読み戻しをしない送り方なら成功する。
-- 20261006170000 で読み取りは塞いだが、書いた行は相手の会社のメンバーには表示されてしまう）。
--
-- 【修正】
--   - insert / update の with check に「自社の有効なメンバー、または自社の管理者」を足す
--   - いいね・コメントは、付ける先の投稿が同じ会社であることも確認する（他社の投稿 id への紐づけを防ぐ）
--   - プランの条件（company_plan_allows）と「user_id が自分」は今のまま残す
--   - delete（自分の行を消す）は変えない。解約後や退職後でも自分の書いたものは片付けられるようにしておく
--
-- 【ロールバック】旧定義は 20261006120000_rls_free_timeline_announcements.sql

drop policy if exists "timeline_posts_insert" on public.timeline_posts;
create policy "timeline_posts_insert" on public.timeline_posts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
    and (
      company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
      or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    )
  );

drop policy if exists "timeline_posts_update" on public.timeline_posts;
create policy "timeline_posts_update" on public.timeline_posts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
    and (
      company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
      or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    )
  );

drop policy if exists "timeline_likes_insert" on public.timeline_likes;
create policy "timeline_likes_insert" on public.timeline_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
    and (
      company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
      or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    )
    and exists (select 1 from timeline_posts p where p.id = timeline_likes.post_id and p.company_id = timeline_likes.company_id)
  );

drop policy if exists "timeline_comments_insert" on public.timeline_comments;
create policy "timeline_comments_insert" on public.timeline_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_plan_allows(company_id, array['free','card','standard','premium','enterprise'])
    and (
      company_id in (select members.company_id from members where members.auth_id = (select auth.uid()) and members.is_active)
      or company_id in (select admin_users.company_id from admin_users where admin_users.auth_id = (select auth.uid()))
    )
    and exists (select 1 from timeline_posts p where p.id = timeline_comments.post_id and p.company_id = timeline_comments.company_id)
  );

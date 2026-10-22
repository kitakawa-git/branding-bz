-- セキュリティ: A-0 検証（2026-10-22）の 🔴1・🔴2・🔴4 を塞ぐ
--   🔴1 invite_links の招待トークンを anon が全件読めた → どの会社にもメンバー登録できた
--   🔴2 Storage brand-assets の INSERT/UPDATE/DELETE が role=public・bucket 条件のみ（未ログインで改ざん可）
--   🔴4 authenticated + true のポリシーで、ログインさえすれば全社の行を読める・書ける・消せた
--       （card_views / card_events / brand_page_views / brand_micro_feedbacks / survey_participants、
--         Storage avatars・logos の UPDATE、timeline-images の DELETE）
-- 🔴3（Auth のサインアップ開放）は DB ではなく Auth 設定（disable_signup）で塞ぐ。
--
-- 前提: 招待トークンの確認を /api/members/register の GET（service_role）に移したコードが先に本番に出ていること。
--       （app/portal/register/page.tsx が anon で invite_links を読んでいたため）
-- 書き込み・集計は service_role の API が担っており、RLS をバイパスするので影響しない。

-- ============================================================
-- 🔴1 invite_links: anon / 他社からのトークン読み取りをやめる
--   管理者は invite_links_admin_all（自社分）で引き続き読める・作れる・無効化できる
-- ============================================================
drop policy if exists invite_links_public_select on public.invite_links;

-- ============================================================
-- 🔴4 アクセス解析・サーベイ参加者: 会社で絞る。更新・削除は service_role の API だけにする
-- ============================================================

-- card_views（列に company_id が無いので profile 経由）。読むのは admin 画面と superadmin 画面だけ
drop policy if exists auth_select on public.card_views;
drop policy if exists auth_update on public.card_views;
drop policy if exists auth_delete on public.card_views;
create policy card_views_company_admin_select on public.card_views
  for select to authenticated
  using (
    public.is_current_user_superadmin()
    or profile_id in (
      select p.id from public.profiles p
      where p.company_id in (
        select a.company_id from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );

-- card_events / brand_page_views: クライアントからの読み取りは無い（集計は service_role）
--   anon_insert は /api/analytics/* が anon キーで insert しているので残す
drop policy if exists auth_select on public.card_events;
drop policy if exists auth_update on public.card_events;
drop policy if exists auth_delete on public.card_events;

drop policy if exists auth_select on public.brand_page_views;
drop policy if exists auth_update on public.brand_page_views;
drop policy if exists auth_delete on public.brand_page_views;

-- brand_micro_feedbacks: 読むのは admin/brand-score 画面（自社分）だけ。insert は service_role の API
drop policy if exists auth_select on public.brand_micro_feedbacks;
drop policy if exists auth_update on public.brand_micro_feedbacks;
drop policy if exists auth_delete on public.brand_micro_feedbacks;
create policy brand_micro_feedbacks_company_admin_select on public.brand_micro_feedbacks
  for select to authenticated
  using (
    public.is_current_user_superadmin()
    or company_id in (
      select a.company_id from public.admin_users a where a.auth_id = (select auth.uid())
    )
  );

-- survey_participants: ポータルは「自分の参加行」だけを読む。管理者は自社サーベイ分。
--   作成・回答・リマインドは service_role（lib/brand-score/survey-participants.ts・respond API）
drop policy if exists auth_select on public.survey_participants;
drop policy if exists auth_update on public.survey_participants;
drop policy if exists auth_delete on public.survey_participants;
drop policy if exists anon_insert on public.survey_participants;
create policy survey_participants_own_or_company_admin_select on public.survey_participants
  for select to authenticated
  using (
    public.is_current_user_superadmin()
    or profile_id in (
      select m.profile_id from public.members m where m.auth_id = (select auth.uid())
    )
    or survey_id in (
      select s.id from public.brand_surveys s
      where s.company_id in (
        select a.company_id from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );

-- ============================================================
-- 🔴2 Storage brand-assets: 書き込みは「自社フォルダ（{company_id}/...）の管理者」だけ
--   読み取り（brand_assets_select）と public バケットの公開 URL は変えない
-- ============================================================
drop policy if exists brand_assets_insert on storage.objects;
drop policy if exists brand_assets_update on storage.objects;
drop policy if exists brand_assets_delete on storage.objects;

create policy brand_assets_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (
      public.is_current_user_superadmin()
      or (storage.foldername(name))[1] in (
        select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );
create policy brand_assets_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (
      public.is_current_user_superadmin()
      or (storage.foldername(name))[1] in (
        select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  )
  with check (
    bucket_id = 'brand-assets'
    and (
      public.is_current_user_superadmin()
      or (storage.foldername(name))[1] in (
        select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );
create policy brand_assets_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (
      public.is_current_user_superadmin()
      or (storage.foldername(name))[1] in (
        select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );

-- ============================================================
-- 🔴4 Storage avatars / logos: 上書きはアップロードした本人だけ（パスに会社が入っていないため owner で判定）
--   新規アップロード（認証ユーザーはアップロード可能）は変えない。ファイル名は毎回ランダムで、upsert でも本人の新規行になる
-- ============================================================
drop policy if exists "認証ユーザーは更新可能" on storage.objects;
create policy avatars_logos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'logos')
    and (owner_id = (select auth.uid())::text or public.is_current_user_superadmin())
  )
  with check (
    bucket_id in ('avatars', 'logos')
    and (owner_id = (select auth.uid())::text or public.is_current_user_superadmin())
  );

-- ============================================================
-- 🔴4 Storage timeline-images: パスは {company_id}/{post_id}/...
--   追加は自社フォルダのメンバー・管理者、削除は本人（投稿者）か自社の管理者
-- ============================================================
drop policy if exists timeline_images_insert on storage.objects;
drop policy if exists timeline_images_delete on storage.objects;

create policy timeline_images_company_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'timeline-images'
    and (storage.foldername(name))[1] in (
      select m.company_id::text from public.members m where m.auth_id = (select auth.uid())
      union
      select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
    )
  );
create policy timeline_images_owner_or_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'timeline-images'
    and (
      owner_id = (select auth.uid())::text
      or public.is_current_user_superadmin()
      or (storage.foldername(name))[1] in (
        select a.company_id::text from public.admin_users a where a.auth_id = (select auth.uid())
      )
    )
  );

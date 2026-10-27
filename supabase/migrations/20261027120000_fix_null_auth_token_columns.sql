-- 孤立アカウント画面の「Database error finding users」対策（2026-10-27）
-- SQL で直接作ったデモユーザー（テックブリッジの a1000001〜05）は、auth.users の token 系の列が NULL になっていた。
-- Supabase Auth（GoTrue）はこれらを空文字前提で読むため、NULL の行が1つでもあると
-- auth.admin.listUsers() 全体が 500「Database error finding users」で失敗する（/superadmin/orphan-accounts が使う）。
-- NULL を空文字にするだけで、ログイン・パスワード・メールの状態は変わらない。冪等。
update auth.users
set confirmation_token          = coalesce(confirmation_token, ''),
    recovery_token              = coalesce(recovery_token, ''),
    email_change_token_new      = coalesce(email_change_token_new, ''),
    email_change                = coalesce(email_change, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null;

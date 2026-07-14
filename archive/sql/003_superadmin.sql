-- ============================================
-- スーパー管理者カラム追加
-- admin_usersテーブルにis_superadminフラグを追加
-- ※ Supabase SQL Editor で実行してください
-- ============================================

-- is_superadminカラム追加（デフォルトfalse）
ALTER TABLE admin_users ADD COLUMN is_superadmin boolean DEFAULT false NOT NULL;

-- kitakawa@include.bz をスーパー管理者に設定
UPDATE admin_users
SET is_superadmin = true
WHERE auth_id = (SELECT id FROM auth.users WHERE email = 'kitakawa@include.bz');

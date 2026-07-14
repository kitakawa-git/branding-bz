-- ============================================
-- RLS（Row Level Security）を無効化
-- プロトタイプ段階のため全テーブルのRLSを無効にする
-- ※ Supabase SQL Editor で実行してください
-- ============================================

-- admin_usersテーブル（新規作成時にデフォルトでRLS有効になっている）
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 念のためcompanies, profilesも確認・無効化
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

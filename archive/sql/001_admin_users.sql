-- ============================================
-- admin_users テーブル作成
-- マルチテナント対応: Supabase Auth ユーザーと企業を紐づける
-- ============================================

-- テーブル作成
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  company_id uuid REFERENCES companies NOT NULL,
  role text DEFAULT 'owner' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- インデックス（auth_idでの検索を高速化）
CREATE INDEX idx_admin_users_auth_id ON admin_users(auth_id);
CREATE INDEX idx_admin_users_company_id ON admin_users(company_id);

-- ============================================
-- 初期データ: kitakawa@include.bz を ID INC. に紐づけ
-- ※ Supabase SQL Editor で実行してください
-- ============================================

INSERT INTO admin_users (auth_id, company_id, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kitakawa@include.bz'),
  (SELECT id FROM companies WHERE name = 'ID INC.' LIMIT 1),
  'owner'
);

-- admin_users RLS 緊急是正
-- 全許可ポリシー auth_all（FOR ALL authenticated USING(true) WITH CHECK(true)）を撤去し、
-- 任意の認証ユーザーによる自己昇格(is_superadmin=true化)・他社管理者改ざんを封鎖する。
-- アプリの書き込みは api/signup・api/superadmin/create-company の service_role 経由のみで、
-- service_role は RLS をバイパスするため、書き込みポリシー無しでも従来どおり動作する。
--
-- ※ 本ファイルは MCP apply_migration（remote）で適用済みの内容をリポジトリ履歴として記録するもの。
--   version 20260608061425 として本番DBに適用済み。

-- 1) 全許可ポリシーを撤去
DROP POLICY IF EXISTS auth_all ON public.admin_users;

-- 2) superadmin 判定を RLS バイパスで行う SECURITY DEFINER 関数。
--    admin_users 自身を参照する SELECT ポリシーの無限再帰(42P17)を回避するため必須
--    （インラインの EXISTS(... FROM admin_users ...) は再帰してエラーになることを実機確認済み）。
CREATE OR REPLACE FUNCTION public.is_current_user_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_id = (SELECT auth.uid()) AND is_superadmin = true
  );
$$;

-- 3) スーパー管理者は全社の admin_users を閲覧可（スーパー管理画面がクライアント側 supabase 直読みのため必要）
CREATE POLICY admin_users_superadmin_select ON public.admin_users
  FOR SELECT
  USING ( public.is_current_user_superadmin() );

-- 4) 自己SELECT「ログインユーザーは自分のレコードを閲覧可能」(auth.uid()=auth_id) は既存維持（再作成不要）。
--    一般管理者の AdminDataProvider 等は自分の行のみ参照するため自己SELECTで充足。
-- 5) 書き込みポリシーは作らない＝クライアント書き込み一切不可（INSERT/UPDATE/DELETE は 42501）。

NOTIFY pgrst, 'reload schema';

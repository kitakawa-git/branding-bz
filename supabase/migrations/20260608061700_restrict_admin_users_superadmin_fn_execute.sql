-- is_current_user_superadmin() の実行権を authenticated に限定する。
-- 既定の PUBLIC 実行付与を撤去し anon 実行を不可に（anon_security_definer_function_executable 警告の解消）。
-- service_role は RLS をバイパスするため本関数をポリシー評価で呼ばない（影響なし）。
--
-- ※ MCP apply_migration（remote）で version 20260608061700 として適用済み。

REVOKE EXECUTE ON FUNCTION public.is_current_user_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_superadmin() TO authenticated;

-- superadmin SELECT ポリシーを authenticated 限定で再作成（anon は自己SELECTのみ評価し本関数を呼ばない）。
DROP POLICY IF EXISTS admin_users_superadmin_select ON public.admin_users;
CREATE POLICY admin_users_superadmin_select ON public.admin_users
  FOR SELECT TO authenticated
  USING ( public.is_current_user_superadmin() );

NOTIFY pgrst, 'reload schema';

-- is_current_user_superadmin() の anon 直接付与を撤去（Supabase既定privilegesによる anon=X を解除）。
-- ポリシーは authenticated 限定のため anon は本関数を呼ばない。authenticated/service_role は維持。
--
-- ※ MCP apply_migration（remote）で version 20260608061829 として適用済み。

REVOKE EXECUTE ON FUNCTION public.is_current_user_superadmin() FROM anon;

NOTIFY pgrst, 'reload schema';

-- element_relations の端点検証トリガ関数のハードニング。
-- validate_element_relation_endpoints() は BEFORE INSERT/UPDATE トリガ専用で、直接RPC呼び出しは不要。
-- SECURITY DEFINER かつ public/anon/authenticated から /rest/v1/rpc で実行可能、と advisor が警告
-- （0028/0029）。トリガはEXECUTE権限が無くても発火するため、直接実行権限を剥奪する
-- （admin_users の is_current_user_superadmin 是正と同方針）。
REVOKE EXECUTE ON FUNCTION public.validate_element_relation_endpoints() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- companies の UPDATE ポリシー是正（wide-open auth_write_update の撤去）
-- ============================================================
-- 背景:
--   companies.auth_write_update が USING(true)/WITH CHECK(true) で、認証済みなら誰でも
--   任意の会社を更新できる状態だった（advisor 0024）。実際にデモ会社の name が他者により
--   書き換えられる事故が発生したため、superadmin または自社admin に限定する。
--
-- クライアント側 UPDATE 経路の確認（適用前調査済み）:
--   - app/superadmin/companies/[id]/page.tsx（name/色/URL）… superadmin のみ到達（/superadmin ガード）→ 許可
--   - app/admin/kpi/page.tsx（goal_period）… /admin は admin_users 必須（members不可）→ 自社admin で許可
--   - API ルート（shared-profile / stp/connect / signup / admin/settings 等）… すべて service_role
--     （getSupabaseAdmin）で RLS バイパス → 影響なし
--   よって本ポリシーで壊れるクライアント画面は無い。
--
--   superadmin 判定は再帰回避の SECURITY DEFINER 関数 is_current_user_superadmin() を再利用。
--   自社admin 判定は既存 proof_points 等と同じ admin_users サブクエリ方式。
DROP POLICY IF EXISTS auth_write_update ON public.companies;

CREATE POLICY companies_update_superadmin_or_own_admin ON public.companies
  FOR UPDATE
  USING (
    public.is_current_user_superadmin()
    OR id IN (
      SELECT admin_users.company_id FROM public.admin_users
      WHERE admin_users.auth_id = (select auth.uid())
    )
  )
  WITH CHECK (
    public.is_current_user_superadmin()
    OR id IN (
      SELECT admin_users.company_id FROM public.admin_users
      WHERE admin_users.auth_id = (select auth.uid())
    )
  );

-- 注: INSERT(auth_write_insert)/DELETE(auth_write_delete) も同様に wide-open のまま残る。
--     本タスクのスコープは UPDATE のみ。INSERT/DELETE の是正は別タスクで扱う。
NOTIFY pgrst, 'reload schema';

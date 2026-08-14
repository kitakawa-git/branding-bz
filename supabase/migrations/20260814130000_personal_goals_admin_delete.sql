-- personal_goals の DELETE に自社管理者を追加する。
--
-- 【背景】
-- 管理画面には「メンバーの目標を削除」がある（app/admin/kpi/page.tsx:521）が、
-- DELETE ポリシーが user_id = auth.uid() のみだったため、他人の目標に対しては
-- 0 行削除で静かに失敗していた。supabase-js の .delete() は .select() を繋がない限り
-- 影響行を返さず、RLS で 0 行になっても error は null になるため、画面には
-- 「○○さんの目標を削除しました」と成功トーストが出ていた。
--
-- 【このマイグレーションの性質】
-- 20260814110000 / 20260814120000 のテナント分離が「閉じる方向」だったのに対し、
-- これは管理者に削除権限を与える「開く方向」の変更。範囲を DELETE 1本に限定する。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   create policy "personal_goals_delete" on public.personal_goals
--     for delete to authenticated
--     using (user_id = (select auth.uid()));
--
-- 【子行（goal_kpis）の扱い】
-- goal_kpis_goal_id_fkey は既に ON DELETE CASCADE。参照整合性アクションは
-- テーブル所有者権限で走り子テーブルの RLS を迂回するため、削除者本人が
-- goal_kpis_delete（user_id = auth.uid()）で消せない他人名義の子行も一緒に消える。
-- 実データで確認済みのため、孤児対策の追加実装は不要。
--
-- ※ auth.uid() は initplan 最適化のため必ず (select auth.uid()) でラップする（CLAUDE.md）。

drop policy if exists "personal_goals_delete" on public.personal_goals;
create policy "personal_goals_delete" on public.personal_goals
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = personal_goals.company_id
    )
  );

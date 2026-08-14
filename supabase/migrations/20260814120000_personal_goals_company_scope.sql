-- personal_goals の INSERT / UPDATE に会社スコープを追加する。
--
-- 【背景】
-- 既存ポリシーは user_id しか見ておらず、自分名義のまま他社の company_id を
-- 差し込んだ目標を作れる（作った本人と、その他社の管理者にだけ見える行ができる）。
-- 20260814110000 で goal_kpis を塞いだのと同じクラスの穴。
--
-- 【このマイグレーションの範囲】
-- テナント分離のみ。プラン条件は Phase 3 で別途載せる。
-- SELECT / DELETE は変更しない（下の「変更しないもの」参照）。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   create policy "personal_goals_insert" on public.personal_goals
--     for insert to authenticated
--     with check (user_id = (select auth.uid()));
--   create policy "personal_goals_update" on public.personal_goals
--     for update to authenticated
--     using (user_id = (select auth.uid()));   -- with check は無し
--
-- 【アクセスパターンの実測結果】
--   portal/kpi/page.tsx   INSERT company_id=自社 / user_id=self（:445 付近）
--                         UPDATE 自分の目標のタイトル（:437, :501）
--   portal/page.tsx       SELECT 自分の目標（:487）
--   admin/kpi/page.tsx    SELECT company_id=X（全メンバー分・:258, :463）
--                         DELETE メンバーの目標（:521）★下記の既知の不具合を参照
--   superadmin company-view   service_role のため RLS を迂回（影響なし）
--
-- 【変更しないもの】
--   SELECT: 既に「本人 or 自社管理者」で正しくスコープされている。
--   DELETE: 現在 user_id = auth.uid() のみ。admin/kpi:521 の「メンバーの目標を削除」は
--           この条件に一致せず 0 行削除で静かに失敗する（Supabase は 0 行 delete を
--           エラーにしないため、画面には成功トーストが出る）。プラン制限とは無関係の
--           既存不具合であり、直すと管理者に削除権限を与える挙動変更になるため、
--           このマイグレーションには含めず別途判断する。
--
-- ※ auth.uid() は initplan 最適化のため必ず (select auth.uid()) でラップする（CLAUDE.md）。

-- 自分名義かつ自分の所属会社の目標しか作れない
drop policy if exists "personal_goals_insert" on public.personal_goals;
create policy "personal_goals_insert" on public.personal_goals
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
  );

-- 自分の行のみ。WITH CHECK が無かったため、更新で他社・他人へ付け替えられた
drop policy if exists "personal_goals_update" on public.personal_goals;
create policy "personal_goals_update" on public.personal_goals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
  );

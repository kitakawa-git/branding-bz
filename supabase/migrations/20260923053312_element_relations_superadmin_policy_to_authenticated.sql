-- element_relations_superadmin_all の対象ロールを PUBLIC → authenticated に絞る。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   20260609020724_create_element_relations で作成（ロール指定なし＝PUBLIC）:
--   CREATE POLICY element_relations_superadmin_all ON public.element_relations
--     FOR ALL USING (public.is_current_user_superadmin())
--     WITH CHECK (public.is_current_user_superadmin());
--
-- 【理由】
-- 20260923053239 で USING (true) の公開 SELECT を外したところ、anon の SELECT が 0件ではなく
-- 「permission denied for function is_current_user_superadmin」で落ちるようになった。
-- このポリシーは PUBLIC 向けなので anon でも評価され、anon は is_current_user_superadmin() の
-- EXECUTE を持たない（20260608061829 で外した）。これまでは USING (true) のポリシーと OR で
-- 結ばれて関数まで評価されず、表に出ていなかった。
-- superadmin は必ずログインしているので、authenticated に絞っても失うものは無い。

alter policy "element_relations_superadmin_all" on public.element_relations to authenticated;

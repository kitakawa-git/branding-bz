-- element_relations の SELECT を「自社の管理者・メンバーだけ」に絞る。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   20260609020724_create_element_relations で作成:
--   CREATE POLICY element_relations_public_select ON public.element_relations
--     FOR SELECT USING (true);
--
-- 【背景】
-- anon を含む誰でも全社の関係グラフ（42行・3社）を読めた。作成時は philosophy_elements と
-- 同じ「公開SELECT」方針にしていたが、実際に未ログインで読む経路は無い。
-- しかもこの表の target_id が、20260923051726 で塞いだ bump_de_evidence_version の
-- 悪用に必要な証拠 ID の入手経路になっていた。
--
-- 【アクセスパターンの実測結果（2026-09-23）】
--   未ログインの経路（/card/[slug]・/wiki・(site)・(marketing)・/tools の LP）… 参照なし
--   superadmin 画面（企業詳細のオントロジー各セクション）… ブラウザの authenticated で読む
--     → element_relations_superadmin_all で従来どおり読める
--   API / lib（関係グラフの注入・整合性チェック・AI草案・関係スキャン・マップレビュー・
--     トーン規則・未来設計・コピーAI）… すべて getSupabaseAdmin()（service_role）で RLS を迂回
--   DB 内の参照（cleanup_element_relations_on_delete / validate_element_relation_endpoints /
--     trg_pp_bump / trg_ppm_bump）… すべて SECURITY DEFINER。ビューは無し
--
-- 【新ポリシー】
-- 自社の admin_users または members に居る人だけが読める（テナント分離の他の修正と同じ形）。
-- 管理者の UPDATE / DELETE（element_relations_admin_*）は、対象行が SELECT で見えることが
-- 前提なので、管理者が自社の行を読めることは書き込みのためにも必要。
-- auth.uid() は initplan 最適化のため (select auth.uid()) で包む（CLAUDE.md）。
--
-- 【適用後の実測】anon 0件／デモ企業の管理者・メンバー 2件（自社のみ）／superadmin 42件／service_role 42件。
-- ※ 同日の 20260923053312 とセットで適用すること（superadmin ポリシーを authenticated に絞らないと、
--    anon の SELECT が 0件ではなく権限エラーになる）。

drop policy if exists "element_relations_public_select" on public.element_relations;

create policy "element_relations_select_own_company" on public.element_relations
  for select to authenticated
  using (
    company_id in (
      select admin_users.company_id from admin_users
       where admin_users.auth_id = (select auth.uid())
    )
    or company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
  );

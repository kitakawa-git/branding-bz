-- goal_kpis / goal_periods のテナント分離漏れを修正する。
--
-- 【背景】
-- 両テーブルの RLS は `auth_all`（USING true / WITH CHECK true）1本だけで、
-- ログインさえしていれば他社の目標・KPI を読み書きできる状態だった。
-- company_id の絞り込みはアプリ側の .eq('company_id', companyId) に依存しており、
-- DB では守られていない。実顧客候補（株式会社C&S）が入り始めたため先行して修正する。
--
-- 【このマイグレーションの範囲】
-- テナント分離のみ。プラン条件（timeline / announcements 等のゲート）は Phase 3 で別途載せる。
--
-- 【差し替え前の旧ポリシー定義（ロールバック時の参照用）】
--   create policy "auth_all" on public.goal_kpis
--     for all to authenticated using (true) with check (true);
--   create policy "auth_all" on public.goal_periods
--     for all to authenticated using (true) with check (true);
--
-- 【設計の根拠（アクセスパターンの実測結果）】
--   goal_kpis
--     portal/kpi/page.tsx      SELECT company_id=X AND user_id=self
--                              INSERT user_id=self / UPDATE 自分の行 / DELETE 自分の行
--     portal/page.tsx          UPDATE 自己評価で自分の progress
--     admin/kpi/page.tsx       SELECT のみ（company_id=X ＝ 全メンバー分）★管理者は他人の行も読む
--   goal_periods
--     portal/kpi/page.tsx      SELECT のみ（company_id=X）★メンバーも読む
--     admin/kpi/page.tsx       SELECT / INSERT / UPDATE ★書くのは管理者だけ
--   superadmin company-view    service_role のため RLS を迂回（影響なし）
--
--   → goal_kpis は同じ画面の兄弟テーブル personal_goals と同じ形にする
--     （本人は自分の行、管理者は自社の全行）。
--     ただし personal_goals の INSERT は user_id しか見ておらず、他社の company_id を
--     差し込めてしまうため、こちらでは会社スコープも WITH CHECK に入れる。
--   → goal_periods は会社共有のデータなので、読みは自社メンバー全員、
--     書きは自社管理者のみに限定する。
--
-- ※ auth.uid() は initplan 最適化のため必ず (select auth.uid()) でラップする（CLAUDE.md）。

-- ============================================================
-- goal_kpis
-- ============================================================
drop policy if exists "auth_all" on public.goal_kpis;

-- 本人は自分の KPI、管理者は自社の全 KPI を読める（admin/kpi の一覧が全メンバー分を出すため）
create policy "goal_kpis_select" on public.goal_kpis
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_kpis.company_id
    )
  );

-- 自分名義かつ自分の所属会社の行しか作れない
create policy "goal_kpis_insert" on public.goal_kpis
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
  );

-- 自分の行のみ。WITH CHECK も付けて、他社・他人へ付け替えられないようにする
create policy "goal_kpis_update" on public.goal_kpis
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
  );

-- 自分の行のみ。portal/kpi の delete().eq('goal_id', …) は
-- 自分の personal_goals に紐づく行だけを消すので、この条件で壊れない
create policy "goal_kpis_delete" on public.goal_kpis
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================
-- goal_periods（会社共有。読みは全メンバー、書きは管理者のみ）
-- ============================================================
drop policy if exists "auth_all" on public.goal_periods;

create policy "goal_periods_select" on public.goal_periods
  for select to authenticated
  using (
    company_id in (
      select members.company_id from members
       where members.auth_id = (select auth.uid())
    )
    or exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  );

create policy "goal_periods_insert" on public.goal_periods
  for insert to authenticated
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  );

create policy "goal_periods_update" on public.goal_periods
  for update to authenticated
  using (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  )
  with check (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  );

-- 現状 delete するコードは無いが、無いと将来詰まるので管理者のみで開けておく
create policy "goal_periods_delete" on public.goal_periods
  for delete to authenticated
  using (
    exists (
      select 1 from admin_users
       where admin_users.auth_id = (select auth.uid())
         and admin_users.company_id = goal_periods.company_id
    )
  );

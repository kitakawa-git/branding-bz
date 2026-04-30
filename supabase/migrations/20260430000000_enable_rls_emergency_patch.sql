-- ============================================================
-- RLS緊急対応 Step 1: 未認証ユーザーからの書き込み遮断
-- ============================================================
-- 目的:
--   1. Supabase Advisor の rls_disabled_in_public /
--      sensitive_columns_exposed ERROR を解消する
--   2. 未認証 (anon) ロールからの破壊的書き込みを遮断する
--   3. 既存アプリ (anon JWT を持つ認証ユーザー) を壊さない
--
-- 注意:
--   "auth_*" 系のポリシーは authenticated 全許可 (USING true) で
--   テナント境界を担保しない暫定実装。Step 3 で auth.uid()/company_id
--   ベースの細かいポリシーに置き換える。Step 3 移行時は本ファイルで
--   作成したポリシー (public_select / auth_write_* / anon_insert /
--   auth_select / auth_update / auth_delete / auth_all) を名前で
--   識別して DROP すること。
--
-- 対象外 (既に RLS 有効 / Advisor ERROR 対象でない):
--   - brand_guidelines, brand_visuals, brand_personalities,
--     brand_terms, brand_personas (より厳格なテナント境界ポリシー設定済)
--   - contact_inquiries (anon INSERT + superadmin SELECT 設定済)
--   - members, invite_links, timeline_*, announcement*,
--     personal_goals (RLS有効・別途設計済)
--
-- 対象外 (テーブル不在):
--   - brand_score_schedules: 本番DBに未作成
--     (supabase/migrations/20260312_add_brand_score_schedules.sql 未適用)
--     Cron Job /api/cron/brand-score-snapshot と
--     /api/brand-score/schedule は本番で既に動いていない可能性。
--     Step 1 対象外。別途対応要。
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 関数の search_path 修正 (Advisor function_search_path_mutable)
-- ------------------------------------------------------------
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;


-- ============================================================
-- 分類1: 公開ページ用テーブル (3 tables)
--   anon SELECT 許可 / authenticated 書き込み全許可
--
--   - profiles: /card/[slug] で未認証ユーザーが SELECT
--   - companies: /card/[slug] で未認証ユーザーが JOIN SELECT
--   - news:     /(marketing)/news で未認証ユーザーが SELECT
-- ============================================================

-- profiles ----------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_write_update" ON public.profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_delete" ON public.profiles
  FOR DELETE TO authenticated USING (true);

-- companies ---------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON public.companies
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_insert" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_write_update" ON public.companies
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_delete" ON public.companies
  FOR DELETE TO authenticated USING (true);

-- news --------------------------------------------------------
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON public.news
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_insert" ON public.news
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_write_update" ON public.news
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_delete" ON public.news
  FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 分類2: 匿名書き込み受付テーブル (6 tables)
--   anon INSERT 許可 / SELECT/UPDATE/DELETE は authenticated 限定
--
--   - card_events, card_views, brand_page_views, brand_micro_feedbacks:
--     /card/[slug] と /brand/* から匿名POSTで記録
--   - brand_survey_responses, survey_participants:
--     匿名サーベイ回答リンクから匿名POSTで記録 (重要)
-- ============================================================

-- card_events -------------------------------------------------
ALTER TABLE public.card_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.card_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.card_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.card_events
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.card_events
  FOR DELETE TO authenticated USING (true);

-- card_views --------------------------------------------------
ALTER TABLE public.card_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.card_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.card_views
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.card_views
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.card_views
  FOR DELETE TO authenticated USING (true);

-- brand_page_views --------------------------------------------
ALTER TABLE public.brand_page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.brand_page_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.brand_page_views
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.brand_page_views
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.brand_page_views
  FOR DELETE TO authenticated USING (true);

-- brand_micro_feedbacks ---------------------------------------
ALTER TABLE public.brand_micro_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.brand_micro_feedbacks
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.brand_micro_feedbacks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.brand_micro_feedbacks
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.brand_micro_feedbacks
  FOR DELETE TO authenticated USING (true);

-- brand_survey_responses --------------------------------------
ALTER TABLE public.brand_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.brand_survey_responses
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.brand_survey_responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.brand_survey_responses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.brand_survey_responses
  FOR DELETE TO authenticated USING (true);

-- survey_participants -----------------------------------------
ALTER TABLE public.survey_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.survey_participants
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth_select" ON public.survey_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update" ON public.survey_participants
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete" ON public.survey_participants
  FOR DELETE TO authenticated USING (true);


-- ============================================================
-- 分類3: 管理画面専用テーブル (11 tables)
--   全操作 authenticated 限定で全許可 / anon 完全遮断
--
--   既存の admin_users 既存ポリシー
--   ("ログインユーザーは自分のレコードを閲覧可能") は維持
-- ============================================================

-- admin_users -------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.admin_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_values ------------------------------------------------
ALTER TABLE public.brand_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_values
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_surveys -----------------------------------------------
ALTER TABLE public.brand_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_surveys
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_survey_questions --------------------------------------
ALTER TABLE public.brand_survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_survey_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_personality_tag_mappings ------------------------------
ALTER TABLE public.brand_personality_tag_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_personality_tag_mappings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_score_snapshots ---------------------------------------
ALTER TABLE public.brand_score_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_score_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mini_app_sessions -------------------------------------------
ALTER TABLE public.mini_app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.mini_app_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- mini_app_conversations --------------------------------------
ALTER TABLE public.mini_app_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.mini_app_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- brand_color_projects ----------------------------------------
ALTER TABLE public.brand_color_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.brand_color_projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- goal_kpis ---------------------------------------------------
ALTER TABLE public.goal_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.goal_kpis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- goal_periods ------------------------------------------------
ALTER TABLE public.goal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.goal_periods
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

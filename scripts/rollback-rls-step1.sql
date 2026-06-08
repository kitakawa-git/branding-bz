-- ============================================================
-- RLS緊急対応 Step 1 — 完全ロールバック SQL
-- ============================================================
-- 用途:
--   本番適用後に問題が発覚した場合、20260430000000_enable_rls_emergency_patch.sql
--   が加えた変更を打ち消し、本番を Step 1 適用前の状態に戻す。
--
-- 影響:
--   - 47 ポリシーを DROP
--   - 20 テーブルの RLS を DISABLE
--   - update_updated_at() の search_path 設定をリセット
--   → Supabase Advisor の rls_disabled_in_public / sensitive_columns_exposed
--      ERROR が再び 22 件 + 2 件 復活する状態に戻る
--
-- 適用前チェック:
--   - 本番DB のバックアップを取得済みであること
--   - Vercel デプロイは前バージョンに revert 済みであること
--     (service_role を呼ぶ API Route が anon に戻っていないと、ロールバック後に
--      RLS なしで anon キー経由のアクセスが復活する)
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor で本ファイル全文を貼り付けて実行
--   または Supabase MCP の apply_migration から
--
-- 安全装置:
--   各 DROP は IF EXISTS / IF EXISTS 相当で書く (DROP POLICY IF EXISTS)
--   → 既に手動で一部 DROP していた場合でもエラーで止まらない
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────
-- 1. 分類1 (公開ページ用) のポリシー DROP + RLS DISABLE
--    対象: profiles, companies, news
-- ────────────────────────────────────────────

DROP POLICY IF EXISTS "public_select" ON public.profiles;
DROP POLICY IF EXISTS "auth_write_insert" ON public.profiles;
DROP POLICY IF EXISTS "auth_write_update" ON public.profiles;
DROP POLICY IF EXISTS "auth_write_delete" ON public.profiles;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select" ON public.companies;
DROP POLICY IF EXISTS "auth_write_insert" ON public.companies;
DROP POLICY IF EXISTS "auth_write_update" ON public.companies;
DROP POLICY IF EXISTS "auth_write_delete" ON public.companies;
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select" ON public.news;
DROP POLICY IF EXISTS "auth_write_insert" ON public.news;
DROP POLICY IF EXISTS "auth_write_update" ON public.news;
DROP POLICY IF EXISTS "auth_write_delete" ON public.news;
ALTER TABLE public.news DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────
-- 2. 分類2 (匿名 INSERT 受付) のポリシー DROP + RLS DISABLE
--    対象: card_events, card_views, brand_page_views,
--          brand_micro_feedbacks, brand_survey_responses,
--          survey_participants
-- ────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_insert" ON public.card_events;
DROP POLICY IF EXISTS "auth_select" ON public.card_events;
DROP POLICY IF EXISTS "auth_update" ON public.card_events;
DROP POLICY IF EXISTS "auth_delete" ON public.card_events;
ALTER TABLE public.card_events DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.card_views;
DROP POLICY IF EXISTS "auth_select" ON public.card_views;
DROP POLICY IF EXISTS "auth_update" ON public.card_views;
DROP POLICY IF EXISTS "auth_delete" ON public.card_views;
ALTER TABLE public.card_views DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.brand_page_views;
DROP POLICY IF EXISTS "auth_select" ON public.brand_page_views;
DROP POLICY IF EXISTS "auth_update" ON public.brand_page_views;
DROP POLICY IF EXISTS "auth_delete" ON public.brand_page_views;
ALTER TABLE public.brand_page_views DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.brand_micro_feedbacks;
DROP POLICY IF EXISTS "auth_select" ON public.brand_micro_feedbacks;
DROP POLICY IF EXISTS "auth_update" ON public.brand_micro_feedbacks;
DROP POLICY IF EXISTS "auth_delete" ON public.brand_micro_feedbacks;
ALTER TABLE public.brand_micro_feedbacks DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.brand_survey_responses;
DROP POLICY IF EXISTS "auth_select" ON public.brand_survey_responses;
DROP POLICY IF EXISTS "auth_update" ON public.brand_survey_responses;
DROP POLICY IF EXISTS "auth_delete" ON public.brand_survey_responses;
ALTER TABLE public.brand_survey_responses DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.survey_participants;
DROP POLICY IF EXISTS "auth_select" ON public.survey_participants;
DROP POLICY IF EXISTS "auth_update" ON public.survey_participants;
DROP POLICY IF EXISTS "auth_delete" ON public.survey_participants;
ALTER TABLE public.survey_participants DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────
-- 3. 分類3 (管理画面専用) のポリシー DROP + RLS DISABLE
--    対象: admin_users, value_propositions, brand_surveys,
--          brand_survey_questions, brand_personality_tag_mappings,
--          brand_score_snapshots, mini_app_sessions,
--          mini_app_conversations, brand_color_projects,
--          goal_kpis, goal_periods
-- ────────────────────────────────────────────

DROP POLICY IF EXISTS "auth_all" ON public.admin_users;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.value_propositions;
ALTER TABLE public.value_propositions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.brand_surveys;
ALTER TABLE public.brand_surveys DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.brand_survey_questions;
ALTER TABLE public.brand_survey_questions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.brand_personality_tag_mappings;
ALTER TABLE public.brand_personality_tag_mappings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.brand_score_snapshots;
ALTER TABLE public.brand_score_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.mini_app_sessions;
ALTER TABLE public.mini_app_sessions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.mini_app_conversations;
ALTER TABLE public.mini_app_conversations DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.brand_color_projects;
ALTER TABLE public.brand_color_projects DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.goal_kpis;
ALTER TABLE public.goal_kpis DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.goal_periods;
ALTER TABLE public.goal_periods DISABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────
-- 4. update_updated_at() の search_path リセット
--    (Step 1 適用時に SET search_path = public, pg_temp としたものを解除)
-- ────────────────────────────────────────────

ALTER FUNCTION public.update_updated_at() RESET search_path;

-- ────────────────────────────────────────────
-- 5. 検証クエリ (実行後に手動で確認)
-- ────────────────────────────────────────────
-- 以下を SQL Editor で個別に実行して、ロールバック完了を確認:
--
-- -- 20 テーブルの RLS が全て無効に戻ったか
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public' AND tablename IN (
--   'profiles','companies','news',
--   'card_events','card_views','brand_page_views','brand_micro_feedbacks',
--   'brand_survey_responses','survey_participants',
--   'admin_users','value_propositions','brand_surveys','brand_survey_questions',
--   'brand_personality_tag_mappings','brand_score_snapshots',
--   'mini_app_sessions','mini_app_conversations','brand_color_projects',
--   'goal_kpis','goal_periods'
-- ) ORDER BY tablename;
-- → 全て rowsecurity=false なら成功
--
-- -- Step 1 で作成したポリシーが残っていないか
-- SELECT schemaname, tablename, policyname FROM pg_policies
-- WHERE schemaname='public'
--   AND policyname IN ('public_select','auth_write_insert','auth_write_update',
--                       'auth_write_delete','anon_insert','auth_select',
--                       'auth_update','auth_delete','auth_all')
-- ORDER BY tablename, policyname;
-- → 0 行なら成功

COMMIT;

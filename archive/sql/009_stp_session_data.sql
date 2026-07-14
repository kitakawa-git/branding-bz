-- ============================================
-- 009: STP分析ツール用 session_data カラム追加
-- mini_app_sessions に JSONB カラムを追加
-- STP分析の全ステップデータを格納
-- ============================================

ALTER TABLE mini_app_sessions
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}';

COMMENT ON COLUMN mini_app_sessions.session_data IS 'STP分析等のミニアプリで使用するステップデータ全体を格納するJSONBカラム';

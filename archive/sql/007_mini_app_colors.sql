-- ============================================
-- 007: ミニアプリ基盤 + ブランドカラー定義ツール
-- ============================================

-- ============================================
-- ミニアプリ共通テーブル（将来の他ミニアプリでも再利用）
-- ============================================

CREATE TABLE IF NOT EXISTS mini_app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,              -- auth.users(id) を参照
  app_type VARCHAR(50) NOT NULL,      -- 'brand_colors' | 'mvv_generator' | 'copy_ai' 等
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',  -- 'in_progress' | 'completed' | 'abandoned'
  current_step INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  company_id UUID,                    -- 本体連携済みの場合（companies.id）
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_app_sessions_user ON mini_app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mini_app_sessions_type ON mini_app_sessions(app_type);
CREATE INDEX IF NOT EXISTS idx_mini_app_sessions_status ON mini_app_sessions(status);

-- ============================================
-- ブランドカラー定義ツール固有テーブル
-- ============================================

CREATE TABLE IF NOT EXISTS brand_color_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES mini_app_sessions(id) ON DELETE CASCADE,

  -- Step 1: 基本情報
  brand_name VARCHAR(100),
  industry_category VARCHAR(50),
  industry_subcategory VARCHAR(50),
  brand_stage VARCHAR(20),              -- 'new' | 'rebrand'
  existing_colors JSONB DEFAULT '[]',   -- [{hex: "#xxx"}]
  competitor_colors JSONB DEFAULT '[]', -- [{name: "xxx", hex: "#xxx"}]

  -- Step 2: イメージ入力
  approach_type VARCHAR(20),            -- 'keyword' | 'moodboard'
  keywords JSONB DEFAULT '[]',          -- [{word: "xxx", priority: 1}]
  moodboard_choices JSONB DEFAULT '[]', -- [{pairId: "pair_1", choice: "A"}]
  avoid_colors JSONB DEFAULT '[]',      -- ["#xxx"]
  reference_brands JSONB DEFAULT '[]',  -- ["xxx"]

  -- Step 3: AI提案
  proposals JSONB DEFAULT '[]',         -- PaletteProposal[]
  selected_proposal_id VARCHAR(50),

  -- Step 4: 調整
  current_palette JSONB,                -- 現在編集中のパレット
  adjustment_count INT DEFAULT 0,       -- 調整回数（Free制限用）

  -- Step 5: 確定
  final_palette JSONB,                  -- 確定版パレット
  exported_formats JSONB DEFAULT '[]',  -- ["pdf", "css", "brandconnect"]
  linked_to_brandconnect BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_color_projects_session ON brand_color_projects(session_id);

-- ============================================
-- AI会話履歴（ミニアプリ共通）
-- ============================================

CREATE TABLE IF NOT EXISTS mini_app_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES mini_app_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,            -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',          -- パレット変更差分等
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_app_conversations_session ON mini_app_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_app_conversations_created ON mini_app_conversations(created_at);

-- ============================================
-- updated_at 自動更新トリガー
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーが既に存在する場合はスキップ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_mini_app_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_mini_app_sessions_updated_at
      BEFORE UPDATE ON mini_app_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_brand_color_projects_updated_at'
  ) THEN
    CREATE TRIGGER update_brand_color_projects_updated_at
      BEFORE UPDATE ON brand_color_projects
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$$;

-- ============================================
-- brand_visuals に連携元情報を追加
-- ============================================

ALTER TABLE brand_visuals
  ADD COLUMN IF NOT EXISTS color_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS color_source_session_id UUID;

-- ============================================
-- RLS ポリシー（本番前に有効化する）
-- 現在は全テーブル RLS 無効（002_disable_rls.sql による）
-- ============================================

/*
-- mini_app_sessions
ALTER TABLE mini_app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON mini_app_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON mini_app_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON mini_app_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- brand_color_projects
ALTER TABLE brand_color_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own color projects"
  ON brand_color_projects FOR ALL
  USING (
    session_id IN (
      SELECT id FROM mini_app_sessions WHERE user_id = auth.uid()
    )
  );

-- mini_app_conversations
ALTER TABLE mini_app_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON mini_app_conversations FOR ALL
  USING (
    session_id IN (
      SELECT id FROM mini_app_sessions WHERE user_id = auth.uid()
    )
  );
*/

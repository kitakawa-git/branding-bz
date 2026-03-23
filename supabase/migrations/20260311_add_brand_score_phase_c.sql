-- Phase C: マイクロフィードバック + 統合ダッシュボード

-- 1. brand_micro_feedbacks: 名刺閲覧者からの印象タグフィードバック
CREATE TABLE brand_micro_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  source_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  visitor_id text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_micro_feedbacks_company_created ON brand_micro_feedbacks (company_id, created_at);

-- 2. brand_personality_tag_mappings: 企業ごとの期待タグ設定
CREATE TABLE brand_personality_tag_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  tag text NOT NULL,
  is_expected boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, tag)
);

CREATE INDEX idx_tag_mappings_company ON brand_personality_tag_mappings (company_id);

-- 3. brand_score_snapshots: スコア時系列スナップショット
CREATE TABLE brand_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  period_days int DEFAULT 30,
  inner_score numeric,
  inner_why numeric,
  inner_how numeric,
  inner_what numeric,
  inner_survey_id uuid REFERENCES brand_surveys(id) ON DELETE SET NULL,
  inner_response_rate numeric,
  outer_score numeric,
  outer_reach numeric,
  outer_interest numeric,
  outer_transition numeric,
  outer_engagement numeric,
  outer_impression numeric,
  total_score numeric,
  rank text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_score_snapshots_company_date ON brand_score_snapshots (company_id, snapshot_date);

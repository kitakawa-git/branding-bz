-- brand_score_schedules: 企業ごとのスナップショット自動取得スケジュール
-- Cron Jobが next_snapshot_date <= now() の行を対象にスナップショットを保存する

CREATE TABLE brand_score_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  frequency text NOT NULL DEFAULT 'monthly',
  -- frequency の値: monthly, quarterly, semi_annual, annual
  anchor_date date NOT NULL DEFAULT CURRENT_DATE,
  next_snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_score_schedules_next ON brand_score_schedules (next_snapshot_date)
  WHERE enabled = true;

CREATE INDEX idx_score_schedules_company ON brand_score_schedules (company_id);

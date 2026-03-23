-- Phase B: インナーサーベイテーブル

-- 1. brand_surveys: サーベイマスター
CREATE TABLE brand_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  target_response_rate int DEFAULT 70,
  total_members int DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- status の値: draft, active, closed, archived
CREATE INDEX idx_brand_surveys_company ON brand_surveys (company_id, status);

-- 2. brand_survey_questions: 設問
CREATE TABLE brand_survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES brand_surveys(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  question_text text NOT NULL,
  source text NOT NULL DEFAULT 'template',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  reference_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
-- category の値: why, how, what
-- source の値: template, ai_generated, custom
CREATE INDEX idx_survey_questions_survey ON brand_survey_questions (survey_id, sort_order);

-- 3. brand_survey_responses: 回答（profile_idは意図的に含めない＝匿名性担保）
CREATE TABLE brand_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES brand_surveys(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES brand_survey_questions(id) ON DELETE CASCADE NOT NULL,
  score int NOT NULL CHECK (score >= 1 AND score <= 5),
  department text,
  role_category text,
  submitted_at timestamptz DEFAULT now()
);
-- role_category の値: executive, manager, staff
CREATE INDEX idx_survey_responses_survey_question ON brand_survey_responses (survey_id, question_id);
CREATE INDEX idx_survey_responses_survey_dept ON brand_survey_responses (survey_id, department);

-- 4. survey_participants: 回答済み管理（誰が回答したかは分かるが、どう回答したかは紐づかない設計）
CREATE TABLE survey_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES brand_surveys(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  responded_at timestamptz,
  reminded_at timestamptz,
  UNIQUE(survey_id, profile_id)
);
CREATE INDEX idx_survey_participants_survey ON survey_participants (survey_id, responded_at);

-- 回答者の識別子を追加する。
--
-- 背景:
--   brand_survey_responses は匿名設計で回答者を識別する列がない。
--   個人単位の集計（浸透段階の累積通過率）では回答者ごとにまとめる必要があるが、
--   これまで submitted_at を暫定キーにしていた。同一秒に複数人が提出すると
--   1人に統合され、人数が静かにずれるため、専用の列を持たせる。
--
-- 既存データの採番:
--   同一サーベイ内では submitted_at が回答者ごとに一意である前提で採番する。
--   ⚠ 一部の既存サーベイ（社内配信ぶん）は全回答行の submitted_at が同一で、
--     回答者を区別する情報がそもそも存在しない。それらは1人に潰れる。
--     元データの制約であり、どのキーを使っても復元できない。

ALTER TABLE brand_survey_responses
  ADD COLUMN IF NOT EXISTS respondent_id uuid;

COMMENT ON COLUMN brand_survey_responses.respondent_id IS
  '回答者の識別子。誰であるかは特定できない匿名ID。個人単位の集計に使う';

WITH grouped AS (
  SELECT survey_id, submitted_at, gen_random_uuid() AS rid
  FROM brand_survey_responses
  WHERE respondent_id IS NULL
  GROUP BY survey_id, submitted_at
)
UPDATE brand_survey_responses r
SET respondent_id = g.rid
FROM grouped g
WHERE r.survey_id = g.survey_id
  AND r.submitted_at = g.submitted_at
  AND r.respondent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent
  ON brand_survey_responses (survey_id, respondent_id);

-- Googleフォーム等で外部実施した調査結果を取り込むための列を追加する。
--
-- 背景:
--   インナースコアはこれまで自社サーベイ機能（配信 → survey_participants → 回答）
--   経由の回答しか想定していなかった。外部実施した調査を取り込む場合、
--   survey_participants が存在しないため回答率が常に 0% になってしまう。
--   回答者数を brand_surveys 側に持たせて分子として使えるようにする。
--
-- 注意:
--   brand_survey_responses は変更しない（回答者IDを持たない匿名設計を維持する）。

ALTER TABLE brand_surveys
  -- 'internal' = サービス上で配信した通常サーベイ / 'imported' = 外部調査の取り込み
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal',
  -- 取り込んだ実回答者数。回答率の分子（NULL なら survey_participants から算出する）
  ADD COLUMN IF NOT EXISTS respondent_count int;

COMMENT ON COLUMN brand_surveys.source IS '回答の由来: internal（サービス内配信） / imported（外部調査の取り込み）';
COMMENT ON COLUMN brand_surveys.respondent_count IS '取り込み時の実回答者数。回答率の分子。NULL の場合は survey_participants.responded_at から算出する';

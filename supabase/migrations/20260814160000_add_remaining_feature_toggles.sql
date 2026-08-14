-- 機能トグルを、プラン制限で🔒が付く全メニューに揃える。
--
-- 背景:
--   機能トグル（timeline / kpi / card / learning）は「この機能は使わない」を
--   表明する仕組みとして先に4本だけ作られた。その後プラン制限が入り、
--   サイドバーで🔒が付く項目は8つに増えたが、トグル側が追いついていない。
--   結果、お知らせ管理・サーベイ管理・市場調査・理解度テスト・CIマニュアル出力は
--   「使えないのに消せない」状態になっている。
--   アップセル面の「メニュー項目を非表示にする」導線を全画面で機能させるために揃える。
--
-- 既定値:
--   既存企業で機能が突然消えないよう DEFAULT true。
--   判定は全箇所 isFeatureEnabled()（`!== false` 方式）なので、
--   列が無い環境でも「有効」として扱われ安全側に倒れる。
--
-- 注意:
--   これは「表示するかどうか」の設定であって権限ではない。
--   使えるかどうかの判定は lib/billing/entitlements.ts（プラン）が正で、
--   このトグルはその手前で見た目を消すだけ。オフにしてもデータは削除されない。

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS announcements_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS survey_enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS market_survey_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiz_enabled          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ci_manual_enabled     boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN companies.announcements_enabled IS 'お知らせ配信の有効/無効。false で管理画面・ポータルの該当メニューとページを非表示にする（データは保持）';
COMMENT ON COLUMN companies.survey_enabled        IS 'インナーサーベイの有効/無効。false で管理画面のサーベイ管理とポータルのサーベイ結果を非表示にする（データは保持）';
COMMENT ON COLUMN companies.market_survey_enabled IS '市場調査の有効/無効。false で管理画面・ポータルの市場調査を非表示にする（データは保持）';
COMMENT ON COLUMN companies.quiz_enabled          IS 'ブランド理解度テストの有効/無効。false で管理画面の理解度テストを非表示にする（データは保持）';
COMMENT ON COLUMN companies.ci_manual_enabled     IS 'CIマニュアル出力の有効/無効。false で管理画面の該当メニューとページを非表示にする（ブランドデータは保持）';

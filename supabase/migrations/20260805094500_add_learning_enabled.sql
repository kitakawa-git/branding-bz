-- ラーニング機能のオン/オフトグル列を追加する。
--
-- 背景:
--   timeline_enabled / kpi_enabled / card_enabled と同じ仕組み。
--   企業ごとにラーニング機能を非表示にできるようにする。
--   オフにしても動画・カテゴリー・視聴履歴は削除されず、再オンで復活する。
--
-- 既定値:
--   既存企業で機能が突然消えないよう DEFAULT true。
--   判定は全箇所 isFeatureEnabled()（`!== false` 方式）なので、
--   仮に列が無い環境でも「有効」として扱われ安全側に倒れる。

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS learning_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN companies.learning_enabled IS 'ラーニング機能の有効/無効。false でポータル・管理画面の該当メニューとページを非表示にする（データは保持）';

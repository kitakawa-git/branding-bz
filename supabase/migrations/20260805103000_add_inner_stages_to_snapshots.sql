-- 浸透段階ごとのインナースコアをスナップショットに保存する列を追加する。
--
-- 背景:
--   brand_score_snapshots は inner_why / inner_how / inner_what の3列しかなく、
--   認知→理解→共感→行動→推奨の5段階を入れる場所がない。
--   年次比較を段階単位で行うために jsonb で持たせる。
--
-- 形式:
--   {"awareness":59.3,"understanding":57.1,"empathy":71.6,
--    "behavior":61.6,"advocacy":57.8,"environment":62.0}
--   段階が解決できないサーベイでは NULL のままにする。

ALTER TABLE brand_score_snapshots
  ADD COLUMN IF NOT EXISTS inner_stages jsonb;

COMMENT ON COLUMN brand_score_snapshots.inner_stages IS
  '浸透段階ごとのインナースコア。{"awareness":59.3,...,"environment":62.0} 形式。段階未設定のサーベイでは NULL';

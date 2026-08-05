-- 印象一致度（市場が重視する点 × 自社イメージ）を調査ごとに保存する。
--
-- 毎回GT表のセル（1調査で1600件超）を読み直して計算するのは重いので、
-- 段階スコアと同じく「取り込み・自動割り当てのときに計算して保存」する方式に揃える。
-- 5段階のスコア（market_survey_stage_scores）は定点観測の基準なので、
-- ここは別カラムにして混ぜない。

alter table market_surveys
  add column if not exists impression_score numeric,
  add column if not exists impression_detail jsonb;

comment on column market_surveys.impression_score is
  '印象一致度 0-100。市場の重視トップ5のうち自社イメージでも上位に入る数。算出できなければ null';
comment on column market_surveys.impression_detail is
  '印象一致度の内訳（hits/misses/overs/matches）。画面の説明に使う';

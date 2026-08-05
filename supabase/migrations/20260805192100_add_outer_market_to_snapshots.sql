-- アウタースコアを2本立てにするための列追加。
--
--   outer_market  … 市場浸透（外部調査の5段階スコアの平均）
--   outer_digital … デジタル接点（名刺・ブランドページのアクセスログ）
--
-- 従来の outer_score は実質デジタル接点だけの値だったので、その値を
-- outer_digital にも入れて過去との連続性を保つ。outer_score 自体は
-- 「調査を持つ企業でのみ」意味が変わる（市場浸透60%＋デジタル40%）。
-- 既存列は変更しない。加算のみなので既存挙動は不変。
alter table public.brand_score_snapshots
  add column if not exists outer_market numeric,
  add column if not exists outer_digital numeric,
  -- 段階ごとの市場浸透スコア。inner_stages と対になる
  add column if not exists outer_market_stages jsonb,
  add column if not exists outer_market_survey_id uuid
    references public.market_surveys(id) on delete set null;

comment on column public.brand_score_snapshots.outer_market is '市場浸透スコア（外部調査由来）。調査が無い企業は null';
comment on column public.brand_score_snapshots.outer_digital is 'デジタル接点スコア（名刺ログ由来）。従来の outer_score と同じ値';
comment on column public.brand_score_snapshots.outer_market_stages is '市場浸透の段階別スコア {"awareness":84.1,...}';

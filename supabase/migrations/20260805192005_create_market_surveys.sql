-- 外部の市場調査（ブランド認知度調査など）の取り込み。
-- ============================================================
-- アウタースコアはこれまでスマート名刺のアクセスログしか見ておらず、
-- 実際の市場での認知・利用の実態を反映できなかった。調査会社の GT 集計表
-- を取り込み、5段階ジャーニー（認知→想起→評価→利用→推奨）に割り当てる。
--
-- 設計の要点（実データ検証に基づく）:
--   * セル単位で持つ。マトリクス設問（行=企業／列=選択肢）があるため
--     「選択肢」単位では表現できない
--   * ベースNはセルごとに持つ。同一設問でも行によって母数が違う
--     （実例: 導入状況の設問でリィツ行170／はんだや行187）
--   * どの設問のどの値がどの指標かは自動判定せず、人がマッピングする。
--     設問構成は調査ごとに変わり、社名の表記ゆれもあるため
-- 新規テーブルの追加のみ。既存テーブルには触らないので既存挙動は不変。
-- ============================================================

-- ── 1. 調査メタ ─────────────────────────────
create table if not exists public.market_surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  -- 調査会社名（例: 電通マクロミルインサイト）
  research_firm text not null default '',
  fielded_from date,
  fielded_to date,
  -- 調査全体のサンプル数。設問ごとの母数は cells.base_n を見る
  sample_size int,
  source_file_name text not null default '',
  source_sheet_name text not null default '',
  -- draft: マッピング未完了でスコアに反映しない / active: 反映する / archived: 過年度
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  -- 段階スコアの変換パラメータ。既定値を後で変えても過去の調査の
  -- スコアが動かないよう、取り込み時点の値をここに凍結する
  stage_params jsonb not null default '{}'::jsonb,
  -- パース時の警告。何が読めなかったかを後から追えるように残す
  parse_warnings jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_market_surveys_company
  on public.market_surveys (company_id, fielded_to desc nulls last);

-- ── 2. ブロック（設問） ─────────────────────
create table if not exists public.market_survey_blocks (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.market_surveys(id) on delete cascade,
  -- 集計表内の識別子（PTable0015）。調査ごとに振り直されるので
  -- 年次比較のキーには使わない
  block_key text not null,
  block_index int not null,
  -- 設問コード（q3 / Nq3_T2B / BD11）。前年マッピングの引き継ぎ候補に使う
  question_code text not null default '',
  question_text text not null default '',
  answer_type text not null default 'unknown',
  answer_type_raw text not null default '',
  -- 全行で母数が揃っている場合のみ入る。揃わなければ null（cells 側を見る）
  block_base_n int,
  -- マトリクスの列定義 [{code,label}]。非マトリクスは null
  columns jsonb,
  -- 属性設問（性別・診療科など）の推定。除外はせずUIで畳むためのフラグ
  is_attribute boolean not null default false,
  source_row int,
  warnings jsonb not null default '[]'::jsonb,
  constraint market_survey_blocks_key_uk unique (survey_id, block_key)
);

create index if not exists idx_msb_survey
  on public.market_survey_blocks (survey_id, block_index);

-- ── 3. セル（行×列） ───────────────────────
create table if not exists public.market_survey_cells (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.market_survey_blocks(id) on delete cascade,
  -- 選択肢コード。NET行（「認知・計」等）と無回答行は null
  row_code text,
  row_label text not null default '',
  row_index int not null,
  -- マトリクスの列。非マトリクスは null
  col_code text,
  col_label text,
  col_index int,
  -- パースできなかった値は null。0 にはしない（「未計測」と「0%」は別物）
  value numeric,
  value_raw text not null default '',
  -- この値の母数。行ごとに違うのでセル側に持つ
  base_n int,
  kind text not null default 'option' check (kind in ('option', 'net', 'no_answer')),
  source_row int
);

create index if not exists idx_msc_block
  on public.market_survey_cells (block_id, row_index, col_index);

-- ── 4. 指標マッピング（人が割り当てる） ─────
create table if not exists public.market_survey_stage_mappings (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.market_surveys(id) on delete cascade,
  stage text not null check (stage in ('awareness', 'recall', 'evaluation', 'usage', 'advocacy')),
  cell_id uuid not null references public.market_survey_cells(id) on delete cascade,
  -- 自社か競合か。競合はスコア本体には入れず、順位・トップとの差の算出にだけ使う
  subject text not null default 'self' check (subject in ('self', 'competitor')),
  competitor_name text,
  -- 1段階に複数セルを割り当てたときの加重平均の重み
  weight numeric not null default 1 check (weight > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint market_survey_stage_mappings_uk unique (survey_id, stage, cell_id)
);

create index if not exists idx_mssm_survey
  on public.market_survey_stage_mappings (survey_id, stage);

-- ── 5. 算出済みの段階スコア ─────────────────
create table if not exists public.market_survey_stage_scores (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.market_surveys(id) on delete cascade,
  stage text not null check (stage in ('awareness', 'recall', 'evaluation', 'usage', 'advocacy')),
  -- scored: 算出済み / absent: この調査に該当設問が無いと人が明示 / unmapped: 未割当
  -- absent と unmapped を区別しないと「未計測」を0点として扱ってしまう
  status text not null default 'unmapped' check (status in ('scored', 'absent', 'unmapped')),
  raw_percent numeric,
  score numeric,
  -- 変換方法 {"kind":"linear","mid":50,"max":90}
  method jsonb not null default '{}'::jsonb,
  -- 競合との比較 {"competitorMax":85,"competitorAvg":24.1,"rank":2,"n":10}
  benchmark jsonb,
  base_n int,
  computed_at timestamptz not null default now(),
  constraint market_survey_stage_scores_uk unique (survey_id, stage)
);

-- ── RLS ─────────────────────────────────────
-- metric_definitions と同じ会社スコープ方式。
-- 書き込みは service_role のみを想定するため insert/update ポリシーは作らない。
-- （既存 brand_* 系の auth_all はテナント分離が無く他社のデータを読めてしまう
--   既知の負債。新規テーブルでは踏襲しない）

alter table public.market_surveys enable row level security;
alter table public.market_survey_blocks enable row level security;
alter table public.market_survey_cells enable row level security;
alter table public.market_survey_stage_mappings enable row level security;
alter table public.market_survey_stage_scores enable row level security;

create policy market_surveys_superadmin_all on public.market_surveys
  for all
  using (exists (select 1 from public.admin_users a where a.auth_id = (select auth.uid()) and a.is_superadmin = true))
  with check (exists (select 1 from public.admin_users a where a.auth_id = (select auth.uid()) and a.is_superadmin = true));

create policy market_surveys_select on public.market_surveys
  for select
  using (
    company_id in (
      select company_id from public.admin_users where auth_id = (select auth.uid())
      union
      select company_id from public.members where auth_id = (select auth.uid())
    )
  );

-- 子テーブルは親の company_id をたどって判定する
create policy market_survey_blocks_select on public.market_survey_blocks
  for select
  using (
    survey_id in (
      select id from public.market_surveys s
      where s.company_id in (
        select company_id from public.admin_users where auth_id = (select auth.uid())
        union
        select company_id from public.members where auth_id = (select auth.uid())
      )
    )
  );

create policy market_survey_cells_select on public.market_survey_cells
  for select
  using (
    block_id in (
      select b.id from public.market_survey_blocks b
      join public.market_surveys s on s.id = b.survey_id
      where s.company_id in (
        select company_id from public.admin_users where auth_id = (select auth.uid())
        union
        select company_id from public.members where auth_id = (select auth.uid())
      )
    )
  );

create policy market_survey_stage_mappings_select on public.market_survey_stage_mappings
  for select
  using (
    survey_id in (
      select id from public.market_surveys s
      where s.company_id in (
        select company_id from public.admin_users where auth_id = (select auth.uid())
        union
        select company_id from public.members where auth_id = (select auth.uid())
      )
    )
  );

create policy market_survey_stage_scores_select on public.market_survey_stage_scores
  for select
  using (
    survey_id in (
      select id from public.market_surveys s
      where s.company_id in (
        select company_id from public.admin_users where auth_id = (select auth.uid())
        union
        select company_id from public.members where auth_id = (select auth.uid())
      )
    )
  );

comment on table public.market_surveys is '外部の市場調査。GT集計表を取り込んだもの';
comment on column public.market_survey_cells.base_n is 'この値の母数。同一設問でも行によって違うためセル側に持つ';
comment on column public.market_survey_stage_scores.status is 'absent（調査に該当設問が無い）と unmapped（未割当）を区別する。0点として扱わないため';

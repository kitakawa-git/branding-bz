-- ============================================================
-- バリュー評価レイヤー 評価軸マスター テーブル 2種
-- ============================================================
-- 背景:
--   ブランド方針（brand_guidelines.values）のバリュー＝行動規範を「評価軸」に変換し、
--   人事評価のたたき台（1〜5段階の行動記述で測れる評価項目）を作る。
--   ※ 提供価値（brand_values／顧客起点）は評価軸の起点にしない。
--
-- 設計方針:
--   既存の理解度テスト（brand_quizzes / brand_quiz_questions）と同型。
--   - evaluation_sheets    ≒ brand_quizzes      （評価軸マスターの親）
--   - evaluation_criteria  ≒ brand_quiz_questions（評価項目）
--   実アクセスは全て service_role の API Route（getSupabaseAdmin()）経由で、
--   セッション由来 company_id でガードする。
--
-- 適用後に必ず実行:
--   NOTIFY pgrst, 'reload schema';
--   （新規テーブルが PostgREST スキーマキャッシュに乗らず PGRST204 になる
--    既知の罠を回避するため）
-- ============================================================

-- 1. evaluation_sheets : 評価軸マスターの親（≒ brand_quizzes）
create table if not exists public.evaluation_sheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null default 'バリュー評価シート',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  version int not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_evaluation_sheets_company
  on public.evaluation_sheets (company_id, status);

-- 2. evaluation_criteria : 評価項目（≒ brand_quiz_questions）
create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.evaluation_sheets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null default 'value'
    check (source_type in ('value','action_guideline','custom')),
  source_id uuid,                                  -- 由来バリュー等のid（プロベナンス。再保存で揺れ得るため弱リンク）
  title text not null,                             -- 評価項目名（バリュー名など）
  description text,                                -- 項目の説明
  levels jsonb not null default '[]'::jsonb,       -- [{ "level":1, "description":"" }, ... 常に5要素]
  weight numeric not null default 1,               -- 重み（任意）
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_evaluation_criteria_sheet
  on public.evaluation_criteria (sheet_id, sort_order);
create index if not exists idx_evaluation_criteria_company
  on public.evaluation_criteria (company_id);

-- ============================================================
-- RLS
-- ============================================================
-- 方針: 有効化のみ・ポリシー無し（deny-all）。
--   読み書きは service_role の API Route のみが行い、service_role は RLS を
--   バイパスする。authenticated/anon からの直接アクセスは一切想定しない
--   （learning_* と同方針。brand_quiz_* の auth_all より厳格）。
-- ============================================================
alter table public.evaluation_sheets   enable row level security;
alter table public.evaluation_criteria enable row level security;

-- PostgREST スキーマキャッシュ再読込（PGRST204 回避）
notify pgrst, 'reload schema';

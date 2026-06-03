-- ============================================================
-- ブランド理解度テスト（記名式）専用テーブル 4種
-- ============================================================
-- 背景:
--   インナー計測の3計測器（サーベイ=共感 / テスト=知識 / アウター行動=体現）
--   のうち「テスト=知識」を担う記名式テスト。Premium専用機能。
--
-- 重要:
--   サーベイの匿名回答テーブル（brand_survey_responses）とは絶対に混ぜない。
--   テストは記名式（profile_id を持つ）。匿名前提テーブルとの事故防止のため
--   専用4テーブルで完全分離する。
-- ============================================================

-- 1. brand_quizzes : テストマスター
create table if not exists brand_quizzes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft','active','closed','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  total_members int,                              -- 配信時点メンバー数のスナップショット
  pass_threshold int not null default 80,         -- 合格ライン（正答率%）
  randomize_questions boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_brand_quizzes_company
  on brand_quizzes (company_id, created_at desc);

-- 2. brand_quiz_questions : 設問
create table if not exists brand_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references brand_quizzes(id) on delete cascade,
  category text not null check (category in ('why','how','what')),
  question_text text not null,
  question_type text not null default 'single_choice'
    check (question_type in ('single_choice','true_false')),
  options jsonb not null default '[]'::jsonb,      -- [{ "id": "a", "text": "..." }, ...]
  correct_option_id text not null,                 -- options[].id を指す
  explanation text,                                -- 解説（本人結果画面で「正解＋理由」を表示＝学習）
  source text not null default 'ai_generated'
    check (source in ('template','ai_generated','custom')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  reference_data jsonb,                            -- AI生成時の参照元 { field, value }
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_quiz_questions_quiz
  on brand_quiz_questions (quiz_id, sort_order);

-- 3. brand_quiz_attempts : 受験記録（★記名：profile_id を持つ）
create table if not exists brand_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references brand_quizzes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  department text,                                 -- 受験時点の部署スナップショット
  role_category text check (role_category in ('executive','manager','staff')),
  score numeric,                                   -- 全体正答率 0-100
  why_score numeric,                               -- WHYカテゴリ正答率
  how_score numeric,                               -- HOWカテゴリ正答率
  what_score numeric,                              -- WHATカテゴリ正答率（任意）
  total_questions int,
  correct_count int,
  passed boolean,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quiz_id, profile_id)                     -- 1人1回（再受験は将来設計）
);
create index if not exists idx_brand_quiz_attempts_quiz
  on brand_quiz_attempts (quiz_id);
create index if not exists idx_brand_quiz_attempts_quiz_dept
  on brand_quiz_attempts (quiz_id, department);

-- 4. brand_quiz_answers : 設問別の回答（本人の弱点・解説表示用）
create table if not exists brand_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references brand_quiz_attempts(id) on delete cascade,
  question_id uuid not null references brand_quiz_questions(id) on delete cascade,
  selected_option_id text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_quiz_answers_attempt
  on brand_quiz_answers (attempt_id);

-- ============================================================
-- RLS
-- ============================================================
alter table brand_quizzes        enable row level security;
alter table brand_quiz_questions enable row level security;
alter table brand_quiz_attempts  enable row level security;
alter table brand_quiz_answers   enable row level security;

-- ------------------------------------------------------------
-- RLS ポリシー Step 1（暫定）
-- ------------------------------------------------------------
-- 方針:
--   既存 20260430000000_enable_rls_emergency_patch.sql の
--   「分類3: 管理画面専用テーブル」（brand_surveys / brand_survey_questions）
--   と同じ思想・命名規約（auth_all = FOR ALL TO authenticated USING(true)）に
--   揃える。実アクセスは全て API Route（getSupabaseAdmin() / service_role）
--   経由で、service_role は RLS をバイパスする。フロントからの直接アクセスは
--   想定しない。
--
-- ★ brand_survey_responses との違い（重要な判断）:
--   brand_survey_responses / survey_participants は「分類2: 匿名書き込み受付」
--   として anon_insert を許可している（匿名サーベイ回答リンクが匿名POSTする
--   ため）。一方クイズは【記名式】で、受験・採点は認証済み API Route を通す。
--   匿名 INSERT は記名式の前提を崩すので、4テーブルとも anon は完全遮断し、
--   匿名書き込み（分類2）パターンは採用しない。全て分類3（auth_all）に倣う。
--
-- ★ RLS Step 2 でスコープ付きに置換:
--   記名式ゆえ本人は自分の attempt/answer のみ閲覧、管理者・経営層は
--   部署平均（3人以上のk匿名）のみ、を company_id / profile_id ベースで
--   表現する。Step 2 移行時は本ファイルで作成したポリシー（auth_all）を
--   テーブル名 × ポリシー名 "auth_all" で識別して DROP すること。
-- ------------------------------------------------------------

-- brand_quizzes -----------------------------------------------
create policy "auth_all" on brand_quizzes
  for all to authenticated using (true) with check (true);

-- brand_quiz_questions ----------------------------------------
create policy "auth_all" on brand_quiz_questions
  for all to authenticated using (true) with check (true);

-- brand_quiz_attempts -----------------------------------------
create policy "auth_all" on brand_quiz_attempts
  for all to authenticated using (true) with check (true);

-- brand_quiz_answers ------------------------------------------
create policy "auth_all" on brand_quiz_answers
  for all to authenticated using (true) with check (true);

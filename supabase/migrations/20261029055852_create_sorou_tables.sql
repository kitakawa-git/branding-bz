-- 構築ツール「日程調整ツール（sorou）」のテーブル
-- 作成（ログイン必須・構築ツールの月次枠を使う）と回答（共有リンク・ログイン不要）を分けて持つ。
-- 読み書きはすべて API（service_role）経由。anon / authenticated からは直接触れない
create table if not exists public.sorou_events (
  -- 共有リンクに出る ID。推測されにくいようサーバーで 10 文字のランダム英数字を作る
  id text primary key check (id ~ '^[A-Za-z0-9]{10}$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  -- 構築ツールの利用回数（mini_app_sessions）と結びつける
  session_id uuid references public.mini_app_sessions(id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 200),
  memo text not null default '' check (length(memo) <= 500),
  -- 候補日程 [{ "k": "YYYY-MM-DD", "t": "HH:MM" | "" }]
  cands jsonb not null check (jsonb_typeof(cands) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sorou_events_owner_idx on public.sorou_events(owner_user_id, created_at desc);
create index if not exists sorou_events_company_idx on public.sorou_events(company_id);

create table if not exists public.sorou_participants (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.sorou_events(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  -- 候補と同じ順の回答 ["ok" | "mb" | "no" | null]
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  comment text not null default '' check (length(comment) <= 300),
  -- 回答した本人だけが直せるよう、端末に渡した合言葉の SHA-256 を持つ（合言葉そのものは保存しない）
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sorou_participants_event_idx on public.sorou_participants(event_id, created_at);

alter table public.sorou_events enable row level security;
alter table public.sorou_participants enable row level security;
revoke all on public.sorou_events, public.sorou_participants from anon, authenticated;

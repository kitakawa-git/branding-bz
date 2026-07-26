-- ブランディング用語wiki（/wiki）用テーブル一式。
-- Phase 1 で作成した 230語のデータセット（scripts/wiki-seed/terms.json）を投入する受け皿。
-- 全て新規テーブルの追加のみ（既存テーブル・既存挙動への影響ゼロ）。
--
-- 公開制御は wiki_terms.status で行う:
--   draft     … 下書き
--   review    … 監修待ち（シード直後は全件これ。公開ページには出ない）
--   published … 公開（RLS でこれだけが anon から読める）
--
-- ※ 書き込みは service_role（seed スクリプト / SQL Editor）のみを想定。
--    anon/authenticated 向けの insert/update/delete ポリシーは意図的に作らない（= deny）。

-- ------------------------------------------------------------------
-- 1. 用語本体
-- ------------------------------------------------------------------
create table if not exists public.wiki_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  term text not null,
  -- よみがな。50音インデックスを作る際に使う。今回は未投入（全件 null）。
  reading text,
  -- 英訳。無い用語もあるため空文字許容。
  en text not null default '',
  -- 別名・表記ゆれ（検索用）。
  aliases text[] not null default '{}',
  -- カテゴリ（現データは1件だが将来の複数付与に備えて配列）。
  categories text[] not null default '{}',
  short_def text not null,
  long_def text not null,
  status text not null default 'draft' check (status in ('draft', 'review', 'published')),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- slug は unique 制約が索引を張るので別途 index は作らない。
create index if not exists idx_wiki_terms_status on public.wiki_terms (status);
create index if not exists idx_wiki_terms_categories on public.wiki_terms using gin (categories);

-- ------------------------------------------------------------------
-- 2. 参考ソース（1用語:N件）
-- ------------------------------------------------------------------
create table if not exists public.wiki_term_sources (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.wiki_terms(id) on delete cascade,
  -- bc_support = include.bz/bc/support、id_tips = include.bz の Tips 記事、
  -- podcast = ポッドキャスト書き起こし、external = 外部記事、ai_supplement = AI補完（要監修）
  source_type text not null check (source_type in ('bc_support', 'id_tips', 'podcast', 'external', 'ai_supplement')),
  source_id text,
  title text,
  url text,
  excerpt text,
  ordering integer not null default 0
);

create index if not exists idx_wiki_sources_term on public.wiki_term_sources (term_id);

-- ------------------------------------------------------------------
-- 3. 北川発言の引用（ポッドキャスト）
-- ------------------------------------------------------------------
create table if not exists public.wiki_term_quotes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.wiki_terms(id) on delete cascade,
  -- 「16」「22-2」など。未公開回や特定できない回は '?' が入りうる。
  ep_no text not null,
  ep_title text not null,
  quote text not null,
  -- 未公開回（第34-38話）は空文字。公開されたら後から UPDATE で埋める。
  spotify_url text,
  ordering integer not null default 0
);

create index if not exists idx_wiki_quotes_term on public.wiki_term_quotes (term_id);

-- ------------------------------------------------------------------
-- 4. 関連用語グラフ（有向。seed では双方向には張らず terms.json の related をそのまま入れる）
-- ------------------------------------------------------------------
create table if not exists public.wiki_term_relations (
  from_term_id uuid not null references public.wiki_terms(id) on delete cascade,
  to_term_id uuid not null references public.wiki_terms(id) on delete cascade,
  strength integer not null default 1,
  primary key (from_term_id, to_term_id)
);

-- 主キーの先頭列が from_term_id なので from 方向の索引は主キーが兼ねる。to 方向のみ追加。
create index if not exists idx_wiki_relations_to on public.wiki_term_relations (to_term_id);

-- ------------------------------------------------------------------
-- 5. RLS: 公開（published）だけ誰でも読める
-- ------------------------------------------------------------------
alter table public.wiki_terms enable row level security;
alter table public.wiki_term_sources enable row level security;
alter table public.wiki_term_quotes enable row level security;
alter table public.wiki_term_relations enable row level security;

drop policy if exists wiki_terms_public_read on public.wiki_terms;
create policy wiki_terms_public_read on public.wiki_terms
  for select
  using (status = 'published');

drop policy if exists wiki_sources_public_read on public.wiki_term_sources;
create policy wiki_sources_public_read on public.wiki_term_sources
  for select
  using (
    exists (
      select 1 from public.wiki_terms t
      where t.id = wiki_term_sources.term_id and t.status = 'published'
    )
  );

drop policy if exists wiki_quotes_public_read on public.wiki_term_quotes;
create policy wiki_quotes_public_read on public.wiki_term_quotes
  for select
  using (
    exists (
      select 1 from public.wiki_terms t
      where t.id = wiki_term_quotes.term_id and t.status = 'published'
    )
  );

-- 関連は「両端が公開されている辺」だけ見せる（未公開用語の存在を関連チップから推測させない）。
drop policy if exists wiki_relations_public_read on public.wiki_term_relations;
create policy wiki_relations_public_read on public.wiki_term_relations
  for select
  using (
    exists (
      select 1 from public.wiki_terms f
      where f.id = wiki_term_relations.from_term_id and f.status = 'published'
    )
    and exists (
      select 1 from public.wiki_terms t
      where t.id = wiki_term_relations.to_term_id and t.status = 'published'
    )
  );

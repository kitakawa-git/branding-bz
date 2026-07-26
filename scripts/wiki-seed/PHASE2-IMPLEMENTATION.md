# Phase 2: branding.bz 本番実装計画

Phase 1 で作成した 230語のwikiデータセットを、branding.bz (Next.js + Supabase) に統合する具体的な実装計画。

## 1. スコープ

- URL: `https://branding.bz/wiki`
- URL構造: `/wiki`（index）、`/wiki/[slug]`（詳細）、`/wiki/category/[cat]`（カテゴリ別）、`/wiki/podcast/[ep]`（エピソード→用語）
- レンダリング: SSG + ISR（revalidate: 3600秒）
- 認証: 不要（公開ページ）

## 2. データベース（Supabase）

### migration: `create_wiki_tables.sql`

```sql
-- 用語本体
create table wiki_terms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  term text not null,
  reading text,
  en text,
  categories text[] not null default '{}',
  short_def text not null,
  long_def text not null,
  status text not null default 'draft' check (status in ('draft','review','published')),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_wiki_terms_slug on wiki_terms(slug);
create index idx_wiki_terms_status on wiki_terms(status);
create index idx_wiki_terms_categories on wiki_terms using gin(categories);

-- 参考ソース (n:1)
create table wiki_term_sources (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references wiki_terms(id) on delete cascade,
  source_type text not null check (source_type in ('bc_support','id_tips','podcast','external','ai_supplement')),
  source_id text,
  title text,
  url text,
  excerpt text,
  ordering integer default 0
);
create index idx_wiki_sources_term on wiki_term_sources(term_id);

-- 北川発言引用
create table wiki_term_quotes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references wiki_terms(id) on delete cascade,
  ep_no text not null,
  ep_title text not null,
  quote text not null,
  spotify_url text,
  ordering integer default 0
);
create index idx_wiki_quotes_term on wiki_term_quotes(term_id);

-- 関連用語グラフ
create table wiki_term_relations (
  from_term_id uuid not null references wiki_terms(id) on delete cascade,
  to_term_id uuid not null references wiki_terms(id) on delete cascade,
  strength integer default 1,
  primary key (from_term_id, to_term_id)
);
create index idx_wiki_relations_from on wiki_term_relations(from_term_id);
create index idx_wiki_relations_to on wiki_term_relations(to_term_id);

-- 公開のみ読める RLS
alter table wiki_terms enable row level security;
create policy "public read published" on wiki_terms for select using (status = 'published');
alter table wiki_term_sources enable row level security;
create policy "public read via term" on wiki_term_sources for select using (
  exists (select 1 from wiki_terms where wiki_terms.id = term_id and status = 'published')
);
alter table wiki_term_quotes enable row level security;
create policy "public read via term" on wiki_term_quotes for select using (
  exists (select 1 from wiki_terms where wiki_terms.id = term_id and status = 'published')
);
alter table wiki_term_relations enable row level security;
create policy "public read" on wiki_term_relations for select using (true);
```

## 3. Seed スクリプト

`scripts/seed-wiki.ts` — Phase 1 の `terms.json` を Supabase に投入。

```typescript
import { createClient } from '@supabase/supabase-js';
import terms from '../public/wiki-data/terms.json';

const supabase = createClient(URL, SERVICE_ROLE_KEY);

// 1. Insert terms and capture id map
const idMap = new Map<string, string>();
for (const t of terms) {
  const { data } = await supabase.from('wiki_terms').insert({
    slug: t.slug,
    term: t.term,
    en: t.en,
    categories: t.categories,
    short_def: t.short_def,
    long_def: t.long_def,
    status: 'review',  // 監修完了後にpublishedへ変更
  }).select('id').single();
  idMap.set(t.term, data.id);
}

// 2. Insert sources, quotes, relations
for (const t of terms) {
  const termId = idMap.get(t.term)!;
  for (const s of t.sources) {
    await supabase.from('wiki_term_sources').insert({ term_id: termId, ...s });
  }
  for (const q of t.kitagawa_quotes) {
    await supabase.from('wiki_term_quotes').insert({ term_id: termId, ...q });
  }
  for (const relatedTerm of t.related) {
    const toId = idMap.get(relatedTerm);
    if (toId) await supabase.from('wiki_term_relations').insert({
      from_term_id: termId, to_term_id: toId
    });
  }
}
```

## 4. Next.js ページ構成

### `/app/wiki/page.tsx` (index)

```typescript
export const revalidate = 3600;

export default async function WikiIndex() {
  const supabase = createServerClient();
  const { data: terms } = await supabase
    .from('wiki_terms')
    .select('slug, term, short_def, categories, en')
    .eq('status', 'published')
    .order('term');
  
  return <WikiIndexClient terms={terms} />;
}
```

`WikiIndexClient` は現在の静的HTMLと同構造（カテゴリカード + 検索 + カテゴリフィルタ + ソート + 用語グリッド）。

### `/app/wiki/[slug]/page.tsx` (詳細)

```typescript
export const revalidate = 3600;

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase.from('wiki_terms').select('slug').eq('status', 'published');
  return data?.map(t => ({ slug: t.slug })) ?? [];
}

export async function generateMetadata({ params }) {
  const { data: t } = await supabase.from('wiki_terms')
    .select('*').eq('slug', params.slug).single();
  return {
    title: `${t.term} | ブランディング用語wiki | branding.bz`,
    description: t.short_def,
    openGraph: { title: t.term, description: t.short_def },
  };
}

export default async function TermPage({ params }) {
  const term = await fetchTermWithRelations(params.slug);
  return <TermDetail term={term} />;
}
```

### JSON-LD 構造化データ

```typescript
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": term.term,
  "description": term.short_def,
  "inDefinedTermSet": {
    "@type": "DefinedTermSet",
    "name": "ブランディング用語wiki",
    "url": "https://branding.bz/wiki"
  },
  "termCode": term.slug,
})}
</script>
```

北川引用ブロックにも `Quotation` schema を併記：

```typescript
{term.quotes.map(q => (
  <script type="application/ld+json">{JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Quotation",
    "text": q.quote,
    "spokenByCharacter": { "@type": "Person", "name": "北川 巧" },
    "citation": q.spotify_url,
  })}</script>
))}
```

## 5. 実装タスク（推定工数）

| # | タスク | 工数目安 |
|---|---|---|
| 1 | migration ファイル作成 & 適用 | 0.5h |
| 2 | seed スクリプト作成 & 実行 | 1h |
| 3 | 型定義生成（`supabase gen types`） | 0.2h |
| 4 | `/wiki` index ページ | 2h |
| 5 | `/wiki/[slug]` 詳細ページ | 3h |
| 6 | `/wiki/category/[slug]` カテゴリページ | 1h |
| 7 | 北川引用ブロックコンポーネント | 1h |
| 8 | 関連用語チップコンポーネント | 0.5h |
| 9 | JSON-LD構造化データ実装 | 1h |
| 10 | sitemap.xml 追加 | 0.5h |
| 11 | ヘッダーにwikiリンク追加 | 0.3h |
| 12 | 動作確認・調整 | 2h |
| **計** | | **約13h** |

## 6. 公開順序

1. 全用語を`status='review'`でシード → **本番URLでは非表示**
2. 監修完了した用語から`published`に切り替え
3. カテゴリ単位で段階的に公開（例: 基礎・核心 → 構造・管理 → …）
4. 全公開後、sitemap.xml をSearch Consoleに送信

## 7. Phase 3 以降（この後の拡張候補）

- **CMS化**: 管理画面から用語追加・編集（現状はSQLダイレクト運用）
- **編集履歴**: `wiki_terms_history` テーブルで変更追跡
- **多言語化**: 英語版 `/en/wiki` 展開（BtoB向けSEO）
- **API公開**: 他アプリから利用可能なREST API
- **AI検索**: 用語Embedding + セマンティック検索（Supabase pgvector）
- **利用データ**: `view_count`をトラッキングして人気用語を可視化

## 8. 未決事項

- [ ] `wiki_terms.reading` （よみがな）を今回投入するか
- [ ] 監修状態を Supabase 上で管理するか、CMS前提でxlsxで管理するか
- [ ] `/wiki` のヘッダー・フッターは既存ブランドサイトと共通か
- [ ] podcast第34-38話公開時のSpotify URL自動追加スクリプト
- [ ] ユーザー投稿・コメント機能の要否

---

**Phase 1完了時点のデータ:**  
`/wiki-data/terms.json` — 230用語 / 653関連リンク / 124 Spotify引用URL / 176 AI補完（要監修）

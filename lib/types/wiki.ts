// ブランディング用語wiki（/wiki）の型とカテゴリ定義。
// DB: wiki_terms / wiki_term_sources / wiki_term_quotes / wiki_term_relations
// （supabase/migrations/20260726163924_create_wiki_terms.sql）

export type WikiTermStatus = 'draft' | 'review' | 'published'

/** 参考ソースの出所。terms.json の type をDB用に正規化した値。 */
export type WikiSourceType =
  | 'bc_support' // include.bz/bc/support の記事
  | 'id_tips' // include.bz の Tips 記事
  | 'podcast' // ポッドキャスト書き起こし
  | 'external' // 外部記事
  | 'ai_supplement' // AI補完（監修が必要）

export const WIKI_SOURCE_TYPE_LABELS: Record<WikiSourceType, string> = {
  bc_support: 'brandcommit サポート',
  id_tips: 'ID INC. Tips',
  podcast: 'ポッドキャスト',
  external: '外部記事',
  ai_supplement: 'AI補完（監修中）',
}

/**
 * カテゴリ定義（7カテゴリ）。
 * value は wiki_terms.categories に入る文字列そのもの（= URL セグメントにも使う）。
 * 表示順はブランド構築の学習順に合わせている。
 */
export const WIKI_CATEGORIES = [
  {
    value: '基礎・核心',
    description: 'ブランドとは何か。すべての出発点になる基本概念。',
  },
  {
    value: '構造・管理',
    description: '理念体系・ガイドラインなど、ブランドを組み立てて保つ仕組み。',
  },
  {
    value: '命名・言語',
    description: 'ネーミング・スローガン・トーンなど、言葉でブランドを規定する要素。',
  },
  {
    value: '視覚・デザイン',
    description: 'ロゴ・カラー・タイポグラフィなど、目に見えるブランドの表現。',
  },
  {
    value: '顧客・市場',
    description: 'ターゲット・ペルソナ・顧客体験など、届ける相手を捉える視点。',
  },
  {
    value: '戦略・マーケ連携',
    description: 'ポジショニングや施策設計など、事業成果につなげる考え方。',
  },
  {
    value: '特化・応用',
    description: 'インナー・採用・BtoBなど、目的別に踏み込んだ実践テーマ。',
  },
] as const

export type WikiCategory = (typeof WIKI_CATEGORIES)[number]['value']

export const WIKI_CATEGORY_VALUES: readonly string[] = WIKI_CATEGORIES.map((c) => c.value)

export function getWikiCategory(value: string) {
  return WIKI_CATEGORIES.find((c) => c.value === value)
}

/** index / カテゴリ一覧のカードに必要な最小データ。 */
export type WikiTermSummary = {
  slug: string
  term: string
  en: string
  categories: string[]
  short_def: string
  /** ポッドキャストの引用があるか（カードのバッジ用・集計して付与） */
  has_quote: boolean
}

export type WikiTermSource = {
  id: string
  source_type: WikiSourceType
  source_id: string | null
  title: string | null
  url: string | null
  excerpt: string | null
  ordering: number
}

export type WikiTermQuote = {
  id: string
  ep_no: string
  ep_title: string
  quote: string
  spotify_url: string | null
  ordering: number
}

/** 詳細ページ用のフル情報。 */
export type WikiTermDetail = {
  id: string
  slug: string
  term: string
  reading: string | null
  en: string
  aliases: string[]
  categories: string[]
  short_def: string
  long_def: string
  updated_at: string
  sources: WikiTermSource[]
  quotes: WikiTermQuote[]
  /** 関連用語（公開済みのみ） */
  related: { slug: string; term: string; short_def: string }[]
}

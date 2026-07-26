import type { MetadataRoute } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { WIKI_CATEGORIES } from '@/lib/types/wiki'
import { fetchPublishedTermSlugs } from '@/lib/wiki/queries'

const BASE_URL = 'https://branding.bz'

// ページ別の固定 lastModified。
// ルール:
// - 各ページの <head>（title/description/canonical/og）や本文を"実質的に"変えた日を書く
// - 軽微な文言修正では更新しない
// - 絶対に new Date() を使わない：毎ビルドで全ページが「更新」扱いになると Google が lastmod を無視する
// - ニュース記事 /news/[slug] はここに書かず、DB の updated_at || published_at を使う（下記）
//
// 2026-07-14 全ページ更新の履歴:
//   全ページの canonical / openGraph を新設（正しい自ページURLを指すように修正）。
//   これは HEAD メタの実質更新なので lastmod もこの日で正しい。
const STATIC_PAGES: Array<{
  path: string
  lastModified: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '', lastModified: '2026-07-14', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/plan', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/features', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/news', lastModified: '2026-07-14', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/contact', lastModified: '2026-07-14', changeFrequency: 'yearly', priority: 0.6 },
  { path: '/wiki', lastModified: '2026-07-27', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/tools/colors', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tools/stp', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tools/persona', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tools/personality', lastModified: '2026-07-14', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/terms', lastModified: '2026-07-14', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy-policy', lastModified: '2026-07-14', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/tokusho', lastModified: '2026-07-14', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: new Date(p.lastModified),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))

  // /news/[slug] を公開済み記事から動的に生成
  let newsEntries: MetadataRoute.Sitemap = []
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('news')
      .select('slug, published_at, updated_at')
      .eq('is_published', true)
    if (data) {
      newsEntries = data.map((row) => ({
        url: `${BASE_URL}/news/${row.slug}`,
        lastModified: new Date(row.updated_at || row.published_at || '2026-06-21'),
        changeFrequency: 'yearly' as const,
        priority: 0.5,
      }))
    }
  } catch {
    // 取得失敗時は静的エントリのみを返す（sitemap 全体を落とさない）
  }

  // /wiki/[slug] と /wiki/category/[slug] を公開済み用語から動的に生成。
  // 公開（status='published'）が0件のうちは何も出さない＝監修前の用語をクロールさせない。
  let wikiEntries: MetadataRoute.Sitemap = []
  try {
    const terms = await fetchPublishedTermSlugs()
    if (terms.length > 0) {
      const termEntries: MetadataRoute.Sitemap = terms.map((t) => ({
        url: `${BASE_URL}/wiki/${encodeURIComponent(t.slug)}`,
        lastModified: new Date(t.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
      const categoryEntries: MetadataRoute.Sitemap = WIKI_CATEGORIES.map((c) => ({
        url: `${BASE_URL}/wiki/category/${encodeURIComponent(c.value)}`,
        lastModified: new Date('2026-07-27'),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
      wikiEntries = [...categoryEntries, ...termEntries]
    }
  } catch {
    // 取得失敗時は wiki を除いて返す（sitemap 全体を落とさない）
  }

  return [...staticEntries, ...newsEntries, ...wikiEntries]
}

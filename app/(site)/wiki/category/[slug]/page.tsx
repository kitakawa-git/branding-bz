// ブランディング用語wiki カテゴリ別一覧（公開・SSG + ISR）
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHero } from '@/components/lp/ui'
import TermCard from '@/components/wiki/TermCard'
import { WIKI_CATEGORIES, getWikiCategory } from '@/lib/types/wiki'
import { fetchPublishedTermSummaries } from '@/lib/wiki/queries'

export const revalidate = 3600

/** カテゴリは静的定義（7件）なので全件を事前生成する。 */
export function generateStaticParams() {
  return WIKI_CATEGORIES.map((c) => ({ slug: c.value }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = getWikiCategory(decodeURIComponent(slug))
  if (!category) return { title: 'カテゴリが見つかりません | branding.bz' }

  const title = `${category.value}のブランディング用語 | ブランディング用語wiki | branding.bz`
  const path = `/wiki/category/${encodeURIComponent(category.value)}`
  return {
    title,
    description: `${category.description} ${category.value}に分類されるブランディング用語を一覧で解説します。`,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: category.description,
      url: `https://branding.bz${path}`,
    },
  }
}

export default async function WikiCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const value = decodeURIComponent(slug)
  const category = getWikiCategory(value)
  if (!category) notFound()

  const all = await fetchPublishedTermSummaries()
  const terms = all.filter((t) => t.categories.includes(category.value))

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://branding.bz' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'ブランディング用語wiki',
        item: 'https://branding.bz/wiki',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: category.value,
        item: `https://branding.bz/wiki/category/${encodeURIComponent(category.value)}`,
      },
    ],
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <PageHero eyebrow="Wiki" title={category.value}>
        {category.description}
      </PageHero>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="text-sm text-white/45">{terms.length}語</p>
            <Link
              href="/wiki"
              className="inline-flex min-h-11 items-center text-sm text-white/50 transition-colors hover:text-white"
            >
              ← 用語wiki 全体を見る
            </Link>
          </div>

          {terms.length === 0 ? (
            <p className="py-16 text-center text-white/45">
              このカテゴリで公開中の用語はまだありません。
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {terms.map((t) => (
                <TermCard key={t.slug} term={t} />
              ))}
            </div>
          )}

          {/* 他カテゴリへの回遊 */}
          <div className="mt-16 border-t border-white/10 pt-8">
            <p className="mb-4 text-sm font-semibold tracking-[0.15em] text-blue-400">
              ほかのカテゴリ
            </p>
            <div className="flex flex-wrap gap-2">
              {WIKI_CATEGORIES.filter((c) => c.value !== category.value).map((c) => (
                <Link
                  key={c.value}
                  href={`/wiki/category/${encodeURIComponent(c.value)}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                >
                  {c.value}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

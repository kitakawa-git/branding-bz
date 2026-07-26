// ブランディング用語wiki 詳細（公開・SSG + ISR）
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TermDetail from '@/components/wiki/TermDetail'
import { fetchPublishedTermSlugs, fetchTermDetail } from '@/lib/wiki/queries'

export const revalidate = 3600

/** 公開済み用語を事前生成。未生成の slug は初回アクセス時に ISR で生成される。 */
export async function generateStaticParams() {
  const rows = await fetchPublishedTermSlugs()
  return rows.map((r) => ({ slug: r.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const term = await fetchTermDetail(decodeURIComponent(slug))
  if (!term) return { title: '用語が見つかりません | branding.bz' }

  const title = `${term.term}とは？意味と使い方 | ブランディング用語wiki | branding.bz`
  const url = `https://branding.bz/wiki/${encodeURIComponent(term.slug)}`
  return {
    title,
    description: term.short_def,
    alternates: { canonical: `/wiki/${encodeURIComponent(term.slug)}` },
    openGraph: {
      type: 'article',
      title: `${term.term}とは？ | ブランディング用語wiki`,
      description: term.short_def,
      url,
    },
  }
}

export default async function WikiTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const term = await fetchTermDetail(decodeURIComponent(slug))
  if (!term) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.term,
    ...(term.en ? { alternateName: term.en } : {}),
    description: term.short_def,
    termCode: term.slug,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': 'https://branding.bz/wiki#definedtermset',
      name: 'ブランディング用語wiki',
      url: 'https://branding.bz/wiki',
    },
    url: `https://branding.bz/wiki/${encodeURIComponent(term.slug)}`,
    inLanguage: 'ja',
  }

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
        name: term.term,
        item: `https://branding.bz/wiki/${encodeURIComponent(term.slug)}`,
      },
    ],
  }

  return (
    <main className="px-6 pb-24 pt-32 md:pt-40">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <TermDetail term={term} />
    </main>
  )
}

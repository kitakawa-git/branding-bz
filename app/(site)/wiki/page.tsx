// ブランディング用語wiki index（公開・SSG + ISR）
import type { Metadata } from 'next'
import { PageHero } from '@/components/lp/ui'
import { fetchPublishedTermSummaries } from '@/lib/wiki/queries'
import WikiIndexClient from './WikiIndexClient'

export const revalidate = 3600

const TITLE = 'ブランディング用語wiki | branding.bz'
const DESCRIPTION =
  'ブランディングの専門用語をやさしく解説する用語集。ブランドの基礎概念から理念体系・VI・ポジショニング・インナーブランディングまで、ブランディング会社 ID INC. の現場知見とポッドキャストの発言をもとにまとめています。'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/wiki' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://branding.bz/wiki',
  },
}

export default async function WikiIndexPage() {
  const terms = await fetchPublishedTermSummaries()

  // 用語集そのものを DefinedTermSet として宣言する（各用語ページの DefinedTerm の親）
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': 'https://branding.bz/wiki#definedtermset',
    name: 'ブランディング用語wiki',
    description: DESCRIPTION,
    url: 'https://branding.bz/wiki',
    inLanguage: 'ja',
    publisher: { '@id': 'https://branding.bz/#organization' },
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero eyebrow="Wiki" title="ブランディング用語wiki">
        ブランディングの言葉を、現場の言葉で。
        <br className="hidden sm:block" />
        ID INC. が実務で使っている定義をそのまま公開しています。
      </PageHero>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          {terms.length === 0 ? (
            <p className="py-16 text-center text-white/45">
              現在公開中の用語はありません。順次公開していきます。
            </p>
          ) : (
            <WikiIndexClient terms={terms} />
          )}
        </div>
      </section>
    </main>
  )
}

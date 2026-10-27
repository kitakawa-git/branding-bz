// 構築ツールの紹介ページ（/tools/stp・persona・personality・colors）の構造化データ。
// 4ページに同じ3つの JSON-LD（SoftwareApplication・FAQPage・BreadcrumbList）が複製されていたものをまとめた。
// 出力される JSON は以前と1文字も同じ（キーの順番も含む）。変えると検索結果の表示に影響するので注意。
type FaqItem = { q: string; a: string }

export function ToolJsonLd({
  name,
  description,
  path,
  applicationCategory = 'BusinessApplication',
  faqItems,
}: {
  /** ツール名（SoftwareApplication の name と、パンくずの2階層目） */
  name: string
  description: string
  /** 例: '/tools/stp' */
  path: string
  /** カラー定義ツールだけ 'DesignApplication' */
  applicationCategory?: string
  /** 画面下の FAQ と同じ配列を渡す（可視 FAQ と1文字違わず一致させるため） */
  faqItems: readonly FaqItem[]
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name,
            applicationCategory,
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
            description,
            provider: { '@type': 'Organization', name: 'branding.bz', url: 'https://branding.bz' },
          }),
        }}
      />
      {/* FAQPage: 下の可視FAQと同じ FAQ_ITEMS を参照して1文字違わず一致を担保 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          }),
        }}
      />
      {/* BreadcrumbList: 画面表示なし、schema のみ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://branding.bz/' },
              { '@type': 'ListItem', position: 2, name, item: `https://branding.bz${path}` },
            ],
          }),
        }}
      />
    </>
  )
}

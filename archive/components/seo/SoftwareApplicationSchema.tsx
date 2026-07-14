// branding.bz 全体の SoftwareApplication 構造化データ（公開ページ共通）
// publisher で include.bz の Organization(@id) を参照し、両サイトの関係性を Google に伝える。
// 各ツールページ（/tools/*）は、これに加えて個別の SoftwareApplication を出力する。

export const SOFTWARE_APPLICATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'branding.bz',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'BrandManagement',
  description:
    'AIブランディングSaaS。中小企業・スタートアップ向けのブランド構築・浸透・発信を一気通貫で支援。',
  url: 'https://branding.bz',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'JPY',
    },
  ],
  publisher: {
    '@type': 'Organization',
    '@id': 'https://include.bz/#organization',
    name: 'ID INC.',
    url: 'https://include.bz',
  },
  audience: {
    '@type': 'BusinessAudience',
    audienceType: '中小企業・スタートアップの経営者・マーケ担当者',
  },
} as const

/**
 * 公開ページ共通の SoftwareApplication 構造化データを <script> として出力する。
 * サーバーコンポーネント／サーバーレイアウト内で `<SoftwareApplicationSchema />` として配置する。
 */
export function SoftwareApplicationSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(SOFTWARE_APPLICATION_SCHEMA),
      }}
    />
  )
}

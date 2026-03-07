import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { generateHighResQRDataURL, getQRFilename } from '@/lib/qr-download'
import { parseFontsFromDB, getCssFontFamily, getGoogleFontsUrl } from '@/lib/brand-fonts'
import { CardViewTracker } from './CardViewTracker'
import { VCardButton } from './VCardButton'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Mail, Phone, ExternalLink } from 'lucide-react'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return { title: 'branding.bz' }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, companies(name, logo_url)')
    .eq('slug', slug)
    .eq('card_enabled', true)
    .single()

  if (!profile) return { title: 'branding.bz' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const companies = profile.companies as any
  const companyName = companies?.name as string | undefined
  const companyLogoUrl = companies?.logo_url as string | undefined
  return {
    title: {
      absolute: companyName ? `${profile.name} | ${companyName}` : (profile.name || 'branding.bz'),
    },
    icons: { icon: companyLogoUrl || '/icon.svg' },
  }
}

// 明暗判定: ブランドカラーに応じて読みやすい文字色（白or黒）を返す
function getContrastTextColor(hex: string): '#ffffff' | '#000000' {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // 相対輝度（W3C基準）
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

// SNSアイコンSVG
function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  )
}

export default async function CardPage({ params }: Props) {
  const { slug } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return (
      <div className="p-10">
        <h1>環境変数エラー</h1>
        <p>URL: {supabaseUrl ? '設定済み' : '未設定'}</p>
        <p>KEY: {supabaseKey ? '設定済み' : '未設定'}</p>
      </div>
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('slug', slug)
    .eq('card_enabled', true)
    .single()

  if (error) {
    return (
      <div className="p-10">
        <h1>データ取得エラー</h1>
        <p>slug: {slug}</p>
        <p>エラー: {error.message}</p>
      </div>
    )
  }

  if (!profile) {
    notFound()
  }

  const company = profile.companies
  const companyId = profile.company_id

  // ブランドデータをブランドテーブルから取得
  const [guidelinesRes, visualsRes] = await Promise.all([
    supabase
      .from('brand_guidelines')
      .select('*')
      .eq('company_id', companyId)
      .single(),
    supabase
      .from('brand_visuals')
      .select('*')
      .eq('company_id', companyId)
      .single(),
  ])

  const guidelines = guidelinesRes.data
  const visuals = visualsRes.data

  // ブランドフォント
  const brandFonts = parseFontsFromDB(visuals?.fonts)
  const primaryFontFamily = getCssFontFamily(brandFonts.primary_font)
  const secondaryFontFamily = getCssFontFamily(brandFonts.secondary_font)

  // ブランドカラー
  const palette = visuals?.color_palette as { brand_colors?: { hex: string }[]; secondary_colors?: { hex: string }[]; accent_colors?: { hex: string }[] } | null
  const primaryColor = palette?.brand_colors?.[0]?.hex || '#1a1a1a'
  const secondaryColor = palette?.secondary_colors?.[0]?.hex || '#666666'
  const headerTextColor = getContrastTextColor(primaryColor)

  // アクセントカラー
  const accentColor = palette?.accent_colors?.[0]?.hex || secondaryColor

  // スローガン・ミッション・バリュー・ブランドストーリー（brand_guidelines テーブルから取得）
  const slogan = guidelines?.slogan || ''
  const mission = guidelines?.mission || ''
  const brandStory = guidelines?.brand_story || ''

  // ミッション表示用テキスト
  const missionText = mission || ''

  // 事業内容（JSONB配列 [{title, description}, ...] を安全にパース）
  type BusinessContent = { title: string; description?: string }
  const businessContents: BusinessContent[] = Array.isArray(guidelines?.business_content)
    ? guidelines.business_content.filter((item: BusinessContent) => item.title)
    : []

  // QRコードをサーバーサイドで生成
  const cardUrl = `https://branding.bz/card/${slug}`
  const qrDataUrl = await QRCode.toDataURL(cardUrl, {
    width: 160,
    margin: 1,
  })

  // 高解像度QRコード（ダウンロード用 1000x1000px）
  const highResQrDataUrl = await generateHighResQRDataURL(slug)
  const downloadFilename = getQRFilename(profile.name || slug)

  // SNSリンクの存在チェック
  const snsLinks = [
    { url: profile.sns_x, icon: <XIcon />, label: 'X' },
    { url: profile.sns_linkedin, icon: <LinkedInIcon />, label: 'LinkedIn' },
    { url: profile.sns_facebook, icon: <FacebookIcon />, label: 'Facebook' },
    { url: profile.sns_instagram, icon: <InstagramIcon />, label: 'Instagram' },
  ].filter(s => s.url)

  return (
    <div
      className="min-h-screen bg-white font-sans"
      style={{
        '--brand-primary': primaryColor,
        '--brand-text': headerTextColor,
        '--brand-accent': accentColor,
      } as React.CSSProperties}
    >
      {/* フォント読み込み */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={getGoogleFontsUrl(brandFonts)} />

      {/* アクセス記録（クライアントコンポーネント） */}
      <CardViewTracker profileId={profile.id} />

      {/* SNSホバー用CSS（サーバーコンポーネントではTailwindのhoverでCSS変数を使えないため） */}
      <style>{`
        .sns-icon {
          transition: transform 0.15s, background-color 0.15s, color 0.15s;
        }
        .sns-icon:hover {
          transform: scale(1.1);
          background-color: var(--brand-primary) !important;
          color: var(--brand-text) !important;
        }
      `}</style>

      {/* 1. ヘッダー（カバー写真・プロフィール写真・名前・役職） */}
      {profile.cover_image_url ? (
        <>
          {/* カバー写真あり: 画像ヘッダー */}
          <div className="relative">
            <div className="h-[160px] sm:h-[200px] overflow-hidden">
              <img
                src={profile.cover_image_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            {/* プロフィール写真（カバー写真と重なる） */}
            <div className="flex justify-center -mt-12">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                {profile.photo_url ? (
                  <AvatarImage src={profile.photo_url} alt={profile.name} />
                ) : null}
                <AvatarFallback
                  className="text-3xl font-semibold bg-[var(--brand-primary)] text-[var(--brand-text)]"
                >
                  {profile.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          {/* 名前・役職 */}
          <div className="text-center pt-3 pb-1 px-5">
            <h1 className="text-xl font-semibold mb-1 tracking-wide text-foreground" style={{ fontFamily: primaryFontFamily, fontWeight: 700 }}>{profile.name}</h1>
            <p className="text-sm text-muted-foreground m-0" style={{ fontFamily: secondaryFontFamily }}>
              {[profile.position, profile.department].filter(Boolean).join(' / ')}
            </p>
          </div>
        </>
      ) : (
        /* カバー写真なし: 既存のブランドカラーヘッダー */
        <div className="bg-[var(--brand-primary)] px-5 pt-12 pb-10 text-center text-[var(--brand-text)]">
          <Avatar className="w-24 h-24 mx-auto mb-5 border-[3px] border-[var(--brand-text)]">
            {profile.photo_url ? (
              <AvatarImage src={profile.photo_url} alt={profile.name} />
            ) : null}
            <AvatarFallback
              className="text-3xl font-semibold bg-[var(--brand-text)] text-[var(--brand-primary)]"
            >
              {profile.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-semibold mb-1 tracking-wide" style={{ fontFamily: primaryFontFamily, fontWeight: 700 }}>{profile.name}</h1>
          <p className="text-sm opacity-75 m-0" style={{ fontFamily: secondaryFontFamily }}>
            {[profile.position, profile.department].filter(Boolean).join(' / ')}
          </p>
        </div>
      )}

      {/* コンテンツ */}
      <div className="max-w-md mx-auto px-5 pt-3 pb-8 space-y-5">
        {/* 2. 自己紹介 */}
        {profile.bio && (
          <p className="text-sm leading-[1.8] text-foreground/80 m-0" style={{ fontFamily: secondaryFontFamily }}>
            {profile.bio}
          </p>
        )}

        {/* 3. SNSリンク（アイコン横並び） */}
        {snsLinks.length > 0 && (
          <div className="flex justify-center gap-3">
            {snsLinks.map((sns) => (
              <a
                key={sns.label}
                href={sns.url}
                target="_blank"
                rel="noopener noreferrer"
                title={sns.label}
                className="sns-icon w-11 h-11 rounded-full bg-muted flex items-center justify-center no-underline text-[var(--brand-primary)]"
              >
                {sns.icon}
              </a>
            ))}
          </div>
        )}

        {/* 4. 連絡先ボタン（メール・電話） */}
        <div className="flex gap-3">
          {profile.email && (
            <Button
              asChild
              className="flex-1 h-11 rounded-lg text-sm font-bold gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <a href={`mailto:${profile.email}`}>
                <Mail size={16} />
                メール
              </a>
            </Button>
          )}
          {profile.phone && (
            <Button
              asChild
              className="flex-1 h-11 rounded-lg text-sm font-bold gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <a href={`tel:${profile.phone}`}>
                <Phone size={16} />
                電話
              </a>
            </Button>
          )}
        </div>

        {/* 4.5 アドレス帳に保存 */}
        <VCardButton
          name={profile.name || ''}
          position={profile.position || undefined}
          department={profile.department || undefined}
          companyName={company?.name || undefined}
          email={profile.email || undefined}
          phone={profile.phone || undefined}
          websiteUrl={company?.website_url || undefined}
          photoUrl={profile.photo_url || undefined}
          primaryColor={primaryColor}
        />

        {/* 5. 企業情報（ロゴ・企業名・スローガン・MVV） */}
        {company && (
          <Card className="bg-muted/50 border shadow-none">
            <CardHeader className="pb-0">
              <div className="flex items-center gap-3">
                {company.logo_url && (
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="max-w-[120px] max-h-[48px] object-contain shrink-0"
                  />
                )}
                <div>
                  <CardTitle
                    className="text-lg"
                    style={{ color: primaryColor, fontFamily: primaryFontFamily }}
                  >
                    {company.name}
                  </CardTitle>
                  {slogan && (
                    <CardDescription className="mt-0.5" style={{ fontFamily: primaryFontFamily }}>
                      {slogan}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            {missionText && (
              <CardContent className="pt-4">
                <Separator className="mb-4" />
                <p className="text-base font-bold text-foreground leading-[1.8] m-0 whitespace-pre-line" style={{ fontFamily: secondaryFontFamily }}>
                  {missionText}
                </p>
              </CardContent>
            )}
          </Card>
        )}

        {/* 6. 事業内容（番号付きカード形式） */}
        {businessContents.length > 0 && (
          <div>
            <h3
              className="text-sm font-bold mb-3 tracking-wide"
              style={{ color: primaryColor }}
            >
              事業内容
            </h3>
            <div className="space-y-2">
              {businessContents.map((item, i) => (
                <Card
                  key={i}
                  className="bg-muted/50 border shadow-none border-l-2 rounded-lg"
                  style={{ borderLeftColor: accentColor }}
                >
                  <CardContent className="p-4 flex gap-3">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1 m-0">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 7. ブランドストーリー */}
        {brandStory && (
          <div>
            <h3
              className="text-sm font-bold mb-3 tracking-wide"
              style={{ color: primaryColor }}
            >
              ブランドストーリー
            </h3>
            <Card className="bg-muted/50 border shadow-none">
              <CardContent className="p-5">
                <p className="text-[13px] text-foreground/70 leading-[1.8] whitespace-pre-wrap m-0" style={{ fontFamily: secondaryFontFamily }}>
                  {brandStory}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 8. コーポレートサイトリンク */}
        {company?.website_url && (
          <Button
            asChild
            className="w-full h-11 rounded-lg text-sm font-bold gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <a href={company.website_url} target="_blank" rel="noopener noreferrer">
              コーポレートサイトを見る
              <ExternalLink size={14} />
            </a>
          </Button>
        )}

        {/* 9. QRコード */}
        <div className="pt-2">
          <Separator className="mb-6" />
          <div className="text-center">
            <img
              src={qrDataUrl}
              alt="QRコード"
              width={140}
              height={140}
              className="block mx-auto rounded-lg"
            />
            <p
              className="text-[11px] mt-3 mb-1"
              style={{ color: primaryColor }}
            >
              名刺に印刷用
            </p>
            <a
              href={highResQrDataUrl}
              download={downloadFilename}
              className="text-[11px] text-muted-foreground underline"
            >
              高解像度ダウンロード（1000x1000px）
            </a>
          </div>
        </div>

        {/* 10. フッター */}
        <div className="pt-2">
          <Separator className="mb-4" />
          <p className="text-center text-[11px] text-muted-foreground m-0">
            Powered by branding.bz
          </p>
        </div>
      </div>
    </div>
  )
}

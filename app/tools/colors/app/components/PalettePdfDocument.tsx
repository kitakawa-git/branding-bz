// カラーパレット PDF テンプレート（@react-pdf/renderer）
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'
import type { PaletteProposal, ColorValue } from '@/lib/types/color-tool'

// NotoSansJP フォント登録（日本語テキスト対応）
// サーバーサイド（API Route）: ファイルパスで読み込み
// クライアント: public/ からの相対URLで読み込み
const fontSrc = (file: string) =>
  typeof window === 'undefined'
    ? path.join(process.cwd(), 'public', 'fonts', file)
    : `/fonts/${file}`

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: fontSrc('NotoSansJP-Regular.ttf'), fontWeight: 400 },
    { src: fontSrc('NotoSansJP-Bold.ttf'), fontWeight: 700 },
  ],
})

// 日本語テキストのハイフネーション無効化
Font.registerHyphenationCallback((word) => [word])

const FONT = 'NotoSansJP'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: '#333333',
    fontFamily: FONT,
  },
  header: {
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
  },
  concept: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  colorInfo: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  colorName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 1,
  },
  colorHex: {
    fontSize: 9,
    color: '#6B7280',
  },
  guideSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  guideTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
  },
  guideText: {
    fontSize: 9,
    color: '#6B7280',
    lineHeight: 1.6,
  },
  accessibilityBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  accessibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  watermark: {
    position: 'absolute',
    bottom: 20,
    right: 48,
    fontSize: 8,
    color: '#D1D5DB',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    fontSize: 8,
    color: '#D1D5DB',
  },
})

interface PalettePdfDocumentProps {
  palette: PaletteProposal
  brandName: string
  showWatermark?: boolean
}

export function PalettePdfDocument({
  palette,
  brandName,
  showWatermark = true,
}: PalettePdfDocumentProps) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const colorRows: { label: string; color: ColorValue }[] = [
    { label: 'Primary', color: palette.primary },
    ...palette.secondary.map((c, i) => ({ label: `Secondary ${i + 1}`, color: c })),
    { label: 'Accent', color: palette.accent },
    { label: 'Light / Background', color: palette.neutrals.light },
    { label: 'Dark / Text', color: palette.neutrals.dark },
  ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>{brandName} Color Palette</Text>
          <Text style={styles.subtitle}>
            {palette.name} — {today}
          </Text>
        </View>

        {/* コンセプト */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Concept</Text>
          <Text style={styles.concept}>{palette.concept}</Text>
        </View>

        {/* カラーリスト */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          {colorRows.map((row, i) => (
            <View key={i} style={styles.colorRow}>
              <View
                style={[styles.colorSwatch, { backgroundColor: row.color.hex }]}
              />
              <View style={styles.colorInfo}>
                <Text style={styles.colorLabel}>{row.label}</Text>
                <Text style={styles.colorName}>{row.color.name}</Text>
                <Text style={styles.colorHex}>
                  {row.color.hex.toUpperCase()} / RGB({row.color.rgb.r}, {row.color.rgb.g}, {row.color.rgb.b})
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* アクセシビリティ */}
        <View style={styles.accessibilityBox}>
          <Text style={[styles.sectionTitle, { marginBottom: 6 }]}>
            Accessibility (WCAG 2.1 AA)
          </Text>
          <View style={styles.accessibilityRow}>
            <Text style={styles.guideText}>
              Primary on Light: {palette.accessibilityScore.primaryOnLight.toFixed(1)}:1
              {palette.accessibilityScore.primaryOnLight >= 4.5 ? ' Pass' : ' Fail'}
            </Text>
          </View>
          <View style={styles.accessibilityRow}>
            <Text style={styles.guideText}>
              Primary on Dark: {palette.accessibilityScore.primaryOnDark.toFixed(1)}:1
              {palette.accessibilityScore.primaryOnDark >= 4.5 ? ' Pass' : ' Fail'}
            </Text>
          </View>
          <View style={styles.accessibilityRow}>
            <Text style={styles.guideText}>
              Accent on Light: {palette.accessibilityScore.accentOnLight.toFixed(1)}:1
              {palette.accessibilityScore.accentOnLight >= 4.5 ? ' Pass' : ' Fail'}
            </Text>
          </View>
        </View>

        {/* 使い分けガイド */}
        <View style={styles.guideSection}>
          <Text style={styles.guideTitle}>Usage Guide</Text>
          <Text style={styles.guideText}>
            {`Primary: Main brand color. Use for logos, headlines, and key UI elements.\n`}
            {`Secondary: Supporting color. Use for sub-headings, borders, and secondary elements.\n`}
            {`Accent: Call-to-action buttons, links, and highlighted elements.\n`}
            {`Light: Backgrounds and light surfaces.\n`}
            {`Dark: Body text and dark surfaces.`}
          </Text>
        </View>

        {/* 提案理由 */}
        <View style={styles.guideSection}>
          <Text style={styles.guideTitle}>Design Rationale</Text>
          <Text style={styles.guideText}>{palette.reasoning}</Text>
        </View>

        {/* フッター */}
        <Text style={styles.footer}>Page 1</Text>
        {showWatermark && (
          <Text style={styles.watermark}>Created with branding.bz</Text>
        )}
      </Page>
    </Document>
  )
}

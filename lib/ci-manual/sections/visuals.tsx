// ビジュアルセクション
import { Page, View, Text, Image } from '@react-pdf/renderer'
import type { ThemeStyles } from '../pdf-styles'
import type { CIManualData } from '../types'
import { getFontRoleLabel } from '@/lib/brand-fonts'

function SubSection({ title, children, styles }: { title: string; children: React.ReactNode; styles: ThemeStyles }) {
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const COLOR_CATEGORY_LABELS: Record<string, string> = {
  brand_colors: 'プライマリカラー',
  secondary_colors: 'セカンダリカラー',
  accent_colors: 'アクセントカラー',
  utility_colors: 'その他',
}

export function VisualsSection({ data, styles, brandColor }: { data: CIManualData; styles: ThemeStyles; brandColor: string }) {
  const vis = data.visuals
  if (!vis) return null

  const colorCategories = (['brand_colors', 'secondary_colors', 'accent_colors', 'utility_colors'] as const)
    .filter((key) => vis.color_palette[key]?.length > 0)

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* ページヘッダー */}
      <View style={styles.pageHeader} fixed>
        <Text>{data.company.name} CI Manual</Text>
      </View>

      <Text style={styles.sectionTitle}>ビジュアル</Text>

      {/* カラーパレット */}
      {colorCategories.length > 0 && (
        <SubSection title="カラーパレット" styles={styles}>
          {colorCategories.map((categoryKey) => {
            const colors = vis.color_palette[categoryKey]
            return (
              <View key={categoryKey} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#666666', marginBottom: 6 }}>
                  {COLOR_CATEGORY_LABELS[categoryKey]}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {colors.map((color, i) => (
                    <View key={i} wrap={false} style={{ width: 80, marginBottom: 8, marginRight: 8 }}>
                      <View style={{
                        width: 80,
                        height: 48,
                        backgroundColor: color.hex,
                        borderRadius: 4,
                        marginBottom: 4,
                        ...(color.hex.toLowerCase() === '#ffffff' ? { borderWidth: 0.5, borderTopColor: '#e0e0e0', borderBottomColor: '#e0e0e0', borderLeftColor: '#e0e0e0', borderRightColor: '#e0e0e0' } : {}),
                      }} />
                      <Text style={{ fontSize: 8, fontWeight: 700, color: '#333333' }}>{color.name}</Text>
                      <Text style={{ fontSize: 7, color: '#666666' }}>{color.hex.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )
          })}
        </SubSection>
      )}

      {/* フォント */}
      {vis.fonts && (
        <SubSection title="フォント" styles={styles}>
          <View style={{ flexDirection: 'row' }}>
            {/* プライマリフォント */}
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: '#666666', marginBottom: 4 }}>プライマリフォント（見出し・タイトル用）</Text>
              <View style={styles.card}>
                <Text style={{ fontSize: 11, fontFamily: 'BrandPrimary', fontWeight: 700, color: '#333333' }}>
                  {getFontRoleLabel(vis.fonts.primary_font)}
                </Text>
              </View>
            </View>
            {/* セカンダリフォント */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: '#666666', marginBottom: 4 }}>セカンダリフォント（本文・説明文用）</Text>
              <View style={styles.card}>
                <Text style={{ fontSize: 11, fontFamily: 'BrandSecondary', color: '#333333' }}>
                  {getFontRoleLabel(vis.fonts.secondary_font)}
                </Text>
              </View>
            </View>
          </View>
        </SubSection>
      )}

      {/* ロゴコンセプト */}
      {vis.logo_concept && (
        <SubSection title="ロゴコンセプト" styles={styles}>
          <Text style={styles.bodyText}>{vis.logo_concept}</Text>
        </SubSection>
      )}

      {/* ロゴセクション（画像付き） */}
      {vis.logo_sections.map((section, si) => (
        <View key={si} style={{ marginBottom: 12 }}>
          <Text style={styles.subSectionTitle}>{section.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {section.items.map((item, ii) => (
              <View key={ii} wrap={false} style={{ width: 160, marginBottom: 8, marginRight: 8 }}>
                {item.url && (
                  <Image
                    src={item.url}
                    style={{ width: 160, height: 100, backgroundColor: '#f8f8f8', borderRadius: 4, marginBottom: 4 }}
                  />
                )}
                {item.caption && <Text style={{ fontSize: 8, color: '#666666' }}>{item.caption}</Text>}
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* ビジュアルガイドライン */}
      {vis.visual_guidelines && (
        <SubSection title="ビジュアルガイドライン" styles={styles}>
          <Text style={styles.bodyText}>{vis.visual_guidelines}</Text>
        </SubSection>
      )}

      {/* ビジュアルガイドライン画像 */}
      {vis.visual_guidelines_images.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {vis.visual_guidelines_images.map((img, i) => (
            <View key={i} wrap={false} style={{ width: 160, marginBottom: 8, marginRight: 8 }}>
              {img.url && (
                <Image
                  src={img.url}
                  style={{ width: 160, height: 100, backgroundColor: '#f8f8f8', borderRadius: 4, marginBottom: 4 }}
                />
              )}
              {img.caption && <Text style={{ fontSize: 8, color: '#666666' }}>{img.caption}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* ページフッター */}
      <View style={styles.pageFooter} fixed>
        <Text>ビジュアル</Text>
        <Text render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  )
}

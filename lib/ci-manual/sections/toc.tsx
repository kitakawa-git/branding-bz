// 目次セクション
import { Page, View, Text } from '@react-pdf/renderer'
import type { ThemeStyles } from '../pdf-styles'
import type { SelectedSections } from '../types'
import { MARGIN } from '../pdf-styles'

const SECTION_LABELS: { key: keyof SelectedSections; label: string }[] = [
  { key: 'guidelines', label: 'ブランド方針' },
  { key: 'visuals', label: 'ビジュアル' },
  { key: 'verbal', label: 'バーバル' },
  { key: 'strategy', label: 'ブランド戦略' },
]

export function TOCSection({
  sections,
  styles,
  brandColor,
}: {
  sections: SelectedSections
  styles: ThemeStyles
  brandColor: string
}) {
  const activeSections = SECTION_LABELS.filter((s) => sections[s.key])

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>目次</Text>
      <View style={{ marginTop: 16 }}>
        {activeSections.map((section, index) => (
          <View
            key={section.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 0.5,
              borderBottomColor: '#e0e0e0',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: brandColor,
                width: 24,
              }}
            >
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text style={{ fontSize: 12, color: '#333333' }}>
              {section.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ページフッター */}
      <View style={styles.pageFooter}>
        <Text>{''}</Text>
        <Text render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  )
}

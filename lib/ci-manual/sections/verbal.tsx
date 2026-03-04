// バーバルセクション
import { Page, View, Text } from '@react-pdf/renderer'
import type { ThemeStyles } from '../pdf-styles'
import type { CIManualData } from '../types'

export function VerbalSection({ data, styles, brandColor }: { data: CIManualData; styles: ThemeStyles; brandColor: string }) {
  const verbal = data.verbal
  if (!verbal) return null

  // 用語をカテゴリ別にグループ化
  const termsByCategory = verbal.terms.reduce<Record<string, typeof verbal.terms>>((acc, term) => {
    const cat = term.category || '未分類'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(term)
    return acc
  }, {})
  const categories = Object.keys(termsByCategory)

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* ページヘッダー */}
      <View style={styles.pageHeader} fixed>
        <Text>{data.company.name} CI Manual</Text>
      </View>

      <Text style={styles.sectionTitle}>バーバル</Text>

      {/* トーンオブボイス */}
      {verbal.tone_of_voice && (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.subSectionTitle}>トーンオブボイス</Text>
          <Text style={styles.bodyText}>{verbal.tone_of_voice}</Text>
        </View>
      )}

      {/* 用語ルール */}
      {verbal.terms.length > 0 && (
        <View>
          <Text style={styles.subSectionTitle}>用語ルール</Text>

          {categories.map((category) => {
            const terms = termsByCategory[category]
            return (
              <View key={category} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: brandColor, marginBottom: 6 }}>
                  {category}
                </Text>

                {/* テーブルヘッダー */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: 120 }]}>推奨</Text>
                  <Text style={[styles.tableHeaderCell, { width: 120 }]}>非推奨</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>文脈・補足</Text>
                </View>

                {/* テーブル行 */}
                {terms.map((term, i) => (
                  <View key={i} style={styles.tableRow} wrap={false}>
                    <Text style={[styles.tableCell, { width: 120, fontWeight: 700, color: '#333333' }]}>
                      {term.preferred_term}
                    </Text>
                    <Text style={[styles.tableCell, { width: 120, color: '#999999', textDecoration: 'line-through' }]}>
                      {term.avoided_term}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, color: '#666666' }]}>
                      {term.context}
                    </Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      )}

      {/* ページフッター */}
      <View style={styles.pageFooter} fixed>
        <Text>バーバル</Text>
        <Text render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  )
}

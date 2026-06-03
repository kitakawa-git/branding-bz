// ブランド方針セクション
import { Page, View, Text } from '@react-pdf/renderer'
import type { ThemeStyles } from '../pdf-styles'
import type { CIManualData } from '../types'
import { splitBrandCopy, resolveTraitCopy } from '../../brand-mvv'

function SubSection({ title, children, styles }: { title: string; children: React.ReactNode; styles: ThemeStyles }) {
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function MVVBlock({ label, value, styles, brandColor }: { label: string; value: string; styles: ThemeStyles; brandColor: string }) {
  // コピー（先頭段落）と説明文を分離して表現を分ける
  const { copy, body } = splitBrandCopy(value)
  return (
    <View wrap={false} style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 9, fontWeight: 700, color: brandColor, marginBottom: 4 }}>{label}</Text>
      {copy ? <Text style={{ fontSize: 12, fontWeight: 700, color: '#333333' }}>{copy}</Text> : null}
      {body ? <Text style={{ fontSize: 9, color: '#666666', lineHeight: 1.5, marginTop: 2 }}>{body}</Text> : null}
    </View>
  )
}

export function GuidelinesSection({ data, styles, brandColor }: { data: CIManualData; styles: ThemeStyles; brandColor: string }) {
  const gl = data.guidelines
  if (!gl) return null

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* ページヘッダー */}
      <View style={styles.pageHeader} fixed>
        <Text>{data.company.name} CI Manual</Text>
      </View>

      <Text style={styles.sectionTitle}>ブランド方針</Text>

      {/* スローガン */}
      {gl.slogan && (
        <View wrap={false} style={{ marginBottom: 20, paddingVertical: 16, borderTopWidth: 2, borderBottomWidth: 2, borderTopColor: brandColor, borderBottomColor: brandColor, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: 700, color: brandColor, textAlign: 'center' }}>{gl.slogan}</Text>
        </View>
      )}

      {/* ミッション・ビジョン */}
      {(gl.mission || gl.vision) && (
        <SubSection title="ミッション・ビジョン" styles={styles}>
          {gl.mission && <MVVBlock label="Mission" value={gl.mission} styles={styles} brandColor={brandColor} />}
          {gl.vision && <MVVBlock label="Vision" value={gl.vision} styles={styles} brandColor={brandColor} />}
        </SubSection>
      )}

      {/* バリューズ */}
      {gl.values.length > 0 && (
        <SubSection title="バリューズ" styles={styles}>
          {gl.values.map((v, i) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 6, paddingLeft: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: brandColor, width: 16 }}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#333333' }}>{v.name}</Text>
                {v.description && <Text style={{ fontSize: 9, color: '#666666', marginTop: 2, lineHeight: 1.5 }}>{v.description}</Text>}
              </View>
            </View>
          ))}
        </SubSection>
      )}

      {/* ブランドステートメント */}
      {gl.brand_statement && (
        <SubSection title="ブランドステートメント" styles={styles}>
          <Text style={styles.bodyText}>{gl.brand_statement}</Text>
        </SubSection>
      )}

      {/* ブランドストーリー */}
      {gl.brand_story && (
        <SubSection title="ブランドストーリー" styles={styles}>
          <Text style={styles.bodyText}>{gl.brand_story}</Text>
        </SubSection>
      )}

      {/* 沿革 */}
      {gl.history.length > 0 && (
        <SubSection title="沿革" styles={styles}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: 80 }]}>年</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>出来事</Text>
          </View>
          {gl.history.map((h, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[styles.tableCell, { width: 80, fontWeight: 700 }]}>{h.year}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{h.event}</Text>
            </View>
          ))}
        </SubSection>
      )}

      {/* 事業内容 */}
      {gl.business_content.length > 0 && (
        <SubSection title="事業内容" styles={styles}>
          {gl.business_content.map((b, i) => (
            <View key={i} wrap={false} style={styles.card}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#333333', marginBottom: 2 }}>{b.title}</Text>
              {b.description && <Text style={{ fontSize: 9, color: '#666666', lineHeight: 1.5 }}>{b.description}</Text>}
            </View>
          ))}
        </SubSection>
      )}

      {/* 特性 */}
      {gl.traits.length > 0 && (
        <SubSection title="ブランドパーソナリティ" styles={styles}>
          {gl.traits.map((t, i) => {
            const { copy, description } = resolveTraitCopy(t)
            return (
            <View key={i} wrap={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#333333' }}>{t.name}</Text>
                <Text style={{ fontSize: 9, color: '#666666' }}>{t.score}/5</Text>
              </View>
              {/* スコアバー */}
              <View style={{ height: 6, backgroundColor: '#e8e8e8', borderRadius: 3 }}>
                <View style={{ height: 6, width: `${t.score * 20}%`, backgroundColor: brandColor, borderRadius: 3 }} />
              </View>
              {copy ? <Text style={{ fontSize: 8.5, fontWeight: 700, color: '#444444', marginTop: 2 }}>{copy}</Text> : null}
              {description ? <Text style={{ fontSize: 8, color: '#888888', marginTop: 1 }}>{description}</Text> : null}
            </View>
            )
          })}
        </SubSection>
      )}

      {/* ページフッター */}
      <View style={styles.pageFooter} fixed>
        <Text>ブランド方針</Text>
        <Text render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  )
}

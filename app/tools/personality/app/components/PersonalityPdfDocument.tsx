// ブランドパーソナリティ診断レポート PDFテンプレート（@react-pdf/renderer）
// 選択フレームワークの結果＋パーソナリティ概要＋トーン＋期待タグを出力する（STP PDFと同体裁）。
// アーキタイプ・Aaker軸の文言は archetypes.ts の定数（コピー定義v1）をそのまま使用。
import { Document, Page, View, Text, StyleSheet, Font, Svg, Polygon, Line, Text as SvgText } from '@react-pdf/renderer'
import path from 'path'
import { ARCHETYPE_BY_KEY, AAKER_BY_DIMENSION, AAKER_CITATION, type ArchetypeKey, type AakerDimension } from '../../lib/archetypes'
import type { DiagnosisResult } from '../../lib/diagnosis'

// NotoSansJP フォント登録（STP PDFと同パターン）
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

Font.registerHyphenationCallback((word) => [word])

const FONT = 'NotoSansJP'
const BLUE = '#2563eb'

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: '#333333',
    fontFamily: FONT,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#111827',
  },
  subtitle: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 8,
  },
  section: {
    marginBottom: 18,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  bodyText: {
    fontSize: 9,
    color: '#4B5563',
    lineHeight: 1.6,
  },
  chip: {
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    fontSize: 8,
    color: BLUE,
    marginRight: 6,
  },
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#9CA3AF',
  },
})

// ----- Aaker レーダーチャート（Svg五角形） -----

function RadarSvg({ scores }: { scores: DiagnosisResult['aaker_scores'] }) {
  const SIZE = 240
  const CX = SIZE / 2
  const CY = SIZE / 2 + 4
  const R = 82
  const N = scores.length

  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / N - Math.PI / 2
    return { x: CX + R * ratio * Math.cos(angle), y: CY + R * ratio * Math.sin(angle) }
  }
  const ringPoints = (ratio: number) =>
    Array.from({ length: N }, (_, i) => {
      const p = point(i, ratio)
      return `${p.x},${p.y}`
    }).join(' ')

  const dataPoints = scores
    .map((s, i) => {
      const p = point(i, Math.min(5, Math.max(0, s.score)) / 5)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <Svg width={SIZE} height={SIZE}>
      {/* グリッド（1〜5の五角形リング） */}
      {[1, 2, 3, 4, 5].map(level => (
        <Polygon
          key={level}
          points={ringPoints(level / 5)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={0.8}
        />
      ))}
      {/* 軸線 */}
      {scores.map((_, i) => {
        const p = point(i, 1)
        return <Line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth={0.8} />
      })}
      {/* データポリゴン */}
      <Polygon points={dataPoints} fill={BLUE} fillOpacity={0.18} stroke={BLUE} strokeWidth={1.6} />
      {/* 軸ラベル（label＋score） */}
      {scores.map((s, i) => {
        const p = point(i, 1.18)
        return (
          <SvgText
            key={i}
            x={p.x}
            y={p.y + 3}
            style={{ fontSize: 8, fontFamily: FONT, fill: '#374151', textAnchor: 'middle' as unknown as undefined }}
          >
            {`${s.label} ${s.score}`}
          </SvgText>
        )
      })}
    </Svg>
  )
}

// ----- 本体 -----

export interface PersonalityPdfData {
  companyName: string
  framework: 'aaker' | 'archetype'
  diagnosis: DiagnosisResult & { adjusted?: boolean }
  generatedDate: string
}

export function PersonalityPdfDocument({ data }: { data: PersonalityPdfData }) {
  const { companyName, framework, diagnosis: d, generatedDate } = data
  const primaryDef = ARCHETYPE_BY_KEY[d.archetype.primary.key as ArchetypeKey]
  const secondaryDef = ARCHETYPE_BY_KEY[d.archetype.secondary.key as ArchetypeKey]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>ブランドパーソナリティ診断レポート</Text>
          <Text style={styles.subtitle}>
            {companyName}　|　診断日: {generatedDate}　|　{framework === 'aaker' ? 'Aaker 5次元（スコア型）' : '12アーキタイプ（タイプ型）'}
            {d.adjusted ? '　|　※スコア調整済み' : ''}
          </Text>
        </View>

        {/* 選択フレームワークの結果 */}
        {framework === 'aaker' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5次元スコア</Text>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <RadarSvg scores={d.aaker_scores} />
            </View>
            {d.aaker_scores.map(s => {
              const def = AAKER_BY_DIMENSION[s.dimension as AakerDimension]
              return (
                <View key={s.dimension} style={styles.card} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>
                      {s.label}
                      {s.copy ? `　${s.copy}` : ''}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: BLUE }}>{s.score}/5</Text>
                  </View>
                  {/* スコアバー */}
                  <View style={{ height: 5, backgroundColor: '#E8E8E8', borderRadius: 2.5, marginBottom: 4 }}>
                    <View style={{ height: 5, width: `${s.score * 20}%`, backgroundColor: BLUE, borderRadius: 2.5 }} />
                  </View>
                  {s.description ? <Text style={styles.bodyText}>{s.description}</Text> : null}
                  {def ? (
                    <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 3, lineHeight: 1.5 }}>
                      {def.label}（{def.copy}）: {def.description}
                    </Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>アーキタイプ</Text>
            {/* 主人格カード */}
            {primaryDef ? (
              <View style={[styles.card, { borderColor: BLUE, borderWidth: 1.5 }]} wrap={false}>
                <Text style={{ fontSize: 8, color: BLUE, marginBottom: 2 }}>主人格</Text>
                <Text style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{primaryDef.label}</Text>
                <Text style={{ fontSize: 10, fontWeight: 700, color: BLUE, marginTop: 2 }}>{primaryDef.copy}</Text>
                <Text style={[styles.bodyText, { marginTop: 5 }]}>{primaryDef.description}</Text>
                <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 5 }}>
                  キーワード: {primaryDef.keywords.join('・')}
                </Text>
                {d.archetype.primary.description ? (
                  <Text style={[styles.bodyText, { marginTop: 5 }]}>
                    このブランドでは: {d.archetype.primary.description}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {/* 副人格カード */}
            {secondaryDef ? (
              <View style={styles.card} wrap={false}>
                <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 2 }}>副人格</Text>
                <Text style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                  {secondaryDef.label}
                  <Text style={{ fontSize: 9, fontWeight: 400, color: '#6B7280' }}>　{secondaryDef.copy}</Text>
                </Text>
                <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 4 }}>
                  キーワード: {secondaryDef.keywords.join('・')}
                </Text>
              </View>
            ) : null}
            {/* 特性 */}
            {d.archetype_traits?.length > 0 ? (
              <View style={styles.card} wrap={false}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                  この型から導かれる特性
                </Text>
                {d.archetype_traits.map((t, i) => (
                  <View key={i} style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: 700, color: '#374151' }}>
                        {t.name}
                        {t.copy ? `　${t.copy}` : ''}
                      </Text>
                      <Text style={{ fontSize: 9, color: BLUE }}>{t.score}/5</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: '#E8E8E8', borderRadius: 2 }}>
                      <View style={{ height: 4, width: `${t.score * 20}%`, backgroundColor: BLUE, borderRadius: 2 }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* パーソナリティ概要 */}
        {d.personality_summary ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>パーソナリティ概要</Text>
            <View style={styles.card}>
              <Text style={styles.bodyText}>{d.personality_summary}</Text>
            </View>
          </View>
        ) : null}

        {/* トーン */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>トーン</Text>
          {d.tone_of_voice ? (
            <View style={styles.card}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 3 }}>トーンオブボイス</Text>
              <Text style={styles.bodyText}>{d.tone_of_voice}</Text>
            </View>
          ) : null}
          {d.communication_style ? (
            <View style={styles.card}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: '#374151', marginBottom: 3 }}>コミュニケーションスタイル</Text>
              <Text style={styles.bodyText}>{d.communication_style}</Text>
            </View>
          ) : null}
        </View>

        {/* 期待タグ */}
        {d.expected_tags?.length > 0 ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>期待される印象タグ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {d.expected_tags.map(t => (
                <Text key={t} style={styles.chip}>{t}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* 出典表記 */}
        <Text style={{ fontSize: 7.5, color: '#9CA3AF', marginTop: 4 }}>{AAKER_CITATION}</Text>

        {/* フッター */}
        <View style={styles.pageFooter} fixed>
          <Text>branding.bz — ブランドパーソナリティ診断</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

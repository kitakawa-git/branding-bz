// STP分析レポート PDFテンプレート（@react-pdf/renderer）
import { Document, Page, View, Text, StyleSheet, Font, Svg, Circle, Line, G } from '@react-pdf/renderer'
import path from 'path'

// NotoSansJP フォント登録
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

// 型定義
interface SegmentationVariable {
  name: string
  segments: Array<{
    name: string
    description: string
    size_hint: string
    selected: boolean
  }>
}

interface TargetingEvaluation {
  segment_name: string
  attractiveness: number
  competitiveness: number
  priority: string
}

interface PositioningItem {
  name: string
  x: number
  y: number
  color: string
  is_self: boolean
}

interface StpPdfData {
  companyName: string
  segmentation: {
    variables: SegmentationVariable[]
  }
  targeting: {
    evaluations: TargetingEvaluation[]
    main_target: string
    sub_targets: string[]
    target_description: string
  }
  positioning: {
    x_axis: { left: string; right: string }
    y_axis: { bottom: string; top: string }
    items: PositioningItem[]
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: '#333333',
    fontFamily: FONT,
  },
  header: {
    marginBottom: 24,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
  },
  variableGroup: {
    marginBottom: 12,
  },
  variableName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  segmentBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  segmentBadgeText: {
    fontSize: 9,
    color: '#1D4ED8',
  },
  targetCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  targetCardLabel: {
    fontSize: 8,
    color: '#3B82F6',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  targetCardName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 4,
  },
  targetCardEval: {
    fontSize: 9,
    color: '#6B7280',
  },
  subTargetCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  subTargetLabel: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  subTargetName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#93C5FD',
    paddingLeft: 12,
    marginTop: 10,
  },
  quoteText: {
    fontSize: 10,
    color: '#4B5563',
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 9,
    color: '#374151',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#D1D5DB',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginVertical: 16,
  },
})

// ★表示ヘルパー
function stars(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(5 - count)
}

// ポジショニングマップ SVG（react-pdf用）
function PdfPositioningMap({
  positioning,
}: {
  positioning: StpPdfData['positioning']
}) {
  const W = 400
  const H = 300
  const PAD = 40

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 背景 */}
      <G>
        {/* 軸線 */}
        <Line
          x1={PAD} y1={H / 2}
          x2={W - PAD} y2={H / 2}
          stroke="#E5E7EB" strokeWidth={1}
        />
        <Line
          x1={W / 2} y1={PAD}
          x2={W / 2} y2={H - PAD}
          stroke="#E5E7EB" strokeWidth={1}
        />

        {/* 軸ラベル */}
        <Text x={PAD} y={H / 2 - 8} style={{ fontSize: 8, fontFamily: FONT, color: '#9CA3AF' }}>
          {positioning.x_axis.left}
        </Text>
        <Text x={W - PAD - 2} y={H / 2 - 8} style={{ fontSize: 8, fontFamily: FONT, color: '#9CA3AF', textAnchor: 'end' as unknown as undefined }}>
          {positioning.x_axis.right}
        </Text>
        <Text x={W / 2 + 4} y={PAD + 4} style={{ fontSize: 8, fontFamily: FONT, color: '#9CA3AF' }}>
          {positioning.y_axis.top}
        </Text>
        <Text x={W / 2 + 4} y={H - PAD + 12} style={{ fontSize: 8, fontFamily: FONT, color: '#9CA3AF' }}>
          {positioning.y_axis.bottom}
        </Text>

        {/* アイテム */}
        {positioning.items.map((item, i) => {
          const cx = PAD + (item.x / 100) * (W - 2 * PAD)
          const cy = (H - PAD) - (item.y / 100) * (H - 2 * PAD)
          const r = item.is_self ? 10 : 7
          return (
            <G key={i}>
              <Circle cx={cx} cy={cy} r={r} fill={item.color} opacity={0.85} />
              <Text
                x={cx}
                y={cy + r + 10}
                style={{ fontSize: 7, fontFamily: FONT, color: '#374151', textAnchor: 'middle' as unknown as undefined }}
              >
                {item.name}
              </Text>
            </G>
          )
        })}
      </G>
    </Svg>
  )
}

export function StpPdfDocument({ data }: { data: StpPdfData }) {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // メインターゲットの評価データ
  const mainEval = data.targeting.evaluations.find(
    (e) => e.segment_name === data.targeting.main_target
  )

  return (
    <Document>
      {/* ページ1: S + T */}
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>STP分析レポート</Text>
          <Text style={styles.subtitle}>
            {data.companyName} — {today}
          </Text>
        </View>

        {/* S — セグメンテーション */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>S</Text>
          <Text style={styles.sectionTitle}>セグメンテーション</Text>
        </View>

        {(data.segmentation.variables || []).map((variable, vi) => {
          const selectedSegments = variable.segments.filter((s) => s.selected)
          if (selectedSegments.length === 0) return null
          return (
            <View key={vi} style={styles.variableGroup}>
              <Text style={styles.variableName}>{variable.name}</Text>
              <View style={styles.segmentRow}>
                {selectedSegments.map((seg, si) => (
                  <View key={si} style={styles.segmentBadge}>
                    <Text style={styles.segmentBadgeText}>{seg.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })}

        <View style={styles.divider} />

        {/* T — ターゲティング */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>T</Text>
          <Text style={styles.sectionTitle}>ターゲティング</Text>
        </View>

        {/* メインターゲット */}
        <View style={styles.targetCard}>
          <Text style={styles.targetCardLabel}>メインターゲット</Text>
          <Text style={styles.targetCardName}>
            {data.targeting.main_target || '未選択'}
          </Text>
          {data.targeting.target_description && (
            <Text style={{ fontSize: 9, color: '#4B5563', marginTop: 3, lineHeight: 1.5 }}>
              {data.targeting.target_description}
            </Text>
          )}
          {mainEval && (
            <Text style={styles.targetCardEval}>
              市場の魅力度: {stars(mainEval.attractiveness)}　自社の競争力: {stars(mainEval.competitiveness)}
            </Text>
          )}
        </View>

        {/* サブターゲット */}
        {data.targeting.sub_targets.length > 0 ? (
          data.targeting.sub_targets.map((sub, i) => {
            const subEval = data.targeting.evaluations.find(
              (e) => e.segment_name === sub
            )
            return (
              <View key={i} style={styles.subTargetCard}>
                <Text style={styles.subTargetLabel}>サブターゲット {i + 1}</Text>
                <Text style={styles.subTargetName}>{sub}</Text>
                {subEval && (
                  <Text style={[styles.targetCardEval, { marginTop: 2 }]}>
                    魅力度: {stars(subEval.attractiveness)}　競争力: {stars(subEval.competitiveness)}
                  </Text>
                )}
              </View>
            )
          })
        ) : (
          <View style={styles.subTargetCard}>
            <Text style={[styles.subTargetName, { color: '#9CA3AF' }]}>
              サブターゲット: なし
            </Text>
          </View>
        )}

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Page 1</Text>
          <Text style={styles.footerText}>Powered by branding.bz</Text>
        </View>
      </Page>

      {/* ページ2: P（ポジショニングマップ） */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>P</Text>
          <Text style={styles.sectionTitle}>ポジショニング</Text>
        </View>

        {/* マップ */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <PdfPositioningMap positioning={data.positioning} />
        </View>

        {/* 凡例 */}
        <View style={styles.legendRow}>
          {(data.positioning.items || []).map((item, i) => (
            <View key={i} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendText}>
                {item.name}
                {item.is_self ? '（自社）' : ''}
              </Text>
            </View>
          ))}
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Page 2</Text>
          <Text style={styles.footerText}>Powered by branding.bz</Text>
        </View>
      </Page>
    </Document>
  )
}

// ブランド戦略セクション（ターゲット・ペルソナ・ポジショニングマップ・行動指針）
import { Page, View, Text, Svg, Line, Circle, G } from '@react-pdf/renderer'
import type { ThemeStyles } from '../pdf-styles'
import type { CIManualData, PositioningMapData } from '../types'

function SubSection({ title, children, styles }: { title: string; children: React.ReactNode; styles: ThemeStyles }) {
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

// ポジショニングマップ SVG（@react-pdf/renderer用）
function PositioningMapSvg({ mapData, brandColor }: { mapData: PositioningMapData; brandColor: string }) {
  const W = 300
  const H = 240
  const PAD = 40
  const CX = W / 2
  const CY = H / 2

  const sizeMap: Record<string, number> = { sm: 6, md: 9, lg: 12 }

  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* 軸線 */}
        <Line x1={PAD} y1={CY} x2={W - PAD} y2={CY} stroke="#cccccc" strokeWidth={0.5} />
        <Line x1={CX} y1={PAD} x2={CX} y2={H - PAD} stroke="#cccccc" strokeWidth={0.5} />

        {/* アイテム */}
        {mapData.items.map((item, i) => {
          const x = PAD + ((W - PAD * 2) * item.x) / 100
          const y = H - PAD - ((H - PAD * 2) * item.y) / 100
          const r = sizeMap[item.size] || (item.customSize ? item.customSize * 0.6 : 9)
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={r} fill={item.color || brandColor} opacity={0.7} />
            </G>
          )
        })}
      </Svg>

      {/* 軸ラベル */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: W, paddingHorizontal: 8 }}>
        <Text style={{ fontSize: 7, color: '#999999' }}>{mapData.x_axis.left}</Text>
        <Text style={{ fontSize: 7, color: '#999999' }}>{mapData.x_axis.right}</Text>
      </View>

      {/* 凡例 */}
      {mapData.items.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, justifyContent: 'center' }}>
          {mapData.items.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color || brandColor, marginRight: 3 }} />
              <Text style={{ fontSize: 7, color: '#666666' }}>{item.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export function StrategySection({ data, styles, brandColor }: { data: CIManualData; styles: ThemeStyles; brandColor: string }) {
  const strategy = data.strategy
  if (!strategy) return null

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* ページヘッダー */}
      <View style={styles.pageHeader} fixed>
        <Text>{data.company.name} CI Manual</Text>
      </View>

      <Text style={styles.sectionTitle}>ブランド戦略</Text>

      {/* ターゲット */}
      {strategy.target && (
        <SubSection title="ターゲット" styles={styles}>
          <Text style={styles.bodyText}>{strategy.target}</Text>
        </SubSection>
      )}

      {/* ペルソナ */}
      {strategy.personas.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.subSectionTitle}>ペルソナ</Text>
          {strategy.personas.map((persona, i) => (
            <View key={i} wrap={false} style={[styles.card, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#333333' }}>{persona.name}</Text>
                <Text style={{ fontSize: 8, color: '#888888' }}>
                  {[persona.age_range, persona.occupation].filter(Boolean).join(' / ')}
                </Text>
              </View>
              {persona.description && (
                <Text style={{ fontSize: 9, color: '#555555', lineHeight: 1.5, marginBottom: 6 }}>
                  {persona.description}
                </Text>
              )}

              <View style={{ flexDirection: 'row' }}>
                {/* ニーズ */}
                {persona.needs.length > 0 && (
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 8, fontWeight: 700, color: brandColor, marginBottom: 3 }}>ニーズ</Text>
                    {persona.needs.map((need, ni) => (
                      <Text key={ni} style={{ fontSize: 8, color: '#666666', marginBottom: 1 }}>
                        ・{need}
                      </Text>
                    ))}
                  </View>
                )}
                {/* ペインポイント */}
                {persona.pain_points.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, fontWeight: 700, color: '#cc3333', marginBottom: 3 }}>課題</Text>
                    {persona.pain_points.map((pp, pi) => (
                      <Text key={pi} style={{ fontSize: 8, color: '#666666', marginBottom: 1 }}>
                        ・{pp}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ポジショニングマップ */}
      {strategy.positioning_map_data && strategy.positioning_map_data.items.length > 0 && (
        <SubSection title="ポジショニングマップ" styles={styles}>
          <PositioningMapSvg mapData={strategy.positioning_map_data} brandColor={brandColor} />
        </SubSection>
      )}

      {/* 行動指針 */}
      {strategy.action_guidelines.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={styles.subSectionTitle}>行動指針</Text>
          {strategy.action_guidelines.map((ag, i) => (
            <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 8, paddingLeft: 4 }}>
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: brandColor,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
                marginTop: 1,
              }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: '#ffffff' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#333333' }}>{ag.title}</Text>
                {ag.description && (
                  <Text style={{ fontSize: 9, color: '#666666', lineHeight: 1.5, marginTop: 2 }}>
                    {ag.description}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ページフッター */}
      <View style={styles.pageFooter} fixed>
        <Text>ブランド戦略</Text>
        <Text render={({ pageNumber }) => `${pageNumber}`} />
      </View>
    </Page>
  )
}

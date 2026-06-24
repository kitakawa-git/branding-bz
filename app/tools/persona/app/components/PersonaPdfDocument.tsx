// ペルソナビルダー レポート PDFテンプレート（@react-pdf/renderer）
// セグメント（ターゲット）ごとにペルソナを並べ、属性＋ニーズ/課題/意思決定要因を出力（STP/パーソナリティPDFと同体裁）。
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// NotoSansJP フォント登録（STP/パーソナリティ PDF と同パターン）
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

export interface PersonaPdfMember {
  name: string
  meta: string // 年齢層 / 性別 / 職業 などを連結した1行
  needs: string[]
  pains: string[]
  decisionFactors: string[]
}
export interface PersonaPdfGroup {
  name: string
  description?: string
  members: PersonaPdfMember[]
}
export interface PersonaPdfData {
  companyName: string
  generatedDate: string
  groups: PersonaPdfGroup[]
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: '#333333', fontFamily: FONT },
  header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 14 },
  title: { fontSize: 18, fontWeight: 700, color: '#111827' },
  subtitle: { fontSize: 10, color: '#6B7280', marginTop: 4 },
  group: { marginBottom: 18 },
  groupName: { fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 2 },
  groupDesc: { fontSize: 9, color: '#6B7280', marginBottom: 8 },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, padding: 12, marginBottom: 8, backgroundColor: '#FFFFFF' },
  personaName: { fontSize: 12, fontWeight: 700, color: '#111827' },
  meta: { fontSize: 9, color: '#6B7280', marginTop: 2, marginBottom: 8 },
  fieldLabel: { fontSize: 8, fontWeight: 700, color: '#6B7280', marginTop: 6, marginBottom: 3 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { fontSize: 8, color: '#1E3A8A', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 6 },
  empty: { fontSize: 8, color: '#9CA3AF' },
})

function TagSection({ label, items }: { label: string; items: string[] }) {
  const list = (items || []).map(s => (s || '').trim()).filter(Boolean)
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {list.length > 0 ? (
        <View style={styles.tagRow}>
          {list.map((t, i) => <Text key={i} style={styles.tag}>{t}</Text>)}
        </View>
      ) : (
        <Text style={styles.empty}>—</Text>
      )}
    </View>
  )
}

export function PersonaPdfDocument({ data }: { data: PersonaPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>ペルソナ</Text>
          <Text style={styles.subtitle}>{data.companyName}　|　作成日 {data.generatedDate}</Text>
        </View>

        {data.groups.map((group, gi) => (
          <View key={gi} style={styles.group} wrap={false}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? <Text style={styles.groupDesc}>{group.description}</Text> : null}
            {group.members.map((m, mi) => (
              <View key={mi} style={styles.card} wrap={false}>
                <Text style={styles.personaName}>{m.name}</Text>
                {m.meta ? <Text style={styles.meta}>{m.meta}</Text> : null}
                <TagSection label="ニーズ" items={m.needs} />
                <TagSection label="課題・ペインポイント" items={m.pains} />
                <TagSection label="意思決定要因" items={m.decisionFactors} />
              </View>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}

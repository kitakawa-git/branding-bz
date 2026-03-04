// 表紙セクション
import { Page, View, Text, Image } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import type { CIManualData } from '../types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'BrandPrimary',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  companyName: {
    fontSize: 28,
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 4,
  },
  date: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#cccccc',
  },
})

export function CoverSection({ data }: { data: CIManualData }) {
  const today = new Date()
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`

  return (
    <Page size="A4" style={styles.page}>
      {/* 背景: コンセプトビジュアルまたはブランドカラーベタ塗り */}
      {data.guidelines?.concept_visual_url ? (
        <Image
          src={data.guidelines.concept_visual_url}
          style={styles.backgroundImage}
        />
      ) : null}
      {/* ダークオーバーレイ */}
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: data.guidelines?.concept_visual_url
              ? '#000000'
              : data.brandColor,
            opacity: data.guidelines?.concept_visual_url ? 0.5 : 1,
          },
        ]}
      />

      {/* コンテンツ */}
      <View style={styles.content}>
        {data.company.logo_url && (
          <Image src={data.company.logo_url} style={styles.logo} />
        )}
        <Text style={styles.companyName}>{data.company.name}</Text>
        <Text style={styles.subtitle}>CI Manual</Text>
      </View>

      <Text style={styles.date}>{dateStr}</Text>
    </Page>
  )
}

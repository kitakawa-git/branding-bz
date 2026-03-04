// 奥付セクション
import { Page, View, Text } from '@react-pdf/renderer'
import { StyleSheet } from '@react-pdf/renderer'
import type { CIManualData } from '../types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'BrandPrimary',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  container: {
    alignItems: 'center',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#333333',
    marginBottom: 16,
  },
  separator: {
    width: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    marginBottom: 16,
  },
  date: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 8,
  },
  powered: {
    fontSize: 8,
    color: '#999999',
    marginTop: 24,
  },
})

export function ColophonSection({ data }: { data: CIManualData }) {
  const today = new Date()
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 発行`

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.container}>
        <Text style={styles.companyName}>{data.company.name}</Text>
        <View style={styles.separator} />
        <Text style={styles.date}>{dateStr}</Text>
        <Text style={styles.powered}>Powered by brandconnect</Text>
      </View>
    </Page>
  )
}

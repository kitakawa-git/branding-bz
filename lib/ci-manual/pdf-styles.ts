// CIマニュアル PDF 共有スタイル
import { StyleSheet } from '@react-pdf/renderer'

// A4サイズ（ポイント単位）
export const A4 = { width: 595.28, height: 841.89 }
export const MARGIN = { top: 56, right: 42, bottom: 56, left: 42 }

export function createThemeStyles(brandColor?: string) {
  const c = brandColor || '#1a1a1a'
  return StyleSheet.create({
    // ページ基本
    page: {
      fontFamily: 'BrandSecondary',
      fontSize: 10,
      paddingTop: MARGIN.top,
      paddingRight: MARGIN.right,
      paddingBottom: MARGIN.bottom,
      paddingLeft: MARGIN.left,
      color: '#333333',
    },

    // ページヘッダー（セクション名表示）
    pageHeader: {
      position: 'absolute',
      top: 20,
      left: MARGIN.left,
      right: MARGIN.right,
      borderBottomWidth: 1,
      borderBottomColor: c,
      paddingBottom: 6,
      fontSize: 7,
      color: '#999999',
    },

    // ページフッター（ページ番号）
    pageFooter: {
      position: 'absolute',
      bottom: 20,
      left: MARGIN.left,
      right: MARGIN.right,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#999999',
    },

    // セクションタイトル
    sectionTitle: {
      fontFamily: 'BrandPrimary',
      fontSize: 18,
      fontWeight: 700,
      color: c,
      marginBottom: 16,
      borderBottomWidth: 2,
      borderBottomColor: c,
      paddingBottom: 8,
    },

    // サブセクションタイトル
    subSectionTitle: {
      fontFamily: 'BrandPrimary',
      fontSize: 13,
      fontWeight: 700,
      color: '#333333',
      marginBottom: 8,
      marginTop: 20,
    },

    // 本文テキスト
    bodyText: {
      fontSize: 10,
      lineHeight: 1.7,
      color: '#333333',
    },

    // ラベル（小見出し）
    label: {
      fontSize: 8,
      fontWeight: 700,
      color: '#666666',
      marginBottom: 4,
      letterSpacing: 0.5,
    },

    // カード風ブロック
    card: {
      backgroundColor: '#f8f8f8',
      borderRadius: 6,
      padding: 12,
      marginBottom: 8,
    },

    // テーブル行
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#e0e0e0',
      paddingVertical: 6,
    },

    // テーブルヘッダー行
    tableHeaderRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: c,
      paddingVertical: 6,
      backgroundColor: '#f8f8f8',
    },

    // テーブルセル
    tableCell: {
      fontSize: 9,
      color: '#333333',
      paddingHorizontal: 4,
    },

    // テーブルヘッダーセル
    tableHeaderCell: {
      fontSize: 8,
      fontWeight: 700,
      color: '#666666',
      paddingHorizontal: 4,
    },

    // 区切り線
    separator: {
      borderBottomWidth: 0.5,
      borderBottomColor: '#e0e0e0',
      marginVertical: 12,
    },
  })
}

export type ThemeStyles = ReturnType<typeof createThemeStyles>

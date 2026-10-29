// 日程調整ツール — 共有リンクの画面（ログイン不要）
// 回答の集計・回答表・回答フォーム。作成者本人には編集・削除も出す
import type { Metadata } from 'next'
import { SorouHeader } from '../../components/SorouHeader'
import Footer from '@/components/Footer'
import { EventView } from './EventView'

export const metadata: Metadata = {
  title: '日程調整',
  // 共有リンクは参加者だけが見るもの。検索に出さない
  robots: { index: false, follow: false },
}

export default async function SorouEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SorouHeader />
      <main className="flex-1">
        <EventView id={id} />
      </main>
      <Footer />
    </div>
  )
}

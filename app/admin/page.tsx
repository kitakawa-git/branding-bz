// 管理画面ルート: ダッシュボードの先頭タブ（ブランドスコア）にリダイレクト。
// /admin/dashboard はタブの1つ（Good Job投稿分析）であって入口ではない
import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/admin/brand-score')
}

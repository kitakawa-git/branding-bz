'use client'

// スーパー管理画面: ニュース新規作成ページ
import NewsForm from '../_components/NewsForm'

export default function NewNewsPage() {
  return (
    <div>
      {/* タイトルはヘッダーのパンくずに移動 */}
      <NewsForm />
    </div>
  )
}

'use client'

// スーパー管理画面: ニュース編集ページ
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NewsForm from '../../_components/NewsForm'
import type { NewsItem } from '@/lib/types/news'

export default function EditNewsPage() {
  const params = useParams()
  const id = params.id as string
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetch = async () => {
      const { data, error: err } = await supabase
        .from('news')
        .select('*')
        .eq('id', id)
        .single()

      if (err || !data) {
        setError('ニュースが見つかりません')
        setLoading(false)
        return
      }

      setItem(data as NewsItem)
      setLoading(false)
    }

    fetch()
  }, [id])

  if (loading) {
    return (
      <p className="text-muted-foreground text-center p-10">
        読み込み中...
      </p>
    )
  }

  if (error || !item) {
    return (
      <p className="text-destructive text-center p-10">
        {error || 'ニュースが見つかりません'}
      </p>
    )
  }

  return (
    <div>
      {/* タイトルはヘッダーのパンくずに移動 */}
      <NewsForm initialData={item} />
    </div>
  )
}

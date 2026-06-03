'use client'

// スーパー管理画面: ニュース一覧ページ
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'
import { NewsCreateDialog } from './NewsCreateDialog'

// カテゴリバッジの色分け
const CATEGORY_STYLES: Record<NewsCategory, string> = {
  press_release: 'bg-blue-50 text-blue-700',
  service_update: 'bg-green-50 text-green-700',
  media: 'bg-purple-50 text-purple-700',
  announcement: 'bg-gray-100 text-gray-700',
}

export default function SuperAdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[SuperAdmin/News] 取得エラー:', error.message)
        setLoading(false)
        return
      }

      setNews((data || []) as NewsItem[])
    } catch (err) {
      console.error('[SuperAdmin/News] 取得例外:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNews()
  }, [])

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`「${title}」を削除しますか？この操作は元に戻せません。`)) return

    try {
      const { error } = await supabase.from('news').delete().eq('id', id)
      if (error) throw error
      toast.success('ニュースを削除しました')
      // リフレッシュ
      setNews(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('[SuperAdmin/News] 削除エラー:', err)
      toast.error('削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground text-center p-10">
        読み込み中...
      </p>
    )
  }

  return (
    <div>
      {/* 新規作成 FAB（右下固定・include-bz node の FabButton と同装飾） */}
      <Fab>
        <FabButton onClick={() => setCreateOpen(true)} icon={<Plus size={16} />}>
          新規作成
        </FabButton>
      </Fab>

      {/* ニュース作成モーダル */}
      <NewsCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchNews}
      />

      {/* テーブル */}
      <Card className="bg-muted/50 border shadow-none">
        <CardContent className="p-6">
          {news.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">
              ニュースデータがありません
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">公開日</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">カテゴリ</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">タイトル</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs text-center">状態</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {news.map((item) => (
                  <tr key={item.id}>
                    {/* 公開日 */}
                    <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px] whitespace-nowrap">
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString('ja-JP')
                        : '—'}
                    </td>
                    {/* カテゴリ */}
                    <td className="px-4 py-3 border-b border-border">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[item.category]}`}>
                        {NEWS_CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    {/* タイトル */}
                    <td className="px-4 py-3 border-b border-border text-foreground font-semibold">
                      {item.title}
                    </td>
                    {/* 公開状態 */}
                    <td className="px-4 py-3 border-b border-border text-center">
                      {item.is_published ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          公開
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          下書き
                        </span>
                      )}
                    </td>
                    {/* 操作 */}
                    <td className="px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/superadmin/news/${item.id}/edit`)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleDelete(item.id, item.title)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 統計サマリー */}
      <div className="mt-4 text-[13px] text-muted-foreground text-right">
        全{news.length}件
      </div>
    </div>
  )
}

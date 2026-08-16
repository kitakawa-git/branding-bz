'use client'

// スーパー管理: 孤立アカウントの整理
//
// auth.users には残っているが members にも admin_users にも居ないアカウント。
// 本人が再登録しようとすると「既に登録されています」で弾かれるので、
// 問い合わせを受けたらここで消す。
//
// 契約者の画面（/admin/members）に置いていたものを移した。
// 内部状態の復旧作業であり、他社のアカウントも見える以上 superadmin に閉じる。
//
// ⚠️ サイドバーには出していない。溜まっていた7件を 2026-08-16 に片付けた時点で
//    発生源は塞がっており（Googleログインの孤児は oauth-gate が自動削除、
//    サインアップとメンバー作成は失敗時に auth ユーザーごとロールバック）、
//    常設メニューに置くほどの頻度が無いため。
//    「既に登録されています」の問い合わせが来たら /superadmin/orphan-accounts を
//    直接開く。再発が続くようならサイドバーに戻す。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Clock, Mail, UserX } from 'lucide-react'

type Orphan = {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
}

export default function OrphanAccountsPage() {
  const [orphans, setOrphans] = useState<Orphan[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [target, setTarget] = useState<Orphan | null>(null)

  const getToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token || ''

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/orphan-accounts', {
        headers: { Authorization: `Bearer ${await getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '取得に失敗しました')
        return
      }
      setOrphans(data.orphans || [])
    } catch {
      toast.error('取得中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = async (o: Orphan) => {
    setDeletingId(o.id)
    try {
      const res = await fetch(`/api/superadmin/orphan-accounts?id=${o.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await getToken()}` },
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '削除に失敗しました')
        return
      }
      toast.success(`${o.email ?? o.id} を削除しました`)
      setOrphans((prev) => prev.filter((x) => x.id !== o.id))
    } catch {
      toast.error('削除中にエラーが発生しました')
    } finally {
      setDeletingId(null)
    }
  }

  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-foreground">孤立アカウントの整理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ログイン用のアカウントだけが残り、どのブランドにも属していないものの一覧です。
          この状態だと本人が再登録しようとしても「既に登録されています」で弾かれます。
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : orphans.length === 0 ? (
        <Card className="border bg-[hsl(0_0%_97%)] shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            孤立しているアカウントはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orphans.map((o) => (
            <Card key={o.id} className="border shadow-none">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <UserX className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {o.email ?? '（メールなし）'}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  作成 {fmt(o.createdAt)} ／ 最終ログイン {fmt(o.lastSignInAt)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === o.id}
                  onClick={() => setTarget(o)}
                  className="ml-auto border-red-200 text-red-700 hover:bg-red-50"
                >
                  {deletingId === o.id ? '削除中...' : '削除'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.email ?? target?.id} を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              ログイン用のアカウントを削除します。取り消せません。
              削除後は、このメールアドレスで新規登録できるようになります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const t = target
                setTarget(null)
                if (t) remove(t)
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

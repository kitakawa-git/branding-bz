'use client'

// スーパー管理画面 企業詳細: 「整合性チェック」パネル
// - 決定論チェック（/api/superadmin/integrity）を表示時に自動実行（AI不要・読み取りのみ・コストゼロ。
//   手動の「チェック実行」ボタンは廃止＝自動点検と二重のため）。
// - AI判定（governance_rules を Claude が実テキスト評価して修正案を出す機能）は廃止した。
//   結果は表示のみでオントロジーのデータに反映されず、運用に使われていなかったため。
//   復活させる場合は lib/brand/integrity-ai.ts と app/api/superadmin/integrity-ai/route.ts を履歴から戻す。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'

type Finding = {
  severity: 'warn' | 'info'
  category: string
  message: string
  refs?: { kind: string; label: string }[]
}

export default function IntegrityCheckSection({ companyId }: { companyId: string }) {
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [running, setRunning] = useState(false)

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const run = async () => {
    setRunning(true)
    try {
      const res = await fetch(`/api/superadmin/integrity?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${await token()}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setFindings(json.findings as Finding[])
    } catch (err) {
      console.error('[IntegrityCheck] 実行エラー:', err)
      toast.error('チェックに失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setRunning(false)
    }
  }

  // 表示時に自動実行
  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const warns = (findings || []).filter((f) => f.severity === 'warn')
  const infos = (findings || []).filter((f) => f.severity === 'info')

  const renderGroup = (title: string, icon: React.ReactNode, items: Finding[], tone: 'warn' | 'info') => {
    if (items.length === 0) return null
    const cls =
      tone === 'warn'
        ? { head: 'text-amber-700', card: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800' }
        : { head: 'text-ds-app-accent-hover', card: 'border-blue-200 bg-blue-50/40', badge: 'bg-blue-100 text-blue-800' }
    return (
      <div className="mb-4">
        <div className={`flex items-center gap-1.5 mb-2 text-xs font-bold ${cls.head}`}>
          {icon}
          {title}（{items.length}）
        </div>
        <div className="space-y-2">
          {items.map((f, i) => (
            <div key={i} className={`border rounded-lg p-3 ${cls.card}`}>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className={`py-0.5 px-2 rounded text-[11px] font-semibold ${cls.badge}`}>{f.category}</span>
                {f.refs?.map((r, j) => (
                  <span key={j} className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px]">
                    {r.kind}: {r.label}
                  </span>
                ))}
              </div>
              <p className="text-[13px] text-foreground break-words m-0">{f.message}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 0件のときは何も出さない。「問題なし」は同じカードの「オントロジー構築完了」バナーが
  // 既に伝えており、緑のボックスが2つ並んで同じことを言う状態だったため。
  if (findings !== null && findings.length === 0) return null

  return (
    <div>
      {running && findings === null && <p className="text-[13px] text-muted-foreground mb-0">自動点検中...</p>}

      {findings !== null && (
        <div>
          {renderGroup('要確認（warn）', <AlertTriangle size={14} />, warns, 'warn')}
          {renderGroup('参考（info）', <Info size={14} />, infos, 'info')}
        </div>
      )}
    </div>
  )
}

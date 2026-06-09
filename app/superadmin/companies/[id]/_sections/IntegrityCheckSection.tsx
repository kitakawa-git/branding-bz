'use client'

// スーパー管理画面 企業詳細: 「整合性チェック」パネル（第一カット・決定論的・読み取りのみ）
// 「チェック実行」で /api/superadmin/integrity を呼び、findings を severity別（warn→info）に表示。
// 修正アクションは出さない（まず可視化）。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, Play, ShieldCheck } from 'lucide-react'
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

  const run = async () => {
    setRunning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch(`/api/superadmin/integrity?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const warns = (findings || []).filter((f) => f.severity === 'warn')
  const infos = (findings || []).filter((f) => f.severity === 'info')

  const renderGroup = (
    title: string,
    icon: React.ReactNode,
    items: Finding[],
    tone: 'warn' | 'info',
  ) => {
    if (items.length === 0) return null
    const cls =
      tone === 'warn'
        ? { head: 'text-amber-700', card: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800' }
        : { head: 'text-blue-700', card: 'border-blue-200 bg-blue-50/40', badge: 'bg-blue-100 text-blue-800' }
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

  return (
    <div>
      <Button type="button" onClick={run} disabled={running} className="py-2 px-4 text-[13px]">
        <Play size={16} />
        {running ? 'チェック中...' : 'チェック実行'}
      </Button>

      {findings !== null && (
        <div className="mt-4">
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg p-3">
              <ShieldCheck size={16} />
              問題は見つかりませんでした
            </div>
          ) : (
            <>
              {renderGroup('要確認（warn）', <AlertTriangle size={14} />, warns, 'warn')}
              {renderGroup('参考（info）', <Info size={14} />, infos, 'info')}
            </>
          )}
        </div>
      )}
    </div>
  )
}

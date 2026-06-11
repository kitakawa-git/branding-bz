'use client'

// スーパー管理画面 企業詳細: 「整合性チェック」パネル
// - 決定論チェック（/api/superadmin/integrity）は表示時に自動実行（AI不要・読み取りのみ・コストゼロ。
//   手動の「チェック実行」ボタンは廃止＝自動点検と二重のため）。
// - 「AI判定を実行」: governance_rules の tone/claim/discouraged を Claude が実テキストに対して評価
//   （/api/superadmin/integrity-ai・POST・押した時だけ）。違反箇所＋理由＋修正案を表示。修正案は表示のみ（自動適用しない）。
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, ShieldCheck, Sparkles, Copy } from 'lucide-react'
import { toast } from 'sonner'

type Finding = {
  severity: 'warn' | 'info'
  category: string
  message: string
  refs?: { kind: string; label: string }[]
}

type AiFinding = {
  rule_id: string
  rule_type: string
  severity: string
  target_ref: string
  target_label: string
  quoted_text: string
  reason: string
  suggestion: string
  confidence: 'high' | 'medium'
}

const RULE_TYPE_JP: Record<string, string> = {
  tone_rule: 'トーンルール',
  claim_rule: '主張ルール',
  discouraged_expression: '非推奨表現',
}

export default function IntegrityCheckSection({ companyId }: { companyId: string }) {
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [running, setRunning] = useState(false)
  const [aiFindings, setAiFindings] = useState<AiFinding[] | null>(null)
  const [aiRunning, setAiRunning] = useState(false)

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

  // 決定論チェックは表示時に自動実行（手動ボタンは廃止。AI判定のみ手動＝コスト発生のため）
  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const runAi = async () => {
    setAiRunning(true)
    try {
      const res = await fetch('/api/superadmin/integrity-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ companyId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setAiFindings(json.findings as AiFinding[])
    } catch (err) {
      console.error('[IntegrityCheck AI] 実行エラー:', err)
      toast.error('AI判定に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setAiRunning(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('修正案をコピーしました')
    } catch {
      toast.error('コピーに失敗しました')
    }
  }

  // ---- 決定論 findings 表示 ----
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

  // ---- AI findings 表示 ----
  const aiTone = (sev: string) =>
    sev === 'block'
      ? { card: 'border-red-200 bg-red-50/40', badge: 'bg-red-100 text-red-800', label: '絶対遵守' }
      : sev === 'warn'
        ? { card: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-800', label: '原則遵守' }
        : { card: 'border-blue-200 bg-blue-50/40', badge: 'bg-blue-100 text-blue-800', label: '参考' }

  const sortedAi = [...(aiFindings || [])].sort(
    (a, b) => (a.severity === 'block' ? 0 : 1) - (b.severity === 'block' ? 0 : 1),
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={runAi} disabled={aiRunning} className="py-2 px-4 text-[13px]">
          <Sparkles size={16} />
          {aiRunning ? 'AI判定中...' : 'AI判定を実行'}
        </Button>
      </div>

      {/* 決定論チェックは自動実行（読み込み中表示のみ） */}
      {running && findings === null && (
        <p className="text-[13px] text-muted-foreground mt-3 mb-0">自動点検中...</p>
      )}

      {/* 決定論 結果 */}
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

      {/* AI判定 結果 */}
      {aiFindings !== null && (
        <div className="mt-5">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-foreground">
            <Sparkles size={14} />
            AI判定（トーン・主張）
          </div>
          {aiFindings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg p-3">
              <ShieldCheck size={16} />
              AI判定でも問題は見つかりませんでした
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAi.map((f, i) => {
                const t = aiTone(f.severity)
                return (
                  <div key={i} className={`border rounded-lg p-3 ${t.card}`}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className={`py-0.5 px-2 rounded text-[11px] font-semibold ${t.badge}`}>{t.label}</span>
                      <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px]">
                        {RULE_TYPE_JP[f.rule_type] ?? f.rule_type}
                      </span>
                      <span className="py-0.5 px-1.5 bg-gray-100 text-gray-600 rounded text-[11px]">{f.target_label}</span>
                      {f.confidence === 'medium' && (
                        <span className="py-0.5 px-1.5 bg-gray-100 text-gray-500 rounded text-[11px]">確信度: 中</span>
                      )}
                    </div>
                    <div className="text-[13px] mb-1">
                      <span className="text-muted-foreground">違反箇所: </span>
                      <span className="text-foreground font-medium break-words">「{f.quoted_text}」</span>
                    </div>
                    <p className="text-[13px] text-foreground/80 break-words m-0 mb-2">{f.reason}</p>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-green-700">修正案</span>
                        <button
                          type="button"
                          onClick={() => copy(f.suggestion)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground bg-transparent border-0 p-0 cursor-pointer"
                        >
                          <Copy size={12} />
                          コピー
                        </button>
                      </div>
                      <p className="text-[13px] text-foreground break-words whitespace-pre-wrap m-0">{f.suggestion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

// オントロジー出力テスト（読み取り専用）。同じお題で「注入あり/なし」を2回生成して左右比較。
// - 手動実行のみ。1テスト＝Claude 2回呼び出し（コスト2倍）をボタン付近に明記。
// - 結果は永続化しない（その場の確認用・精度確認＋クライアントデモ）。
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Sparkles, Check } from 'lucide-react'
import { toast } from 'sonner'
import { OUTPUT_TEST_TOPICS, type OutputTestTopic, type OutputTestResult } from '@/lib/brand/output-test-types'

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

export default function OutputTestPanel({ companyId }: { companyId: string }) {
  const [topic, setTopic] = useState<OutputTestTopic>('company_intro')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OutputTestResult | null>(null)

  const run = async () => {
    setLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch('/api/superadmin/output-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ companyId, topic }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setResult(json as OutputTestResult)
    } catch (err) {
      console.error('[OutputTest] エラー:', err)
      toast.error('出力テストに失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setLoading(false)
    }
  }

  const inj = result?.injected

  return (
    <div className="border border-border rounded-lg bg-background p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-foreground">
        <Sparkles size={14} />
        出力テスト（オントロジーの効果を比較）
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT_CLASS} value={topic} onChange={(e) => setTopic(e.target.value as OutputTestTopic)} disabled={loading}>
          {OUTPUT_TEST_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <Button type="button" onClick={run} disabled={loading} className="h-9 px-4 text-[13px]">
          <Sparkles size={15} />
          {loading ? '生成中...' : '2パターン生成して比較'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5 mb-0">
        ※ 1回のテストでAIを2回呼び出します（注入あり／なし）。コストは通常の2倍です
      </p>

      {result && (
        <div className="mt-3">
          {result.noOntology ? (
            <p className="text-[13px] text-amber-700 border border-amber-200 bg-amber-50/60 rounded-lg p-3 m-0 mb-3">
              この会社はオントロジー（理念・提供価値・実績・ルール・関係）が未登録のため、注入あり／なしの結果は同じになります。まず各ステップで登録してください
            </p>
          ) : (
            <p className="text-[12px] text-muted-foreground m-0 mb-2">
              注入した事実: 実績 {inj?.proof}件・ルール {inj?.rule}件・関係 {inj?.relation}本・理念 {inj?.philosophy}件・提供価値 {inj?.valueProposition}件
              {result.groundedNumbers.length > 0 && (
                <span className="text-green-700 font-semibold">
                  {' '}／ ✓ 実績の数値を引用: {result.groundedNumbers.join('、')}
                </span>
              )}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* A: 注入あり */}
            <div className="border border-violet-200 bg-violet-50/40 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="py-0.5 px-2 bg-violet-100 text-violet-800 rounded text-[11px] font-bold">A: オントロジー注入あり</span>
                {!result.noOntology && result.groundedNumbers.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-semibold">
                    <Check size={12} />実績の数値を引用
                  </span>
                )}
              </div>
              <p className="text-[13px] text-foreground whitespace-pre-wrap break-words m-0">{result.outputA}</p>
            </div>
            {/* B: 注入なし */}
            <div className="border border-border bg-muted/30 rounded-lg p-3">
              <div className="mb-1.5">
                <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-[11px] font-bold">B: 注入なし（素のプロンプト）</span>
              </div>
              <p className="text-[13px] text-foreground whitespace-pre-wrap break-words m-0">{result.outputB}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

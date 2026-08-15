'use client'

// オントロジー出力テスト（読み取り専用）。同じお題で「注入あり/なし」を2回生成して左右比較。
// - 比較の器を先に見せる構成：生成前から2パネル（左=オントロジーなし／右=あり）を空状態で常設する。
// - 右パネルはオントロジー由来の語句をハイライト（決定論・AI不使用。lib/brand/output-highlight.ts）。
// - 手動実行のみ。1テスト＝Claude 2回呼び出し（コスト2倍）は ⓘ ツールチップに集約。
// - 結果は永続化しない（その場の確認用・精度確認＋クライアントデモ）。API・生成条件は不変。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AIButton } from '@/components/shared/AIButton'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { OUTPUT_TEST_TOPICS, type OutputTestTopic, type OutputTestResult } from '@/lib/brand/output-test-types'
import { collectKeyPhrases, highlightSegments } from '@/lib/brand/output-highlight'

const SELECT_CLASS =
  'h-9 rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'

export default function OutputTestPanel({ companyId }: { companyId: string }) {
  const [topic, setTopic] = useState<OutputTestTopic>('company_intro')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OutputTestResult | null>(null)
  const [phrases, setPhrases] = useState<string[]>([])

  // ハイライト用のキーフレーズ（読み取りのみ。失敗しても比較自体は動く）
  const loadPhrases = useCallback(async () => {
    try {
      const [phil, vp, pp, bg] = await Promise.all([
        supabase.from('philosophy_elements').select('title, body').eq('company_id', companyId),
        supabase.from('value_propositions').select('title').eq('company_id', companyId),
        supabase.from('proof_points').select('title').eq('company_id', companyId),
        supabase.from('brand_guidelines').select('slogan').eq('company_id', companyId).maybeSingle(),
      ])
      const sources: (string | null | undefined)[] = []
      for (const r of (phil.data as { title: string | null; body: string | null }[] | null) || []) {
        sources.push(r.title, r.body)
      }
      for (const r of (vp.data as { title: string | null }[] | null) || []) sources.push(r.title)
      for (const r of (pp.data as { title: string | null }[] | null) || []) sources.push(r.title)
      sources.push((bg.data as { slogan?: string | null } | null)?.slogan)
      setPhrases(collectKeyPhrases(sources))
    } catch (err) {
      console.warn('[OutputTest] ハイライト用データの取得に失敗（ハイライトなしで続行）:', err)
      setPhrases([])
    }
  }, [companyId])

  useEffect(() => {
    loadPhrases()
  }, [loadPhrases])

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
  const hasHighlight = !!result && !result.noOntology

  const renderSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[92%]" />
      <Skeleton className="h-3 w-[84%]" />
      <Skeleton className="h-3 w-[60%]" />
    </div>
  )

  const renderPlaceholder = (text: string) => (
    <p className="text-[13px] text-muted-foreground/60 m-0">{text}</p>
  )

  // 右パネル：オントロジー由来の語句に印を付けて描画
  const renderHighlighted = (text: string) => {
    const segments = highlightSegments(text, hasHighlight ? phrases : [])
    return (
      <p className="text-[13px] text-foreground whitespace-pre-wrap break-words m-0">
        {segments.map((s, i) =>
          s.hit ? (
            <mark
              key={i}
              className="rounded-[3px] bg-violet-200/70 px-0.5 text-foreground dark:bg-violet-400/25"
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
    )
  }

  return (
    <div className="border border-border rounded-xl bg-background p-3">
      {/* ヘッダー行：問い＋形式＋実行 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h4 className="text-sm font-bold text-foreground m-0">この体系で、言葉はどう変わる？</h4>
        <div className="grow" />
        <select
          className={SELECT_CLASS}
          value={topic}
          onChange={(e) => setTopic(e.target.value as OutputTestTopic)}
          disabled={loading}
        >
          {OUTPUT_TEST_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {/* AIアクションは共通の AIButton に統一（sm＝px-3 py-1.5 text-xs gap-1.5） */}
        <AIButton type="button" size="sm" onClick={run} disabled={loading}>
          {loading ? '生成中...' : result ? '再生成する' : '比較する'}
        </AIButton>
      </div>

      {result?.noOntology && (
        <p className="text-[13px] text-amber-700 border border-amber-200 bg-amber-50/60 rounded-xl p-3 m-0 mb-3">
          この会社はオントロジー（理念・提供価値・実績・ルール・関係）が未登録のため、注入あり／なしの結果は同じになります。まず各ステップで登録してください
        </p>
      )}

      {result && !result.noOntology && (
        <p className="text-[12px] text-muted-foreground m-0 mb-2">
          注入した事実: 実績 {inj?.proof}件・ルール {inj?.rule}件・関係 {inj?.relation}本・理念 {inj?.philosophy}件・提供価値{' '}
          {inj?.valueProposition}件
          {result.groundedNumbers.length > 0 && (
            <span className="text-green-700 font-semibold"> ／ ✓ 実績の数値を引用: {result.groundedNumbers.join('、')}</span>
          )}
        </p>
      )}

      {/* 比較ステージ（生成前から常設） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 左: オントロジーなし */}
        <div className="border border-border bg-muted/30 rounded-xl p-3">
          <div className="mb-1.5">
            <span className="py-0.5 px-2 bg-gray-100 text-gray-600 rounded text-[11px] font-bold">
              オントロジーなし（一般的なAI）
            </span>
          </div>
          {loading
            ? renderSkeleton()
            : result
              ? <p className="text-[13px] text-foreground whitespace-pre-wrap break-words m-0">{result.outputB}</p>
              : renderPlaceholder('一般的な言葉になりがちな文章がここに')}
          {result && !loading && (
            <details className="mt-2">
              <summary className="text-[11px] text-muted-foreground cursor-pointer">プロンプトを表示</summary>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-background border border-border rounded-md p-2 mt-1 m-0">
                {result.promptB}
              </pre>
            </details>
          )}
        </div>

        {/* 右: オントロジーあり（この体系を注入） */}
        <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="py-0.5 px-2 bg-violet-100 text-violet-800 rounded text-[11px] font-bold">
              オントロジーあり（この体系を注入）
            </span>
            {result && !result.noOntology && result.groundedNumbers.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-semibold">
                <Check size={12} />
                実績の数値を引用
              </span>
            )}
          </div>
          {loading
            ? renderSkeleton()
            : result
              ? renderHighlighted(result.outputA)
              : renderPlaceholder('体系の言葉・実績が反映された文章がここに')}
          {result && !loading && (
            <details className="mt-2">
              <summary className="text-[11px] text-muted-foreground cursor-pointer">プロンプトを表示</summary>
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words bg-background border border-border rounded-md p-2 mt-1 m-0">
                {result.promptA}
              </pre>
            </details>
          )}
        </div>
      </div>

      {/* 凡例＋注記（注記はⓘに畳む） */}
      <div className="flex items-center gap-1.5 mt-2">
        <p className="text-[11px] text-muted-foreground m-0">
          <mark className="rounded-[3px] bg-violet-200/70 px-1 text-foreground dark:bg-violet-400/25">紫</mark>
          ＝体系の言葉・実績が反映された箇所
        </p>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex items-center border-0 bg-transparent p-0 text-muted-foreground cursor-help">
                <Info size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[320px]">
              <p className="m-0 text-[11px]">
                1回のテストでAIを2回呼び出します（注入あり／なし）。コストは通常の2倍です。A/Bはモデル・パラメータ・基本情報（会社名・業種・事業概要）を揃え、差分は「オントロジー注入の有無」のみです
              </p>
              <p className="m-0 mt-1 text-[11px]">生成は毎回変わります（同条件でも別の文案が出ます）</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

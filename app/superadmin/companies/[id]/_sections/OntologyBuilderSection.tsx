'use client'

// スーパー管理画面 企業詳細: 「オントロジー構築ウィザード」（ガイドレイヤー）
// - 6ステップのステッパー。完了状態はデータから決定論的に導出（進捗管理テーブルなし）。
// - 現在ステップのパネルに既存セクションコンポーネントをそのまま埋め込んで再利用する
//   （ロジックの複製なし。ページ下部の個別カードは従来どおり詳細管理用に残る）。
// - ステップは強制しない（クリックで任意のステップへ移動可。ガイドであって檻ではない）。
// - Step 5 の完了は「このセッション内でチェックを実行した」こと（onChecked コールバック）。
// - Step 6 の完了判定は「プロファイリングで解消できる warn（裏づけのない約束・繋がっていない実績系）」
//   のみが対象（v1.1）。用語規定違反などプロファイリングで解消しない検出は判定から除外する
//   （整合性チェックの表示自体には全カテゴリ出る）。
//   ※ カテゴリは integrity.ts が emit する表示文字列と照合される。リネーム時は両側を同時に更新すること。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Check, Info, RefreshCw } from 'lucide-react'
import ProofPointsSection, { type ValuePropositionRef } from './ProofPointsSection'
import { type Finding } from './IntegrityCheckSection'
import GovernanceRulesSection from './GovernanceRulesSection'
import ElementRelationsSection from './ElementRelationsSection'
import IntegrityCheckSection from './IntegrityCheckSection'
import ProfilingSection from './ProfilingSection'

type Counts = {
  mission: number
  vision: number
  value: number
  vp: number
  proof: number
  rule: number
  relation: number
}

const ZERO_COUNTS: Counts = { mission: 0, vision: 0, value: 0, vp: 0, proof: 0, rule: 0, relation: 0 }

// Step6 完了判定の対象カテゴリ（プロファイリングの質問で解消できる検出のみ）。
// 用語規定違反は言い換え推奨の参考情報のためここに含めない（表示はされるが完了は妨げない）。
// ※ integrity.ts の category 文字列と一致させること（旧称: 証拠なき約束・孤立した証拠）。
const PROFILING_RESOLVABLE_CATEGORIES = new Set(['裏づけのない約束', 'どの約束にも繋がっていない実績'])

const countResolvableWarns = (findings: Finding[]): number =>
  findings.filter((f) => f.severity === 'warn' && PROFILING_RESOLVABLE_CATEGORIES.has(f.category)).length

const STEPS: { num: number; label: string; full: string; why: string }[] = [
  { num: 1, label: '基本情報', full: '基本情報の確認', why: '理念と提供価値が、この後のすべての土台になります' },
  { num: 2, label: '実績・エピソード', full: '実績・エピソードを集める', why: '提供価値に沿った実績・エピソードがあるほど、AIの提案が御社ならではの内容になります' },
  { num: 3, label: '言葉のルール', full: '言葉のルールを決める', why: '「言わせたくないこと」を決めるほど、AIの言葉づかいが御社らしくなります' },
  { num: 4, label: 'つながり', full: 'つながりを整理する', why: 'どの提供価値をどの実績が支えているかを登録すると、AIが正しい根拠を選んで語れるようになります' },
  { num: 5, label: 'チェック', full: '不足・矛盾をチェック', why: '実績の裏づけがない提供価値や、内容のくい違いがないかを自動で点検します' },
  { num: 6, label: '補足質問', full: '補足質問', why: '足りない情報を質問でお聞きします。答えるほどAIの提案精度が上がります' },
]

export default function OntologyBuilderSection({
  companyId,
  valuePropositions,
}: {
  companyId: string
  valuePropositions: ValuePropositionRef[]
}) {
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<number | null>(null) // 初回ロード後に自動設定
  const [integrityRan, setIntegrityRan] = useState(false) // Step5: セッション内でチェック実行済みか
  // Step6判定用: プロファイリングで解消できる warn の件数（null=未取得）
  const [warnCount, setWarnCount] = useState<number | null>(null)
  const [warnLoading, setWarnLoading] = useState(false)

  // 完了状態はすべてデータから導出（進捗テーブルなし）
  // Step6 は warn 0件だけだと「データが空＝検出対象なし」の会社まで完了扱いになるため、
  // ステップ1〜4の充足を前提条件にする。
  const basicsDone =
    counts.mission > 0 &&
    counts.vision > 0 &&
    counts.value > 0 &&
    counts.vp > 0 &&
    counts.proof > 0 &&
    counts.rule > 0 &&
    counts.relation > 0
  const stepDone = useCallback(
    (num: number): boolean => {
      switch (num) {
        case 1:
          return counts.mission > 0 && counts.vision > 0 && counts.value > 0 && counts.vp > 0
        case 2:
          return counts.proof > 0
        case 3:
          return counts.rule > 0
        case 4:
          return counts.relation > 0
        case 5:
          return integrityRan
        case 6:
          return warnCount === 0 && basicsDone
        default:
          return false
      }
    },
    [counts, integrityRan, warnCount, basicsDone],
  )

  const fetchCounts = useCallback(async () => {
    const [philR, vpR, ppR, govR, erR] = await Promise.all([
      supabase.from('philosophy_elements').select('element_type').eq('company_id', companyId),
      supabase.from('value_propositions').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('proof_points').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('governance_rules').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('element_relations').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    ])
    const phil = (philR.data as { element_type: string }[] | null) || []
    setCounts({
      mission: phil.filter((p) => p.element_type === 'mission').length,
      vision: phil.filter((p) => p.element_type === 'vision').length,
      value: phil.filter((p) => p.element_type === 'value').length,
      vp: vpR.count ?? 0,
      proof: ppR.count ?? 0,
      rule: govR.count ?? 0,
      relation: erR.count ?? 0,
    })
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // 初回ロード後、最初の未完了ステップを現在地にする（以降はユーザー操作を尊重）
  useEffect(() => {
    if (loading || activeStep !== null) return
    const firstIncomplete = STEPS.find((s) => !stepDone(s.num))
    setActiveStep(firstIncomplete ? firstIncomplete.num : 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Step6判定: 決定論チェックを取得して warn 件数を計測（AI不要・読み取りのみ）
  const fetchWarnCount = useCallback(async () => {
    setWarnLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch(`/api/superadmin/integrity?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setWarnCount(countResolvableWarns(json.findings as Finding[]))
    } catch (err) {
      console.error('[OntologyBuilder] warn件数取得エラー:', err)
    } finally {
      setWarnLoading(false)
    }
  }, [companyId])

  // Step6 に入ったら自動で完了判定を取得
  useEffect(() => {
    if (activeStep === 6 && warnCount === null && !warnLoading) fetchWarnCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  const onChildDataChanged = useCallback(() => {
    fetchCounts()
    setWarnCount(null) // データが変わったら完了判定は取り直し
  }, [fetchCounts])

  const current = STEPS.find((s) => s.num === activeStep) ?? null

  // ---- Step 1: 基本情報チェックリスト（このウィザードでは作らない・既存編集画面へ案内） ----
  const renderStep1 = () => {
    const items: { label: string; ok: boolean; hint: string }[] = [
      { label: 'ミッション', ok: counts.mission > 0, hint: '管理画面「ブランドの考え方」で登録（AIサジェスト可）' },
      { label: 'ビジョン', ok: counts.vision > 0, hint: '管理画面「ブランドの考え方」で登録（AIサジェスト可）' },
      { label: 'バリュー', ok: counts.value > 0, hint: '管理画面「ブランドの考え方」で登録（AIサジェスト可）' },
      { label: '提供価値', ok: counts.vp > 0, hint: '管理画面「ブランド戦略」で登録' },
    ]
    const missing = items.filter((i) => !i.ok)
    return (
      <div>
        <div className="space-y-1.5 mb-3">
          {items.map((i) => (
            <div key={i.label} className="flex items-center gap-2 text-sm">
              {i.ok ? (
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-green-100 text-green-700 shrink-0">
                  <Check size={12} />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center size-5 rounded-full bg-gray-100 text-gray-400 shrink-0 text-[11px]">
                  —
                </span>
              )}
              <span className={i.ok ? 'text-foreground' : 'text-muted-foreground'}>{i.label}</span>
              {!i.ok && <span className="text-xs text-muted-foreground">→ {i.hint}</span>}
            </div>
          ))}
        </div>
        {missing.length === 0 ? (
          <p className="text-sm text-green-700 border border-green-200 bg-green-50 rounded-lg p-3 m-0">
            基本情報は揃っています。次のステップへ進んでください
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground m-0">
            不足分はこのウィザードでは作成しません。該当企業の管理画面（ブランドの考え方／ブランド戦略）の編集機能・AIサジェストで登録してから戻ってきてください
          </p>
        )}
      </div>
    )
  }

  // ---- Step 6: 完了バナー＋サマリ ----
  const renderStep6Banner = () => {
    if (warnLoading) return <p className="text-sm text-muted-foreground mb-3">完了判定を確認中...</p>
    if (warnCount === null) return null
    if (warnCount === 0 && !basicsDone) {
      return (
        <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 mb-4">
          解消すべき検出は0件ですが、データがまだ少ないため検出対象がない状態です。先にステップ1〜4を埋めてください
        </p>
      )
    }
    if (warnCount === 0) {
      return (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 mb-4">
          <p className="text-sm font-bold text-green-800 m-0 mb-1">オントロジー構築完了 🎉</p>
          <p className="text-[13px] text-foreground m-0">
            プロファイリングで解消できるwarn系の検出（裏づけのない約束など）は0件です。現在の登録: 理念 {counts.mission + counts.vision + counts.value}件・提供価値 {counts.vp}件・実績 {counts.proof}件・表現ルール {counts.rule}件・関係 {counts.relation}本
          </p>
        </div>
      )
    }
    return (
      <p className="text-[13px] text-amber-700 border border-amber-200 bg-amber-50/40 rounded-lg p-3 mb-4">
        プロファイリングで解消できるwarn系の検出が残り {warnCount}件あります。下の質問に回答すると埋まっていきます
      </p>
    )
  }

  return (
    <div>
      {/* ステッパー */}
      <div className="flex items-start gap-1 overflow-x-auto pb-1 mb-1">
        {STEPS.map((s, i) => {
          const done = stepDone(s.num)
          const active = activeStep === s.num
          return (
            <div key={s.num} className="flex items-start shrink-0">
              {i > 0 && <div className="h-px w-4 sm:w-7 bg-border mt-3.5" />}
              <button
                type="button"
                onClick={() => setActiveStep(s.num)}
                className="flex flex-col items-center gap-1 bg-transparent border-0 p-0 px-1 cursor-pointer group"
              >
                <span
                  className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-bold transition-colors ${
                    done
                      ? 'bg-green-600 text-white'
                      : active
                        ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                  }`}
                >
                  {done ? <Check size={14} /> : s.num}
                </span>
                <span
                  className={`text-[11px] whitespace-nowrap ${active ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
                >
                  {s.label}
                </span>
              </button>
            </div>
          )
        })}
        <div className="grow" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onChildDataChanged}
          className="size-7 shrink-0"
          title="ステップ判定を更新"
        >
          <RefreshCw size={13} />
        </Button>
      </div>

      {/* 現在ステップのパネル */}
      {loading ? (
        <p className="text-muted-foreground text-sm m-0">読み込み中...</p>
      ) : current ? (
        <div className="border border-border rounded-lg p-4 bg-background mt-2">
          <div className="mb-3">
            <p className="text-sm font-bold text-foreground m-0">
              ステップ{current.num}: {current.full}
            </p>
            <p className="inline-flex items-center gap-1.5 text-[13px] text-blue-900 bg-blue-100/60 rounded-md px-2.5 py-1 m-0 mt-1.5">
              <Info size={13} className="shrink-0" />
              {current.why}
            </p>
          </div>

          {current.num === 1 && renderStep1()}
          {current.num === 2 && (
            <ProofPointsSection companyId={companyId} valuePropositions={valuePropositions} onDataChanged={onChildDataChanged} />
          )}
          {current.num === 3 && (
            <GovernanceRulesSection companyId={companyId} valuePropositions={valuePropositions} onDataChanged={onChildDataChanged} />
          )}
          {current.num === 4 && <ElementRelationsSection companyId={companyId} onDataChanged={onChildDataChanged} />}
          {current.num === 5 && (
            <IntegrityCheckSection
              companyId={companyId}
              onChecked={(findings) => {
                setIntegrityRan(true)
                setWarnCount(countResolvableWarns(findings))
              }}
            />
          )}
          {current.num === 6 && (
            <>
              {renderStep6Banner()}
              <ProfilingSection companyId={companyId} onDataChanged={onChildDataChanged} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

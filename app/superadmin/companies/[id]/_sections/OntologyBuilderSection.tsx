'use client'

// スーパー管理画面 企業詳細: 「オントロジー構築ウィザード」（ガイドレイヤー）
// - 5ステップのステッパー。完了状態はデータから決定論的に導出（進捗管理テーブルなし）。
// - 現在ステップのパネルに既存セクションコンポーネントをそのまま埋め込んで再利用する
//   （ロジックの複製なし。ページ下部の個別カードは従来どおり詳細管理用に残る）。
// - ステップは強制しない（クリックで任意のステップへ移動可。ガイドであって檻ではない）。
// - 決定論チェックは自動実行: ステップ5を開いたとき＋ステップ2〜4で承認登録した直後
//   （onDataChanged 経由）に走り、ステップ5冒頭に点検サマリを常時表示する。
//   手動の「チェック実行」ボタンはウィザードには無い（AI判定含め、下部の既存
//   「整合性チェック」カードに従来どおり残る）。
// - Step 5 の完了判定は「プロファイリングで解消できる warn（裏づけのない約束・繋がっていない実績系）」
//   が0件＋ステップ1〜4充足ガード（旧Step6と同一）。用語規定違反などは判定から除外する。
//   ※ カテゴリは integrity.ts が emit する表示文字列と照合される。リネーム時は両側を同時に更新すること。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Check, Info, RefreshCw } from 'lucide-react'
import ProofPointsSection, { type ValuePropositionRef } from './ProofPointsSection'
import { type Finding } from './IntegrityCheckSection'
import GovernanceRulesSection from './GovernanceRulesSection'
import ElementRelationsSection from './ElementRelationsSection'
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

// Step5 完了判定の対象カテゴリ（プロファイリングの質問で解消できる検出のみ）。
// 用語規定違反は言い換え推奨の参考情報のためここに含めない（表示はされるが完了は妨げない）。
// ※ integrity.ts の category 文字列と一致させること（旧称: 証拠なき約束・孤立した証拠）。
const PROFILING_RESOLVABLE_CATEGORIES = new Set(['裏づけのない約束', 'どの約束にも繋がっていない実績'])

const countResolvableWarns = (findings: Finding[]): number =>
  findings.filter((f) => f.severity === 'warn' && PROFILING_RESOLVABLE_CATEGORIES.has(f.category)).length

const countCategory = (findings: Finding[], category: string): number =>
  findings.filter((f) => f.category === category).length

const STEPS: { num: number; label: string; full: string; why: string }[] = [
  { num: 1, label: '基本情報', full: '基本情報の確認', why: '理念と提供価値が、この後のすべての土台になります' },
  { num: 2, label: '実績・エピソード', full: '実績・エピソードを集める', why: '提供価値に沿った実績・エピソードがあるほど、AIの提案が御社ならではの内容になります' },
  { num: 3, label: '言葉のルール', full: '言葉のルールを決める', why: '「言わせたくないこと」を決めるほど、AIの言葉づかいが御社らしくなります' },
  { num: 4, label: '関連性', full: '際立つ関連性を洗い出す', why: '要素どうしが支え合う関係・ぶつかる関係を登録すると、AIが正しい根拠と避けるべき表現を判断できるようになります' },
  { num: 5, label: '補足質問', full: '補足質問', why: '自動点検で見つかった不足を、質問でお聞きします。答えるほどAIの提案精度が上がります' },
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
  // 自動点検（決定論チェック）の結果（null=未取得）
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [findingsLoading, setFindingsLoading] = useState(false)

  const resolvableWarn = findings === null ? null : countResolvableWarns(findings)

  // 完了状態はすべてデータから導出（進捗テーブルなし）
  // Step5 は warn 0件だけだと「データが空＝検出対象なし」の会社まで完了扱いになるため、
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
          return resolvableWarn === 0 && basicsDone
        default:
          return false
      }
    },
    [counts, resolvableWarn, basicsDone],
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
    setActiveStep(firstIncomplete ? firstIncomplete.num : 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // 自動点検: 決定論チェックを取得（AI不要・読み取りのみ・コスト極小）
  const fetchFindings = useCallback(async () => {
    setFindingsLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch(`/api/superadmin/integrity?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setFindings(json.findings as Finding[])
    } catch (err) {
      console.error('[OntologyBuilder] 自動点検エラー:', err)
    } finally {
      setFindingsLoading(false)
    }
  }, [companyId])

  // ステップ5を開いたら自動点検（未取得時のみ。データ変化時は onChildDataChanged が再実行する）
  useEffect(() => {
    if (activeStep === 5 && findings === null && !findingsLoading) fetchFindings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  // ステップ2〜4での承認登録直後（各セクションの onDataChanged）＋手動更新ボタン:
  // 件数と自動点検の両方を取り直す
  const onChildDataChanged = useCallback(() => {
    fetchCounts()
    fetchFindings()
  }, [fetchCounts, fetchFindings])

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

  // ---- Step 5: 自動点検サマリ＋完了バナー ----
  const renderInspectionSummary = () => {
    if (findings === null) {
      return (
        <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 mb-3">
          自動点検を実行中...
        </p>
      )
    }
    const unproven = countCategory(findings, '裏づけのない約束')
    const orphan = countCategory(findings, 'どの約束にも繋がっていない実績')
    const conflict = countCategory(findings, '矛盾の明示')
    return (
      <div className="border border-border bg-muted/40 rounded-lg p-3 mb-3">
        <p className="text-[13px] text-foreground m-0">
          <span className="font-bold">自動点検: </span>
          裏づけのない提供価値 {unproven}件 ／ どの約束にも繋がっていない実績 {orphan}件 ／ 内容のくい違い {conflict}件
          {findingsLoading && <span className="text-muted-foreground">（更新中...）</span>}
        </p>
      </div>
    )
  }

  const renderCompletionBanner = () => {
    if (resolvableWarn === null) return null
    if (resolvableWarn === 0 && !basicsDone) {
      return (
        <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 mb-4">
          解消すべき検出は0件ですが、データがまだ少ないため検出対象がない状態です。先にステップ1〜4を埋めてください
        </p>
      )
    }
    if (resolvableWarn === 0) {
      return (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 mb-4">
          <p className="text-sm font-bold text-green-800 m-0 mb-1">オントロジー構築完了 🎉</p>
          <p className="text-[13px] text-foreground m-0">
            プロファイリングで解消できるwarn系の検出（裏づけのない約束など）は0件です。現在の登録: 理念 {counts.mission + counts.vision + counts.value}件・提供価値 {counts.vp}件・実績 {counts.proof}件・表現ルール {counts.rule}件・関係 {counts.relation}本
          </p>
        </div>
      )
    }
    return null
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
            <>
              {renderInspectionSummary()}
              {renderCompletionBanner()}
              <ProfilingSection companyId={companyId} onDataChanged={onChildDataChanged} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

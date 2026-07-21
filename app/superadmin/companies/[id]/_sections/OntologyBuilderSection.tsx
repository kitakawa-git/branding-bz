'use client'

// スーパー管理画面 企業詳細: 「オントロジー構築ウィザード」（ガイドレイヤー）
// - 5ステップのステッパー。完了状態はデータから決定論的に導出（進捗管理テーブルなし）。
// - 現在ステップのパネルに既存セクションコンポーネントをそのまま埋め込んで再利用する
//   （ロジックの複製なし。ページ下部の個別カードは従来どおり詳細管理用に残る）。
// - ステップは強制しない（クリックで任意のステップへ移動可。ガイドであって檻ではない）。
// - 決定論チェックは自動実行: 最終ステップ（補足質問）を開いたとき＋各ステップで承認登録した直後
//   （onDataChanged 経由）に走り、最終ステップ冒頭に点検サマリを常時表示する。
//   手動の「チェック実行」ボタンはウィザードには無い（AI判定含め、下部の既存
//   「整合性チェック」カードに従来どおり残る。検出表示はそのまま＝穴の事実は隠さない）。
// - Step 5 の完了判定:「プロファイリング対象の warn（裏づけのない約束）が、解消済みまたは
//   保留済み（profiling_acknowledgments）で全件カバーされている」＋基礎データ充足ガード。
//   判定値は /api/superadmin/profiling の uncoveredWarnCount（lib/brand/profiling.ts で算出）。
//   点検サマリは同レスポンスの baseline（integrity.ts のカテゴリ文字列がキー。リネーム時は要同時更新）。
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import ProfilingSection from './ProfilingSection'
import ProofPointsSection, { type ValuePropositionRef } from './ProofPointsSection'
import GovernanceRulesSection from './GovernanceRulesSection'
import ElementRelationsSection from './ElementRelationsSection'
import DesiredEvidenceSection from './DesiredEvidenceSection'
import IntegrityCheckSection from './IntegrityCheckSection'
import { ONTOLOGY_DATA_CHANGED_EVENT, ONTOLOGY_GOTO_STEP_EVENT } from './ontology-events'

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

// 自動点検の結果（/api/superadmin/profiling のレスポンスから使う分）
export type Inspection = {
  baseline: Record<string, number> // integrity.ts のカテゴリ文字列 → 件数
  uncoveredWarnCount: number // 未解消かつ未保留の warn（Step5完了判定: 0で完了）
  acknowledgedUnprovenCount: number // 保留済み件数（完了バナー・ハブのチップに明示）
  openUnprovenCount: number // 裏づけのない対象の現存数（ハブの「裏づけ N/M」の N側計算用）
  backingTotal: number // 裏づけ対象の総数（提供価値 or バリュー。ハブ「裏づけ N/M」の分母M）
  backingNoun: string // 裏づけ対象の呼称（提供価値 / バリュー）
}

// サマリーハブへ通知する状態（判定ロジックはこのコンポーネントが唯一の持ち主。ハブは表示だけ）
export type OntologyStatus = {
  counts: { mission: number; vision: number; value: number; vp: number; proof: number; rule: number; relation: number }
  inspection: Inspection | null
  complete: boolean // ウィザード完了（解消可能warn 0＋基礎データ充足）
  pendingCount: number // 保留件数
}

// 旧ステップ1「基本情報の確認」は削除し、前提の未登録はカード上部の警告チップへ移した（理念／提供価値）。
// ここは「このウィザードで実際に登録・編集するもの」だけを並べる。
const STEPS: { num: number; label: string; full: string; why: string }[] = [
  { num: 1, label: '実績・エピソード', full: '実績・エピソードを集める', why: '提供価値に沿った実績・エピソードがあるほど、AIの提案が御社ならではの内容になります' },
  { num: 2, label: '言葉のルール', full: '言葉のルールを決める', why: '「言わせたくないこと」を決めるほど、AIの言葉づかいが御社らしくなります' },
  { num: 3, label: '未来設計', full: 'これから獲得する証拠を決める', why: 'いま無い証拠を「獲得目標」として置くと、理想までの道のりが可視化され、事実（実績）と願望を混ぜずに扱えます（任意）' },
  { num: 4, label: '関係性', full: '際立つ関係性を洗い出す', why: '要素どうしが支え合う関係・ぶつかる関係を登録すると、AIが正しい根拠と避けるべき表現を判断できるようになります' },
  { num: 5, label: '補足質問', full: '補足質問', why: 'ここまでに登録された内容を精査して、不足している点を質問でお聞きします' },
]
// 最終ステップ（点検・補足質問）。自動点検の取得トリガと完了時の既定表示に使う。
const LAST_STEP = STEPS[STEPS.length - 1].num

// ステップ見出し行の右端に置くアクションの受け皿（各セクションが portal で差し込む）
const STEP_ACTION_SLOT_ID = 'ontology-step-action'

export default function OntologyBuilderSection({
  companyId,
  valuePropositions,
  onStatusChange,
}: {
  companyId: string
  valuePropositions: ValuePropositionRef[]
  // 件数・点検・完了状態をサマリーハブへ通知（任意）
  onStatusChange?: (s: OntologyStatus) => void
}) {
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS)
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState<number | null>(null) // 初回ロード後に自動設定
  // 自動点検（決定論チェック＋保留カバレッジ）の結果（null=未取得）
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [inspectionLoading, setInspectionLoading] = useState(false)

  // 完了状態はすべてデータから導出（進捗テーブルなし）
  // Step5 は warn 0件だけだと「データが空＝検出対象なし」の会社まで完了扱いになるため、
  // 理念（チップで促す）と実績・ルール・関係の充足を前提条件にする。
  // 提供価値は任意（推奨）扱い。必須は理念（mission/vision/value）と実績・ルール・関係のみ。
  const basicsDone =
    counts.mission > 0 &&
    counts.vision > 0 &&
    counts.value > 0 &&
    counts.proof > 0 &&
    counts.rule > 0 &&
    counts.relation > 0
  const stepDone = useCallback(
    (num: number): boolean => {
      switch (num) {
        case 1:
          return counts.proof > 0
        case 2:
          return counts.rule > 0
        case 3:
          // 未来設計（獲得目標）は任意ステップ。完了判定・自動遷移をブロックしないため常に done 扱い
          // （既存企業は0件のままでもウィザードの進行・完了が従来どおりになる）。
          return true
        case 4:
          return counts.relation > 0
        case 5:
          // 対象warnが「解消済みまたは保留済み」で全件カバーされていれば完了
          return inspection !== null && inspection.uncoveredWarnCount === 0 && basicsDone
        default:
          return false
      }
    },
    [counts, inspection, basicsDone],
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
    setActiveStep(firstIncomplete ? firstIncomplete.num : LAST_STEP)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // 自動点検: 決定論チェック＋保留カバレッジを取得（AI不要・読み取りのみ・コスト極小）
  const fetchInspection = useCallback(async () => {
    setInspectionLoading(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const res = await fetch(`/api/superadmin/profiling?companyId=${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setInspection({
        baseline: (json.baseline as Record<string, number>) || {},
        uncoveredWarnCount: (json.uncoveredWarnCount as number) || 0,
        acknowledgedUnprovenCount: (json.acknowledgedUnprovenCount as number) || 0,
        openUnprovenCount: (json.openUnprovenCount as number) || 0,
        backingTotal: (json.backingTotal as number) || 0,
        backingNoun: (json.backingNoun as string) || '提供価値',
      })
    } catch (err) {
      console.error('[OntologyBuilder] 自動点検エラー:', err)
    } finally {
      setInspectionLoading(false)
    }
  }, [companyId])

  // 最終ステップを開いたら自動点検（未取得時のみ。データ変化時は onChildDataChanged が再実行する）
  useEffect(() => {
    if (activeStep === LAST_STEP && inspection === null && !inspectionLoading) fetchInspection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  // ステップ内の登録・削除（ONTOLOGY_DATA_CHANGED_EVENT 経由）で件数と自動点検の両方を取り直す
  // （手動更新ボタンは廃止済み。更新はイベント連動の自動のみ）
  const onChildDataChanged = useCallback(() => {
    fetchCounts()
    fetchInspection()
  }, [fetchCounts, fetchInspection])

  // 各ステップ内のCRUDが発火するイベント（broadcastDataChanged）を購読してステップ判定を更新。
  // ハブ（島チップ）も同じイベントを購読しているため、通知経路はこの1本に統一されている
  useEffect(() => {
    const handler = () => onChildDataChanged()
    window.addEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_DATA_CHANGED_EVENT, handler)
  }, [onChildDataChanged])

  // 埋め込みセクションの onDataChanged → 全購読者（自分＋ハブ）へブロードキャスト
  const broadcastDataChanged = useCallback(() => {
    window.dispatchEvent(new Event(ONTOLOGY_DATA_CHANGED_EVENT))
  }, [])

  // ハブのクイックアクションからのステップ切替を購読
  useEffect(() => {
    const handler = (e: Event) => {
      const step = (e as CustomEvent).detail
      if (typeof step === 'number' && step >= 1 && step <= LAST_STEP) setActiveStep(step)
    }
    window.addEventListener(ONTOLOGY_GOTO_STEP_EVENT, handler)
    return () => window.removeEventListener(ONTOLOGY_GOTO_STEP_EVENT, handler)
  }, [])

  // サマリーハブへ状態を通知（判定はここが唯一の持ち主。ハブは表示のみ）
  useEffect(() => {
    if (loading) return
    onStatusChange?.({
      counts,
      inspection,
      complete: inspection !== null && inspection.uncoveredWarnCount === 0 && basicsDone,
      pendingCount: inspection?.acknowledgedUnprovenCount ?? 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, counts, inspection, basicsDone])

  const current = STEPS.find((s) => s.num === activeStep) ?? null

  // ---- Step 5: 完了バナー ----
  // 点検数値のサマリ表示はサマリーハブの点検チップに一本化済み（ここでは出さない）。
  const renderCompletionBanner = () => {
    if (inspection === null) return null
    if (inspection.uncoveredWarnCount !== 0) return null
    if (!basicsDone) {
      return (
        <p className="text-[13px] text-muted-foreground border border-border bg-muted/40 rounded-lg p-3 mb-4">
          解消すべき検出は0件ですが、データがまだ少ないため検出対象がない状態です。先に実績・言葉のルール・関係性を埋めてください（理念が未登録なら上部のチップから登録してください）
        </p>
      )
    }
    const pending = inspection.acknowledgedUnprovenCount
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4 mb-4">
        <p className="text-sm font-bold text-green-800 m-0 mb-1">
          オントロジー構築完了{pending > 0 ? `（保留 ${pending}件）` : ''} 🎉
        </p>
        <p className="text-[13px] text-foreground m-0">
          {pending > 0
            ? `対象の検出はすべて解消または保留済みです。保留した項目は後からいつでも回答できます。`
            : 'プロファイリングで解消できるwarn系の検出（裏づけのない約束など）は0件です。'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* ステッパー（/tools/personality の StepProgressBar と同じ装飾・全幅） */}
      <div className="w-full mb-3">
        <div className="relative">
          {/* ベースライン（グレー一本線：最初の丸中心〜最後の丸中心）。
              各ステップは flex-1 の等幅なので、丸の中心は端から「1区画の半分」＝ 50/N %。
              ラベル幅に依存する固定値（旧: left-4）だと線が丸からはみ出す。 */}
          <div
            className="absolute top-[15px] h-0.5 bg-gray-200"
            style={{ left: `${50 / STEPS.length}%`, right: `${50 / STEPS.length}%` }}
          />

          {/* 完了ライン（アクセント色：先頭から連続して完了している分だけ上書き） */}
          {(() => {
            const firstNotDone = STEPS.findIndex((s) => !stepDone(s.num))
            const progress = firstNotDone === -1 ? 1 : firstNotDone / (STEPS.length - 1)
            if (progress <= 0) return null
            return (
              <div
                className="absolute top-[15px] h-0.5 bg-ds-app-accent transition-all"
                style={{
                  left: `${50 / STEPS.length}%`,
                  width: `calc((100% - ${100 / STEPS.length}%) * ${progress})`,
                }}
              />
            )
          })()}

          {/* ステップ丸（flex-1 の等幅セル＝丸の中心が等間隔になる） */}
          <div className="relative flex">
            {STEPS.map((s) => {
              const done = stepDone(s.num)
              const active = activeStep === s.num
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setActiveStep(s.num)}
                  className="flex flex-1 min-w-0 flex-col items-center bg-transparent border-0 p-0 cursor-pointer group"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done || active
                        ? 'bg-ds-app-accent text-white'
                        : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                    } ${active ? 'ring-2 ring-blue-200' : ''}`}
                  >
                    {done ? '✓' : s.num}
                  </span>
                  <span
                    className={`mt-1.5 text-[10px] font-medium whitespace-nowrap ${
                      active ? 'font-bold text-gray-900' : done ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 現在ステップのパネル */}
      {loading ? (
        <p className="text-muted-foreground text-sm m-0">読み込み中...</p>
      ) : current ? (
        <div className="border border-border rounded-lg p-4 bg-background mt-2">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground m-0">
                ステップ{current.num}: {current.full}
              </p>
              {/* 各ステップの主アクション置き場。実体は各セクション側が portal で差し込む
                  （状態はセクションが持つため、ここは空の受け皿だけを用意する） */}
              <div id={STEP_ACTION_SLOT_ID} className="shrink-0" />
            </div>
            <p className="inline-flex items-center gap-1.5 text-[13px] text-blue-900 bg-blue-100/60 rounded-md px-2.5 py-1 m-0 mt-1.5">
              <Info size={13} className="shrink-0" />
              {current.why}
            </p>
          </div>

          {/* 各ステップに機能の実体を埋め込み（カード外に重複セクションは無い＝実体は各1箇所） */}
          {current.num === 1 && (
            <ProofPointsSection
              companyId={companyId}
              valuePropositions={valuePropositions}
              onDataChanged={broadcastDataChanged}
              headerActionSlotId={STEP_ACTION_SLOT_ID}
            />
          )}
          {current.num === 2 && (
            <GovernanceRulesSection companyId={companyId} valuePropositions={valuePropositions} onDataChanged={broadcastDataChanged} />
          )}
          {current.num === 3 && (
            <DesiredEvidenceSection companyId={companyId} onDataChanged={broadcastDataChanged} />
          )}
          {current.num === 4 && (
            <ElementRelationsSection companyId={companyId} onDataChanged={broadcastDataChanged} />
          )}
          {current.num === 5 && (
            <>
              {renderCompletionBanner()}
              <IntegrityCheckSection companyId={companyId} headerActionSlotId={STEP_ACTION_SLOT_ID} />
              <div className="border-t border-border my-5" />
              <ProfilingSection companyId={companyId} onDataChanged={broadcastDataChanged} autoStart />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

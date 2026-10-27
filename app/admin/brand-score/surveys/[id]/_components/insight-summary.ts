// サーベイ結果の AI 考察 API に渡す要約（buildInsightSummary）と、その入力の型。サーベイ詳細ページから切り出した純粋関数
import {
  STAGE_LABELS,
  type GroupFunnel,
} from '@/lib/brand-score/funnel-stages'
import {
  type Breakdown,
} from '@/lib/brand-score/question-lens'

// インナースコアAPI型定義
export type InnerScoreData = {
  survey: { id: string; title: string; status: string; total_members: number }
  response_rate: number
  response_count: number
  scores: {
    total: number | null
    why: number | null
    how: number | null
    what: number | null
  }
  rank: string
  by_department: {
    department: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_role: {
    role_category: string; count: number
    why: number | null; how: number | null; what: number | null; total: number | null
  }[]
  by_question: {
    question_id: string; question_text: string; category: string
    avg_score: number | null; count: number
  }[]
  /** 設問タイプ・4領域・回答分布の集計 */
  breakdown: Breakdown | null
  /** 浸透段階の集計。段階が解決できないサーベイでは null */
  funnel: {
    pass_threshold: number
    overall: GroupFunnel
    by_department: GroupFunnel[]
  } | null
}

// 設問別スコアの表示軸

/**
 * AI考察に渡す集計要約。画面に出ている数字だけを渡し、
 * 生成側が新しい数値を作れないようにする
 */
export function buildInsightSummary(data: InnerScoreData) {
  // 段階は画面が5点満点で出しているので、AIにも同じ単位で語らせる。
  // 0〜100 も渡すのは、5点満点だと SP の理解3.54 と行動3.54 のように
  // 別の値が同じに見え、差を語れなくなる行があるため
  const stageRow = (g: GroupFunnel) => ({
    対象: g.department ? departmentLabel(g.department) : '全社',
    回答者数: g.respondentCount,
    段階スコア5点満点: Object.fromEntries(
      g.stageScores.map(s => [STAGE_LABELS[s.stage], s.avg])
    ),
    段階スコア0to100: Object.fromEntries(
      g.stageScores.map(s => [STAGE_LABELS[s.stage], s.score])
    ),
    通過率: Object.fromEntries(
      g.cumulative.map(p => [STAGE_LABELS[p.stage], p.rate])
    ),
  })

  const dist = (d: { avg: number; score: number; positiveRate: number; neutralRate: number; negativeRate: number }) => ({
    平均: d.avg,
    スコア: d.score,
    肯定率: d.positiveRate,
    中立率: d.neutralRate,
    否定率: d.negativeRate,
  })

  return {
    総合スコア: data.scores.total,
    ランク: data.rank,
    回答数: data.response_count,
    回答分布: data.breakdown && {
      全社: dist(data.breakdown.overall),
      部署別: data.breakdown.byDepartment.map(d => ({
        部署: departmentLabel(d.department),
        ...dist(d),
      })),
    },
    浸透段階: data.funnel && {
      通過の基準: `各段階の平均${data.funnel.pass_threshold}点以上`,
      全社: stageRow(data.funnel.overall),
      部署別: data.funnel.by_department.map(stageRow),
    },
    低スコアの設問: [...data.by_question]
      .filter(q => q.avg_score !== null)
      .sort((a, b) => (a.avg_score ?? 0) - (b.avg_score ?? 0))
      .slice(0, 5)
      .map(q => ({ 設問: q.question_text, 平均: q.avg_score, 回答数: q.count })),
  }
}

// 部署の表示名。DB の値は取り込み時に指定した文字列なので、
// 画面上の呼び方だけをここで揃える
export const DEPARTMENT_LABELS: Record<string, string> = {
  BO本社: 'BO（本社含む）',
}

export const departmentLabel = (department: string) =>
  DEPARTMENT_LABELS[department] ?? department

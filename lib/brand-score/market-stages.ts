// 市場浸透ジャーニー（外部の市場調査を5段階で見る）
// ============================================================
// インナーの5段階（認知→理解→共感→行動→推奨）と対にする。
// 社内で「どこまで浸透しているか」と、社外で「どこまで届いているか」を
// 同じ形で並べられるようにするのが狙い。
//
//   社内（インナー）  認知 → 理解 → 共感 → 行動 → 推奨
//   社外（アウター）  認知 → 想起 → 評価 → 利用 → 推奨
//
// 4段階目の「利用」が反転点。そこまでは知る・考える段階、そこから先は
// 実際に選び、人に勧める段階に変わる。
//
// ⚠️ 段階の定義は定点観測の基準。一度決めたら変更しないこと
//    （変えると前年比が無意味になる）。
// ⚠️ どの設問のどの値をどの段階に割り当てるかは、調査ごとに人が決める。
//    設問構成は調査会社・年度で変わるため、対応表を固定できない。
// ============================================================

export type MarketStage = 'awareness' | 'recall' | 'evaluation' | 'usage' | 'advocacy'

/** 表示順 */
export const MARKET_STAGES: readonly MarketStage[] = [
  'awareness',
  'recall',
  'evaluation',
  'usage',
  'advocacy',
]

export const MARKET_STAGE_LABELS: Record<MarketStage, string> = {
  awareness: '認知',
  recall: '想起',
  evaluation: '評価',
  usage: '利用',
  advocacy: '推奨',
}

/** その段階が何を問うているか（画面の副題） */
export const MARKET_STAGE_QUESTIONS: Record<MarketStage, string> = {
  awareness: '知られているか',
  recall: '思い出されるか',
  evaluation: '選ぶ価値があると思われているか',
  usage: '使われているか',
  advocacy: '人に勧められているか',
}

/** その段階でどんな設問を割り当てるかの手引き（マッピング画面の補助） */
export const MARKET_STAGE_HINTS: Record<MarketStage, string> = {
  awareness: '助成想起・認知率。「知っている」と答えた人の割合',
  recall: '純粋想起。社名を挙げてもらう設問の第1想起など',
  evaluation: '品質・価格・信頼などの評価、検討意向、企業イメージ',
  usage: '導入率・利用経験・購入経験',
  advocacy: '推奨意向・NPS。人に勧めたいか',
}

/** 反転点。この段階以降は「実際に選ぶ側」になる */
export const MARKET_PIVOT_STAGE: MarketStage = 'usage'

/**
 * インナー5段階との対応。
 * 「社内の認知59.3／社外の認知84.1」のように並べて見せるために使う。
 * インナー側のキーは lib/brand-score/funnel-stages.ts の FunnelStage。
 */
export const INNER_COUNTERPART: Record<MarketStage, string> = {
  awareness: 'awareness',
  recall: 'understanding',
  evaluation: 'empathy',
  usage: 'behavior',
  advocacy: 'advocacy',
}

/** 段階スコアの状態。absent と unmapped を混同すると未計測を0点として扱ってしまう */
export type MarketStageStatus = 'scored' | 'absent' | 'unmapped'

export const MARKET_STAGE_STATUS_LABELS: Record<MarketStageStatus, string> = {
  scored: '算出済み',
  absent: 'この調査では未計測',
  unmapped: '未割当',
}

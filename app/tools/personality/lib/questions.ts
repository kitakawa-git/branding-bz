// ブランドパーソナリティ診断 — 診断質問定義（確定版）
// 質問文言・選択肢は実装指示書で確定済み。変更は北川さん承認後のみ。
// 質問は Aaker 5次元・12アーキタイプ両フレームワーク共通の1セット。

export type FrameworkKey = 'aaker' | 'archetype'

export interface DiagnosisQuestion {
  id: string
  number: number
  text: string
  type: 'single' | 'multi'
  /** type === 'multi' のときの最大選択数 */
  maxSelections?: number
  options: string[]
  /** 任意の自由記述欄を併設するか（Q9のみ） */
  hasFreeText?: boolean
  freeTextPlaceholder?: string
}

export const DIAGNOSIS_QUESTIONS: DiagnosisQuestion[] = [
  {
    id: 'q1',
    number: 1,
    text: 'お客様から、どんな存在だと言われたいですか？',
    type: 'single',
    options: ['頼れる専門家', '身近な相談相手', '革新をもたらす先駆者', '品質を約束する職人', 'ワクワクさせてくれる存在', '一緒に歩む仲間'],
  },
  {
    id: 'q2',
    number: 2,
    text: '絶対に言われたくない形容詞は？（2つまで）',
    type: 'multi',
    maxSelections: 2,
    options: ['古臭い', '冷たい', '軽薄', '堅苦しい', '不誠実', '平凡', '敷居が高い', '頼りない'],
  },
  {
    id: 'q3',
    number: 3,
    text: '競合がかしこまった話し方をするなら、あなたのブランドは？',
    type: 'single',
    options: ['より丁寧で格調高く', '同じく礼儀正しく', 'あえて親しみやすく崩す', '独自の言葉づかいで違いを出す'],
  },
  {
    id: 'q4',
    number: 4,
    text: 'ブランドを人にたとえると、休日は何をしていそうですか？',
    type: 'single',
    options: ['行ったことのない場所を旅する', '本を読んで深く学ぶ', '友人を招いてもてなす', '工房で黙々とものづくり', '新しい挑戦に汗を流す', '美術館や音楽に浸る'],
  },
  {
    id: 'q5',
    number: 5,
    text: 'お客様との理想の距離感は？',
    type: 'single',
    options: ['導く先生', '伴走するコーチ', '対等な友人', '支える黒子'],
  },
  {
    id: 'q6',
    number: 6,
    text: '意思決定で最も優先するものは？',
    type: 'single',
    options: ['確実性と実績', '新しさと挑戦', '美しさと完成度', '人とのつながり', '合理性と効率'],
  },
  {
    id: 'q7',
    number: 7,
    text: 'ブランドの語り口に最も近いのは？',
    type: 'single',
    options: ['力強く断言する', '問いを投げかける', 'そっと寄り添う', 'データと根拠で示す', '物語で伝える'],
  },
  {
    id: 'q8',
    number: 8,
    text: '価格・品質のポジションは？',
    type: 'single',
    options: ['最高級を少数に', '確かな品質を適正価格で', '良いものを手頃に届ける'],
  },
  {
    id: 'q9',
    number: 9,
    text: '5年後、業界でどんな存在になっていたいですか？',
    type: 'single',
    options: ['業界の常識を変えた革命児', '誰もが頼る定番', '知る人ぞ知る本物', '業界全体を支える縁の下'],
    hasFreeText: true,
    freeTextPlaceholder: '補足があれば自由にどうぞ（任意）',
  },
  {
    id: 'q10',
    number: 10,
    text: '創業（事業開始）の原動力に最も近いのは？',
    type: 'single',
    options: ['世の中の不満や課題を正したかった', '知見や技術を広めたかった', '美しいもの・良いものを作りたかった', '困っている人を助けたかった', 'もっと楽しい世界にしたかった'],
  },
]

// 5問×2画面に分割（Step 2: Q1〜Q5 / Step 3: Q6〜Q10）
export const QUESTIONS_PAGE_1 = DIAGNOSIS_QUESTIONS.slice(0, 5)
export const QUESTIONS_PAGE_2 = DIAGNOSIS_QUESTIONS.slice(5, 10)

/** 回答: questionId -> 選択した選択肢の配列（single は要素1つ）。q9_free は自由記述 */
export interface DiagnosisAnswers {
  [questionId: string]: string[] | string | undefined
  q9_free?: string
}

/** 指定した質問セットがすべて回答済みか */
export function isPageAnswered(questions: DiagnosisQuestion[], answers: DiagnosisAnswers): boolean {
  return questions.every(q => {
    const a = answers[q.id]
    return Array.isArray(a) && a.length > 0
  })
}

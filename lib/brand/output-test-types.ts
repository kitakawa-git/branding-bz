// オントロジー出力テストの型・定数（クライアント/サーバー共用・サーバー専用依存を含めない）。
// runOutputTest 本体（Claude呼び出し＝fs依存）は output-test.ts 側に置き、UIはこのファイルだけを参照する。
export type OutputTestTopic = 'company_intro' | 'catchcopy' | 'proposal'

export const OUTPUT_TEST_TOPICS: { value: OutputTestTopic; label: string }[] = [
  { value: 'company_intro', label: '会社紹介文（100字）' },
  { value: 'catchcopy', label: 'キャッチコピー案 3本' },
  { value: 'proposal', label: 'ターゲット顧客への提案文' },
]

export type OutputTestResult = {
  topicLabel: string
  outputA: string // 注入あり
  outputB: string // 注入なし
  injected: { proof: number; rule: number; relation: number; philosophy: number; valueProposition: number }
  groundedNumbers: string[] // Aの出力に含まれ、注入事実にも実在する数値（正規化値）
  noOntology: boolean // 注入できるオントロジーが皆無（A=B になる）
  // 透明化: 実際に送ったプロンプト全文（system＋指示）。A/Bの差分＝注入ブロックの有無のみ
  promptA: string
  promptB: string
}

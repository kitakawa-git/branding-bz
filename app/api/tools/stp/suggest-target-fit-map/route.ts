// STP分析ツール ターゲット適合マップ提案API
// POST /api/tools/stp/suggest-target-fit-map
// 顧客側軸＋ターゲット点＋自社カバー範囲（楕円）を提案。「狙ったターゲットに本当に刺さるか」のセルフチェック用。
import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude-api'
import { getAdminContext } from '@/lib/learning/auth'
import { getGuardrailsPromptForCompany } from '@/lib/brand/guardrails'

const SYSTEM_PROMPT = `あなたはブランドマーケティングの専門家です。STP分析のターゲット適合マップ（顧客側軸＋ターゲット点＋自社カバー範囲）を、**指定された軸選定方針（strategy_type）で1つだけ**生成してください。
このマップの目的は「狙ったターゲットに本当に自社が刺さるか」をセルフチェックすることです。

## 軸ロックモード（locked_axes が指定された場合）
リクエストに locked_axes が指定された場合、以下のルールで動作してください:
1. **軸選定をスキップ**: x_axis / y_axis / axis_endpoints の選定を行わず、locked_axes の値をそのまま x_axis / y_axis に使う
2. **座標とカバー範囲のみ再計算**: 与えられた軸の上で、targets[].x/y と coverage を再計算する
3. **axis_rationale**: 「（軸ロック中）この軸での配置を再計算しました」とシンプルに返す
4. **alternative_suggestions**: ロックモードでも range外を検出したら出してOK（軸は固定だが、別ターゲットの提案は意味がある）
locked_axes が指定されていない場合は、以下の軸選定方針に従って AI で軸を選定する。

## 軸選定方針（リクエストの strategy_type に従う）
### strategic_vs_dispersion（戦略 × 分散）★推奨
- X軸: ターゲットの**購買決定要因（buying_factors）に最も直結する**順序型の切り口
- Y軸: メイン＋サブの**ターゲット群を最も鮮明に分離できる**順序型の切り口
- label="戦略 × 分散" / recommended=true
### strengths_vs_dispersion（強み × 分散）
- X軸: 自社の強み（strengths）が**最も活きる**順序型の切り口
- Y軸: メイン＋サブの**ターゲット群を最も鮮明に分離できる**順序型の切り口
- label="強み × 分散" / recommended=false
### dispersion_only（分散 × 分散）
- X軸: ターゲットを最も分離できる順序型の切り口（1つ目）
- Y軸: ターゲットを最も分離できる順序型の切り口（2つ目、X軸とは異なる切り口）
- label="分散 × 分散" / recommended=false

出力には、指定された strategy_type・対応する label・recommended を必ず含めること。

重要: 軸選定のルール（最優先）
1. X軸とY軸の軸ラベル（x_axis.left/right, y_axis.bottom/top）は、ユーザーから提供されたセグメンテーションの **切り口の名前と、その切り口に含まれるセグメント名** からそのまま使ってください。新しい軸名を自由に考案してはいけません。
2. 具体的には:
   - 4つの切り口（variables）の中から、ターゲットの分布が最も鮮明になる2つを選ぶ
   - 選んだ切り口について、含まれるセグメントの中から「対極の2つ」を端のラベルにする
   - 例: 切り口「組織のブランド課題フェーズ」を採用する場合、X軸 left=「ゼロイチ創業期」、X軸 right=「再定義・ピボット期」のように、セグメント名をそのまま端ラベルとして使う
3. axis_rationale には「なぜこの切り口を採用したか・なぜこの対極を選んだか」を1〜2文で説明する
4. 同じ入力（同じセグメンテーション・同じターゲット選定）に対しては、**同じ軸を選ぶこと**（決定論的に判断する）

重要: 軸ラベルは axis_endpoints から取得すること
選んだ切り口（順序型）に axis_endpoints が定義されている場合、軸ラベル（x_axis.left/right, y_axis.bottom/top）には **必ず axis_endpoints.low_label / high_label をそのまま使う** こと（low_label を left/bottom、high_label を right/top に対応させる）。セグメント名を両端ラベルとして使ってはいけません。
例: 切り口「ブランド課題フェーズ」を採用、axis_endpoints = { low_label: "新規構築期", high_label: "再構築期" } の場合 → x_axis = { left: "新規構築期", right: "再構築期" }。セグメント名「ゼロイチ創業期」「再定義・ピボット期」は両端ラベルに使わない。
axis_endpoints が未定義の切り口（旧データなど）の場合のみ、AIが両端ラベルを動的に生成する: 必ず対称的・並列形のペア（「低 ↔ 高」「初期 ↔ 後期」など）にし、セグメント名をそのまま両端に使わず、8文字以内にすること。

重要: 軸として使える切り口の制約（順序型のみ）
軸として使うのは、**順序的に並べられる切り口**（時間的推移・程度の高低・量の大小など、連続性のあるもの）に限定してください。**カテゴリ型の切り口**（別カテゴリーが並列するだけで連続性がないもの）は軸として使ってはいけません。
判定基準: 「左端と右端の中間値は何を意味するか？」を問えた時に、自然に答えられるなら順序型。「中間値が何者か説明できない」ならカテゴリ型。
例:
- 軸OK（順序型）:
  - ブランド課題フェーズ: ゼロイチ→成長→承継→再定義（時間的推移）
  - AIリテラシー: 低↔高（程度の高低）
  - 内製化志向: フルアウトソース↔セルフ運用（程度）
  - 企業規模: 小↔大（量の大小）
  - 予算規模: 少↔多（量の大小）
- 軸NG（カテゴリ型）:
  - 意思決定者の属性: オーナー/2代目/役員/人事責任者（別人物カテゴリの並列）
  - 業種: IT/製造/小売（並列カテゴリ）
  - 地域: 東京/大阪/福岡（並列カテゴリ）
  - 課題タイプ: 認知不足/離職率/差別化（並列の問題類型）
利用可能な順序型の切り口が2つに満たない場合は、無理に軸にせず、1つの切り口を主軸として、もう1軸は「規模感（size_hint）の大↔小」で補ってください。それでも足りない場合は、axis_rationale でその旨を説明してください（マップを生成しないオプションは取らない）。

注意:
- 軸ラベルに「AI活用」「デジタル」「テクノロジー」など、Step 4 の競合差別化マップで使われる供給側語彙を使ってはいけません（既存ルール）
- 切り口名・セグメント名そのままを使うことで、ユーザーが Step 2 で確認した語彙との一貫性が保たれます

重要なルール:
1. X軸とY軸は、Step 2のセグメンテーション切り口から**顧客側変数のみ**を採用してください（例: 企業成長段階・組織規模・顧客課題タイプ等）。供給側変数（手法・サービス範囲）は絶対に使わないこと（それはStep 4で使います）。
2. ターゲット（メイン1＋サブ最大2）を点でプロットしてください。
3. 自社は点ではなく**楕円（カバー範囲）**で表現します。中心座標＋横幅＋縦幅を返してください。
4. 全ターゲットが楕円の中に入るかを判定し、consistency_status を返してください。
   - green: 全ターゲットが楕円内
   - yellow: 全ターゲット内だが一部が端（カバー中心から70%以上の距離）
   - red: 1つ以上のターゲットが楕円外

回答はJSON形式のみで、前後に説明文やマークダウンのコードブロックを含めないでください。

出力JSONスキーマ（マップは1つだけ・candidates 配列にしない）:
{
  "strategy_type": "strategic_vs_dispersion",
  "label": "戦略 × 分散",
  "recommended": true,
  "x_axis": { "left": "左端ラベル", "right": "右端ラベル" },
  "y_axis": { "bottom": "下端ラベル", "top": "上端ラベル" },
  "axis_rationale": "なぜこの2軸を選んだか（1〜2文）",
  "coverage": {
    "center_x": 50,
    "center_y": 50,
    "width": 80,
    "height": 60,
    "rationale": "カバー範囲の根拠（自社の強み・経験を踏まえて1〜2文）"
  },
  "targets": [
    { "name": "事業承継期中小企業", "role": "main", "x": 70, "y": 50, "in_coverage": true },
    { "name": "急成長スタートアップ", "role": "sub", "x": 25, "y": 30, "in_coverage": true },
    { "name": "成長拡大組織", "role": "sub", "x": 50, "y": 70, "in_coverage": true }
  ],
  "consistency_status": "green",
  "alternative_suggestions": []
}

注意:
- x, y, center_x, center_y は 0〜100 の数値（50が中央）
- width, height は 20〜100 の数値
- targets は targeting.main_target と sub_targets[] の名前を使う
- 各ターゲットが楕円 ((x-center_x)/width*2)^2 + ((y-center_y)/height*2)^2 <= 1 を満たすか判定して in_coverage を返す

## 代替候補サジェスト（consistency_status が "red" または "yellow" のとき）

ターゲットが1つ以上カバー範囲外（in_coverage=false）になった場合、以下のルールで alternative_suggestions を返してください:

1. **対象**: Step 2 のセグメンテーション全切り口の全セグメントから、現在 main/sub に選ばれていないもの（★印が付いていないセグメント＝代替候補プール）
2. **絞り込み**:
   - 同じ顧客側軸を採用しているため、各セグメントを現在の x_axis / y_axis 上に推定配置する
   - カバー範囲（楕円）内に入りそうなものを優先
   - 範囲外ターゲットの「代わりになりやすい」（同じ切り口・隣接段階）を優先
3. **件数**: 最大3つ、優先度順
4. **各候補に必須**:
   - name: セグメント名
   - variable_name: そのセグメントが含まれる切り口の名前
   - replaces: どの範囲外ターゲット名の代わりか（targets[] の in_coverage=false のいずれかの name と完全一致させる）
   - x_estimate, y_estimate: 現在の x_axis / y_axis 上での推定位置（0〜100）
   - fit_reason: なぜカバー範囲に合うか（1文・選択時の判断材料）

consistency_status が "green" の場合は alternative_suggestions を空配列にしてください。`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { basic_info, segmentation, targeting, strategy_type, locked_axes } = body
    if (!targeting?.main_target) {
      return NextResponse.json({ error: 'main_target が必要です' }, { status: 400 })
    }
    // 軸ロックモード（locked_axes が揃っているときのみ。軸選定をスキップして座標・カバー範囲のみ再計算）
    const hasLockedAxes = !!(
      locked_axes?.x_axis?.left &&
      locked_axes?.x_axis?.right &&
      locked_axes?.y_axis?.bottom &&
      locked_axes?.y_axis?.top
    )
    // 軸選定方針（未指定・不正値は推奨にフォールバック）
    const STRATEGIES = ['strategic_vs_dispersion', 'strengths_vs_dispersion', 'dispersion_only'] as const
    type StrategyType = typeof STRATEGIES[number]
    const selectedStrategy: StrategyType = STRATEGIES.includes(strategy_type)
      ? strategy_type
      : 'strategic_vs_dispersion'
    const STRATEGY_LABEL: Record<StrategyType, string> = {
      strategic_vs_dispersion: '戦略 × 分散',
      strengths_vs_dispersion: '強み × 分散',
      dispersion_only: '分散 × 分散',
    }

    const parts: string[] = []
    parts.push('## 企業情報')
    if (basic_info?.company_name) parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
    if (basic_info?.industry_category) {
      const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
      parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
    } else if (basic_info?.industry) {
      const industry = basic_info.industry === 'その他' && basic_info.industry_other
        ? basic_info.industry_other
        : basic_info.industry
      parts.push(`- 業種: ${industry}`)
    }
    if (Array.isArray(basic_info?.business_descriptions)) {
      const descriptions = basic_info.business_descriptions
        .filter((b: { title?: string }) => b.title?.trim())
        .map((b: { title: string; description?: string }, i: number) => {
          const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
          return `  ${i + 1}. ${b.title.trim()}${desc}`
        })
        .join('\n')
      if (descriptions) parts.push(`- 事業内容:\n${descriptions}`)
    }

    parts.push('')
    parts.push('## 軸候補（Step 2 のセグメンテーション）')
    parts.push('以下の4つの切り口の中から2つを選び、各切り口のセグメント名を端ラベルとして使ってください。新しい軸名を考案しないこと。')
    parts.push('')
    if (segmentation?.variables) {
      segmentation.variables.forEach((v: { name?: string; reason?: string; axis_type?: 'ordinal' | 'categorical'; axis_endpoints?: { low_label?: string; high_label?: string } | null; segments?: Array<{ name?: string; description?: string; selected?: boolean; priorities?: string }> }, vi: number) => {
        if (!v?.name?.trim()) return
        const axisMark = v.axis_type === 'ordinal'
          ? '【軸候補◯】'
          : v.axis_type === 'categorical'
          ? '【軸候補✗（カテゴリ型）】'
          : '【軸候補△（タイプ未判定）】'
        parts.push(`### 切り口 ${String.fromCharCode(65 + vi)}: ${v.name} ${axisMark}`)
        if (v.axis_endpoints?.low_label && v.axis_endpoints?.high_label) {
          parts.push(`軸両端ラベル: ${v.axis_endpoints.low_label} ↔ ${v.axis_endpoints.high_label}（これを軸ラベルにそのまま使う）`)
        } else if (v.axis_type === 'ordinal') {
          parts.push('軸両端ラベル: 未定義（対称・並列形でAIが動的生成）')
        }
        if (v.reason) parts.push(`理由: ${v.reason}`)
        parts.push('セグメント（座標判定用。両端ラベルには使わない）:')
        for (const s of v.segments || []) {
          if (!s?.name?.trim()) continue
          const mark = s.selected ? '★' : ''
          const pri = s.priorities ? ` / 重視: ${s.priorities}` : ''
          parts.push(`  - ${mark}${s.name}: ${s.description || ''}${pri}`)
        }
        parts.push('')
      })
    }
    parts.push('※ ★印は Step 3 で選択中のターゲットです。★印が付いていないセグメントは「代替候補プール」です。consistency_status が red/yellow のとき、ここから alternative_suggestions を提案してください。')
    parts.push('※ 軸として使えるのは【軸候補◯】の切り口のみです。【軸候補✗】は軸に使わないこと。【軸候補△】は判断材料が乏しいので、順序的に並べられるかをまず確認し、自然に並べられないなら使わないでください。')
    parts.push('※ 顧客側の切り口（成長段階・規模・課題タイプ等）から軸を選んでください。供給側（手法・サービス範囲）は使わないこと。')

    parts.push('')
    parts.push('## ターゲティング')
    parts.push(`- メインターゲット: ${targeting.main_target}`)
    if (Array.isArray(targeting.sub_targets) && targeting.sub_targets.length > 0) {
      parts.push(`- サブターゲット: ${targeting.sub_targets.join(', ')}`)
    }
    if (targeting.strengths) parts.push(`- 自社の強み: ${targeting.strengths}`)
    if (Array.isArray(targeting.buying_factors) && targeting.buying_factors.length > 0) {
      parts.push(`- 購買決定要因: ${targeting.buying_factors.join('、')}`)
    }

    if (hasLockedAxes) {
      parts.push('')
      parts.push('## 🔒 軸ロックモード')
      parts.push('以下の軸を**固定**で使ってください。新たに軸を選定しないこと:')
      parts.push(`- X軸: ${locked_axes.x_axis.left} ↔ ${locked_axes.x_axis.right}`)
      parts.push(`- Y軸: ${locked_axes.y_axis.bottom} ↔ ${locked_axes.y_axis.top}`)
      parts.push('座標 (targets[].x/y) とカバー範囲 (coverage) のみ再計算してください。')
    }

    parts.push('')
    parts.push(`## 今回の軸選定方針: ${selectedStrategy}（${STRATEGY_LABEL[selectedStrategy]}）`)
    parts.push(hasLockedAxes
      ? '※ ただし軸ロックモードのため、上記の固定軸を使い、座標とカバー範囲のみ再計算してください。'
      : '上記の方針に基づいて、ターゲット適合マップを1つだけJSON形式で生成してください。')
    const userMessage = parts.join('\n')

    const guardrailCtx = await getAdminContext()
    const guardrails = guardrailCtx
      ? await getGuardrailsPromptForCompany(guardrailCtx.companyId)
      : ''
    const system = [SYSTEM_PROMPT, guardrails].filter(Boolean).join('\n\n')

    const response = await callClaude({ system, userMessage, maxTokens: 1500, temperature: 0 })

    // JSONパース（既存パターン: フェンス除去＋最外オブジェクト切り出し）
    let jsonStr = response.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()
    const objStart = jsonStr.indexOf('{')
    const objEnd = jsonStr.lastIndexOf('}')
    if (objStart >= 0 && objEnd > objStart) jsonStr = jsonStr.slice(objStart, objEnd + 1)

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('[SuggestTargetFitMap] JSONパースエラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答を解析できませんでした。再度お試しください。' },
        { status: 500 }
      )
    }

    // 単一候補（必須フィールド）を検証
    const valid =
      typeof parsed.x_axis === 'object' && parsed.x_axis !== null &&
      typeof parsed.y_axis === 'object' && parsed.y_axis !== null &&
      typeof parsed.coverage === 'object' && parsed.coverage !== null &&
      Array.isArray(parsed.targets) &&
      typeof parsed.consistency_status === 'string'
    if (!valid) {
      console.error('[SuggestTargetFitMap] 応答形式エラー:', response.substring(0, 300))
      return NextResponse.json(
        { error: 'AIの応答形式が不正です。再度お試しください。' },
        { status: 500 }
      )
    }
    // strategy_type / label / recommended はリクエスト方針で確定（AI出力に依存しない）
    parsed.strategy_type = selectedStrategy
    parsed.label = STRATEGY_LABEL[selectedStrategy]
    parsed.recommended = selectedStrategy === 'strategic_vs_dispersion'
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[SuggestTargetFitMap] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

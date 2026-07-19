// コピーAI 切り口生成（Stage4a）。
//
// 選択済みインサイト（is_selected=true）をサーバ側でDB再取得し（クライアント本文を使わない）、
// 5型の切り口（contrarian/identity_first/villain_first/reframe/secret）を生成する。
// stance=「業界の通念を1つ否定＋独自の代替」。特定競合の名指し批判は禁止。premise は FACT 接地可・数字創作は禁止。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { buildCopyOntologyBlocks } from '@/lib/copy/ontology-blocks'

export const ANGLE_TYPES = [
  'contrarian', 'identity_first', 'villain_first', 'reframe', 'secret',
] as const
export type AngleType = (typeof ANGLE_TYPES)[number]

export type AngleCandidate = {
  angle_type: AngleType
  stance: string
  premise: string
}

const txt = (s: unknown) => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim()

function buildAngleSystem(p: {
  insightBodies: string[]; factBlock: string; intentBlock: string; personaBlock: string
  aspirationBlock?: string
}): string {
  // §9 未来素材は FACT と別枠。0件なら行ごと出さない（従来プロンプトと一致）。
  const aspiration = p.aspirationBlock
    ? `\n目指す姿(ASPIRATION・まだ事実ではない): ${p.aspirationBlock}\n※ASPIRATION は「目指す／これから」の形でのみ言及可。事実として断定・数値引用してはならない。`
    : ''
  return `あなたはコピー戦略家。1つの「本音」に刺すための切り口（スタンス）を設計します。

# 与えられた素材
狙う本音: ${p.insightBodies.map((b) => `「${b}」`).join('、')}
ブランドの事実(FACT): ${p.factBlock || '（登録された実績なし）'}
ブランドの理念・提供価値(INTENT): ${p.intentBlock || '（なし）'}${aspiration}
読み手: ${p.personaBlock || '（ペルソナ未登録）'}

# 指示：次の5つの型で、それぞれ1つずつ切り口を作れ
- contrarian: 業界の常識を正面から否定する
- identity_first: 「こうありたい自分」から語る
- villain_first: 顧客と共有できる「共通の敵（通念・状況）」を立てる
- reframe: 問題そのものを定義し直す
- secret: 知られていない真実を明かす
各切り口の stance は「否定する常識＋独自の代替」を断言。premise は成り立つ根拠（FACTを使ってよい）。
特定競合の名指し批判は禁止。FACTに無い数字の創作は禁止。

# 出力（このJSON配列(5件)のみ・前後の説明禁止）
[ { "angle_type":"contrarian|identity_first|villain_first|reframe|secret", "stance":"...", "premise":"..." } ]`
}

// JSON配列を抽出。```json フェンス・末尾の途中切れ（maxTokens到達）に耐える:
// 失敗時は「最後の完結オブジェクト }」までで配列を閉じて復旧する。
function parseJsonArray(raw: string): unknown[] {
  const s = raw.indexOf('[')
  if (s < 0) return []
  const body = raw.slice(s)
  const e = body.lastIndexOf(']')
  if (e > 0) {
    try {
      const v = JSON.parse(body.slice(0, e + 1))
      if (Array.isArray(v)) return v
    } catch { /* fall through to recovery */ }
  }
  const lastObj = body.lastIndexOf('}')
  if (lastObj > 0) {
    try {
      const v = JSON.parse(body.slice(0, lastObj + 1) + ']')
      if (Array.isArray(v)) return v
    } catch { /* give up */ }
  }
  return []
}

/**
 * projectId の選択済みインサイトから5型の切り口を生成する。
 * 選択済みインサイトが0件なら空配列（呼び出し側で400）。
 */
export async function generateAngles(projectId: string): Promise<AngleCandidate[]> {
  if (!projectId) return []
  const supabase = getSupabaseAdmin()

  const { data: project } = await supabase
    .from('copy_projects')
    .select('id, company_id, persona_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return []

  const { data: insights } = await supabase
    .from('copy_insights')
    .select('body')
    .eq('project_id', projectId)
    .eq('is_selected', true)
    .order('created_at', { ascending: true })
  const bodies = (Array.isArray(insights) ? insights : []).map((i) => txt(i.body)).filter(Boolean)
  if (bodies.length === 0) return []

  const ontology = await buildCopyOntologyBlocks(project.company_id, project.persona_id ?? undefined)
  const system = buildAngleSystem({
    insightBodies: bodies,
    factBlock: ontology.factBlock,
    intentBlock: ontology.intentBlock,
    aspirationBlock: ontology.aspirationBlock,
    personaBlock: ontology.personaBlock,
  })
  const raw = await callClaude({ system, userMessage: '5型の切り口を設計し、指定JSON配列のみを出力せよ。', maxTokens: 3000 })

  const out: AngleCandidate[] = []
  const seen = new Set<string>()
  for (const item of parseJsonArray(raw)) {
    const o = item as Record<string, unknown>
    const type = txt(o.angle_type) as AngleType
    const stance = txt(o.stance)
    const premise = txt(o.premise)
    if (!ANGLE_TYPES.includes(type) || !stance) continue
    if (seen.has(type)) continue // 1型1件
    seen.add(type)
    out.push({ angle_type: type, stance, premise })
  }
  return out
}

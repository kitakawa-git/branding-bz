// コピーAI インサイト抽出＋接地検証（Stage4a・Q5: 捏造防止＝生の声への接地）。
//
// 表層の pain_points（一次）＋ micro_feedback タグ（二次）を素材に「隠れた本音」を最大10件生成し、
// source_ref.ref が実データに存在するかをコードで照合。接地しない候補は破棄（scan/profiling と同流儀）。
// インサイトは飛躍を低めに（占いにしない）。尖り・面白さは切り口（angles）で出す役割分担。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { callClaude } from '@/lib/claude-api'
import { buildCopyOntologyBlocks } from '@/lib/copy/ontology-blocks'

export const PSYCH_TYPES = [
  'hidden_anxiety', 'vanity', 'self_image', 'social_fear', 'aspiration', 'frustration',
] as const
export type PsychType = (typeof PSYCH_TYPES)[number]

export type InsightCandidate = {
  body: string
  psych_type: PsychType
  rationale: string
  source_ref: { kind: 'pain_point' | 'micro_feedback' | 'survey'; ref: string }
}

const txt = (s: unknown) => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim()
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? txt(x) : txt((x as { text?: string })?.text))).filter(Boolean) : []

// 部分一致（双方向）。空白除去で表記ゆれを軽減。
function looseMatch(ref: string, pool: string[]): boolean {
  const r = ref.replace(/\s+/g, '')
  if (!r) return false
  return pool.some((p) => {
    const x = p.replace(/\s+/g, '')
    return x.length > 0 && (x.includes(r) || r.includes(x))
  })
}

/**
 * 純関数: AI生コ候補のうち、必須項目を満たし source_ref.ref が実データに接地するものだけ返す。
 * 破棄条件: body空 / rationale空 / psych_type enum外 / source_ref.kind不正 / ref空 / ref が該当groundに非接地。
 */
export function validateInsightGrounding(
  raw: unknown[],
  groundSet: { pain_points: string[]; micro_tags: string[]; survey_themes: string[] },
): InsightCandidate[] {
  const out: InsightCandidate[] = []
  const poolFor = (kind: string): string[] =>
    kind === 'pain_point' ? groundSet.pain_points
      : kind === 'micro_feedback' ? groundSet.micro_tags
      : kind === 'survey' ? groundSet.survey_themes
      : []
  for (const item of Array.isArray(raw) ? raw : []) {
    const o = item as Record<string, unknown>
    const body = txt(o.body)
    const rationale = txt(o.rationale)
    const psych = txt(o.psych_type) as PsychType
    const sr = (o.source_ref ?? {}) as Record<string, unknown>
    const kind = txt(sr.kind)
    const ref = txt(sr.ref)
    if (!body || !rationale) continue
    if (!PSYCH_TYPES.includes(psych)) continue
    if (!['pain_point', 'micro_feedback', 'survey'].includes(kind)) continue
    if (!ref) continue
    if (!looseMatch(ref, poolFor(kind))) continue // 接地しない＝捏造として破棄
    out.push({ body, psych_type: psych, rationale, source_ref: { kind: kind as InsightCandidate['source_ref']['kind'], ref } })
  }
  return out.slice(0, 10)
}

function buildInsightSystem(p: {
  name: string; description: string; painPoints: string[]; needs: string[]; intentBlock: string
}): string {
  return `あなたはブランド戦略家。顧客の表層の不満の裏にある「隠れた本音」を発掘します。
本音とは、本人が口にしない・自覚しにくい「不安・見栄・自己像・恐れ」のこと。

# 与えられた素材
ペルソナ: ${p.name || '（名称未設定）'}｜${p.description || '（説明なし）'}
この人の表層の悩み(pain_points): ${p.painPoints.length ? p.painPoints.map((s) => `「${s}」`).join('、') : '（なし）'}
（参考）この人のニーズ: ${p.needs.length ? p.needs.join('、') : '（なし）'}
（参考）ブランドの理念・提供価値: ${p.intentBlock || '（なし）'}

# 指示
- 上の pain_points のいずれかを起点に、その裏にある隠れた本音を最大10件、日本語1文で。
- 各本音には、起点にした pain_point の原文を source_ref.ref にそのまま転記すること（創作・言い換え禁止）。
- pain_points に接地しない飛躍（占い）は禁止。rationale で「その痛みから、なぜこの本音だと言えるか」を1〜2文。
- 派手さより確かさを優先（尖りは後段で足す）。

# 出力（このJSON配列のみ・前後の説明禁止）
[ { "body":"...", "psych_type":"hidden_anxiety|vanity|self_image|social_fear|aspiration|frustration",
    "rationale":"...", "source_ref": { "kind":"pain_point", "ref":"起点にしたpain_pointの原文" } } ]`
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
 * companyId+personaId の pain_points(+micro_feedbackタグ)から最大10件を生成し、接地検証で絞る。
 * ペルソナ未登録 / pain_points 0件 は空配列（例外を上げない）。
 */
export async function generateInsights(companyId: string, personaId?: string): Promise<InsightCandidate[]> {
  if (!companyId) return []
  const supabase = getSupabaseAdmin()

  const [personaRes, microRes, ontology] = await Promise.all([
    supabase
      .from('brand_personas')
      .select('id, name, description, needs, pain_points, sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true }),
    supabase.from('brand_micro_feedbacks').select('tags').eq('company_id', companyId),
    buildCopyOntologyBlocks(companyId, personaId),
  ])

  const personas = Array.isArray(personaRes.data) ? personaRes.data : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const persona = (personaId ? personas.find((p: any) => p.id === personaId) : null) ?? personas[0]
  if (!persona) return []
  const painPoints = arr(persona.pain_points)
  if (painPoints.length === 0) return []
  const needs = arr(persona.needs)

  // micro_feedback タグ（二次素材）
  const microTags = Array.from(
    new Set(
      (Array.isArray(microRes.data) ? microRes.data : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .flatMap((r: any) => (Array.isArray(r.tags) ? r.tags : []))
        .map((t: unknown) => txt(t))
        .filter(Boolean),
    ),
  )

  const system = buildInsightSystem({
    name: txt(persona.name),
    description: txt(persona.description),
    painPoints,
    needs,
    intentBlock: ontology.intentBlock,
  })
  const raw = await callClaude({ system, userMessage: '隠れた本音を抽出し、指定JSON配列のみを出力せよ。', maxTokens: 4096 })

  // 接地検証（survey_themes は現行スキーマに自由記述が無いため空）
  return validateInsightGrounding(parseJsonArray(raw), {
    pain_points: painPoints,
    micro_tags: microTags,
    survey_themes: [],
  })
}

// コピーAI 生成ロジック（Stage2）。
//
// 役割マトリクス（role-matrix）＋3層分離アセンブラ（ontology-blocks）を組み合わせ、
// system プロンプトを組み立てて callClaude（claude-sonnet-4）で生成する。
//
// injectOntology=false は「ベースライン（before）」。企業名・業種・事業概要(service)・ペルソナ・brief だけの
// 公平条件で、INTENT/FACT/RULES を一切注入しない（前スレッドの output-test 公平化と同条件＝
// 差分は『オントロジー注入の有無』のみ）。true で3層を注入する（after）。
import { callClaude } from '@/lib/claude-api'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fetchPhilosophy } from '@/lib/brand/philosophy'
import { SHARED_CLICHE } from '@/lib/copy/cliche-lexicon'
import {
  COPY_ROLE_MATRIX,
  buildCopySystemPrompt,
  type CopyRole,
  type Register,
} from '@/lib/copy/role-matrix'
import { buildCopyOntologyBlocks, fetchPersonaBlock } from '@/lib/copy/ontology-blocks'

const txt = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim()

export async function generateCopyDraft(opts: {
  companyId: string
  role: CopyRole
  register: Register
  brief?: string
  personaId?: string
  chosenInsight?: string
  chosenAngle?: string
  injectOntology?: boolean // false=ベースライン（before）用。デフォルト true
}): Promise<{ bodies: string[]; system: string; injectedProofIds: string[] }> {
  const inject = opts.injectOntology !== false
  const spec = COPY_ROLE_MATRIX[opts.role]
  const supabase = getSupabaseAdmin()

  // 企業の基本情報（A/B共通）：会社名・業種・事業概要(service)。事業概要は引用可の客観情報。
  const [compRes, philosophy] = await Promise.all([
    supabase
      .from('companies')
      .select('name, industry_category, industry_subcategory')
      .eq('id', opts.companyId)
      .maybeSingle(),
    fetchPhilosophy(supabase, opts.companyId),
  ])
  const comp = compRes.data as
    | { name?: string; industry_category?: string | null; industry_subcategory?: string | null }
    | null
  const name = txt(comp?.name) || '（社名未登録）'
  const industry = [comp?.industry_category, comp?.industry_subcategory].filter(Boolean).map(txt).join(' / ')
  const serviceLines = philosophy.services
    .map((s) => [txt(s.title), txt(s.description)].filter(Boolean).join('：'))
    .filter(Boolean)
  const companyBasics = [
    `# 企業（基本情報）\n会社名: ${name}${industry ? `\n業種: ${industry}` : ''}`,
    serviceLines.length ? `事業概要:\n${serviceLines.map((s) => `- ${s}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // 3層（INTENT/FACT/RULES）と読み手ブロック。ベースラインでは3層を空にし、読み手のみ渡す。
  let intentBlock = ''
  let factBlock = ''
  let rulesBlock = ''
  let personaBlock = ''
  let injectedProofIds: string[] = []

  if (inject) {
    const blocks = await buildCopyOntologyBlocks(opts.companyId, opts.personaId)
    intentBlock = blocks.intentBlock
    factBlock = blocks.factBlock
    rulesBlock = blocks.rulesBlock
    personaBlock = blocks.personaBlock
    injectedProofIds = blocks.injectedProofIds
  } else {
    personaBlock = await fetchPersonaBlock(supabase, opts.companyId, opts.personaId)
  }

  const core = buildCopySystemPrompt({
    role: opts.role,
    register: opts.register,
    intentBlock,
    factBlock,
    rulesBlock,
    personaBlock,
    clicheList: SHARED_CLICHE.join('、'),
    brief: opts.brief,
    chosenInsight: opts.chosenInsight,
    chosenAngle: opts.chosenAngle,
  })
  const system = [companyBasics, core].filter(Boolean).join('\n\n')

  const userMessage = `上記の制約に従い、この企業の${spec.label}のコピーを生成してください。`
  const raw = await callClaude({ system, userMessage, maxTokens: 1024 })

  // candidates>1 は改行区切りで複数案 → split・空行除去・trim。1案役割は全文を1案とする。
  let bodies: string[]
  if (spec.candidates > 1) {
    bodies = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*[-・*0-9.、)）]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, spec.candidates)
  } else {
    bodies = [raw.trim()].filter(Boolean)
  }
  if (bodies.length === 0) bodies = [raw.trim() || '（生成結果が空でした）']

  return { bodies, system, injectedProofIds }
}

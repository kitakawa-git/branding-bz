// ブランド戦略の保存処理（PostgREST 直叩き。ペルソナ・提供価値の id保持sync と companies 更新）
import { supabase } from '@/lib/supabase'
import { type PortalSubtitles } from '@/lib/portal-subtitles'
import type { PositioningMapData } from '@/lib/types/positioning-map'
import {
  type BrandStanceStatements,
  type CompetitorAnalysisItem,
  type PersonaItem,
  type ProvidedValueItem,
  type TargetSegment,
} from './types'

export type RestHeaders = {
  'Content-Type': string
  'apikey': string
  'Authorization': string
  'Prefer': string
}

// 保存リクエスト用ヘッダ（anon key＋ログインセッションのアクセストークン）
export async function buildRestHeaders(): Promise<RestHeaders> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''

  const headers = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=minimal',
  }
  return headers
}

type SaveStrategyParams = {
  companyId: string
  headers: RestHeaders
  personas: PersonaItem[]
  providedValues: ProvidedValueItem[]
  overviewText: string
  validSegments: TargetSegment[]
  positioningMapData: PositioningMapData | null
  brandStanceStatements: BrandStanceStatements | null
  portalSubtitle: string
  portalSubtitlesData: PortalSubtitles | null
  strengths: string
  competitorsAnalysis: CompetitorAnalysisItem[]
}

// 保存本体。失敗時は Error を投げる（呼び出し側でトースト表示）。
// 戻り値は保存で確定した id 付きのペルソナ・提供価値と、更新後のポータルサブタイトル。
export async function saveStrategy({
  companyId,
  headers,
  personas,
  providedValues,
  overviewText,
  validSegments,
  positioningMapData,
  brandStanceStatements,
  portalSubtitle,
  portalSubtitlesData,
  strengths,
  competitorsAnalysis,
}: SaveStrategyParams) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  // ペルソナ保存: id保持sync（提供価値 value_propositions と同方式）。
  // 旧実装は company単位で全DELETE→全INSERT していたが、これだと
  //  (1) persona_data / journey_map_data（Persona Builder のリッチ出力・ジャーニー全体）が
  //      INSERTペイロードに無いため保存のたびに消える、
  //  (2) persona id が変わり、削除時トリガ cleanup_element_relations_on_delete が
  //      persona を端点に持つ element_relations を道連れに消す（エッジ消失）。
  // → 既存id→PATCH（フォーム6項目＋row0特有列のみ。persona_data/journey_map_data は触れず温存）
  //    / 新規→POST / 実際に削除された分のみ DELETE、に変更する。
  const cleanedPersonas = personas.filter(p =>
    p.name.trim() !== '' || p.age_range.trim() !== '' || p.occupation.trim() !== ''
  )

  // 既存ペルソナ id（sort_order順）
  const pExRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas?company_id=eq.${companyId}&select=id&order=sort_order`, { headers })
  if (!pExRes.ok) {
    throw new Error(`ペルソナの既存取得エラー: HTTP ${pExRes.status}: ${await pExRes.text()}`)
  }
  const pExistingIds = ((await pExRes.json()) as { id: string }[]).map(r => r.id)
  const pExistingIdSet = new Set(pExistingIds)
  const pKept = new Set<string>()
  const savedPersonas: PersonaItem[] = []

  // 1ペルソナ分の書き込み値。persona_data / journey_map_data は含めない＝既存値を温存。
  // target / positioning_map_data / segmentation_data は従来どおり先頭行(row0)にのみ載せる。
  const buildPersonaPayload = (p: PersonaItem, i: number) => ({
    name: p.name,
    avatar_emoji: p.avatar_emoji || null,
    age_range: p.age_range || null,
    occupation: p.occupation || null,
    description: p.description || null,
    needs: p.needs.filter(n => n.trim() !== ''),
    pain_points: p.pain_points.filter(pp => pp.trim() !== ''),
    decision_factors: p.decision_factors.filter(d => d.trim() !== ''),
    buying_barriers: p.buying_barriers.filter(b => b.trim() !== ''),
    brand_expectations: p.brand_expectations.trim() || null,
    sort_order: i,
    target: i === 0 ? (overviewText || null) : null,
    positioning_map_data: i === 0 ? (positioningMapData || null) : null,
    brand_stance_statements: i === 0 ? (brandStanceStatements || null) : null,
  })

  if (cleanedPersonas.length > 0) {
    for (let i = 0; i < cleanedPersonas.length; i++) {
      const p = cleanedPersonas[i]
      const payload = buildPersonaPayload(p, i)
      if (p.id && pExistingIdSet.has(p.id)) {
        const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=eq.${p.id}`, {
          method: 'PATCH', headers, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`ペルソナの更新エラー: HTTP ${res.status}: ${await res.text()}`)
        pKept.add(p.id)
        savedPersonas.push({ ...p, id: p.id })
      } else {
        const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
          method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ company_id: companyId, ...payload }),
        })
        if (!res.ok) throw new Error(`ペルソナの挿入エラー: HTTP ${res.status}: ${await res.text()}`)
        const inserted = (await res.json()) as { id: string }[]
        const nid = inserted[0]?.id
        if (nid) pKept.add(nid)
        savedPersonas.push({ ...p, id: nid })
      }
    }
  } else if (overviewText || positioningMapData || brandStanceStatements) {
    // ペルソナは無いが概要/ポジショニング/立ち位置を保持するため row0 を1件維持。
    const dummyPayload = {
      name: '',
      sort_order: 0,
      target: overviewText || null,
      positioning_map_data: positioningMapData || null,
      brand_stance_statements: brandStanceStatements || null,
    }
    if (pExistingIds.length > 0) {
      const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=eq.${pExistingIds[0]}`, {
        method: 'PATCH', headers, body: JSON.stringify(dummyPayload),
      })
      if (!res.ok) throw new Error(`ペルソナ概要の更新エラー: HTTP ${res.status}: ${await res.text()}`)
      pKept.add(pExistingIds[0])
    } else {
      const res = await fetch(`${supabaseUrl}/rest/v1/brand_personas`, {
        method: 'POST', headers, body: JSON.stringify({ company_id: companyId, ...dummyPayload }),
      })
      if (!res.ok) throw new Error(`ペルソナ概要の挿入エラー: HTTP ${res.status}: ${await res.text()}`)
    }
  }

  // 実際に削除されたペルソナのみ DELETE（ここだけ削除時トリガでエッジ整理が正しく起きる）
  const pToDelete = pExistingIds.filter(id => !pKept.has(id))
  if (pToDelete.length > 0) {
    const delRes = await fetch(`${supabaseUrl}/rest/v1/brand_personas?id=in.(${pToDelete.join(',')})`, {
      method: 'DELETE', headers,
    })
    if (!delRes.ok) throw new Error(`ペルソナの削除エラー: HTTP ${delRes.status}: ${await delRes.text()}`)
  }

  // 提供価値（value_propositions）保存: id保持sync。
  // 全削除→全INSERT だと毎回 id が変わり、削除時トリガ cleanup_element_relations_on_delete が
  // vp を端点に持つ element_relations を道連れに消す（エッジ消失バグ）。よって
  // 既存id→PATCH（in-place UPDATE）/ 新規→POST / 実際に削除された分のみ DELETE に変更する。
  const cleanedValues = providedValues.filter(v => v.title.trim() !== '')
  const bvExRes = await fetch(`${supabaseUrl}/rest/v1/value_propositions?company_id=eq.${companyId}&select=id`, { headers })
  if (!bvExRes.ok) {
    throw new Error(`提供価値の既存取得エラー: HTTP ${bvExRes.status}: ${await bvExRes.text()}`)
  }
  const bvExistingIds = new Set(((await bvExRes.json()) as { id: string }[]).map(r => r.id))
  const savedValues: ProvidedValueItem[] = []
  const bvKept = new Set<string>()
  for (let i = 0; i < cleanedValues.length; i++) {
    const v = cleanedValues[i]
    const payload = { title: v.title.trim(), description: v.description?.trim() || null, sort_order: i }
    if (v.id && bvExistingIds.has(v.id)) {
      const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions?id=eq.${v.id}`, {
        method: 'PATCH', headers, body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`提供価値の更新エラー: HTTP ${res.status}: ${await res.text()}`)
      bvKept.add(v.id)
      savedValues.push({ ...v, id: v.id })
    } else {
      const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions`, {
        method: 'POST', headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ company_id: companyId, ...payload }),
      })
      if (!res.ok) throw new Error(`提供価値の挿入エラー: HTTP ${res.status}: ${await res.text()}`)
      const inserted = (await res.json()) as { id: string }[]
      const nid = inserted[0]?.id
      if (nid) bvKept.add(nid)
      savedValues.push({ ...v, id: nid })
    }
  }
  // 実際に削除された提供価値のみ DELETE（ここだけ削除時トリガでエッジ整理が正しく起きる）
  const bvToDelete = [...bvExistingIds].filter(id => !bvKept.has(id))
  if (bvToDelete.length > 0) {
    const res = await fetch(`${supabaseUrl}/rest/v1/value_propositions?id=in.(${bvToDelete.join(',')})`, {
      method: 'DELETE', headers,
    })
    if (!res.ok) throw new Error(`提供価値の削除エラー: HTTP ${res.status}: ${await res.text()}`)
  }

  // ポータルサブタイトル + ターゲットセグメント保存（companies テーブル）
  const updatedSubtitles = { ...(portalSubtitlesData || {}) }
  if (portalSubtitle.trim()) {
    updatedSubtitles.strategy = portalSubtitle.trim()
  } else {
    delete updatedSubtitles.strategy
  }
  const companyRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${companyId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      portal_subtitles: Object.keys(updatedSubtitles).length > 0 ? updatedSubtitles : null,
      target_segments: validSegments.length > 0 ? validSegments : null,
      // プロット項目カードで編集した自社の強み・競合の特徴
      strengths: strengths.trim() || null,
      // competitors_analysis は NOT NULL（既定 '[]'）。null を送ると PATCH 全体が 400 になり、同時に送る他の列も保存されない
      competitors_analysis: competitorsAnalysis
        .filter(c => c.name.trim())
        .map(c => ({ name: c.name.trim(), traits: c.traits.trim() })),
    }),
  })
  if (!companyRes.ok) throw new Error(`会社情報の更新エラー: HTTP ${companyRes.status}: ${await companyRes.text()}`)

  return { savedPersonas, savedValues, updatedSubtitles }
}

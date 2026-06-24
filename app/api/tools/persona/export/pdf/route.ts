// ペルソナビルダー レポート PDF出力API
// POST /api/tools/persona/export/pdf
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { PersonaPdfDocument, type PersonaPdfGroup } from '@/app/tools/persona/app/components/PersonaPdfDocument'

interface PersonaLike {
  target_name?: string
  demographics?: {
    persona_name?: string
    age?: number | string
    gender?: string
    occupation?: string
    company_role?: string
  }
  goals?: {
    primary_goals?: string[]
    pain_points?: string[]
    decision_factors?: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId が必要です' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('app_type', 'persona')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const sd = session.session_data || {}
    const personas: PersonaLike[] = Array.isArray(sd.personas) ? sd.personas : []
    if (personas.length === 0) {
      return NextResponse.json({ error: 'ペルソナがありません。' }, { status: 400 })
    }

    const basicInfo = sd.basic_info || {}
    const companyName = basicInfo.company_name || 'ペルソナ'
    const generatedDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })

    // セグメント（ターゲット）ごとにグループ化（Step5表示と同じ）
    const segments: Array<{ name: string; description?: string }> =
      (basicInfo.target_segments || []).filter((s: { name?: string }) => s?.name?.trim())
    const segNames = new Set(segments.map(s => s.name))
    const toMember = (p: PersonaLike, idx: number) => {
      const d = p.demographics || {}
      const meta = [d.age ? String(d.age) : '', d.gender, d.occupation, d.company_role]
        .map(v => (v || '').trim()).filter(Boolean).join(' / ')
      return {
        name: d.persona_name?.trim() || `ペルソナ${idx + 1}`,
        meta,
        needs: p.goals?.primary_goals || [],
        pains: p.goals?.pain_points || [],
        decisionFactors: p.goals?.decision_factors || [],
      }
    }
    const groups: PersonaPdfGroup[] = [
      ...segments.map(s => ({
        name: s.name,
        description: s.description,
        members: personas.filter(p => p.target_name === s.name).map(toMember),
      })),
    ]
    const unclassified = personas.filter(p => !segNames.has(p.target_name || ''))
    if (unclassified.length > 0) {
      groups.push({ name: '未分類', members: unclassified.map(toMember) })
    }
    // メンバーのいないグループは除外
    const filledGroups = groups.filter(g => g.members.length > 0)

    const buffer = await renderToBuffer(
      PersonaPdfDocument({ data: { companyName, generatedDate, groups: filledGroups } })
    )

    const dateStr = generatedDate.replace(/\//g, '')
    const fileName = `persona-${companyName}-${dateStr}.pdf`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    })
  } catch (err) {
    console.error('[Persona PDF Export] エラー:', err)
    return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 })
  }
}

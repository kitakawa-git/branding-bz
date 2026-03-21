// タグマッピング取得・更新API
// GET  /api/brand-score/tag-mappings?company_id=xxx
// PUT  /api/brand-score/tag-mappings

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// 全8タグ
const ALL_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

// GET: タグマッピング取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json(
        { error: 'company_id は必須です' },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('brand_personality_tag_mappings')
      .select('tag, is_expected, updated_at')
      .eq('company_id', companyId)

    if (error) {
      console.error('[tag-mappings] 取得エラー:', error)
      return NextResponse.json(
        { error: 'タグマッピングの取得に失敗しました' },
        { status: 500 },
      )
    }

    // レコードがない場合は8タグ分のデフォルト（全て is_expected: false）を返す
    if (!data || data.length === 0) {
      const defaultMappings = ALL_TAGS.map(tag => ({
        tag,
        is_expected: false,
        updated_at: null,
      }))
      return NextResponse.json({ mappings: defaultMappings })
    }

    // 既存レコードをマップ化
    const existingMap = new Map(data.map(d => [d.tag, d]))

    // 全8タグ分を返す（未登録タグはデフォルトで補完）
    const mappings = ALL_TAGS.map(tag => {
      const existing = existingMap.get(tag)
      return existing
        ? { tag: existing.tag, is_expected: existing.is_expected, updated_at: existing.updated_at }
        : { tag, is_expected: false, updated_at: null }
    })

    return NextResponse.json({ mappings })
  } catch (err) {
    console.error('[tag-mappings] エラー:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}

// PUT: タグマッピング一括更新（UPSERT）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { companyId, mappings } = body

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId は必須です' },
        { status: 400 },
      )
    }

    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json(
        { error: 'mappings は必須です' },
        { status: 400 },
      )
    }

    // UPSERT用データ構築
    const rows = mappings.map((m: { tag: string; is_expected: boolean }) => ({
      company_id: companyId,
      tag: m.tag,
      is_expected: m.is_expected,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('brand_personality_tag_mappings')
      .upsert(rows, { onConflict: 'company_id,tag' })

    if (error) {
      console.error('[tag-mappings] 更新エラー:', error)
      return NextResponse.json(
        { error: 'タグマッピングの更新に失敗しました' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tag-mappings] エラー:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 },
    )
  }
}

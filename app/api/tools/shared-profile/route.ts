// 共通プロフィールAPI — カラーツール・STPツール共通
// GET:  本体(companies) or 過去セッションから基本情報をプリフィル
// PATCH: セッション完了時に本体(companies)へ書き戻し
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET /api/tools/shared-profile?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // 1. admin_users から company_id を検索
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('company_id')
      .eq('auth_id', userId)
      .maybeSingle()

    if (adminUser?.company_id) {
      // 2. companies テーブルから読み込み
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('name, industry_category, industry_subcategory, brand_stage, competitors')
        .eq('id', adminUser.company_id)
        .single()

      if (company) {
        return NextResponse.json({
          source: 'company',
          data: {
            brand_name: company.name || '',
            industry_category: company.industry_category || '',
            industry_subcategory: company.industry_subcategory || '',
            brand_stage: company.brand_stage || '',
            competitor_colors: extractCompetitorColors(company.competitors || []),
          },
        })
      }
    }

    // 3. 過去の完了セッションから読み込み
    const { data: sessions } = await supabaseAdmin
      .from('mini_app_sessions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    if (sessions && sessions.length > 0) {
      const meta = sessions[0].metadata as Record<string, unknown> | null
      if (meta) {
        return NextResponse.json({
          source: 'session',
          data: {
            brand_name: meta.brand_name || '',
            industry_category: meta.industry_category || '',
            industry_subcategory: meta.industry_subcategory || '',
            brand_stage: meta.brand_stage || '',
            competitor_colors: meta.competitor_colors || [],
          },
        })
      }
    }

    // 4. 何も見つからない
    return NextResponse.json({ source: 'none', data: null })
  } catch (err) {
    console.error('[SharedProfile GET] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// PATCH /api/tools/shared-profile
// body: { userId, industry_category, industry_subcategory, brand_stage, competitor_colors }
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, industry_category, industry_subcategory, brand_stage, competitor_colors } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId が必要です' }, { status: 400 })
    }

    // admin_users から company_id を検索
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('company_id')
      .eq('auth_id', userId)
      .maybeSingle()

    if (!adminUser?.company_id) {
      // 本体アカウントがない場合は何もしない
      return NextResponse.json({ updated: false, reason: 'no_company_account' })
    }

    // 現在の competitors を取得してマージ
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('competitors')
      .eq('id', adminUser.company_id)
      .single()

    const existingCompetitors: Array<{ name: string; url: string; colors: string[]; notes: string }> =
      (company?.competitors as Array<{ name: string; url: string; colors: string[]; notes: string }>) || []

    // competitor_colors からマージ
    const mergedCompetitors = mergeCompetitors(existingCompetitors, competitor_colors || [])

    // companies を更新
    const updateData: Record<string, unknown> = {}
    if (industry_category !== undefined) updateData.industry_category = industry_category || null
    if (industry_subcategory !== undefined) updateData.industry_subcategory = industry_subcategory || null
    if (brand_stage !== undefined) updateData.brand_stage = brand_stage || null
    if (competitor_colors !== undefined) updateData.competitors = mergedCompetitors

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabaseAdmin
        .from('companies')
        .update(updateData)
        .eq('id', adminUser.company_id)

      if (error) {
        console.error('[SharedProfile PATCH] 更新エラー:', error)
        return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
      }
    }

    return NextResponse.json({ updated: true })
  } catch (err) {
    console.error('[SharedProfile PATCH] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// companies.competitors から競合カラー情報を抽出
function extractCompetitorColors(
  competitors: Array<{ name: string; colors?: string[]; url?: string; notes?: string }>
): Array<{ name: string; hex: string }> {
  const result: Array<{ name: string; hex: string }> = []
  for (const c of competitors) {
    if (c.colors && c.colors.length > 0) {
      // 各色をそれぞれのエントリとして返す
      for (const hex of c.colors) {
        result.push({ name: c.name, hex })
      }
    }
  }
  return result
}

// ツールの competitor_colors を既存の competitors にマージ
function mergeCompetitors(
  existing: Array<{ name: string; url: string; colors: string[]; notes: string }>,
  toolColors: Array<{ name: string; hex: string }>
): Array<{ name: string; url: string; colors: string[]; notes: string }> {
  const result = existing.map(c => ({ ...c }))

  for (const tc of toolColors) {
    if (!tc.name.trim()) continue
    const found = result.find(c => c.name === tc.name.trim())
    if (found) {
      // 既存の競合にカラーを追加（重複除外）
      if (!found.colors.includes(tc.hex)) {
        found.colors = [...found.colors, tc.hex]
      }
    } else {
      // 新規追加
      result.push({ name: tc.name.trim(), url: '', colors: [tc.hex], notes: '' })
    }
  }

  return result
}

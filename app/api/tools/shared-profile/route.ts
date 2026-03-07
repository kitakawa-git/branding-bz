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

      // 3. brand_guidelines から事業内容を取得
      const { data: guidelines } = await supabaseAdmin
        .from('brand_guidelines')
        .select('business_content')
        .eq('company_id', adminUser.company_id)
        .maybeSingle()

      // 4. brand_personas からターゲット情報を取得
      const { data: persona } = await supabaseAdmin
        .from('brand_personas')
        .select('target')
        .eq('company_id', adminUser.company_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (company) {
        // business_content 配列を文字列に変換
        const businessDescription = extractBusinessDescription(
          guidelines?.business_content as Array<{ title: string; description: string }> | null
        )

        return NextResponse.json({
          source: 'company',
          data: {
            brand_name: company.name || '',
            industry_category: company.industry_category || '',
            industry_subcategory: company.industry_subcategory || '',
            brand_stage: company.brand_stage || '',
            competitor_colors: extractCompetitorColors(company.competitors || []),
            // STPツール向け追加フィールド
            competitors: extractCompetitors(company.competitors || []),
            business_description: businessDescription,
            target_customers: persona?.target || '',
          },
        })
      }
    }

    // 5. 過去の完了セッションから読み込み
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
            competitors: meta.competitors || [],
            business_description: meta.business_description || '',
            target_customers: meta.target_customers || '',
          },
        })
      }
    }

    // 6. 何も見つからない
    return NextResponse.json({ source: 'none', data: null })
  } catch (err) {
    console.error('[SharedProfile GET] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// PATCH /api/tools/shared-profile
// body: { userId, industry_category, industry_subcategory, brand_stage, competitor_colors?, competitors? }
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, industry_category, industry_subcategory, brand_stage, competitor_colors, competitors } = body

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

    // companies を更新
    const updateData: Record<string, unknown> = {}
    if (industry_category !== undefined) updateData.industry_category = industry_category || null
    if (industry_subcategory !== undefined) updateData.industry_subcategory = industry_subcategory || null
    if (brand_stage !== undefined) updateData.brand_stage = brand_stage || null

    // カラーツールからの competitor_colors マージ
    if (competitor_colors !== undefined) {
      updateData.competitors = mergeCompetitorsFromColors(existingCompetitors, competitor_colors || [])
    }

    // STPツールからの competitors マージ（name + url）
    if (competitors !== undefined) {
      const base = (updateData.competitors as typeof existingCompetitors) || existingCompetitors
      updateData.competitors = mergeCompetitorsFromSTP(base, competitors || [])
    }

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

// brand_guidelines.business_content から事業内容テキストを生成
function extractBusinessDescription(
  content: Array<{ title: string; description: string }> | null
): string {
  if (!content || content.length === 0) return ''
  return content
    .map(c => c.title + (c.description ? `（${c.description}）` : ''))
    .join('、')
}

// companies.competitors から競合カラー情報を抽出（カラーツール向け）
function extractCompetitorColors(
  competitors: Array<{ name: string; colors?: string[]; url?: string; notes?: string }>
): Array<{ name: string; hex: string }> {
  const result: Array<{ name: string; hex: string }> = []
  for (const c of competitors) {
    if (c.colors && c.colors.length > 0) {
      for (const hex of c.colors) {
        result.push({ name: c.name, hex })
      }
    }
  }
  return result
}

// companies.competitors から競合リストを抽出（STPツール向け）
function extractCompetitors(
  competitors: Array<{ name: string; url?: string; colors?: string[]; notes?: string }>
): Array<{ name: string; url: string }> {
  return competitors.map(c => ({
    name: c.name,
    url: c.url || '',
  }))
}

// カラーツールの competitor_colors を既存の competitors にマージ
function mergeCompetitorsFromColors(
  existing: Array<{ name: string; url: string; colors: string[]; notes: string }>,
  toolColors: Array<{ name: string; hex: string }>
): Array<{ name: string; url: string; colors: string[]; notes: string }> {
  const result = existing.map(c => ({ ...c }))

  for (const tc of toolColors) {
    if (!tc.name.trim()) continue
    const found = result.find(c => c.name === tc.name.trim())
    if (found) {
      if (!found.colors.includes(tc.hex)) {
        found.colors = [...found.colors, tc.hex]
      }
    } else {
      result.push({ name: tc.name.trim(), url: '', colors: [tc.hex], notes: '' })
    }
  }

  return result
}

// STPツールの competitors を既存の competitors にマージ（name + url）
function mergeCompetitorsFromSTP(
  existing: Array<{ name: string; url: string; colors: string[]; notes: string }>,
  stpCompetitors: Array<{ name: string; url: string }>
): Array<{ name: string; url: string; colors: string[]; notes: string }> {
  const result = existing.map(c => ({ ...c }))

  for (const sc of stpCompetitors) {
    if (!sc.name.trim()) continue
    const found = result.find(c => c.name === sc.name.trim())
    if (found) {
      // URLが空でなければ更新
      if (sc.url && sc.url.trim()) {
        found.url = sc.url.trim()
      }
    } else {
      result.push({ name: sc.name.trim(), url: sc.url?.trim() || '', colors: [], notes: '' })
    }
  }

  return result
}

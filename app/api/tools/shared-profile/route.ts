// 共通プロフィールAPI — カラーツール・STPツール共通
// GET:  本体(companies) or 過去セッションから基本情報をプリフィル
// PATCH: セッション完了時に本体(companies)へ書き戻し
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// brand_stage の値を正規化（廃止された値を有効な値に変換）
function normalizeBrandStage(stage: string | null | undefined): string {
  if (stage === 'refinement' || stage === 'refine') return 'rebrand'
  return stage || ''
}

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
        .select('name, industry_category, industry_subcategory, brand_stage, competitors, target_segments')
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
        // business_content 配列（構造化データ）
        const businessContent = (guidelines?.business_content as Array<{ title: string; description: string }>) || []
        const businessDescriptions = businessContent.map(c => ({
          title: c.title || '',
          description: c.description || '',
        }))

        // target_segments 構造化データ（companies.target_segments → フォールバック: brand_personas.target テキスト）
        const rawTargetSegments = (company.target_segments as Array<{ name: string; description: string }>) || []
        let targetSegments: Array<{ name: string; description: string }>
        if (rawTargetSegments.length > 0) {
          targetSegments = rawTargetSegments.map(ts => ({
            name: ts.name || '',
            description: ts.description || '',
          }))
        } else if (persona?.target && typeof persona.target === 'string' && persona.target.trim()) {
          // 後方互換: テキスト全体を1つのセグメントとして返す
          targetSegments = [{ name: 'ターゲット', description: persona.target.trim() }]
        } else {
          targetSegments = []
        }

        return NextResponse.json({
          source: 'company',
          data: {
            brand_name: company.name || '',
            industry_category: company.industry_category || '',
            industry_subcategory: company.industry_subcategory || '',
            brand_stage: normalizeBrandStage(company.brand_stage),
            competitor_colors: extractCompetitorColors(company.competitors || []),
            // STPツール向け追加フィールド
            competitors: extractCompetitors(company.competitors || []),
            business_descriptions: businessDescriptions,
            target_customers: persona?.target || '',
            target_segments: targetSegments,
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
            brand_stage: normalizeBrandStage(meta.brand_stage as string),
            competitor_colors: meta.competitor_colors || [],
            competitors: meta.competitors || [],
            business_descriptions: meta.business_descriptions || [],
            target_customers: meta.target_customers || '',
            target_segments: meta.target_segments || [],
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
// body: { userId, company_name?, industry_category?, industry_subcategory?, brand_stage?, competitor_colors?, competitors?, business_descriptions?, target_segments? }
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { userId, company_name, industry_category, industry_subcategory, brand_stage, competitor_colors, competitors, business_descriptions, target_segments } = body

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
    if (company_name !== undefined && company_name.trim()) updateData.name = company_name.trim()
    if (industry_category !== undefined) updateData.industry_category = industry_category || null
    if (industry_subcategory !== undefined) updateData.industry_subcategory = industry_subcategory || null
    if (brand_stage !== undefined) updateData.brand_stage = normalizeBrandStage(brand_stage) || null

    // カラーツールからの competitor_colors マージ
    if (competitor_colors !== undefined) {
      updateData.competitors = mergeCompetitorsFromColors(existingCompetitors, competitor_colors || [])
    }

    // STPツールからの competitors マージ（name + url）
    if (competitors !== undefined) {
      const base = (updateData.competitors as typeof existingCompetitors) || existingCompetitors
      updateData.competitors = mergeCompetitorsFromSTP(base, competitors || [])
    }

    // ターゲットセグメントの書き込み
    if (target_segments !== undefined && Array.isArray(target_segments)) {
      updateData.target_segments = target_segments
        .filter((ts: { name: string; description: string }) => ts.name?.trim())
        .map((ts: { name: string; description: string }) => ({
          name: ts.name.trim(),
          description: ts.description?.trim() || '',
        }))
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

    // brand_guidelines の事業内容を更新
    if (business_descriptions !== undefined && Array.isArray(business_descriptions)) {
      const businessContent = business_descriptions.map(
        (item: { title: string; description: string }, i: number) => ({
          title: item.title || '',
          description: item.description || '',
          added_index: i,
        })
      )

      // brand_guidelines レコードが存在するか確認
      const { data: existingGuidelines } = await supabaseAdmin
        .from('brand_guidelines')
        .select('id')
        .eq('company_id', adminUser.company_id)
        .maybeSingle()

      if (existingGuidelines) {
        // 既存レコードを更新
        const { error: guidelinesError } = await supabaseAdmin
          .from('brand_guidelines')
          .update({ business_content: businessContent })
          .eq('id', existingGuidelines.id)

        if (guidelinesError) {
          console.error('[SharedProfile PATCH] brand_guidelines更新エラー:', guidelinesError)
        }
      } else {
        // レコードがなければ新規作成
        const { error: guidelinesError } = await supabaseAdmin
          .from('brand_guidelines')
          .insert({
            company_id: adminUser.company_id,
            business_content: businessContent,
          })

        if (guidelinesError) {
          console.error('[SharedProfile PATCH] brand_guidelines挿入エラー:', guidelinesError)
        }
      }
    }

    // brand_personas.target にもターゲット情報をテキスト整形して書き込み
    if (target_segments !== undefined && Array.isArray(target_segments)) {
      const validSegments = target_segments.filter(
        (ts: { name: string; description: string }) => ts.name?.trim()
      )
      const targetText = validSegments
        .map((ts: { name: string; description: string }) => {
          const desc = ts.description?.trim() ? `：${ts.description.trim()}` : ''
          return `・${ts.name.trim()}${desc}`
        })
        .join('\n')

      const { data: existingPersona } = await supabaseAdmin
        .from('brand_personas')
        .select('id')
        .eq('company_id', adminUser.company_id)
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (existingPersona) {
        await supabaseAdmin
          .from('brand_personas')
          .update({ target: targetText || null })
          .eq('id', existingPersona.id)
      } else if (targetText) {
        await supabaseAdmin
          .from('brand_personas')
          .insert({
            company_id: adminUser.company_id,
            name: '',
            sort_order: 0,
            target: targetText,
          })
      }
    }

    return NextResponse.json({ updated: true })
  } catch (err) {
    console.error('[SharedProfile PATCH] エラー:', err)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

// companies.competitors から競合カラー情報を抽出（カラーツール向け）
// 全競合を返す（色未設定の場合はデフォルトカラーを付与）
function extractCompetitorColors(
  competitors: Array<{ name: string; colors?: string[]; url?: string; notes?: string }>
): Array<{ name: string; hex: string }> {
  return competitors
    .filter(c => c.name?.trim())
    .map(c => ({
      name: c.name,
      hex: c.colors?.[0] || '#888888',
    }))
}

// companies.competitors から競合リストを抽出（STPツール向け）
function extractCompetitors(
  competitors: Array<{ name: string; url?: string; colors?: string[]; notes?: string }>
): Array<{ name: string; url: string; notes: string }> {
  return competitors.map(c => ({
    name: c.name,
    url: c.url || '',
    notes: c.notes || '',
  }))
}

// カラーツールの competitor_colors で既存を置換（STPツール由来のデータは保持）
function mergeCompetitorsFromColors(
  existing: Array<{ name: string; url: string; colors: string[]; notes: string }>,
  toolColors: Array<{ name: string; hex: string }>
): Array<{ name: string; url: string; colors: string[]; notes: string }> {
  // カラーツールの送信リストをソースオブトゥルースとして構築
  const result: Array<{ name: string; url: string; colors: string[]; notes: string }> = []

  for (const tc of toolColors) {
    if (!tc.name.trim()) continue
    const normalizedName = tc.name.trim().toLowerCase()
    const found = existing.find(c => c.name.trim().toLowerCase() === normalizedName)
    result.push({
      name: tc.name.trim(),
      url: found?.url || '',
      colors: tc.hex ? [tc.hex] : [],
      notes: found?.notes || '',
    })
  }

  // STPツールのみで追加された競合（カラーリストにないがURL/notesがある）を保持
  for (const ec of existing) {
    if (!ec.name?.trim()) continue
    const normalizedName = ec.name.trim().toLowerCase()
    const inResult = result.find(r => r.name.trim().toLowerCase() === normalizedName)
    if (!inResult && (ec.url || ec.notes)) {
      result.push({ ...ec, colors: [] })
    }
  }

  return result
}

// STPツールの competitors で既存を置換（カラーツール由来のデータは保持）
function mergeCompetitorsFromSTP(
  existing: Array<{ name: string; url: string; colors: string[]; notes: string }>,
  stpCompetitors: Array<{ name: string; url: string; notes?: string }>
): Array<{ name: string; url: string; colors: string[]; notes: string }> {
  // STPツールの送信リストをソースオブトゥルースとして構築
  const result: Array<{ name: string; url: string; colors: string[]; notes: string }> = []

  for (const sc of stpCompetitors) {
    if (!sc.name.trim()) continue
    const normalizedName = sc.name.trim().toLowerCase()
    const found = existing.find(c => c.name.trim().toLowerCase() === normalizedName)
    result.push({
      name: sc.name.trim(),
      url: sc.url?.trim() || '',
      colors: found?.colors || [],
      notes: sc.notes?.trim() || '',
    })
  }

  // カラーツールのみで追加された競合（STPリストにないが色情報がある）を保持
  for (const ec of existing) {
    if (!ec.name?.trim()) continue
    const normalizedName = ec.name.trim().toLowerCase()
    const inResult = result.find(r => r.name.trim().toLowerCase() === normalizedName)
    if (!inResult && ec.colors && ec.colors.length > 0) {
      result.push({ ...ec })
    }
  }

  return result
}

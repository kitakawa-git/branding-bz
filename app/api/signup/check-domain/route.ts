// ドメイン認証: メールドメインで既存企業を検索
// POST /api/signup/check-domain
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// フリーメールドメイン一覧（これらは企業マッチング対象外）
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.co.jp', 'yahoo.com', 'ymail.com',
  'outlook.com', 'outlook.jp', 'hotmail.com', 'hotmail.co.jp',
  'live.com', 'live.jp', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com', 'gmx.com',
])

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'メールアドレスが不正です' }, { status: 400 })
    }

    const domain = email.split('@')[1].toLowerCase()

    // フリーメールならスキップ
    if (FREE_EMAIL_DOMAINS.has(domain)) {
      return NextResponse.json({ match: false, reason: 'free_email' })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // email_domain が一致する企業を検索
    const { data: companies, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, logo_url')
      .eq('email_domain', domain)

    if (error) {
      console.error('[CheckDomain] DB検索エラー:', error.message)
      return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ match: false, reason: 'no_match' })
    }

    return NextResponse.json({
      match: true,
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        logo_url: c.logo_url,
      })),
    })
  } catch (err) {
    console.error('[CheckDomain] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

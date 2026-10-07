// ドメイン認証: メールドメインで既存企業を検索
// POST /api/signup/check-domain
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { FREE_EMAIL_DOMAINS, FREE_EMAIL_REJECTION_MESSAGE } from '@/lib/constants/free-email-domains'
import { isSignupEmailBlocked } from '@/lib/signup/email-allowlist'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'メールアドレスが不正です' }, { status: 400 })
    }

    const domain = email.split('@')[1].toLowerCase()

    // フリーメールは登録不可（登録画面のステップ1はこの応答で止める）。
    // 例外許可リスト（環境変数 FREE_EMAIL_ALLOWLIST）のアドレスは通すが、企業マッチングはしない。
    if (isSignupEmailBlocked(email)) {
      return NextResponse.json(
        { match: false, reason: 'free_email_blocked', error: FREE_EMAIL_REJECTION_MESSAGE },
        { status: 400 },
      )
    }
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

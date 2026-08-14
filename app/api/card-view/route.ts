// スマート名刺アクセス記録API
// POST /api/card-view
// 名刺ページ表示時にクライアントから呼び出される
// 同一IPからの連続アクセスは5分間重複排除
import { NextRequest, NextResponse } from 'next/server'
import { canRecordAnalytics, fetchCompanyIdForProfile } from '@/lib/billing/guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

/**
 * 本番の閲覧数だけを数える。
 * ローカル開発も Vercel の Preview も本番の Supabase を見ているため、
 * 何も判定しないと開発中に名刺ページを開いた回数がそのまま顧客の閲覧数に混ざる。
 * （実際 card_views の 216 件が localhost からの記録だった）
 */
function isProductionTraffic(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  return process.env.NODE_ENV === 'production'
}

/**
 * 閲覧者がその会社の中の人（メンバーまたは管理者）かどうか。
 * 名刺ページ自体はログイン不要なので、社外の閲覧者はここで必ず false になる。
 * ログアウト状態や別ブラウザからの自分の確認までは弾けないが、
 * 管理画面を開いたまま自分の名刺を見る、という一番多い経路は防げる。
 */
async function isOwnCompanyVisitor(companyId: string): Promise<boolean> {
  try {
    const supabaseUser = await createServerSupabase()
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return false

    const admin = getSupabaseAdmin()
    const [{ data: member }, { data: adminUser }] = await Promise.all([
      admin
        .from('members')
        .select('id')
        .eq('auth_id', user.id)
        .eq('company_id', companyId)
        .maybeSingle(),
      admin
        .from('admin_users')
        .select('id')
        .eq('auth_id', user.id)
        .eq('company_id', companyId)
        .maybeSingle(),
    ])
    return member !== null || adminUser !== null
  } catch {
    // 判定できなかったときは従来どおり記録する（記録漏れより重複のほうが気付ける）
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profileId } = body

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }

    if (!isProductionTraffic()) {
      return NextResponse.json({ recorded: false, reason: 'not_production' })
    }

    // 重複排除の判定で card_views を読む必要がある。SELECT ポリシーは authenticated
    // 限定なので anon クライアントだと「エラーなしの0件」が返り、直近アクセスを
    // 常に見落として毎回INSERTしていた（＝5分の重複排除が一度も効いていなかった）
    const supabase = getSupabaseAdmin()

    // IPアドレス取得（Vercel環境 + ローカル対応）
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    // User-Agent取得
    const userAgent = request.headers.get('user-agent') || ''

    // Referer取得
    const referer = request.headers.get('referer') || ''

    // Vercel Geo情報（Vercelデプロイ時のみ利用可能）
    const country = request.headers.get('x-vercel-ip-country') || null
    const city = request.headers.get('x-vercel-ip-city') || null

    const companyId = await fetchCompanyIdForProfile(profileId)

    // プラン判定: free では記録を残さない（名刺ページ自体は見えたままにする）。
    // 配布済みの QR を殺さないための方針。閲覧者にエラーは返さない
    if (!(await canRecordAnalytics(companyId))) {
      return NextResponse.json({ recorded: false, reason: 'plan_required' })
    }

    // 自社の人が自分たちの名刺を開いたぶんは数えない。
    // この数字は「配った相手にどれだけ届いたか」で、アウタースコアのデジタル接点
    // にも入るため、社内の確認作業が混ざるとスコアごと上振れする
    if (companyId && (await isOwnCompanyVisitor(companyId))) {
      return NextResponse.json({ recorded: false, reason: 'own_company' })
    }

    // 5分間重複排除: 同一IP + 同一profileIdの最新レコードを確認
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data: recentView, error: recentError } = await supabase
      .from('card_views')
      .select('id')
      .eq('profile_id', profileId)
      .eq('ip_address', ip)
      .gte('viewed_at', fiveMinAgo)
      .limit(1)
      .maybeSingle()

    // 読めなかったときに黙って「重複なし」に倒すと、また水増しに戻る。
    // 記録を止めるほどではないのでログには残す
    if (recentError) {
      console.error('[CardView] 重複判定の読み取りエラー:', recentError.message)
    }

    if (recentView) {
      // 5分以内に同一IPからのアクセスあり → スキップ
      return NextResponse.json({ recorded: false, reason: 'duplicate' })
    }

    // アクセス記録をINSERT
    const { error: insertError } = await supabase
      .from('card_views')
      .insert({
        profile_id: profileId,
        ip_address: ip,
        user_agent: userAgent,
        referer: referer,
        country: country,
        city: city,
      })

    if (insertError) {
      console.error('[CardView] INSERT エラー:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ recorded: true })
  } catch (err) {
    console.error('[CardView] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

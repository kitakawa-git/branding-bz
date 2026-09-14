import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/mail/superadmin-notify'

// 資料請求（POST /api/document-request）
//
// /api/contact と同じ仕組みに相乗りする。保存先は contact_inquiries で、
// inquiry_type='document' で問い合わせと区別する（値は contact / document / demo）。
// message は NOT NULL なので固定文言を入れる。
//
// 資料そのものはフォームを通った人に URL を返し、同じ URL をメールでも送る。
// PDF 直リンクが検索結果に出てフォームを迂回されないよう、robots で /documents/ を塞いである。

const DOWNLOAD_PATH = '/documents/branding-bz-service-guide.pdf'
const DOWNLOAD_URL = `https://branding.bz${DOWNLOAD_PATH}`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { company_name, contact_name, email, phone } = body

    // バリデーション（contact と同じ方針。資料請求は会社名も必須）
    if (!company_name?.trim()) {
      return NextResponse.json({ error: '会社名は必須です' }, { status: 400 })
    }
    if (!contact_name?.trim()) {
      return NextResponse.json({ error: 'お名前は必須です' }, { status: 400 })
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 })
    }

    // Supabase にINSERT（service role key でRLSをバイパス）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabase.from('contact_inquiries').insert({
      inquiry_type: 'document',
      company_name: company_name.trim(),
      contact_name: contact_name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      message: '資料請求',
    })

    if (error) {
      console.error('contact_inquiries insert error (document):', error)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }

    // メール送信（失敗しても送信自体は成功扱い＝contact と同じ）
    const resendApiKey = process.env.RESEND_API_KEY
    const notificationEmail = process.env.CONTACT_NOTIFICATION_EMAIL

    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      const companyName = escapeHtml(company_name.trim())
      const contactName = escapeHtml(contact_name.trim())

      // (1) 申込者へ資料のご案内
      try {
        await resend.emails.send({
          from: 'branding.bz <noreply@branding.bz>',
          to: email.trim(),
          subject: 'branding.bz サービス資料のご案内',
          html: `
            <p>${companyName}<br />${contactName} 様</p>
            <p>このたびは branding.bz のサービス資料をご請求いただき、ありがとうございます。<br />
            下記のリンクから資料（PDF・全16ページ）をダウンロードいただけます。</p>
            <p style="margin:24px 0;">
              <a href="${DOWNLOAD_URL}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:9999px;font-weight:bold;">サービス資料をダウンロード</a>
            </p>
            <p style="color:#666;font-size:12px;">${DOWNLOAD_URL}</p>
            <p>導入のご相談やデモのご希望は、<a href="https://branding.bz/contact">お問い合わせフォーム</a>からお気軽にご連絡ください。</p>
            <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
            <p style="color:#999;font-size:12px;">このメールは branding.bz の資料請求フォームから自動送信されています。</p>
          `,
        })
      } catch (emailError) {
        console.error('document request applicant email error:', emailError)
      }

      // (2) 社内通知
      if (notificationEmail) {
        try {
          await resend.emails.send({
            from: 'branding.bz <noreply@branding.bz>',
            to: notificationEmail,
            subject: `【branding.bz】資料請求: ${companyName}`,
            html: `
              <h2>資料請求がありました</h2>
              <table style="border-collapse:collapse;">
                <tr><td style="padding:8px;font-weight:bold;">会社名</td><td style="padding:8px;">${companyName}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">お名前</td><td style="padding:8px;">${contactName}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email.trim())}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">電話番号</td><td style="padding:8px;">${escapeHtml(phone?.trim() || '未入力')}</td></tr>
              </table>
              <hr />
              <p><a href="https://branding.bz/superadmin/inquiries">管理画面で確認する</a></p>
            `,
          })
        } catch (emailError) {
          console.error('document request notification email error:', emailError)
        }
      }
    }

    return NextResponse.json({ ok: true, downloadUrl: DOWNLOAD_PATH })
  } catch {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// XSS対策: HTMLエスケープ
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { company_name, contact_name, email, phone, message } = body

    // バリデーション
    if (!contact_name?.trim()) {
      return NextResponse.json({ error: '担当者名は必須です' }, { status: 400 })
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'お問い合わせ内容は必須です' }, { status: 400 })
    }

    // Supabase にINSERT（service role key でRLSをバイパス）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { error } = await supabase.from('contact_inquiries').insert({
      company_name: company_name?.trim() || null,
      contact_name: contact_name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      message: message.trim(),
    })

    if (error) {
      console.error('contact_inquiries insert error:', error)
      return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })
    }

    // メール通知（失敗してもフォーム送信は成功扱い）
    const resendApiKey = process.env.RESEND_API_KEY
    const notificationEmail = process.env.CONTACT_NOTIFICATION_EMAIL

    if (resendApiKey && notificationEmail) {
      const resend = new Resend(resendApiKey)
      try {
        await resend.emails.send({
          from: 'branding.bz <noreply@branding.bz>',
          to: notificationEmail,
          subject: `【branding.bz】新しいお問い合わせ: ${escapeHtml(contact_name.trim())}`,
          html: `
            <h2>新しいお問い合わせが届きました</h2>
            <table style="border-collapse:collapse;">
              <tr><td style="padding:8px;font-weight:bold;">会社名</td><td style="padding:8px;">${escapeHtml(company_name?.trim() || '未入力')}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">担当者名</td><td style="padding:8px;">${escapeHtml(contact_name.trim())}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">メール</td><td style="padding:8px;">${escapeHtml(email.trim())}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">電話番号</td><td style="padding:8px;">${escapeHtml(phone?.trim() || '未入力')}</td></tr>
            </table>
            <h3>お問い合わせ内容</h3>
            <p style="white-space:pre-wrap;">${escapeHtml(message.trim())}</p>
            <hr />
            <p><a href="https://branding.bz/superadmin/inquiries">管理画面で確認する</a></p>
          `,
        })
      } catch (emailError) {
        console.error('notification email error:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
  }
}

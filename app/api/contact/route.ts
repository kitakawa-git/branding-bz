import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
  }
}

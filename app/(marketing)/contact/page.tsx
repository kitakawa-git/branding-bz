'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    message: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.contact_name.trim()) e.contact_name = '担当者名は必須です'
    if (!form.email.trim()) e.email = 'メールアドレスは必須です'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '有効なメールアドレスを入力してください'
    if (!form.message.trim()) e.message = 'お問い合わせ内容は必須です'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('送信に失敗しました')
      setSubmitted(true)
    } catch {
      toast.error('送信に失敗しました。しばらく経ってから再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  // 送信完了
  if (submitted) {
    return (
      <section className="bg-white px-6 py-32 text-center">
        <div className="max-w-[480px] mx-auto">
          <div className="w-16 h-16 rounded-full bg-teal/10 text-teal flex items-center justify-center mx-auto mb-6 text-2xl">
            ✓
          </div>
          <h1 className="font-comfortaa text-2xl font-bold text-gray-900 mb-4">
            お問い合わせありがとうございます
          </h1>
          <p className="text-lp-gray mb-8 leading-relaxed">
            内容を確認のうえ、担当者より折り返しご連絡いたします。<br />
            通常2営業日以内にお返事いたします。
          </p>
          <Link
            href="/"
            className="inline-flex items-center h-12 px-8 text-sm font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity"
          >
            トップに戻る
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* ヒーロー */}
      <section className="bg-white px-6 pt-20 pb-8 text-center">
        <h1 className="font-comfortaa text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          お問い合わせ
        </h1>
        <p className="text-lp-gray max-w-[480px] mx-auto">
          ご質問・ご相談・お申し込みなど、お気軽にお問い合わせください。
        </p>
      </section>

      {/* フォーム */}
      <section className="bg-white px-6 pb-20">
        <form onSubmit={handleSubmit} className="max-w-[600px] mx-auto space-y-6">
          {/* 会社名 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              会社名
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="株式会社○○○"
              className="w-full px-4 py-3 bg-lp-gray-bg2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>

          {/* 担当者名 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              担当者名 <span className="text-lp-pink text-xs">*必須</span>
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => handleChange('contact_name', e.target.value)}
              placeholder="山田 太郎"
              className={`w-full px-4 py-3 bg-lp-gray-bg2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal ${
                errors.contact_name ? 'border-lp-pink' : 'border-gray-200'
              }`}
            />
            {errors.contact_name && <p className="mt-1 text-xs text-lp-pink">{errors.contact_name}</p>}
          </div>

          {/* メールアドレス */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              メールアドレス <span className="text-lp-pink text-xs">*必須</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="info@example.com"
              className={`w-full px-4 py-3 bg-lp-gray-bg2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal ${
                errors.email ? 'border-lp-pink' : 'border-gray-200'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-lp-pink">{errors.email}</p>}
          </div>

          {/* 電話番号 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              電話番号 <span className="text-xs text-lp-gray-light">（任意）</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="03-1234-5678"
              className="w-full px-4 py-3 bg-lp-gray-bg2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
            />
          </div>

          {/* お問い合わせ内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              お問い合わせ内容 <span className="text-lp-pink text-xs">*必須</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => handleChange('message', e.target.value)}
              rows={6}
              placeholder="ご質問・ご相談内容をお書きください"
              className={`w-full px-4 py-3 bg-lp-gray-bg2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none ${
                errors.message ? 'border-lp-pink' : 'border-gray-200'
              }`}
            />
            {errors.message && <p className="mt-1 text-xs text-lp-pink">{errors.message}</p>}
          </div>

          {/* 送信ボタン */}
          <div className="text-center pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center h-14 px-12 text-base font-bold text-white bg-gray-900 rounded-full hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? '送信中...' : '送信する'}
            </button>
          </div>

          <p className="text-center text-xs text-lp-gray-light">
            <Link href="/portal/terms" className="underline hover:text-lp-gray">利用規約</Link>
            {' & '}
            <Link href="/privacy-policy" className="underline hover:text-lp-gray">プライバシーポリシー</Link>
            {' '}に同意のうえ、送信してください。
          </p>
        </form>
      </section>
    </>
  )
}

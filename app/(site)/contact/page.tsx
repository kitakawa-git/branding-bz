'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export default function LpContactPage() {
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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = '有効なメールアドレスを入力してください'
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

  if (submitted) {
    return (
      <main className="px-6 pt-44 pb-32 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mb-4 text-2xl font-bold">お問い合わせありがとうございます</h1>
          <p className="mb-8 text-sm leading-relaxed text-white/55">
            内容を確認のうえ、担当者より折り返しご連絡いたします。
            <br />
            通常2営業日以内にお返事いたします。
          </p>
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
          >
            トップに戻る <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    )
  }

  const inputBase =
    'w-full rounded-xl border bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <main>
      <section className="relative px-6 pt-36 pb-12 text-center md:pt-44">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(55% 45% at 50% 0%, rgba(37,99,235,0.28) 0%, rgba(37,99,235,0) 70%)',
          }}
        />
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs font-semibold tracking-[0.25em] text-blue-400">Contact</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">お問い合わせ</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60">
            ご質問・ご相談・お申し込みなど、お気軽にお問い合わせください。
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">会社名</label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="株式会社○○○"
              className={`${inputBase} border-white/10`}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              担当者名 <span className="text-xs text-rose-400">*必須</span>
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => handleChange('contact_name', e.target.value)}
              placeholder="山田 太郎"
              className={`${inputBase} ${errors.contact_name ? 'border-rose-500' : 'border-white/10'}`}
            />
            {errors.contact_name && <p className="mt-1 text-xs text-rose-400">{errors.contact_name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              メールアドレス <span className="text-xs text-rose-400">*必須</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="info@example.com"
              className={`${inputBase} ${errors.email ? 'border-rose-500' : 'border-white/10'}`}
            />
            {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              電話番号 <span className="text-xs text-white/40">（任意）</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="03-1234-5678"
              className={`${inputBase} border-white/10`}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              お問い合わせ内容 <span className="text-xs text-rose-400">*必須</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => handleChange('message', e.target.value)}
              rows={6}
              placeholder="ご質問・ご相談内容をお書きください"
              className={`${inputBase} resize-none ${errors.message ? 'border-rose-500' : 'border-white/10'}`}
            />
            {errors.message && <p className="mt-1 text-xs text-rose-400">{errors.message}</p>}
          </div>

          <div className="pt-2 text-center">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-12 text-base font-semibold text-black transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? '送信中...' : '送信する'}
            </button>
          </div>

          <p className="text-center text-xs text-white/40">
            <Link href="/portal/terms" className="underline hover:text-white/70">
              利用規約
            </Link>
            {' & '}
            <Link href="/privacy-policy" className="underline hover:text-white/70">
              プライバシーポリシー
            </Link>{' '}
            に同意のうえ、送信してください。
          </p>
        </form>
      </section>
    </main>
  )
}

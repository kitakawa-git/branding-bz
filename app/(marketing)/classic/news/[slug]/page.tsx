// ニュース詳細ページ（公開・SSR）
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'

// カテゴリバッジの色分け
const CATEGORY_STYLES: Record<NewsCategory, string> = {
  press_release: 'bg-blue-50 text-blue-700 border-blue-200',
  service_update: 'bg-green-50 text-green-700 border-green-200',
  media: 'bg-purple-50 text-purple-700 border-purple-200',
  announcement: 'bg-gray-50 text-gray-700 border-gray-200',
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('news')
    .select('title, summary')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!data) {
    return { title: 'ニュースが見つかりません | branding.bz' }
  }

  return {
    title: `${data.title} | branding.bz`,
    description: data.summary || data.title,
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !data) {
    notFound()
  }

  const item = data as NewsItem

  return (
    <section className="bg-white px-6 py-16 md:py-24" style={{ paddingTop: 'calc(56px + 4rem)' }}>
      <div className="mx-auto max-w-3xl">
        {/* カテゴリバッジ + 日付 */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${CATEGORY_STYLES[item.category]}`}>
            {NEWS_CATEGORY_LABELS[item.category]}
          </span>
          <time className="text-sm text-gray-400 tabular-nums">
            {item.published_at
              ? new Date(item.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
              : '—'}
          </time>
        </div>

        {/* タイトル */}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 mb-8">
          {item.title}
        </h1>

        {/* 本文 */}
        {item.body && (
          <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-base">
            {item.body}
          </div>
        )}

        {/* 一覧へ戻るリンク */}
        <div className="mt-16 pt-8 border-t border-gray-100">
          <Link
            href="/news"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors no-underline"
          >
            ← ニュース一覧に戻る
          </Link>
        </div>
      </div>
    </section>
  )
}

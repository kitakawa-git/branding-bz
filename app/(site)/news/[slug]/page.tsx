// ニュース詳細（新デザイン / 公開・SSR）
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'

const CATEGORY_STYLES: Record<NewsCategory, string> = {
  press_release: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
  service_update: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  media: 'bg-purple-500/15 text-purple-300 border-purple-400/20',
  announcement: 'bg-white/10 text-white/70 border-white/15',
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
  if (!data) return { title: 'ニュースが見つかりません | branding.bz' }
  return { title: `${data.title} | branding.bz`, description: data.summary || data.title }
}

export default async function LpNewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()
  if (error || !data) notFound()
  const item = data as NewsItem

  return (
    <main className="px-6 pb-24 pt-36 md:pt-44">
      <article className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[item.category]}`}
          >
            {NEWS_CATEGORY_LABELS[item.category]}
          </span>
          <time className="text-sm tabular-nums text-white/40">
            {item.published_at
              ? new Date(item.published_at).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : '—'}
          </time>
        </div>

        <h1 className="mb-8 text-2xl font-bold tracking-tight md:text-3xl">{item.title}</h1>

        {item.body && (
          <div className="prose prose-invert prose-sm md:prose-base max-w-none text-white/70 [&_a]:text-white [&_a]:underline [&_a:hover]:text-white/80 [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_p]:my-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-white [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:text-white/60 [&_hr]:my-8 [&_hr]:border-white/10">
            <ReactMarkdown>{item.body}</ReactMarkdown>
          </div>
        )}

        <div className="mt-16 border-t border-white/10 pt-8">
          <Link href="/news" className="text-sm text-white/50 transition-colors hover:text-white">
            ← ニュース一覧に戻る
          </Link>
        </div>
      </article>
    </main>
  )
}

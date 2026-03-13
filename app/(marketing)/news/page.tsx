// ニュース一覧ページ（公開・SSR）
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'

export const metadata = {
  title: 'ニュース | branding.bz',
  description: 'branding.bz の最新ニュース・プレスリリース・サービスアップデート情報',
}

// カテゴリバッジの色分け
const CATEGORY_STYLES: Record<NewsCategory, string> = {
  press_release: 'bg-blue-50 text-blue-700 border-blue-200',
  service_update: 'bg-green-50 text-green-700 border-green-200',
  media: 'bg-purple-50 text-purple-700 border-purple-200',
  announcement: 'bg-gray-50 text-gray-700 border-gray-200',
}

export const dynamic = 'force-dynamic'

export default async function NewsListPage() {
  const supabase = getSupabaseAdmin()

  const { data: news } = await supabase
    .from('news')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  const items = (news || []) as NewsItem[]

  return (
    <>
      {/* ヒーロー */}
      <section className="px-6 pt-[120px] pb-16 md:pt-[120px] md:pb-24 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            News
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-snug md:leading-snug">
            ニュース
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            最新のお知らせ・アップデート情報
          </p>
        </div>
      </section>

      {/* ニュース一覧 */}
      <section className="bg-white px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl">

        {items.length === 0 ? (
          <p className="text-center text-gray-500 py-16">
            現在ニュースはありません
          </p>
        ) : (
          <div className="mx-auto max-w-4xl divide-y divide-gray-100">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.slug}`}
                className="block py-6 group no-underline hover:bg-gray-50/50 -mx-4 px-4 rounded-lg transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                  {/* 日付 */}
                  <time className="text-sm text-gray-400 shrink-0 tabular-nums">
                    {item.published_at
                      ? new Date(item.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                      : '—'}
                  </time>
                  {/* カテゴリバッジ */}
                  <span className={`inline-flex items-center self-start rounded-full px-2.5 py-0.5 text-xs font-medium border ${CATEGORY_STYLES[item.category]}`}>
                    {NEWS_CATEGORY_LABELS[item.category]}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h2>
                {item.summary && (
                  <p className="mt-1.5 text-sm text-gray-600 leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
    </>
  )
}

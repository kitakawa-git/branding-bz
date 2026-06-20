// ニュース一覧（新デザイン / 公開・SSR）
import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { NewsItem, NewsCategory } from '@/lib/types/news'
import { NEWS_CATEGORY_LABELS } from '@/lib/types/news'
import { PageHero } from '../_components/ui'

export const metadata = {
  title: 'ニュース | branding.bz',
  description: 'branding.bz の最新ニュース・プレスリリース・サービスアップデート情報',
}

const CATEGORY_STYLES: Record<NewsCategory, string> = {
  press_release: 'bg-blue-500/15 text-blue-300 border-blue-400/20',
  service_update: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  media: 'bg-purple-500/15 text-purple-300 border-purple-400/20',
  announcement: 'bg-white/10 text-white/70 border-white/15',
}

export const dynamic = 'force-dynamic'

export default async function LpNewsListPage() {
  const supabase = getSupabaseAdmin()
  const { data: news } = await supabase
    .from('news')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
  const items = (news || []) as NewsItem[]

  return (
    <main>
      <PageHero eyebrow="News" title="ニュース">
        最新のニュース・アップデート情報
      </PageHero>

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          {items.length === 0 ? (
            <p className="py-16 text-center text-white/45">現在ニュースはありません</p>
          ) : (
            <div className="divide-y divide-white/10">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/lp/news/${item.slug}`}
                  className="group -mx-4 block rounded-xl px-4 py-6 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <time className="shrink-0 text-sm tabular-nums text-white/40">
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '—'}
                    </time>
                    <span
                      className={`inline-flex items-center self-start rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLES[item.category]}`}
                    >
                      {NEWS_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white transition-colors group-hover:text-blue-300 md:text-lg">
                    {item.title}
                  </h2>
                  {item.summary && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/55">
                      {item.summary}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

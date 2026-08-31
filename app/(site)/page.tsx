'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Sparkles,
  MessageSquareHeart,
  Activity,
  LayoutDashboard,
  BarChart3,
  Check,
  Quote,
} from 'lucide-react'
import { GlowCard } from '@/components/lp/ui'
import { tools } from '@/components/lp/tools'
import ToolCard from '@/components/lp/ToolCard'
import FinalCta from '@/components/lp/FinalCta'

/* ───────────────────────────────────────────────
   branding.bz トップページ（Framer風 / ダークテーマ）
   - 構成は「ヒーロー → 3つの柱 → プロダクト → 導入 → 伴走 → 無料ツール → CTA」
   - 共通ナビ／フッターは layout.tsx が描画する（ここでは本文セクションのみ）。
   - 文章・ロゴは branding.bz オリジナル。プロダクトUIはCSSで再現したモック。
─────────────────────────────────────────────── */

/* ===== ヒーロー ===== */
function Hero() {
  return (
    <section className="relative px-6 pt-32 pb-24 md:pt-36">
      {/* 背景グラデーション */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%), radial-gradient(40% 40% at 85% 20%, rgba(168,85,247,0.22) 0%, transparent 70%), radial-gradient(40% 40% at 15% 25%, rgba(16,185,129,0.16) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(70% 60% at 50% 0%, black, transparent)',
        }}
      />

      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-7 text-sm text-white">
          “つくっただけ”では、終わらせない。
        </p>

        <h1 className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl md:text-7xl">
          <span className="block md:whitespace-nowrap">AIでブランディングを</span>
          <span className="block">加速させる。</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg text-white/60 md:text-xl">
          つくる・ひろげる・はかる・とどける。
          <br />
          ブランドの構築から浸透、計測、発信までを、
          <br />
          AIが伴走するひとつのプラットフォームで。
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-black transition-transform hover:scale-105"
          >
            無料で始める
          </Link>
          <a
            href="#features"
            onClick={(e) => {
              const target = document.getElementById('features')
              if (target) {
                e.preventDefault()
                target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.replaceState(null, '', '#features')
              }
            }}
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            AIではじめる
          </a>
        </div>
      </div>
    </section>
  )
}


/* ===== 制作事例ショーケース（Framerの「Made with」ギャラリー風） =====
   複数カラムが上下に自動スクロールするマソンリー。
   写真は Unsplash（images.unsplash.com）から取得し object-cover で配置。 */
const ux = (id: string, w = 640) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`

type ShowCard =
  | { kind: 'photo'; h: number; img: string; label?: string; title: string; mark?: string }
  | { kind: 'editorial'; h: number; img: string; big: string; sub: string }
  | { kind: 'art'; h: number; grad: string; title: string; sub: string }
  | { kind: 'ui'; h: number; title: string; sub: string }
  | { kind: 'type'; h: number; bg: string; fg: string; title: string; foot: string }

const showColumns: ShowCard[][] = [
  [
    { kind: 'art', h: 280, grad: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)', title: 'STP分析', sub: '構築ツール' },
    { kind: 'photo', h: 220, img: '/marketing/images/showcase/showcase-10.jpg', label: '製造業 / 化学・素材', title: '新規事業ブランディング', mark: 'TABIE' },
    { kind: 'type', h: 240, bg: '#f97316', fg: '#0a0a0a', title: '『誰に何を約束するか』が、STP分析とペルソナで一気にクリアに。社内の合意形成が驚くほど速くなりました。', foot: 'テックブリッジ' },
    { kind: 'photo', h: 200, img: '/marketing/images/showcase/showcase-04.jpg', label: 'コンサルティング / ブランド・マーケティング', title: '人事評価 / ブランド評価軸', mark: 'ID INC.' },
  ],
  [
    { kind: 'photo', h: 340, img: '/marketing/images/showcase/showcase-06.jpg', label: '金融・保険 / 保険', title: '新規事業ブランディング', mark: 'Solvvy' },
    { kind: 'photo', h: 232, img: '/marketing/images/showcase/showcase-20.jpg', label: 'コンサルティング / ブランド・マーケティング', title: '人事評価 / ブランド評価軸', mark: 'ID INC.' },
    { kind: 'photo', h: 210, img: '/marketing/images/showcase/showcase-08.jpg', label: 'その他 / 物流', title: 'ブランド研修', mark: '櫻井運輸' },
    { kind: 'art', h: 250, grad: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)', title: 'ブランドカラー定義', sub: '構築ツール' },
  ],
  [
    { kind: 'photo', h: 240, img: '/marketing/images/showcase/showcase-19.jpg', label: '医療・ヘルスケア / 医療機器', title: 'コーポレート・リブランディング', mark: 'ritz medical' },
    { kind: 'art', h: 290, grad: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)', title: 'パーソナリティ診断', sub: '構築ツール' },
    { kind: 'photo', h: 222, img: '/marketing/images/showcase/showcase-09.jpg', label: 'サービス業 / 教育', title: 'サービスブランディング', mark: 'クリエイト速読スクール' },
    { kind: 'photo', h: 256, img: '/marketing/images/showcase/showcase-14.jpg', label: 'IT・テクノロジー / Web制作・開発', title: '社内 / 採用ブランディング', mark: 'テックブリッジ' },
  ],
  [
    { kind: 'photo', h: 224, img: '/marketing/images/showcase/showcase-16.jpg', label: '製造業 / 化学・素材', title: '新規事業ブランディング', mark: 'TABIE' },
    { kind: 'photo', h: 320, img: '/marketing/images/showcase/showcase-05.jpg', label: '建設・不動産 / 不動産', title: 'クリエイション・ワークショップ', mark: 'CTD' },
    { kind: 'photo', h: 230, img: '/marketing/images/showcase/showcase-11.jpg', label: '小売・流通 / 家電・雑貨', title: '新店舗ブランディング', mark: 'ナチュラルキッチン' },
    { kind: 'type', h: 240, bg: '#facc15', fg: '#0a0a0a', title: 'ブランドの体現度をスコア機能で測っています。感覚ではなく数値で振り返れるので、次の一手が明確になりました。', foot: 'ritz medical' },
  ],
  [
    { kind: 'art', h: 250, grad: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)', title: 'ペルソナビルダー', sub: '構築ツール' },
    { kind: 'photo', h: 230, img: '/marketing/images/showcase/showcase-12.jpg', label: '医療・ヘルスケア / 医療機器', title: 'コーポレート・リブランディング', mark: 'ritz medical' },
    { kind: 'photo', h: 240, img: '/marketing/images/showcase/showcase-15.jpg', label: 'IT・テクノロジー / SaaS', title: 'サービスブランディング', mark: 'brandcommit' },
    { kind: 'photo', h: 214, img: '/marketing/images/showcase/showcase-17.jpg', label: '医療・ヘルスケア / 医療機器', title: 'コーポレート・リブランディング', mark: 'ritz medical' },
  ],
  [
    { kind: 'photo', h: 246, img: '/marketing/images/showcase/showcase-07.jpg', label: 'IT・テクノロジー / Web制作・開発', title: '社内 / 採用ブランディング', mark: 'テックブリッジ' },
    { kind: 'art', h: 268, grad: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 55%,#ec4899 100%)', title: 'コピーライティングAI', sub: '構築ツール' },
    { kind: 'photo', h: 226, img: '/marketing/images/showcase/showcase-03.jpg', label: '医療・ヘルスケア / 医療機器', title: 'コーポレート・リブランディング', mark: 'ritz medical' },
    { kind: 'photo', h: 218, img: '/marketing/images/showcase/showcase-13.jpg', label: 'サービス業 / 宿泊・観光', title: 'サービスブランディング', mark: '安心お宿' },
  ],
  [
    { kind: 'photo', h: 330, img: '/marketing/images/showcase/showcase-01.jpg', label: 'サービス業 / 飲食', title: '新店舗ブランディング', mark: 'すしなす' },
    { kind: 'type', h: 224, bg: '#16a34a', fg: '#06210f', title: '現場のスタッフまで“自社の価値”を自分の言葉で語れるようになった。研修後、社内の空気が変わったのを実感しています。', foot: '櫻井運輸' },
    { kind: 'photo', h: 236, img: '/marketing/images/showcase/showcase-18.jpg', label: 'その他 / 物流', title: '新規事業ブランディング', mark: '櫻井運輸' },
    { kind: 'photo', h: 242, img: '/marketing/images/showcase/showcase-02.jpg', label: '金融・保険 / 保険', title: '新規事業ブランディング', mark: 'Solvvy' },
  ],
]

function CardInner({ card }: { card: ShowCard }) {
  const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none'
  }
  if (card.kind === 'photo') {
    const mark = card.mark ?? card.title.split(' ')[0]
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#16161d]" style={{ height: card.h }}>
        <img src={card.img} alt="" loading="lazy" onError={hideOnError} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />
        {/* 左上にブランド名の頭文字のみ表示 */}
        <div className="absolute inset-x-3 top-3 flex items-center">
          <span className="text-xs font-bold tracking-tight text-white drop-shadow">{mark}</span>
        </div>
        {card.label && (
          <span className="absolute left-3 bottom-9 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur">
            {card.label}
          </span>
        )}
        <div className="absolute inset-x-3 bottom-3 text-sm font-semibold text-white drop-shadow">{card.title}</div>
      </div>
    )
  }
  if (card.kind === 'editorial') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#16161d]" style={{ height: card.h }}>
        <img src={card.img} alt="" loading="lazy" onError={hideOnError} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/30" />
        {/* 左上にカテゴリ表記のみ */}
        <div className="absolute inset-x-4 top-4 flex items-center">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-white/85">{card.sub}</span>
        </div>
        <div className="absolute bottom-3 left-4 text-5xl font-black tracking-tight text-white drop-shadow-lg">{card.big}</div>
      </div>
    )
  }
  if (card.kind === 'art') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ height: card.h, background: card.grad }}>
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute bottom-4 left-4">
          <div className="text-lg font-bold text-white">{card.title}</div>
          <div className="text-xs text-white/70">{card.sub}</div>
        </div>
      </div>
    )
  }
  if (card.kind === 'ui') {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101015] p-4" style={{ height: card.h }}>
        <div className="space-y-2">
          <div className="h-2 rounded bg-white/10" />
          <div className="h-2 w-2/3 rounded bg-white/10" />
          <div className="mt-3 flex h-12 items-end gap-1.5">
            {[40, 65, 50, 80, 60, 90, 72].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-500/40 to-blue-400" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-br from-blue-400 to-purple-400" />
            <span className="text-lg font-bold text-white">{card.title}</span>
          </div>
          <div className="mt-1 text-xs text-white/70">{card.sub}</div>
        </div>
      </div>
    )
  }
  // type
  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-4" style={{ height: card.h, background: card.bg, color: card.fg }}>
      <div className="text-xl font-black leading-tight">{card.title}</div>
      <div className="text-xs font-bold opacity-70">{card.foot}</div>
    </div>
  )
}

function Showcase() {
  // 7つの列パターンの並び順。読み込みごとにシャッフルする。
  // SSR / 初回レンダーは既定順（ハイドレーション不一致を避ける）→ マウント後にシャッフル。
  const [order, setOrder] = useState<number[]>(() => showColumns.map((_, i) => i))
  useEffect(() => {
    const a = showColumns.map((_, i) => i)
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    setOrder(a)
  }, [])

  return (
    <section className="relative overflow-hidden">
      <style>{`
        @keyframes lpScrollUp { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        @keyframes lpScrollDown { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .lp-col { animation: none !important; }
        }
      `}</style>

      {/* 全幅・高密度のマソンリー。画面端でカードが切れる（Framerの見え方） */}
      <div
        className="relative h-[78vh] min-h-[620px] overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 7%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 7%, black 88%, transparent)',
        }}
      >
        <div className="flex justify-center gap-3 px-3">
          {/* カード幅は固定。ワイド画面では列数を増やして全幅を埋める
              （5列ぶんのデータを循環して描画し、はみ出した分は端で見切れる） */}
          {Array.from({ length: 15 }, (_, i) => showColumns[order[i % order.length]]).map((col, i) => (
            <div
              key={i}
              className="lp-col flex w-[272px] shrink-0 flex-col gap-3"
              style={{
                animation: `${i % 2 === 0 ? 'lpScrollUp' : 'lpScrollDown'} ${34 + (i % showColumns.length) * 5}s linear infinite`,
              }}
            >
              {[...col, ...col].map((card, j) => (
                <CardInner key={j} card={card} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== 4つの柱（つくる・ひろげる・はかる・とどける） =====
   営業資料の構造に合わせた4区分。構築 → 浸透 → 計測 と進み、
   発信（とどける）はその全部を貫く横串という置き方。
   「浸透度をスコア化」は計測の話なので、ひろげる から はかる に移してある */
const pillars = [
  {
    tag: 'つくる',
    icon: Sparkles,
    title: 'ブランドの言語化を、\n対話型AIがサポート',
    body: '「らしさは分かっているけど、言葉にできない」。理念・カラー・ターゲット戦略・ペルソナを、AIと壁打ちしながら形にします。',
    accent: 'from-blue-500/30',
  },
  {
    tag: 'ひろげる',
    icon: Activity,
    title: 'ブランドの定着を、\nAIがサポート',
    body: '掲示・称賛・目標・学習・テスト。日々の業務のなかでブランドに触れ続ける状態をつくります。',
    accent: 'from-emerald-500/30',
  },
  {
    tag: 'はかる',
    icon: BarChart3,
    title: 'ブランドの浸透度を、\nスコアで可視化',
    body: '社内の理解・共感と、社外からの見え方を数字にします。次の打ち手を決める土台になります。',
    accent: 'from-cyan-500/30',
  },
  {
    tag: 'とどける',
    icon: MessageSquareHeart,
    title: 'ブランドの発信を、\nスマート名刺がサポート',
    body: 'QRコードから社員プロフィール＋企業ブランドページへ。社内で根づいた"らしさ"が、一人ひとりの名刺を通じて社外に届きます。',
    accent: 'from-purple-500/30',
  },
]

function Features() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            つくる、ひろげる、はかる、とどける。
          </h2>
          <p className="mt-5 text-lg text-white/60">
            ブランドの旅路をまるごと支える、はじめてのプラットフォーム。
          </p>
        </div>

        {/* 4枚。中間幅で2列に畳んでから4列にする（md で4列にすると1枚が狭すぎる） */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <GlowCard key={p.tag} className="p-7">
              <div className={`pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gradient-to-b ${p.accent} to-transparent blur-2xl`} />
              <div className="relative">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <p.icon size={20} className="text-white" />
                </div>
                <div className="mb-2 text-sm font-semibold text-blue-400">{p.tag}</div>
                <h3 className="whitespace-pre-line text-xl font-bold leading-snug">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{p.body}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-white">
                  詳しく見る <ArrowRight size={15} />
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== プロダクト訴求（ツールを切り替えずに） ===== */
function Product() {
  return (
    <section id="product" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            掲示・運用・計測まで、
            <br />
            ひとつの画面で完結。
          </h2>
          <p className="mt-5 text-lg text-white/60">
            社外、社内のブランド浸透度が、数字で見えるようになります。
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-5">
          {/* 大: ダッシュボード */}
          <GlowCard className="p-7 lg:col-span-3">
            <div className="mb-5 flex items-center gap-3">
              <LayoutDashboard size={18} className="text-blue-400" />
              <h3 className="text-lg font-bold">ダッシュボード</h3>
            </div>
            <p className="mb-6 max-w-md text-sm leading-relaxed text-white/55">
              投稿数・行動指針別の割合・KPI進捗を、期間フィルター付きで表示。チームの状態がひと目で分かります。
            </p>
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: '今月の投稿', v: '1,284' },
                  { k: '浸透スコア', v: '78' },
                  { k: 'KPI達成率', v: '92%' },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="text-[11px] text-white/40">{s.k}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight">{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {[35, 50, 42, 60, 55, 72, 68, 80, 75, 88, 82, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-500/30 to-blue-400/90" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </GlowCard>

          {/* 小: 効果計測 */}
          <GlowCard className="p-7 lg:col-span-2">
            <div className="mb-5 flex items-center gap-3">
              <BarChart3 size={18} className="text-emerald-400" />
              <h3 className="text-lg font-bold">効果計測</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-white/55">
              名刺の閲覧数・トレンド・ランキングを自動集計。誰の発信が、いつ、どれだけ届いたかを把握できます。
            </p>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0d0d11] p-5">
              {[
                { n: '営業部 田中', v: 320, w: '100%' },
                { n: '開発部 佐藤', v: 248, w: '78%' },
                { n: '広報部 鈴木', v: 196, w: '61%' },
              ].map((r) => (
                <div key={r.n}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-white/70">{r.n}</span>
                    <span className="text-white/40">{r.v} views</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400" style={{ width: r.w }} />
                  </div>
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </section>
  )
}

/* ===== 導入の声（役職ベースの匿名引用） ===== */
function Testimonial() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <GlowCard className="px-8 py-14 text-center md:px-16">
          <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
          <Quote size={32} className="mx-auto mb-6 text-blue-400" />
          <p className="relative text-balance text-2xl font-semibold leading-relaxed tracking-tight md:text-3xl">
            “作って終わり”だったブランドが、毎日の行動として動き出した。
            浸透度が数字で見えるから、次の一手に迷わなくなりました。
          </p>
          <div className="mt-8 text-sm text-white/50">
            製造業・人事責任者 / 従業員120名 ※導入企業の声をもとにしたイメージです
          </div>
        </GlowCard>
      </div>
    </section>
  )
}

/* ===== 伴走（プロのサポート） ===== */
function Experts() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              プロの伴走を、
              <br />
              必要なときに。
            </h2>
            <p className="mt-5 max-w-md text-lg text-white/60">
              ツールだけで終わらせない。15年以上ブランディングを手がけてきた ID INC. のプロが、
              戦略策定からデザイン制作まで伴走します。
            </p>
            <ul className="mt-8 space-y-3">
              {['ブランド戦略の壁打ち・設計', 'ビジュアル / バーバルアイデンティティの構築', '浸透施策の設計と定例支援'].map((t) => (
                <li key={t} className="flex items-center gap-3 text-white/80">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                    <Check size={14} className="text-blue-400" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              相談する <ArrowRight size={18} />
            </Link>
          </div>

          <GlowCard className="p-7">
            <div className="space-y-4">
              {[
                { t: 'キックオフ', d: '現状とゴールをヒアリング。AIが論点を整理します。' },
                { t: 'ブランド設計', d: '理念・カラー・ペルソナを共創ワークで言語化。' },
                { t: '浸透支援', d: '掲示・タイムライン・サーベイで定着を伴走。' },
              ].map((s, i) => (
                <div key={s.t} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{s.t}</div>
                    <p className="mt-1 text-sm text-white/55">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </section>
  )
}

/* ===== 無料ツール ===== */
function Tools() {
  return (
    <section id="tools" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">無料ツールで、すぐに始める。</h2>
          <p className="mt-5 text-lg text-white/60">
            登録前でも試せる。ブランディングの第一歩を、その場で。
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((t) => (
            <ToolCard key={t.href} tool={t} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== ページ本体（共通ナビ／フッターは layout.tsx 側） ===== */
export default function LpPage() {
  return (
    <main>
      <Hero />
      <Showcase />
      <Features />
      <Product />
      <Testimonial />
      <Experts />
      <Tools />
      <FinalCta />
    </main>
  )
}

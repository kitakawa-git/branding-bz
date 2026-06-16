'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Compass,
  MessageSquareHeart,
  Activity,
  LayoutDashboard,
  BarChart3,
  Target,
  UserCircle,
  Palette,
  Fingerprint,
  Check,
  Quote,
} from 'lucide-react'

/* ───────────────────────────────────────────────
   branding.bz トップページ（Framer風 / ダークテーマ）
   - 構成は「ヒーロー → 3つの柱 → プロダクト → 導入 → 伴走 → 無料ツール → CTA → フッター」
   - 文章・ロゴは branding.bz オリジナル。プロダクトUIはCSSで再現したモック。
─────────────────────────────────────────────── */

/* ===== 共通: グラデーション縁取りカード ===== */
function GlowCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(0,0,0,0.8)',
      }}
    >
      {children}
    </div>
  )
}

/* ===== ナビゲーション ===== */
function Nav() {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '/news', label: 'ニュース' },
    { href: '#tools', label: '無料ツール' },
    { href: '/plan', label: '料金・機能' },
    { href: '/faq', label: 'よくある質問' },
    { href: '/contact', label: 'お問い合わせ' },
  ]
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="relative flex h-16 w-full items-center justify-between border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl md:px-10">
        <Link href="/lp" className="shrink-0">
          <img
            src="/logo.svg"
            alt="branding.bz"
            style={{ height: '18px', width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/portal/auth"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            ログイン
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black transition-transform hover:scale-105"
          >
            無料で始める
          </Link>
        </div>

        <button
          className="p-1.5 text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="メニュー"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="mx-3 mt-2 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-xl md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}
          <div className="my-2 h-px bg-white/10" />
          <Link href="/portal/auth" className="block rounded-xl px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/10">
            ログイン
          </Link>
          <Link href="/signup" className="mt-1 block rounded-xl bg-white px-3 py-2.5 text-center text-base font-semibold text-black">
            無料で始める
          </Link>
        </div>
      )}
    </header>
  )
}

/* ===== ヒーロー ===== */
function Hero() {
  return (
    <section className="relative px-6 pt-28 pb-8 md:pt-32">
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
        <p className="mb-7 text-sm text-white/55">
          AIガイドで、約5〜10分でブランドの土台ができる
        </p>

        <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-6xl md:text-7xl">
          <span className="block md:whitespace-nowrap">AIでブランディングを</span>
          <span className="block">加速させる</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg text-white/60 md:text-xl">
          つくる・ひろげる・とどける。
          <br />
          ブランドの構築から浸透、発信までを、
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
          <Link
            href="#features"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            AIではじめる
          </Link>
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
  | { kind: 'photo'; h: number; img: string; label?: string; title: string }
  | { kind: 'editorial'; h: number; img: string; big: string; sub: string }
  | { kind: 'art'; h: number; grad: string; title: string; sub: string }
  | { kind: 'ui'; h: number; title: string; sub: string }
  | { kind: 'type'; h: number; bg: string; fg: string; title: string; foot: string }

const showColumns: ShowCard[][] = [
  [
    { kind: 'art', h: 280, grad: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)', title: 'Aoyama Studio', sub: 'ブランド設計' },
    { kind: 'photo', h: 220, img: ux('1551434678-e076c223a692'), label: '採用', title: 'MIDORI 採用ブランディング' },
    { kind: 'type', h: 240, bg: '#f97316', fg: '#0a0a0a', title: '大胆なビジョンを、確かなブランドへ。', foot: 'TADANO 物流' },
    { kind: 'photo', h: 200, img: ux('1497032628192-86f99bcd76bc'), label: 'IT', title: 'CODEX 開発チーム' },
  ],
  [
    { kind: 'editorial', h: 340, img: ux('1517841905240-472988babdf9'), big: 'KIYO', sub: 'EDITORIAL' },
    { kind: 'ui', h: 232, title: 'VOXA 音声AI', sub: '最速・高品質の音声プラットフォーム' },
    { kind: 'photo', h: 210, img: ux('1506744038136-46273834b3fb'), label: '観光', title: 'SETO 地域ブランド' },
    { kind: 'art', h: 250, grad: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)', title: 'AURA', sub: 'コスメブランド' },
  ],
  [
    { kind: 'photo', h: 240, img: ux('1517336714731-489689fd1ca8'), label: 'SaaS', title: 'ダッシュボードで浸透を可視化' },
    { kind: 'art', h: 290, grad: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)', title: 'PRISM', sub: 'デザインスタジオ' },
    { kind: 'type', h: 222, bg: '#2563eb', fg: '#ffffff', title: 'NOVEL READING RETREATS', foot: 'BOOKERS' },
    { kind: 'photo', h: 256, img: ux('1486312338219-ce68d2c6f44d'), label: 'プロダクト', title: 'LOOP 体験設計' },
  ],
  [
    { kind: 'ui', h: 224, title: 'INSIGHT 分析基盤', sub: 'ブランド体験のデータを可視化' },
    { kind: 'editorial', h: 320, img: ux('1488161628813-04466f872be2'), big: 'AOBA', sub: 'WORKS' },
    { kind: 'photo', h: 230, img: ux('1464822759023-fed622ff2c3b'), label: 'アウトドア', title: 'YAMA ギアブランド' },
    { kind: 'type', h: 210, bg: '#facc15', fg: '#0a0a0a', title: 'PAGE BREAK STUDIO', foot: 'EDITORIAL' },
  ],
  [
    { kind: 'art', h: 250, grad: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)', title: 'NEBULA', sub: 'XRスタジオ' },
    { kind: 'photo', h: 230, img: ux('1542744173-8e7e53415bb0'), label: 'コーポレート', title: 'KASUGA 事業ブランド' },
    { kind: 'ui', h: 240, title: 'SIGNAL 名刺解析', sub: '発信の効果をリアルタイム計測' },
    { kind: 'photo', h: 214, img: ux('1604079628040-94301bb21b91'), label: 'アート', title: 'HUE ギャラリー' },
  ],
]

function CardInner({ card }: { card: ShowCard }) {
  const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none'
  }
  if (card.kind === 'photo') {
    const mark = card.title.split(' ')[0]
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#16161d]" style={{ height: card.h }}>
        <img src={card.img} alt="" loading="lazy" onError={hideOnError} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />
        {/* サイトのナビ風ヘッダー（公開サイトに見せる） */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="text-xs font-bold tracking-tight text-white drop-shadow">{mark}</span>
          <span className="flex gap-2 text-[9px] font-medium text-white/70 drop-shadow">
            <span>Work</span>
            <span>About</span>
          </span>
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
        {/* サイトのナビ風ヘッダー */}
        <div className="absolute inset-x-4 top-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-white/85">{card.sub}</span>
          <span className="text-[9px] font-medium text-white/60">Menu</span>
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
        <div className="flex items-center gap-2 text-xs font-medium text-white/45">
          <span className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-400" />
          {card.title}
        </div>
        <div className="mt-3 text-base font-bold text-white">{card.sub}</div>
        <div className="mt-auto space-y-2">
          <div className="h-2 rounded bg-white/10" />
          <div className="h-2 w-2/3 rounded bg-white/10" />
          <div className="mt-3 flex h-12 items-end gap-1.5">
            {[40, 65, 50, 80, 60, 90, 72].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-500/40 to-blue-400" style={{ height: `${h}%` }} />
            ))}
          </div>
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
          maskImage: 'linear-gradient(to bottom, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 88%, transparent)',
        }}
      >
        <div className="flex justify-center gap-3 px-3">
          {showColumns.map((col, i) => (
            <div
              key={i}
              className="lp-col flex w-[clamp(200px,21vw,360px)] shrink-0 flex-col gap-3"
              style={{
                animation: `${i % 2 === 0 ? 'lpScrollUp' : 'lpScrollDown'} ${34 + i * 5}s linear infinite`,
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

/* ===== 3つの柱（つくる・ひろげる・とどける） ===== */
const pillars = [
  {
    tag: 'つくる',
    icon: Sparkles,
    title: 'ブランドの言語化を、対話型AIがサポート',
    body: '「らしさは分かっているけど、言葉にできない」。理念・カラー・ターゲット戦略・ペルソナを、AIと壁打ちしながら形にします。',
    accent: 'from-blue-500/30',
  },
  {
    tag: 'ひろげる',
    icon: Activity,
    title: 'ブランドの定着と可視化を、AIがサポート',
    body: '掲示・タイムライン・KPIに加え、社員サーベイで浸透度をスコア化。部署別ヒートマップで打ち手が数字で見えます。',
    accent: 'from-emerald-500/30',
  },
  {
    tag: 'とどける',
    icon: MessageSquareHeart,
    title: 'ブランドの発信を、スマート名刺がサポート',
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
            つくる、ひろげる、とどける。
          </h2>
          <p className="mt-5 text-lg text-white/60">
            ブランドの旅路をまるごと支える、はじめてのプラットフォーム。
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {pillars.map((p) => (
            <GlowCard key={p.tag} className="p-7">
              <div className={`pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-gradient-to-b ${p.accent} to-transparent blur-2xl`} />
              <div className="relative">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <p.icon size={20} className="text-white" />
                </div>
                <div className="mb-2 text-sm font-semibold text-blue-400">{p.tag}</div>
                <h3 className="text-xl font-bold leading-snug">{p.title}</h3>
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
            ツールを切り替えずに、ブランドを動かす。
          </h2>
          <p className="mt-5 text-lg text-white/60">
            掲示・運用・計測まで、ひとつの画面で完結。チームのブランド浸透が、数字で見えるようになります。
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
              名刺の閲覧数・トレンド・メンバー別ランキングを自動集計。誰の発信が、いつ、どれだけ届いたかを把握できます。
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
            「作って終わり」だったブランドが、毎日の行動として動き出した。
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
              {['ブランド戦略の壁打ち・設計', 'ビジュアル／バーバルIDの制作', '浸透施策の設計と定例支援'].map((t) => (
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
const tools = [
  { href: '/tools/stp', label: 'STP分析', icon: Target, d: 'セグメント・ターゲット・ポジションを整理' },
  { href: '/tools/persona', label: 'ペルソナビルダー', icon: UserCircle, d: '届けたい相手像をAIと具体化' },
  { href: '/tools/colors', label: 'ブランドカラー定義', icon: Palette, d: '"らしさ"を色で言語化' },
  { href: '/tools/personality', label: 'パーソナリティ診断', icon: Fingerprint, d: 'ブランドの人格を10問で診断' },
]

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
            <Link key={t.href} href={t.href}>
              <GlowCard className="group h-full p-6 transition-transform hover:-translate-y-1">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <t.icon size={20} className="text-blue-400" />
                </div>
                <h3 className="text-base font-bold">{t.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{t.d}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-white/60 group-hover:text-white">
                  試してみる <ArrowRight size={15} />
                </div>
              </GlowCard>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== 最終CTA ===== */
function FinalCta() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-white/10 px-8 py-20 text-center"
          style={{
            background:
              'radial-gradient(80% 120% at 50% 0%, rgba(37,99,235,0.4) 0%, rgba(8,8,10,0) 60%), #0d0d11',
          }}
        >
          <h2 className="text-balance text-4xl font-bold tracking-tight md:text-6xl">
            さぁ、&ldquo;らしさ&rdquo;をひろげよう。
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
            ブランドは、作った瞬間から走り出す。branding.bz で、その加速を始めませんか。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-black transition-transform hover:scale-105"
            >
              無料で始める <ArrowRight size={18} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-full border border-white/15 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              お問い合わせ
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ===== フッター ===== */
function FooterLp() {
  const cols = [
    { h: '機能', items: ['ブランド掲示', 'タイムライン', 'KPI・目標', 'ブランドスコア', 'スマート名刺'] },
    { h: '無料ツール', items: ['STP分析', 'ペルソナビルダー', 'ブランドカラー定義', 'パーソナリティ診断'] },
    { h: '会社情報', items: ['ID INC. について', 'ニュース', 'お問い合わせ', '採用'] },
    { h: '規約', items: ['利用規約', 'プライバシーポリシー', '特定商取引法'] },
  ]
  return (
    <footer className="border-t border-white/10 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <img
              src="/logo.svg"
              alt="branding.bz"
              style={{ height: '20px', width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              AIで、ブランディングを加速させる。構築・浸透・発信をひとつのプラットフォームで。
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div className="mb-4 text-sm font-semibold text-white/80">{c.h}</div>
              <ul className="space-y-2.5">
                {c.items.map((it) => (
                  <li key={it}>
                    <span className="cursor-pointer text-sm text-white/45 transition-colors hover:text-white/80">
                      {it}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} ID INC. All rights reserved.</span>
          <span>branding.bz</span>
        </div>
      </div>
    </footer>
  )
}

/* ===== ページ本体 ===== */
export default function LpPage() {
  return (
    <main className="min-h-screen bg-[#08080a] text-white">
      <Nav />
      <Hero />
      <Showcase />
      <Features />
      <Product />
      <Testimonial />
      <Experts />
      <Tools />
      <FinalCta />
      <FooterLp />
    </main>
  )
}

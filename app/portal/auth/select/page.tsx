'use client'

// サービス選択ページ
// ログイン後にツールLP経由（from パラメータあり）で到達した場合に表示
// from に対応するカードを強調表示する
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Palette, BarChart3, UserCircle, Fingerprint, Building2 } from 'lucide-react'

interface ServiceCard {
  id: string
  Icon: typeof BarChart3
  title: string
  description: string
  href: string
  buttonLabel: string
  highlightButtonLabel: string // from と一致する場合のボタンラベル
}

const SERVICES: ServiceCard[] = [
  {
    id: 'stp',
    Icon: BarChart3,
    title: 'STP分析ツール',
    description: 'AIがセグメンテーション・ターゲティング・ポジショニングまでを一貫支援',
    href: '/tools/stp/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'persona',
    Icon: UserCircle,
    title: 'ペルソナビルダー',
    description: 'AIがターゲット顧客の人物像とカスタマージャーニーまでを自動で生成',
    href: '/tools/persona/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'colors',
    Icon: Palette,
    title: 'ブランドカラー定義ツール',
    description: 'AIがブランドに最適なカラーパレットを3案まとめてご提案します',
    href: '/tools/colors/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'personality',
    Icon: Fingerprint,
    title: 'ブランドパーソナリティ診断',
    description: '10問の質問からAIがブランドの人格をスコアとタイプの両面で診断',
    href: '/tools/personality/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'platform',
    Icon: Building2,
    title: 'ブランド管理プラットフォーム',
    description: 'ブランドの掲示・スマート名刺・浸透KPIまでを一つの画面で一元管理',
    href: '/portal',
    buttonLabel: '詳しく見る',
    highlightButtonLabel: 'ダッシュボードへ',
  },
]

// 各ツールのカード背景（トップページの無料ツールカードと同配色）。platform はダーク。
const CARD_BG: Record<string, string> = {
  stp: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 55%,#0ea5e9 100%)',
  persona: 'linear-gradient(160deg,#0f172a,#312e81 60%,#a855f7)',
  colors: 'conic-gradient(from 200deg at 60% 40%,#f43f5e,#8b5cf6,#22d3ee,#f43f5e)',
  personality: 'radial-gradient(120% 120% at 25% 20%,#10b981 0%,#0f172a 65%)',
  platform: 'linear-gradient(135deg, #16181f 0%, #0a0b10 100%)',
}

export default function ServiceSelectPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] font-sans">
        <p className="text-sm text-white/40">読み込み中...</p>
      </div>
    }>
      <ServiceSelectContent />
    </Suspense>
  )
}

function ServiceSelectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [hasPortalAccess, setHasPortalAccess] = useState(false)
  // ホバー中のカードを実効アクティブにする（ホバー中はそれを優先、無ければ from）
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const activeId = hoveredId ?? from
  // マジックムーブ用：単一のハイライト枠をアクティブカードの位置へスライドさせる
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [hl, setHl] = useState<{ top: number; height: number; ready: boolean }>({ top: 0, height: 0, ready: false })

  // 認証チェック + ポータルアクセス権チェック
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // 未認証 → ログインページに戻す
        const authUrl = from ? `/portal/auth?from=${from}` : '/portal/auth'
        router.replace(authUrl)
        return
      }

      // admin_users テーブルでポータルアクセス権をチェック
      try {
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle()
        setHasPortalAccess(!!adminData)
      } catch {
        setHasPortalAccess(false)
      }

      setCheckingAuth(false)
    }
    check()
  }, [from, router])

  // アクティブカードの位置を測ってハイライト枠を移動（リサイズ時も再計測）
  useLayoutEffect(() => {
    const measure = () => {
      const el = activeId ? cardRefs.current[activeId] : null
      if (el && listRef.current) {
        setHl({ top: el.offsetTop, height: el.offsetHeight, ready: true })
      } else {
        setHl((h) => ({ ...h, ready: false }))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeId, checkingAuth])

  const handleCardClick = (service: ServiceCard) => {
    // プラットフォームカードの場合、アクセス権に応じて遷移先を変える
    if (service.id === 'platform') {
      if (hasPortalAccess) {
        router.push('/portal')
      } else {
        // 未契約 → トップページやプラン紹介へ
        router.push('/')
      }
      return
    }
    router.push(service.href)
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] font-sans">
        <p className="text-sm text-white/40">読み込み中...</p>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-5 py-16 font-sans text-white"
    >
      <div className="relative z-10 mb-10 text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">
          branding.bz へようこそ
        </h1>
        <p className="m-0 text-sm text-gray-500">
          利用したいサービスを選んでください
        </p>
      </div>

      <div ref={listRef} onMouseLeave={() => setHoveredId(null)} className="relative z-10 w-full max-w-[480px] space-y-4">
        {/* マジックムーブのハイライト枠：カーソル先のカードへスライド移動する（カラフルカードでも視認できる白リング） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 z-20 rounded-[20px] border-2 border-blue-400 transition-all duration-300 ease-out"
          style={{
            top: hl.top,
            height: hl.height,
            opacity: hl.ready ? 1 : 0,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 0 1px rgba(255,255,255,0.25), 0 0 26px -2px rgba(59,130,246,0.9)',
          }}
        />
        {SERVICES.map((service) => {
          const isActive = service.id === activeId
          return (
            <button
              key={service.id}
              ref={(el) => { cardRefs.current[service.id] = el }}
              onClick={() => handleCardClick(service)}
              onMouseEnter={() => setHoveredId(service.id)}
              className="group relative w-full overflow-hidden rounded-[20px] border border-white/15 text-left"
              style={{
                background: 'linear-gradient(135deg, rgba(20,22,32,0.92) 0%, rgba(8,9,14,0.96) 100%)',
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.3), 0 18px 44px -20px rgba(0,0,0,0.5)',
              }}
            >
              {/* アクティブ時だけツール配色が点灯（クロスフェード） */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[20px] transition-opacity duration-300"
                style={{ background: CARD_BG[service.id], opacity: isActive ? 1 : 0 }}
              />
              {/* スペキュラ（液体ガラスの艶） */}
              <div className="pointer-events-none absolute inset-0 rounded-[20px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />
              <div className="relative z-10 flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-md" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.35)' }}>
                  {service.id === 'platform' ? (
                    /* branding.bz ロゴマーク（public/logo.svg のマーク部分を実寸で抽出） */
                    <svg viewBox="0 25.791 112 69.2093" width={24} height={24} fill="currentColor" aria-hidden className="text-white">
                      <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z" />
                      <path d="M69.2093 25.791L0 25.791L0 95.0003L69.2093 25.791Z" />
                    </svg>
                  ) : (
                    <service.Icon size={24} strokeWidth={1.5} className="text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-0.5 text-sm font-bold text-white">
                    {service.title}
                  </h3>
                  <p className="m-0 text-xs leading-relaxed text-white/80">
                    {service.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors duration-300 ${
                    isActive ? 'bg-white text-black' : 'bg-white/20 text-white'
                  }`}>
                    {isActive ? service.highlightButtonLabel : service.buttonLabel}
                    <span className="ml-1">→</span>
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <p className="relative z-10 mt-8 text-xs text-gray-400">
        今後もツールが追加されます
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut()
          router.replace('/portal/auth')
        }}
        className="relative z-10 mt-4 text-xs text-gray-400 underline transition-colors hover:text-gray-600"
      >
        ログアウト
      </button>
    </div>
  )
}

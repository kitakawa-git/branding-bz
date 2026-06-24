'use client'

// サービス選択ページ
// ログイン後にツールLP経由（from パラメータあり）で到達した場合に表示
// from に対応するカードを強調表示する
import { Suspense, useEffect, useState } from 'react'
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
    description: 'AIがセグメンテーション・ターゲティング・ポジショニングを支援',
    href: '/tools/stp/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'persona',
    Icon: UserCircle,
    title: 'ペルソナビルダー',
    description: 'AIがターゲット顧客の人物像とカスタマージャーニーを生成',
    href: '/tools/persona/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'colors',
    Icon: Palette,
    title: 'ブランドカラー定義ツール',
    description: 'AIがブランドに最適なカラーパレットを3案提案します',
    href: '/tools/colors/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'personality',
    Icon: Fingerprint,
    title: 'ブランドパーソナリティ診断',
    description: '10問の質問からAIがブランドの人格をスコア・タイプで診断',
    href: '/tools/personality/app',
    buttonLabel: '始める',
    highlightButtonLabel: '続ける',
  },
  {
    id: 'platform',
    Icon: Building2,
    title: 'ブランド管理プラットフォーム',
    description: 'ブランド掲示・名刺・KPI管理を一元管理',
    href: '/portal',
    buttonLabel: '詳しく見る',
    highlightButtonLabel: 'ダッシュボードへ',
  },
]

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
      className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#08080a] px-5 py-16 font-sans text-white"
      style={{
        background: [
          'radial-gradient(ellipse 120% 90% at 12% 8%, rgba(49, 46, 129, 0.5) 0%, transparent 55%)',
          'radial-gradient(ellipse 110% 90% at 88% 12%, rgba(168, 85, 247, 0.25) 0%, transparent 55%)',
          'radial-gradient(ellipse 120% 100% at 50% 110%, rgba(37, 99, 235, 0.28) 0%, transparent 60%)',
          '#08080a',
        ].join(', '),
      }}
    >
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">
          branding.bz へようこそ
        </h1>
        <p className="m-0 text-sm text-white/55">
          利用したいサービスを選んでください
        </p>
      </div>

      <div className="relative z-10 w-full max-w-[480px] space-y-4">
        {SERVICES.map((service) => {
          const isHighlighted = service.id === from
          return (
            <button
              key={service.id}
              onClick={() => handleCardClick(service)}
              className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-transform hover:scale-[1.02] ${
                isHighlighted
                  ? 'border-blue-400/40 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
              }`}
              style={{
                boxShadow: isHighlighted
                  ? 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 60px -20px rgba(37,99,235,0.5)'
                  : 'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 24px 60px -24px rgba(0,0,0,0.8)',
              }}
            >
              <div className="relative z-10 flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${
                  isHighlighted ? 'border-blue-400/30 bg-blue-500/15' : 'border-white/10 bg-white/5'
                }`}>
                  {service.id === 'platform' ? (
                    /* branding.bz ロゴマーク（public/logo.svg のマーク部分を実寸で抽出） */
                    <svg viewBox="0 25.791 112 69.2093" width={24} height={24} fill="currentColor" aria-hidden className={isHighlighted ? 'text-blue-400' : 'text-white/80'}>
                      <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z" />
                      <path d="M69.2093 25.791L0 25.791L0 95.0003L69.2093 25.791Z" />
                    </svg>
                  ) : (
                    <service.Icon size={24} strokeWidth={1.5} className={isHighlighted ? 'text-blue-400' : 'text-white/80'} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-0.5 text-sm font-bold text-white">
                    {service.title}
                  </h3>
                  <p className="m-0 text-xs leading-relaxed text-white/55">
                    {service.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                    isHighlighted
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white/70 group-hover:bg-white/15'
                  }`}>
                    {isHighlighted ? service.highlightButtonLabel : service.buttonLabel}
                    <span className="ml-1">→</span>
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <p className="relative z-10 mt-8 text-xs text-white/40">
        今後もツールが追加されます
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut()
          router.replace('/portal/auth')
        }}
        className="relative z-10 mt-4 text-xs text-white/40 underline transition-colors hover:text-white/70"
      >
        ログアウト
      </button>
    </div>
  )
}

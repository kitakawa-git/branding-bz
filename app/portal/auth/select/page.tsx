'use client'

// サービス選択ページ
// ログイン後にツールLP経由（from パラメータあり）で到達した場合に表示
// from に対応するカードを強調表示する
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Palette, BarChart3, UserCircle, Building2 } from 'lucide-react'

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
      <div className="flex min-h-screen items-center justify-center font-sans">
        <p className="text-sm text-gray-500">読み込み中...</p>
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
      <div className="flex min-h-screen items-center justify-center font-sans">
        <p className="text-sm text-gray-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-5 py-16 font-sans"
      style={{
        background: [
          'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.8) 0%, transparent 55%)',
          'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',
          'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.65) 0%, transparent 55%)',
          'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.6) 0%, transparent 55%)',
          'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
        ].join(', '),
      }}
    >
      <div className="mb-10 text-center">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          branding.bz へようこそ！
        </h1>
        <p className="m-0 text-sm text-gray-500">
          利用したいサービスを選んでください
        </p>
      </div>

      <div className="w-full max-w-[480px] space-y-4">
        {SERVICES.map((service) => {
          const isHighlighted = service.id === from
          return (
            <button
              key={service.id}
              onClick={() => handleCardClick(service)}
              className={`
                relative w-full rounded-2xl overflow-hidden text-left transition-all
                hover:scale-[1.02] hover:shadow-2xl
              `}
              style={{
                background: isHighlighted ? 'rgba(239, 246, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px) saturate(120%)',
                WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                border: isHighlighted ? '1px solid rgba(191, 219, 254, 0.8)' : '1px solid rgba(255, 255, 255, 0.8)',
                borderLeft: isHighlighted ? '3px solid rgba(59, 130, 246, 0.7)' : '1px solid rgba(255, 255, 255, 0.8)',
                boxShadow: isHighlighted
                  ? '0px 8px 24px 0 rgba(59, 130, 246, 0.1), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)'
                  : '0px 8px 24px 0 rgba(12, 74, 110, 0.08), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
              }}
            >
              {/* リフレクション */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />

              <div className="relative z-10 flex items-center gap-4 p-5">
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12">
                  <service.Icon size={28} strokeWidth={1.5} className={isHighlighted ? 'text-blue-600' : 'text-gray-900'} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 mb-0.5">
                    {service.title}
                  </h3>
                  <p className="text-xs text-gray-600 m-0 leading-relaxed">
                    {service.description}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`
                    inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold transition-colors
                    ${isHighlighted
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    }
                  `}>
                    {isHighlighted ? service.highlightButtonLabel : service.buttonLabel}
                    <span className="ml-1">→</span>
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <p className="mt-8 text-xs text-gray-400">
        今後もツールが追加されます
      </p>
    </div>
  )
}

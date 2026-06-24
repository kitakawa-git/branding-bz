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
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-5 py-16 font-sans text-white"
    >
      {/* 背景：ポータルのダッシュボードを「ブランク状態」で再現したモックをぼかして霞ませる（実データなし・操作不可の装飾） */}
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 origin-center scale-[1.12] opacity-95 blur-[13px]">
          <div className="flex h-full w-full bg-gray-50">
            {/* サイドバー */}
            <div className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4 md:flex">
              <div className="mb-7 flex items-center gap-2 px-2">
                <div className="h-7 w-7 rounded-lg bg-gray-900" />
                <div className="h-4 w-24 rounded bg-gray-300" />
              </div>
              <div className="space-y-2">
                <div className="h-9 rounded-lg bg-blue-100" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-gray-100" />
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 rounded-xl bg-gray-100 p-2.5">
                <div className="h-8 w-8 rounded-full bg-gray-300" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-16 rounded bg-gray-300" />
                  <div className="h-2 w-24 rounded bg-gray-200" />
                </div>
              </div>
            </div>
            {/* メイン */}
            <div className="flex-1 overflow-hidden p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-44 rounded bg-gray-300" />
                  <div className="h-3 w-28 rounded bg-gray-200" />
                </div>
                <div className="h-9 w-9 rounded-full bg-gray-200" />
              </div>
              <div className="mb-6 h-20 rounded-2xl bg-gradient-to-r from-blue-100 to-indigo-100" />
              <div className="mb-6 grid grid-cols-3 gap-5">
                {[['#3b82f6'], ['#10b981'], ['#a855f7']].map(([c], i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 h-4 w-20 rounded bg-gray-200" />
                    <div className="flex h-24 items-end gap-1.5">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <div key={j} className="flex-1 rounded-t" style={{ height: `${30 + ((i * 7 + j) % 6) * 12}%`, background: c, opacity: 0.85 }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div className="col-span-2 h-60 rounded-2xl border border-gray-200 bg-white" />
                <div className="h-60 rounded-2xl border border-gray-200 bg-white" />
              </div>
            </div>
          </div>
        </div>
        {/* 白のすりガラス＋周辺フェード */}
        <div className="absolute inset-0 bg-white/55 backdrop-blur-xl" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(125% 95% at 50% 30%, transparent 0%, rgba(255,255,255,0.3) 60%, rgba(255,255,255,0.8) 100%)' }} />
      </div>

      <div className="relative z-10 mb-10 text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">
          branding.bz へようこそ
        </h1>
        <p className="m-0 text-sm text-gray-500">
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
                  ? 'border-blue-400/40 bg-[#0d1326]'
                  : 'border-white/10 bg-[#0c0c11] hover:border-white/20'
              }`}
              style={{
                boxShadow: isHighlighted
                  ? 'inset 0 1px 0 0 rgba(255,255,255,0.06), 0 18px 40px -16px rgba(37,99,235,0.45)'
                  : 'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 18px 40px -20px rgba(0,0,0,0.45)',
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

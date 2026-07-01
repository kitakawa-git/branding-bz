'use client'

// サービス選択ページ
// ログイン後にツールLP経由（from パラメータあり）で到達した場合に表示
// from に対応するカードを強調表示する
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Palette, BarChart3, UserCircle, Fingerprint, Building2, ChevronDown, Plus, Clock, CheckCircle2, Trash2, Loader2 } from 'lucide-react'

interface SessionSummary {
  id: string
  status: string
  current_step: number
  company_name: string
  updated_at: string
}

// 構築ツール（セッション履歴あり）の設定。appType=共通一覧APIの種別、createApi=新規作成POST先。
// 各ツールのセッション/編集URLは ServiceCard.href（例 /tools/stp/app）配下に /{sessionId}。
const SESSION_TOOLS: Record<string, { appType: string; createApi: string }> = {
  stp: { appType: 'stp', createApi: '/api/tools/stp/sessions' },
  persona: { appType: 'persona', createApi: '/api/tools/persona/sessions' },
  colors: { appType: 'brand_colors', createApi: '/api/tools/colors/sessions' },
  personality: { appType: 'personality', createApi: '/api/tools/personality/sessions' },
}

function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

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
  const [userId, setUserId] = useState<string | null>(null)
  // 構築ツール: カード内アコーディオンでセッション履歴を表示（同時に1つだけ展開）
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // ホバー中のカードを実効アクティブにする（ホバー中はそれを優先、無ければ展開中ツール→from）
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const activeId = hoveredId ?? expandedTool ?? from
  // マジックムーブ用：単一のハイライト枠をアクティブカードの位置へスライドさせる
  const listRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
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
      setUserId(user.id)

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
    // アコーディオン開閉のアニメーション中もハイライト枠を追従させる
    const ro = new ResizeObserver(() => measure())
    if (listRef.current) ro.observe(listRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
  }, [activeId, checkingAuth, expandedTool, sessions.length, sessionsLoading])

  // 指定ツールのセッション一覧を取得（展開時）
  const fetchSessions = useCallback(async (toolId: string) => {
    const cfg = SESSION_TOOLS[toolId]
    if (!userId || !cfg) return
    setSessionsLoading(true)
    setSessions([])
    try {
      const res = await fetch(`/api/tools/mini-app-sessions?userId=${userId}&appType=${cfg.appType}`)
      if (res.ok) {
        const { sessions } = await res.json()
        setSessions(sessions || [])
      }
    } catch {
      // 取得失敗時は空のまま
    } finally {
      setSessionsLoading(false)
    }
  }, [userId])

  // ツールのアコーディオン開閉（同時に1つだけ展開）
  const toggleTool = useCallback((toolId: string) => {
    setConfirmDeleteId(null)
    setExpandedTool((prev) => {
      if (prev === toolId) return null
      fetchSessions(toolId)
      return toolId
    })
  }, [fetchSessions])

  // 新規セッション作成（forceNew）→ そのツールの編集画面へ
  const createSession = useCallback(async (service: ServiceCard) => {
    const cfg = SESSION_TOOLS[service.id]
    if (!userId || !cfg || creating) return
    setCreating(true)
    try {
      const res = await fetch(cfg.createApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, forceNew: true }),
      })
      const data = await res.json()
      if (res.ok && data.sessionId) {
        router.push(`${service.href}/${data.sessionId}`)
      } else {
        setCreating(false)
      }
    } catch {
      setCreating(false)
    }
  }, [userId, creating, router])

  const deleteSession = useCallback(async (id: string) => {
    if (!userId || deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tools/mini-app-sessions/${id}?userId=${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id))
        setConfirmDeleteId(null)
      }
    } catch {
      // 失敗時は何もしない
    } finally {
      setDeletingId(null)
    }
  }, [userId, deletingId])

  const handleCardClick = (service: ServiceCard) => {
    // 構築ツール: 遷移せずカード内アコーディオンで履歴を開閉
    if (SESSION_TOOLS[service.id]) {
      toggleTool(service.id)
      return
    }
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
          className="pointer-events-none absolute left-0 right-0 z-20 rounded-[20px] border-2 border-blue-400 transition-[top,opacity] duration-300 ease-out"
          style={{
            top: hl.top,
            height: hl.height,
            opacity: hl.ready ? 1 : 0,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.55), 0 0 0 1px rgba(255,255,255,0.25), 0 0 26px -2px rgba(59,130,246,0.9)',
          }}
        />
        {SERVICES.map((service) => {
          const isSessionTool = !!SESSION_TOOLS[service.id]
          const isExpanded = expandedTool === service.id
          const isActive = service.id === activeId
          // カード共通の背景レイヤー（配色点灯・スペキュラ・上辺ライン）
          const layers = (
            <>
              <div
                className="pointer-events-none absolute inset-0 rounded-[20px] transition-opacity duration-300"
                style={{ background: CARD_BG[service.id], opacity: isActive ? 1 : 0 }}
              />
              <div className="pointer-events-none absolute inset-0 rounded-[20px]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />
            </>
          )
          // ヘッダー行（アイコン＋タイトル＋アクションボタン）
          const header = (
            <div className="relative z-10 flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-md" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.35)' }}>
                {service.id === 'platform' ? (
                  <svg viewBox="0 25.791 112 69.2093" width={24} height={24} fill="currentColor" aria-hidden className="text-white">
                    <path d="M69.2093 95L112 95L112 52.2093L69.2093 95Z" />
                    <path d="M69.2093 25.791L0 25.791L0 95.0003L69.2093 25.791Z" />
                  </svg>
                ) : (
                  <service.Icon size={24} strokeWidth={1.5} className="text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-0.5 text-sm font-bold text-white">{service.title}</h3>
                <p className="m-0 text-xs leading-relaxed text-white/80">{service.description}</p>
              </div>
              <div className="flex-shrink-0">
                <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold transition-colors duration-300 ${
                  isActive ? 'bg-white text-black' : 'bg-white/20 text-white'
                }`}>
                  {isActive ? service.highlightButtonLabel : service.buttonLabel}
                  {isSessionTool ? (
                    <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  ) : (
                    <span className="ml-1">→</span>
                  )}
                </span>
              </div>
            </div>
          )
          const cardStyle = {
            background: 'linear-gradient(135deg, rgba(20,22,32,0.92) 0%, rgba(8,9,14,0.96) 100%)',
            backdropFilter: 'blur(22px) saturate(180%)',
            WebkitBackdropFilter: 'blur(22px) saturate(180%)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.3), 0 18px 44px -20px rgba(0,0,0,0.5)',
          } as const

          if (isSessionTool) {
            // 構築ツール: クリックでカード内アコーディオンを開閉（ネストボタン回避のため div + ヘッダーボタン）
            return (
              <div
                key={service.id}
                ref={(el) => { cardRefs.current[service.id] = el }}
                onMouseEnter={() => setHoveredId(service.id)}
                className="group relative w-full overflow-hidden rounded-[20px] border border-white/15 text-left"
                style={cardStyle}
              >
                {layers}
                <button type="button" onClick={() => toggleTool(service.id)} className="relative block w-full text-left">
                  {header}
                </button>
                <div className={`relative z-10 grid transition-[grid-template-rows] duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <div className="border-t border-white/15 px-3 pb-3 pt-2">
                    {sessionsLoading ? (
                      <p className="px-2 py-3 text-xs text-white/70">読み込み中…</p>
                    ) : (
                      <>
                        {sessions.length === 0 && (
                          <p className="px-2 py-2 text-xs text-white/70">まだ履歴がありません。</p>
                        )}
                        {sessions.map((s) => {
                          const done = s.status === 'completed'
                          const confirming = confirmDeleteId === s.id
                          return (
                            <div
                              key={s.id}
                              className="flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-white/10"
                            >
                              <button
                                type="button"
                                onClick={() => router.push(`${service.href}/${s.id}`)}
                                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-xs font-bold text-white">{s.company_name || '（無題）'}</span>
                                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                      done ? 'bg-emerald-400/25 text-emerald-100' : 'bg-amber-400/25 text-amber-100'
                                    }`}>
                                      {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                      {done ? '完了' : '作成中'}
                                    </span>
                                  </div>
                                  <div className="mt-0.5 truncate text-[11px] text-white/60">
                                    {done ? '' : `Step ${s.current_step}・`}更新 {formatSessionDate(s.updated_at)}
                                  </div>
                                </div>
                                <span className="shrink-0 text-white/40">→</span>
                              </button>
                              {confirming ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => deleteSession(s.id)}
                                    disabled={deletingId === s.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-red-500/80 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                                  >
                                    {deletingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '削除'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-md px-2 py-1 text-[10px] text-white/70 transition-colors hover:bg-white/10"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(s.id)}
                                  aria-label="この履歴を削除"
                                  className="shrink-0 rounded-md p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-red-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => createSession(service)}
                          disabled={creating}
                          className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/25 px-3 py-2.5 text-left text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
                        >
                          <Plus className="h-4 w-4" />
                          {creating ? '作成中…' : '新しく始める'}
                        </button>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <button
              key={service.id}
              ref={(el) => { cardRefs.current[service.id] = el }}
              onClick={() => handleCardClick(service)}
              onMouseEnter={() => setHoveredId(service.id)}
              className="group relative w-full overflow-hidden rounded-[20px] border border-white/15 text-left"
              style={cardStyle}
            >
              {layers}
              {header}
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

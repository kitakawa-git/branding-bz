'use client'

// セルフサービス登録ページ（ドメイン認証対応）
// デザイン: /portal/auth と統一
// フロー:
//   Step1: メール・パスワード入力
//   → ドメインチェック → マッチあり → 企業選択画面
//   → 「参加する」→ Step3（個人情報）→ 参加リクエスト送信
//   → 「新規作成」→ Step2（企業情報）→ Step3（個人情報）→ 通常登録
import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Building2, Plus, Clock } from 'lucide-react'

interface MatchedCompany {
  id: string
  name: string
  logo_url: string | null
}

type RegistrationMode = 'new' | 'join'

export default function SignupPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [checkingDomain, setCheckingDomain] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // フォーム値
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userName, setUserName] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')

  // ドメインマッチング
  const [matchedCompanies, setMatchedCompanies] = useState<MatchedCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('new')

  const validateStep1 = (): boolean => {
    if (!email) { setError('メールアドレスを入力してください'); return false }
    if (password.length < 6) { setError('パスワードは6文字以上で入力してください'); return false }
    if (password !== passwordConfirm) { setError('パスワードが一致しません'); return false }
    return true
  }

  const validateStep2 = (): boolean => {
    if (!companyName) { setError('企業名を入力してください'); return false }
    return true
  }

  const validateStep3 = (): boolean => {
    if (!userName) { setError('氏名を入力してください'); return false }
    return true
  }

  // Step1 → ドメインチェック → 次のステップへ
  const handleStep1Next = async () => {
    setError('')
    if (!validateStep1()) return

    setCheckingDomain(true)
    try {
      const res = await fetch('/api/signup/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (data.match && data.companies?.length > 0) {
        setMatchedCompanies(data.companies)
        setStep(1.5)
      } else {
        setRegistrationMode('new')
        setStep(2)
      }
    } catch {
      setRegistrationMode('new')
      setStep(2)
    } finally {
      setCheckingDomain(false)
    }
  }

  const handleJoinCompany = (companyId: string) => {
    setRegistrationMode('join')
    setSelectedCompanyId(companyId)
    setStep(3)
  }

  const handleCreateNew = () => {
    setRegistrationMode('new')
    setSelectedCompanyId(null)
    setStep(2)
  }

  const handleNext = () => {
    setError('')
    if (step === 2 && validateStep2()) setStep(3)
  }

  const handleBack = () => {
    setError('')
    if (step === 3 && registrationMode === 'join') {
      setStep(1.5)
    } else if (step === 3) {
      setStep(2)
    } else if (step === 2 || step === 1.5) {
      setStep(1)
      setMatchedCompanies([])
      setSelectedCompanyId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateStep3()) return

    setLoading(true)
    try {
      if (registrationMode === 'join' && selectedCompanyId) {
        const res = await fetch('/api/signup/join-company', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, password, companyId: selectedCompanyId,
            userName, position, department,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '登録に失敗しました')
          return
        }
        setSuccess(data.message)
        setStep(4)
      } else {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, companyName, userName, position, department }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '登録に失敗しました')
          return
        }
        // 新規owner登録は superadmin 承認制。自動ログインせず承認待ち画面へ。
        setSuccess(data.message || 'ご登録ありがとうございます。承認されるとログインできるようになります。')
        setStep(4)
      }
    } catch (err) {
      setError(`登録中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const getStepLabels = () => {
    if (registrationMode === 'join') {
      return ['アカウント', '企業確認', '個人情報']
    }
    return ['アカウント', '企業・ブランド', '個人情報']
  }

  const getStepNumber = () => {
    if (step === 1.5) return 2
    if (step === 4) return 3
    return step
  }

  const stepLabels = getStepLabels()
  const displayStep = getStepNumber()

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden font-sans text-white px-5 py-16"
      style={{
        background: [
          'radial-gradient(ellipse 120% 90% at 12% 8%, rgba(49,46,129,0.5) 0%, transparent 55%)',
          'radial-gradient(ellipse 110% 90% at 88% 12%, rgba(168,85,247,0.25) 0%, transparent 55%)',
          'radial-gradient(ellipse 120% 100% at 50% 110%, rgba(37,99,235,0.28) 0%, transparent 60%)',
          '#08080a',
        ].join(', '),
      }}
    >
      <div
        className="relative w-full max-w-[460px] rounded-3xl overflow-hidden border border-white/15"
        style={{
          background: 'linear-gradient(135deg, rgba(18,20,29,0.88) 0%, rgba(5,6,10,0.93) 100%)',
          backdropFilter: 'blur(22px) saturate(180%)',
          WebkitBackdropFilter: 'blur(22px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.38), inset 0 -8px 24px -8px rgba(255,255,255,0.05), 0 24px 60px -20px rgba(0,0,0,0.5)',
        }}
      >
        {/* スペキュラ（液体ガラスの艶） */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%)' }} />
        <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }} />

        <div className="relative z-10 p-10">
          {/* タイトル */}
          <div className="text-center mb-6">
            <p className="text-base text-white m-0">
              無料アカウント登録
            </p>
          </div>

          {/* ステップインジケーター（承認待ち画面以外で表示） */}
          {step !== 4 && (
            <div className="flex justify-center gap-2 mb-7">
              {stepLabels.map((label, i) => {
                const stepNum = i + 1
                const isActive = stepNum === displayStep
                const isDone = stepNum < displayStep
                return (
                  <div key={stepNum} className="flex items-center gap-1.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: isDone || isActive ? 'var(--ds-app-accent)' : 'rgba(255,255,255,0.1)',
                        color: isDone || isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {isDone ? '✓' : stepNum}
                    </div>
                    <span className={`whitespace-nowrap text-xs ${isActive ? 'text-white font-bold' : 'text-white/40'}`}>
                      {label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <div className="w-4 h-px shrink-0 bg-white/15 ml-1" />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="mb-4 whitespace-pre-wrap break-words rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ステップ1: アカウント情報 */}
            {step === 1 && (
              <>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">メールアドレス <span className="text-red-400">*</span></h2>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">パスワード <span className="text-red-400">*</span></h2>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6文字以上" required minLength={6} className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">パスワード（確認） <span className="text-red-400">*</span></h2>
                  <Input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="パスワードを再入力" required minLength={6} className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <button
                  type="button"
                  onClick={handleStep1Next}
                  disabled={checkingDomain}
                  className="relative w-full h-12 rounded-full text-base font-semibold text-black bg-white overflow-hidden transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {checkingDomain ? '確認中...' : '次へ'}
                </button>
              </>
            )}

            {/* ステップ1.5: 企業マッチング画面 */}
            {step === 1.5 && (
              <>
                <div className="text-center mb-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/15 mb-3">
                    <Building2 className="h-6 w-6 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">
                    企業が見つかりました
                  </h2>
                  <p className="text-sm text-white/55 m-0">
                    同じメールドメインの企業が登録されています
                  </p>
                </div>

                <div className="space-y-3 mb-5">
                  {matchedCompanies.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => handleJoinCompany(company.id)}
                      className="w-full flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.04] hover:border-blue-400/40 hover:bg-blue-500/10 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {company.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5 text-white/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white m-0 truncate">
                          {company.name}
                        </p>
                        <p className="text-xs text-white/55 m-0">
                          この企業に参加リクエストを送る
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#0c0c11] px-3 text-white/40">または</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="flex w-full h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 font-semibold text-base text-white transition-all hover:bg-white/10"
                >
                  <Plus className="h-4 w-4" />
                  別の企業として新規登録
                </button>

                <div className="mt-4 text-center">
                  <button type="button" onClick={handleBack} className="text-xs text-white/40 hover:text-white/70 transition-colors bg-transparent border-0 cursor-pointer">
                    ← 戻る
                  </button>
                </div>
              </>
            )}

            {/* ステップ2: 企業情報（新規作成時のみ） */}
            {step === 2 && (
              <>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">企業名またはブランド名 <span className="text-red-400">*</span></h2>
                  <Input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="株式会社○○ / ブランド名" required className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                  <p className="text-xs text-white/40 mt-1.5 m-0">後から管理画面で詳細情報を追加できます</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 h-12 rounded-full text-base font-semibold border border-white/15 bg-white/5 text-white transition-all hover:bg-white/10"
                  >
                    戻る
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="relative flex-1 h-12 rounded-full text-base font-semibold text-black bg-white overflow-hidden transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    次へ
                  </button>
                </div>
              </>
            )}

            {/* ステップ3: 個人情報 */}
            {step === 3 && (
              <>
                {registrationMode === 'join' && selectedCompanyId && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-400/30 mb-5">
                    <Building2 className="h-5 w-5 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-400 m-0">参加先</p>
                      <p className="text-sm font-bold text-white m-0">
                        {matchedCompanies.find(c => c.id === selectedCompanyId)?.name}
                      </p>
                    </div>
                  </div>
                )}
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">氏名 <span className="text-red-400">*</span></h2>
                  <Input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="山田太郎" required className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">役職</h2>
                  <Input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="代表取締役（任意）" className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <div className="mb-5">
                  <h2 className="mb-1.5 text-sm font-semibold text-white/70">部署</h2>
                  <Input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="経営企画部（任意）" className="h-12 text-base md:text-base bg-white/[0.04] border-white/15 text-white placeholder:text-white/30 focus-visible:ring-white/30" />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 h-12 rounded-full text-base font-semibold border border-white/15 bg-white/5 text-white transition-all hover:bg-white/10"
                  >
                    戻る
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative flex-1 h-12 rounded-full text-base font-semibold text-black bg-white overflow-hidden transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {loading ? '登録中...' : registrationMode === 'join' ? '参加リクエストを送信' : '登録する'}
                  </button>
                </div>
              </>
            )}

            {/* ステップ4: 承認待ち画面 */}
            {step === 4 && (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/15 mb-4">
                  <Clock className="h-8 w-8 text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">
                  参加リクエストを送信しました
                </h2>
                <p className="text-sm text-white/60 mb-6">
                  {success || '企業の管理者が承認するまでお待ちください。承認されるとログインできるようになります。'}
                </p>
                <Link href="/portal/auth">
                  <button
                    type="button"
                    className="h-12 px-8 rounded-full text-base font-semibold border border-white/15 bg-white/5 text-white transition-all hover:bg-white/10"
                  >
                    ログインページへ
                  </button>
                </Link>
              </div>
            )}
          </form>

          {step !== 4 && (
            <p className="text-center text-xs text-white/55 mt-6 mb-0">
              既にアカウントをお持ちの方は{' '}
              <Link href="/portal/auth" className="text-white font-semibold no-underline hover:underline">
                ログイン
              </Link>
            </p>
          )}

          {/* ロゴ（カード最下部）。クリックでトップページへ */}
          <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <img
                src="/logo.svg"
                alt="branding.bz"
                style={{ height: '24px', width: 'auto', filter: 'brightness(0) invert(1)' }}
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

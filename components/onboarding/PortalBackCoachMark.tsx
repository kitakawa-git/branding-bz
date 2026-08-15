'use client'

// 初回セットアップ案内から管理画面へ来た人に、ポータルへの戻り方を1回だけ教える。
//
// ポータルへ戻るリンクはアカウントメニューの中にあり、畳まれていて見えない。
// 案内をたどって管理画面に来た人は「戻り方が分からない」で詰まりやすいので、
// アカウント行の真上に一度だけ吹き出しを出す。
//
// 出す/出さないの記録は localStorage。
// この端末でこの案内を見たかどうか、というだけの話なので、DB に持たない
// （プランや権限のように、どの端末でも同じであるべき情報ではない）。
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const KEY = 'onboarding:portal-back-coach'

/** 初回セットアップ案内から管理画面へ送るときに呼ぶ。次の管理画面で1回だけ出る */
export function armPortalBackCoach() {
  try {
    // 既に見た人には二度と出さない
    if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, 'pending')
  } catch {
    // プライベートブラウズ等で書けなくても、案内が出ないだけなので黙って諦める
  }
}

export function PortalBackCoachMark() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) === 'pending')
    } catch {
      setShow(false)
    }
  }, [])

  const close = () => {
    setShow(false)
    try {
      localStorage.setItem(KEY, 'done')
    } catch {
      /* 書けなくても表示は消える */
    }
  }

  if (!show) return null

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 relative mb-2 rounded-lg bg-ds-app-accent px-3 py-2.5 text-white duration-300">
      <p className="m-0 pr-5 text-xs leading-relaxed">
        ここからポータル画面に戻れます
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="閉じる"
        className="absolute right-1.5 top-1.5 cursor-pointer rounded border-0 bg-transparent p-1 text-white/70 hover:text-white"
      >
        <X size={12} />
      </button>
      {/* 下のアカウント行を指す三角 */}
      <span
        aria-hidden="true"
        className="absolute -bottom-1 left-5 size-2 rotate-45 bg-ds-app-accent"
      />
    </div>
  )
}

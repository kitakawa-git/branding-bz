'use client'

import { useState } from 'react'
import type { PaletteProposal } from '@/lib/types/color-tool'

interface PalettePreviewProps {
  proposal: PaletteProposal
}

type PreviewTab = 'card' | 'web' | 'logo'

export function PalettePreview({ proposal }: PalettePreviewProps) {
  const [tab, setTab] = useState<PreviewTab>('card')

  const p = proposal.primary.hex
  const s = proposal.secondary[0]?.hex || p
  const a = proposal.accent.hex
  const light = proposal.neutrals.light.hex
  const dark = proposal.neutrals.dark.hex

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'card', label: '名刺' },
    { key: 'web', label: 'Webヘッダー' },
    { key: 'logo', label: 'ロゴ' },
  ]

  return (
    <div className="space-y-3">
      {/* タブ切り替え */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* プレビュー表示 */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {tab === 'card' && (
          <BusinessCardPreview
            primary={p}
            secondary={s}
            accent={a}
            light={light}
            dark={dark}
            brandName={proposal.name}
          />
        )}
        {tab === 'web' && (
          <WebHeaderPreview
            primary={p}
            secondary={s}
            accent={a}
            light={light}
            dark={dark}
          />
        )}
        {tab === 'logo' && (
          <LogoPreview
            primary={p}
            accent={a}
            light={light}
            dark={dark}
          />
        )}
      </div>
    </div>
  )
}

function BusinessCardPreview({
  primary,
  secondary,
  accent,
  light,
  dark,
  brandName,
}: {
  primary: string
  secondary: string
  accent: string
  light: string
  dark: string
  brandName: string
}) {
  return (
    <svg viewBox="0 0 340 200" className="w-full">
      {/* カード背景 */}
      <rect width="340" height="200" fill={light} />
      {/* 上部アクセントライン */}
      <rect x="0" y="0" width="340" height="6" fill={primary} />
      {/* ロゴエリア */}
      <circle cx="40" cy="50" r="16" fill={primary} />
      <text x="40" y="54" textAnchor="middle" fill={light} fontSize="12" fontWeight="bold">BZ</text>
      {/* ブランド名 */}
      <text x="66" y="47" fill={dark} fontSize="14" fontWeight="bold">{brandName.slice(0, 20)}</text>
      <text x="66" y="62" fill={secondary} fontSize="9">branding.bz</text>
      {/* 名前 */}
      <text x="30" y="110" fill={dark} fontSize="16" fontWeight="bold">田中 太郎</text>
      <text x="30" y="128" fill={secondary} fontSize="10">代表取締役 / CEO</text>
      {/* 連絡先 */}
      <text x="30" y="155" fill={dark} fontSize="9">tel: 03-1234-5678</text>
      <text x="30" y="168" fill={dark} fontSize="9">mail: taro@example.com</text>
      {/* 右側カラーバー */}
      <rect x="300" y="80" width="10" height="100" rx="5" fill={primary} />
      <rect x="316" y="100" width="10" height="60" rx="5" fill={accent} />
    </svg>
  )
}

function WebHeaderPreview({
  primary,
  secondary,
  accent,
  light,
  dark,
}: {
  primary: string
  secondary: string
  accent: string
  light: string
  dark: string
}) {
  return (
    <svg viewBox="0 0 340 200" className="w-full">
      {/* ヘッダー背景 */}
      <rect width="340" height="52" fill={primary} />
      {/* ナビ */}
      <circle cx="24" cy="26" r="10" fill={light} opacity="0.2" />
      <text x="24" y="30" textAnchor="middle" fill={light} fontSize="8" fontWeight="bold">BZ</text>
      <text x="80" y="30" fill={light} fontSize="10" opacity="0.9">Home</text>
      <text x="130" y="30" fill={light} fontSize="10" opacity="0.7">About</text>
      <text x="182" y="30" fill={light} fontSize="10" opacity="0.7">Service</text>
      {/* CTA */}
      <rect x="260" y="16" width="64" height="20" rx="10" fill={accent} />
      <text x="292" y="30" textAnchor="middle" fill={light} fontSize="9" fontWeight="bold">Contact</text>
      {/* メインエリア */}
      <rect y="52" width="340" height="148" fill={light} />
      {/* ヒーロー */}
      <text x="24" y="90" fill={dark} fontSize="16" fontWeight="bold">ブランドの価値を</text>
      <text x="24" y="112" fill={dark} fontSize="16" fontWeight="bold">もっと伝わる色で。</text>
      <text x="24" y="132" fill={secondary} fontSize="10">カラーパレットで統一感を生み出す</text>
      {/* CTA Button */}
      <rect x="24" y="146" width="100" height="30" rx="6" fill={primary} />
      <text x="74" y="165" textAnchor="middle" fill={light} fontSize="10" fontWeight="bold">はじめる</text>
      {/* サイドイメージ */}
      <rect x="220" y="68" width="96" height="72" rx="8" fill={secondary} opacity="0.15" />
      <rect x="232" y="80" width="72" height="48" rx="4" fill={primary} opacity="0.2" />
    </svg>
  )
}

function LogoPreview({
  primary,
  accent,
  light,
  dark,
}: {
  primary: string
  accent: string
  light: string
  dark: string
}) {
  return (
    <svg viewBox="0 0 340 200" className="w-full">
      {/* 明るい背景版 */}
      <rect width="170" height="200" fill={light} />
      {/* ロゴシンボル */}
      <circle cx="85" cy="70" r="28" fill={primary} />
      <path d="M72 70 L85 55 L98 70 L85 85 Z" fill={accent} opacity="0.8" />
      <text x="85" y="120" textAnchor="middle" fill={dark} fontSize="14" fontWeight="bold">Brand</text>
      <text x="85" y="136" textAnchor="middle" fill={primary} fontSize="9">Creative Solutions</text>

      {/* 暗い背景版 */}
      <rect x="170" width="170" height="200" fill={dark} />
      {/* ロゴシンボル */}
      <circle cx="255" cy="70" r="28" fill={primary} />
      <path d="M242 70 L255 55 L268 70 L255 85 Z" fill={accent} opacity="0.8" />
      <text x="255" y="120" textAnchor="middle" fill={light} fontSize="14" fontWeight="bold">Brand</text>
      <text x="255" y="136" textAnchor="middle" fill={primary} fontSize="9">Creative Solutions</text>

      {/* 区切り線 */}
      <line x1="170" y1="10" x2="170" y2="190" stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4 4" />
      {/* ラベル */}
      <text x="85" y="170" textAnchor="middle" fill={dark} fontSize="8" opacity="0.5">Light Mode</text>
      <text x="255" y="170" textAnchor="middle" fill={light} fontSize="8" opacity="0.5">Dark Mode</text>
    </svg>
  )
}

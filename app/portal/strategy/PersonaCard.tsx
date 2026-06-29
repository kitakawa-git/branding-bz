'use client'

// ポータル「接し方」のペルソナ1枚カード（PersonaCarousel の各スライド中身）。
// アバター＋名称＋メタ（年齢層/職業）＋説明＋ニーズ/課題（3件＋もっと見る）＋ブランドへの期待。
import { useState } from 'react'
import { PersonaAvatarName } from '@/components/shared/PersonaAvatarName'

export type PortalPersona = {
  name: string
  avatar_emoji: string | null
  age_range: string | null
  occupation: string | null
  description: string | null
  needs: string[]
  pain_points: string[]
  brand_expectations: string | null
}

export function PersonaCard({ persona }: { persona: PortalPersona }) {
  // 説明は実文のみ表示。連携時に説明が空だと persona-mapping が「職業・規模」を description に
  // 充てるため、メタ行の職業と重複する。その種のフォールバック説明は出さない。
  const showDescription = !!persona.description
    && persona.description !== persona.occupation
    && !(persona.occupation && persona.description.startsWith(persona.occupation + '・'))

  return (
    <div className="rounded-lg border border-border bg-background p-5 h-full">
      <div className="mb-3">
        <PersonaAvatarName emoji={persona.avatar_emoji} name={persona.name} className="mb-1" />
        {/* メタ行は最大2行想定。min-h で2行分を確保し、折り返し有無に関わらず
            下の「ニーズ」見出しの開始位置をカード間で揃える。 */}
        <p className="text-base sm:text-sm text-foreground/80 leading-[1.8] whitespace-pre-wrap m-0 min-h-[3.6em]">
          {[persona.age_range, persona.occupation].filter(Boolean).join('\n')}
        </p>
      </div>

      {showDescription && (
        <p className="text-base sm:text-sm text-muted-foreground leading-relaxed mb-4 m-0">
          {persona.description}
        </p>
      )}

      <ExpandableChips
        label="ニーズ"
        items={persona.needs}
        chipClass="bg-blue-50 border border-blue-200 text-ds-app-accent-hover"
        className="mb-3"
      />

      <ExpandableChips
        label="課題・ペインポイント"
        items={persona.pain_points}
        chipClass="bg-orange-50 border border-orange-200 text-orange-700"
      />

      {persona.brand_expectations && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 m-0">ブランドへの期待</p>
          <p className="text-base sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap m-0">
            {persona.brand_expectations}
          </p>
        </div>
      )}
    </div>
  )
}

// ニーズ・課題のチップを3件まで表示し、超過分は「もっと見る」で高さ＋フェードアニメ展開（ポータルのみ）。
function ExpandableChips({ label, items, chipClass, className = '' }: {
  label: string
  items: string[]
  chipClass: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const list = (items || []).filter(i => i?.trim())
  if (list.length === 0) return null
  const LIMIT = 3
  const head = list.slice(0, LIMIT)
  const rest = list.slice(LIMIT)
  const hasMore = rest.length > 0
  const chip = (item: string, key: number) => (
    <span key={key} className={`inline-block px-2.5 py-1 rounded-full text-xs ${chipClass}`}>
      {item}
    </span>
  )
  return (
    <div className={className}>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 m-0">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {head.map((item, i) => chip(item, i))}
      </div>
      {hasMore && (
        <>
          {/* 超過分は grid 0fr→1fr ＋ opacity で高さ・フェードを滑らかにアニメーション */}
          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className={`flex flex-wrap gap-1.5 pt-1.5 transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
                {rest.map((item, i) => chip(item, i + LIMIT))}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className="mt-2 text-xs font-semibold text-ds-app-accent hover:underline"
          >
            {expanded ? '閉じる' : `もっと見る（残り${rest.length}件）`}
          </button>
        </>
      )}
    </div>
  )
}

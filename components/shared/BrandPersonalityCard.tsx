'use client'

// ブランドパーソナリティ 統合表示カード
// - コミュニケーションスタイル（本文・空行区切りで copy/body に分割可）
// - 期待される印象タグ（青枠チップ）
// - 表現ルール（rule_text + NG/OK例）
//
// 使用場所:
//   - 診断ツール Step5（AI診断結果を表示）
//   - ポータル /portal/verbal 聞こえ方タブ（DB保存値を表示）
// どちらも同じ見た目に揃える。個々のセクションは値が無ければ非表示。
import { CSSProperties, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { splitCommunicationStyle } from '@/lib/brand-mvv'

export interface BrandToneRule {
  rule_text: string
  ng_example?: string | null
  ok_example?: string | null
}

interface BrandPersonalityCardProps {
  communicationStyle?: string | null
  expectedTags?: string[]
  toneRules?: BrandToneRule[]
  /** ポータルのブランドフォント適用用のインラインスタイル（省略可） */
  bodyTextStyle?: CSSProperties
  /** カード全体のクラス上書き（省略可） */
  className?: string
  /**
   * 「期待される印象タグ」の下に差し込む追加ブロック（省略可）。
   * 診断ツールでは表現ルールを DB と統合して出すため、ここに差し込んで
   * 1枚のカード内に収める（ポータルは従来どおり toneRules を使う）。
   */
  extraSection?: ReactNode
}

export function BrandPersonalityCard({
  communicationStyle,
  expectedTags = [],
  toneRules = [],
  bodyTextStyle,
  className = '',
  extraSection,
}: BrandPersonalityCardProps) {
  const hasComm = !!communicationStyle && communicationStyle.trim().length > 0
  const hasTags = expectedTags.length > 0
  const hasRules = toneRules.length > 0

  if (!hasComm && !hasTags && !hasRules && !extraSection) return null

  const { copy: commCopy, body: commBody } = hasComm ? splitCommunicationStyle(communicationStyle) : { copy: '', body: '' }

  return (
    <Card className={`bg-[hsl(0_0%_97%)] border shadow-none ${className}`}>
      <CardContent className="p-4 sm:p-5 space-y-8">
        {/* コミュニケーションスタイル */}
        {hasComm && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2 tracking-wide">コミュニケーションスタイル</h3>
            {commCopy && (
              <p className="text-base font-bold text-foreground mb-1 m-0" style={bodyTextStyle}>
                {commCopy}
              </p>
            )}
            {commBody && (
              <p className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap m-0" style={bodyTextStyle}>
                {commBody}
              </p>
            )}
          </div>
        )}

        {/* 期待される印象タグ */}
        {hasTags && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2 tracking-wide">期待される印象タグ</h3>
            <div className="flex flex-wrap gap-2">
              {expectedTags.map(t => (
                <span
                  key={t}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-base font-medium text-ds-app-accent-hover"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 追加ブロック（診断ツールの統合済み表現ルールなど）。期待される印象タグの下に入る */}
        {extraSection}

        {/* 表現ルール */}
        {hasRules && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-2 tracking-wide">表現ルール</h3>
            <div className="space-y-2">
              {toneRules.map((r, i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-4">
                  <p className="text-base font-semibold text-foreground m-0" style={bodyTextStyle}>
                    {r.rule_text}
                  </p>
                  {(r.ng_example || r.ok_example) && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {r.ng_example && (
                        <div className="rounded-md bg-red-50 px-3 py-2">
                          <p className="text-[11px] font-bold text-red-600 mb-0.5 m-0">NG例</p>
                          <p className="text-sm text-red-700/90 leading-relaxed m-0">{r.ng_example}</p>
                        </div>
                      )}
                      {r.ok_example && (
                        <div className="rounded-md bg-green-50 px-3 py-2">
                          <p className="text-[11px] font-bold text-green-700 mb-0.5 m-0">OK例</p>
                          <p className="text-sm text-green-800/90 leading-relaxed m-0">{r.ok_example}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

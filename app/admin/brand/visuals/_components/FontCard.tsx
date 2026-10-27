'use client'

// カード3: フォント設定（プライマリ／セカンダリの欧文・和文選択とプレビュー）
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { FONT_PREVIEW_TEXT, getCssFontFamily, getGoogleFontsUrl, type BrandFonts, type FontSource } from '@/lib/brand-fonts'
import { GoogleFontPicker } from '@/components/GoogleFontPicker'

type FontPickerTarget = { fontRole: 'primary_font' | 'secondary_font'; field: 'latin' | 'japanese' } | null

export function FontCard({
  fonts,
  onFontChange,
}: {
  fonts: BrandFonts
  onFontChange: (
    fontRole: 'primary_font' | 'secondary_font',
    field: 'latin' | 'japanese',
    value: string,
    source?: FontSource
  ) => void
}) {
  const [fontPickerTarget, setFontPickerTarget] = useState<FontPickerTarget>(null)

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        {/* Google Fonts CDN 読み込み */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={getGoogleFontsUrl(fonts)} />
        <h2 className="text-xs font-bold mb-5">フォント</h2>

        {/* プライマリフォント */}
        <div className="mb-8">
          <p className="text-[11px] text-gray-500 mb-3 m-0">プライマリフォント（見出し・タイトル用）</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">欧文</span>
              <button
                type="button"
                onClick={() => setFontPickerTarget({ fontRole: 'primary_font', field: 'latin' })}
                className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
              >
                {fonts.primary_font.latin}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">和文</span>
              <button
                type="button"
                onClick={() => setFontPickerTarget({ fontRole: 'primary_font', field: 'japanese' })}
                className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
              >
                {fonts.primary_font.japanese}
              </button>
            </div>
          </div>
          <p
            className="mt-2 text-sm leading-relaxed text-muted-foreground m-0"
            style={{ fontFamily: getCssFontFamily(fonts.primary_font), fontWeight: 700 }}
          >
            {FONT_PREVIEW_TEXT}
          </p>
        </div>

        {/* セカンダリフォント */}
        <div>
          <p className="text-[11px] text-gray-500 mb-3 m-0">セカンダリフォント（本文・説明文用）</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">欧文</span>
              <button
                type="button"
                onClick={() => setFontPickerTarget({ fontRole: 'secondary_font', field: 'latin' })}
                className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
              >
                {fonts.secondary_font.latin}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-10 shrink-0">和文</span>
              <button
                type="button"
                onClick={() => setFontPickerTarget({ fontRole: 'secondary_font', field: 'japanese' })}
                className="flex-1 h-9 px-3 text-left text-sm bg-background border border-input rounded-md hover:bg-accent/50 transition-colors truncate"
              >
                {fonts.secondary_font.japanese}
              </button>
            </div>
          </div>
          <p
            className="mt-2 text-sm leading-relaxed text-muted-foreground m-0"
            style={{ fontFamily: getCssFontFamily(fonts.secondary_font) }}
          >
            {FONT_PREVIEW_TEXT}
          </p>
        </div>

        <GoogleFontPicker
          open={fontPickerTarget !== null}
          onOpenChange={(open) => { if (!open) setFontPickerTarget(null) }}
          value={fontPickerTarget ? fonts[fontPickerTarget.fontRole][fontPickerTarget.field] : null}
          onSelect={(family, source) => {
            if (fontPickerTarget) onFontChange(fontPickerTarget.fontRole, fontPickerTarget.field, family, source)
          }}
          mode={fontPickerTarget?.field || 'latin'}
        />
      </CardContent>
    </Card>
  )
}

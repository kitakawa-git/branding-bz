'use client'

// CIマニュアル出力ページ
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../components/AuthProvider'
import { fetchCIManualData, resolveImages } from '@/lib/ci-manual/data-fetcher'
import { downloadDataURLAsFile } from '@/lib/qr-download'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { FileDown, Loader2 } from 'lucide-react'
import type { CIManualData, SelectedSections } from '@/lib/ci-manual/types'

type SectionConfig = {
  key: keyof SelectedSections
  label: string
  hasData: (data: CIManualData) => boolean
}

const SECTION_CONFIGS: SectionConfig[] = [
  { key: 'cover', label: '表紙', hasData: () => true },
  { key: 'toc', label: '目次', hasData: () => true },
  { key: 'guidelines', label: 'ブランド方針', hasData: (d) => !!d.guidelines },
  { key: 'visuals', label: 'ビジュアル', hasData: (d) => !!d.visuals },
  { key: 'verbal', label: 'バーバル', hasData: (d) => !!d.verbal },
  { key: 'strategy', label: 'ブランド戦略', hasData: (d) => !!d.strategy },
  { key: 'colophon', label: '奥付', hasData: () => true },
]

const DEFAULT_SECTIONS: SelectedSections = {
  cover: true,
  toc: true,
  guidelines: true,
  visuals: true,
  verbal: true,
  strategy: true,
  colophon: true,
}

export default function CIManualPage() {
  const { companyId } = useAuth()
  const [data, setData] = useState<CIManualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sections, setSections] = useState<SelectedSections>(DEFAULT_SECTIONS)
  const [progressStep, setProgressStep] = useState('')
  const [progressValue, setProgressValue] = useState(0)

  useEffect(() => {
    if (!companyId) return
    ;(async () => {
      setLoading(true)
      try {
        const result = await fetchCIManualData(companyId)
        setData(result)
      } catch (err) {
        console.error('データ取得エラー:', err)
        toast.error('データの取得に失敗しました')
      }
      setLoading(false)
    })()
  }, [companyId])

  const toggleSection = (key: keyof SelectedSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleGenerate = async () => {
    if (!data) return
    setGenerating(true)
    setProgressStep('データ準備中...')
    setProgressValue(5)

    try {
      // 画像をdata URLに変換（CORS回避）
      const resolvedData = await resolveImages(data, (step, progress) => {
        setProgressStep(step)
        setProgressValue(progress)
      })

      // @react-pdf/renderer を動的importで遅延読み込み
      setProgressStep('PDF生成モジュール読み込み中...')
      setProgressValue(40)
      const { generateCIManualPDF } = await import('@/lib/ci-manual/pdf-document')

      const blob = await generateCIManualPDF(resolvedData, sections, (step, progress) => {
        setProgressStep(step)
        setProgressValue(progress)
      })

      // ダウンロード
      setProgressStep('ダウンロード準備中...')
      setProgressValue(95)
      const url = URL.createObjectURL(blob)
      const today = new Date()
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      downloadDataURLAsFile(url, `CI_Manual_${data.company.name}_${dateStr}.pdf`)
      URL.revokeObjectURL(url)

      toast.success('CIマニュアルPDFを生成しました')
    } catch (err) {
      console.error('PDF生成エラー:', err)
      toast.error('PDF生成に失敗しました')
    }

    setGenerating(false)
    setProgressStep('')
    setProgressValue(0)
  }

  // 選択中のコンテンツセクション数（cover/toc/colophonを除く）
  const contentSectionCount = (['guidelines', 'visuals', 'verbal', 'strategy'] as const)
    .filter((k) => sections[k])
    .length

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">CIマニュアル出力</h1>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">CIマニュアル出力</h1>
        <Button
          onClick={handleGenerate}
          disabled={generating || contentSectionCount === 0}
          className={generating || contentSectionCount === 0 ? 'opacity-60' : ''}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              PDF生成中...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              PDFをダウンロード
            </>
          )}
        </Button>
      </div>

      {/* セクション選択 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-6">
        <CardContent className="p-6">
          <h2 className="text-base font-bold text-foreground mb-4">出力セクション</h2>
          <div className="space-y-3">
            {SECTION_CONFIGS.map((config) => {
              const available = data ? config.hasData(data) : false
              const disabled = !available && config.key !== 'cover' && config.key !== 'toc' && config.key !== 'colophon'
              return (
                <div key={config.key} className="flex items-center justify-between">
                  <Label
                    htmlFor={`section-${config.key}`}
                    className={`text-sm ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}
                  >
                    {config.label}
                    {disabled && <span className="text-xs text-muted-foreground ml-2">(データなし)</span>}
                  </Label>
                  <Switch
                    id={`section-${config.key}`}
                    checked={sections[config.key] && !disabled}
                    onCheckedChange={() => toggleSection(config.key)}
                    disabled={disabled}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* プログレス */}
      {generating && (
        <div className="space-y-2">
          <Progress value={progressValue} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progressStep}</p>
        </div>
      )}

      {contentSectionCount === 0 && !generating && (
        <p className="text-sm text-muted-foreground text-center">
          少なくとも1つのコンテンツセクションを選択してください
        </p>
      )}
    </div>
  )
}

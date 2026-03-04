// CIマニュアル PDFドキュメント生成
import { Document, pdf } from '@react-pdf/renderer'
import { registerFonts } from './pdf-fonts'
import { createThemeStyles } from './pdf-styles'
import { CoverSection } from './sections/cover'
import { TOCSection } from './sections/toc'
import { GuidelinesSection } from './sections/guidelines'
import { VisualsSection } from './sections/visuals'
import { VerbalSection } from './sections/verbal'
import { StrategySection } from './sections/strategy'
import { ColophonSection } from './sections/colophon'
import type { CIManualData, SelectedSections } from './types'

function CIManualDocument({
  data,
  sections,
}: {
  data: CIManualData
  sections: SelectedSections
}) {
  const brandColor = data.brandColor || '#1a1a1a'
  const safeData = { ...data, brandColor }
  const styles = createThemeStyles(brandColor)

  return (
    <Document
      title={`${safeData.company.name} CI Manual`}
      author={safeData.company.name}
      subject="Corporate Identity Manual"
    >
      {sections.cover && <CoverSection data={safeData} />}
      {sections.toc && <TOCSection sections={sections} styles={styles} brandColor={brandColor} />}
      {sections.guidelines && safeData.guidelines && (
        <GuidelinesSection data={safeData} styles={styles} brandColor={brandColor} />
      )}
      {sections.visuals && safeData.visuals && (
        <VisualsSection data={safeData} styles={styles} brandColor={brandColor} />
      )}
      {sections.verbal && safeData.verbal && (
        <VerbalSection data={safeData} styles={styles} brandColor={brandColor} />
      )}
      {sections.strategy && safeData.strategy && (
        <StrategySection data={safeData} styles={styles} brandColor={brandColor} />
      )}
      {sections.colophon && <ColophonSection data={safeData} />}
    </Document>
  )
}

export async function generateCIManualPDF(
  data: CIManualData,
  sections: SelectedSections,
  onProgress?: (step: string, progress: number) => void,
): Promise<Blob> {
  onProgress?.('フォント読み込み中...', 50)
  registerFonts(data.visuals?.fonts ?? undefined)

  onProgress?.('PDF生成中...', 60)
  const blob = await pdf(<CIManualDocument data={data} sections={sections} />).toBlob()

  onProgress?.('完了', 100)
  return blob
}

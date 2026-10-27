// 会社のコンセプトビジュアルを背景に敷く（文字を読みやすくするため白い紗とぼかしを重ねる）。
// ダッシュボードの「私たちのミッション」カードと、目標設定ダイアログのミッション・バリュー欄で共通。
// 親は relative overflow-hidden にし、中身は relative で重ねること。

type ConceptVisualRow = { concept_visuals?: string[] | null; concept_visual_url?: string | null } | null | undefined

// brand_guidelines の行から背景に使う画像を決める（新カラム concept_visuals の先頭を優先・レガシー concept_visual_url にフォールバック）
export function pickConceptVisual(row: ConceptVisualRow): string | null {
  if (Array.isArray(row?.concept_visuals) && row.concept_visuals.length > 0) return row.concept_visuals[0] || null
  return row?.concept_visual_url || null
}

export function ConceptVisualBackdrop({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <>
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} aria-hidden />
      <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" aria-hidden />
    </>
  )
}

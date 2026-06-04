import { redirect } from 'next/navigation'

// 提供価値（brand_values）の編集は「ブランド戦略」(/admin/brand/strategy) に統合済み。
// 「考え方｜ブランド方針」→「接し方｜ブランド戦略」への移動に伴い、この単独ページは吸収し、
// 直接アクセスはブランド戦略へリダイレクトする。
export default function BrandValuesRedirect() {
  redirect('/admin/brand/strategy')
}

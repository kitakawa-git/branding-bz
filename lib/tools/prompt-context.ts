// 構築ツールの AI 提案 API（/api/tools/stp/suggest-*・/api/tools/persona/suggest-*）が
// プロンプトに入れる「企業の基本情報」を文章にする処理。各 route に同じコードが複製されていたものを集めた。
//
// ⚠️ 出力はそのまま Claude への入力になる。1文字変わると提案が変わるので、変えるときは
//    prompt-context.test.ts の期待値（2026-10-27 に元のコードを実行して記録したもの）も意識して直すこと。
// ⚠️ STP の2つの版は「同じ内容」ではない（下の注記）。挙動を変えないため別関数のまま残している。

/* eslint-disable @typescript-eslint/no-explicit-any -- basic_info は request.json() の値をそのまま受ける（元の route と同じ扱い） */

/**
 * STP（suggest-segments / suggest-positioning / suggest-target-detail）:
 * 「## 企業情報」見出し＋企業名・業種・事業内容・現状の主要顧客。旧形式（industry / products / current_customers）にも対応。
 */
export function pushStpCompanyProfile(parts: string[], basic_info: any): void {
  parts.push('## 企業情報')
  if (basic_info.company_name) {
    parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
  }
  // 業種（新形式 or 旧形式に対応）
  if (basic_info.industry_category) {
    const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
    parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
  } else if (basic_info.industry) {
    const industry = basic_info.industry === 'その他' && basic_info.industry_other
      ? basic_info.industry_other
      : basic_info.industry
    parts.push(`- 業種: ${industry}`)
  }
  // 事業内容（構造化データ or 旧テキスト形式に対応）
  if (basic_info.business_descriptions && Array.isArray(basic_info.business_descriptions)) {
    const descriptions = basic_info.business_descriptions
      .filter((b: { title: string; description: string }) => b.title?.trim())
      .map((b: { title: string; description: string }, i: number) => {
        const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
        return `  ${i + 1}. ${b.title.trim()}${desc}`
      })
      .join('\n')
    if (descriptions) {
      parts.push(`- 事業内容:\n${descriptions}`)
    }
  } else if (basic_info.products) {
    parts.push(`- 事業内容: ${basic_info.products}`)
  }
  // 現状の主要顧客（構造化データ or 旧テキスト形式に対応）
  if (basic_info.target_segments && Array.isArray(basic_info.target_segments)) {
    const segments = basic_info.target_segments
      .filter((ts: { name: string; description: string }) => ts.name?.trim())
      .map((ts: { name: string; description: string }, i: number) => {
        const desc = ts.description?.trim() ? `: ${ts.description.trim()}` : ''
        return `  ${i + 1}. ${ts.name.trim()}${desc}`
      })
      .join('\n')
    if (segments) {
      parts.push(`- 現状の主要顧客:\n${segments}`)
    }
  } else if (basic_info.current_customers) {
    parts.push(`- 現状の主要顧客: ${basic_info.current_customers}`)
  }
}

/**
 * STP（suggest-brand-stance / suggest-target-fit-map）:
 * 「## 企業情報」見出し＋企業名・業種・事業内容。pushStpCompanyProfile と違い、事業内容の旧形式（products）と
 * 主要顧客は出さない。basic_info が無くても落ちない。
 */
export function pushStpCompanyBasics(parts: string[], basic_info: any): void {
  parts.push('## 企業情報')
  if (basic_info?.company_name) parts.push(`- 企業名・ブランド名: ${basic_info.company_name}`)
  if (basic_info?.industry_category) {
    const sub = basic_info.industry_subcategory ? `（${basic_info.industry_subcategory}）` : ''
    parts.push(`- 業種: ${basic_info.industry_category}${sub}`)
  } else if (basic_info?.industry) {
    const industry = basic_info.industry === 'その他' && basic_info.industry_other
      ? basic_info.industry_other
      : basic_info.industry
    parts.push(`- 業種: ${industry}`)
  }
  if (Array.isArray(basic_info?.business_descriptions)) {
    const descriptions = basic_info.business_descriptions
      .filter((b: { title?: string }) => b.title?.trim())
      .map((b: { title: string; description?: string }, i: number) => {
        const desc = b.description?.trim() ? `: ${b.description.trim()}` : ''
        return `  ${i + 1}. ${b.title.trim()}${desc}`
      })
      .join('\n')
    if (descriptions) parts.push(`- 事業内容:\n${descriptions}`)
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * ペルソナ（suggest-demographics / suggest-goals / suggest-journey）: 事業内容を1行の文字列に。
 * 区切りは route ごとに違う（demographics は '\n  '、goals / journey は '、'）。
 */
export function formatBusinessDescriptions(basicInfo: Record<string, unknown>, separator: string): string {
  const descs = basicInfo.business_descriptions as Array<{ title: string; description: string }> | undefined
  if (descs?.length) {
    return descs
      .filter(b => b.title?.trim())
      .map(b => b.description ? `${b.title}: ${b.description}` : b.title)
      .join(separator)
  }
  // 旧形式フォールバック
  if (basicInfo.products && typeof basicInfo.products === 'string') {
    return basicInfo.products as string
  }
  return ''
}

/** ペルソナ（suggest-demographics / suggest-goals）: 現状の主要顧客を1行の文字列に。区切りは formatBusinessDescriptions と同じ */
export function formatTargetSegments(basicInfo: Record<string, unknown>, separator: string): string {
  const segs = basicInfo.target_segments as Array<{ name: string; description: string }> | undefined
  if (segs?.length) {
    return segs
      .filter(ts => ts.name?.trim())
      .map(ts => ts.description ? `${ts.name}: ${ts.description}` : ts.name)
      .join(separator)
  }
  // 旧形式フォールバック
  if (basicInfo.target_description && typeof basicInfo.target_description === 'string') {
    return basicInfo.target_description as string
  }
  return ''
}

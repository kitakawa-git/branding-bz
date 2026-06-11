// 8印象タグの正準語彙（唯一の定義源）
// 計測側（brand_micro_feedbacks / brand_personality_tag_mappings）と
// 診断側（パーソナリティ診断の expected_tags）はこの語彙で文字列照合される。
// 語彙を変える場合はこの定数のみを変更し、既存DBデータの移行を必ず検討すること。
export const ALL_IMPRESSION_TAGS = [
  '信頼感',
  '革新的',
  '親しみやすい',
  '専門的',
  '洗練された',
  '情熱的',
  '堅実',
  '遊び心がある',
] as const

export type ImpressionTag = (typeof ALL_IMPRESSION_TAGS)[number]

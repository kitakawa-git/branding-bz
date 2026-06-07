// 業種マスタデータ（共通）

export interface IndustryCategory {
  value: string
  label: string
  subcategories: string[]
}

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { value: 'it_tech', label: 'IT・テクノロジー', subcategories: [
    'SaaS', 'EC', 'フィンテック', 'AI・ロボティクス', 'Web制作・開発', 'その他',
  ]},
  { value: 'manufacturing', label: '製造業', subcategories: [
    '食品', '化学・素材', '機械・電機', '自動車', 'その他',
  ]},
  { value: 'service', label: 'サービス業', subcategories: [
    '飲食', '宿泊・観光', '教育', '美容・健康', 'その他',
  ]},
  { value: 'retail', label: '小売・流通', subcategories: [
    'アパレル', '食品', '家電・雑貨', 'EC専業', 'その他',
  ]},
  { value: 'medical', label: '医療・ヘルスケア', subcategories: [
    '病院・クリニック', '医療機器', '製薬', '介護・福祉', 'その他',
  ]},
  { value: 'finance', label: '金融・保険', subcategories: [
    '銀行', '証券', '保険', '不動産', 'その他',
  ]},
  { value: 'creative', label: 'クリエイティブ', subcategories: [
    'デザイン', '広告', 'メディア', 'エンタメ', 'その他',
  ]},
  { value: 'construction', label: '建設・不動産', subcategories: [
    '建設', '不動産', '建築設計', 'インテリア', 'その他',
  ]},
  { value: 'consulting', label: 'コンサルティング', subcategories: [
    '経営・戦略', '人事・組織', 'IT・DX', '財務・会計', 'ブランド・マーケティング', 'その他',
  ]},
  { value: 'other', label: 'その他', subcategories: [
    'NPO・公益法人', '行政', '農林水産', '物流', 'その他',
  ]},
] as const

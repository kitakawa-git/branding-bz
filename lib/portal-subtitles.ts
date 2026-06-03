// ポータルページのデフォルトサブタイトル定数

export const PORTAL_PAGE_KEYS = ['guidelines', 'strategy', 'verbal', 'visuals', 'values'] as const

export type PortalPageKey = (typeof PORTAL_PAGE_KEYS)[number]

export type PortalSubtitles = Partial<Record<PortalPageKey, string>>

export const DEFAULT_SUBTITLES: Record<PortalPageKey, string> = {
  guidelines: 'ブランドのビジョン・ミッション・バリューとメッセージ',
  strategy: 'ターゲット・ペルソナ・ポジショニング・行動指針',
  verbal: 'ブランドのトーン・用語ルール',
  visuals: 'ロゴガイドライン・ブランドカラー・フォント規定',
  values: 'ブランドが提供する主要な価値と差別化要因',
}

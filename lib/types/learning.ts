// ビデオラーニング機能の型定義

// learning_videos: 動画マスター
export type LearningVideo = {
  id: string
  company_id: string
  title: string
  description: string | null
  youtube_video_id: string
  youtube_url: string | null
  thumbnail_url: string | null
  category: string | null // レガシー（旧テキストカテゴリ。今後は theme_id を使用）
  theme_id: string | null // 所属テーマ（未分類は null）
  duration_seconds: number | null
  sort_order: number
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// learning_categories: カテゴリー（大分類）
export type LearningCategory = {
  id: string
  company_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  themes?: LearningTheme[]
}

// learning_themes: テーマ（学習レベル。カテゴリー配下）
export type LearningTheme = {
  id: string
  company_id: string
  category_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  video_count?: number
  videos?: LearningVideo[]
}

// 階層構造レスポンス（カテゴリー > テーマ > 動画）
export type LearningStructure<V = LearningVideo> = {
  categories: (Omit<LearningCategory, 'themes'> & {
    themes: (Omit<LearningTheme, 'videos'> & { video_count: number; videos: V[] })[]
  })[]
  uncategorized: V[]
}

// learning_video_views: 視聴セッション（1セッション=1行）
export type LearningVideoView = {
  id: string
  company_id: string
  video_id: string
  profile_id: string
  watched_seconds: number
  progress_percent: number
  completed: boolean
  started_at: string
  last_progress_at: string | null
  created_at: string
}

// ポータル一覧用: 動画 + ログイン中メンバー自身の進捗
export type LearningVideoWithProgress = LearningVideo & {
  my_progress_percent: number // この動画に対する自分の最大到達度（未視聴は 0）
  my_completed: boolean        // 一度でも完了していれば true
  my_view_count: number        // 自分の視聴セッション数
}

// 管理: 動画別の視聴集計
export type VideoAnalytics = {
  video_id: string
  title: string
  category: string | null
  is_published: boolean
  viewer_count: number       // 視聴人数（distinct profile）
  completed_count: number    // 完了人数（distinct profile かつ completed）
  completion_rate: number    // 完了率(%) = completed_count / viewer_count * 100
  avg_progress: number       // 平均進捗(%)（各メンバーの最大到達度の平均）
  total_view_count: number   // 総再生回数（セッション行数）
}

// 管理: メンバー × 動画 のマトリクス1セル
export type MemberVideoCell = {
  video_id: string
  max_progress_percent: number // そのメンバーの最大到達度
  completed: boolean           // 一度でも完了したか
  last_viewed_at: string | null // 最終視聴日時
  view_count: number           // 視聴セッション数
}

// 管理: メンバー別の視聴状況
export type MemberAnalytics = {
  profile_id: string
  name: string
  cells: MemberVideoCell[] // 各動画に対する視聴状況
}

// 管理 analytics API のレスポンス
export type LearningAnalytics = {
  videos: VideoAnalytics[]
  members: MemberAnalytics[]
  // マトリクス表示用の動画見出し（sort_order 順）
  videoHeaders: { id: string; title: string }[]
}

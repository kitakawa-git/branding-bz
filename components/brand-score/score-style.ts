// スコアの色分け・ランクバッジ（0〜100）。サーベイ結果と市場調査の結果で同じ様式にするために共有する
export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground'
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-ds-app-accent'
  if (score >= 40) return 'text-amber-600'
  return 'text-red-600'
}
export function getScoreProgressColor(score: number | null): string {
  if (score === null) return 'bg-muted'
  if (score >= 80) return '[&>div]:bg-green-500'
  if (score >= 60) return '[&>div]:bg-ds-app-accent-soft'
  if (score >= 40) return '[&>div]:bg-amber-500'
  return '[&>div]:bg-red-500'
}
export function getRankBadgeClass(rank: string): string {
  if (rank === 'S') return 'bg-green-100 text-green-700 border-green-200'
  if (rank === 'A+' || rank === 'A') return 'bg-blue-100 text-ds-app-accent-hover border-blue-200'
  if (rank === 'B+' || rank === 'B') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (rank === 'C' || rank === 'D') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

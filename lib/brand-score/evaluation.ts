// バリュー評価レイヤー 共通ユーティリティ（levels の正規化）
// サーバ（API Route）とクライアント（管理画面）の双方から参照する。
import type { CriterionLevel } from '@/lib/types/brand-evaluation'

// 常に5要素（level 1..5）の空テンプレートを返す
export function emptyLevels(): CriterionLevel[] {
  return [1, 2, 3, 4, 5].map((level) => ({ level, description: '' }))
}

// 任意の入力を「level 1..5・description は string」の5要素配列に正規化する。
// 不正・欠落・順不同・余剰要素のいずれも安全に丸める（DBにはこの形のみ保存する）。
export function normalizeLevels(raw: unknown): CriterionLevel[] {
  const byLevel = new Map<number, string>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      const level = Number(obj.level)
      if (!Number.isInteger(level) || level < 1 || level > 5) continue
      const description = typeof obj.description === 'string' ? obj.description : ''
      byLevel.set(level, description)
    }
  }
  return [1, 2, 3, 4, 5].map((level) => ({
    level,
    description: byLevel.get(level) ?? '',
  }))
}

// 5段階のいずれかに記述があるか（上書き確認の判定に使う）
export function hasLevelContent(levels: CriterionLevel[] | undefined | null): boolean {
  if (!Array.isArray(levels)) return false
  return levels.some((l) => typeof l?.description === 'string' && l.description.trim() !== '')
}

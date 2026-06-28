// ポジショニングマップ データ型定義

export type PositioningMapSize = 'sm' | 'md' | 'lg' | 'custom'

export type PositioningMapItem = {
  name: string
  color: string
  x: number
  y: number
  size: PositioningMapSize
  customSize?: number
  reasoning?: string  // AIによる配置根拠（STP連携）
  confidence?: 'high' | 'medium' | 'low'  // 配置の確信度（STP連携）
}

export type PositioningMapData = {
  x_axis: { left: string; right: string }
  y_axis: { bottom: string; top: string }
  axis_rationale?: string  // なぜこの2軸を選んだか（STP連携）
  items: PositioningMapItem[]
}

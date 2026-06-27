// ターゲット適合マップ（読み取り専用・SVG）。Step5の概要表示などで使う。
// 編集（スライダー）版は Step3 の TargetFitMapView。装飾は PositioningMap に合わせている。
import type { TargetFitMap } from '@/app/tools/stp/app/[sessionId]/page'

// ビューボックスはPositioningMapと同じ尺度（幅700）に合わせる＝同じfontSize/ドット径が同じ見た目になる。
// アスペクト比は5:3を維持（700:420 = 5/3）。PADもPositioningMapと同じ16。
const PAD = 16
const W = 700
const H = 420
const MAP_W = W - PAD * 2
const MAP_H = H - PAD * 2
const SUB_COLORS = ['#10B981', '#8B5CF6', '#F59E0B']

export function TargetFitMapStatic({ fitMap, maxHeight }: { fitMap: TargetFitMap; maxHeight?: number }) {
  const toX = (x: number) => PAD + (x / 100) * MAP_W
  const toY = (y: number) => PAD + ((100 - y) / 100) * MAP_H
  const cov = fitMap.coverage
  const cx = toX(cov.center_x)
  const cy = toY(cov.center_y)
  const rx = (cov.width / 100) * MAP_W / 2
  const ry = (cov.height / 100) * MAP_H / 2
  const plotCx = PAD + MAP_W / 2
  const plotCy = PAD + MAP_H / 2
  let subIdx = -1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: '5 / 3', maxHeight: maxHeight ? `${maxHeight}px` : undefined }} className="rounded-lg">
      {/* XY軸（PositioningMapと同色） */}
      <line x1={plotCx} y1={PAD} x2={plotCx} y2={PAD + MAP_H} stroke="#d1d5db" strokeWidth={1} />
      <line x1={PAD} y1={plotCy} x2={PAD + MAP_W} y2={plotCy} stroke="#d1d5db" strokeWidth={1} />
      {/* 目盛り（細め・短め） */}
      {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map((val) => {
        const t = val % 10 === 0 ? 4 : 2
        return (
          <g key={`tick-${val}`}>
            <line x1={toX(val)} y1={plotCy - t} x2={toX(val)} y2={plotCy + t} stroke="#d1d5db" strokeWidth={0.75} />
            <line x1={plotCx - t} y1={toY(val)} x2={plotCx + t} y2={toY(val)} stroke="#d1d5db" strokeWidth={0.75} />
          </g>
        )
      })}
      {/* 自社カバー範囲（破線・半透明）— 適合マップ固有 */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#3B82F6" fillOpacity={0.08} stroke="#3B82F6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#3B82F6" fillOpacity={0.7}>自社カバー範囲</text>
      {/* 軸ラベル（PositioningMapと同位置・同色・fontSize12。プロット内側） */}
      {fitMap.x_axis.left && (
        <text x={PAD + 4} y={plotCy - 8} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.x_axis.left}</text>
      )}
      {fitMap.x_axis.right && (
        <text x={PAD + MAP_W - 4} y={plotCy - 8} textAnchor="end" fontSize="12" fill="#9ca3af">{fitMap.x_axis.right}</text>
      )}
      {fitMap.y_axis.top && (
        <text x={plotCx + 8} y={PAD + 14} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.y_axis.top}</text>
      )}
      {fitMap.y_axis.bottom && (
        <text x={plotCx + 8} y={PAD + MAP_H - 14} textAnchor="start" fontSize="12" fill="#9ca3af">{fitMap.y_axis.bottom}</text>
      )}
      {/* ターゲット点（PositioningMap準拠：r8・opacity0.85・白縁2px。メイン＝右にボールド濃色、サブ＝下中央にドット色） */}
      {fitMap.targets.map((t, i) => {
        const isMain = t.role === 'main'
        const color = isMain ? '#3B82F6' : SUB_COLORS[(subIdx = subIdx + 1) % SUB_COLORS.length]
        const px = toX(t.x)
        const py = toY(t.y)
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={8} fill={color} opacity={0.85} stroke="#fff" strokeWidth={2} />
            {!t.in_coverage && <circle cx={px} cy={py} r={12} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" />}
            {isMain ? (
              <text x={px + 13} y={py + 5} textAnchor="start" fontSize="14" fill="#0f172a" fontWeight={700}>{t.name}</text>
            ) : (
              <text x={px} y={py + 20} textAnchor="middle" fontSize="11" fill={color} fontWeight={600}>{t.name}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

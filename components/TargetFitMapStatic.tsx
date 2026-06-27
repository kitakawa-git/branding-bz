// ターゲット適合マップ（読み取り専用・SVG）。Step5の概要表示などで使う。
// 編集（スライダー）版は Step3 の TargetFitMapView。
import type { TargetFitMap } from '@/app/tools/stp/app/[sessionId]/page'

const PAD = 40
const W = 500
const H = 300
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
  let subIdx = -1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ aspectRatio: '5 / 3', maxHeight: maxHeight ? `${maxHeight}px` : undefined }} className="rounded-lg">
      <line x1={PAD + MAP_W / 2} y1={PAD} x2={PAD + MAP_W / 2} y2={PAD + MAP_H} stroke="#e5e7eb" strokeWidth={1} />
      <line x1={PAD} y1={PAD + MAP_H / 2} x2={PAD + MAP_W} y2={PAD + MAP_H / 2} stroke="#e5e7eb" strokeWidth={1} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#3B82F6" fillOpacity={0.08} stroke="#3B82F6" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={PAD - 6} y={PAD + MAP_H / 2} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6b7280">{fitMap.x_axis.left}</text>
      <text x={PAD + MAP_W + 6} y={PAD + MAP_H / 2} textAnchor="start" dominantBaseline="middle" fontSize="11" fill="#6b7280">{fitMap.x_axis.right}</text>
      <text x={PAD + MAP_W / 2} y={PAD - 12} textAnchor="middle" fontSize="11" fill="#6b7280">{fitMap.y_axis.top}</text>
      <text x={PAD + MAP_W / 2} y={PAD + MAP_H + 20} textAnchor="middle" fontSize="11" fill="#6b7280">{fitMap.y_axis.bottom}</text>
      {fitMap.targets.map((t, i) => {
        const color = t.role === 'main' ? '#3B82F6' : SUB_COLORS[(subIdx = subIdx + 1) % SUB_COLORS.length]
        const px = toX(t.x)
        const py = toY(t.y)
        return (
          <g key={i}>
            <circle cx={px} cy={py} r={6} fill={color} stroke="#fff" strokeWidth={2} />
            {!t.in_coverage && <circle cx={px} cy={py} r={10} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" />}
            <text x={px + 9} y={py + 4} fontSize="11" fill="#0f172a" fontWeight={t.role === 'main' ? 700 : 400}>{t.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

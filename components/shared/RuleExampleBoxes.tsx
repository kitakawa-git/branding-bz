'use client'

// 表現ルールの「NG例／OK例」ボックス。スーパー管理・ポータル・診断ツールで見た目を揃えるための共通部品。
// - 両方あるときだけ2カラム、片方だけなら1カラムで全幅。
// - どちらも無ければ何も描かない（呼び出し側で条件分岐しなくてよい）。
export function RuleExampleBoxes({
  ngExample,
  okExample,
  className = '',
}: {
  ngExample?: string | null
  okExample?: string | null
  className?: string
}) {
  const ng = ngExample?.trim() || ''
  const ok = okExample?.trim() || ''
  if (!ng && !ok) return null

  return (
    <div className={`mt-2 grid gap-2 grid-cols-1 ${ng && ok ? 'sm:grid-cols-2' : ''} ${className}`}>
      {ng && (
        <div className="rounded-md bg-red-50 px-3 py-2">
          <p className="text-[11px] font-bold text-red-600 mb-0.5 m-0">NG例</p>
          <p className="text-[13px] text-red-700/90 leading-relaxed m-0 break-words">{ng}</p>
        </div>
      )}
      {ok && (
        <div className="rounded-md bg-green-50 px-3 py-2">
          <p className="text-[11px] font-bold text-green-700 mb-0.5 m-0">OK例</p>
          <p className="text-[13px] text-green-800/90 leading-relaxed m-0 break-words">{ok}</p>
        </div>
      )}
    </div>
  )
}

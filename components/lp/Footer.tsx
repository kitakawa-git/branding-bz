/* 新デザイン（/lp 系）の共通フッター。layout.tsx から全ページ共通で描画。 */
const cols = [
  { h: '機能', items: ['ブランド掲示', 'タイムライン', 'KPI・目標', 'ブランドスコア', 'スマート名刺'] },
  { h: '無料ツール', items: ['STP分析', 'ペルソナビルダー', 'ブランドカラー定義', 'パーソナリティ診断'] },
  { h: '会社情報', items: ['ID INC. について', 'ニュース', 'お問い合わせ', '採用'] },
  { h: '規約', items: ['利用規約', 'プライバシーポリシー', '特定商取引法'] },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <img
              src="/logo.svg"
              alt="branding.bz"
              style={{ height: '20px', width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              AIで、ブランディングを加速させる。構築・浸透・発信をひとつのプラットフォームで。
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div className="mb-4 text-sm font-semibold text-white/80">{c.h}</div>
              <ul className="space-y-2.5">
                {c.items.map((it) => (
                  <li key={it}>
                    <span className="cursor-pointer text-sm text-white/45 transition-colors hover:text-white/80">
                      {it}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} ID INC. All rights reserved.</span>
          <span>branding.bz</span>
        </div>
      </div>
    </footer>
  )
}

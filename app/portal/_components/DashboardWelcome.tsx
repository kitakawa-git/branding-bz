// ポータルダッシュボード冒頭の「ようこそ、〇〇 さん」＋スローガン
// 1行の見出しの幅を「文字の大きさ何個分（em）」で見積もる。全角は1、半角英数・記号は0.6、空白は0.3。
// 太字の和文で実測した値に少し余裕（1.04倍）を足している
function welcomeWidthEm(text: string): number {
  let em = 0
  for (const ch of text) {
    if (/\s/.test(ch)) em += 0.3
    else if (/[\u0020-\u007e\uff61-\uff9f]/.test(ch)) em += 0.6
    else em += 1
  }
  return Math.round(em * 1.04 * 100) / 100
}

export function DashboardWelcome({
  member,
  slogan,
}: {
  member: { display_name: string } | null
  slogan: string | null
}) {
  return (
    // containerType: 「ようこそ、〇〇 さん」の文字サイズを、この枠の幅（cqi）から決めるため
    <div className="text-center mb-8" style={{ containerType: 'inline-size' }}>
      {/* スローガン未設定（ブランク）のときは見出しを非表示にする */}
      {member && (
        // 1行に収める（「さ／ん」のように名前の途中や末尾で折れないように）。
        // 文字サイズは「枠の幅 ÷ 文字数」で決め、上限は 36px（text-4xl）。短い名前は従来どおりの大きさ、
        // 長い名前やスマホ幅では自動で小さくなる。文字数は名前から決まるので、サーバーとブラウザで同じになる
        <p
          className="font-bold text-foreground m-0 whitespace-nowrap"
          style={{ fontSize: `min(2.25rem, calc(100cqi / ${welcomeWidthEm(`ようこそ、${member.display_name} さん`)}))` }}
        >
          ようこそ、{member.display_name} さん
        </p>
      )}
      {slogan && (
        <h1 className="text-base sm:text-sm font-normal text-muted-foreground m-0 mt-1">
          {slogan}
        </h1>
      )}
    </div>
  )
}

/* 文節単位で折り返すための表示部品。/features と /inner-branding から共通で使う
   （同じ仕組みを各ページにコピーすると、片方だけ直される事故が起きるため1か所に置く）。

   - 文字列中の「|」は画面に表示される文字ではなく、文節の区切りを指定するこのサイト独自の記法。
   - Phrases は「|」で分けた各文節を inline-block で包み、文節の途中で折り返さないようにする
     （何もしないと、スマホ幅で「配／信」「コンテ／ンツ」のように語の途中で折れる）。
     「|」が無い文字列はそのまま表示する。
   - 1つの文節は、最も狭い幅（320px）のカード1行に収まる長さにすること。
     inline-block は途中で折れないので、長すぎる文節はカードからはみ出す。
   - ⚠️ 「|」入りの文字列を metadata・JSON-LD・プレーンテキストなど、Phrases を通さない場所に
     転用するときは、必ず区切り記号を取り除くこと（例: text.replaceAll('|', '')）。
     そのまま渡すと「|」が検索結果やSNSの説明文に表示されてしまう。 */
export default function Phrases({ text }: { text: string }) {
  if (!text.includes('|')) return <>{text}</>
  return (
    <>
      {text.split('|').map((p, i) => (
        <span key={i} className="inline-block">
          {p}
        </span>
      ))}
    </>
  )
}

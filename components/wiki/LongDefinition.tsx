import { parseLongDef } from '@/lib/wiki/long-def'

/* 詳細定義（long_def）の描画。
   「### 見出し」＋段落の構造をそのまま出す。
   見出しが無い旧データが来ても段落として素直に描画されるので、DB更新前後どちらでも壊れない。

   ページ内目次は置かない＝リンク文言が直下の h3 と完全に重複しており、
   SEO 上の足しにならないため（見出し構造は h3 が伝える）。
   節を直接指すための id は h3 に残してある。 */
export default function LongDefinition({ longDef }: { longDef: string }) {
  const { intro, sections } = parseLongDef(longDef)

  return (
    <>
      {/* 見出しが付く前の旧データ（プレーンテキスト）はそのまま段落として出す */}
      {intro.map((p, i) => (
        <p key={`intro-${i}`} className="mt-4 text-base leading-[1.9] text-white/70 first:mt-0">
          {p}
        </p>
      ))}

      {/* 余白はセクションとセクションの間にだけ要る。
          h3 に mt-7 + first:mt-0 を付けていたが、h3 は常に section の先頭の子なので
          first が毎回当たって mt-7 が一度も効いていなかった（見出しが前の段落に貼り付く）。
          間隔は space-y で親に持たせる＝最初のセクションだけ除かれるので条件が要らない */}
      <div className="space-y-7">
        {sections.map((s) => (
          <section key={s.id}>
            <h3
              id={s.id}
              className="mb-2.5 border-l-[3px] border-blue-400/70 pl-2.5 text-[15px] font-bold text-blue-400"
            >
              {s.heading}
            </h3>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-4 text-base leading-[1.9] text-white/70 first:mt-0">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </>
  )
}

import { parseLongDef, TOC_MIN_SECTIONS } from '@/lib/wiki/long-def'

/* 詳細定義（long_def）の描画。
   「### 見出し」＋段落の構造を目次つきで出す。
   見出しが無い旧データが来ても段落として素直に描画されるので、DB更新前後どちらでも壊れない。 */
export default function LongDefinition({ longDef }: { longDef: string }) {
  const { intro, sections } = parseLongDef(longDef)
  const showToc = sections.length >= TOC_MIN_SECTIONS

  return (
    <>
      {showToc && (
        <nav
          aria-label="この用語の目次"
          className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-1.5"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center text-sm text-white/70 underline-offset-4 transition-colors hover:text-blue-300 hover:underline"
            >
              {s.heading}
            </a>
          ))}
        </nav>
      )}

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

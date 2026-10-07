import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

/* 日本語の見出しを、文節の切れ目でだけ折り返すための部品（見出し用）。
   heading.ts の見出しは word-break: keep-all（文字の途中では折れない）なので、ここで文節の切れ目に
   <wbr /> を入れて「ここなら折ってよい」位置を作る。結果、スマホ幅でも「とどけ／る。」
   「定義ツ／ール」のような語の途中の折り返しが起きない。

   ・「|」を手で入れる Phrases とは別物。こちらは文字種の並びから自動で区切るので、見出しの文言を変えても
     何もしなくてよい。
   ・区切り方（形態素解析ではなく、文字種による簡易な文節判定）:
       1. ひらがなの後に、漢字・カタカナ・英数字・記号が来たら区切る（「数字から｜次の」「合わせて｜ステップ」）
          ただし、ひらがなが1文字のときは助詞（の・を・に・で・と・は・が・へ・も・や）のときだけ
          （「取り組み」の「り」のような送り仮名で区切らないため）。「必要な｜すべて」の「な」も含める
       2. カタカナと漢字の境目で区切る（「ブランドカラー｜定義｜ツール」）
       3. 句読点の後で区切る（閉じ括弧の後は、続くのが助詞でなければ。「」を」は離さない）
       4. カタカナ語が続く所は、下の KATAKANA_WORDS の語の境目で区切る（「ブランド｜パーソナリティ」）。
          カタカナ同士の境目は文字種では分からないため、このサイトの見出しに出る語を辞書として持つ。
          見出しに新しいカタカナ複合語を足して、スマホで語の途中で折れたら、ここに語を足す
       5. 「とは」「について」など2文字以上の助詞の前でも区切る（「インナーブランディング｜とは」）
       6. 漢字・カタカナの直後の助詞1文字の後に、ひらがなが4文字以上続くときはその前で区切る
          （「行動に｜つながらない」「必要な｜すべてを」）
       7. 改行 <br /> の位置でも区切る（className="hidden md:block" でスマホでは消える <br /> の所に、
          折れる位置が残らず「根づか｜ない」と折れるため）
       8. 6文字以上のカタカナ語の後に続くひらがなの前でも区切る（「プラットフォーム｜に。」）。
          ブラウザは収まる限り後ろの区切りで折るので、ここで折るのは語が長くて他に収まらないときだけ
       ただし、句読点・閉じ括弧・小さい仮名・長音「ー」の前では区切らない
   ・外部ライブラリ（BudouX）も試したが、「ひろげる、と｜どける。」と区切るなど、このサイトの見出しで
     誤りがあったうえ依存も大きいため採用していない。
   ・サーバーとブラウザで必ず同じ結果になる（Intl.Segmenter は実行環境の辞書で結果が変わり得るので使わない）。
   ・どこにも区切りが無い長い語（「インタラクティブポジショニングマップ」）が1行に収まらないときは、
     heading.ts の overflow-wrap: anywhere で端で折れる（はみ出しはしない）。 */

const HIRA = /[ぁ-ゖゝゞ]/
const KATA = /[ァ-ヺー-ヾｦ-ﾟ]/
const KANJI = /[㐀-䶿一-鿿豈-﫿々〆]/
const CLOSE = /[、。，．！？!?」』）)】〕・：；]/
const NO_BREAK_BEFORE = /[、。，．！？!?」』）)】〕・：；ーぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ々〻]/
const PARTICLE = /^[のをにでとはがへもやな]$/
const SENTENCE_END = /[、。，．！？!?]/
const LONG_PARTICLES = ['について', 'として', 'における', 'とは']

// 長い語を先に照合する（「ブランディング」を「ブランド」より優先）
const KATAKANA_WORDS = [
  'アイデンティティ', 'アップ', 'インタラクティブ', 'インナー', 'オルファクトリー', 'ガイドライン', 'カスタマー',
  'カラー', 'コンセプト', 'コントラスト', 'ジャーニー', 'ステップ', 'ストーリー', 'スコア', 'スマート',
  'セグメント', 'ダウンロード', 'チェック', 'ツール', 'テスト', 'デザイン', 'パーソナリティ', 'パレット',
  'ビジョン', 'ビルダー', 'ブランディング', 'ブランド', 'プラットフォーム', 'プリズム', 'ペルソナ',
  'ポジショニング', 'ポータル', 'マップ', 'ミッション', 'リリース', 'レビュー', 'ワークショップ', 'サービス',
].sort((a, b) => b.length - a.length)

// カタカナの連なりの中で、辞書の語の境目になる位置（文字列の先頭からの添字）を返す
function katakanaBoundaries(chars: string[]): Set<number> {
  const set = new Set<number>()
  let i = 0
  while (i < chars.length) {
    if (!KATA.test(chars[i])) {
      i++
      continue
    }
    let j = i
    while (j < chars.length && KATA.test(chars[j])) j++
    const run = chars.slice(i, j).join('')
    let k = 0
    let matchedAny = false
    while (k < run.length) {
      const w = KATAKANA_WORDS.find((x) => run.startsWith(x, k))
      if (w) {
        if (k > 0) set.add(i + k)
        k += w.length
        matchedAny = true
        if (k < run.length) set.add(i + k)
      } else {
        k++
      }
    }
    if (!matchedAny) set.delete(i)
    i = j
  }
  return set
}

type Kind = 'hira' | 'kata' | 'kanji' | 'other'
const kindOf = (ch: string): Kind =>
  HIRA.test(ch) ? 'hira' : KATA.test(ch) ? 'kata' : KANJI.test(ch) ? 'kanji' : 'other'

export function segmentJa(text: string): string[] {
  const chars = [...text]
  const kataBreaks = katakanaBoundaries(chars)
  const out: string[] = []
  let cur = ''
  let hiraRun = ''
  let kataRun = 0
  let beforeHira: Kind = 'other'
  chars.forEach((ch, i) => {
    const prev = i > 0 ? chars[i - 1] : null
    if (prev !== null && cur && !NO_BREAK_BEFORE.test(ch) && !/\s/.test(ch)) {
      const p = kindOf(prev)
      const c = kindOf(ch)
      const rest = chars.slice(i).join('')
      const brk =
        SENTENCE_END.test(prev) ||
        (CLOSE.test(prev) && c !== 'hira') ||
        (p === 'hira' && c !== 'hira' && (hiraRun.length >= 2 || PARTICLE.test(hiraRun))) ||
        (p === 'kata' && c === 'kanji') ||
        (p === 'kanji' && c === 'kata') ||
        kataBreaks.has(i) ||
        (p !== 'hira' && c === 'hira' && LONG_PARTICLES.some((w) => rest.startsWith(w))) ||
        (p === 'kata' && c === 'hira' && kataRun >= 6) ||
        (p === 'hira' &&
          c === 'hira' &&
          hiraRun.length === 1 &&
          PARTICLE.test(hiraRun) &&
          (beforeHira === 'kanji' || beforeHira === 'kata') &&
          hiraAhead(chars, i) >= 4)
      if (brk) {
        out.push(cur)
        cur = ''
      }
    }
    cur += ch
    if (kindOf(ch) === 'hira' && hiraRun === '' && prevKind(chars, i)) beforeHira = prevKind(chars, i)!
    hiraRun = kindOf(ch) === 'hira' ? hiraRun + ch : ''
    kataRun = kindOf(ch) === 'kata' ? kataRun + 1 : 0
  })
  if (cur) out.push(cur)
  return out
}

const prevKind = (chars: string[], i: number): Kind | null => (i > 0 ? kindOf(chars[i - 1]) : null)

// i 文字目から続くひらがなの文字数
function hiraAhead(chars: string[], i: number): number {
  let n = 0
  while (i + n < chars.length && kindOf(chars[i + n]) === 'hira') n++
  return n
}

// key は見出しの中で一意にする（子ごとの番号 ci を前に付ける）。
// 付けないと、文字列が2つ以上ある見出しで <wbr key="w1"> が重複し、React が警告を出す
function wrapNode(node: ReactNode, ci: number): ReactNode {
  if (typeof node === 'string') {
    const parts = segmentJa(node)
    if (parts.length < 2) return node
    return parts.flatMap((p, i) => (i === 0 ? [p] : [<wbr key={`${ci}-w${i}`} />, p]))
  }
  if (isValidElement(node) && node.type === 'br') return [<wbr key={`${ci}-wbr`} />, node]
  // <>…</>（Fragment）や <span> などの中の文字列も区切る。自作コンポーネントの中には入らない
  if (isValidElement(node) && (typeof node.type === 'string' || node.type === Fragment)) {
    const el = node as ReactElement<{ children?: ReactNode }>
    if (el.props.children == null) return el
    return cloneElement(el, undefined, ...wrapAll(el.props.children))
  }
  return node
}

function wrapAll(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((c, ci) => {
    const w = wrapNode(c, ci)
    return Array.isArray(w) ? w : [w]
  })
}

export default function JaWrap({ children }: { children: ReactNode }) {
  return <>{wrapAll(children)}</>
}

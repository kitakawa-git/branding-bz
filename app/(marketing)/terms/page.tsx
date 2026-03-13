import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '利用規約',
  description: 'branding.bz の利用規約です。',
}

export default function TermsPage() {
  return (
    <>
      {/* ヒーロー */}
      <section className="px-6 pt-[120px] pb-16 md:pt-[120px] md:pb-24 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Terms of Service
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-snug md:leading-snug">
            利用規約
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            最終更新日：2026年3月10日
          </p>
        </div>
      </section>

      {/* 本文 */}
      <section className="bg-white px-6 pb-16 md:pb-24">
        <div className="prose prose-gray mx-auto max-w-4xl space-y-10 text-sm leading-relaxed text-gray-700">

          <p>
            ID INC.（アイディー株式会社、以下「当社」といいます。）は、当社が運営するブランディング支援プラットフォーム
            <strong>「branding.bz」</strong>（以下「本サービス」といいます。）の利用条件を以下のとおり定め、本規約（以下「本規約」といいます。）として規定します。
            本規約は、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されるものとします。
          </p>

          <Section title="第1条（適用）">
            <Ol>
              <li>本規約は、当社が提供する本サービスの利用条件を定めるものです。</li>
              <li>ユーザーは、本規約に同意のうえ、本サービスを利用するものとします。</li>
            </Ol>
          </Section>

          <Section title="第2条（定義）">
            <p>本規約において使用する以下の用語は、それぞれ以下の意味を有します。</p>
            <Ol>
              <li><strong>「ユーザー」：</strong>本規約を承認し、本サービスを利用する個人または法人。</li>
              <li><strong>「管理者」：</strong>企業・組織を代表して本サービスのアカウントを管理する担当者。</li>
              <li><strong>「アカウント」：</strong>ユーザーが本サービスを利用するために当社が発行する識別情報。</li>
              <li><strong>「コンテンツ」：</strong>本サービス上でユーザーが作成・投稿・表示するブランド情報、テキスト、画像、データ等。</li>
              <li><strong>「ブランドデータ」：</strong>本サービスを通じてユーザーが入力・生成するブランド戦略情報（ミッション、ビジョン、カラーパレット、STP分析結果等）の総称。</li>
            </Ol>
          </Section>

          <Section title="第3条（利用登録）">
            <Ol>
              <li>本サービスの利用を希望する者は、当社が定める方法にて利用登録を申請し、当社がこれを承認することで利用登録が完了します。</li>
              <li>当社は、以下に該当する申請を承認しないことがあります。
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>登録事項に虚偽、誤記または記入漏れがある場合</li>
                  <li>過去に本規約違反等により登録を抹消された者からの申請</li>
                  <li>その他当社が登録を適当でないと判断した場合</li>
                </ul>
              </li>
            </Ol>
          </Section>

          <Section title="第4条（アカウント管理）">
            <Ol>
              <li>ユーザーは、自己の責任においてアカウント情報を適切に管理・保管するものとし、第三者に利用させてはなりません。</li>
              <li>アカウントの不正使用により発生した損害は、ユーザーの責任負担とし、当社は一切責任を負いません。</li>
            </Ol>
          </Section>

          <Section title="第5条（利用料金および支払方法）">
            <Ol>
              <li>本サービスの利用料金は、当社ウェブサイト（<a href="/plan" className="text-blue-600 hover:underline">料金プランページ</a>）に記載のとおりとします。</li>
              <li>ユーザーは、当社が指定する方法（クレジットカード等）により月次で利用料金を支払うものとします。</li>
              <li>支払手数料は原則としてユーザー負担とします。</li>
              <li>支払の遅延が生じた場合、当社は遅延損害金を請求できるものとします。</li>
              <li>無料プランの範囲内での利用は無償とします。有料プランへの変更はユーザーの任意によります。</li>
            </Ol>
          </Section>

          <Section title="第6条（禁止事項）">
            <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <Ol>
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>他のユーザー、第三者、当社の著作権、商標権、プライバシーその他権利を侵害する行為</li>
              <li>本サービスの運営を妨害するリバースエンジニアリング、クローリング等の行為</li>
              <li>虚偽の情報を登録・投稿する行為</li>
              <li>本サービスのAI機能を用いて、差別的・誹謗中傷的・有害なコンテンツを生成する行為</li>
              <li>当社が提供するAI生成物を、当社の許諾なく商業目的で二次販売・配布する行為</li>
              <li>その他当社が不適切と判断する行為</li>
            </Ol>
          </Section>

          <Section title="第7条（知的財産権）">
            <Ol>
              <li>本サービスに関するシステム、デザイン、著作権、商標権、特許権等の知的財産権は当社または正当な権利者に帰属します。</li>
              <li>ユーザーは、本サービスに関連して提供された情報・AIアウトプットを当社の許諾なく複製、転載、改変、公開、再利用してはなりません。</li>
              <li>ユーザーが本サービス上に登録したブランドデータの著作権はユーザーに帰属しますが、当社はサービス改善・品質向上のため非独占的・無償で利用許諾を受けるものとします。</li>
            </Ol>
          </Section>

          <Section title="第8条（AIの利用について）">
            <Ol>
              <li>本サービスは、ブランド戦略の策定支援を目的としてAI技術を活用しています。</li>
              <li>AIが生成するコンテンツはあくまで提案であり、その採用・判断の最終責任はユーザーにあります。</li>
              <li>当社は、AI生成コンテンツの正確性・完全性・適合性について保証しません。</li>
              <li>ユーザーが入力したデータはAIモデルの学習に使用されることはなく、第三者に提供しません（法令上の開示義務がある場合を除く）。</li>
            </Ol>
          </Section>

          <Section title="第9条（機密保持）">
            <p>
              ユーザーおよび当社は、相手方の機密情報を第三者に開示または漏洩してはなりません。ただし、法令または裁判所・行政機関の命令により開示が必要な場合はこの限りではありません。
            </p>
          </Section>

          <Section title="第10条（サービスの提供停止等）">
            <Ol>
              <li>当社は、以下の場合にはユーザーへの事前通知なく、本サービスの全部または一部の提供を一時的に停止または中断することがあります。
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>システムの保守点検・更新を行う場合</li>
                  <li>火災、停電、天災地変などの不可抗力によりサービス提供が困難な場合</li>
                  <li>その他当社が停止または中断が必要と判断した場合</li>
                </ul>
              </li>
              <li>当社は、提供の停止・中断によりユーザーまたは第三者が被った不利益・損害について、一切責任を負いません。</li>
            </Ol>
          </Section>

          <Section title="第11条（利用制限および登録抹消）">
            <p>当社は、ユーザーが以下のいずれかに該当する場合、事前通知なくアカウントの利用制限または登録抹消を行うことができます。</p>
            <Ol>
              <li>本規約に違反した場合</li>
              <li>登録情報に虚偽があることが判明した場合</li>
              <li>支払債務の不履行があった場合</li>
              <li>当社からの問い合わせに対し相当期間回答がない場合</li>
              <li>その他当社が不適切と判断した場合</li>
            </Ol>
          </Section>

          <Section title="第12条（免責事項）">
            <Ol>
              <li>当社は、本サービスがユーザーの目的に適合すること、期待する機能・性能を有することを保証しません。</li>
              <li>当社は、本サービスの利用に起因・関連してユーザーまたは第三者に生じた損害について、一切責任を負いません（当社の故意または重過失による場合を除く）。</li>
              <li>本サービス上で提供される情報（AI生成コンテンツを含む）の正確性・完全性について当社は保証せず、利用はユーザーの責任において行われます。</li>
            </Ol>
          </Section>

          <Section title="第13条（サービス内容の変更等）">
            <p>
              当社は、ユーザーへの事前通知なく本サービスの内容を変更、追加、廃止することができます。変更後も本サービスの利用を継続した場合、ユーザーは変更を承諾したものとみなします。
            </p>
          </Section>

          <Section title="第14条（規約の変更）">
            <Ol>
              <li>当社は、本規約を随時変更できるものとし、変更後の規約は当社ウェブサイトへの掲載日から効力を生じます。</li>
              <li>ユーザーは変更後も本サービスを利用した場合、変更後の規約に同意したものとみなします。</li>
            </Ol>
          </Section>

          <Section title="第15条（準拠法・裁判管轄）">
            <Ol>
              <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
              <li>本サービスに関して紛争が生じた場合、川崎地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
            </Ol>
          </Section>

          <Section title="第16条（お問い合わせ先）">
            <p>本サービスに関するお問い合わせは、以下までご連絡ください。</p>
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-6 space-y-1">
              <p className="font-semibold text-gray-900">ID INC.（アイディー株式会社）</p>
              <p>メール：<a href="mailto:bz@include.bz" className="text-blue-600 hover:underline">bz@include.bz</a></p>
              <p>電話：<a href="tel:0442813088" className="text-blue-600 hover:underline">044-281-3088</a></p>
            </div>
          </Section>

        </div>
      </section>
    </>
  )
}

/* ── 共通コンポーネント ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol className="ml-4 list-decimal space-y-2 marker:text-gray-400">
      {children}
    </ol>
  )
}

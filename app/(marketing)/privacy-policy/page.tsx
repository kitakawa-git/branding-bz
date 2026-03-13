import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description: 'branding.bz のプライバシーポリシーです。',
}

export default function PrivacyPolicyPage() {
  return (
    <>
      {/* ヒーロー */}
      <section className="px-6 pt-[120px] pb-16 md:pt-[120px] md:pb-24 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase mb-4">
            Privacy Policy
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-snug md:leading-snug">
            プライバシーポリシー
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
            最終更新日：2026年3月10日
          </p>
        </div>
      </section>

      {/* 本文 */}
      <section className="bg-white px-6 pb-16 md:pb-24">
        <div className="mx-auto max-w-4xl space-y-10 text-sm leading-relaxed text-gray-700">

          <p>
            ID INC.（アイディー株式会社、以下「当社」といいます。）は、当社が運営するブランディング支援プラットフォーム
            <strong>「branding.bz」</strong>（以下「本サービス」といいます。）におけるユーザーの個人情報の取扱いについて、
            以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
          </p>

          <Section title="第1条（個人情報）">
            <p>
              「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、
              当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報
              および個人識別情報を指します。
            </p>
          </Section>

          <Section title="第2条（個人情報の収集方法）">
            <p>当社は、以下の方法でユーザーの個人情報を収集します。</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>利用登録時に入力される氏名、メールアドレス等の情報</li>
              <li>本サービス利用中に入力・生成されるブランドデータ（ブランド名、理念、カラー情報、STP分析結果等）</li>
              <li>お問い合わせ時にご提供いただく情報</li>
              <li>決済・請求に関する情報（提携決済サービス経由）</li>
              <li>アクセスログ、Cookie等の利用状況データ</li>
            </ul>
          </Section>

          <Section title="第3条（個人情報を収集・利用する目的）">
            <p>当社が個人情報を収集・利用する目的は、以下のとおりです。</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>本サービスの提供・運営・改善のため</li>
              <li>お問い合わせへの対応のため</li>
              <li>新機能・更新情報・重要なお知らせの通知のため</li>
              <li>メンテナンスや障害発生時の連絡のため</li>
              <li>利用規約違反者の特定・利用制限のため</li>
              <li>利用料金の請求・決済処理のため</li>
              <li>本サービスの品質向上および統計・分析のため（個人を特定しない形での集計を含む）</li>
            </ul>
          </Section>

          <Section title="第4条（利用目的の変更）">
            <p>
              当社は、利用目的が変更前と関連性を有すると合理的に認められる場合、個人情報の利用目的を変更することがあります。
              変更後の目的については、ユーザーに通知し、または本ウェブサイト上に公表します。
            </p>
          </Section>

          <Section title="第5条（個人情報の第三者提供）">
            <p>当社は、次の場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供しません。</p>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合</li>
              <li>公衆衛生の向上または児童の健全な育成の推進のために必要がある場合</li>
              <li>国の機関等に協力する必要がある場合</li>
              <li>ユーザーの同意が得られた場合</li>
            </ul>
            <p className="mt-3">
              なお、当社は本サービスの運営においてAI処理・決済・クラウドインフラ等のサービスを提供する委託先に対し、
              必要な範囲で個人情報を提供することがあります。この場合、当社は委託先に対して適切な監督を行います。
            </p>
          </Section>

          <Section title="第6条（AIと個人情報）">
            <Ol>
              <li>本サービスはブランド戦略の策定支援にAI技術を活用していますが、ユーザーが入力したデータをAIモデルの学習に使用することはありません。</li>
              <li>AIへの入力データは、サービス提供のためにのみ処理され、第三者に提供しません（法令上の開示義務がある場合を除く）。</li>
            </Ol>
          </Section>

          <Section title="第7条（個人情報の開示）">
            <p>
              当社は、ユーザーから個人情報の開示を求められたときは、遅滞なくこれを開示します。
              ただし、開示することにより第三者の権利利益を害するおそれがある場合等、法令上開示しないことが認められる場合は、
              その全部または一部を開示しないことがあります。なお、開示には実費に相当する手数料がかかる場合があります。
            </p>
          </Section>

          <Section title="第8条（個人情報の訂正および削除）">
            <p>
              ユーザーは、自己の個人情報が誤っている場合、当社に対して訂正、追加または削除を請求することができます。
              当社は、請求に応じる必要があると判断した場合、遅滞なく訂正等を行い、ユーザーに通知します。
            </p>
          </Section>

          <Section title="第9条（個人情報の利用停止等）">
            <p>
              ユーザーは、個人情報が利用目的の範囲を超えて取り扱われている場合、または不正な手段により取得された場合、
              利用の停止または消去を請求することができます。当社は、調査のうえ必要な対応を行い、その結果をユーザーに通知します。
            </p>
          </Section>

          <Section title="第10条（Cookieおよびアクセス解析）">
            <Ol>
              <li>本サービスは、ユーザー体験の向上およびサービス改善を目的として、CookieやアクセスログによるGoogle Analytics等の解析ツールを使用することがあります。</li>
              <li>収集されるデータは匿名化され、個人を特定するものではありません。</li>
              <li>ブラウザの設定によりCookieを無効にすることができますが、一部の機能が利用できなくなる場合があります。</li>
            </Ol>
          </Section>

          <Section title="第11条（プライバシーポリシーの変更）">
            <p>
              本ポリシーは、法令の改正やサービス内容の変更に応じて、ユーザーへの事前通知なく変更されることがあります。
              変更後のプライバシーポリシーは、本ウェブサイトに掲載されたときから効力を生じます。
              重要な変更がある場合は、メール等によりユーザーに通知します。
            </p>
          </Section>

          <Section title="第12条（お問い合わせ窓口）">
            <p>本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。</p>
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

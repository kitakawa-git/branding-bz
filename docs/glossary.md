# 用語・略語集 ── branding.bz

> `CLAUDE.md` から `@docs/glossary.md` で読み込まれる。
> チーム内の略語・社内用語をここに集約し、Claudeと人の理解を揃える。

| 用語 / 略語 | 意味 | 補足 |
|------------|------|------|
| 4レイヤー構造 | 構築→浸透→計測。発信が、その全部を貫く | 構築=AI構築ツール群、浸透=本体SaaS、計測=ブランドスコア、発信=スマート名刺。旧称「3レイヤー構造」は使わない |
| 構築 | 理念・コピー・カラー・ペルソナをAIで策定するAI構築ツール群 | 無料〜フリーミアム |
| 浸透 | branding.bz本体。ブランド掲示・Good Action投稿・KPI・学習 | 月額サブスク |
| 発信 | スマート名刺。QRから個人＋企業ブランドの簡易ページ表示 |  |
| ブランドスコア | ブランド理解度・浸透度の指標。インナー=Premium／統合（インナー×アウター）=Enterprise | 表記は「ブランドスコア」。Brand Score とは書かない |
| Good Action | 社内のブランド体現を称賛し合う投稿機能 | 旧称 Good Job（2026-08-15 に改称）。新しい表記に出さない |
| RLS | Row Level Security（Supabaseの行単位アクセス制御） | 本番前にポリシー精緻化が課題 |
| デモ企業 | 検証用固定企業（株式会社テックブリッジ / `128a1513`） | プレビュー検証はこの範囲で行う |

## 外部サービス・環境

| 名称 | 用途 | URL / ID |
|------|------|----------|
| Supabase | DB / 認証 | project id: wfabdmfgngjtihhlrrpk |
| Vercel | デプロイ（本番） | https://branding.bz |
| Stripe | 決済（未連携） |  |

---

## プラン・機能名の正準表記

**正は `app/(site)/plan/page.tsx`（料金ページ）。** 迷ったらこの表ではなく料金ページの実物を見る。
料金ページを直したら、この表と下の「反映先」も同時に直す。

### プラン名

| 正準表記 | 内部値（`Plan`） | 表記ゆれ（使わない） |
|---|---|---|
| Free | `free` | フリー / 無料プラン |
| Standard | `standard` | Brand Standard / スタンダード |
| Premium | `premium` | Brand Premium / プレミアム |
| Enterprise | `enterprise` | Brand Enterprise / エンプラ |
| （Brand Card） | `card` | **販売終了。** 新規表記に出さない。既存契約の互換のため型のみ温存 |

価格表記は `¥0` / `¥19,800` / `¥59,800` / `個別見積`。

### 機能名

| 正準表記 | `FeatureKey` | 提供プラン | 表記ゆれ（使わない） |
|---|---|---|---|
| AI構築ツール | `buildTools` | Free（各 月3回）／Standard 以上は無制限 | ミニアプリ / AIブランディングツール / ブランド構築ツール |
| STP分析ツール | – | Free 以上 | STP分析 |
| ブランドカラー定義ツール | – | Free 以上 | ブランドカラー定義 / カラーツール |
| ペルソナビルダーツール | – | Free 以上 | ペルソナビルダー |
| パーソナリティ診断ツール | – | Free 以上 | パーソナリティ診断 / ブランドパーソナリティ診断 |
| CIマニュアル出力 | `ciManual` | Standard 以上 | CIマニュアルPDF |
| ブランド掲示 | `brandGuidelinesEdit` ほか | Free 以上（編集＋閲覧） | ブランドガイドライン / ブランドページ |
| Good Action投稿 | `timeline` | Standard 以上 | Good Job（旧称） / Good Actionタイムライン（旧称） / タイムライン投稿 |
| Good Action分析 | – | Standard 以上 | 管理画面ダッシュボードのタブ名。Good Job投稿分析（旧称） |
| お知らせ配信＋Web Push | `announcements` | Standard 以上 | お知らせ / 通知機能 |
| スマート名刺 | `smartCard` | Standard 以上 | デジタル名刺 / Web名刺 |
| ビデオラーニング | `videoLearning` | Premium 以上 | 動画学習 / ラーニング動画 |
| ブランド理解度テスト | `brandQuiz` | Premium 以上 | クイズ / 理解度チェック |
| 目標・KPI管理 | `kpi` | Premium 以上 | 個人目標と KPI / KPI・目標管理（旧称） / KPI管理 |
| インナースコア＋推移 | `brandScoreInner` | Premium 以上 | ブランドスコア（簡易版）（旧称・v4 で廃止） / インナー計測 |
| インナーサーベイ＋AI設問生成 | `innerSurvey` | **Premium 以上**（v4 で Enterprise から移動） | 社員サーベイ / インナー調査 |
| 統合ブランドスコア（インナー×アウター） | `brandScoreIntegrated` | Enterprise | ブランドスコア完全版 / 統合スコア / `brandScoreFull`（旧識別子） |
| 市場調査を含むアウタースコア | `brandScoreIntegrated` に含む | Enterprise | アウター表示 / 外の目線 |
| 理解度×共感ギャップ分析 | `brandScoreInner` に含む | **Premium 以上**（v4 で Enterprise から移動） | ギャップ分析 / 差分分析 |
| 市場調査手配 | `brandScoreFull` で表示 | Enterprise | 市場調査（アプリ内画面名としてはこの短縮形を使う） |
| クリエイティブサポート | – | Enterprise | 制作支援 |
| ID INC. による四半期レビュー | – | Enterprise | 定例レビュー |
| ブランド研修・ワークショップ | – | Enterprise | 研修 |

### 廃止した表記

- **部署別ヒートマップ** … 機能ごと削除済み（commit `48283cd`）。公開ページに書かない。
- **ミニアプリ** … 「構築ツール」に統一。
- **ブランドスコア（簡易版）** … v4（2026-08-16）で計測の split を入れ替えたため廃止。Premium で見えるのは「インナースコア＋推移」。
- **スコア推移の自動記録** … Enterprise 限定の項目としては廃止。インナーの推移は Premium に含まれ、総合の推移が Enterprise。

### アプリ内サイドメニューの短縮形

サイドメニューは幅の制約があるため、以下の短縮形を許容する。**これ以外の短縮はしない。**

| 正準表記 | サイドメニュー |
|---|---|
| Good Action投稿 | タイムライン（ポータル） |
| 目標・KPI管理 | 目標・KPI |
| お知らせ配信＋Web Push | お知らせ |
| ビデオラーニング | ラーニング |
| インナーサーベイ | サーベイ（管理画面）／サーベイ結果（ポータルの結果閲覧画面） |
| 市場調査手配 | 市場調査 |

### 反映先（表記を変えたら全部見る）

- `app/(site)/plan/page.tsx` … **正**
- `app/(site)/features/page.tsx`
- `app/(site)/faq/page.tsx`
- `components/lp/tools.ts` … 構築ツールのカード名
- `app/tools/{stp,colors,persona,personality}/page.tsx` … 各ツールLPの h1・構造化データ
- `app/portal/components/PortalSidebar.tsx` … サイドメニュー短縮形
- `<PlanUpsell title=...>` を持つ各ページ … アップセル面の見出し
- `lib/billing/entitlements.ts` … `FeatureKey` と提供プランの実体（表と食い違ったら**実装が正**）

## 制限値の実態（誇大表記を避けるための注記）

| 制限 | 実態 | 注意 |
|---|---|---|
| AI構築ツール 月3回 | Free のみ。`getBuildToolMonthlyLimit`（`lib/billing/entitlements.ts`）で判定 | Standard 以上は無制限 |
| チャット5ターン | **ブランドカラー定義ツールの調整チャットのみ**。1セッションあたり5ターン。`FREE_LIMITS.chatTurnsPerSession`（`lib/types/color-tool.ts`）／サーバ側は `app/api/tools/colors/chat/route.ts` で 429 | **プランによらず全プラン共通**。STP・ペルソナ・パーソナリティには存在しない。「各ツール5ターンまで」は誤り |
| パーソナリティ診断の月次上限 | `PERSONALITY_DIAGNOSIS_MONTHLY_LIMIT` | 上記の月3回とは別系統 |

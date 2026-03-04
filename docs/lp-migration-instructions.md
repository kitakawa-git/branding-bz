# brandconnect LP移行指示書

## 概要

旧brandcommitのWordPressサービスサイトを、brandconnectリポ（Next.js）に統合する。
SiteSuckerで書き出した既存HTMLデータをベースに、デザインを継承しつつ Tailwind + shadcn/ui で再構築する。

## 参照データ

### 既存LPデータ（SiteSucker書き出し）
```
/Users/kitakawa/Documents/Claude/us.sitesuck...ac.sitesucker/bc/
```
※ フォルダ名に「...」が含まれる可能性あり。`ls` で正確なパス確認すること。

主要ファイル：
- `index.html` — トップページ
- `plan/` — 料金ページ
- `faq/` — よくある質問（存在すれば）
- `contact/` — お問い合わせ
- `wp-content/` — 画像・CSS等のアセット

### brandconnectリポ
```
/Users/kitakawa/Documents/Claude/branding-bz/
```

## 作業手順

### Step 1: 既存データ解析

1. SiteSuckerフォルダの正確なパスを `ls` で確認
2. `index.html` を読んでセクション構成を把握
3. `plan/`、`contact/` の内容を確認
4. `wp-content/` から使用画像を特定
5. CSSからカラー、フォント、余白のパターンを抽出

**このステップ完了後、セクション分解と実装プランを提示して承認を得ること。**

### Step 2: Route Group作成

```
app/
├── (marketing)/           # 新規追加（認証不要のLPグループ）
│   ├── layout.tsx         # LP専用レイアウト（ヘッダー/フッター）
│   ├── page.tsx           # トップ（/）
│   ├── plan/
│   │   └── page.tsx       # 料金（/plan）
│   ├── faq/
│   │   └── page.tsx       # FAQ（/faq）
│   └── contact/
│       └── page.tsx       # お問い合わせ（/contact）
├── admin/                 # 既存 — 触らない
├── portal/                # 既存 — 触らない
├── card/[slug]/           # 既存 — 触らない
├── tools/                 # 既存 — 触らない
...
```

**重要：既存のルート（admin, portal, card, tools, api, superadmin, signup, login）には一切影響を与えないこと。**

### Step 3: LP専用レイアウト

`(marketing)/layout.tsx` に以下を実装：
- **ヘッダー：** ロゴ + ナビゲーション（トップ / 料金 / FAQ / お問い合わせ / ログイン）
- **フッター：** 会社情報、リンク、コピーライト
- **モバイルメニュー：** ハンバーガーメニュー
- admin/portalのレイアウトとは完全に独立

### Step 4: 各ページ実装

#### トップページ（/）
既存LPのデザイン・レイアウトを忠実に再現しつつ、コンテンツをbrandconnect版に刷新。全5セクション構成。

**セクション1: Hero**
- デザイン：旧LPのレイアウト・アニメーションを再現
- コピー：brandconnect用に新規作成（Claude Codeが提案）
  - 旧：「ブランドを"ドリブン"させる 業界初のコミットアプリ」
  - 新：brandconnectの「構築→浸透→発信」の世界観を反映したコピーに
  - サブコピー「"らしさ"をひろげよう」は継承可
- ロゴ：brandconnect のロゴに差し替え（なければテキストロゴで仮置き）

**セクション2: 3つの柱 → 3レイヤー**
- デザイン：旧LPの3カラム構成を再現
- コンテンツ：3レイヤー構造に変更
  - 旧：わかる（学習）→ つながる（Good Job）→ ひろげる（ダッシュボード）
  - 新：構築（ミニアプリ群）→ 浸透（brandconnect本体）→ 発信（スマート名刺）
  - 各レイヤーの説明文はClaude Codeが作成

**セクション3: About + YouTube動画**
- デザイン：旧LPのレイアウトを再現
- 動画：旧YouTubeのembed URLをそのまま使用
- 説明テキスト：brandconnectとしてリフレッシュ（「ノーコードでブランド構築〜運用」の方向性は維持しつつ、3レイヤー構造に言及）

**セクション4: 機能紹介**
- デザイン：旧LPのGIF付きカード形式を再現
- コンテンツ：brandconnectの実装済み機能をベースに書き換え
  - 主要機能例：ブランド掲示（方針/戦略/ビジュアル/バーバル）、Good Jobタイムライン、ダッシュボード・効果計測、個人目標KPI、お知らせ、スマート名刺、プロフィール管理 等
  - 機能数は実装状況に合わせて調整（旧9→増減OK）
- GIF/画像：旧アセットをそのまま使用（UIが旧版でも暫定的に許容）

**セクション5: CTA**（旧セクション6）
- デザイン：旧LPを再現
- コピー：「さぁ、"らしさ"をひろげよう」+ βテスター募集（残り2社限定）をそのまま維持
- brandcommit → brandconnect に名称のみ置換

※ 旧セクション5（新着ニュース）は削除。5セクション構成とする。
※ テキスト内の「brandcommit」はすべて「brandconnect」に置換

#### 料金ページ（/plan）
既存の構成を再現：
- 3プラン比較（Starter ¥7,800/月・20名、Growth ¥64,800/月・200名、Enterprise ASK）
- オプション（初期設定 ¥30,000等）
- 3ステップ導入フロー
- 無料トライアルCTA

#### FAQページ（/faq）
- アコーディオン形式（shadcn/ui の Accordion コンポーネント使用）
- カテゴリ分類（あれば）

#### お問い合わせ（/contact）
- フォーム項目：会社名、担当者名、メール、電話（任意）、お問い合わせ内容
- バリデーション（zod + react-hook-form）
- 送信先：Supabaseの `contact_inquiries` テーブルに保存
- 送信後：サンキューメッセージ表示
- **メール通知は後日実装で可（まずDB保存のみでOK）**

### Step 5: デザイン方針

#### 基本方針：旧デザインをほぼ忠実に再現

既存LPのデザインをできる限り忠実にTailwind + shadcn/uiで再現する。
「構成の継承」ではなく「見た目の再現」が目標。

#### デザイン仕様（既存LPから抽出済み）

| 項目 | 値 |
|------|-----|
| メインカラー | `#6bcdcf`（ティール） |
| サブカラー | `#ff6900`（オレンジ）、`#f6405f`（レッドピンク） |
| 背景色 | `#ffffff`, `#f9f9f9`, `#f5f5f5` |
| テキスト | `#666666`, `#5a5a5a` |
| 欧文フォント | Comfortaa（見出し）、Open Sans（本文） |
| 和文フォント | Noto Sans JP |
| ヘッダー | sticky + backdrop-filter: blur(10px) |

- これらカラー・フォントをtailwind.config.tsに追加（既存設定と競合しないよう注意）
- Comfortaa / Open Sans は Google Fonts CDN で読み込み

#### コンテンツ仕様

- **料金：** 旧サイトの金額をそのまま使用（Starter ¥7,800/月、Growth ¥64,800/月、Enterprise ASK）
- **CTA：** 「βテスター募集・残り2社限定」のコピーをそのまま維持
- **ロゴ：** brandcommit → brandconnect に差し替え（ロゴSVGがあれば使用、なければテキストロゴで仮置き）
- **サービス名：** 旧テキスト内の「brandcommit」は「brandconnect」に置換

#### 再現のポイント

- セクション構成・順序を既存HTMLと同じにする
- 余白・フォントサイズ・カラーリングを既存CSSから読み取って再現
- 画像・GIF・アイコンは既存アセットを `public/marketing/` に移植して使用
- レスポンシブ対応は既存の挙動を踏襲しつつ、Tailwindで改善

#### 注意
- 既存のtailwind.config.tsの設定を確認し、LP用カラーが既存アプリと競合しないよう `marketing-` プレフィックス等で管理
- shadcn/uiコンポーネントは既にcomponents/ui/に21個導入済み。追加が必要なら `npx shadcn@latest add` で追加
- LP用の共通コンポーネント（SectionHeader, CTAButton等）は `app/(marketing)/components/` に配置

## DB変更（必要に応じて）

お問い合わせフォーム用テーブル：

```sql
CREATE TABLE contact_inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLSは不要（公開フォームのため）、ただしINSERTのみ許可
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit inquiry"
  ON contact_inquiries FOR INSERT
  WITH CHECK (true);

-- 管理者のみ閲覧可能
CREATE POLICY "Only super admins can view inquiries"
  ON contact_inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
```

## 完了条件

- [ ] 4ページ（トップ / 料金 / FAQ / お問い合わせ）が表示される
- [ ] LP専用レイアウト（ヘッダー/フッター）が動作する
- [ ] レスポンシブ対応（モバイル/タブレット/デスクトップ）
- [ ] お問い合わせフォームがSupabaseにデータ保存できる
- [ ] 既存ルート（admin, portal等）に影響がない
- [ ] 既存LPのデザインの意図が継承されている

## 作業の進め方

**まずStep 1（既存データ解析）を実行し、セクション分解と実装プランを提示してください。**
承認後にStep 2以降に進むこと。

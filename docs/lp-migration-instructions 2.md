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
既存index.htmlのセクション構成を継承しつつ、Tailwind + shadcn/ui で再構築。
- ヒーローセクション
- サービス概要（3レイヤー構造の説明）
- 機能紹介
- 料金概要（/plan への導線）
- CTA（無料トライアル / お問い合わせ）
- 必要な画像は `public/marketing/` に配置

#### 料金ページ（/plan）
- 料金プラン比較テーブル
- FAQ的な補足（あれば）
- CTAボタン

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

#### 継承するもの
- 既存LPのセクション構成・情報の流れ
- ブランドカラー（tailwind.configの既存設定を確認して活用）
- 全体のトーン＆マナー

#### アップグレードするもの
- Tailwind + shadcn/ui のコンポーネントベースに置換
- レスポンシブ対応の強化（モバイルファースト）
- アニメーション追加（Framer Motion または CSS transition）
- ページ間遷移の滑らかさ

#### 注意
- 既存のtailwind.config.tsの設定（カラー、フォント等）を確認し活用する
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

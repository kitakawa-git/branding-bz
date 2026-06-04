# branding.bz 機能要件定義書

**バージョン:** v0.8.0
**最終更新:** 2026-03-09
**ステータス:** Phase 1 実装中

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック](#2-技術スタック)
3. [アーキテクチャ](#3-アーキテクチャ)
4. [DB構造](#4-db構造)
5. [実装済み機能一覧](#5-実装済み機能一覧)
6. [共通コンポーネント](#6-共通コンポーネント)
7. [ツール: ブランドカラー定義](#7-ツール-ブランドカラー定義)
8. [ツール: STP分析](#8-ツール-stp分析)
9. [基本情報共通化](#9-基本情報共通化)
10. [デザインシステム](#10-デザインシステム)
11. [API一覧](#11-api一覧)
12. [ブランドスコア](#12-ブランドスコア)
13. [変更履歴](#13-変更履歴)

---

## 1. プロジェクト概要

中小企業のブランドを「構築 → 浸透 → 発信」まで一貫支援するSaaS。

**運営:** ID INC.（川崎市、CEO：北川巧）
**本番URL:** https://branding.bz

### 3レイヤー構造

| レイヤー | 機能 | 課金 |
|---------|------|------|
| 構築（ミニアプリ群） | カラー定義・STP分析・理念・コピー・ペルソナをAIで策定 | 無料〜フリーミアム |
| 浸透（本体） | ブランド掲示・Good Jobタイムライン・KPI・学習 | 月額サブスク |
| 発信（スマート名刺） | QRコードから個人プロフィール＋企業ブランドページ表示 | 本体に含む |

### 開発フェーズ

- Phase 0: スマート名刺プロトタイプ — **完了**
- Phase 1: ブランド掲示＋スマート名刺＋ミニアプリ群 — **実装中**
- Phase 2: Good Jobタイムライン、ダッシュボード
- Phase 3: 決済・本格運用

---

## 2. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router) + TypeScript |
| ホスティング | Vercel（自動デプロイ） |
| バックエンド/DB | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI | Claude API (`@anthropic-ai/sdk`) |
| PDF生成 | `@react-pdf/renderer` |
| UIコンポーネント | shadcn/ui + Radix UI |
| アイコン | lucide-react |
| カラーピッカー | react-colorful |
| QRコード | qrcode |
| トースト | sonner |
| DnD | @dnd-kit |

---

## 3. アーキテクチャ

### ルーティング構造

```
app/
├── (marketing)/          # 公開マーケティングページ（共通Header/Footer）
│   ├── page.tsx          # トップLP
│   ├── plan/             # 料金プラン
│   ├── faq/              # よくある質問
│   └── contact/          # お問い合わせ
├── card/[slug]/          # スマート名刺（公開）
├── signup/               # 企業サインアップ
├── portal/               # メンバーポータル（認証必須）
│   ├── login/
│   ├── register/
│   ├── timeline/         # Good Jobタイムライン
│   ├── kpi/              # KPI
│   ├── profile/          # プロフィール編集
│   ├── strategy/         # ブランド戦略（読取専用）
│   ├── guidelines/       # ブランドガイドライン（読取専用）
│   ├── verbal/           # バーバルID（読取専用）
│   ├── visuals/          # ビジュアルID（読取専用）
│   ├── values/           # ブランドバリュー
│   ├── terms/            # ブランド用語
│   ├── card-preview/     # 名刺プレビュー
│   ├── quiz/[id]/        # 理解度テスト受験
│   │   └── result/       # 本人結果（スコア・解説＝学習）
│   └── announcements/    # お知らせ
├── admin/                # 管理画面（認証必須）
│   ├── login/
│   ├── dashboard/
│   ├── company/          # ブランド基本情報
│   ├── members/          # メンバー管理（CRUD）
│   ├── kpi/              # KPI管理
│   ├── card-template/    # QRコード出力
│   ├── announcements/    # お知らせ管理（CRUD）
│   ├── analytics/        # 名刺閲覧解析
│   ├── ci-manual/        # CIマニュアルPDF出力
│   ├── brand-score/      # ブランドスコア（インナー/アウター統合・ギャップ分析）
│   │   └── quizzes/      # 理解度テスト（一覧・作成）
│   │       └── [id]/             # 設問エディタ・配信
│   │           ├── results/      # k匿名集計
│   │           └── participants/ # 受験状況
│   └── brand/
│       ├── guidelines/   # ブランド方針
│       ├── strategy/     # ブランド戦略
│       ├── visuals/      # ビジュアルID
│       ├── verbal/       # バーバルID
│       ├── values/       # バリュー
│       └── terms/        # 用語
├── superadmin/           # スーパー管理画面
│   └── companies/        # 企業管理（CRUD）
└── tools/                # ミニアプリ群
    ├── colors/           # ブランドカラー定義ツール
    │   ├── page.tsx      # LP
    │   ├── auth/         # 認証
    │   └── app/          # アプリ本体（5ステップ）
    └── stp/              # STP分析ツール
        ├── page.tsx      # LP
        ├── auth/         # 認証
        └── app/          # アプリ本体（5ステップ）
```

### 認証

- Supabase Auth（メール/パスワード）
- `admin_users` テーブルで `company_id` と `role` を管理
- `is_superadmin=true` でスーパー管理画面アクセス可能
- ツールは `ToolsAuthProvider` / `STPAuthProvider` で独立認証
- supabaseクライアントの auth 設定に `lock: false` 必須（LockManager タイムアウト回避）

### Storage

| バケット | 用途 | ポリシー |
|---------|------|---------|
| avatars | プロフィール写真 | 認証ユーザーがアップロード・更新可、誰でも閲覧可 |
| logos | 企業ロゴ | 同上 |

### RLS

全テーブルRLS無効（プロトタイプ段階。本番前に要設定）

---

## 4. DB構造

### companies

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| name | text | 企業名 |
| logo_url | text | ロゴURL |
| slogan | text | スローガン |
| mvv | text | MVV |
| brand_color_primary | text | プライマリカラー(HEX) |
| brand_color_secondary | text | セカンダリカラー(HEX) |
| website_url | text | WebサイトURL |
| brand_story | text | ブランドストーリー |
| provided_values | text[] | 提供価値（PostgreSQL配列） |
| industry_category | text | 業種大分類 |
| industry_subcategory | text | 業種中分類 |
| brand_stage | text | ブランドステージ（新規/リブランド） |
| competitors | jsonb | 競合情報 `[{name, url, colors[], notes}]` |
| target_segments | jsonb | ターゲットセグメント `[{name, description}]` |
| created_at | timestamptz | |

### profiles

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| company_id | uuid (FK→companies) | |
| name | text | 氏名 |
| title | text | 役職 |
| department | text | 部署 |
| bio | text | 自己紹介 |
| email | text | |
| phone | text | |
| slug | text (unique) | 名刺URL用スラッグ |
| photo_url | text | |
| sns_x, sns_linkedin, sns_facebook, sns_instagram | text | SNSリンク |
| created_at | timestamptz | |

### admin_users

| カラム | 型 | 説明 |
|--------|------|------|
| auth_id | uuid | Supabase Auth UID |
| company_id | uuid (FK) | |
| role | text | admin等 |
| is_superadmin | boolean | スーパー管理者フラグ |

### mini_app_sessions

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| user_id | uuid | |
| app_type | text | `colors` / `stp` |
| status | text | `in_progress` / `completed` |
| current_step | int | 現在のステップ番号 |
| company_id | uuid | |
| metadata | jsonb | ステップごとのデータ全体 |
| started_at / completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### card_views

| カラム | 型 | 説明 |
|--------|------|------|
| profile_id | uuid (FK) | |
| viewed_at | timestamptz | |
| ip_address, user_agent, referer | text | アクセス情報 |
| country, city | text | ジオロケーション |

### brand_guidelines

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| business_content | jsonb | 事業内容 `[{title, description, added_index}]` |

### brand_personas

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| name | text | ペルソナ名 |
| sort_order | int | |
| target | text | ターゲット説明 |
| segmentation_data | jsonb | セグメンテーション結果 |
| positioning_map_data | jsonb | ポジショニングマップ |

### brand_visuals

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| company_id | uuid (FK) | |
| color_palette | jsonb | `{brand_colors[], secondary_colors[], accent_colors[], utility_colors[]}` |

### ブランド理解度テスト（4テーブル）

サーベイの匿名回答テーブルとは混ぜず、専用4テーブルで分離（記名式＝`profile_id` を持つため）。

| テーブル | 主なカラム |
|---|---|
| `brand_quizzes` | company_id / title / status(draft/active/closed/archived) / starts_at / ends_at / total_members / pass_threshold(既定80) / randomize_questions |
| `brand_quiz_questions` | quiz_id / category(why/how) / question_text / question_type(single_choice/true_false) / options(jsonb) / correct_option_id / explanation / source(template/ai_generated/custom) / sort_order / is_active |
| `brand_quiz_attempts` | quiz_id / **profile_id（記名）** / company_id / department / role_category / score / why_score / how_score / passed / total_questions / correct_count / **unique(quiz_id, profile_id)** |
| `brand_quiz_answers` | attempt_id / question_id / selected_option_id / is_correct |

### マイグレーション

| ファイル | 内容 |
|---------|------|
| `supabase/migrations/20260307010338_add_target_segments_to_companies.sql` | `target_segments JSONB DEFAULT '[]'` を `companies` に追加 |
| `supabase/migrations/20260603000000_create_brand_quiz_tables.sql` | ブランド理解度テスト4テーブル（quizzes/questions/attempts/answers）新設。本番適用済み・RLS `auth_all` |

---

## 5. 実装済み機能一覧

### 公開ページ (marketing)

| 機能 | ルート | 状態 |
|------|--------|------|
| トップLP | `/` | 完了 |
| 料金プラン | `/plan` | 完了 |
| よくある質問 | `/faq` | 完了 |
| お問い合わせフォーム | `/contact` | 完了 |

### スマート名刺

| 機能 | ルート | 状態 |
|------|--------|------|
| 名刺公開ページ | `/card/[slug]` | 完了 |
| vCardダウンロード | 同上 | 完了 |
| 閲覧トラッキング | API経由 | 完了 |

### メンバーポータル

| 機能 | ルート | 状態 |
|------|--------|------|
| ログイン/セルフ登録 | `/portal/login`, `/portal/register` | 完了 |
| ポータルホーム | `/portal` | 完了 |
| ブランド戦略/方針/ビジュアル/バーバル閲覧 | `/portal/strategy` 等 | 完了 |
| バリュー/用語 | `/portal/values`, `/portal/terms` | 完了 |
| Good Jobタイムライン | `/portal/timeline` | 完了 |
| KPIトラッキング | `/portal/kpi` | 完了 |
| プロフィール編集 | `/portal/profile` | 完了 |
| 名刺プレビュー | `/portal/card-preview` | 完了 |
| 理解度テスト受験＋本人結果 | `/portal/quiz/[id]` | 完了 |
| お知らせ | `/portal/announcements` | 完了 |

### 管理画面

| 機能 | ルート | 状態 |
|------|--------|------|
| ダッシュボード | `/admin/dashboard` | 完了 |
| ブランド基本情報（業種・MVV・競合・セグメント） | `/admin/company` | 完了 |
| メンバー管理（CRUD） | `/admin/members` | 完了 |
| KPI管理 | `/admin/kpi` | 完了 |
| QRコード一括出力 | `/admin/card-template` | 完了 |
| お知らせ管理（CRUD） | `/admin/announcements` | 完了 |
| 名刺閲覧解析 | `/admin/analytics` | 完了 |
| ブランド方針 | `/admin/brand/guidelines` | 完了 |
| ブランド戦略 | `/admin/brand/strategy` | 完了 |
| ビジュアルID（カラー・ロゴ・フォント） | `/admin/brand/visuals` | 完了 |
| バーバルID | `/admin/brand/verbal` | 完了 |
| バリュー | `/admin/brand/values` | 完了 |
| 用語 | `/admin/brand/terms` | 完了 |
| CIマニュアルPDF出力 | `/admin/ci-manual` | 完了 |
| 理解度テスト（作成・AI設問生成・配信・k匿名集計・受験状況） | `/admin/brand-score/quizzes` | 完了 |

### スーパー管理画面

| 機能 | ルート | 状態 |
|------|--------|------|
| 企業一覧/作成/編集 | `/superadmin/companies` | 完了 |

### ツール: ブランドカラー定義

| 機能 | 状態 |
|------|------|
| LP | 完了 |
| 認証（メール/パスワード） | 完了 |
| セッション管理 | 完了 |
| Step 1〜5（全ステップ） | 完了 |
| AI パレット生成（Claude API） | 完了 |
| AI チャットリファインメント（JSON非表示） | 完了 |
| PDF出力 | 完了 |
| branding.bz 本体連携 | 完了 |

### ツール: STP分析

| 機能 | 状態 |
|------|------|
| LP | 完了 |
| 認証（メール/パスワード） | 完了 |
| セッション管理 | 完了 |
| Step 1〜5（全ステップ） | 完了 |
| AI セグメンテーション提案（Claude API） | 完了 |
| AI ターゲティング深掘り提案（Claude API） | 完了 |
| AI ポジショニング軸提案（Claude API） | 完了 |
| ポジショニングマップ（SVGインタラクティブ） | 完了 |
| PDF出力 | 完了 |
| branding.bz 本体連携 | 完了 |

---

## 6. 共通コンポーネント

### クロスツール共通 (`components/shared/`)

#### StepProgressBar

- **ファイル:** `components/shared/StepProgressBar.tsx`
- **Props:** `steps: Array<{ label: string }>`, `currentStep: number`, `className?: string`
- **説明:** ステップ進行インジケーター。番号付き丸（完了済みはチェックマーク）＋青プログレスライン。ラベルは丸の下に表示
- **利用箇所:** カラーツール全ステップ, STPツール全ステップ

#### IndustrySelect

- **ファイル:** `components/shared/IndustrySelect.tsx`
- **Props:** `category: string`, `subcategory: string`, `onCategoryChange: (value: string) => void`, `onSubcategoryChange: (value: string) => void`, `disabled?: boolean`
- **説明:** 2段階業種セレクター。9大分類（IT, 製造, サービス, 小売, 医療, 金融, クリエイティブ, 建設, その他）×各5-6中分類。「その他」選択時はフリーテキスト入力。2カラムグリッドレイアウト
- **利用箇所:** カラーツール Step1, STPツール Step1, 管理画面 company
- **定数:** `lib/constants/industries.ts` の `INDUSTRY_CATEGORIES`

#### TitleDescriptionList

- **ファイル:** `components/shared/TitleDescriptionList.tsx`
- **Props:** `label: string`, `items: Array<{ title: string; description: string }>`, `onChange: (items: ...) => void`, `addButtonLabel: string`, `titlePlaceholder?: string`, `descriptionPlaceholder?: string`, `required?: boolean`, `maxItems?: number` (default: 10), `disabled?: boolean`, `error?: string`
- **説明:** タイトル＋説明文の動的リスト。追加/削除ボタン付き（1件のみの場合は削除ボタン非表示）。`AutoResizeTextarea` を使用
- **利用箇所:** STPツール Step1（事業内容, ターゲット）, 管理画面 company

### グローバル共通 (`components/`)

#### PositioningMap

- **ファイル:** `components/PositioningMap.tsx`
- **型:** `lib/types/positioning-map.ts`
- **Props:** `data: PositioningMapData`, `className?: string`
- **PositioningMapData 型:**
  ```ts
  {
    x_axis: { left: string; right: string }
    y_axis: { bottom: string; top: string }
    items: Array<{
      name: string; color: string;
      x: number; y: number;  // 0〜100
      size: 'sm' | 'md' | 'lg' | 'custom';
      customSize?: number
    }>
  }
  ```
- **説明:** SVGベースのポジショニングマップ（700×525 viewBox）。XY軸＋10単位目盛＋軸ラベル＋カラードット（塗り＋白ストローク）。アイテム名はドット下に表示
- **利用箇所:** STPツール Step4（編集＋プレビュー）, Step5（結果表示）, PDF出力

#### AutoResizeTextarea

- **ファイル:** `components/ui/auto-resize-textarea.tsx`
- **型:** `React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>`
- **説明:** 内容に応じて高さが自動拡張するテキストエリア。`scrollHeight` で高さ計算
- **利用箇所:** TitleDescriptionList, STPツール Step3（自社の強み, 競合分析）, 管理画面各所

#### Footer

- **ファイル:** `components/Footer.tsx`
- **説明:** マーケティングページ＋ツールLPの共通フッター
- **利用箇所:** marketing layout, カラーツールLP, STPツールLP

### カラーツール固有 (`app/tools/colors/app/components/`)

| コンポーネント | ファイル | 説明 |
|--------------|---------|------|
| **PaletteCard** | `PaletteCard.tsx` | パレット提案カード。カラーバー(`h-20`)＋名前＋コンセプト＋カラーグリッド（`h-10 w-10`スウォッチ、ラベル/色名/HEX/RGB表示）＋提案理由＋プレビュー＋AA準拠バッジ＋選択ボタン |
| **PalettePreview** | `PalettePreview.tsx` | 3タブプレビュー（名刺/Webヘッダー/ロゴ）。SVGモック |
| **AccessibilityBadge** | `AccessibilityBadge.tsx` | WCAG AA準拠バッジ（緑:準拠/黄:要改善）。ツールチップで3つのコントラスト比表示 |
| **ChatInterface** | `ChatInterface.tsx` | AIチャットUI（パレット調整用）。JSON/コードブロックを自動除去して表示（`formatContent`関数）。SSEストリーミング対応 |
| **KeywordSelector** | `KeywordSelector.tsx` | キーワード選択グリッド（6カテゴリ×5語＝計30語） |
| **MoodboardPair** | `MoodboardPair.tsx` | ムードボードA/Bグラデーションカード（9ペア: 革新的/伝統的, 暖かい/冷たい 等） |
| **ColorPicker** | `ColorPicker.tsx` | HEXカラーピッカーラッパー |
| **PalettePdfDocument** | `PalettePdfDocument.tsx` | react-pdf パレットPDF出力 |

### STPツール固有

| コンポーネント | ファイル | 説明 |
|--------------|---------|------|
| **STPHeader** | `app/tools/stp/components/STPHeader.tsx` | スティッキーヘッダー（ロゴ＋"STP分析ツール"＋ログアウト） |
| **StpPdfDocument** | `app/tools/stp/app/components/StpPdfDocument.tsx` | react-pdf STP分析PDF出力 |
| **StepPlaceholder** | `app/tools/stp/app/[sessionId]/components/StepPlaceholder.tsx` | ステップ遷移時のスケルトンUI |

### CIマニュアル (`lib/ci-manual/`)

| ファイル | 説明 |
|---------|------|
| `data-fetcher.ts` | DB からブランドデータを取得 |
| `pdf-document.tsx` | PDFドキュメント全体の構成 |
| `pdf-fonts.ts` | フォント設定 |
| `pdf-styles.ts` | PDFスタイル定義 |
| `types.ts` | CIマニュアル用型定義 |
| `sections/` | cover, toc, strategy, guidelines, verbal, visuals, colophon |

### UI コンポーネント (`components/ui/`)

shadcn/ui ベース: accordion, alert-dialog, alert, auto-resize-textarea, avatar, badge, button, calendar, card, chart, checkbox, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, tooltip 等

### 型定義 (`lib/types/`)

| ファイル | 主な型 |
|---------|--------|
| `color-tool.ts` | `ColorValue`, `PaletteProposal`, `AccessibilityScore`, `BasicInfo`, `ImageInput`, `MiniAppSession`, `BrandColorProject`, `ConversationMessage`, `BRAND_KEYWORDS`, `MOODBOARD_PAIRS`, `FREE_LIMITS` |
| `positioning-map.ts` | `PositioningMapSize`, `PositioningMapItem`, `PositioningMapData` |

### 定数 (`lib/constants/`)

| ファイル | 内容 |
|---------|------|
| `industries.ts` | `INDUSTRY_CATEGORIES` — 9大分類（IT, 製造, サービス, 小売, 医療, 金融, クリエイティブ, 建設, その他）×各5-6中分類 |

---

## 7. ツール: ブランドカラー定義

### 概要

5ステップのウィザード形式。AIがブランドに最適なカラーパレットを3案提案し、チャットで調整・確定・出力。

**ヘッダー:** `ToolsHeader`（`app/tools/colors/components/ToolsHeader.tsx`）— スティッキー白背景 + `backdrop-blur-sm`、ツール名＋ログアウト

### ステップ詳細

#### Step 1: 基本情報入力 (`Step1BasicInfo.tsx`)

- ブランド名、業種（`IndustrySelect`）、ブランドステージ（新規/リブランド）
- 既存カラー入力（HEXカラーピッカー）
- 競合企業・サービスのブランドカラー入力（名前＋HEX）
- `shared-profile` API からのプリフィル対応
- 1秒デバウンスの自動保存 + companies テーブルへの即時同期（`syncToCompany`）
- レガシー brand_stage 正規化: `refinement` → `rebrand`

#### Step 2: イメージ入力 (`Step2ImageInput.tsx`)

- 2つのアプローチから選択:
  - **キーワードモード**: 6カテゴリ×5語（計30語）から選択（`KeywordSelector`）
  - **ムードボードモード**: 9ペアのA/Bカードで方向性を決定（`MoodboardPair`）
- 避けたい色の指定（HEX入力）
- 参考ブランドの入力

#### Step 3: AI提案 (`Step3Proposals.tsx`)

- Claude APIで3パターンのパレットを自動生成（`/api/tools/colors/generate`）
- 各パレット: メイン＋サブ(1-2色)＋アクセント＋ニュートラル(明/暗)
- `PaletteCard` で表示（カラーバー＋カラーグリッド＋コンセプト＋提案理由＋プレビュー＋AA準拠バッジ）
- カラーグリッド内のカラーカード: `h-10 w-10` スウォッチ → ラベル → 色名 → HEX(大文字) → RGB
- 再生成可能（確認ダイアログ付き）
- 1案を選択して次へ

#### Step 4: 調整 (`Step4Refinement.tsx`)

- **レイアウト:** 上部にパレット情報＋フル幅カラーバー(`h-20`)、下部に左右2カラム（md以上）
  - **左半分:** `grid grid-cols-2 gap-3` のカラーカード＋`Popover` + `HexColorPicker` で個別色編集
  - **右半分:** `ChatInterface` でAIチャット調整
- リアルタイムプレビュー（アコーディオン展開）
- アクセシビリティスコア表示（`AccessibilityBadge`）
- **AIチャットのJSON非表示:** `formatContent()` 関数でコードブロックとパレットJSONオブジェクトを自動除去

#### Step 5: 確定・出力 (`Step5Export.tsx`)

- 最終パレット確認
- PDF出力（react-pdf `PalettePdfDocument`）— フリープランは透かしあり
- CSSトークンダウンロード
- branding.bz本体への連携（`/api/tools/colors/link` → `brand_visuals.color_palette` 更新）

### フリーミアム制限 (`FREE_LIMITS`)

- 月3回の生成
- 3案/回の提案
- チャット5ターン/セッション
- PDF透かしあり

---

## 8. ツール: STP分析

### 概要

5ステップのウィザード形式。AIがSTP（セグメンテーション・ターゲティング・ポジショニング）分析を支援。

**ヘッダー:** `STPHeader`（`app/tools/stp/components/STPHeader.tsx`）— スティッキー白背景 + `backdrop-blur-sm`、ツール名＋ログアウト

### ステップ詳細

#### Step 1: 基本情報入力 (`Step1BasicInfo.tsx`)

- 企業名（必須）、業種（`IndustrySelect`、必須）
- 事業内容（`TitleDescriptionList`）— タイトル＋説明文のリスト（1件以上必須）
- ターゲット（`TitleDescriptionList`）— 名前＋説明文のリスト
- 競合企業・サービス（名前＋URL＋メモ）
- `shared-profile` API からのプリフィル対応
- レガシーフィールドからの自動マイグレーション（`industry` → `industry_category`、`products` → `business_descriptions`、`current_customers` → `target_segments`）
- 1秒デバウンスの自動保存 + companies テーブルへの即時同期（`syncToCompany`）

#### Step 2: セグメンテーション (`Step2Segmentation.tsx`)

- **AI提案**: Claude APIが3-4のセグメンテーション変数を提案（`/api/tools/stp/suggest-segments`）
- 各変数: 名前、理由、セグメント配列（名前・説明・規模ヒント 大/中/小）
- セグメントの選択/解除（トグル）
- **ヒントアコーディオン**: 4つのセグメンテーションアプローチ（地理的、人口統計学的、心理学的、行動学的）
- 初回マウント時にデータがなければ自動でAI提案取得
- 再提案時は確認ダイアログ（`AlertDialog`）

#### Step 3: ターゲティング (`Step3Targeting.tsx`)

- **セグメント選択**: Step2の全セグメントをカードで表示。クリックでメインターゲット（1つ）とサブターゲット（最大2つ）を選択
- **メインターゲット深掘り**: メインカード内にアコーディオン展開
  - **AIに提案してもらう** ボタン（手動トリガー、`/api/tools/stp/suggest-target-detail`）
    - 既存入力がある場合は上書き確認ダイアログ（`AlertDialog`）
  - **購買決定要因**（必須）: タグ入力（Enter/カンマで追加、Backspaceで削除）
  - **自社の強み**（必須）: テキストエリア（300文字上限）
  - **競合分析**（任意）: Step1の競合企業から自動生成されたカード。各競合ごとに個別テキストエリア
    - `competitors_analysis: Array<{ name: string; traits: string }>` 形式
    - Step1に競合未入力の場合は案内テキスト表示
- **target_description**: Step2のセグメント説明を自動的に採用（個別入力フィールドなし）
- **バリデーション**: メインターゲット選択 + 購買決定要因1つ以上 + 自社の強み入力が必須

#### Step 4: ポジショニング (`Step4Positioning.tsx`)

- **AI提案**: Claude APIがポジショニング軸＋配置を提案（`/api/tools/stp/suggest-positioning`）
  - Step3の購買決定要因・自社の強み・競合分析を踏まえた軸選定
  - 再提案時は確認ダイアログ
- **レイアウト:** 左右2カラム（md以上）
  - **左半分:** 軸ラベル入力（X: 左/右、Y: 上/下）＋アイテムリスト（名前＋色＋XYスライダー）
  - **右半分:** `PositioningMap` プレビュー（`lg:sticky`）
- アイテムの追加/削除、手動位置調整
- 自社: 青(`#3B82F6`)・Lサイズ、競合: 各色・Mサイズ

#### Step 5: 確認・出力 (`Step5Result.tsx`)

- **STP分析フルサマリー:**
  - S（セグメンテーション）: セグメントをバッジ表示
  - T（ターゲティング）: メインターゲットカード（名前＋セグメント説明）＋サブターゲット
  - P（ポジショニング）: `PositioningMap` ＋凡例（カラードット＋企業名）
- **出力:**
  - PDF出力（react-pdf `StpPdfDocument`）
  - branding.bz本体への連携（`/api/tools/stp/connect` → `brand_personas` テーブル更新）
  - リセットオプション（確認ダイアログ）

### AI提案API一覧

| API | 入力 | 出力 | トリガー |
|-----|------|------|---------|
| `suggest-segments` | `basic_info` | `variables[{ name, reason, segments[] }]` | Step2 初回マウント / 再提案ボタン |
| `suggest-target-detail` | `basic_info`, `segmentation`, `main_target` | `{ buying_factors[], strengths, competitors_analysis[] }` | Step3「AIに提案してもらう」ボタン |
| `suggest-positioning` | `basic_info`, `targeting` | `{ x_axis, y_axis, items[] }` | Step4 初回 / 再提案ボタン |

### セッションデータ構造 (metadata)

```ts
{
  basic_info: {
    company_name, industry_category, industry_subcategory,
    business_descriptions: [{ title, description }],
    target_segments: [{ name, description }],
    competitors: [{ name, url, notes }]
  },
  segmentation: {
    mode: 'ai' | 'manual',
    variables: [{ name, reason, segments: [{ name, description, size_hint, selected }] }]
  },
  targeting: {
    main_target: string,
    sub_targets: string[],
    target_description: string,  // Step2セグメント説明を自動採用
    buying_factors: string[],
    strengths: string,
    competitors_analysis: [{ name, traits }],
    evaluations: []  // レガシー互換
  },
  positioning: {
    x_axis: { left, right },
    y_axis: { bottom, top },
    items: [{ name, x, y, color, is_self }]
  }
}
```

---

## 9. 基本情報共通化

### Single Source of Truth 方式

ツールのStep1で入力した基本情報は、companies テーブルを Single Source of Truth（SSoT）として管理。ツール編集時は即座にcompaniesテーブルへPATCHし、管理画面やプリフィルは常にcompaniesの最新値を参照。

### データフロー

```
[管理画面 /admin/company]
        ↕ Supabase直接
[companies / brand_guidelines / brand_personas テーブル]
        ↕ /api/tools/shared-profile (GET/PATCH)
[カラーツール Step1]  [STPツール Step1]
```

### shared-profile API

**GET `/api/tools/shared-profile?userId=xxx`**

優先順位付きルックアップ:
1. `admin_users` → `company_id` → `companies` テーブル → `source: 'company'`
2. `brand_guidelines` + `brand_personas` 参照
3. フォールバック: 最新の完了済み `mini_app_sessions` → `source: 'session'`
4. 見つからない場合: `{ source: 'none' }`

返却データ:
```ts
{
  source: 'company' | 'session' | 'none',
  data: {
    brand_name, industry_category, industry_subcategory,
    brand_stage, competitor_colors, competitors,
    business_descriptions, target_customers, target_segments
  }
}
```

**同期ルール:**
- `source === 'company'`（isCompany）→ 常にcompanies最新値をセッションに適用
- `source === 'session'` → 空フィールドのみプリフィル

**PATCH `/api/tools/shared-profile`**

- `companies` テーブル: `name`, `industry_category`, `industry_subcategory`, `brand_stage`, `competitors`, `target_segments` を更新
- `brand_guidelines`: `business_content` を更新
- `brand_personas`: `target` を更新

**キー名マッピング:**
- GET: `brand_name` → PATCH: `company_name`（いずれも `companies.name` に対応）

### 競合データのマージ方式

REPLACE方式（送信リストがソースオブトゥルース）:

- **カラーツール** → `competitor_colors` を送信。既存の `url`/`notes` は名前マッチで引き継ぎ
- **STPツール** → `competitors` を送信。既存の `colors` は名前マッチで引き継ぎ
- 一方のツールにしか存在しないデータは保持される

### companies テーブルの新カラム

| カラム | 型 | 追加時期 | 説明 |
|--------|------|---------|------|
| industry_category | text | v0.5.0 | 業種大分類（`IndustrySelect` の value） |
| industry_subcategory | text | v0.5.0 | 業種中分類 |
| brand_stage | text | v0.5.0 | ブランドステージ（新規/リブランド） |
| competitors | jsonb | v0.6.0 | 競合 `[{name, url, colors[], notes}]` |
| target_segments | jsonb | v0.8.0 | ターゲットセグメント `[{name, description}]` |

---

## 10. デザインシステム

### 公開ページ（マーケティング）

CLAUDE.md の「デザインシステム（公開ページ共通）」セクションに準拠。主要パターン:

- **グラスモーフィズムカード**: `backdrop-filter: blur(12px) saturate(120%)`, `rgba` 背景, inset box-shadow, 2層リフレクション
- **CTAボタン**: グラスモーフィズム `rounded-full h-12` + `hover:scale-105`
- **タイポグラフィ**: h1 `text-3xl md:text-5xl font-bold tracking-tight`, h2 `text-xl md:text-[1.625rem]`
- **セクション余白**: `py-16 md:py-24`
- **コンテナ**: `mx-auto max-w-7xl px-6`

適用ページ: トップLP, 料金, FAQ, お問い合わせ, ツールLP

### ツール画面

`memory/tool-screen-design.md` に定義。主要パターン:

- **コンテナ**: `mx-auto max-w-4xl px-5 py-8`
- **Card**: `bg-[hsl(0_0%_97%)] border shadow-none` + `p-5`
- **ステップ見出し**: `text-2xl font-bold text-foreground mb-2` + 説明文 `text-[13px] text-muted-foreground`
- **スティッキーフッター**: `sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3`（Card外にfragmentで配置）
- **カラーカード**: `h-10 w-10 rounded-lg` スウォッチ, ラベル→色名→HEX→RGB の順
- **カラーバー**: `h-20` 統一
- **背景コントラスト**: 親がグレー→子は白、親が白→子はgray-50
- **削除ボタン**: `variant="outline" size="icon"` + `text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive`（`size-9`、`<Trash2 size={14} />`）
- **フォーム必須マーク**: `<span className="text-xs text-red-500 font-normal">*</span>`
- **フォーム任意マーク**: `<span className="text-xs text-gray-400 font-normal">（任意）</span>`

適用ツール: カラー定義, STP分析（今後のツールも同様）

### ラベル統一

| 箇所 | ラベル |
|------|--------|
| 管理画面 company 見出し | 競合企業・サービス |
| カラーツール Step1 | 競合企業・サービスのブランドカラー |
| STPツール Step1 競合入力 | 競合企業・サービス |
| STPツール Step1 ターゲット入力 | ターゲット |

### ヘッダー

**マーケティングヘッダー** (`app/(marketing)/layout.tsx` 内インライン):
- `h-14` 固定、透明背景
- ロゴ: `mix-blend-mode: difference` で背景に応じて自動反転
- ナビ: デスクトップ `hidden md:flex` / モバイル ハンバーガー
- 「ツール」ドロップダウン: グラスモーフィズムスタイル（`backdrop-filter: blur(12px)`）
- スクロール時 `isOverDark` 検出で文字色・背景を自動切替

**ツールヘッダー** (`ToolsHeader` / `STPHeader`):
- スティッキー白背景 + `backdrop-blur-sm`
- ツール名表示 + ログアウトボタン

**管理画面**: サイドバーベース（shadcn/ui `Sidebar`）

### AlertDialog 統一パターン

`@/components/ui/alert-dialog` を使用:
- STPツール Step2: 再提案確認
- STPツール Step3: AI提案上書き確認
- STPツール Step4: 再提案確認
- STPツール Step5: branding.bz連携確認、やり直し確認
- カラーツール: sonner toast を使用（AlertDialogは未使用）

---

## 11. API一覧

### 汎用

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/contact` | POST | お問い合わせフォーム送信（メール送信） |
| `/api/signup` | POST | 企業＋管理者アカウント登録 |
| `/api/card-view` | POST | 名刺閲覧トラッキング |
| `/api/members/create` | POST | 管理者がメンバー作成 |
| `/api/members/register` | POST | ポータルセルフ登録 |
| `/api/superadmin/create-company` | POST | スーパー管理者が企業作成 |

### ツール共通

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/tools/shared-profile` | GET | ツールStep1用プリフィルデータ取得 |
| `/api/tools/shared-profile` | PATCH | ツール結果をbranding.bz本体に書き戻し |

### カラーツール

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/tools/colors/sessions` | POST | 新規セッション作成 |
| `/api/tools/colors/sessions/[sessionId]` | GET/PATCH | セッション取得・更新 |
| `/api/tools/colors/generate` | POST | Claude API: 3パレット生成 |
| `/api/tools/colors/chat` | POST | Claude API: チャットリファインメント（SSE） |
| `/api/tools/colors/export/pdf` | POST | パレットPDF生成 |
| `/api/tools/colors/link` | POST | 本体連携（`brand_visuals.color_palette` 更新） |

### STPツール

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/tools/stp/sessions` | POST | 新規セッション作成 |
| `/api/tools/stp/sessions/[sessionId]` | GET/PATCH | セッション取得・更新 |
| `/api/tools/stp/suggest-segments` | POST | Claude API: セグメンテーション変数＋セグメント提案 |
| `/api/tools/stp/suggest-target-detail` | POST | Claude API: 購買決定要因＋自社の強み＋競合分析の提案 |
| `/api/tools/stp/suggest-positioning` | POST | Claude API: ポジショニング軸＋配置提案 |
| `/api/tools/stp/export/pdf` | POST | STP分析PDF生成 |
| `/api/tools/stp/connect` | POST | 本体連携（`brand_personas` 更新、セッション完了マーク） |

### ブランドスコア — 理解度テスト

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/brand-score/quizzes` | GET/POST | クイズ一覧・作成 |
| `/api/brand-score/quizzes/[id]` | GET/PATCH/DELETE | 取得・更新（配信/ステータス）・削除 |
| `/api/brand-score/quizzes/[id]/questions` | GET/POST | 設問一覧・追加 |
| `/api/brand-score/quizzes/[id]/questions/[questionId]` | PATCH/DELETE | 設問編集・削除 |
| `/api/brand-score/quizzes/[id]/generate-questions` | POST | Claude API: AI設問生成 |
| `/api/brand-score/quizzes/[id]/attempt` | POST | 受験（記名・採点・保存） |
| `/api/brand-score/quizzes/[id]/my-attempt` | GET | 本人結果（スコア・解説・全社平均） |
| `/api/brand-score/quizzes/[id]/results` | GET | 管理者集計（k匿名） |
| `/api/brand-score/quizzes/[id]/participants` | GET | 受験状況（スコアなし） |
| `/api/brand-score/quizzes/[id]/take` | GET | 受験用設問（正解・解説を除外） |
| `/api/brand-score/quizzes/pending` | GET | 未受験 active クイズ（バナー用） |
| `/api/brand-score/knowledge-gap` | GET | 共感×知識 ギャップ分析 |

---

## 12. ブランドスコア

#### ブランド理解度テスト（インナー：知識）

サーベイ（共感）・アウター（行動）に加え、**社員の"知識"を正誤問題で測る記名式テスト**。サーベイが自己申告（リッカート）なのに対し、テストは正解のある設問で「実際に知っているか」を測る。**サーベイ＝共感／テスト＝知識／アウター＝体現**の3計測器でブランド浸透を立体化する。Premium専用。

- **設問生成**: Claude API が自社ブランドデータ（companies / brand_guidelines / brand_visuals / brand_personas / brand_personalities / brand_terms）を**正解キー**に、4択・◯×設問を生成（`generate-questions`）。WHY（理念の中身）・HOW（戦略/ルール/カラー/用語）が対象。WHAT（行動）はテスト不向きのため対象外。生成は draft 保存→管理者レビュー→配信。
- **採点**: 単純正答率。`score = correct/total × 100`、カテゴリ別 `why_score`/`how_score`、`passed = score >= pass_threshold`。
- **記名式＋k匿名**: 受験は `profile_id` を保存（本人はスコア・弱点・解説を学習）。管理者は**集計のみ**閲覧（部署/役職/設問別は n≥3、`overall`・`company_average_score` も n<3 で抑制）。集計APIに個人行を載せない／受験状況APIにスコアを載せない、で `個人→スコア` のマッピングを遮断。本人確認はセッション（`getMemberContext`/`getAdminContext`）、クライアント `profileId` は不使用。
- **正解リーク防止**: 受験用 `take` は `correct_option_id`・`explanation` を返さない（提出前に正解が見えない）。
- **ギャップ分析**: 共感（サーベイ WHY/HOW）vs 知識（テスト WHY/HOW）を対比し、`empathy_leads`（共感先行→周知・教育）/`knowledge_leads`（知識先行→共感醸成）/`balanced_high`（浸透）/`balanced_low`（未浸透）を判定。「好きだけど知らない／知ってるけど冷めてる」を可視化。

---

## 13. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-06-04 | v1.1.0 | **ブランド理解度テスト（インナー：知識）追加。** 記名式クイズで社員の知識を測定。DB4テーブル（brand_quizzes/questions/attempts/answers）、API12本、管理UI（作成・AI設問生成レビュー・配信・k匿名集計・受験状況）、ポータルUI（バナー・受験・本人結果＝学習振り返り）、ダッシュボード統合（理解度カード＋共感×知識ギャップ分析）。採点=単純正答率、k匿名 n≥3（overall/company_average も n<3 抑制）、本人確認はセッション、take は正解・解説を除外。 |
| 2026-03-09 | v0.8.0 | **STP Step3 ターゲティング大改修:** 競合分析を構造化データ（`competitors_analysis: [{name, traits}]`）に変更。Step1の競合企業から自動カード生成。AI提案を手動ボタン式に変更（確認ダイアログ付き）。「ターゲットの詳細定義」フィールドを廃止（Step2セグメント説明を自動採用）。購買決定要因・自社の強みを必須バリデーション化。 **suggest-target-detail API新設:** 購買決定要因・自社の強み・競合ごとの個別分析を提案。動的スキーマ（競合名を事前指定）。 **suggest-positioning API改修:** 構造化された競合分析データを活用したポジショニング軸提案。 **UI統一:** ラベル統一（競合企業→競合企業・サービス）、削除ボタンスタイル統一（`variant="outline" size="icon"` + destructive系）、ツール画面デザインガイドライン策定。 **Step5/PDF更新:** メインターゲットカード内にセグメント説明を統合表示。 **基本情報共通化:** companies.target_segments カラム追加、shared-profile APIによるツール↔本体の双方向データ同期、競合データREPLACEマージ方式。 **その他:** CIマニュアルPDF出力機能、公開ページのグラスモーフィズムデザインシステム適用。feature-requirements.md を最新状態に全面更新。 |

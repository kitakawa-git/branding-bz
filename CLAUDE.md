# branding.bz プロジェクト
## 概要
中小企業のブランドを「作る → 社内に根づかせる → 社外に届ける」まで一貫支援するSaaS。
運営：ID INC.（川崎市、CEO：北川巧）
## 3レイヤー構造
1. 構築（ミニアプリ群）— 理念・コピー・カラー・ペルソナをAIで策定。無料〜フリーミアム
2. 浸透（branding.bz本体）— ブランド掲示・Good Jobタイムライン・KPI・学習。月額サブスク
3. 発信（スマート名刺）— QRコードから個人プロフィール＋企業ブランドの簡易ページを表示
## 技術スタック
- フロントエンド: Next.js (App Router) + TypeScript, Vercel
- バックエンド/DB: Supabase (PostgreSQL + Auth + Realtime + Storage)
- AI: Claude API (RAG: pgvector)
- 決済: Stripe
- QRコード: qrcode.js等
## デプロイ
- Vercel自動デプロイ（git pushで反映）
- 本番URL: https://branding.bz
## Supabase設定
- URL: https://wfabdmfgngjtihhlrrpk.supabase.co
- 主要テーブル: companies, profiles, admin_users, members, brand_guidelines, brand_surveys, brand_survey_responses, brand_micro_feedbacks, brand_score_snapshots, card_views, card_events, timeline_posts, announcements, goal_kpis, invite_links
- Storage: avatars, logos, brand-assets, timeline-images
- RLS: 無効（プロトタイプ段階）
## 現在のDB構造
### companies
id (uuid), name, logo_url, slogan, mvv, brand_color_primary, brand_color_secondary, website_url, created_at
### profiles
id (uuid), company_id (FK→companies), name, position, department, bio, photo_url, email, phone, slug (unique), created_at
## 現在完成している機能
- スマート名刺 (/card/[slug]) — プロフィール＋企業ブランド＋MVV＋マイクロフィードバック
- 管理画面 (/admin) — 企業情報・メンバー・ブランドガイドライン・お知らせ・名刺テンプレート
- ポータル (/portal) — メンバー向けブランド掲示・タイムライン・KPI・サーベイ回答
- Brand Score (/admin/brand-score) — インナースコア（サーベイ）＋アウタースコア（名刺分析）＋マイクロフィードバック
- STP分析ツール (/tools/stp) — 5ステップAI提案＋PDF出力＋branding.bz連携
- カラー定義ツール (/tools/colors) — 5ステップAIパレット提案＋PDF出力＋branding.bz連携
- ペルソナビルダー (/tools/persona) — 5ステップAIペルソナ＋ジャーニーマップ＋branding.bz連携
- スーパー管理画面 (/superadmin) — 企業管理・ニュース管理
- マーケティングページ — LP・料金・FAQ・お問い合わせ・お知らせ
## 開発フェーズ
- Phase 0 ✅: スマート名刺プロトタイプ
- Phase 1 ✅: ブランド掲示＋スマート名刺＋管理画面＋ポータル
- Phase 2（進行中）: タイムライン、KPI、Brand Score（サーベイ・マイクロフィードバック・ダッシュボード）
- Phase 3: ミニアプリ群（STP・カラー定義・ペルソナビルダーは完了）
## 絶対ルール
### DB変更ルール
- テーブル追加・カラム追加・RLSポリシー変更・RPC関数作成が必要な場合は、コード修正より先にSQLを出力し、ユーザーの実行完了を待つこと
- Supabase MCP接続が使えない場合は、SQL Editorで手動実行する前提で出力する
- 既存テーブルの構造が不明な場合は、想定で進めずユーザーに確認すること

## コーディング規約
- 日本語コメント推奨
- コミットメッセージは日本語
- スタイル: Tailwind CSS + shadcn/ui（グラスモーフィズム部分のみinline style）
- git pushは明示的な指示がない限り行わない
- Plan不要、即座に実装に入ること
- 共通コンポーネント化よりもインライン実装を優先
- **プレースホルダー（placeholder）に実在の固有名詞・クライアント内容を絶対に使わない**。リィツメディカル等の社名/人名/実在クライアントのスローガン・MVV・特性コピーをそのまま例示しない。必ず架空の汎用例にする（メールは `@example.com`、氏名は「山田 太郎」、企業は「株式会社○○」、コピー類は自作の汎用文）

## コマンド
- `npm run dev` — 開発サーバー起動（port 3004）
- `npx tsc --noEmit` — 型チェック
- `npx next build` — プロダクションビルド

## 開発経緯・技術メモ

### DB構成
- companies: name, slogan, mvv, website_url, logo_url, brand_story, provided_values(text[])
- profiles: name, title, department, bio, email, phone, slug, photo_url, company_id, sns_x, sns_linkedin, sns_facebook, sns_instagram
- admin_users: auth_id, company_id, role, is_superadmin
- card_views: profile_id, viewed_at, ip_address, user_agent, referer, country, city
- members: id, company_id, profile_id, role, status, invited_at, joined_at
- brand_guidelines: id, company_id, mission, vision, values(jsonb), slogan, brand_story, business_content(jsonb)
- brand_surveys: id, company_id, title, status, starts_at, ends_at, target_response_rate, total_members
- brand_survey_responses: id, survey_id, question_id, score(1-5), department, role_category
- brand_micro_feedbacks: id, company_id, source_profile_id, tags(text[]), visitor_id
- brand_score_snapshots: id, company_id, snapshot_date, inner_score, outer_score, total_score, rank
- card_events: profile_id, company_id, event_type, event_data(jsonb)
- timeline_posts: id, company_id, author_id, content, images
- announcements: id, company_id, title, body, published_at

### 認証
- Supabase Auth（メール/パスワード）
- admin_usersでcompany_idとroleを管理
- is_superadmin=trueでスーパー管理画面アクセス可能
- supabaseクライアントのauth設定にlock:false必須（LockManagerタイムアウト回避）

### RLS
- 全テーブルRLS無効（プロトタイプ段階。本番前に要設定）

### Storage
- avatars: プロフィール写真
- logos: 企業ロゴ
- ポリシー：認証ユーザーはavatars/logosにアップロード・更新可能、誰でも閲覧可能

### 環境変数
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY（API Routeでのみ使用）

### 既知の注意点
- WebサイトURLはhttps://自動補完あり
- provided_valuesはPostgreSQL配列型（text[]）
- QRコードは1000x1000px高解像度対応
- セルフサービス登録時のslugはランダム英数字8文字

## デザインシステム（公開ページ共通）
新しい画面を作成する際は、以下のトークンとパターンに必ず準拠すること。

### ツール画面・管理画面のデザインルール
→ 詳細: memory/tool-screen-design.md（コンテナ・Card・フッター・フォーム要素・削除ボタン等）

### カラー
| トークン | 用途 | 備考 |
|---------|------|------|
| `text-gray-900` | 見出し、ブランド名 | メイン文字色 |
| `text-gray-700` | サブテキスト、説明文（大） | Hero副文等 |
| `text-gray-600` | 説明文（小）、フッターリンク | カード本文等 |
| `text-gray-500` | タグライン、補足 | |
| `text-gray-400` | コピーライト | 最も薄い文字 |
| `text-blue-700` | バッジテキスト | アクセントバッジ用 |
| `bg-white` | メイン背景、フッター | |
| `bg-gray-50` | セクション背景（交互） | About、パレット例、機能ハイライト |

### タイポグラフィ
| 用途 | クラス |
|------|--------|
| ページ見出し（h1） | `text-3xl md:text-5xl font-bold tracking-tight text-gray-900` |
| セクション見出し（h2） | `text-xl md:text-[1.625rem] font-bold text-gray-900` |
| カード見出し（h3） | `text-lg font-bold text-gray-900` |
| Hero副文 | `text-lg md:text-xl text-gray-700 leading-relaxed` |
| カード本文 | `text-sm text-gray-600 leading-relaxed` |
| ラベル | `text-sm font-semibold tracking-wide text-gray-700` |
| フッターリンク | `text-xs text-gray-600` |
| コピーライト | `text-xs text-gray-400` |
| ブランド名 | `text-lg font-bold text-gray-900` |
| タグライン | `text-sm text-gray-500` |

### スペーシング
| 用途 | クラス | 実値 |
|------|--------|------|
| セクション上下（標準） | `py-16 md:py-24` | 64px / 96px |
| セクション上下（コンパクト） | `py-12 md:py-16` | 48px / 64px |
| コンテナ左右 | `px-6` | 24px |
| コンテナ最大幅 | `max-w-7xl` | 1280px |
| コンテンツ最大幅 | `max-w-4xl` | 896px |
| テキスト最大幅 | `max-w-2xl` | 672px |
| フッター上下 | `py-16` | 64px |
| フッター行間 | `space-y-1.5` | 6px |
| カード内（ヘッダー） | `p-8` | 32px |
| カード内（コンテンツ） | `p-6` | 24px |
| セクション見出し下 | `mb-8` 〜 `mb-12` | 32px〜48px |
| CTAボタン上マージン | `mt-10` | 40px |

### グリッドレイアウト
| パターン | クラス |
|---------|--------|
| 3カラム（レイヤーカード） | `grid md:grid-cols-3 gap-6` |
| 4カラム（機能カード） | `grid grid-cols-2 md:grid-cols-4 gap-6` |
| 2カラム（機能一覧） | `columns-1 md:columns-2 gap-6 space-y-6` |
| フッターリンク | `grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8` |
| ボタン横並び | `flex flex-col sm:flex-row gap-4 justify-center` |

### ボーダーラジウス
| 用途 | クラス |
|------|--------|
| CTAボタン | `rounded-full` |
| バッジ | `rounded-full` |
| マーケカード | `rounded-2xl` |
| 動画・画像コンテナ | `rounded-xl` |
| フォーム要素 | `rounded-md` |

### グラスモーフィズムカード（共通スタイル）
マーケティングページ・ツールLPのカードはすべて同じパターンを使用：
```
// コンテナ
className="relative rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
style={{
  background: 'rgba(255, 255, 255, 0.12)',     // 白背景上では 0.7
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.25)', // 白背景上では 0.8
  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.12), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.15)',
}}

// リフレクション（2レイヤー重ねる）
<div className="absolute inset-0 pointer-events-none rounded-2xl"
  style={{ background: 'linear-gradient(to left top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)' }} />
<div className="absolute inset-0 pointer-events-none rounded-2xl"
  style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)' }} />
```

### ボタン
#### プライマリCTA（黒）
```
className="relative h-12 px-12 rounded-full text-base font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
style={{
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  boxShadow: '0px 8px 24px 0 rgba(0, 0, 0, 0.2), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.15)',
}}
```
#### セカンダリCTA（透明）
```
className="relative h-12 w-48 rounded-full text-base font-bold text-gray-900 overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
style={{
  background: 'rgba(255, 255, 255, 0.25)',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.1), inset 0px 1px 0px 0px rgba(255, 255, 255, 0.3)',
}}
```
#### ヘッダーログインボタン（小）
```
className="relative h-8 px-4 rounded-full text-sm font-semibold text-gray-900 overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
// style はセカンダリCTAと同様だがboxShadow値が小さい
```

### バッジ
```
className="mb-8 inline-flex items-center gap-2 rounded-full px-6 py-1.5 text-sm text-blue-700 relative overflow-hidden"
style={{
  background: 'rgba(0, 97, 255, 0.1)',
  backdropFilter: 'blur(12px) saturate(120%)',
  WebkitBackdropFilter: 'blur(12px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0px 8px 24px 0 rgba(12, 74, 110, 0.15), inset 0px 0px 4px 2px rgba(255, 255, 255, 0.2)',
}}
```

### グラデーション背景（CTA・Hero背景）
```
background: [
  'radial-gradient(ellipse 180% 160% at 5% 20%, rgba(196, 181, 253, 0.8) 0%, transparent 55%)',   // ラベンダー
  'radial-gradient(ellipse 160% 140% at 85% 10%, rgba(253, 186, 116, 0.7) 0%, transparent 55%)',   // アンバー
  'radial-gradient(ellipse 150% 130% at 50% 90%, rgba(167, 243, 208, 0.65) 0%, transparent 55%)',  // ミント
  'radial-gradient(ellipse 130% 110% at 95% 65%, rgba(251, 207, 232, 0.6) 0%, transparent 55%)',   // ピンク
  'linear-gradient(135deg, rgba(245, 243, 255, 1) 0%, rgba(255, 251, 245, 1) 50%, rgba(243, 255, 251, 1) 100%)',
].join(', ')
```

### ヘッダー
- 高さ: `h-14`（56px）
- ロゴ: `mix-blend-mode: difference` で背景に応じて自動反転（白文字固定）
- ナビ: `hidden md:flex`（モバイルはハンバーガー）
- ナビリンク: `text-sm font-semibold`、ホバー `hover:bg-gray-100`
- スクロール時のダーク検出: `isOverDark` で文字色・背景を切り替え
- コンテナ: `mx-auto max-w-7xl px-6`

### フッター
- 背景: `bg-white text-gray-900`
- コンテナ: `mx-auto max-w-7xl px-6 py-16`
- リンクグリッド: `grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8`
- リンクスタイル: `text-xs text-gray-600 hover:text-gray-900 transition-colors`
- 行間: `space-y-1.5`
- ブランド+タグライン: 左寄せ、`pt-8`
- コピーライト: `text-xs text-gray-400`

### セクション構成パターン
```
<section className="bg-white px-6 py-16 md:py-24">  {/* or bg-gray-50 */}
  <div className="mx-auto max-w-7xl">
    <h2 className="text-center text-xl md:text-[1.625rem] font-bold text-gray-900 mb-8">
      セクション見出し
    </h2>
    {/* コンテンツ */}
  </div>
</section>
```

### レスポンシブ方針
- モバイルファースト（デフォルトが1カラム）
- `md:` (768px) で主要なレイアウト変更（列数拡張、テキスト拡大、余白拡大）
- `sm:` (640px) でテキスト折り返し制御、ボタン横並び
- 改行制御: `<br className="hidden sm:block" />` or `<br className="hidden md:block" />`

### アイコン
- ライブラリ: `lucide-react`
- カードアイコン: `size={32} strokeWidth={1.5} className="text-foreground"`
- バッジアイコン: `className="h-4 w-4"`
- チェックアイコン: `className="h-3.5 w-3.5"`（バッジ内）

## プラグイン活用ルール

### 新しい画面・UIコンポーネント作成時
- Frontend designスキルを使って実装すること
- ツール画面デザインルール（memory/tool-screen-design.md）を必ず参照

### ライブラリAPI使用時
- Next.js App Router、Supabase、shadcn/ui、@react-pdf/renderer等のAPIを使う際は、context7で最新ドキュメントを取得してから実装すること
- 古い記憶に頼らず、必ず最新仕様を確認

### 実装完了時
- /typecheck で型チェックを実行
- /commit で日本語コミットメッセージを作成（pushはしない）

### セッション開始時
- `../BRD-PROJECT-STATUS.md` を読んで現在のフェーズ・残タスク・課題を把握してから作業開始

### セッション終了時
- `/sync-status` を実行して BRD-PROJECT-STATUS.md を更新する（必須）
  - パス: `../BRD-PROJECT-STATUS.md`
  - 残タスク・完了済み機能・技術メモを更新
- 実装中に発見したハマりポイントや解決策をCLAUDE.mdまたはMEMORY.mdに記録
- 特にSupabase RLS、認証パターン、共通コンポーネントの使い方

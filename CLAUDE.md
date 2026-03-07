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
- テーブル: companies, profiles
- Storage: avatarsバケット（公開）
- RLS: 無効（プロトタイプ段階）
## 現在のDB構造
### companies
id (uuid), name, logo_url, slogan, mvv, brand_color_primary, brand_color_secondary, website_url, created_at
### profiles
id (uuid), company_id (FK→companies), name, position, department, bio, photo_url, email, phone, slug (unique), created_at
## 現在完成している機能
- スマート名刺の簡易ページ (/card/[slug])
- Supabaseからプロフィール＋企業データ取得
- プロフィール写真表示（Supabase Storage）
- テストデータ: /card/kitakawa
## 開発フェーズ
- Phase 0（現在）: スマート名刺プロトタイプ
- Phase 1: ブランド掲示＋スマート名刺
- Phase 2: Good Jobタイムライン、ダッシュボード
- Phase 3: ミニアプリ群
## コーディング規約
- 日本語コメント推奨
- コミットメッセージは日本語
- スタイルは現状inline style（後でTailwindに移行予定）
- git pushまで自動で行うこと

## 開発経緯・技術メモ

### DB構成
- companies: name, slogan, mvv, website_url, logo_url, brand_story, provided_values(text[])
- profiles: name, title, department, bio, email, phone, slug, photo_url, company_id, sns_x, sns_linkedin, sns_facebook, sns_instagram
- admin_users: auth_id, company_id, role, is_superadmin
- card_views: profile_id, viewed_at, ip_address, user_agent, referer, country, city

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

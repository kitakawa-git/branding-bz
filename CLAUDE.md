# brandconnect プロジェクト
## 概要
中小企業のブランドを「作る → 社内に根づかせる → 社外に届ける」まで一貫支援するSaaS。
運営：ID INC.（川崎市、CEO：北川巧）
## 3レイヤー構造
1. 構築（ミニアプリ群）— 理念・コピー・カラー・ペルソナをAIで策定。無料〜フリーミアム
2. 浸透（brandconnect本体）— ブランド掲示・Good Jobタイムライン・KPI・学習。月額サブスク
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

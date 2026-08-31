<!-- BEGIN 最重要ルール（先頭固定・マスター） -->

# ⚠️ 最重要ルール（迷ったら必ずここ・例外なし）

このブロックは各 CLAUDE.md（各リポジトリ／ハブ／各 Drive 案件フォルダ）の **一番上** に本文として置く。
@import ではなく本文に直書きする（Cowork は @import を展開しない可能性があるため）。

## 0. まず「種類」を判定する（これで置き場所が一意に決まる）
作業対象は **「コード」** か **「資料・成果物」** か。最初にこれを決める。迷ったら下の表を引く。

## 1. 置き場所 決定表（唯一の正解）

| 対象 | 置く場所（唯一の正解） | やってはいけない |
|---|---|---|
| コード | `~/dev/<repo>`（正本は GitHub） | Drive に置く／outputs に残す |
| ステータス（**コード案件**） | その repo の `docs/<CODE>-PROJECT-STATUS.md` | Drive 案件フォルダ／outputs |
| ステータス（**非開発案件**） | Drive 案件フォルダ直下 `<CODE>-PROJECT-STATUS.md` | repo／outputs |
| 横断ボード（全プロジェクト俯瞰） | Drive ハブ `PROJECTS-STATUS.md` | commit hash 等の細部を書かない（高レベルのみ） |
| 資料・成果物・アーティファクト（Excel/PDF/画像/スライド/生成物） | 該当プロジェクトの Drive 案件フォルダ（c###） | repo／outputs／汎用 Artifacts バケツに残す |
| 認証情報（.env 等） | 各自の手元のみ | Git・公開 Drive に置く |

## 2. 絶対ルール（破らない）

1. **最終成果物は「本物フォルダ」に保存し切る。** outputs（スクラッチパッド）に置いたまま完了としない。
   保存後は必ず本物フォルダのフルパスを `ls` して実在を確認してから「完了」と言う。
2. **コードは commit & push まで。** 未 push は「未共有・未保存」と同じ。サンドボックスで push できなければ、ユーザーのターミナルで push してもらうまでが完了。
3. **コード作業の前に必ず `git pull --ff-only`。** 古い状態で作業して二重作業しない。
4. **ステータスは `<CODE>-PROJECT-STATUS.md` 1ファイルを上書き。** 日付つきコピー・別名を作らない。
5. **コードのパスは ASCII・スペースなし。** Drive 資料は日本語可だが `/`・スペース・括弧は避ける。
6. **アーティファクト（生成物）は成果物と同じ扱い。** プロジェクト固有は該当 `c###` フォルダ、横断のものだけハブの `共有成果物/`。汎用 `Artifacts/` バケツにプロジェクト固有物を溜めない。

## 3. 実際に起きた誤り（再発させない）

- 「ファイルがある」と言ったが outputs を見ていた → 本物フォルダには無かった。**必ず本物フォルダのフルパスで確認**する。
- 「Cowork だからコード／ステータスも Drive」と誤解 → **コードは ~/dev＋GitHub。Cowork も Claude Code も、コード作業は ~/dev で行う。**
- ステータスを Drive 横断ボードに commit hash で書いて陳腐化 → **細部は repo の `<CODE>-PROJECT-STATUS.md`。横断ボードは「どのフェーズか」の高レベルのみ。**
- デプロイ成功前に「デプロイ済み」と記録 → **グリーンを確認してから記録する。**

<!-- END 最重要ルール（先頭固定・マスター） -->

<!-- BEGIN セッション開始手順（コード案件・マスター） -->

## セッション開始手順（コード案件・必読）

このリポで作業を始めるときは、最初に必ず次を行う（Cowork・Claude Code 共通）。

1. 作業フォルダが `~/dev/<repo>` であることを確認する（Drive の案件フォルダではなく repo を開く）。
2. `git pull --ff-only` で最新に追いつく（未pullだと他セッション／Claude Code の進捗が見えず、二重作業になる）。
3. `docs/<CODE>-PROJECT-STATUS.md` を読み、現状・進行中・保留を把握してから着手する。
   （@import 任せにせず、このファイルを必ず開いて読む。）

作業の節目／終了時は、同じ `docs/<CODE>-PROJECT-STATUS.md` を更新して commit & push する（更新は `/sync-status`）。
未 push は他セッション・Cowork に共有されない。

<!-- END セッション開始手順（コード案件・マスター） -->


# branding.bz プロジェクト

<!-- ===== 共通ルール（全プロジェクト共通・ここから） ===== -->
<!-- このブロックは各リポジトリの CLAUDE.md の先頭に「本文として」貼る。
     Cowork は @import を展開するか不明なため、import任せにせず本文に直書きする。
     更新時は全リポジトリの同ブロックを同じ内容に揃える。最終更新: 2026-06-09 -->

## 共通ルール（全プロジェクト共通）

**置き場所の大原則**

- .md（知識・指示・要件・進捗）= GitHub。実ファイル（Excel・図・PDF・成果物）= Google ドライブ共有フォルダ。コード = Drive外のローカル `~/dev/<repo>`（正本はGitHub）。
- `.git` / `node_modules` をクラウド同期に乗せない（同期事故・破損の防止）。
- 認証情報（`.env.local` 等）は GitHub にも public Drive にも置かない。各自の手元で隔離。

**メモリ**

- 共通ルールはこのブロックとして本文に直書きする（Coworkは@import展開が不明なため）。
- プロジェクト固有の参照は `@パス` で `@import`（Claude Code向け）。個人メモは `CLAUDE.local.md`（`.gitignore`）。

**命名・パス**

- コードのパスは ASCII・スペースなし（例 `~/dev/branding-bz`）。日本語・スペース・括弧・`/` を含めない。
- Drive資料は日本語可だが `/`・スペース・`()` は避け `_` 区切り。命名は `YYMMDD_名称_vN`、旧版・完了済みは `archive/` へ。

**運用**

- 大事な作業は必ず push して共有（未push＝共有も本番反映もされない）。
- 共有フォルダは各自「オフラインで使用可能」に設定（オンラインのみだとClaudeの読み取りが不安定）。

**Git ブランチ / マージ（重要）**

- **ブランチの作成・切り替えは北川さんの明示指示があるまで行わない。** Claude が勝手に feature/fix ブランチを作ったり、別ブランチへ checkout（切り替え）したりしない。
  - 「新しいブランチで」「ブランチ切って」等の明示指示があって初めて作成する。
  - 指示が無いときは、現在チェックアウト中のブランチでそのまま作業する（迷う場合は確認する）。
- **マージも北川さんの明示指示があるまでしない**（auto-merge 含め勝手にマージしない）。

<!-- ===== 共通ルール（ここまで） ===== -->

## 参照ファイル（@import）

> チーム共有メモリ。下記は起動時に自動で読み込まれる。個人メモは `CLAUDE.local.md`（gitignore）へ。

- 機能要件定義（本命）: @feature-requirements.md
- プロダクト概要: @docs/branding-bz-overview.md
- 用語・略語集: @docs/glossary.md
- タスク: @TASKS.md

## 概要
中小企業のブランドを「作る → 社内に根づかせる → 社外に届ける」まで一貫支援するSaaS。
運営：ID INC.（川崎市、CEO：北川巧）
## レイヤー構造
代表見出しは「構築 → 浸透 → 発信。計測が、その全部を貫く」。
1. 構築／つくる（ミニアプリ群）— 理念・コピー・カラー・ペルソナをAIで策定。無料〜フリーミアム
2. 浸透／ひろげる（branding.bz本体）— ブランド掲示・Good Action投稿・KPI・学習・理解度テスト。月額サブスク
3. 発信／とどける（スマート名刺）— QRコードから個人プロフィール＋企業ブランドの簡易ページを表示
- 計測／はかる（ブランドスコア）— **上の3つと並ぶステップではなく、3つを横串で評価する軸**。
  インナースコア＝浸透の測定、アウタースコア＝発信の測定、理解度テストは構築で定義した
  ブランドデータを正解キーに生成される。Premium 以上
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
- RLS: 全テーブル有効（ポリシー内 `auth.uid()` は `(select auth.uid())` でラップ済み・全FKにインデックス済み）。データアクセスは原則 service_role の API Route（`getSupabaseAdmin()`）経由
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
- **マイグレーションは必ずローカル `.sql` を先に作成してから適用する**（リモート直適用でローカル未記録にしない）。
  - 可能なら Supabase CLI（`supabase migration new` → SQL記述 → `supabase db push`）でローカル先行・適用。
  - CLI不可で `apply_migration`（MCP）を使う場合も、同一SQLを `supabase/migrations/<version>_<name>.sql` として保存し、**同じコミットに含める**（version はリモート `supabase_migrations.schema_migrations` の記録値に合わせる）。
  - 破壊的変更（DROP等）は事前バックアップ（退避テーブル等）を必ず先に取る。

### 実機検証ルール（データ汚染防止・最重要）
- **プレビュー（localhost:3004）は demo-admin1@branding.bz（企業＝株式会社テックブリッジ / `128a1513`）でログイン固定。** 検証はこのデモ企業の範囲だけで行う。
- **ツール（STP `/tools/stp`・カラー・ペルソナ）のセッション画面は、セッションのbasic_infoを「ログイン中ユーザーの企業」へ自動同期（`syncToCompany` → `/api/tools/shared-profile` PATCH）し、その企業からプリフィルする。** そのため：
  - **実ユーザー（顧客）のセッションIDを絶対に開かない。** 開くだけでプリフィル／自動保存が走り、セッションとデモ企業の双方が汚染される。
  - 本体企業レコード・実セッション（`mini_app_sessions`）へ検証目的で書き込まない。
- 破壊的UI検証（削除等）は**デモ企業1社に限定**し、必要なら使い捨ての新規セッションで行う（汚染がデモに限定されることを承知の上で）。
- データ確認は read-only を優先し、書き込み前に必ず対象IDを確認する。
- デモデータの復元基準は `scripts/seed-demo-data.sql`。修復はツール経由でなく**DB直書き**で行う（ツール経由だと再同期で再汚染する）。※ **実行前スキーマ乖離解消要**（現行スキーマとカラム乖離あり: `companies.slogan/mvv` や `brand_guidelines.mission/vision/values/business_content` は DROP 済み。現状のまま実行すると 500）
- `companies.industry_category` は `lib/constants/industries.ts` の **`value`（コード: `it_tech`/`consulting` 等）** で保存する。ラベル（「IT・テクノロジー」等）を入れると業種プルダウンが表示されない。

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
- 全テーブルでRLS有効。ポリシー内の `auth.uid()` は `(select auth.uid())` でラップ済み（initplan最適化済み。Supabase advisor の `auth_rls_initplan` 警告は解消。`rls_initplan_remaining=41` は判定regexの大文字小文字違いによる誤検知と確認済み）。全外部キーにインデックス設定済み（`unindexed_fk=0`）。
- データアクセスは原則 service_role 経由の API Route（`getSupabaseAdmin()`）で行う。一部テーブルはポータルの cookie セッション（authenticated ロール）で直接 SELECT する。
- **未使用インデックス注意**: Supabase performance advisor に `unused_index` が約29件表示されるが、これはFK全張りの副作用であり正常・無害。本番トラフィックが流れれば使われて seq scan を消すため、削除しないこと（消すと逆効果）。ビデオラーニングで追加した新規4本（`idx_lvv_video` / `idx_lvv_profile_video` / `idx_lvv_company` / `idx_learning_videos_company`）も同じ理由で温存対象。
- **保留中の任意最適化**: `multiple_permissive_policies`（重複ポリシー統合）約31件。挙動（可視範囲）が変わらないことの検証が必要なため保留。

### Storage
- avatars: プロフィール写真
- logos: 企業ロゴ
- ポリシー：認証ユーザーはavatars/logosにアップロード・更新可能、誰でも閲覧可能

### 環境変数
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY（API Routeでのみ使用）

## ブランディング用語wiki（/wiki・2026-07-27〜）

- テーブルは `wiki_terms` / `wiki_term_sources` / `wiki_term_quotes` / `wiki_term_relations`
  （migration `20260726163924_create_wiki_terms.sql`）。**公開制御は `wiki_terms.status`** の1本。
  `published` だけが RLS で anon から読める。`review` は監修待ち＝公開ページに出ない。
- 段階公開はカテゴリ単位の UPDATE で行う（監修が済んだカテゴリから）:
  `update wiki_terms set status='published' where '基礎・核心' = any(categories);`
- シードは `npx tsx scripts/seed-wiki.ts`（冪等・slug で upsert）。**すでに published の用語は review に戻さない**。
  子テーブルは term_id 単位で全消し→再投入する。
- **公開wikiのデータ取得は service_role ではなく anon キー（`lib/wiki/queries.ts`）**。理由2つ:
  ① RLS の `status='published'` がそのまま公開判定になるので、アプリ側で条件を書き忘れても未監修の用語が漏れない
  ② `SUPABASE_SERVICE_ROLE_KEY` を置いていない Vercel Preview でも generateStaticParams / ISR が落ちない。
  **SSG/ISR のページで `getSupabaseAdmin()` を呼ぶと Preview ビルドが collect page data で落ちる**
  （2026-07-16 の API route と同じ事故。`/news` が `getSupabaseAdmin()` を使えているのは `force-dynamic` だから）。
- カテゴリは `lib/types/wiki.ts` の `WIKI_CATEGORIES`（7件）が正本。seed 側で
  「特化・応用 (ID INC.独自)」→「特化・応用」に正規化している。
- slug は日本語（terms.json 由来・230語中 ASCII は10語）。URL は percent-encode されるので
  リンク生成は必ず `encodeURIComponent(slug)`、受け取りは `decodeURIComponent(slug)` を通すこと。

### 既知の注意点
- **Node 20 では `scripts/*.ts` の Supabase クライアント生成が落ちる**
  （`Node.js 20 detected without native WebSocket support` — supabase-js が realtime を初期化するため）。
  スクリプト実行は Node 22 以上で行う: `PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH" npx tsx scripts/xxx.ts`
- WebサイトURLはhttps://自動補完あり
- provided_valuesはPostgreSQL配列型（text[]）
- QRコードは1000x1000px高解像度対応
- セルフサービス登録時のslugはランダム英数字8文字

## PWA / Service Worker（serwist）

- **本番ビルドは `next build --webpack` 必須。** Next.js 16 デフォルトの Turbopack と
  `@serwist/next`（webpack設定を注入）が衝突し、`next build`（Turbopack）は落ちる。
  `package.json` の `build` から `--webpack` を外さないこと。
- `next.config.ts` は**本番ビルド時のみ** serwist を適用（dev は素のconfig＝Turbopack維持）。
  このラップ条件分岐を壊さない。
- **【漏洩防止・最重要】** SW本体 `app/sw.ts` で、認証配下（/portal /admin /superadmin /api）は
  `NetworkOnly` を `defaultCache` より**配列の先頭**に置く。順序を逆にすると認証ページが
  キャッシュされ、ログアウト/別ユーザーログイン時に前ユーザー画面が漏洩する。**この順序を必ず保つ。**
- **`app/sw.ts` の `skipWaiting: false` が正**（更新通知UI `components/pwa/PWAUpdatePrompt.tsx` 有り）。
  新SWは待機し、sonnerトースト「更新」で制御切替＝作業中の勝手なリロード防止＋ChunkLoadError回避。
  `next.config.ts` の `register: false` ＋ `@serwist/window` 手動登録で `waiting`/`controlling` を購読する。
  `skipWaiting:false` 時は SKIP_WAITING を Serwist が自動処理するため、message リスナを手書きしないこと。
- `public/sw.js` はビルド生成物（gitignore）。コミットしない（Vercelが再生成）。
- 将来 Next.js が webpack ビルドを廃止、または serwist が Turbopack ネイティブ対応したら、
  configurator モード（`@serwist/cli`・2段ビルド）への移行を検討。

## モバイルUX基準（確定版 v1.0・全画面共通の正）

> 根拠: Apple HIG(44pt) / Material(48dp) / WCAG 2.1 AA(4.5:1) / iOS入力ズーム(16px) / include.bz実測。
> 主対象はモバイル(sm未満)。タップ領域・コントラスト・入力16pxは全デバイス共通で適用。
> 監査・修正はこの数値を「判定基準」とする。共通コンポーネント/トークン→codemod→個別、の順で是正。

- **タップ領域（最重要）**: 最小 **44×44px(`h-11`)**・推奨48px(`h-12`)。アイコンボタン（…/ベル/トグル/いいね/コメント/編集/削除/ドロップダウン項目）は**グリフ20–24pxのまま、ヒット領域だけ44pxに拡張**（`size-11` 枠や `py-2.5 -my-` で確保）。隣接タップ要素の間隔は最低8px。FAB＝56px(`h-14`)。
- **入力欄**: 高さ44px以上(`h-11`)・**フォント16px(`text-base`)必須**（iOS自動ズーム防止）。`text-xs`等の縮小を入力に当てない。
- **コントラスト(WCAG AA)**: 本文・メタとも 4.5:1 以上。薄い×小さいの二重苦を作らない。`--muted-foreground` は **40%(白地約5.7:1)** に濃色化済み（globals.css）。これ以上薄いグレーを小文字に当てない。
- **文字サイズの下限**: 常用テキストは **12px(`text-xs`)未満を使わない**。`text-[10px]`/`text-[11px]` は廃止対象（例外＝通知数バッジ・アバター頭文字等の装飾的マイクロ指標のみ）。メタ（日時/補助ラベル）は 13–14px(`text-sm`〜`text-xs`)。さらに 2026-06-12 より**本文は実質14px下限**（globals.css の一括底上げ。下記「本文の最低フォントサイズ14px」参照）。
- **見出しは二段階**（A=二段階で確定）:
  - **タイトル**（ページ/カード/ダイアログの主見出し）＝ 16–18px（`text-base`〜`text-lg`）。
  - **eyebrow小見出し**（ブランド掲示のスローガン/ミッション/人格 等の小ラベル）＝ **14px(`text-sm`)固定**。12px未満にしない。
- 既存の「文字サイズ方針(C案)」「アイコンサイズ」「ボタン大中小」「余白」節（下記）はこの基準のサブ規約。数値が衝突する場合は本基準を優先。

## モバイルUI（文字サイズ方針）

- **本文の最低フォントサイズ14px（2026-06-12〜・全ページ・全デバイス）**: globals.css 末尾の一括オーバーライドで、
  `text-xs`／`text-[9px]`〜`text-[13px]`／`text-[0.8rem]` を本文文脈では **14px（line-height 1.25rem、`text-sm` 相当）** に底上げしている。
  約1,190箇所に散在する小サイズクラスの個別書き換えはしない（このCSSが正）。
  - **除外（小さいまま描画される）**: `button` 配下／`[role="tab"|"tablist"]` 配下／`.rounded-full` 配下（ピル型カプセル・アバター）／
    `.inline-flex.rounded-md`（shadcn Badge・buttonVariants を当てたリンク）／`[data-stepper]` 配下（StepProgressBar 等のステッパー）／`svg` 配下（チャート描画テキスト）。
  - 新規UIで「小さいまま」にしたい本文外の部品は上記の除外条件に合わせて実装する（ステッパー類はルート要素に `data-stepper` を付与）。
  - 注意: `text-xs` 等を書いても本文文脈では14pxで描画される。レスポンシブ変種（`sm:text-xs` 等）は底上げ対象外なので小サイズには使わないこと。
- **本文段落はスマホで一段階大きく（C案）**: 読ませる段落本文（説明文・ストーリー・ミッション本文等、
  `leading-[1.8/1.9]`/`leading-relaxed`/`whitespace-pre-*` を伴う `<p>`）は **`text-base sm:text-sm`**
  ＝スマホ16px / 640px以上14px。**見出し・ラベル・リンク・ボタン・バッジ・エラーバナーは対象外**（本文だけ）。
- **root の font-size はいじらない**（ブラウザ既定16px）。過去に `@media(max-width:639.98px){html{font-size:17px}}`
  を試したが「効果が薄い・全体に効きすぎる」ため撤去済み。底上げは「コンポーネント単位（include.bz基準）
  ＋本文のみ `sm:` で切替」で行う方針（root一括スケールはしない）。
- **入力欄(input/textarea)はフォント16px以上必須**（iOS入力時の自動ズーム防止）。shadcn `Input` 既定は
  `text-base md:text-sm`＝モバイルは元々16pxだが、認証前ページ等は `text-base md:text-base` でPC含め16px固定。
- ポータルのコンパクト設計（見出し `text-xs` 等）はPC基準。モバイルで小さく感じる箇所は上記方針で個別に引き上げる。

### アイコンサイズ（モバイル基準・ポータル）
4pxグリッドで役割ごとに統一。`≤13px` は使わない（モバイルで小さすぎ）。
- 空状態（イラスト的）: 40–48px ／ ヘッダー操作・バナー・カードタイル: **24px** ／ ナビ・見出し・統計: 18–20px
- インライン操作（編集Pencil・削除Trash2・閉じるX）: **16px** ／ 装飾インライン（いいね/コメント数・チェック・マーカー・リンク矢印）: **14px**

### ボタンサイズ 大中小（モバイル基準）
タップ領域は主要ボタンで **≥44px**。`h-14`(56px) のXLはインラインボタンでは使わない（`h-12` に降格統一）。
- **FAB（右下浮遊ボタン）** `h-14`(56px)：`components/ui/fab.tsx` の `FabButton` 共通。浮遊アクションボタンは存在感を出すため例外的にXL。ラベル `text-base`・アイコン18px・`px-6`
- **大** `h-12`(48px)：主要CTA・ログイン/送信。shadcn は `size="lg"`（h-12に再定義済み）
- **中** `h-11`(44px)：通常の主要アクション・バナー・モバイルで押す操作。`className="h-11"` で明示
- **小** `h-9`(36px)：補助・密なリスト/テーブル内・入力欄(Input h-9)と横並びのボタン。shadcn `default`/`sm`（共に h-9）
- アイコンボタン：`size="icon"`(h-9) ／ ヘッダー等の独立アイコンは `size-10`(40px枠)
- 注意：共通 `Button` の `default` は **Input(h-9) と高さを揃えるため h-9 のまま**。モバイルで主要操作にするボタンは `h-11`/`h-12` を明示する（default のまま放置しない）。

### 余白（モバイル基準・ポータルapp）
4pxグリッド（4/8/12/16/20/24/32px）。マーケLP/ツールは別系統（`px-6`/`py-16-24`、デザインシステム参照）。
- コンテナ左右: **`px-5`(20px)**（375px幅でも本文335px確保。px-3は窮屈・px-6は狭い）
- コンテナ下: **`pb-10`(40px)** に統一（FAB/フッター回避。上は `pt-4`）
- セクション間: **`space-y-6`(24px)** ／ ブロック間（カード外）: `mb-6`(24px)
- コンテンツ/セクションカード内パディング: **16px統一（2026-06-12〜・全ページ・全デバイス）**。globals.css 末尾の一括CSSで、カード（`border`＋`rounded-lg/xl`）の均一パディング `p-3`〜`p-8`、および shadcn Card 直下スロット（CardHeader/CardContent/CardFooter の `p-6`、`pt-0` は維持）を **16px** に統一している（個別書き換えはしない・このCSSが正）。新規実装は **`p-4`(16px)** を標準とする。
  - 対象外: 方向指定（`pt-`/`pb-`/`px-`/`py-`）併用カード＝意図的な非対称設計として据え置き／`rounded-md`（ポップオーバー等）／`p-2` 以下（チップ・アイコン枠）／マーケLPのグラスモーフィズムカード（`rounded-2xl`・インラインstyleのborder＝別系統）。
  - 注意: クラスに `p-3`/`p-5`/`p-6` 等と書いてあっても実描画は16pxになる。意図的に16px以外にしたい「カード見た目の部品」は、方向指定で書く（例 `px-3 py-3`）か `rounded-md` にする。
- ラベル/見出し→中身: `mb-3`(12px) ／ アイコン＋テキスト: `gap-2`(8px) ／ 項目間: `gap-3`(12px) ／ 大きめ区切り: `gap-4`(16px)
- タップ行（リンク/リスト項目）は**タップ領域 ≥44px**（≒`py-3`＋テキスト行）。詰めすぎない。

## デザインシステム（公開ページ共通）
新しい画面を作成する際は、以下のトークンとパターンに必ず準拠すること。

### ツール画面・管理画面のデザインルール
→ 詳細: memory/tool-screen-design.md（コンテナ・Card・フッター・フォーム要素・削除ボタン等）

### カラー

> **カラートークンは DB 管理（2026-06-11〜）**: 正本は Supabase `design_tokens` テーブル。
> `/superadmin/design-system`（スーパー管理画面）で編集 → 保存時に `POST /api/revalidate` → 全画面へ反映。
> 静的フォールバックは `app/globals.css` の `:root`（恒久変更は DB と globals.css の両方を更新）。
> 履歴は `design_token_history` に UPDATE トリガーで自動記録され、管理画面からロールバック可能。
>
> **管理対象（category）**: ①LP用 `--ds-*`（text/bg/border/accent/shadow、hex/rgba） ②アプリ青アクセント `--ds-app-*`（app、hex） ③shadcn基盤 `--primary`/`--foreground`/`--border` 等（base/sidebar/chart/radius、**HSL成分** "0 0% 9%"）。
> **基盤(base/sidebar/chart)を変えると管理・ポータル・ツール画面まで一括で色が変わる**（`text-foreground`/`bg-primary`/`border-border` 等が全部追従）。
> 注意: `.dark`（非運用）と `[data-portal]`（ポータル明色sidebar）は `:root` 注入では上書きされない＝対象外。HSL成分は `hsl()` でラップせず成分のまま保存（tailwind の `hsl(var(--x))` が解決。二重ラップ厳禁）。`--lp-*`/teal は未使用の孤立定義。

| トークン（新規実装はこちら） | 旧表記 | 用途 |
|---------|------|------|
| `text-ds-strong` | `text-gray-900` | 見出し、ブランド名 |
| `text-ds-body` | `text-gray-700` | サブテキスト、説明文（大）、Hero副文 |
| `text-ds-muted` | `text-gray-600` | 説明文（小）、カード本文 |
| `text-ds-meta` | `text-gray-500` | タグライン、補足 |
| `text-ds-accent` | `text-blue-700` | バッジテキスト |
| `text-ds-inverse` | `text-white` | 黒CTAボタン上の白文字 |
| `bg-ds-base` | `bg-white` | メイン背景、フッター |
| `bg-ds-section` | `bg-gray-50` | セクション背景（交互） |
| `bg-ds-media` | `bg-gray-100` | 機能GIF枠等のメディア背景 |
| `var(--ds-bg-glass)` ほか | インラインrgba | グラスカード背景・CTAピル・バッジ背景・枠線・影（インライン style で参照） |
| `text-ds-app-accent` / `bg-ds-app-accent` / `border-ds-app-accent` | `blue-600` / `#2563eb` | アプリ青アクセント（リンク・選択状態・チャート青・ステップバー）。`-hover`=blue-700、`-soft`=blue-500(チャート副線)。recharts/SVG には `var(--ds-app-accent)` を直接 stroke/fill に渡せる |

※**青はフェーズ2でほぼ全置換済み（2026-06-11）**: `blue-500/600/700` の text/bg/border/ring（165件）＋ recharts/SVG/inline の青hex（8件）を `ds-app-accent`系トークンへ（色1:1一致＝`blue-600`=accent / `blue-700`=hover / `blue-500`=soft）。**据え置き**は ①淡色背景 `bg-blue-50/100/200`（86件・`/50`等の不透明度修飾がvar()で効かない）②ブランドカラー定義データ（`brand/visuals` の `accent_colors`＝企業が選ぶ色でテーマ色と別物）③PDF（`@react-pdf`はvar()不可）④`AdminStyles.ts`（dead code）⑤`ring-blue-500/50`。gray系623件は未着手。新規UIで青を使うときは `text-ds-app-accent` 等を使うこと（`blue-*` 直書き禁止）。

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

<!-- ステータスファイル規約 v1 -->
## ステータスファイルの作法
- 状態は 1プロジェクト＝1ファイルを上書き更新する（日付つきコピーを作らない）。
- ファイル名は `BRD-PROJECT-STATUS.md`（このプロジェクトの CODE は BRD）。置き場所はこのリポの `docs/`。
- 標準セクション：現状サマリー / 完了 / 進行中 / 保留・未決（次アクション） / 重要な決定事項 / 参照 / 履歴。コード案件は加えて「開発状態」（ブランチ / オープンPR / デプロイ / マイグレーション / 技術的負債）。
- 更新タイミング：作業の区切り、またはセッション終了前に上書き保存。冒頭の「最終更新」を必ず直す。
- 更新後は commit ＆ push する（未 push は共有されない）。更新は `/sync-status` スキルで行う。
<!-- /ステータスファイル規約 v1 -->

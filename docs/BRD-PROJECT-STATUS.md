# BRD / branding.bz プロジェクトステータス

> **このファイルは Claude Code・Cowork・Claude Projects の共通ハブです。**
> Claude Code: `/sync-status` スキルで更新
> Cowork: 直接読み書き
> Claude Projects: ナレッジとしてアップロード（週1回推奨）

**最終更新:** 2026-06-10
**更新者:** Claude Code（ブランド理念オントロジー実装）

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロダクト名 | branding.bz |
| 運営 | ID INC.（アイディー株式会社、CEO: 北川巧） |
| カテゴリ | 中小企業向けブランディングSaaS |
| コア機能 | ブランド構築→浸透→発信の一貫支援 |
| 本番URL | https://branding.bz |
| デプロイ | Vercel自動デプロイ（git push） |

### Supabase
- Project URL: https://wfabdmfgngjtihhlrrpk.supabase.co
- RLS: **全テーブル有効**（旧「無効」記載は実態と相違）。ポリシーはテーブルごとに異なり多くが緩い（authenticated=true 等）ため本番前に精緻化が必要。読み書きは service_role の API Route が基本。新規テーブル（learning_*）は**ポリシー無し=deny-all**でservice_roleのみ
- Storage: avatars, logos, brand-assets, timeline-images

---

## 2. 現在のフェーズ

**Phase 2 進行中 — タイムライン・KPI・Brand Score**

### 開発フェーズ履歴
- ✅ Phase 0: スマート名刺プロトタイプ
- ✅ Phase 1: ブランド掲示＋スマート名刺＋管理画面＋ポータル
- 🔄 Phase 2（現在）: タイムライン、KPI、Brand Score（サーベイ・マイクロフィードバック・ダッシュボード）
- ⬜ Phase 3: ミニアプリ群（STP・カラー定義・ペルソナビルダーは完了）

### 3レイヤー構造
1. **構築**（ミニアプリ群）— 理念・コピー・カラー・ペルソナをAIで策定。無料〜フリーミアム
2. **浸透**（branding.bz本体）— ブランド掲示・Good Jobタイムライン・KPI・学習。月額サブスク
3. **発信**（スマート名刺）— QRコードから個人プロフィール＋企業ブランド表示

---

## 3. 完了済み機能

- スマート名刺 (/card/[slug]) — プロフィール＋企業ブランド＋MVV＋マイクロフィードバック
- 管理画面 (/admin) — 企業情報・メンバー・ブランドガイドライン・お知らせ・名刺テンプレート
- ポータル (/portal) — メンバー向けブランド掲示・タイムライン・KPI・サーベイ回答
- Brand Score (/admin/brand-score) — インナー＋アウター＋マイクロフィードバック
- STP分析ツール (/tools/stp) — 5ステップAI提案＋PDF出力＋branding.bz連携＋自動保存インジケーター
- カラー定義ツール (/tools/colors) — 5ステップAIパレット＋PDF出力＋branding.bz連携＋自動保存インジケーター
- ペルソナビルダー (/tools/persona) — 5ステップAIペルソナ＋ジャーニーマップ＋連携＋自動保存インジケーター
- スーパー管理画面 (/superadmin) — 企業管理・ニュース管理・企業削除（カスケード）・管理者メール/名前表示
- マーケティングページ — LP・料金・FAQ・お問い合わせ・お知らせ
- ドメイン認証による企業マッチング — メールドメインで既存企業を検索・承認制参加フロー
- サインアップ画面刷新 (/signup) — グラスモーフィズムUI・4ステップフロー（アカウント→ドメインチェック→企業情報→個人情報）
- 管理画面 参加リクエスト承認/拒否UI (/admin/members)
- 認証システム抜本改修 — @supabase/ssr全面移行（cookieベース）・middleware.ts でセッション自動更新・Provider 2層分離（AppAuthProvider + AdminData/PortalDataProvider）
- メンバー削除/孤立アカウント復旧 — Service Role経由でmembers/profiles/auth.users連鎖削除、残存アカウント削除UI
- マイページ振り分けルート (/mypage) — サーバー側で admin/superadmin/member を判定して即リダイレクト
- グローバルヘッダー — ログイン状態で「ログイン」⇔「マイページ」を自動切替
- 参加リクエスト通知メール — Resend経由で (a) 申請受付時に管理者全員へ通知、(b) 承認時に申請者本人へログインURL付きで通知
- メンバー一覧UI改善 — `/admin/members` 一覧から `status='pending'` を除外し、参加リクエストセクションと重複表示しないように
- 機能オン/オフトグル (/admin/settings) — 配列駆動（`lib/constants/feature-toggles.ts` が唯一の定義源）で「Good Jobタイムライン・目標/KPI管理・スマート名刺」を企業単位で表示制御。PATCH API（service_role + company_idガード）。ポータル/管理画面の出し分け、スマート名刺は公開ページ /card/[slug] を門番ガード。データは削除せず再オンで復活
- コンセプトビジュアル複数化＋スライドショー (ブランド方針) — admin で複数アップロード＋ドラッグ並べ替え（最大10枚）、portal でスライドショー表示（自動送り＋前後ボタン＋ドット、枠高さ固定・object-cover）。DB: `brand_guidelines.concept_visuals(jsonb配列)` 追加、レガシー `concept_visual_url` は先頭画像と同期しCIマニュアル表紙互換を維持（2026-06-03）
- 企業作成フロー修正（ポータルログイン不可の解消） — `create-company`/`signup` が admin_users だけでなく **profiles＋members** を作成するよう修正（ポータルは members 行で判定するため旧実装ではログイン不可だった）。既存ロックアウト5社（リィツメディカル/MEGUTAMA/CTD/あいうえお/テスト）を本番DBへバックフィル（2026-06-03）
- スーパー管理「新規企業を登録」モーダル整理 — 表示に使われない孤立カラム（slogan/MVV/ブランドカラー）の入力UIを削除（企業名＋Web＋管理者のみ。ブランド情報は作成後に各編集ページで設定）（2026-06-03）
- FAB共通コンポーネント化 — `components/ui/fab.tsx`（`Fab`/`FabButton`）を新設し、ポータル/管理/スーパー管理に散在していた右下FAB約19ファイルを統一（bottom-8/z-50/h-12 に統一）（2026-06-03）
- ポータルメニュー再構成「私たちの『らしさ』」 — 視点ワード構成（考え方／感じられ方／見え方・聞こえ方／接し方）。「見え方・聞こえ方」は展開式サブメニュー（ビジュアル／バーバル）、values/termsは配下に内包（ルート生存）。各ブランド掲示ページ見出しを「視点ワード ｜ 名詞」の二段表記に（管理画面は名詞のまま据え置き）（2026-06-03）
- タイムライン投稿UIのFAB＋モーダル化 — 常時表示の投稿カードを廃し右下FAB→モーダル。説明文はモーダル内 DialogDescription へ移設（2026-06-03）
- ブランドパーソナリティ独立編集ページ (/admin/brand/personality) — verbal からトーンオブボイス編集（状態・取得・`brand_personalities` 保存）を分離。サイドバーはブランド戦略の下（ビジュアルの上）。ポータルの personality 独立表示と対（2026-06-03）
- MVV「コピー＋説明文」分離表示 — `lib/brand-mvv.ts`（`splitBrandCopy`/`combineBrandCopy`、空行 `\n\n` 区切り）で mission/vision をキャッチコピー（大太字）と説明文（通常）に分離描画。表示6箇所（portal/guidelines・ダッシュボード・KPI参照・スマート名刺mission/vision・CIマニュアルPDF）に適用。編集フォーム（/admin/brand/guidelines）もコピー欄/説明文欄の2入力に分離（DBは mission/vision 各1カラムのまま）（2026-06-03）
- ブランド方針ページ UI ポリッシュ (/portal/guidelines) — ①ブランドストーリーを300字超で「もっと見る」折りたたみ（`ExpandableText`）②沿革タイムラインにドット連結の縦ライン（角丸クリップのレール）③行動指針・事業内容の左バーを「私たちの『らしさ』」カード同装飾（`absolute w-1` バー＋`overflow-hidden`角丸クリップ、青）に統一（2026-06-03）
- 全画面 UI 微調整 — ①H2セクション見出しを `text-sm`→`text-xs`（全ページ123箇所）②セクションカードの section 間余白を `space-y-6`（24px）に統一（portal表示3カード＋visuals/strategy＋admin編集3カード、最上段H2は不変）③サイドメニューの「らしさ」アイコンをダッシュボードに統一（感じられ方=Smile、接し方=Target）④ダッシュボード見出しを「私たちの『らしさ』」に変更＋Sparklesアイコン削除⑤バリュー説明欄を複数行入力化（登録順・カスタム両タブ）⑥ロゴ未登録時はサイドバー（admin/portal）のアイコン枠を非表示（2026-06-03）
- ブランド基盤の項目オーナーシップ再編（管理＋ポータル）（2026-06-03）
  - **行動指針**: brand_personas（先頭ペルソナ相乗り）→ **brand_guidelines.action_guidelines** へ移設（カラム追加＋データ移行）。編集はブランド方針。読み取り側（戦略/ポータルブランド方針/タイムラインのカテゴリ/管理ダッシュボード/CIマニュアル）も新カラム参照に更新
  - **特性(traits)**: ブランド方針 → ブランドパーソナリティへ移動（brand_guidelines.traits のまま、編集UIのみ移動）
  - **トーンオブボイス**: ブランドパーソナリティ → バーバルへ移動（brand_personalities.tone_of_voice のまま、管理・ポータル両方）
  - **パーソナリティ概要**: `brand_guidelines.personality_summary`(新規カラム) を新設。管理「ブランドパーソナリティ」で編集→ポータル「感じられ方」のレーダー下に表示
  - 管理サイドバー並び: ブランド方針→パーソナリティ→ビジュアル→バーバル→ブランド戦略→CIマニュアル出力
  - 各ブランド編集ページの「ポータルサブタイトル」入力欄を撤去（保存ロジックは残置＝既存値は保持）
- ブランドパーソナリティ拡充＋トーンオブボイス整理（2026-06-03）
  - 特性スコアを **1〜10 → 1〜5（5段階）** に統一（編集 max=5／レーダー domain=[0,5]／「/5」表記／CIマニュアルのバー幅 `score*20%`）
  - 特性を **3項目（カテゴリー=name / コピー=新規copyフィールド / 説明文=description）** に分離。jsonb のためマイグレーション不要、旧データは description の最初の改行で自動分割（`lib/brand-mvv.ts` の `resolveTraitCopy`）。ポータルは「カテゴリー(小)＋コピー(大)＋説明文」、編集は縦積みカード
  - **トーンオブボイス**: ポータル表示ラベルを「トーン＆マナー」→「トーンオブボイス」に改称。コピー＋説明文に分離（`splitToneOfVoice`＝空行区切り。**空行なしは全文を説明文**扱いで splitBrandCopy とは逆）。`combineBrandCopy` で結合し `tone_of_voice` 1列のまま（DB無変更）。管理(verbal)も2入力、CIマニュアル(verbal.tsx)も分割
  - ポータルダッシュボード4カード説明文を調整: トーンオブボイスを「感じられ方=ブランドの人格・キャラクター」から「見え方・聞こえ方=…（トーンオブボイス・用語ルール含む）」へ移動
- 入力プレースホルダーの固有名詞除去（システム全体）（2026-06-03） — placeholder に実在の社名/人名/クライアントのスローガン・MVV・特性コピーを使わないよう全件修正（リィツメディカル等6件を架空の汎用例に置換、`ueda@example.com`→`member@example.com` 等）。**CLAUDE.md コーディング規約に恒久ルール追記**（再発防止）
- ポータル ブランド掲示の4象限再配置＋ダッシュボード概観カード（2026-06-03・本番デプロイ済み） — 各ページ表示を「らしさ」4象限に再マッピング（DB無変更・表示レイヤーのみ）：考え方/guidelines＝MVV・バリュー・**提供価値（brand_values＋companies.provided_values、空なら非表示）**・行動指針・沿革・事業内容／感じられ方=新規 **/portal/personality**（人格traits＋トーンオブボイス＝旧verbalから移管。サイドバー「感じられ方」を verbal→personality に確定、breadcrumb/dynamic-title 登録）／見え方・聞こえ方=visuals＋verbal（用語ルール）／接し方=strategy（行動指針は guidelines へ移管済み）。**ダッシュボード `/portal` トップに4象限概観カード**（内部=紫violet/外部=緑emerald、Compass/Smile/Eye/Target、各ページへ遷移）。管理画面（/admin）は無変更
- ビデオラーニング機能 (/admin/learning・/portal/learning)（2026-06-03・本番デプロイ済み） — YouTube動画で社内学習（**浸透**レイヤー）。管理者が動画を登録/編集/削除/公開トグル/dnd並べ替え＋視聴分析（動画別カード=視聴人数/完了率/平均進捗/総再生回数＋メンバー×動画マトリクス、recharts）、メンバーはポータルで視聴し進捗（再生/到達度/完了）が記録される。視聴トラッキングは YouTube IFrame Player API（最初のPLAYINGでセッションINSERT→15秒間引きPATCH＋PAUSED/ENDED即送信＋離脱時keepalive、90%/ENDEDで完了）。DB: `learning_videos`/`learning_video_views`（1セッション=1行）。`lib/youtube.ts`(extractVideoId/getThumbnailUrl)・`components/learning/YouTubePlayer.tsx`。**登録＝即公開**（ダイアログ初期値=公開）
- スマート名刺カバー写真＝コンセプトビジュアル＋事業内容の縦線統一 (/card/[slug])（2026-06-03・本番デプロイ済み、commit 1b37c27） — ①名刺ヘッダーのカバー写真を「個人カバー(profile.cover_image_url) → 企業のコンセプトビジュアル(`brand_guidelines.concept_visuals[0]`／空なら `concept_visual_url`) → ブランドカラー無地」の優先順で適用（DB無変更・表示レイヤーのみ）②事業内容の縦線を border-l-2（角丸沿い2px）からポータル同装飾の `absolute w-1` 全高バー＋`overflow-hidden`角丸クリップ＋`pl-5` に統一。**色はブランドアクセント維持**（ポータルは固定blue-600）
- ロゴ基本形画像（ビジュアル）（2026-06-03・本番デプロイ済み、commit f748f80） — ビジュアル編集のロゴコンセプト上に「ロゴ基本形」を新設。**複数枚＋キャプション**対応（ロゴガイドラインと同様）。DB: `brand_visuals.logo_images(jsonb配列 {url,caption})`。ポータル「見え方」では**枠なし表示＋クリックで拡大**（既存の `setModalImage` 拡大ダイアログ再利用）＋キャプション。**保存不具合2点を修正**: ①logo_images カラム追加後の PostgREST スキーマキャッシュ未reloadで保存が PGRST204 失敗 → reload実行 ②保存成功時にページキャッシュ未更新で他ページ往復すると消える → 保存後に `setPageCache` で最新反映
- 「見え方・聞こえ方」タブ名＆アイコン統一（2026-06-03・本番デプロイ済み、commit d1d7150） — ポータルのブランド表現タブ（`BrandExpressionTabs`）を「ビジュアル/バーバル」→**「見え方/聞こえ方」**に改称。見え方タブのアイコンを Palette→**Eye**（サイドメニューと統一）。管理サイドバーの「ビジュアル」アイコンも Palette→Eye に変更
- ポータル「見え方・聞こえ方」をサブメニュー廃止→タブ切替化＋ダッシュボード調整（2026-06-03・本番デプロイ済み、commit d1d7150/444db65） — ①サイドメニューの「見え方・聞こえ方」を展開式サブメニュー（ビジュアル/バーバル）から**単一リンク**（/portal/visuals）に変更。ビジュアル/バーバルの切替は **`BrandExpressionTabs`（ページ上部タブ）** に移管（visuals/verbal 両ページ先頭に配置）②ダッシュボード4象限カードの説明文調整（考え方=「…行動指針・**ストーリー**」に変更＝沿革・事業内容を省略、ページ表示は残置）③**ダッシュボード4カードを等高化**（grid に `auto-rows-fr`＋外側Linkに `h-full`。グリッド行→Link→Card の高さチェーンを通し、説明文の行数差で高さがバラつく問題を解消）
- タイムライン系ラベルを「分析」表記に統一（2026-06-03・本番デプロイ済み、commit 4614522） — ポータルダッシュボードの「あなたのブランドコミット」→「**あなたのタイムライン分析**」、管理ダッシュボードの共通タブ「タイムライン投稿」→「**タイムライン分析**」（dashboard/analytics/brand-score の3画面で共有するタブ定義をすべて更新）
- ポータル ラーニング動画グリッドをPC時3カラム化（2026-06-03・本番デプロイ済み、commit 79e88be） — `/portal/learning` の動画グリッドを `sm:grid-cols-2` → `lg:grid-cols-3`（モバイル1列/タブレット2列/PC3列）。本体＋ローディングスケルトン両方
- Disk IO 最適化（Supabase「Disk IO Budget枯渇」通知への対応）（2026-06-04・本番DB適用＋デプロイ済み、commit 0729186） — 診断: 認証(auth)系テーブルへの大量seq scanが主因（RLSが `auth.uid()` を行ごと再評価）。対応: ①不足FKインデックス**29本**追加（advisor `unindexed_foreign_keys` → 残0）②RLSの `auth.uid()/jwt()` を `(select …)` でラップ**40ポリシー**（advisor `auth_rls_initplan` → 残0、**アクセス制御ロジックは不変**・認証ユーザーで閲覧可を検証済み）③ラーニング視聴進捗のPATCH間隔 15秒→30秒（書き込み半減）。SQLは `supabase/migrations/2026...disk_io_*.sql` に記録。残課題: `multiple_permissive_policies`(31)整理、必要なら compute add-on アップグレード（有料・要ユーザー操作）
- 管理メニュー整理＋画像拡大の閉じるボタン修正（2026-06-04・本番デプロイ済み、commit a4c5c8e） — ①管理サイドバーの「設定」を独立項目→ユーザーメニュー（アバターのドロップダウン）内「サービス画面」の上に移動 ②ポータル画像拡大ダイアログ（`/portal/visuals` の `setModalImage` ライトボックス）の閉じるボタンが画像外に浮く問題を修正：既定の DialogContent クローズボタンを `[&>button]:hidden` で隠し、画像を `relative w-fit` で包んで右上角に固定したカスタム×（黒半透明丸＋白X）に置換
- ロゴ基本形=複数枚＋キャプション＋画像カード共通化（2026-06-03・本番デプロイ済み、commit 79e88be） — `brand_visuals.logo_images` を `string[]`→`{url,caption}[]` に変更（キャプション対応・旧文字列配列は読込時に自動変換）。管理は `CaptionedImageCard`（サムネ＋削除確認＋キャプション、dragHandle任意）、ポータルは `PortalImageCard`（クリック拡大＋キャプション）を新設し、ロゴ基本形・ロゴガイドライン・（管理は）ビジュアルガイドラインで共用。ポータルのロゴ基本形は**2カラム**＋画像一回り大きく（h-220）＋ロゴが切れない `object-contain`
- ブランド戦略「ターゲット概要」と「主なターゲット」の分離（2026-06-03・本番デプロイ済み、commit 79e88be） — 管理に「**ターゲット概要**」テキストエリアを新設（`brand_personas[0].target` を直接編集。旧：セグメントから箇条書き自動生成して上書き、を廃止）。「主なターゲット」＝`companies.target_segments` と**別フィールドで独立管理**。ポータル戦略は **概要文＋主なターゲット（名称＋説明カード）の両方**を表示（管理入力がポータルに出ない不整合・概要文が消える不具合を解消）。各保存後 `setPageCache` 更新
- ブランド理解度テスト (/admin/brand-score/quizzes, /portal/quiz/[id])（2026-06-04・DB本番適用済み migration 20260603000000／**本番デプロイ済み** commit ca0eae9＋AI設問の質改善 17c314f） — 記名式クイズ・AI設問生成（ブランドデータが正解キー、関係/理由型＋conceptタグ、カラーは名称/役割で出題しHEX禁止）・k匿名集計・共感×知識ギャップ分析・本人結果（解説付き学習）・生成ダイアログUI改善
- 未使用コード・依存の一掃（2026-06-04・本番デプロイ済み、commit a2f98d6） — `knip` で検出した死んだファイル9個（旧Sidebar/PortalHeaderContext/PortalStyles/StepPlaceholder×2/ProgressBar/OuterScoreSection/ui-alert/ui-checkbox）、未使用依存3個（next-themes/@radix-ui/react-checkbox/pg）、完全未使用export（color-utils 4関数・portal-subtitles・page-cache.clearPageCache・AdminStyles・pdf-styles.A4）、本番デバッグログ `console.log/debug/info` 122行を削除。`console.error/warn` は維持。tsc/eslint/next build 全パス
- コードレビュー指摘の修正（2026-06-04・本番デプロイ済み、commit 01aab2f） — xhigh recall レビューで検出した6件を修正：①AppAuth/Admin/PortalDataProvider のログアウト・ユーザー切替時に企業/プロフィール/権限 state をリセットし**前ユーザーのデータ残存（同タブA→Bログイン時の漏れ）を防止** ②AppAuthProvider の signOut を useCallback・context value を useMemo 化（Admin/Portal の contextValue も）で**不要な再レンダー解消**（user?.id 依存最適化を実効化） ③理解度テスト生成数入力を 0〜20 にクランプしサーバー normalizeCount と一致（表示と実生成の乖離解消） ④timeline スケルトンのカテゴリピルを実描画と同条件 `categories.length>1` に整合 ⑤ci-manual/data-fetcher の console.log 削除で残った空 if ブロック整理
- 提供価値を「考え方｜ブランド方針」→「接し方｜ブランド戦略」へ移動（案A：編集統合）（2026-06-04・本番デプロイ済み、commit e228f12） — 提供価値（Value Proposition）は顧客起点の概念のため、顧客との関係を扱う「接し方」へ移設。**表示**：ポータル4象限カード文言を 考え方=「MVV・バリュー・行動指針・ストーリー」／接し方=「顧客ターゲット・ペルソナ・ポジショニング・提供価値」に変更。`/portal/guidelines`（考え方）から提供価値の取得・統合・表示を**除去**、`/portal/strategy`（接し方）に提供価値（`brand_values`＋`companies.provided_values`、空なら非表示）の統合表示を**追加**。**編集**：`/admin/brand/strategy`（ブランド戦略）に提供価値（`brand_values`）編集セクションを統合（旧 `/admin/brand/values` の全削除→全INSERT保存ロジックを移植）、`/admin/brand/values` 単独ページは `/admin/brand/strategy` へ**リダイレクトで吸収**。**データテーブルは `brand_values` のまま（DBスキーマ変更なし）**。`companies.provided_values`（ID INC. 1社のレガシー text[]）の brand_values 統合・廃止、テーブル名 `brand_values` リネーム、`/portal/values` 孤立ページ整理は別途（将来）
- PWAステップ④ Web Push 通知（お知らせ公開時に配信）（2026-06-09・本番デプロイ済み、commit 8fd6717／DB適用済み migration 20260609015938／VAPID環境変数 設定済み） — お知らせ公開時に、通知をオンにした企業メンバーの端末へプッシュ通知を送る。①DB: `push_subscriptions`（user/company/endpoint/keys・RLS本人のみ・配信はservice_role）②`web-push` 導入＋VAPID鍵（env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`、Vercel Production設定済み）③`app/sw.ts` に `push`/`notificationclick`（通知タップで該当URLへ）④API `/api/push/{subscribe,unsubscribe,announce}`（cookie認証→service_role、announceは企業adminを検証、無効購読404/410を自動削除）⑤`components/pwa/PushToggle`（通知オン/オフ・iOS非対応時は案内）を**マイプロフィール**に設置⑥`AnnouncementCreateDialog` 公開成功時に `/api/push/announce` をfire-and-forget。**iOS制約: ホーム画面追加PWA(standalone)＋iOS16.4以上＋ユーザー許可が必要**。お知らせ編集からの公開（下書き→公開）への送信は未対応（次バッチ候補）
- モバイル本文段落の引き上げ（C案）＋ヘッダーアイコン統一＋PWAアイコン白黒反転（2026-06-07・本番デプロイ済み、commit 532e6b6/85b04b1） — ①**C案（本文だけ・スマホ16px/PC14px）**: ポータル全体の本文段落（説明文・ストーリー・ミッション本文等、`leading-[1.8/1.9]`/`leading-relaxed`/`whitespace-pre-*` を伴う読ませる段落）に `text-base sm:text-sm` を付与（16ファイル37段落）。見出し/ラベル/リンク/ボタン/バッジ/エラーバナーは対象外。コードモッド `scripts/codemod-mobile-body.mjs`（ローカルのみ・未コミット）で機械適用→origin/main基点worktreeで再実行しデプロイ。実測: 375px=16px / 664px=14px（`sm:`640px切替）。**過去の「モバイルroot17px底上げ(de6656c)」は案A(4d21680)で撤去済み**で、本件がその代替（本文のみ・モバイル限定）②**ヘッダーアイコン統一**: `PortalLayoutClient` のサイドバートグル(16px)/ベル(20px)の不揃いを **22px・枠40px(size-10)** に統一（全ポータル画面共通）③**PWAアプリアイコン白黒反転**(commit 85b04b1): 濃灰背景＋白マーク→**白背景＋濃マーク#1a1a1a**（icon-192/512・maskable・apple-icon再生成、`gen-pwa-icons.mjs` の BG/FG入替）。favicon(`app/icon.svg`)は据え置き。**iOSはホーム画面再追加でアイコン更新**
- 認証前ページUI引き上げ（ログイン/サインアップ/管理ログイン）（2026-06-07・本番デプロイ済み、commit 3bca687） — グラスモーフィズム系の認証前3画面（`/portal/auth`明・`/admin/login`暗・`/signup`多段）を一回り大きく。ロゴ32→40px、サブテキスト/ラベル `text-xs→text-base(16px)`、入力欄 `h-10→h-12(48px)`＋`text-base md:text-base`（PC含め16px固定＝**iOS入力時の自動ズーム防止**）、Google/ログイン等ボタン `h-11→h-14(56px)`・主ボタン`text-lg(18px)`・Google SVG `h-5→h-6`、区切り/リンク補足 `text-xs→text-sm`。共通`Button`は未使用（生button）、共通`Input`はclassNameでスコープしadmin等のフォームに波及なし（`components/ui/input.tsx`無変更）。375px実測: 入力16px/overflow0/iosZoomSafe true。ツール認証(`/tools/*/auth`)は対象外（次バッチ候補）
- ポータルUI 案A ダッシュボード基本サイズ引き上げ（2026-06-07・本番デプロイ済み、commit 4d21680） — include.bz調査（root16px固定＋コンポーネントを最初から14-16px/見出し16-18pxで設計、ズーム・root底上げ無し）を踏まえ方針転換。**前ターンの暫定 root 17px 底上げ（globals.css）を撤去**し root を16pxに戻したうえで、**ダッシュボード(/portal トップ)1画面のみ**コンポーネント基本サイズをPC含め引き上げ。セクション見出しeyebrow×5（お知らせ/ミッション/らしさ/目標KPI/タイムライン分析）と4象限カードのサブラベル/説明を `text-xs(12px)→text-sm(14px)`、4象限アイコン `size-10/icon20→size-11/icon24`、矢印16→18、サーベイ/理解度テストバナー（dashboard専用）の見出し14→16・補足12→14・ボタン32→**44px(h-11)**。大見出し（スローガン36px/ミッションコピー24px/4象限タイトル18px）は据え置き＝間延び回避。検証: 型0・/portal 200・横オーバーフロー無し想定。**残: 実機(PC/モバイル)で適量確認→OKならポータル他画面(guidelines/strategy/visuals/personality/timeline/kpi等)とヘッダー共通部(PortalLayoutClientのトグル/ベル)へ横展開（次バッチ）**
- モバイルUI底上げ第一弾 ルートフォントサイズ（2026-06-07・本番デプロイ済み、commit de6656c） — PWA実機の「全体が一回り小さい」問題の対応。診断で原因は**ページスケールではなくデザイン上のモバイルサイズ感**と確定（viewport は `device-width/initial-scale=1` で正常・横オーバーフロー無し・375pxで `scrollWidth==innerWidth` を実測確認）。対応として `app/globals.css` に **`@media (max-width:639.98px){ html{font-size:17px} }`**（16→17px・+6.25%）を追加。PCのコンパクト設計（見出し`text-xs`等）は維持しつつ、sm未満のみ rem基準のTailwind値（文字・余白・`h-*`）が一律約6%拡大。marketing崩れ無し（リセット不要）。前ターンの診断で一時追加した `viewportFit:'cover'` は revert 済み（safe-area対応とセットの別バッチへ）。**第二弾候補（実機判断後）**: モバイル時の px固定 lucideアイコン（`size={N}` 約98件）の底上げ、タップターゲット<44px（`h-9≈38px`/`h-10≈42.5px`）の調整、`viewport-fit:cover`+`safe-area`のPWA没入対応
- PWAステップ③ 更新通知UI＋ChunkLoadError対策（2026-06-07・本番デプロイ済み、commit 1ead410） — SWを `skipWaiting:true→false`（新SWを待機）＋ `register:false`（自動登録オフ）に変更し、`components/pwa/PWAUpdatePrompt.tsx` で `@serwist/window` 手動登録→`waiting` 検知で sonner トースト「新しいバージョンがあります」→「更新」クリックで `messageSkipWaiting()`→`controlling` でそのタブのみリロード。**ChunkLoadError 自動リカバリ**（sessionStorageで1セッション1回・無限ループ防止）も同梱、devは早期return。layoutに配置。`skipWaiting:false` が ChunkLoadError 対策の本体（旧タブは更新するまで旧チャンク供給）。authBypass先頭順序・clientsClaim・fallbacks は不変＝認証バイパス回帰なし。CLAUDE.mdに skipWaiting:false が正である旨を追記。検証: webpackビルド成功・sw.jsにSKIP_WAITING待機処理＋認証バイパス確認・@serwist/window手動登録バンドル確認・型0。**残: 実機で更新フロー（waiting→トースト→更新→activated）・複数タブChunkLoadError無し・回帰(A→B非漏洩)の確認。スコープ外=Web Push/バックグラウンド同期/オフライン書込**
- PWAステップ② Service Worker導入（serwist）（2026-06-07・本番デプロイ済み、commit 6f1a9f4） — `@serwist/next`＋`serwist` でSW導入し、(a)Android Chromeのインストール要件充足（fetch handler）(b)静的資産キャッシュで再訪高速化(c)オフライン汎用フォールバック。**最重要のキャッシュ安全設計**: `app/sw.ts` で認証配下（/portal /admin /superadmin /api）を `NetworkOnly` で **defaultCache より先回りマッチ**＝認証HTML/RSC/APIは常にネット直行でキャッシュ汚染ゼロ（A→Bログイン時の前ユーザーデータ露出をディスク永続レベルで構造的に防止）。残りは `defaultCache`（静的=CacheFirst/SWR、公開ページ=NetworkFirst）。`app/offline/page.tsx`＝認証情報を含まない静的フォールバック。skipWaiting/clientsClaim/navigationPreload 有効。`public/sw.js` は gitignore（ビルド生成物）。**Next.js16のTurbopackと@serwist/next(webpack注入)が衝突するため、本番ビルドのみserwist適用＋`build`を`next build --webpack`に変更（devはTurbopack維持・SWはdev無効）**。middleware matcherに sw.js/manifest.webmanifest/offline 除外、tsconfigに webworker/typings/exclude 追加。検証: webpackビルド成功・sw.js生成・認証バイパス確認・/offline描画・型0。**残: 実機でSW登録/認証NetworkOnly/A→B非漏洩/オフライン/Androidインストールの確認。スコープ外=更新通知UI(ステップ③)・Web Push**
- PWAステップ① manifest＋アイコン＋メタタグ（2026-06-07・本番デプロイ済み、commit e92960c） — スマホ「ホーム画面に追加」でスタンドアロン（アプリ風）起動を可能化。①`app/manifest.ts`（name/short_name、`display:standalone`、theme/background=#fff、ja/business、アイコン3種、**`start_url:/portal`**＝インストール版はポータルダッシュボード起点／未ログインは /portal がクライアント側で /portal/auth へ誘導。commit 24decc3）②アプリアイコンをブランドマーク（logo.svgの幾何学シンボル・フォント非依存）で生成＝`public/icons/icon-192/512.png`(any・角丸)＋`icon-maskable-512.png`(maskable・全面塗り)＋`app/apple-icon.png`(180・iOS)③`app/layout.tsx` に `viewport`(device-width＋theme-color)・`appleWebApp`(capable/title/status-bar)・`applicationName`・旧iOS(<16.4)互換の `apple-mobile-web-app-capable`④生成スクリプト `scripts/gen-pwa-icons.mjs`(sharp)。**iOSはスタンドアロン起動可。Android自動インストールプロンプトとオフライン動作はSW必須＝ステップ②で対応予定**
- マイページ振り分け修正＋LP「無料で始める」導線（2026-06-07・本番デプロイ済み、commit e92960c） — ①`/mypage` を「スーパー管理者のみ /superadmin/companies、一般管理者・メンバーは /portal」に変更（従来は一般管理者が /admin/dashboard に着地。管理画面へはポータルのサイドメニューから遷移可）②LPヒーロー「無料で始める」のリンクを `/contact`→`/signup` に変更（下部CTA「お問い合わせ」は /contact 据え置き）
- スケルトンローディングを実構造に整合（全16ページ）（2026-06-04・本番デプロイ済み、commit 3d987d3） — ローディング時のスケルトンが実際の描画（段組数・カード/セクション数・レイアウト種別）と乖離していた問題を全ページ点検し修正。**ポータル**: dashboard=4象限を誤 `grid-cols-3`→`grid-cols-2`＋KPIバナー/統計整合、guidelines=4セクション構成、visuals=タイトル→タブ＋ガイドライン4枚目追加、strategy=移設済み行動指針カード除去、kpi=進捗バー＋3カード、timeline=廃止した常時投稿フォーム除去→フィルタ/検索行＋投稿カード。**管理**: analytics=サマリ4→3＋最終2列、brand/{guidelines,personality,values,verbal,visuals}=カード数・項目整合、brand/strategy=タイトル＋タブ＋3カード→2カード、company=タイトル除去＋ロゴ＋5項目、members-portal=タイトル除去。**スーパー管理**: companies=ヘッダーのタイトル＋ボタン除去（新規登録は右下FAB）＋先頭列を画像→テキスト。stale なタイトル/タブ要素を整理、型エラー0。**理解度テスト等の未完成分は持ち込まず、別worktree経由でスケルトン16ファイルのみ main に載せて本番デプロイ**
- ビデオラーニング カテゴリー>テーマ階層化（2026-06-08・本番デプロイ済み、commit 64546fa） — 動画を「**カテゴリー（大分類）> テーマ（学習レベル）> 動画**」の2階層で整理。DB: `learning_categories`/`learning_themes` 新設＋`learning_videos.theme_id`（RLS有効ポリシー0／**テーマ削除→動画は theme_id=NULL で生存**=SET NULL、**カテゴリ削除→テーマCASCADE**）。API（service_role）: categories/themes の CRUD＋reorder、`/api/learning/structure`（カテゴリ>テーマ>動画ネスト＋テーマ配下 **video_count 自動算出**、`?published=true`でポータル用=公開のみ＋自分の進捗）。`videos` POST/PATCH に `theme_id` 対応（**既存 `/api/learning/videos` GET 応答形は不変**）。管理 `/admin/learning`＝「動画（カテゴリー>テーマでグルーピング＋未分類）」「カテゴリー・テーマ」の2タブ＋動画ダイアログにカテゴリー→テーマ2段選択。ポータル `/portal/learning`＝階層表示＋テーマ「○本」バッジ、未分類は末尾「その他」。1動画=1テーマ（複数所属は将来）。既存 `learning_videos.category`(text) はレガシー残置（未使用）。視聴トラッキング/進捗/視聴分析(`/admin/analytics/learning`)は不変
- **ブランド理念オントロジー実装（要素ID化＋型付き関係グラフ＋整合性チェック）**（2026-06-09〜10・本番デプロイ済み） — ブランド体系を「自由文/jsonb」から「ID付き要素＋関係グラフ」へ正規化し、AI参照・整合性点検を可能にした。**全段階 dual-run（新テーブル稼働→読取り切替→編集切替→デプロイ→旧列DROP）を厳守**。
  - **理念要素のID化 `philosophy_elements`**: mission/vision/value/action_guideline/**service（事業内容）** を 1行=1要素 のテーブルへ正規化（旧 `brand_guidelines` の mission/vision(text)・values/action_guidelines/business_content(jsonb) を撤去）。表示（card/portal/guidelines/ci-manual）・AI（targets/competitors/quiz設問/brand-data）・編集（`/admin/brand/guidelines` を行差分CRUDへ）・`tools/shared-profile`（読み書き同期）を全て新テーブルへ切替。旧列は退避テーブル `archive_brand_guidelines_*`（RLS有効・ポリシー無し=service_role限定）へバックアップ後 DROP。取得は `lib/brand/philosophy.ts`（`fetchPhilosophy`）に集約
  - **型付き関係グラフ `element_relations`**: 5種（philosophy_element/value_proposition/proof_point/governance_rule/persona）をポリモーフィック端点(kind+id)で結ぶ関係（guides/evidencedBy/promisedTo/communicatedAs/constrainedBy/conflictsWith）。端点存在＋同一company を SECURITY DEFINER トリガで担保（自己参照/重複はDB制約）。superadmin 企業詳細にオーサリングUI、AI草案生成6ルートへ関係要約を注入（`lib/brand/relations.ts`）。テックブリッジに実関係5件を投入し before/after でAI出力反映を実証
  - **整合性チェック**: ①決定論（`lib/brand/integrity.ts`・5チェック=証拠なき約束/孤立証拠/用語違反/矛盾明示/証拠鮮度）②AI判定（`lib/brand/integrity-ai.ts`・governance_rules の tone/claim/discouraged を Claude が実テキスト評価＋修正案。1社1回呼び出し・NG/OK例few-shot・引用バリデーションでハルシネーション防護）。superadmin 企業詳細に「チェック実行（決定論）」「AI判定を実行」パネル（**読み取り専用・自動修正なし**）

---

## 4. 残タスク

### 🔴 Phase 2（進行中）
- [ ] タイムライン機能の完成
- [ ] KPI管理機能の完成
- [ ] Brand Scoreダッシュボードの改善

### 🟢 UI/導線（フォローアップ）
- [x] ~~ブランドパーソナリティの人格(traits)編集を `/admin/brand/personality` に集約~~ ✅ traits をパーソナリティへ、トーンをバーバルへ移動して整理（2026-06-03）
- [x] ~~ポータルメニュー「感じられ方」のリンク先を /portal/personality（独立ページ）へ確定する~~ ✅ サイドバーを /portal/verbal → **/portal/personality** に変更＋アクティブ判定追加、breadcrumb/dynamic-title に personality 登録、ダッシュボードに「らしさ」4象限概観カード設置。本番デプロイ済み（2026-06-03）

### 🟠 本番準備
- [ ] RLSポリシー設定（全テーブル）
- [ ] Stripe決済連携
- [x] ~~認証フロー整備~~ ✅ ドメイン認証・承認制参加・サインアップUI刷新・ログイン専用化完了
- [x] ~~認証システム抜本改修~~ ✅ @supabase/ssr 移行・cookieベース・Provider統合（2026-06-02）
- [ ] `flowType: 'pkce'` への変更（別フェーズ。既存セッション全無効化リスクあり）
- [ ] middleware.ts → proxy.ts へリネーム（Next.js 16 deprecation 警告対応）
- [ ] STP無料上限のテスト対応恒久化（案①: `@include.bz` 等のホワイトリスト分岐を `sessions/route.ts` に追加／案②: `FREE_LIMIT` をenv化しテスト環境のみ大きい値）。未実装。現状はDB手動リセットで都度対応

### 🟡 Phase 3 残り
- [ ] 理念策定ツール（/tools/philosophy）
- [ ] コピーライティングツール（/tools/copy）

### 🔵 保留
- [ ] RAG（pgvector）によるAIブランドアドバイザー
- [ ] 理解度スコアを `brand_score_snapshots` / スコア推移グラフへ統合（知識も時系列で追う）
- [ ] generate-questions の出題バリエーション微調整（短文ビジョンのTF逐語化・否定形の単調さ）
- [ ] 理解度テストのリマインドメール、再受験対応

---

## 5. 技術メモ・教訓

| 日付 | 内容 |
|------|------|
| — | supabaseクライアントのauth設定にlock:false必須（LockManagerタイムアウト回避） |
| — | QRコードは1000x1000px高解像度対応 |
| — | provided_valuesはPostgreSQL配列型（text[]） |
| 2026-03-31 | ドメイン認証: companies.email_domain カラム追加、フリーメール除外リスト（gmail, yahoo等）で企業ドメインのみマッチ |
| 2026-03-31 | 承認制参加: members.status='pending'→管理者承認で'active'。拒否時はmember+profile+auth user削除 |
| 2026-03-31 | /portal/auth はログイン専用化、新規登録は全て /signup 経由に統一（Google OAuth含む） |
| 2026-03-31 | UIラベル統一: 「企業名またはブランド名」を全画面（signup, admin, STP, colors, persona）で使用 |
| 2026-04-06 | companies.mvv / brand_color_primary / brand_color_secondary / brand_story のAI参照を brand_guidelines / brand_visuals へ移行。スーパー管理画面からUI削除 |
| 2026-04-06 | スーパー管理画面: 企業カスケード削除API、管理者テーブルにメール・名前表示 |
| 2026-04-06 | ミニアプリ全3種にAutoSaveIndicator追加（Google Docs風、saving→saved→fade out） |
| 2026-04-06 | STP Step5: TargetingDisplay / PositioningDisplay にtitle・showIcon propsで表示カスタマイズ（ポータル/管理画面に影響なし） |
| 2026-06-02 | STP無料プラン上限: `app/api/tools/stp/sessions/route.ts` の `FREE_LIMIT = 3`。`status='completed'` のセッション数でカウント（作成のみ・in_progressは対象外）。管理者/特定ドメインのバイパス分岐は無し（admin_users参照はcompany_id紐付け用のみ） |
| 2026-06-02 | テスト対応: kitakawa@include.bz の完了済みセッション3件を `archived` に退避しカウントを0にリセット（個別データ操作。制限ロジック自体は全ユーザーで有効のまま）。本アカウントは今後さらに3件completeすると再ロックする |
| 2026-06-02 | 参加リクエスト通知: Resend (`noreply@branding.bz`) を `/api/signup/join-company` と `/api/members/join-requests` (approve分岐) に組み込み。管理者宛は `admin_users.auth_id` → `supabaseAdmin.auth.admin.getUserById()` でメール解決。`RESEND_API_KEY` 未設定時はスキップ、送信失敗時も本処理は成功扱い（contact APIと同パターン） |
| 2026-06-02 | members status フィルタ: `/admin/members` 一覧クエリは `is_active` で「有効/無効」を表示するため status フィルタを掛けていなかった。pending メンバーを除外する際 PostgreSQL の `!= 'pending'` は NULL を除外してしまい既存レコードが消えるリスクがあるため、SELECT に `status` を含めて **クライアント側で `.filter(m => m.status !== 'pending')`** する方式を採用 |
| 2026-06-02 | **認証「読み込み中」固まりの根本原因＝自前lock実装の単一障害点**。@supabase/ssr へ移行し cookie ベース＋middleware.ts の getUser() で期限切れトークン自動リフレッシュ。lock 上書きは廃止（旧「lock:false必須」メモは無効化） |
| 2026-06-02 | AuthProvider 6種（admin/portal/superadmin/tools/stp/unified）を AppAuthProvider（セッション層）+ AdminData/PortalDataProvider（データ層）に統合。旧 hook（useAuth/usePortalAuth等）は alias で互換維持し既存88箇所は無変更。診断レポート: `docs/auth-diagnosis-report.md` |
| 2026-06-02 | **@supabase/realtime-js@2.106.2 は phoenix サブモジュール欠落バグ**で middleware が Module not found→全ページ500。package.json overrides で 2.105.4 に固定して回避 |
| 2026-06-02 | Header.tsx の isLoggedIn 分岐は SSR/CSR 差で Hydration mismatch → mounted フラグで初期表示をSSRと一致させてからCSRで切替 |
| 2026-06-02 | マイページ遷移を高速化: クライアントで getUser+admin_users を待たず /mypage Server Component で cookie 判定し 307 即リダイレクト |
| 2026-06-02 | ログイン/登録ページ（admin/login, portal/auth, signup）のロゴリンクは絶対URLでなく相対パス `/` に。プレビュー環境のlocalhost外ブロック回避＋全環境で正しく動作 |
| 2026-06-02 | メンバー削除は Service Role API（/api/members/[id]）で timeline投稿/いいね/コメント→members→profiles→auth.users をFK順に連鎖削除。孤立auth.users復旧用に /api/members/cleanup-orphan と管理画面UIを追加 |
| 2026-06-03 | **機能トグルは配列駆動**。`lib/constants/feature-toggles.ts` の `FEATURE_TOGGLES` が唯一の定義源（key=companiesのbooleanカラム名）。設定ページは配列をmap、PATCH API（/api/admin/settings, service_role, company_idガード）は `FEATURE_TOGGLE_COLUMNS` で許可カラム判定、両Providerの companies select も同配列をspread展開。→ 新機能は **companiesにカラム追加＋配列に1行** で全箇所自動対応。判定は全箇所 `isFeatureEnabled(company, key)`（`!== false` 方式＝null/未追加でも有効扱い） |
| 2026-06-03 | 出し分け方針: タイムライン/KPIは社内に閉じるためサイドバー項目＋各ページ＋ポータルトップのウィジェット＋管理ダッシュボードのタブを非表示。**スマート名刺は公開ページ /card/[slug] を門番ガード**（認証外のサーバーComponentで `companies(*)` joinの `card_enabled` を見て「非公開」表示。slug発行ロジックとデータは不変、再オンで一斉復活） |
| 2026-06-03 | `card_enabled` は **profiles と companies の両テーブルに存在**。profiles.card_enabled=個人ごとの名刺公開フラグ（/card の既存 `.eq('card_enabled', true)` フィルタ）、companies.card_enabled=今回追加の会社単位トグル。**別物**。公開ページは両方を独立に評価 |
| 2026-06-03 | `/admin/analytics`（アクセス解析）にアウター指標は同居していない（純粋な名刺閲覧解析）。`OuterScoreSection.tsx` はフォルダにあるが **どこからもimportされていない孤立ファイル**。アウタースコアは `/admin/brand-score` 側で `/api/analytics/outer-score` 経由表示（名刺トグルでは触らない） |
| 2026-06-03 | **コンセプトビジュアルは新カラム `concept_visuals(jsonb配列)` とレガシー `concept_visual_url(単一URL)` の二重持ち**。保存時に `concept_visuals[0]` を `concept_visual_url` へ必ず同期（CIマニュアル表紙 `lib/ci-manual/sections/cover.tsx` とseedが単一URLを参照するため）。読込は新カラム優先・空ならレガシーを1枚として配列化。portalスライドショーは `app/portal/guidelines/ConceptVisualSlideshow.tsx`（カルーセルlib未導入のため自前実装、枠高さは先頭画像で固定しobject-cover敷き詰め）。アップロード先は `brand-assets` バケット `{companyId}/concept-visuals/` |
| 2026-06-03 | **Supabase MCP `apply_migration` でカラム追加してもPostgRESTのスキーマキャッシュが自動リロードされない**ことがある（このプロジェクトはDDL用イベントトリガー未設置の疑い）。新カラムを含むPATCH/INSERTが `PGRST204 column not found in schema cache` で失敗 → 保存できない症状。対処は `NOTIFY pgrst, 'reload schema';` を execute_sql で実行。dev/prod は同一Supabaseプロジェクトなので一度直せば両方解消 |
| 2026-06-03 | **ポータルのアクセス権は `members` 行（auth_id + is_active=true）で判定**（`PortalDataProvider`）。管理画面は別系統で `admin_users` 判定。企業＋初期ユーザーを作る処理は admin_users だけでなく **profiles＋members も必ず作る**（手本: `app/api/members/create/route.ts`）。members 無し＝管理画面は入れるがポータルは「アクセス権限がありません」 |
| 2026-06-03 | **brand_* 行は企業作成時に作られず、各編集ページ初回保存で upsert される**。管理ブランドページ（guidelines/verbal/visuals）の `brand_*` 取得は `.single()` でなく **`.maybeSingle()`**（新規企業は0件で `.single()` だと PGRST116→「データの取得に失敗しました」）。配列取得（`.order()`）の values/personas/terms は0件でも問題なし |
| 2026-06-03 | **ブランド表示の真の参照元は `brand_guidelines`/`brand_visuals`**。`companies.slogan/mvv/brand_color_*` は表示にほぼ未使用の孤立カラム（mvv/secondaryはデッド、primaryはCIマニュアルのフォールバックのみ）。新規企業モーダルから当該入力UIを削除済み |
| 2026-06-03 | **ポータルの slogan 漏洩バグ**: ダッシュボード見出し/サイドバーは `PortalDataProvider.slogan`（=brand_guidelines.slogan）を表示。行が無い企業で `setSlogan` を呼ばないと前に見た企業の値が残る。→ 無条件 set ＋ fetch 開始時に null リセットで解消。slogan 空のときダッシュボード大見出しは非表示 |
| 2026-06-03 | **右下FABは共通コンポーネント `components/ui/fab.tsx`（Fab/FabButton）を使う**。生の `<div className="fixed bottom-...">` は新規に書かない。variant=primary(黒)/secondary(白枠)、icon/type(submit)/form/disabled を受ける。ローディング切替は呼び出し側で icon と children を出し分け |
| 2026-06-03 | **mission/vision は「コピー＋空行＋説明文」を1カラムに保存**。表示側は `lib/brand-mvv.ts` の `splitBrandCopy()`（最初の空行 `/\n\s*\n/` で2分割、空行なしは全文コピー扱い）で出し分け、編集側は `combineBrandCopy()` で再結合。DBスキーマ・編集の運用（1テキスト）は不変。説明文の表示は `whitespace-pre-line` で改行保持（card/kpi にも付与済み） |
| 2026-06-03 | **左端カラーバー装飾は「らしさ」カード方式**＝`relative overflow-hidden rounded-*` の上に `absolute left-0 top-0 bottom-0 w-1 bg-*` を重ね、カードの角丸でクリップして丸端に見せる（`border-l-2` の直線とは別物）。行動指針・事業内容もこの方式（青）に統一。内側は `pl-5` でバーと本文の重なり回避 |
| 2026-06-03 | **セクション見出しH2は `text-xs font-bold ... tracking-wide`**（旧 text-sm から1段階縮小、全123箇所）。複数H2を縦に積むセクションカードは `CardContent` の `space-y-6`（24px）で section 間を空け、`space-y` 仕様で最上段H2のみ余白据え置き。マーケLP/ツールの大見出し（text-xl/2xl/4xl）は対象外 |
| 2026-06-03 | **管理サイドバーの実体は `app/admin/components/AppSidebar.tsx`**（`Sidebar.tsx` は未使用の旧版）。ポータルは `app/portal/components/PortalSidebar.tsx`。各ページ見出しはパンくず方式（`lib/admin-breadcrumb.ts` / `lib/portal-breadcrumb.ts`、マップで pathname→{section,title}）に集約済みで本体h1は無し |
| 2026-06-03 | **ブランド基盤の項目オーナーシップ（最終形）**: 行動指針=`brand_guidelines.action_guidelines`（編集=ブランド方針）／特性traits=`brand_guidelines.traits`（編集=ブランドパーソナリティ）／パーソナリティ概要=`brand_guidelines.personality_summary`（編集=ブランドパーソナリティ・ポータル感じられ方のレーダー下に表示）／トーンオブボイス=`brand_personalities.tone_of_voice`（編集=バーバル・ポータルもバーバルに表示）。**brand_guidelines は複数画面が同一行を触るため必ず PATCH（部分更新）で。行が無ければ INSERT** |
| 2026-06-03 | **行動指針の移設**: 旧 `brand_personas` 先頭ペルソナ行の `action_guidelines` 相乗り → `brand_guidelines.action_guidelines` カラムへ移行（apply_migration＋データ移行＋NOTIFY reload）。ブランド戦略はペルソナを delete→insert で作り直すため、行動指針を相乗りさせると保存のたびに消えるリスクがあった。これを解消。読み取り側はポータルブランド方針/タイムラインのカテゴリ/管理ダッシュボード/CIマニュアル。`brand_personas.action_guidelines` カラムはレガシー残置（無害） |
| 2026-06-03 | **「保存したのに他ページ往復で消える」の2大原因**: ①**カラム追加/削除のDDL後に `notify pgrst,'reload schema'` を忘れる**と書き込みが PGRST204 で静かに失敗（ロゴ基本形 logo_images で再発）→ apply_migration の直後に必ず reload。②**管理編集ページは `page-cache`（モジュール内Map）でSPA往復時の再fetchをスキップ**する設計のため、**保存成功時に `setPageCache` で最新値を更新しないと往復で保存前の表示に戻る**。visuals は対応済み。他のブランド編集ページも同パターンの潜在リスクあり（保存後 setPageCache 未実施） |
| 2026-06-03 | **ビデオラーニング**: `app/api/learning` 配下は全て service_role。認証は cookie `getUser()` で 管理者=admin_users / メンバー=members(is_active).profile_id・company_id を解決（共通ヘルパー `lib/learning/auth.ts`、ブラウザは @supabase/ssr cookie のため Route Handler で getUser 可）。`views` は1セッション=1行をINSERT→PATCH、進捗は既存値とMAXで巻き戻り防止・completedは一度trueなら維持。duration確定もviews PATCHに同梱（videos PATCHは管理者専用のまま）。集計は analytics ルートのJSで動画別＋メンバー別マトリクスを生成。プレイヤー(`YouTubePlayer.tsx`)はYT.Playerが渡したDOMをiframeで置換するため、React管理ノードを直接渡さず手動生成した子ノードを渡す（アンマウント時 NotFoundError 回避）。新規2テーブルはRLS有効・ポリシー無し（service_roleのみ）。MVPは全社利用可（プラン制限は Stripe 実装後） |
| 2026-06-04 | 理解度テストは**サーベイ（共感）と別物**＝正誤のある知識テスト。サーベイ匿名回答テーブルと混ぜず専用4テーブル（記名 profile_id 持ち）で分離 |
| 2026-06-04 | k匿名は**API側で担保**：results に個人行を返さない／participants にスコアを載せない／部署・役職・設問別は n≥3／overall・company_average も n<3 で抑制（UI隠蔽ではなくデータを出さない） |
| 2026-06-04 | 受験用 `take` は `correct_option_id`/`explanation` を SELECT せず除外（提出前の正解リーク防止）。本人確認は `getMemberContext`/`getAdminContext`（セッション）、クライアント `profileId` 不使用 |
| 2026-06-04 | 採点は**単純正答率**（カテゴリ加重なし）。ギャップ分析は共感（サーベイ）×知識（テスト）を WHY/HOW で対比 |
| 2026-06-04 | AI設問生成：汚染ブランドデータ（別クライアントの混入）をAIが無視して整合データのみで作問＝「捏造禁止」ルールが機能。配信前の管理者レビュー必須 |
| 2026-06-04 | 複数セッション並行時のコミットは**パス明示 stage**（`git add -A` 不使用）で他作業の巻き込みを防止 |
| 2026-06-04 | 死んだコード検出は **`npx knip`** が決定版（未使用ファイル/export/依存をまとめて検出）。ただし「未使用export」でも**内部使用**しているケース（例: `getContrastRatio` は `calculateAccessibilityScore` が内部利用、`PORTAL_PAGE_KEYS` は型生成に利用）は消すと壊れる → 削除前に必ず内部参照を grep 確認 |
| 2026-06-04 | **同期/バックアップツール（iCloud/Time Machine等）が git 操作を巻き戻す**：`git rm` で削除したファイルが**未追跡で物理復活**（mtimeが元のまま）し、削除済み export を import してビルドを壊す。さらに `.next/` 内に **「○○ 2.ts」形式の重複ファイル**を生成し `tsc` が `Duplicate identifier` で落ちる。対処: `find . -name "* 2.*" -delete`＋復活ファイル再削除。恒久対策は同期対象から repo を除外 |
| 2026-06-04 | **console.log 一括削除の落とし穴**：行ベース削除は `console.log('msg', {` のような**複数行ログの1行目だけ消してオブジェクト本体を孤立**させ構文崩壊する。括弧バランスを追う方式で削除し、必ず `tsc` で検証。`console.error/warn` は残す |
| 2026-06-04 | **データProvider（Admin/Portal）はログアウト・ユーザー切替で app固有 state を必ずリセット**。AppAuthProvider は signOut が SPA `router.replace`（全リロードしない）＋同一idで user 参照を保持するため、リセットしないと**同タブで別ユーザーがログインした瞬間に前ユーザーの企業/権限/プロフィールが一瞬露出**する。`if(!user)` 分岐と fetch 開始時の両方でリセット |
| 2026-06-04 | **Context value は useMemo / 関数は useCallback で参照安定化**。`value={{...}}` を毎レンダー新規生成すると、user の参照を保っても全 consumer が再レンダーし「user?.id 依存で再取得を抑える」最適化が相殺される。AppAuth/Admin/Portal の3 Provider で対応 |
| 2026-06-04 | **生成数クランプは client/server 二重で一致**：サーバー `normalizeCount`（floor・0〜20・NaN/負はfallback4）に対し client の `<input type=number max=20>` は**タイピング/ペーストを制限しない**ため、onChange でも同ロジックでクランプしないと「合計N問」表示と実生成数が乖離する |
| 2026-06-08 | **並列セッション環境では未コミットの作業が消える**：複数Claudeセッションが同一repoで作業中、誰かの `git reset`/`checkout`/ブランチ操作で**自分の未コミット変更（新規ファイル含む）が working tree から消失**する（ビデオラーニング階層化の実装が2回消えた）。対策＝**作業はこまめに main へ commit**（push は `merge-base --is-ancestor` で fast-forward 確認後）。DDL（マイグレーション）は git 管理外なので DB には残るが、コードが消えると不整合になる |
| 2026-06-08 | **Turbopack `.next` キャッシュ破損**で dev が `Module not found: next-dev-turbopack.js` / `corrupted database` / `Unable to open static sorted file *.sst`：dev 起動中に git reset/checkout でファイルを大量に入れ替えると Turbopack 永続キャッシュ(`.sst`)が不整合化する。対処＝**dev停止→`rm -rf .next`→`npm run dev` 再起動**（ソース不変・生成物のみ削除で必ず直る）。本番(Vercel)は毎回クリーンビルドのため無関係 |
| 2026-06-09 | **カラースキームを「役割で1色」に統合**（commit 781a8db）。ニュートラル=gray（slate/neutral廃止）/ アクセント・情報=blue（sky/indigo廃止）/ success=green（emerald廃止）/ warning=amber（yellow廃止）/ error=red。**アクセントは橙#FF6A00を一度全面適用→ユーザー判断でblueへ巻き戻し**（橙トークン・config・globalsは完全撤去済み）。**重要な落とし穴**＝スコア/ランクのティア配色（green→blue→amber→orange→red）・感情スケール（red→orange→gray→green→emerald）・KPIカテゴリは「段階/項目の区別」用の**Layer 3 多色で、意味色統合の対象外**。一律 sed で潰すとティアが同色化して壊れる→必ず文脈確認。規約は `branding-bz/CLAUDE.md` カラー章に明文化 |
| 2026-06-09 | **並列セッションの再確認**：色作業中に別経路で `PortalSidebar.tsx`/`PortalLayoutClient.tsx`/`visuals/page.tsx`＋新規 `lib/brand/integrity.ts` 等が working tree に出現。コミットは `git add -u`＋無関係分を `git restore --staged` で除外し**自分の12ファイルのみ**を commit。`git add -A` は他セッションの作業を巻き込むので使わない |
| 2026-06-10 | **理念オントロジーの正本は `philosophy_elements`**（mission/vision=各社1行singleton、value/action_guideline/service=複数行）。`brand_guidelines` の mission/vision/values/action_guidelines/business_content は DROP 済み（退避テーブルにバックアップ）。表示・AI・編集は全て `lib/brand/philosophy.ts`（`fetchPhilosophy`）経由。編集は行差分CRUD（id一致でUPDATE・新規INSERT・消えた行DELETE）。values_sort/business_content_sort（表示順設定）は brand_guidelines に残置 |
| 2026-06-10 | **element_relations はポリモーフィック端点(kind+id)**。直接FK（proof_points.value_proposition_id等）は残し、跨ぐ関係のみ本テーブル。端点検証は SECURITY DEFINER トリガ（存在＋同一company）。トリガ関数は EXECUTE を anon/authenticated から剥奪（トリガは権限無しでも発火する）。`lib/brand/elements-catalog.ts` が5種を `{kind,id,label}` で返す共通取得 |
| 2026-06-10 | **マイグレは必ずローカル.sql先行→適用**（`branding-bz/CLAUDE.md` 恒久ルール化）。MCP `apply_migration` 使用時も同一SQLを `supabase/migrations/<version>_<name>.sql` に保存し同コミットに含める（version はリモート `schema_migrations` 記録値に合わせる）。破壊的変更（DROP）は退避テーブルへ事前バックアップ。旧 iCloud フォルダ撤去→**正本は `~/dev/branding-bz`＋GitHub** |
| 2026-06-10 | **AI判定の誤検知/ハルシネーション対策**: 1社1回のClaude呼び出し（ルート毎に呼ばない＝コスト/レート対策）、NG/OK例をfew-shot、「明確な違反のみ報告」指示、返却の quoted_text が原文に実在・rule_id/target_ref が実在することをコード側で検証し通らないものは破棄。プロンプトで `target_ref` と label を**別行**に（同一行だとAIがlabelをrefに混入させ全dropするバグ）。1チェック≒3,000〜6,000 tokens（sonnet） |

---

## 6. プロジェクト間の依存

| 依存先 | 内容 |
|--------|------|
| dots.bz | Supabase認証パターンの共通化検討中 |
| include.bz | branding.bzのサービス説明ページからリンク |

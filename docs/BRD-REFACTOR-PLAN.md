# BRD リファクタリング計画

**作成:** 2026-10-27（Claude Code・/refactor）　**対象:** `~/dev/branding-bz` main @ `89e13be`
**方針:** 挙動・画面・公開API・URL・DBスキーマ・環境変数は変えない。1項目＝1コミット。push・マージはしない（北川さんの指示待ち）。

## 開始時の状態（基準）

| 項目 | 結果 |
|---|---|
| 型チェック `npx tsc --noEmit` | エラー 0 |
| lint `npx eslint .` | 49 errors / 384 warnings（**作業前から**。内訳は下） |
| 単体テスト（`*.test.ts` を `npx tsx --conditions=react-server` で実行。package.json に test スクリプトはない） | 20本すべて pass |

lint の内訳: errors は React Compiler 系（react-hooks のレンダー中の副作用・メモ化を保てない等）44件、`no-require-imports` 2、`no-html-link-for-pages` 2、`no-this-alias` 1。
warnings は `no-unused-vars` 156、`no-img-element` 96、`no-unused-expressions` 80、`exhaustive-deps` 21 など。
**リファクタリングでは、この件数を増やさないことを合格条件にする。**

## 診断の数字（app / components / lib の .ts/.tsx 669ファイル。TypeScript の構文木で計測）

- 400行を超えるファイル: 64（最大 `app/admin/brand-score/surveys/[id]/page.tsx` 1,838行）
- 50行を超える関数: 579（大半は画面コンポーネント本体。1,000行超が6つ）
- if / for / switch / try が4段以上: 102か所（最大6段）
- 8行以上がほぼ同じ形で別ファイルにある組: 123組
- どこからも import されておらず、Next.js のルートファイルでもないもの: 3（うち1つは使用中を確認済み）

---

## 改修項目（優先順）

優先度 = 影響度 × 直しやすさ。リスクは「挙動が変わる可能性」。

| # | 対象（ファイル:行） | 問題 | なぜ困るか | 直し方の案 | 影響 | 難易度 | 優先 | リスク |
|---|---|---|---|---|---|---|---|---|
| 1 | `app/api/superadmin/**`（21ファイル。例 `copy/projects/route.ts:8`・`copy/draft/route.ts:14`・`plan-change-requests/route.ts:14`・`orphan-accounts/route.ts:19`・`company-plan/route.ts:14`） | superadmin の認証判定（Bearer → getUser → admin_users.is_superadmin）を各ファイルが手書き。ローカル関数 `requireSuperadmin` だけで8つの複製 | 判定を直すとき21か所を同時に直す必要があり、漏れると権限の穴になる | `lib/auth/caller.ts` の `requireSuperadmin`（10/22 作成）を使う形に置き換える。返すエラー文言・ステータス（401/403）は今のまま揃える | 高 | 易 | **A** | 低（cookie でも通るようになる点だけ広がる。今は全画面 Bearer を送っている） |
| 2 | `app/api/brand-score/surveys/[id]/generate-questions/route.ts:15-70` ↔ `lib/brand-score/brand-data.ts:19-105` | 会社のブランドデータ収集（型 BrandData と取得処理）を85行そのまま複製。クイズ側の generate-questions は共通の `fetchBrandData` を使っている | 片方だけ直すとサーベイとクイズで AI に渡す材料がずれる | サーベイ側も `fetchBrandData` を使う。差分があればフィールド単位で確認し、同じでなければ相談 | 高 | 易〜中 | **A** | 低〜中（AI への入力が1文字でも変わらないことを、テストで固定してから置き換える） |
| 3 | `app/admin/brand/{guidelines:455, personality:178, verbal:263, visuals:726}/page.tsx`・`app/admin/company/page.tsx` | Supabase REST を直接叩く `supabasePatch`（タイムアウト付き fetch）を5画面で複製 | タイムアウト・エラー処理を変えるときに5か所。すでに微妙に書き方がずれている | `lib/admin/supabase-rest.ts` に1つにまとめ、各画面は import する | 中 | 易 | **A** | 低 |
| 4 | `app/api/{contact, signup, signup/join-company, superadmin/signup-requests, members/join-requests}/route.ts`・`lib/mail/superadmin-notify.ts` | `escapeHtml` を6か所で複製 | メール本文の HTML エスケープは安全上の要。1か所だけ古いと XSS の入口になる | `lib/mail/escape-html.ts` に1つ置き、6か所から使う。先に単体テストで現挙動を固定 | 中 | 易 | **A** | 低 |
| 5 | `app/admin/components/AdminStyles.ts`・`components/onboarding/OnboardingMiniCard.tsx` | どこからも使われていないファイル（grep でも参照0件を確認） | 読む人が「使われている」と誤解する | 削除する（`MapReviewPanel.tsx` は使用中なので残す） | 低 | 易 | **A** | なし |
| 6 | `app/api/plan-change-requests/route.ts` ↔ `app/api/setup-support-requests/route.ts`（`resolveCaller`）、`app/api/superadmin/plan-change-requests` ↔ `setup-support-requests`（95行中69行が同じ） | 依頼系 API の「呼び出し元の会社を引く」処理と一覧処理が2本ずつ複製 | 片方だけ修正される | 会社の解決は `lib/auth/caller.ts` の `requireCompanyMember` に寄せる。superadmin 側は #1 と一緒に整理 | 中 | 易 | **B** | 低 |
| 7 | `app/api/tools/{stp,persona,personality,colors}/sessions/route.ts`・`.../sessions/[sessionId]/route.ts` | 4ツールのセッション作成・取得・保存・アーカイブがほぼ同じ処理の4重複（違いは app_type と初期データだけ） | 10/22 のセキュリティ修正も4本＋4本に同じ変更が必要だった | `lib/tools/session-handlers.ts` に app_type を受ける共通ハンドラを作り、各 route は1〜2行で呼ぶ | 中 | 中 | **B** | 中（ツールごとの小さな違い〔colors のプロジェクト同時作成など〕を落とさないこと。差分表を作ってから着手） |
| 8 | `app/api/tools/stp/suggest-{positioning:54, segments:69, target-detail:41, brand-stance, target-fit-map}/route.ts`・`persona/suggest-{demographics,goals}` | AI に渡す「基本情報の文章化」（`parts` の組み立て・`formatBusinessDescriptions`）を5〜7本で複製 | プロンプトの材料を変えるたびに全部直す必要がある | `lib/tools/prompt-context.ts` に関数として切り出す。出力文字列が同一であることを単体テストで確認 | 中 | 中 | **B** | 低〜中 |
| 9 | `app/tools/{colors:163, persona:130, personality:95, stp:95}/page.tsx` | 構造化データ（JSON-LD の provider・FAQPage）の組み立てを4ページで複製 | SEO の記述を変えるとき4か所 | `components/seo/ToolJsonLd.tsx` にまとめる。出力される JSON が変わらないことを本番ビルドの HTML で比較 | 低 | 易 | **B** | 低 |
| 10 | `app/api/tools/personality/connect/route.ts`（4段以上が9か所・最大6段）・`app/api/tools/shared-profile/route.ts`（8か所）・`app/api/signup/join-company/route.ts`（5か所） | ネストが深く、どの条件で何が書き込まれるか追いにくい | 本体連携（他社データへの書き込み経路）なので、読み違いが事故につながる | 早期 return と小さな関数（「既存行を探す」「マージする」）への分割。処理順は変えない | 中 | 中 | **B** | 中（書き込み順が変わらないことを確認しながら） |
| 11 | `app/admin/brand-score/surveys/[id]/page.tsx`（1,838行・本体1,449行） ↔ `components/brand-score/SurveyResults.tsx` | 管理画面のサーベイ結果表示が、ポータル用の `SurveyResults` とほぼ同じ処理（284行）を自前で持っている | 集計・表示の修正を2か所でしないとずれる。1ファイルが大きすぎて読めない | 管理画面も `SurveyResults` を使い、管理画面だけの操作（配信・編集・AI考察の再生成など）を別コンポーネントに分ける | 高 | 難 | **C** | 中〜高（管理画面とポータルで表示に差があるなら残す必要がある。画面を並べて比較してから） |
| 12 | `app/admin/brand-score/market-surveys/[id]/page.tsx` ↔ `components/brand-score/MarketSurveyResults.tsx`（310行中107行が同じ） | #11 と同じ構図 | 同上 | #11 と同じ手順 | 中 | 中〜難 | **C** | 中 |
| 13 | 1,000行を超える画面: `admin/brand/strategy`(1,497)・`admin/brand/visuals`(1,429)・`portal/page`(1,409)・`portal/timeline`(1,398)・`superadmin/.../DesiredEvidenceSection`(1,241)・`portal/kpi`(1,225) | 1つの関数（画面）にデータ取得・保存・表示がすべて入っている | 変更のたびに全体を読む必要があり、レビューも難しい | 1画面ずつ「データ取得の hook」「保存処理」「表示の小コンポーネント」に分ける。1回に1画面 | 高 | 難 | **C** | 中（画面の見た目が変わらないことをスクリーンショットで比較） |
| 14 | 57ファイルに散る `no-unused-vars`（156件） | 使われていない import・変数 | 読むときのノイズ。lint の警告に本当の問題が埋もれる | 自動では消さず、ファイル単位で目視して削除 | 低 | 易（量は多い） | **C** | 低 |

### 相談が必要なもの（URL・挙動に触れるので、承認なしには直さない）

| # | 対象 | 内容 |
|---|---|---|
| D1 | `app/admin/brand-score/settings/page.tsx` | どこからもリンクされていない。中身（印象タグ設定・154行中121行）は `app/admin/card-template/page.tsx` の「印象タグ設定＋QR出力」に統合済みに見える。削除すると URL `/admin/brand-score/settings` が消えるので、北川さんの判断が要る → **2026-10-27 削除済み**（承認済み。リンク元なし・同じ設定は card-template にある） |
| D2 | lint の React Compiler 系 errors 44件 | 直すとレンダー時の挙動が変わりうる（リファクタリングの範囲外）。必要なら別作業として扱う |

---

## 進め方の提案
1. **A（#1〜#5）を先に**: どれも易しく、共通化の効果が大きい（特に #1 は権限まわりの一本化）。合計で1日以内の見込み
2. **B（#6〜#10）**: 1項目ずつ、差分表・単体テストで現挙動を固定してから
3. **C（#11〜#14）**: 画面の比較が要るので、北川さんの画面確認とセットで1画面ずつ

## 実施記録
（承認された項目を直したら、ここに「#番号 完了: 一行の結果（commit）」を追記する）
- #1 完了: superadmin API 16本（インライン12・ローカル関数4）の認証を `lib/auth/caller` の `requireSuperadmin` に置き換え、約330行削減。文言・ステータスは従来の標準文言のまま（`lib/copy/api-auth` も同じ文言に戻った）。文言が違う signup-requests・superadmin の plan-change-requests / setup-support-requests・create-company の4本は、画面にエラー文言が出るため今回は対象外
- #2 完了: サーベイの generate-questions が複製していたブランドデータ取得（型・取得・十分性判定 約130行）を `lib/brand-score/brand-data` の `fetchBrandData` / `hasSufficientData` に置き換え。差分は `?? undefined` 3か所のみで、エラーでない限り値は同じ。Claude に渡す JSON 文字列を `brand-data.test.ts` で固定（テスト 20→21本）
- #3 完了: 管理画面のブランド編集4ページ（guidelines / personality / verbal / visuals）に1文字違わず複製されていた `supabasePatch` / `supabaseInsert` を `lib/admin/supabase-rest.ts` にまとめた（約250行削減）。`app/admin/company/page.tsx` の同名関数はトークンの取り方・応答の形（return=minimal）・タイムアウト文言が違うため別のまま
- #4 完了: 6か所に同一内容で複製されていた `escapeHtml` を `lib/mail/escape-html.ts` の1つにした（`lib/mail/superadmin-notify` は既存の import 先のため再 export）。挙動を `escape-html.test.ts` で固定（テスト 21→22本）
- #5 完了: どこからも参照されていない `app/admin/components/AdminStyles.ts`（CLAUDE.md で dead code と明記）と `components/onboarding/OnboardingMiniCard.tsx`（OnboardingChecklist への切替後に未使用）を削除。CLAUDE.md の該当注記を「削除済み」に更新。本番ビルド green
- #7 完了: STP / ペルソナ / パーソナリティの セッション作成（POST）・取得（GET）・保存（PATCH）を `lib/tools/session-handlers.ts` の共通ハンドラにまとめた（6ファイル 約710行削減）。各 route は app_type・初期データ・ログ文言を渡すだけ。カラー定義（brand_colors）は brand_color_projects も扱うため対象外、STP の一覧 GET・DELETE は stp の route に残した。レスポンスと DB 書き込みを `session-handlers.test.ts` で固定（テスト 22→23本）。本番ビルドで11ルートとも未ログイン 401 を確認
- #6 完了: 契約者側の plan-change-requests / setup-support-requests に複製されていた `resolveCaller` を `lib/auth/caller` の `requireCompanyMember` に置き換え（文言・ステータスは同じ。`CallerContext` に email を追加）。superadmin 側の signup-requests / plan-change-requests / setup-support-requests のローカル認証も `requireSuperadmin` に委譲（戻り値の形は維持）。⚠️ superadmin 側3本の 401/403 文言は標準文言に揃った（例「認証が必要です」→「認証が必要です。再ログインしてください。」・2026-10-27 北川さん了承）。一覧・承認の処理はテーブルと承認時の動作が違うため共通化していない
- #8 完了: AI 提案 API 8本のプロンプト用「企業の基本情報」組み立てを `lib/tools/prompt-context.ts` に集約（約250行削減）。STP は中身の違う2版をそのまま別関数に（`pushStpCompanyProfile`＝segments / positioning / target-detail、`pushStpCompanyBasics`＝brand-stance / target-fit-map。後者は旧形式 products と主要顧客を出さない）。ペルソナの `formatBusinessDescriptions` / `formatTargetSegments` は区切り文字を引数に（demographics＝'\n  '、goals / journey＝'、'）。期待値は元のコード断片を実行して記録し `prompt-context.test.ts` で固定（テスト 23→24本）。suggest-target-summary は書き方が別のため対象外
- #9 完了: 構築ツール紹介ページ4つ（stp / persona / personality / colors）の構造化データ3種（SoftwareApplication・FAQPage・BreadcrumbList）を `components/seo/ToolJsonLd.tsx` にまとめた（約170行削減）。colors だけ applicationCategory が DesignApplication なので引数に。本番ビルドの HTML から JSON-LD を抜き出し、変更前とバイト単位で一致することを確認
- #10 完了: 4段以上のネストを、パーソナリティ本体連携 9→0（`lib/tools/personality-connect.ts`）、共通プロフィール書き戻し 8→2（`lib/tools/shared-profile-writes.ts`）、ペルソナ本体連携 4→0（`lib/tools/persona-connect.ts`）、参加申請 5→0（通知メールを同ファイル内の関数へ）に。書き込み先・順番・エラー文言・ログは同じで、切り出した書き込みはテストで固定（テスト 24→27本）。参加申請の通知メールは本文・件名・宛先が変更前とバイト単位で同一であることを確認
- #14 一部完了: `no-unused-vars` のうち **使われていない import だけ** を削除（18ファイル・53件）。変数・引数は、消すとフックの呼び出し順などが変わりうるため今回は対象外（残り28件）。lint（`.claude/worktrees/` を除く）は 260→207（warnings 236→183・errors 24 は不変）。
  - 注: `npx eslint .` はリポジトリ内の別セッションのワークツリー `.claude/worktrees/priceless-chatterjee-0617a2/` まで数えている（開始時の「49 errors / 384 warnings」はその分を含む）。ワークツリー内のファイルには触れていない
- #11 完了（e0bcdef）: 管理画面のサーベイ詳細の結果表示を `SurveyResults` に寄せ、管理画面だけの違い（通過率の人数・SP/BO の右列・浸透段階の軸判定・calcFunnel の扱い）は `variant="admin"` に入れた。本番の実データ（ID INC. サーベイ2本・SP/BO を足した入力・考察生成中）で、変更前の管理画面のコードと HTML が一致（5/5）、ポータルは変更前と一致（8/8）。
  - 見つけた既存不具合（未修正・ポータルのみ）: 浸透段階に分けられないサーベイでも、ポータルは「浸透段階」の軸を出して中身が空になる（段階を解決できない設問 null を1つに数えている）。管理画面は正しく「設問タイプ」だけを出す
- #12 完了（8a4bc78）: 市場調査の管理画面はすでに `MarketSurveyResults` を使っており、残っていたのは参照0件の InsightNote / RankBars と未使用の計算だけだったので削除（97行）
- #13 一部完了: 大きいページのモジュール直下の宣言を、中身を変えずに別ファイルへ移した（export 以外は HEAD と同一を照合）。タイムライン 1398→1089、ビジュアル 1367→1175、DesiredEvidenceSection 1241→1034、ポータルのトップ 1409→1315、サーベイ詳細 1838→925（#11 と合わせて）。
  - **本体のコンポーネント関数（800〜1,400行）の分割は未着手**: 状態・保存処理の受け渡しが変わるため、ログインした画面を変更前後で見比べながら1ページずつ行う必要がある。strategy・kpi はモジュール直下がほぼ型と小関数だけのため移していない
- #14 残り（28件）: 未使用の変数・引数。React のフック（useRouter など）を呼んだまま使っていないものを含み、消すと呼び出し順が変わりうるため未着手

### 2026-10-27（その10）
- 既存不具合を修正（d5958ac）: ポータルの「浸透段階」空表示。段階を解決できない設問（null）を数えないようにした（管理画面の判定は不変）
- #14 完了（c681d8a）: src の未使用変数・引数16件を削除（名刺ページの表示に使っていない QR 生成2種を含む）。lint 202→186。`public/sw.js`（生成物）と `archive/` は対象外。残る1件はなし
- #13 完了（71d9c05〜0e06c36・画面ごとに1コミット）: 本体関数を表示部品・単一用途の hook に分割。データ取得・保存は各ページに残した

  | 画面 | 行数 | 本番での変更前後比較（DOM の要素・class・文言の並びを記録して照合） |
  |---|---|---|
  | admin/brand/strategy | 1,496→316 | 一致（740要素） |
  | admin/brand/visuals | 1,175→333 | 一致（272要素） |
  | portal（トップ） | 1,315→628 | グラフ描画の待ち時間ぶん以外一致。差は React の自動 ID（チャートの `data-chart=chart-_r_b_`→`_r_8_`）のみで見た目に影響なし |
  | portal/timeline | 1,089→457 | 一致（486要素） |
  | portal/kpi | 1,224→594 | ID INC. は機能オフのため「利用不可」表示のみ一致を確認。本体の表示は未比較（KPI を使う会社で要確認） |
  | superadmin DesiredEvidenceSection | 1,034→303 | テックブリッジ（獲得目標1件）・ID INC.（0件）で一致 |

  - ポータルトップ・KPI はデータ取得の effect（約360行／ページ内の setup フロー）が残るため 400行を切っていない。さらに縮めるなら取得結果の整形を純関数に出す（取得そのものは動かさない）
  - 編集・保存の操作（入力→保存）は本番データを書き換えるため未実施。デモ企業で確認する

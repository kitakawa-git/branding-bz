# BRD / branding.bz プロジェクトステータス

> **このファイルは Claude Code・Cowork・Claude Projects の共通ハブです。**
> Claude Code: `/sync-status` スキルで更新
> Cowork: 直接読み書き
> Claude Projects: ナレッジとしてアップロード（週1回推奨）

**最終更新:** 2026-07-15
**更新者:** Claude Code（/sync-status。2026-07-15：スーパー管理サイドバーの整備＝**承認待ち件数の通知バッジ**（`companies.approval_status='pending'` 件数・承認/却下で即時更新）／アクティブ・ホバー背景を背景色に馴染む無彩色へ（明度差25pt→8pt）／ロゴをbzマーク画像(`public/logo-mark.png`)に差し替え＋グレー外線／サイドバートグルを他画面と同一サイズ(44px/24px)に統一。**併せて未記載だった 06-21 oauth-gate・06-30 新規owner承認制＋競合ドメイン警告を §3/§4/§5 に反映**。最新コミット `3353dfd`）

---

## 開発状態（ブランチ / マージ / デプロイ）

| 項目 | 状態 |
|------|------|
| 作業ブランチ | `main`（直接コミット運用。ブランチ作成・切替・マージは北川さんの明示指示まで行わない） |
| 本番デプロイ | **済み** — 2026-07-15 分まで反映。Vercel 自動デプロイ（git push で起動、コミット `3353dfd`） |
| DB マイグレーション（本セッションで適用） | **今回（2026-07-15）はDDLなし**（UIのみ）。※2026-06-30 適用分（本ドキュメント未記載だったので追記）: `blocked_competitor_domains` 新設（競合ドメイン手動ブロックリスト・RLS superadminのみ）／`companies.approval_status`（'pending'\|'active'\|'rejected'・default 'active'・既存10社は active でバックフィル）／`companies.competitor_flag`（boolean default false）。MCP `apply_migration` で本番適用済＋`supabase/migrations/20260630120000_add_owner_approval_and_competitor_domains.sql` に記録。※2026-07-14 その5分: `companies.representative_profile TEXT` も引き続き有効 |
| 今セッションのリリース（2026-07-15） | **スーパー管理サイドバーの整備**①**承認待ちの通知バッジ** `3e12092`＝`companies.approval_status='pending'` の件数をサイドバー「新規登録の承認」に赤バッジ表示（0件なら非表示・100件以上は`99+`）。初回/ページ遷移時に再取得＋承認/却下直後は `signup-requests-changed` カスタムイベントで即時反映。`rounded-full` は**globals.cssの本文14px底上げ対象外**にする意図も兼ねる②**バッジを項目の上下中央へ** `ad5b019`＝shadcn `SidebarMenuBadge` 既定の `top-1.5`(上寄せ)で中心が4px上にずれていた。同じ peer variant キーで上書きし `top-1/2 + -translate-y-1/2`（実測: 153px→157px＝テキスト中心と一致）③**アクティブ/ホバー背景を背景色に馴染ませる** `27d0923`＝背景を無彩色(`0 0% 10%`)に変えた際にアクセントが紺(`213 45% 35%`)のまま取り残され明度+25pt・色相ありで浮いていた→通常管理画面と同じ「背景と同色相・明度+8pt」の関係に合わせ `0 0% 18%` に（border も無彩色化）。識別は白文字＋`font-semibold` が担う（コントラスト13.6:1）④**ロゴをbzマークに差し替え** `47971b8`→`8525291`→`53e0c2e`＝ShieldCheck＋琥珀色背景を廃止し、北川さん提供の元画像を `public/logo-mark.png` として採用（Desktop の `Group 8963.png` 1024x1024 を `cmp` でバイト一致確認。一旦作った再現SVGは削除＝二重管理を残さない）⑤**ロゴ外線** `066e549`→`8964aba`→`ea9b6ad`→`cf45508`＝`border-gray-300`→`500`→`600`→`700`(#374151) と段階調整。下限の目安＝`gray-800`(#1f2937)は画像背景 #222222 と同化し外線の意味が消える⑥**サイドバートグルのサイズ統一** `3353dfd`＝スーパー管理だけ既定 `h-7 w-7`(28px/アイコン16px)のままで、通常管理画面・ポータルの `size-11 [&_svg]:size-6`(44px/24px)と不揃いだった→同一指定に統一（CLAUDE.mdのタップ領域44px基準にも合致） |
| 2026-06-30 リリース（未記載だったので追記） | **新規owner登録を superadmin 全件承認制に＋競合ドメイン警告** `8449c72`（設計書: `Documents/Claude/ID_bzサービス開発/260630_新規owner登録_競合ドメイン承認制_設計_v1.md`）。目的＝**ID INC. の競合（同業ブランディング会社）が branding.bz を不用意に覗きに来るのを防ぐ**（§4「同業者対策」の残タスクだった承認制ゲートの実装）。①`/api/signup` が企業を `approval_status='pending'`・members を `status='pending'`/`is_active=false` で作成（**行は作る＝パターンA**）。自動ログインを廃止し signup step4「承認待ち画面」へ②登録メールドメインを `blocked_competitor_domains` と照合し `competitor_flag`。**一致しても自動ブロックせず**承認キューで⚠警告（誤検知対策・フリーメールは判定不可のため人手判断）③superadmin へ承認依頼メール（競合一致は件名に⚠）④`AdminDataProvider` が `approval_status='pending'` の企業を「承認待ち」画面でブロック（superadminは対象外）⑤`/superadmin/signup-requests` に承認/却下UI＋API。**承認**=company active＋members有効化＋本人へ承認メール、**却下**=本人へ却下メール後に members/profiles/admin_users/companies/auth user を削除。同ページ下部で競合ドメインの手動CRUD（RLSで直接）。**設計の肝**＝承認待ちでも members 行を作るので oauth-gate（下記）が孤児と誤判定して削除しない |
| 2026-06-21 リリース（未記載だったので追記） | **Googleログインを既存メンバー専用化＋新規登録の開発者通知** `29ef82f`。「Googleで続ける」は `signInWithOAuth` が `auth.users` を自動作成するが、新規登録(`/api/signup`)と違い members を作らないため、**members無しで詰まる＋メールアドレスを占有して再登録が衝突**していた（実際に孤児アカウント2件を発見・削除）。`/portal/auth/callback` が `POST /api/portal/oauth-gate` を呼び、members（status問わず）と admin_users がどちらも無い孤児なら service_role で `auth.users` ごと削除→signOut→`/portal/auth?error=not_registered`。**pending member / admin は削除しない**。併せて `/api/signup` 成功時に開発者へ通知メール（env `SIGNUP_NOTIFICATION_EMAIL`、未設定なら `CONTACT_NOTIFICATION_EMAIL`）。**方針A**（Google＝既存者専用・新規はメール登録）を採用 |
| 2026-07-14 リリース（その5） | **代表者プロフィール機能＋ポータル微整**①**代表者プロフィール新設** `853fb28`＝`companies.representative_profile TEXT` を追加、管理画面 基本情報の代表者名の下に `AutoResizeTextarea`「プロフィール（任意・改行可）」、ポータル `/portal/about` は当初 事業内容の上に別ブロックで表示 → `c43bfb4` で「代表者」行の名前直下に段落として統合（whitespace-pre-wrap で改行反映、空なら非表示）②**180字超はもっと読むトグル** `a1e4ce8`＝先頭180文字＋「…」表示、「もっと読む/閉じる」で切替③**開閉に高さアニメーション** `a8d58b2`＝サブコンポーネント `RepresentativeCell` を新設、`useRef`＋`useEffect` で `scrollHeight` を実測し `height: 0 → scrollHeight → auto` の3段階遷移で確実に animate（300ms ease-out、初回マウントは `didMount` ref で発火抑止）④**ポータル「私たちについて」を接し方の下へ** `685f160`＝「私たちの『らしさ』」グループ内の最下段（順: 考え方→感じられ方→見え方・聞こえ方→接し方→私たちについて）⑤**会社名主/副の言語トグル追従** `591ac8c`＝ポータル `/portal/about` のヘッダ会社名表示を `companies.name_display_lang` に連動（`ja`: H1=日本語表記/下段=英語表記, `en`: H1=英語表記/下段=日本語表記）。両モードで実データ切替→表示確認済、現在は日本語モードに戻し |
| 2026-07-14 リリース（その4） | **ポータルナビ再編＋基本情報フォームの精整**①**ポータル「私たちについて」を「私たちの『らしさ』」グループの先頭（考え方の上）へ移動** `23684bb`＝ユーザーメニュー内の項目は削除。事実情報（会社名・設立・代表者・事業内容）→らしさ（考え方/感じられ方/見え方・聞こえ方/接し方）の順で読める導線に②**ポータル『私たちについて』事業内容カードのミニマル化** `72200e8`＝左端の青バー（`bg-ds-app-accent`）と通し番号 01/02.. を削除、単純な枠だけのカードに③**基本情報「概要」見出し・説明文を削除** `28f95bf`＝h2「概要」と説明文「ポータルの『私たちについて』ページに表示されます（任意）」を除去。設立/代表者フィールドは残置④**「ウェブサイトURL」→「ウェブサイト」に短縮** `fe5eb6e`（表示側ポータルは「公式サイト」のまま。用語統一は保留）⑤**各セクション間の余白を20→32pxに統一** `1417689`＝全7セクション（ロゴ/企業名/設立/代表者/業種/ウェブサイト/事業内容）の `mb-5→mb-8`、実測で全gap=32px⑥**設立/代表者を1カラム独立セクションに分割** `13a7e03`＝旧 `grid-cols-1 sm:grid-cols-3` 内2セルから、各 `mb-8` の独立ブロックに（他セクションと同じ32pxリズム）⑦**設立/代表者の小ラベルをh2装飾に統一** `df15f3b`＝旧 `<p className="text-[11px] text-gray-500 mb-1.5">` → `<h2 className="text-xs font-bold mb-3">`。7見出し全て H2/14px/700/mb-12px/同色⑧**代表者の入力幅を日本語表記と同じに** `21fef26`＝`sm:grid-cols-2` の1カラム分でラップ（実測 328.5px＝日本語表記と一致） |
| 2026-07-14 リリース（その3） | **ポータル「私たちについて」新設＋会社情報フォーム再編**①**ポータル会社概要ページ新設**＝`/portal/about` を追加（会社名 日/英・ロゴ・設立/代表者/業種/公式サイト・事業内容を表示。サイドバーナビ/パンくず/タイトル登録, `0b77a14`）→「私たちの『らしさ』」の下へ移動 `cc7da98` →サイドバーヘッダー（会社名ブロック）のリンク先を `/portal/about` に `f8f1b18` →最終的にユーザーメニュー（マイプロフィールの上）へ移動しメインナビの独立項目は廃止 `74a91a6` ②**名称/アイコン統一**＝「会社について」→「私たちについて」に統一（会社限定でなく中立に、管理画面セクションも「概要」に, `f36a63a`）／アイコンを Building2→Users に `2fb6f04`（プレースホルダー修正 `c172d5d`／スローガン表示を削除 `52fc9f7`）③**事業内容の移動**＝編集を「ブランド方針」→「基本情報」へ、ポータル表示を「考え方」→「私たちについて」へ移動 `d66838b`。共通コンポ `components/shared/BusinessContentEditor.tsx` を新設。データは `philosophy_elements` の `element_type='service'` 行、表示順は `brand_guidelines.business_content_sort`。guidelines の `syncPhilosophyElements` は service を触らない（value/action_guideline のみ同期）ため service 行と衝突しない④**基本情報「設立」を年/月ドロップダウン化** `d015429`＝沿革（`2011年5月` 文字列保持）と共通ヘルパー `lib/year-month.ts`（`parseYearMonth`/`formatYearMonth`/`YEAR_OPTIONS`）に切り出し、沿革も import 差し替え⑤**基本情報から「競合企業・サービス」欄を削除** `f1d5f92`（UIのみ。`companies.competitors` 列と shared-profile ツール連携、`/api/admin/competitors/suggest` は温存。competitors を load/save から除去）⑥**基本情報から「所在地(address)」欄を削除** `f3b6061`（UIのみ。列は残置）⑦**基本情報の並び順入れ替え** `4344e3d`＝概要（設立/代表者）を業種の上へ。新しい並び: ロゴ→企業名→概要→業種→ウェブサイトURL→事業内容⑧**会社情報の競合カラードット** `9594609`＝未指定は #888888 でフォールバック、空値のドットは非表示 |
| 2026-07-13 リリース（その2） | **フォーム機能拡張（スローガン説明文・沿革入力改善・画像並べ替え/複数UP・企業名トグル）＋ポータル微調整**①**スローガン説明文**＝管理画面ブランド方針のスローガン下に「説明文（任意）」を追加、ポータル「考え方」でスローガン直下に本文canonicalで表示（`brand_guidelines.slogan_description`, コミット `62c8846`）②**沿革入力の刷新**（`app/admin/brand/guidelines/page.tsx`）＝年をフリーテキストから「年ドロップダウン＋月ドロップダウン（任意）」に（year フィールドに "2011年"/"2011年5月" の整形文字列で保持＝DB/ポータル不変・既存データ互換, `f551a1a`/月幅圧縮 `59b1bb9`）／各行をドラッグ並べ替え可能に（SortableHistoryItem, `0d8e1ca`）／出来事欄を複数行入力（AutoResizeTextarea, `bb8e2b3`）＋ポータル沿革の出来事に `whitespace-pre-wrap` で改行反映（`31db652`）③**ポータル「考え方」余白**＝行動指針・事業内容の項目間を 8px→12px（space-y-3, `0b14443`/`e17fef3`）④**ポータル「見え方」ロゴ基本形**＝`PortalImageCard` に `fit="width"` を追加し画像を幅フィット表示（左右レターボックス余白解消, `efc9f66`）＋角丸なし・画像間 gap-2→gap-4（16px）（`75df6c5`）⑤**管理画面ビジュアルの画像操作**＝ロゴ基本形画像をドラッグ並べ替え（`4eb8882`）／ロゴガイドラインは「登録順/カスタム」トグルを廃止し常時ドラッグ並べ替えに統一（`0fbd9b7`）＋セクション自体もドラッグ並べ替え（SortableSection, `65bce2e`）／画像アップロードを複数選択対応（ロゴ基本形・各セクション・参考画像の3スポットに `multiple`＋順次アップロード、10枚上限は残り枠まで, `1017df4`）⑥**会社情報の企業名を日本語/英語＋表示トグルに一本化**（`app/admin/company/page.tsx`, `2a3fb1c`→`a1ab1fd`）＝単独の「企業名またはブランド名」入力を廃止し「日本語表記」「英語表記」＋表示トグル（日本語/英語, 既定=日本語）に再構成。保存時に `name` を選択表記へ同期（選択側が空なら他方→従来nameでフォールバック）→スマート名刺・サイドバー・ポータル等は既存の `name` 参照のまま表示が切替（30+ファイル不変）。旧単一 name は初回読込で ASCII→英語表記/他→日本語表記へ移行。読み方は一旦追加後に撤去（`name_reading` カラムは残置・無害）。**実データ設定**: ID INC. の日本語表記を「アイディ株式会社」に設定＋トグル日本語で保存済（表示が「アイディ株式会社」に。英語へ戻すはトグル英語で保存） |
| 2026-07-13 リリース（その1） | **管理画面ブランド基盤の編集UI再構成＋本文/ラベル装飾の全面統一**（コミット `3e72a14`・32ファイル）①**カード整理**＝ブランド方針/ビジュアル/バーバル/パーソナリティ/ブランド戦略の各ページでカードのマージ・分割・並べ替え。セクション間余白を32px（`space-y-8`/`mb-8`）に統一。バーバルは「コミュニケーションスタイル＋表現ルール」を1枚に統合、パーソナリティは「概要＋特性」を統合、ブランド戦略は「ターゲット概要＋主なターゲット＋ターゲット適合マップ」統合・「自社の立ち位置＋ポジショニングマップ」統合＋カード順を整理②**ラベル装飾統一**＝ビジュアル（カラーカテゴリ/フォント）・バーバル・ブランド戦略（軸ラベル/プロット項目/プレビュー）の小見出しを共通ラベル `FieldSubLabel`（text-[11px] text-gray-500）に統一③**ブランド戦略の編集機能追加**＝(a)自社の強み/競合の特徴をポジショニングマップの各プロット項目カード内で編集可能化（自社=`companies.strengths` / 競合=`competitors_analysis[].traits`、名称が会社名と一致する項目を自社判別）。読み取り専用だった「自社の強み」「競合分析」カードは廃止 (b)自社の立ち位置を管理画面で編集可能化（ターゲット名/ステートメント/なぜなら、`brand_stance_statements` を brand_personas row0 に保存）④軸選定の根拠を軸ラベルの下へ移動＋枠（bg-gray-50 rounded p-3）を撤去、「各企業の配置根拠を見る」detailsを撤去⑤ビジュアルの「ロゴの基本形…」補足をロゴ基本形タイトル直下へ移動⑥サイドバートグルのアイコンサイズをポータルに合わせる（`size-11 [&_svg]:size-6`）⑦ポータル・構築ツール・共有コンポーネント（TargetDeepDive/PositioningMapAndStance/PersonalityRadar/BrandPersonalityCard等）の本文を canonical（`text-base text-foreground/80 leading-relaxed`）に統一、セカンダリラベル/余白/カード装飾を微調整 |
| 2026-07-11 リリース | **STP UI整理: Step3/4/5 のマップ・ターゲット表示を統一**①**Step4（ポジショニング）**＝「自社・競合の一覧」カードを廃止しマップに完全統合。要素追加/選択はマップ上で完結（右上に "競合他社を追加" ピルボタン）、点クリックでフローティングパネル（位置スライダー＋AI根拠）→「詳しく編集」でモーダル（名前/色/traits/削除）。「AIで再生成」を「ポジショニング」見出し右へ移動、説明文は「このポジショニングをもとに」を削り「各ターゲットに対して自社が何者として…」だけを残す。ポジショニングマップ見出し右にAIボタン、要素追加ボタンはマップ内右上に。軸選定オーバーレイとマップ本体の余白を80→96pxに調整②**Step3（ターゲティング）**＝「ターゲット市場候補」と「ターゲット適合マップ」を1枚のCardに統合、罫線なしで連結。適合マップのスライダーカード内に軸選び方セレクターを内包、"軸を確定/変更可" ボタンの状態表示化（従来 "軸を確定/ロック解除"→現在の状態を示す "軸を固定中/軸を変更可"）、二重表示の軸固定中バッジを削除。グレーセグメントに `animate-pulse` を追加（クリック促進）。「軸の選び方」行をカードとマップの間へ、AIで提案生成ボタンとの左右関係を入れ替え。「購買決定要因」のラベルを「ターゲットは何を重視して選ぶか」に変更。メインターゲットカード右上の AIで提案生成 ボタンをタイトル行の縦中央に整列（top-3→top-4）③**Step5（確認・出力）**＝戦略整合性スコアパネルを削除（未使用の checkConsistency import と useMemo も掃除）。「自社の強み」「競合分析」を "ターゲット" セクションから "ポジショニング" カード内（マップの下）へ移動。共通コンポ `PositioningMapAndStance` に `belowMap` slot を追加。自社の強み本文を白カード（rounded-md border p-3）で囲み、競合分析カードと意匠統一。競合分析にマップと同じ色丸（18px h/w、白ボーダー2px、opacity 0.85）＋社名テキストも同色に④**全ツール横断の見出し余白統一**＝共通コンポ `FieldHeading` に mt-8 デフォルトを追加（+ 全ページ最初の h2 のみ `mt-0` で打ち消し）。h2＋AIButton のフレックス行ではボタン(28px)との items-center 整列オフセット分だけ mt を減らして（mt-7=28px or mt-3=12px + オフセット4px）合計32pxを維持。ToolStep1BasicInfo.tsx の "現状の顧客層" と "競合企業・サービス" セクション、colors Step1 の "既存のブランドカラーがある"、STP Step3 "ターゲット適合マップ"、STP Step4 "ポジショニングマップ" で修正⑤**メイン/サブターゲットカード意匠統一**＝STP Step3/Step4/Step5・portal/strategy・admin/brand/strategy・共通 PositioningMapAndStance/TargetSegmentCards の**6ファイル**でメインカード・サブカードとも境界線を `border-2` に統一⑥**Step5「ターゲット別立ち位置」カード内のターゲット名文字を 18px（text-lg）に統一**。TagInput の内側パディングを 8px に戻し（一時 16px 検討→revert）、Step4のAI推奨ラベル「軸ロック中」表示を削除⑦**STP Step3で「自社の強み」を Step4 に完全移動**（AI生成・必須制約もStep4側へ）＋Step3の「競合分析（任意）」を Step4「自社・競合の一覧」に統合。既存セッションの `session_data` から `positioning.items[].traits` が抜けた分を、`companies.strengths`/`companies.competitors_analysis` から Step4 マウント時に**空欄のみ**自動バックフィル |
| 2026-07-10 リリース | **STP分析ツール T/P表示のコンポーネント化＋ポータル/Step4との共通化**（コミット `e797452`）①`components/shared/` に `TargetSegmentCards`・`TargetDeepDive`・`TargetFitMapPreview`・`PositioningMapAndStance` を新設し STP Step5・Step4・`portal/strategy` の3箇所で共通利用②ポータル `portal/strategy` にターゲット深掘り情報を新規表示③STP Step5 のセグメンテーション（S）セクションと外枠カードを削除しシンプル化④STP Step4 で自社の立ち位置カードを先頭配置、軸選定根拠テキスト削除⑤STP Step3 の `pr-24` をメインカードのみに限定⑥`SurveyBanner.tsx` の見出し文字色をアクセントカラーに⑦segmentation は本体（brand_personas/companies）への同期廃止。**修正コミット** `e797452` で `PersonaCarousel` の `title` prop 未コミット分を追加し本番ビルドエラーを解消 |
| 2026-07-09 リリース | **ペルソナビルダー UI 微調整＋丸型ピル/タグ 14px 統一**①ペルソナビルダー Step4（ジャーニー）＝「感情カーブ（優先度の注釈）」見出しを 18px、ペルソナ名アコーディオンを 16px、「タッチポイント候補プール」上の区切り罫線を削除し余白を mt-5+pt-5(40px) → mt-8(32px) に整理。加えて Step2（ペルソナ生成）の各ペルソナ見出し「ペルソナN」を 18px に（コミット `520f2f1`）②**システム全体**＝`globals.css` の「本文最低14px」一括ルールの除外から `.rounded-full` を撤去し、丸型ピル/タグ（期待印象タグ・各ツールのタグチップ等）を本文と同じ 14px に統一（アバターは text-2xl 等で対象外・ボタン/タブ/Badge/ステッパーは除外維持）。※ personality の Step4 診断結果表示は一旦入れて revert 済み（元の「実行専用ステップ」仕様に戻す） |
| 2026-07-02 リリース | **カラー定義ツールの UX 全面改修＋ブランドステージ削除**（コミット `f1c31f3`）①**Step1（基本情報）**＝補足テキストを見出し直下へ移動＋文言リライト、業種セレクトの背景を白に統一②**Step2（イメージ入力）**＝「追加の質問」を常時表示化、キーワード選択エリアを白カードで括り「ブランドイメージを表すキーワード（3〜5つ）」見出し追加、カテゴリラベルを `FieldSubLabel` で統一、キーワードチップのパディングを 10x12、選択済みリストを独立コンポーネント（`SelectedKeywordList`）に切り出して「選択済み＋追加の質問」を1枚の白カードに統合、ムードボードのラベルを「前のボード/次のボード」に③**Step3（AI提案）**＝見出し「提案パレット + 件数」追加、「AIで再提案」を Sサイズで同一行右端に、パレットカード全体クリックで選択（`role="button"`＋キーボード対応、タブとボタンは `stopPropagation` で保護）、「提案理由」「プレビュー」を `FieldSubLabel` に統一、区切り罫線＋16px間隔で整列、タブUIをスライドインジケーターでアニメーション化＋文字を太字に④**Step5（確定・出力）**＝STP/ペルソナと同じ `ToolConnectActions` パターンに再構成、スティッキーフッターに PDF ダウンロードを移動、CSS 変数コピーはゴーストボタンで温存、連携済み時のグリーンサクセスボックス追加⑤**ブランドステージのコード全消し**＝実効がプロンプト1行のみで機能への影響が薄いため、色ツール入力/バリデーション/state/保存、`generate` プロンプト、`competitors/suggest` プロンプト＋SELECT列、管理画面の編集UI/型/定数/保存の**全参照を削除**。`companies.brand_stage` カラムは後回し（アプリからの参照は消滅済み） |
| 前回リリース（2026-06-27〜28） | STP分析ツールの一連の改修①段階1の決定論化（temperature=0・軸両端ラベル）②ターゲット適合マップを C案（推奨即生成＋遅延切替＋キャッシュ）へ③死蔵データ表示④根拠データを本体へ⑤ConnectModal 累積バグ修正 |
| 前々回リリース（2026-06-24） | ①管理画面ペルソナ保存を id保持sync 化②ペルソナTier1パラメータを離散カラム化＋編集可能に③未使用voice／孤立フィールド撤去④Step4名称を「ジャーニー／タッチポイント」に統一 |
| 未コミットWIP | **なし**（2026-07-15 時点で working tree クリーン。以前残っていた並行セッションのWIP＝news系／`package.json`／`PalettePreview`／tools各Step／`ToolStep1BasicInfo` 等は全てコミット済み） |

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

### 🆕 新規登録ゲート（Googleログイン孤児ガード＋新規owner承認制＋競合ドメイン警告）（2026-06-21／06-30・本番デプロイ済み）

> コミット: `29ef82f`（oauth-gate）/ `8449c72`（承認制＋競合ドメイン）/ `3e12092`（承認バッジ）
> 設計書: `Documents/Claude/ID_bzサービス開発/260630_新規owner登録_競合ドメイン承認制_設計_v1.md`
> 検証手順: `Documents/Claude/ID_bzサービス開発/260630_branding-bz_デプロイ後検証手順_v1.md`

**新規アカウントの3経路（承認の有無）**
1. **既存企業へ参加**（ドメイン一致→企業選択）= **承認制**（その企業の管理者が `/admin/members` で承認）。`/api/signup/join-company` が members を `status='pending'`/`is_active=false` で作成
2. **新規企業を登録**（ドメイン不一致 or 「別企業として新規登録」）= **superadmin 全件承認制**（2026-06-30〜）。`/api/signup` が company を `approval_status='pending'` で作成
3. **Googleログイン** = **既存メンバー専用**（oauth-gate が孤児を削除）

**① Googleログイン孤児ガード**（`/api/portal/oauth-gate`）: `/portal/auth/callback` がログイン確定後に呼ぶ。members（status問わず）と admin_users がどちらも無い「孤児」なら service_role で `auth.users` ごと削除→signOut→`/portal/auth?error=not_registered`。**pending member / admin は削除しない**（＝承認待ちを消さない）。方針A＝Googleは既存者専用・新規はメール登録

**② 新規owner登録の superadmin 承認制**: `companies.approval_status`（'pending'\|'active'\|'rejected'）／`members` は `status='pending'`/`is_active=false`。**承認待ちでも行は作る（パターンA）**＝oauth-gate の誤削除を防ぐ設計。`AdminDataProvider` が pending 企業を「承認待ち」画面でブロック（superadminは対象外）。signup は自動ログインを廃止し step4「承認待ち画面」へ

**③ 競合ドメイン警告**: `blocked_competitor_domains`（手動メンテ・RLS superadminのみ）と登録メールドメインを照合し `companies.competitor_flag`。**自動ブロックはせず承認キューで⚠警告**（誤検知対策。フリーメールは判定不可＝人手判断に委ねる。判定はv1では完全一致）

**④ 承認UI** `/superadmin/signup-requests`: 一覧（競合は⚠赤バッジ）＋承認/却下＋競合ドメインの手動CRUD。**承認**=company active＋members有効化＋本人へ承認メール／**却下**=本人へ却下メール後に members/profiles/admin_users/companies/auth user を削除。サイドバー「新規登録の承認」に**承認待ち件数の赤バッジ**

**⑤ メール通知**: 承認依頼（superadmin宛・競合一致は件名⚠）／承認・却下（本人宛）。宛先 env `SIGNUP_NOTIFICATION_EMAIL`（未設定なら `CONTACT_NOTIFICATION_EMAIL`＝現状 kitakawa@include.bz）。Resend・noreply@branding.bz

**運用判断（2026-06-30 確定）**: 競合=ID INC.の競合（全社共通の単一ブロックリスト）／ブロックリストは手動メンテ専用テーブル／一致時は承認キュー＋警告（即ブロックしない）／新規owner登録は競合か否かに関わらず全件承認制

### 🆕 カラー定義ツール 2026-07-02 改修まとめ（本番デプロイ済み）

> コミット: `f1c31f3` `feat(colors): カラー定義ツールのUX改善＋ブランドステージ削除`

**UX 改修（Step1〜5）**
- Step1（基本情報）: 補足テキストを見出し直下へ移動＋文言リライト、業種セレクト背景を白に統一
- Step2（イメージ入力）:
  - 「追加の質問」を常時表示化（3つ以上選択時のトグル撤去）
  - キーワード選択エリアを白カード内に配置＋見出し「ブランドイメージを表すキーワード（3〜5つ）」追加
  - カテゴリラベルを `FieldSubLabel`（`text-[11px] text-gray-500 mb-1 block`）に統一
  - キーワードチップのパディングを 10x12（`py-2.5 px-3`）
  - 選択済みリストを独立コンポーネント（`SelectedKeywordList`）に切り出し、親（`Step2ImageInput`）で「選択済み＋追加の質問」を1枚の外側白カードに統合＋間に細い罫線
  - ムードボードのボタンラベルを「前の質問/次の質問」→「前のボード/次のボード」
- Step3（AI提案）:
  - カード内に見出し「提案パレット + 件数」追加、「AIで再提案」を Sサイズ（`sm`）で同一行右端に移動
  - **パレットカード全体クリックで案選択**（`role="button"`＋キーボード対応＋`aria-pressed`）。プレビュータブと「この案を選ぶ」ボタンは `stopPropagation` で保護
  - 「提案理由」「プレビュー」を `FieldSubLabel` に統一、区切り罫線＋前後 16px 間隔で整列
  - **タブUIをスライドインジケーターでアニメーション化**（`translateX` + 300ms ease-out）＋文字を太字に
- Step5（確定・出力）:
  - STP/ペルソナと同じ `ToolConnectActions` 共通コンポーネントで「branding.bz への連携」カードに統一
  - スティッキーフッターの右側に「PDFをダウンロード」を移動（左：調整に戻る）
  - CSS 変数コピーはゴーストボタン（`variant="ghost" size="sm"`）で温存
  - 連携済み時：グリーンサクセスボックスを追加（persona と同じ）

**ブランドステージのコード全消し（DB カラムは後回し）**
実効がプロンプト1行のみで機能への影響が弱いため、コード側の全参照を削除:
- `Step1BasicInfo.tsx`: 入力欄・必須バリデーション・state・プリフィル・保存ペイロード・本体同期＋未使用 import（Select 系・BrandStage 型）
- `Step5Export.tsx`: 本体書き戻しペイロードから `brand_stage` を除去
- `api/tools/colors/generate/route.ts`: プロンプトの `- ステージ:` 1行を削除
- `api/admin/competitors/suggest/route.ts`: SELECT 列＋競合提案プロンプトから削除
- `admin/company/page.tsx`: 編集UI・`BRAND_STAGES` 定数・型・SELECT 列・mapping・保存を削除
- **温存**: `shared-profile` の同期プラミング（不活性）／`lib/types/color-tool.ts` の `BrandStage` 型／`companies.brand_stage` カラム本体（DROPは別途SQL＋実行確認で）

### 🆕 STP分析ツール 2026-06-27〜28 改修まとめ（本番デプロイ済み）

> コミット: `bb7f270` / `db92b55` / `4decc2a` / `c05ac80` / `a8bb706` / `d81404f` / `5f16906` / `2fb3ff3`

1. **AI生成の安定化**
   - `temperature=0` で決定論化（適合マップ／ポジショニング／ブランドスタンスの提案）
   - 軸候補を Step2 セグメンテーションの切り口に限定
   - 切り口に `axis_endpoints`（軸両端ラベル）を生成し、適合マップ軸に対称表現で採用
   - `axis_type='ordinal'` のみを軸候補に限定（カテゴリ型は禁止）

2. **C案実装（推奨即生成＋遅延切替）**
   - AI推奨候補（戦略×分散）のみ即時生成
   - 「他の軸も試す」ドロップダウンで 強み×分散・分散×分散 を遅延生成＋キャッシュ
   - 生成済み候補は **⚡即切替**、未生成は **⏱再生成** を識別表示
   - キャッシュ・選択中ストラテジーを session（`targeting.target_fit_map_cache` / `_selected_strategy`）に永続化

3. **キャッシュ永続化バグの完全解消（4層）**
   - 保存側: 空 `{}` 経由の書き込み防止・debounce を待たず即保存・初回マウントの空セーブをスキップ
   - 復元側: `useState` lazy initializer で props から復元
   - effect発火: `lastTargetsRef` でターゲット実値を追跡（配列参照の変化に騙されない）
   - UI: ステップ進捗ローダー（`StepProgressLoader`／`StepProgressPanel`）

4. **死蔵カラム表示UI追加（ステップ①）**
   - 管理画面 `/admin/brand/strategy`: ターゲット適合マップ（軸根拠付き）＋自社の立ち位置×N本カード
   - 社員ポータル `/portal/strategy`: 自社の立ち位置×N本カード（適合マップは社員向け非表示）
   - 既存 `TargetFitMapStatic` を流用・データ無ければ非表示の条件レンダー

5. **STP根拠データの本体保存・表示（ステップ②）**
   - `companies` テーブル拡張: `strengths(text)` / `competitors_analysis(jsonb)`（migration `20260628050011_*`・本番適用済み）
   - 連携API改修で5データを保存:
     - `targeting.buying_factors` → `brand_personas.decision_factors`
     - `targeting.strengths` → `companies.strengths`
     - `targeting.competitors_analysis` → `companies.competitors_analysis`
     - `positioning.axis_rationale` ＋ `items[].reasoning/confidence` → `positioning_map_data` に埋め込み
   - 管理画面: 自社の強み・競合分析・ポジショニング根拠（軸選定の根拠＋各企業の配置根拠＋確信度バッジ）を表示
   - ポータル: 自社の強みのみ表示
   - `ConnectModal`: 上書き確認の**累積処理パターン**（`accumulatedConfirm`）で新規5項目同時連携時の 409 ループバグを解消

6. **オントロジー統合の方針決定（やらない）**
   - 「自社の立ち位置」≠ Value Proposition と概念整理
   - STPの立ち位置は「ポジショニングマップへの分析メモ・考察」として位置づけ
   - `value_propositions` テーブルへの自動投入はしない（手動入力 or 将来の別ツール）

### 🆕 コピーAI（MVP・feature/superadmin-company-view・main未反映）
- **7段階クリエイティブ・パイプライン**（診断→インサイト→切り口→生成→批評→リライト）。一発生成を禁止。
- **尖り度マトリクス**（`lib/copy/role-matrix.ts`）: `copy_role`（hero_h1=狂犬100% / section_heading=70% / body_copy=40% / cta=0%）で態度表明・陳腐句ブロック・評価軸を動的切替。
- **INTENT/FACT/RULES 3層分離**（`lib/copy/ontology-blocks.ts`）: 理念・バリュー=引用禁止（意味だけ翻訳）／proof_points=引用可／governance_rules=禁則。コピペ・平均値化を構造で防止。
- **批評（インスペクター）**（`lib/copy/inspector.ts`/`metrics.ts`/`score.ts`）: 二値チェックリスト＋引用（点数はTS合成）、クリシェ密度・継承重複(containment)はコード計算、処方箋のみ返す（リライト本文は生成器へ再パス）。生成=`claude-sonnet-4-6`／批評=`claude-opus-4-8`。craft_score低×brand_fit高=赤旗→自動リライト送還（最大2回）。
- **人間ゲート**: インサイトは pain_points 等へ接地（source_ref必須・捏造破棄）。クライアントは id のみ送信・サーバ再取得。
- **ワークベンチUI**: `/superadmin/companies/[id]/copy`（superadmin専用）。
- DB（本番適用済み）: `copy_projects`/`copy_insights`/`copy_angles`/`copy_drafts`/`copy_quality_reviews`（RLS superadmin_all＋member_select）。
- 実証: before/after で「30%捏造→実データ42%引用」、退屈なbody_copy(craft46)→赤旗→自動リライト(craft88)、医療コンプラ禁則を狂犬モードでも遵守。

### 🆕 ペルソナビルダー連続改修（feature/superadmin-company-view・main未反映）
- discrete pain_points 写像（連携が `goals.pain_points→brand_personas.pain_points`、`primary_goals→needs` を書く）。
- セグメント型粒度に統一（役割呼称・年齢層・短い体言止め課題）。年収/家族/学歴を削除、口癖・1日の過ごし方は任意。
- マルチペルソナ化（`session_data.personas[]`・connectはN件sync・冪等）＋ターゲット別グルーピング（`target_name` を `persona_data` に格納）。
- ジャーニー: maxTokens 8000＋堅牢パーサ、Step4任意化。一度撤去→北川さん判断で復元（5ステップ・`journey_map_data` 列は残置）。


- スマート名刺 (/card/[slug]) — プロフィール＋企業ブランド＋MVV＋マイクロフィードバック
- 管理画面 (/admin) — 企業情報・メンバー・ブランドガイドライン・お知らせ・名刺テンプレート
- ポータル (/portal) — メンバー向けブランド掲示・タイムライン・KPI・サーベイ回答
- Brand Score (/admin/brand-score) — インナー＋アウター＋マイクロフィードバック
- STP分析ツール (/tools/stp) — 5ステップAI提案＋PDF出力＋branding.bz連携＋自動保存インジケーター。**再設計後の最終形**：Step2 セグメンテーション（A/B/C/D 切り口バッジ・規模感・重視点・axis_endpoints 両端ラベル）／Step3 ターゲティング（購買決定要因・自社の強み・競合分析の入力＋**ターゲット適合マップ C案**＝推奨即生成・他軸遅延生成・キャッシュ即切替）／Step4 ドラッグ操作型ポジショニング（軸選定の根拠・配置根拠・確信度をAI生成）／Step5 ConnectModal（項目別チェック＋上書き確認の累積処理）。段階1の提案は temperature=0 で決定論化。**連携データの本体反映**：適合マップ・自社の立ち位置・自社の強み・競合分析・購買決定要因・ポジショニング根拠まで `brand_personas`/`companies` に保存し、管理画面（全件）／ポータル（強み・立ち位置のみ）に読み取り表示
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
- STP分析 Step5 をパーソナリティ診断と同パターンに刷新（2026-06-11・本番デプロイ済み、commit 61c823b） — ①**連携モーダル**: 単純なAlertDialog→項目別チェックボックス＋プレビュー＋上書き確認の `ConnectModal`（パーソナリティ診断と同UI）。3項目（セグメンテーション/ターゲティング/ポジショニング）を個別ON/OFF可、各項目の既存値があれば「⚠ 既存の○○を上書きします」警告→確定時にAlertDialogで再確認。プレフライトGET `/api/tools/stp/connect?sessionId=&companyId=` で既存値有無を判定 ②**ターゲット戦略の概要文 AI生成**: 新API `/api/tools/stp/suggest-target-summary`（メイン+サブ+セグメンテーション+購買決定要因+自社強みを踏まえ Claude が180〜260字で要約）。Step5表示時に未生成なら自動生成、`session_data.targeting.target_summary` に保存、Sparklesアイコン付きカードで表示＋「再生成」リンク ③**末尾アクション共通化**: 「branding.bz への連携」Card＋「最初からやり直す」ghost を `components/shared/ToolConnectActions.tsx` に切り出し、superadmin デザインシステム「サービス画面 > コンポーネント」カタログにも `tool-connect-actions` として登録 ④**連携API のデータ突き合わせ修正**: 旧コードは `brand_personas[0].target ← targeting.target_description`（短文）のみで `companies.target_segments` を更新せず、`/admin/brand/strategy` の「ターゲット概要」「主なターゲット」に反映されなかった。新コードは `brand_personas[0].target ← target_summary || target_description`（AI生成長文を優先）、`companies.target_segments ← buildTargetSegments(targeting, segmentation)`（メイン+サブを `{name, description}` 配列で書き込み、サブの description は segmentation から引き当て）、プレフライト/上書き確認も `companies.target_segments` の既存有無を判定するよう拡張 ⑤**PDF/連携ボタン配置**: フッターの sticky bar に「戻る | PDFをダウンロード」を配置、上方の独立カードに「連携する項目を選ぶ」（パーソナリティ診断と同レイアウト）

- **ブランド理念オントロジー実装（要素ID化＋型付き関係グラフ＋整合性チェック）**（2026-06-09〜10・本番デプロイ済み） — ブランド体系を「自由文/jsonb」から「ID付き要素＋関係グラフ」へ正規化し、AI参照・整合性点検を可能にした。**全段階 dual-run（新テーブル稼働→読取り切替→編集切替→デプロイ→旧列DROP）を厳守**。
  - **理念要素のID化 `philosophy_elements`**: mission/vision/value/action_guideline/**service（事業内容）** を 1行=1要素 のテーブルへ正規化（旧 `brand_guidelines` の mission/vision(text)・values/action_guidelines/business_content(jsonb) を撤去）。表示（card/portal/guidelines/ci-manual）・AI（targets/competitors/quiz設問/brand-data）・編集（`/admin/brand/guidelines` を行差分CRUDへ）・`tools/shared-profile`（読み書き同期）を全て新テーブルへ切替。旧列は退避テーブル `archive_brand_guidelines_*`（RLS有効・ポリシー無し=service_role限定）へバックアップ後 DROP。取得は `lib/brand/philosophy.ts`（`fetchPhilosophy`）に集約
  - **型付き関係グラフ `element_relations`**: 5種（philosophy_element/value_proposition/proof_point/governance_rule/persona）をポリモーフィック端点(kind+id)で結ぶ関係（guides/evidencedBy/promisedTo/communicatedAs/constrainedBy/conflictsWith）。端点存在＋同一company を SECURITY DEFINER トリガで担保（自己参照/重複はDB制約）。superadmin 企業詳細にオーサリングUI、AI草案生成6ルートへ関係要約を注入（`lib/brand/relations.ts`）。テックブリッジに実関係5件を投入し before/after でAI出力反映を実証
  - **整合性チェック**: ①決定論（`lib/brand/integrity.ts`・5チェック=証拠なき約束/孤立証拠/用語違反/矛盾明示/証拠鮮度）②AI判定（`lib/brand/integrity-ai.ts`・governance_rules の tone/claim/discouraged を Claude が実テキスト評価＋修正案。1社1回呼び出し・NG/OK例few-shot・引用バリデーションでハルシネーション防護）。superadmin 企業詳細に「チェック実行（決定論）」「AI判定を実行」パネル（**読み取り専用・自動修正なし**）
- **デザインシステム管理機能（デザイントークンDB管理＋実測ビューア）**（2026-06-11・本番デプロイ済み、commit ee66a4f/f60c701/fde3b26/7dbcf63） — include-bz から移植し、`/superadmin/design-system`（スーパー管理者専用）でサービス全体の色をパレット管理。**①基盤色までDB化**: `design_tokens`（LP用 `--ds-*` ＋ shadcn基盤 `--primary`/`--foreground`/`--border` 等のHSL成分 ＋ アプリ青 `--ds-app-*`、計52トークン）を `getDesignTokensCss()`→`app/layout.tsx` の `<style id="design-tokens">` で :root 注入、`/api/revalidate` でタグ無効化。基盤色を変えると管理/ポータル/ツール全画面が一括追従（seed=現行値の透過コピーで**見た目不変**）。履歴 `design_token_history`＋ロールバック。RLSは superadmin_all＋SELECT公開（LP SSRがanon読み）。**②ハードコード青の全置換**: `blue-500/600/700` の text/bg/border/ring 165件＋recharts/SVG/inlineの青hex 8件を `--ds-app-*` へ（色1:1一致＝blue-600=accent/700=hover/500=soft）。淡色背景 `bg-blue-50` 等・PDF・ブランドカラーデータは据え置き。**③2階層タブ＋実測ビューア**: 上位＝ウェブサイト(LP)/サービス画面(アプリ)の下線型タブ、下位＝カラーパレット/タイポ/スペーシング/コンポーネント/レイアウト/レスポンシブ/ドキュメントの7タブ。タイポ等は対象ページ（website=公開LP群／service=管理ダッシュボード等）を不可視iframeで**実測**（ハードコードの転記表を持たない）。コンポーネントは実体描画＋使用色をトークン逆引き。**④ドキュメントタブ（design.md）**: 自動サマリー（DBトークン/実測タイポ・スペーシング/コンポーネント/@media）＋手書きメモ（`design_docs` テーブル・scope別・RLS superadmin）を結合し**コピー/.mdダウンロード**。編集UIは hex/rgba/HSL成分のマルチフォーマット対応（`hsl-color.ts` で双方向変換）。DB migration: 20260611130000/140000/150000。残: 淡色背景の青・gray系623件のトークン化は将来
- **モバイルUX基準 v1.0 策定＋全画面サイジング是正（バッチ進行中）**（2026-06-16・本番デプロイ済み） — HIG(44pt)/Material(48dp)/WCAG AA(4.5:1)/iOS入力16px を `CLAUDE.md`「モバイルUX基準（確定版v1.0）」に恒久化（タップ44px/入力16px/コントラスト4.5:1/常用12px未満廃止/見出し二段階）。是正バッチ: ①フォーム系（ラベル・見出し`text-xs→text-sm`／入力`h-10→h-11`）`2563cba` ②検索入力`h-8 text-xs→h-11 16px`・フィルタ/期間ピル`text-xs→text-sm`・FABラベル/アイコン拡大`ff9cae7` ③FAB高さ`h-12→h-14`（fab.tsx・浮遊ボタンの例外XL）`4d8a179` ④§6 `--muted-foreground 45.1%→40%`（globals.css・全画面の薄グレー可読性）＋基準恒久化`235a48f` ⑤§3 タップ領域44px化＝いいね/コメント`min-h-11`(横並び維持・glyph20px)／…メニュー・コメント送信・KPI編集削除・目標編集`size-7/8/9→size-11`／サイドバー項目`h-10→h-11`／ヘッダーbell・トグル`size-10→size-11`／コメント入力`h-9→h-11`(16px)／画像削除`size-8→size-10` `f7b35dd`。**glyphは20-24px維持しヒット領域(padding/min-h)で44px確保**。残: batch3(メタ12px未満廃止)・batch4(カード/ダイアログtitle16-18px)・phase2(認証/名刺/管理)
- **Web Push 通知 ブロック時の再許可案内UX**（2026-06-16・本番デプロイ済み、commit 4268e68） — 一度「許可しない」を選ぶと `Notification.requestPermission()` が再ダイアログを出さず行き止まりだった問題を解消。`components/pwa/PushToggle` が `permission==='denied'` を検知し、iPhone/PC それぞれの設定からの再許可手順を画面内に案内（旧・赤エラーの置換）。default（ダイアログ閉じ）と denied を区別
- **管理サイドバー再編＋メニュー整理**（2026-06-24・本番デプロイ済み、commit 827a9a6/33e65a6） — ①「ブランド基本情報」→「**基本情報**」改称（サイドバー/動的タイトル/レイアウト/パンくず4箇所統一）しユーザーメニュー（アバターのドロップダウン）内へ移動 ②「アカウント管理」→「**アカウント**」に改称しユーザーメニューへ移動 ③ダッシュボードのタブで「タイムライン分析」が `timeline_enabled=false` 企業に出ない不具合を修正（brand-score と揃えて常時表示）④ラーニングの「視聴分析」タブを**ダッシュボードのタブへ移設**（新ルート `/admin/analytics/learning`）⑤サイドバーに**「構築」グループ**（STP分析/ペルソナビルダー/ブランドカラー定義＝各ツールの `/tools/*/app` へ）と**「浸透」グループ**（サーベイ管理/理解度テスト/ラーニング）を新設＝3レイヤー構造に整合 ⑥業種マスタに大分類「**コンサルティング**」追加（中分類: 経営・戦略/人事・組織/IT・DX/財務・会計/ブランド・マーケティング/その他）⑦行動指針の説明文を改行可（AutoResizeTextarea）＋D&D並べ替え対応
- **ペルソナビルダー ↔ 管理画面ペルソナの呼応（5ステップ維持版）**（2026-06-25・Stage1 commit 022164d は push済／Stage2'＋Step5レイアウトは実装済み・未コミット） — Persona Builder ツールの出力構造を管理画面 `/admin/brand/strategy` のペルソナ入力に揃えた。**Stage1**: GoalsData の「課題・悩み(challenges)」を「課題・ペインポイント(pain_points)」1欄に統合（管理画面が1欄のため。旧challengesは normalize で pain_points へ移送＝後方互換）、「主な目標(primary_goals)」を「ニーズ」表記（管理画面 needs と一致）。suggest-goals/suggest-journey の参照も pain_points に一本化。**Stage2'**: Step2に「説明(description)」欄を追加しAI生成（1〜2文の状況説明）→ description列へ（**copyAIが personaBlock の `状況:` として読む生きた入力**＝従来の「職業・規模」自動連結より太る）。connect/persona-mapping の description写像を「入力値優先・空なら連結フォールバック」に。Tier2（性別・役職・勤務先規模・媒体・性格特性・購買動機）は「詳細設定」アコーディオンに退避。Step2/Step3/Step5を管理画面の項目順（名称→年齢層・職業→説明→ニーズ→課題・ペインポイント→意思決定要因→購買障壁→ブランドへの期待）に。Step5は色分けタグの2カラム要約をやめ管理画面と同じ縦一列の読み取りビューに作り替え。**方針判断**: 当初「案3＝1枚統合カード（必然的に4ステップ）」で着手したが、北川さんが「ステップを減らしたくない」→**5ステップ維持・統合せず**に確定（統合カード Step2Persona.tsx は破棄、Step2/3は別ステップのまま管理画面レイアウトに揃える）。**追加（2026-06-26）**: ①Step2の「詳細設定」アコーディオンを廃し Tier2 を常時表示に ②Step5に **Step4Journey を `readOnly` で読み取り埋め込み**（見出し/説明/ペルソナ一覧カード/編集UI/フッターを隠した実ビュー＝感情カーブ＋タッチポイント候補プール）③**PDF出力にジャーニー設計を反映**（`PersonaPdfDocument`/export route）④連携ダイアログに **「ジャーニー設計は連携対象外＝branding.bz未反映・PDFのみ反映」** の注記。⑤**ポータル「接し方」**のペルソナ表示を改善（`PersonaCarousel`＝2.5枚スライダー／顔アイコン表示／`brand_expectations` 表示／課題チップ色をビルダーと統一(orange)＋ラベル「課題・ペインポイント」／ニーズ・課題は3件＋「もっと見る」展開アニメ／年齢層・職業を改行＋`min-h`でニーズ位置揃え／職業フォールバック説明の重複抑制）。**判断メモ**: セグメント説明文をペルソナ「説明」欄へ転化する案は、セグメント=集団の括り／説明=個人の背景で性質が違うため**不採用**。**残**: 実機E2E（使い捨て企業でconnect→管理画面反映：説明＝入力文章が入る／課題・ペイン統合が効く）。
- **同業者対策：利用規約に競合排除条項＋運用ポリシー＋テストデータ整理**（2026-06-24・本番デプロイ済み、commit 7d2df63／DB削除済み） — 同業者（ブランディング・デザイン関連事業者）の利用を防ぐ。①利用規約 `/terms` に「**第4条（同業者の利用制限）**」新設（第3条 利用登録の不承認事由・第12条 登録抹消事由にも該当を追記、条番号繰り下げ・最終更新日更新）②運用ルールを `docs/competitor-screening-policy.md` に策定（審査基準クロ/グレー/シロ・北川一次審査1営業日・**ブランディング系は一律クロ**・却下文面・遡及審査手順）③**既存12社を遡及棚卸し**＝実在の外部登録に同業者なし（branding系3社は example.com のデモ/シード、ID INC.は運営）。要確認は atelier Kiitos（業種未確認）④**テスト3社をDB削除**（テスト株式会社/株式会社あいうえお/トヨタファイナンス＝著名社名を個人gmailで登録）＋auth ユーザー4件。CASCADE/NO ACTION のFK構造を確認しアトミックなトランザクションで削除（CTD＝北川さんのdots.bz、atelier Kiitos は残置）。**残: ~~承認制ゲート~~ ✅2026-06-30実装済（`8449c72`・§開発状態「2026-06-30 リリース」参照＝新規owner登録の superadmin 全件承認制＋競合ドメイン一致で⚠警告）／AI同業判定の実装は別タスク（未着手）**

---

## 4. 残タスク

- ✅【対応済み 2026-06-25・方針①採用】管理画面のペルソナ入力項目が Persona Builder の出力に追いついていない（不足フィールド多数）（2026-06-24 調査 → 2026-06-25 実装） — **対応**: 方針①（管理画面に不足フィールドを追加＋ビルダーを管理画面レイアウトに呼応）で実装。①Tier1（意思決定要因/購買障壁/ブランドへの期待）を離散カラム化＋管理画面で編集可（commit 891f854・本番反映済）②ビルダーを管理画面に呼応＝課題・悩み＋ペインを「課題・ペインポイント」1欄に統合（Stage1 022164d）、主な目標→ニーズ表記、説明欄追加でcopyAIの`状況:`入力を強化、Tier2は詳細設定アコーディオン、Step2/3/5を管理画面の項目順に（Stage2'・実装済み未コミット）。**5ステップ維持**（1枚統合カード＝4ステップ化は北川さん判断で不採用）。**残**: 実機E2E（使い捨て企業でconnect→brand_personas→管理画面反映の通し確認）。 — **当初状況**: 管理画面 `/admin/brand/strategy` のペルソナ編集は discrete 6項目のみ（`PersonaItem` ＝ name / age_range(年齢層) / occupation(職業) / description(説明) / needs(ニーズ) / pain_points(課題・ペインポイント)）。一方 Persona Builder ツールの最終出力（`app/tools/persona/app/[sessionId]/components/persona-types.ts` の `Demographics` ＋ `GoalsData` ＋ `JourneyMap`）はもっと多い。
  - **ツール出力にあって管理画面に入力欄が無いフィールド**: 勤務先規模(company_size) / 居住地(location) / 性格特性(personality_traits) / 主な目標(primary_goals) / 課題・悩み(challenges ※pain_points とは別) / 意思決定要因(decision_factors) / 購買動機(buying_motivation) / 購買障壁(buying_barriers) / ブランド期待(brand_expectations) / 成功定義(success_definition) / 性別(gender) / 役職(company_role) / 趣味(hobbies) / 利用メディア(media_channels) / 日常(daily_routine) / 口癖(quote) / カスタマージャーニー(journey_map)。
  - **重要**: これらは連携 `/api/tools/persona/connect` で `brand_personas` の **`persona_data`(jsonb) ＋ `journey_map_data`** に**保存はされている**が、管理画面UIが**表示も編集もしていない**＝ツールで作ったリッチな内容が branding.bz 側では見えない／欠落して見える。discrete列への写像は `lib/tools/persona-mapping.ts`（needs / pain_points / age_range / occupation / description）。
  - **要対応（判断ポイント）**: ①管理画面のペルソナ編集に不足フィールドを追加し `persona_data` を表示・編集可能にする か ②連携で来たリッチ情報は「読み取り専用表示」に留める か。まず①②どちらの方針かを北川さんに確認 → 実装。
  - **関連ファイル**: 管理=`app/admin/brand/strategy/page.tsx`（`PersonaItem` 型・fetch・handleSubmit）／ ツール型=`app/tools/persona/app/[sessionId]/components/persona-types.ts`／ 連携=`app/api/tools/persona/connect/route.ts` ＋ `lib/tools/persona-mapping.ts`／ DB=`brand_personas`（discrete列 ＋ `persona_data` jsonb ＋ `journey_map_data`）。

### 🆕 コピーAI／ペルソナビルダー（feature ブランチ・main未反映）

#### ジャーニーUI差し替え（2026-06-20・実装済み・未コミット）
- [x] ~~ジャーニーUI方針：タッチポイント中心化（感情カーブは優先度の注釈に格下げ）~~ ✅
- [x] ~~マルチペルソナ化：`session_data.personas[i].journey_map` 構造へ＋後方互換移送＋connect全ペルソナ書込~~ ✅
- [x] ~~Step4Journey 全ペルソナ集約ビュー：感情グラフ重ね描き／TPプール集約／優先度＝カバー人数×ネガ感情～~ ✅
- [x] ~~フィルタchip：「全員 ⇔ 単体ペルソナ」が感情グラフ・TPプール・Accordionの3箇所に連動~~ ✅
- [x] ~~suggest-journey: 「短い共通ラベル」プロンプトに変更（cov集約が効くように）~~ ✅
- [x] ~~「感情：すべて/ネガのみ」フィルタ削除（相対優先度Highと重複のため）~~ ✅
- [ ] **Lv2タッチポイント分類体系**（`lib/persona/touchpoint-vocabulary.ts` 新設・12カテゴリ・90ラベル前後・**brand_creative カテゴリでID INC.発注機会の間接導線を組み込む**）— 指示書作成済み（`outputs/260620_ペルソナビルダー_Lv2_タッチポイント分類体系_指示書.md`）→ Claude Code に渡す
- [x] ~~**Step2「デモグラフィック」→「ペルソナ生成」改名**~~ ✅（ステッパー＝基本情報/ペルソナ生成/課題・購買行動/ジャーニー設計/確認・出力。2026-06-25 時点で反映済み）
- [x] ~~**管理画面ペルソナとの呼応**~~ ✅（2026-06-25・§3「ペルソナビルダー↔管理画面ペルソナの呼応」参照。Stage1 push済／Stage2'＋Step5は未コミット。5ステップ維持で確定）

#### 元の残タスク
- [ ] 実データでフルパイプライン一周（ID INC.でペルソナ作成→連携→コピーAI）を実施。
- [ ] main 反映・本番デプロイの判断（§開発状態）。`lib/claude-api.ts` モデルhotfixの main 反映も保留中。
- [ ] コピーAI: richなvoice注入（`persona_data` 口癖等を生成器へ）／body_copyトークン上限調整／クライアント画面への開放。
- [ ] リィツメディカル【B】3件（取引施設数・対応スピード実測値・医師の声）を次回打合せで確認→管理画面から追加。


### 🔴 Phase 2（進行中）
- [ ] タイムライン機能の完成
- [ ] KPI管理機能の完成
- [ ] Brand Scoreダッシュボードの改善

### 🟢 UI/導線（フォローアップ）
- [x] ~~ブランドパーソナリティの人格(traits)編集を `/admin/brand/personality` に集約~~ ✅ traits をパーソナリティへ、トーンをバーバルへ移動して整理（2026-06-03）
- [x] ~~ポータルメニュー「感じられ方」のリンク先を /portal/personality（独立ページ）へ確定する~~ ✅ サイドバーを /portal/verbal → **/portal/personality** に変更＋アクティブ判定追加、breadcrumb/dynamic-title に personality 登録、ダッシュボードに「らしさ」4象限概観カード設置。本番デプロイ済み（2026-06-03）

### 🟣 モバイルUX是正（基準v1.0準拠・1バッチずつ verify→deploy）
- [x] ~~batch1 基準確定＋グレー濃色化~~ ✅（235a48f）
- [x] ~~batch2 §3タップ領域44px~~ ✅（f7b35dd）
- [ ] batch3 §1メタ文字の12px未満廃止（`text-[10/11px]→text-xs`・日時14px）。survey5段階caption/KPI密集ウィジェットは幅制約ありで個別確認。例外据え置き＝通知数バッジ・アバター頭文字
- [ ] batch4 カード/ダイアログの title 16-18px＋KPIセットアップ入力16px化
- [ ] phase2 認証画面・スマート名刺(/card)・管理(/admin)を同基準で監査・是正

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
| 2026-06-16 | **モバイルUX基準v1.0が判定基準**（`CLAUDE.md`「モバイルUX基準（確定版v1.0）」）。タップ44px（**glyphは20-24px維持し `padding`/`min-h-11` でヒット領域だけ44px確保**）・入力16px（iOSズーム防止）・コントラスト4.5:1・常用テキスト12px未満廃止・見出し二段階（タイトル16-18px/eyebrow14px）。是正は **token→共通コンポーネント→codemod→個別** の順、1バッチずつ実機/プレビュー確認後にデプロイ |
| 2026-06-16 | **`--muted-foreground` を 45.1%→40%**（globals.css・白地で約4.7:1→約5.7:1）で日時/メタ/薄ラベルを全画面底上げ。これ以上薄いグレーを小文字に当てない。**FABは例外的に `h-14`(56px)**（fab.tsx・浮遊アクションボタン。インライン大は `h-12` のまま） |
| 2026-06-16 | **作業フォルダ移転**: branding-bz 正本は **`~/dev/branding-bz`＋GitHub**。旧 `~/Documents/.../ID_bzサービス開発/branding-bz`(iCloud) は凍結＝新規作業しない。.md知識はリポ内（CLAUDE.md @import）、成果物はGoogle Drive、`.env.local` は各自手元。STATUSは `docs/BRD-PROJECT-STATUS.md`（repo内）へ移設済み。プレビューは作業ルートが ~/dev のセッションで行う |
| 2026-06-18 | **コピーAI設計の核**: ①事実は機械・語りはAI（craft採点はLLMでなくコードで合成）②生成器≠批評器（生成sonnet／批評opusの別モデル）。INTENT(引用禁止)/FACT(引用可)/RULES(禁則) を物理分離してプロンプト注入。クリシェ密度・継承重複(containment)・数値捏造は決定論計算、Tension/Stance/藁人形チェックのみLLM。批評は処方箋のみ返し本文は書かせない（先祖返り防止） |
| 2026-06-18 | **コピーAI DB**: `copy_projects/insights/angles/drafts/quality_reviews`（RLS superadmin_all＋member_select）。人間ゲートはクライアントから id のみ受け、本文はサーバ再取得（改ざん防止）。インサイトは pain_points 等へ source_ref 接地必須・接地しない候補はコード破棄 |
| 2026-06-18 | **ペルソナ粒度はセグメント型(役割アーキタイプ)に統一**＝オントロジー(discrete pain_points)に揃えるため。suggest-goals の課題は短い体言止め。rich profile(口癖等)は voice 素材として temporarily 任意保持。connect は company のペルソナを sync(上書き)するため既存ペルソナのある company でうかつに連携しない |
| 2026-06-18 | **JSON生成の途中切れ対策**: suggest 系で maxTokens 不足だと長文出力が切れて `JSON.parse` 失敗。maxTokens 引き上げ＋「完結した最後のオブジェクトまでで配列を閉じる」救済パーサで復旧。継承重複は対称Jaccardでなく containment(|A∩B|/|A|) で測る（短いコピペを大コーパスで希釈しないため） |
| 2026-06-20 | **ジャーニーは孤立データ**: 生成時は guardrails＋relations を注入する(入力はオントロジー参照)が、`journey_map_data` の出力は下流(コピーAI/オントロジー)から読まれない。コピーAIの起点は pain_points。ジャーニーUIシンプル化は3案提示中 |
| 2026-06-20 | **ジャーニーUIをタッチポイント中心に再定義**：ジャーニー＝「ブランド施策を当てるタッチポイントを洗い出す道具」。感情カーブは「優先度の注釈」に格下げ。`Persona.journey_map` でマルチペルソナ化、UIは「全ペルソナ集約ビュー」（重ね描き感情グラフ＋集約TPプール＋単体絞り込みフィルタ）。優先度＝`カバー人数 × ネガティブ感情` で算出（`calcPriority` 関数で1箇所集中・調整容易）。集約キーは `(stage_idx, normalize(tp_name))` |
| 2026-06-20 | **タッチポイント表記の集約バグ→共通ラベル化で対処**：suggest-journey が「具体的・固有名詞（括弧でキーワード補足）」で出していたためペルソナ間で文字列が一致せず cov=1 ばかりで優先度が全Lowに張り付いた。プロンプトを「短い共通ラベルで、同じ接点は必ず同じ表記」「長い括弧付き固有表記禁止」に変更して解消（実生成で 3人カバー15行・2人カバー4行に）|
| 2026-06-20 | **感情フィルタ削除（重複機能の整理）**：相対優先度に変えた後は「ネガのみ」と「優先度High」が同じものを別の言い方で再フィルタする状態に。`emotionFilter` state＋UI＋適用ロジックを削除。残るのは「表示ペルソナ（全員/各ペルソナ）」と並び替え（優先度/ステージ/カバー人数）＋「全ペルソナ接触のみ」フィルタ |
| 2026-06-20 | **タッチポイント語彙の偏り対策＝Lv2分類体系**：suggest-journeyの代表ラベルが17件のデジタル偏重だったため、AIの選択肢自体がオンライン中心になっていた。`lib/persona/touchpoint-vocabulary.ts` で12カテゴリ・90ラベル前後（オンライン検索/オウンド/ペイド/SNS/アーンド／イベント／人的対面・紹介／紙媒体／CS／物理体験／検討購入／**ブランドクリエイティブ表現**）を体系化。業態タグ（saas/b2b/b2c/manufacturing/medical/local_smb等）で `★主要` マークを付与。`brand_creative` カテゴリ（ロゴ/CI/空間/サイン/ムービー/パッケージ/印刷物）は **ID INC.のクリエイティブ領域を網羅して間接的セールス導線を組み込む** マーケ意図あり |
| 2026-06-21 | **公開サイト ダークデザイン全面移行＋制作事例ショーケース刷新（本番デプロイ）**：旧LP(`/lp`)を `/` 系（`app/(site)`）へ昇格、旧デザインは `/classic` 退避。トップの「Made with」風ショーケースを7列パターン化＋読み込みごとにランダム並び替え。各カードを実クライアントの実事例に差し替え（画像は `public/marketing/images/showcase/showcase-NN.jpg`、PNG→JPG q80最適化。業種ラベルは `lib/constants/industries.ts` の業種マスタに準拠）。一部カードはカスタマーボイス化（櫻井運輸/テックブリッジ/ritz medical）。無料ツール4ページ（STP/ペルソナ/カラー/パーソナリティ）をダーク化＋ファーストビューのキャッチを「AIでブランディングを加速させる。」に統一。`/portal/auth` も新デザインに調整 |
| 2026-06-23 | **AIボタンの文言・配置ルールを策定し4ツール統一**（`docs/260622_AIボタン文言ルール_v1.md`）。文体「AIで{動作}」（動作語＝STP/カラー=提案→「提案生成」・ペルソナ=生成・パーソナリティ=診断）、ローディング「{動作}中…」、配置＝見出し直下・左寄せ（下部ナビ内に置かない／二重配置しない）。見出し下リード余白は全ステップ16px(`mb-4`)に統一 |
| 2026-06-23 | **STP Step4 ポジショニングをドラッグ操作型に改修**（`InteractivePositioningMap`新設：Pointer Events・`touch-action:none`・ヒット領域22px・`setPointerCapture`・viewBox 5:3全幅・1カラム＝リスト→詳細スライダー→チャート）。表示専用 `PositioningMap`・`PositioningData`・APIは不変。**ペルソナ Step4（ジャーニー設計）は 表示フィルタ＋感情カーブ＋タッチポイント候補プールを1カードに統合**（感情グラフ＝ステージナビ＋ペルソナ別詳細アコーディオン、ペルソナ選択は上部フィルタに集約）。4ツールのヘッダーロゴを LP と同じ `/logo.svg`(top -2px) に統一（本番デプロイ済み） |
| 2026-06-23 | **git運用の教訓**：`git add <file> && git commit` は**インデックス全体**をコミットするため、並列セッションがステージ済みの変更（旧 `Step2Demographics`/`Step3Goals` の削除・再作成）を**巻き込んで誤コミット**した。対策＝**`git commit -m "…" -- <path>` のパス指定コミット**で自分の変更だけを確定する（`git add -A` 同様に巻き込み注意） |
| 2026-06-25 | **ペルソナbuilder↔管理画面の呼応＝Tier整理**: 管理画面ペルソナフォームが正＝Tier1（discrete: needs/pain_points/decision_factors/buying_barriers/brand_expectations）＋本人基本（name/age_range/occupation/description）。ビルダーのTier2（性別・役職・勤務先規模・媒体・性格特性・購買動機）は `persona_data` 止まりで管理画面非表示＝「詳細設定」アコーディオンへ。**description はオントロジー(graph)の端点ではないが copyAI が personaBlock の `状況:` として読む生きた入力**（`lib/copy/ontology-blocks.ts`／`insights.ts`／personality診断も参照）＝消さず、自動連結より入力文章を優先。孤立フィールド（居住地/趣味/成功定義/1日の過ごし方/口癖）は consumer 無し＝撤去。**「案3＝1枚統合カード」は Step2+3 を1枚にする＝必然的に4ステップ化するため、ステップ数を保ちたい要件では統合せず各ステップを管理画面レイアウトに揃える（5ステップ維持）方が合う** |
| 2026-06-26 | **ジャーニーの扱い＋ポータル接し方の表示改善**: ジャーニー設計は branding.bz 連携の対象外（`brand_personas.journey_map_data` には書くが管理/ポータルで表示しない）＝**PDFのみ反映**と決定。Step5に `Step4Journey` を `readOnly` で埋め込み（編集UI/AI生成/フッター/見出し/ペルソナ一覧カードを隠した実ビュー）、PDFテンプレにジャーニー節を追加、連携ダイアログに注記。ポータル「接し方」＝`PersonaCarousel`(2.5枚 scroll-snap)・顔アイコン・brand_expectations・課題色をビルダーと統一(orange)・ニーズ/課題3件＋もっと見る(grid 0fr→1frアニメ)。**判断**: セグメント説明文をペルソナ「説明」へ転化する案は性質が違う（集団の括り≠個人の背景）ため不採用。**運用教訓**: 提案でも懸念は実装前に率直に指摘する（黙って実装しない）。**git**: 並行セッションが `components/*PositioningMap.tsx` を編集中＝パス明示コミットで巻き込み回避 |
| 2026-06-26 | **STP Step2セグメンテーションのUI改善**: AIが出力済みなのに画面に出ていなかった `size_hint`/`priorities` を表面化（Step3ターゲット選定の判断材料の取りこぼし解消）。切り口に **A/B/C/D 番号バッジ**（色分け・5つ目以降グレー）、各セグメントに **規模感バッジ**（大=緑/中=黄/小=灰、クリックで循環）、**「重視すること」入力欄**、**2列グリッド**化＋削除ボタンをカード右上に。型・API・プロンプトは不変。**運用**: 並行セッションが同フォルダで大規模リファクタを実時間編集中だったため、本Step2のみをパス指定コミット(`697ecfd`)＆push＝検証済みの自分の変更だけを安全に出荷（リファクタ確定後に別途出荷） |
| 2026-06-27 | **並列セッション環境ではローカル `tsc` が本番ビルドと一致しない**: 別チャットがローカルにのみ存在する編集（例：`StepProgressLoader` に新 export を追加）を入れた状態だと、自分の `npx tsc --noEmit` は**ローカルの未コミットファイルを参照して通る**が、Vercel は origin のコミット済みツリーでビルドするため `has no exported member` で落ちる。**対策**＝push 前に「自分が import している先（例: `components/stp/StepProgressLoader.tsx` の `StepProgressPanel` export）がコミット済みか」を確認する。インポート依存が未コミットなら、その export だけ追加コミットで先に出す（実際 `StepProgressPanel` の追加コミットでデプロイ復旧）。`git status`／`git diff origin/main -- <dep>` で依存の同期状態を見る、または `next build` でローカル本番ビルドを通してから push するのが安全 |
| 2026-06-27 | **React useEffect の deps は「配列の参照」で発火する罠**: `setSubTargets(prev => prev.filter(...))` は中身が同じでも**毎回新しい配列**を返すため、それを依存に持つ autosave/再生成 effect が無限に再発火し、適合マップが「リロードのたびに再生成」される事故になった。**対策2点**＝①フィルタ結果が同一なら**同じ参照を返す**（`filtered.length===prev.length ? prev : filtered`）②effect の発火判定は配列参照ではなく**実値を正規化した文字列を ref に保持して比較**（`lastTargetsRef` 方式：`${mainTarget}|${[...subTargets].sort().join('|')}` を前回値と比較し、変化時のみ再生成）。マウント直後は初回フラグで skip、生成中は busy ref で autosave を抑止。さらにハードリロードは unmount cleanup が走らないため、デバウンス保存ではなく**生成完了時に即時保存**する |
| 2026-06-28 | **上書き確認の累積処理パターン**: サーバーが複数項目の上書き確認を `409 needsConfirm` で**1項目ずつ順番に**返す設計だと、クライアントが「今回確認した項目だけ」を送ると前ラウンドの確認が毎回失われ、サーバーが先頭項目で再び 409 → **無限ループ**になる。**対策**＝確認済み overwrite フラグを `accumulatedConfirm` state に**累積**し、各ラウンドで `{...accumulatedConfirm, 今回分:true}` の `newConfirm` を作って**直接** `executeConnect(newConfirm)` に渡す（state 更新の遅延に依存しない）。リセットは**成功時・キャンセル時・新規開始時**の3箇所。`ConnectModal.tsx` で適用 |
| 2026-06-28 | **STP「死蔵データ／届かない情報」の双方向是正**: 監査で①保存されるが表示されないカラム（`target_fit_map_data`・`brand_stance_statements`）と②ユーザー入力/AI生成だが連携で1ビットも本体に届かないデータ（`buying_factors`・`strengths`・`competitors_analysis`・`axis_rationale`・items の `reasoning`/`confidence`）を特定。**ステップ①**＝①を `/admin`・`/portal` に読み取り表示（DB変更なし、既存カラムを読むだけ）。**ステップ②**＝`companies` に `strengths(text)`/`competitors_analysis(jsonb)` を追加し、`connect/route.ts` の保存マッピングを拡張（購買決定要因→`brand_personas.decision_factors`、強み・競合分析→`companies`、軸/配置根拠→`positioning_map_data` に埋め込み）、管理画面は全件・ポータルは強みのみ表示。**教訓**＝連携APIは「ツールで作った値の出口」なので、新フィールドを足したら connect の保存マッピングと表示側の両方を同時に追わないと死蔵カラムが生まれる |
| 2026-06-30 | **UI統一のまとめ出荷（本番デプロイ・commit f4617a5）**: ①各ツールStep1の基本情報フォームを共通コンポーネント `components/shared/ToolStep1BasicInfo.tsx` に集約（STP/ペルソナは薄いラッパー化。`showCompetitors`/`targetLabel`/`targetLead`/`nextLabel` で出し分け。ペルソナは競合欄を非表示＝companies.competitors を空で潰さないガード付き。AI提案の suggest-targets は「STP専用でなく共用」扱い）。②カラー定義・パーソナリティの**フッター次へ/戻るをL仕様**(`h-14 px-6 text-base font-bold`)に統一（STP/ペルソナと同段。全16箇所）。③**プルアップ(ユーザー)メニューをポータル基準に3画面統一**（管理・スーパー管理を `h-11 px-3 gap-2 text-base font-medium` + content `p-2`）。④スーパー管理サイドバー背景を黒寄りダークグレー、管理画面サイドバーをワントーン調整、`SUPER ADMIN` ヘッダーバッジ削除。⑤ポータル: ミッションカード背景にコンセプトビジュアル(白80%スクリム＋blur)、らしさ4象限の左縦バー撤去、考え方ページの節間余白32px・沿革レイアウト・投稿カード余白(10/12px)・カード間隔(8px)・罫線撤去、ペルソナカルーセルのページネーションを見出し横へ。⑥`PersonalityTraitList` タイトル・ガイドライン見出しを18px、カラー入力を正方形(スウォッチ余白除去)＋全丸。**呼称確定**: フッター次へ系(`h-14 px-6 text-base`)を「Lサイズ」と正式命名（S/M は AIButton）。**git運用**: 並行セッションの未コミット変更（news系/`package.json`/`PalettePreview`）と混在する作業ツリーから、**自分の17ファイル＋新規1件のみをパス指定コミット**し他者WIPを巻き込まず出荷。実機はローカルプレビュー(3004)で各変更を都度検証、tsc はプロジェクト全体0エラー |
| 2026-06-21 | **「Googleで続ける」は auth.users だけ作って members を作らない**＝新規登録(`/api/signup`)と経路が別。放置すると①members無しで [[portal-access]] ゲートに弾かれ**ユーザーが詰まる**②そのメールアドレスを占有して**後の正規登録が「既に登録されています」で衝突**、の二重の害。対策＝コールバックで孤児判定→`auth.users` ごと削除（`/api/portal/oauth-gate`）。**判定は members を status で絞らない**のが要点（`status='pending'` の承認待ちを消さないため）。「Googleログインできない／メールが既に使われている」系の調査は、まずこのゲートと `auth.identities` を疑う |
| 2026-06-30 | **承認待ちの表現は「行を作る（パターンA）」が正**: 新規owner承認制を「承認まで members/admin_users を作らない（パターンB）」で作ると、その承認待ちユーザーが Google ログインした瞬間に **oauth-gate が孤児と誤判定して削除**する。company を `approval_status='pending'`・members を `status='pending'`/`is_active=false` で**先に作る**ことで、既存 gate を改修せず安全に両立できる。将来パターンBへ変える場合は gate の削除判定に「保留申請が無いこと」の確認を必ず足す |
| 2026-06-30 | **競合ドメインは「即ブロック」でなく「承認キュー＋⚠警告」**: 自動ブロックは誤検知時に正当な登録を締め出し、しかもユーザー側に理由が伝わらない。全件承認制を土台にし、競合一致は**人手判断を助ける警告フラグ**に留める設計を採用。フリーメール（gmail等）はドメインで判定できないため、そもそも自動判定に頼らず人手審査に委ねる前提が要る |
| 2026-07-15 | **shadcn `SidebarMenuBadge` は既定 `top-1.5` の上寄せ**＝項目40px/バッジ20pxだと中心が4px上にずれる。中央寄せは `top-1/2 + -translate-y-1/2` だが、既定は **peer variant**（`peer-data-[size=default]/menu-button:top-1.5`＝specificity (0,2,0)）で当たるため、**素の `top-1/2`(0,1,0) では勝てない**。同じ peer variant キーで上書きすると tailwind-merge が同一プロパティとして解決し後勝ちになる。またバッジは `rounded-full` にすると globals.css の**本文14px底上げの除外条件**に合致し、文字が肥大化しない（`rounded-md` のままだと 12px→14px に膨らむ） |
| 2026-07-15 | **CSS変数のテーマは一部だけ変えると取り残しが出る**: スーパー管理サイドバーは背景だけ紺→無彩色(`0 0% 10%`)に変更済みで、`--sidebar-accent`(紺 `213 45% 35%`)・`--sidebar-border` が紺のまま残り、アクティブ項目が**明度+25pt・色相ありで浮いていた**。通常管理画面の既存関係＝**「背景と同色相・明度+8pt」**（`220 13% 18%`→`218 14% 26%`）が事実上のルールなので、それに合わせて `0 0% 18%` に。**UIの「揃った/馴染む」は computed値の実測で確認する**（明度差・コントラスト比13.6:1 を数値で確認してから断言） |
| 2026-07-15 | **「画像を使って」は再現SVGでは代替にならない**: 添付画像と同形状のパスがリポ内(`app/icon.svg`)にあったためインラインSVGで再現したが、北川さんの要件は**提供された正式データそのもの**。チャット添付は私からファイル化できないが、**元ファイルは Mac 上にある**（今回は `~/Desktop/Group 8963.png`）ので、`find`＋`sips`(寸法)＋`Read`(目視) で特定し `cp`→`cmp` でバイト一致を確認して採用するのが正解。再現物は削除して二重管理を残さない |


---

## 6. プロジェクト間の依存

| 依存先 | 内容 |
|--------|------|
| dots.bz | Supabase認証パターンの共通化検討中 |
| include.bz | branding.bzのサービス説明ページからリンク |

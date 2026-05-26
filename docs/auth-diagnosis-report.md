# 認証システム 現状診断レポート

**作成日:** 2026-05-26
**作成者:** Claude Code（コード修正なし、診断のみ）
**対象リポジトリ:** branding-bz（HEAD: e4b2701 時点）

---

## 1. パッケージ構成

| パッケージ | バージョン | 備考 |
|------------|------------|------|
| `@supabase/supabase-js` | `^2.97.0` | クライアント onlyの古典的構成 |
| `@supabase/ssr` | **未導入** | SSR対応の現代パッケージが入っていない |
| `@supabase/auth-helpers-nextjs` | **未導入** | 旧推奨パッケージも未導入（クリーン） |
| `next` | `16.1.6` | App Router |
| `react` | `19.2.3` | React 19系 |

**所感：** クライアント側 supabase-js だけで認証を運用しており、Next.js 公式推奨の `@supabase/ssr`（cookie ベースの SSR/Middleware 統合）を一切使っていない。**これが根本的な構造課題**。Server Component / Middleware からセッションが見えないため、認証チェックは全てクライアント側 Provider で行うしかなく、Provider が多数派生・状態管理が分散する原因になっている。

---

## 2. Supabaseクライアント実装

### 2.1 `lib/supabase.ts`（クライアント用、唯一の `createClient`）

- import: `@supabase/supabase-js` の `createClient`
- 配信先: ブラウザ（`use client` ではないがクライアント実行のみ前提）
- `auth` オプション:
  ```ts
  lock: 自前の in-memory Promise キュー（後述）
  autoRefreshToken: true
  persistSession: true
  detectSessionInUrl: true
  storageKey: 'branding-bz-auth'   // localStorage キー
  flowType: 'implicit'             // ← 古い形式（推奨は 'pkce'）
  ```
- ストレージ: **localStorage**（明示的に cookie は使っていない）
- `lock` 実装:
  ```ts
  let __authLock: Promise<unknown> = Promise.resolve()
  lock: async (_name, _timeout, fn) => {
    const previous = __authLock
    let release = () => {}
    __authLock = new Promise(resolve => { release = resolve })
    try {
      await previous.catch(() => {})
      return await fn()
    } finally { release() }
  }
  ```
  Navigator LockManager を回避するための「直前の lock を全て待つ」自己連鎖キュー。**fn が hang すると以降の auth 操作が全て詰まる構造**。

### 2.2 `lib/supabase-admin.ts`（Service Role 用、API Route 専用）

- import: `@supabase/supabase-js` の `createClient`
- 遅延初期化（`getSupabaseAdmin()` 関数）
- `auth` オプション: `autoRefreshToken: false, persistSession: false`
- ストレージ: なし（サーバー専用）

### 2.3 `lib/supabase-fetch.ts`

クライアントではない。Supabase クエリのタイムアウト＋リトライ ユーティリティ。TIMEOUT_MS=6000、MAX_RETRIES=1。`Promise.race` の `setTimeout` を `clearTimeout` で適切にクリーンアップ済み。

---

## 3. middleware.ts

**ファイル不在**。`branding-bz/` 配下に `middleware.ts` は存在しない。

つまり：
- リクエスト時のセッション cookie 検証なし
- 自動リフレッシュトリガなし
- 認証チェックは100%クライアント側 Provider に依存
- Server Component から認証情報を取得する手段なし

---

## 4. AuthProvider群

**全部で 6 種類** が併存。実装方針もバラバラ。

### 4.1 `app/admin/components/AuthProvider.tsx`（admin 配下）

| 項目 | 内容 |
|------|------|
| 適用範囲 | `app/admin/layout.tsx` で `<AuthProvider>{children}</AuthProvider>` |
| セッション取得 | `getSession()` を `useEffect` 内で直接 await |
| `onAuthStateChange` | 購読あり。`INITIAL_SESSION` は無視、`SIGNED_IN/OUT/TOKEN_REFRESHED` を処理 |
| `INITIAL_SESSION` ハンドリング | **スキップ**（getSession 側で処理済み） |
| 追加機能 | `visibilitychange` でタブ復帰時にセッション再検証 |
| 再マウント対策 | モジュールスコープ `__authInitialized` フラグで loading 初期値制御 |
| ログアウト | 状態クリア → `router.replace('/admin/login')` → `signOut({scope:'local'})` を裏で実行 |
| cleanup | `cancelled`フラグ、`clearTimeout`、`subscription.unsubscribe()`、`removeEventListener` |
| 後続データ取得 | `admin_users` + `members(+profile)` を Promise.all で並列、`companies` は非同期（await しない） |

### 4.2 `app/portal/components/PortalAuthProvider.tsx`（portal 配下）

| 項目 | 内容 |
|------|------|
| 適用範囲 | `app/portal/PortalLayoutClient.tsx` で wrap、`app/portal/layout.tsx` から呼ばれる |
| セッション取得 | `getSession()` を直接 await |
| `onAuthStateChange` | 購読あり。`INITIAL_SESSION` 無視 |
| 追加機能 | `visibilitychange` 対応 |
| 再マウント対策 | `__portalAuthInitialized` フラグ |
| ログアウト | `await supabase.auth.signOut()`（scope 指定なし＝global revoke） |
| cleanup | あり |
| 後続データ取得 | `members(+profiles)` → `companies` → `brand_guidelines` → `admin_users` を**順次 await**（4本シーケンシャル） |

### 4.3 `app/superadmin/components/SuperAdminProvider.tsx`

| 項目 | 内容 |
|------|------|
| 適用範囲 | `app/superadmin/layout.tsx` |
| セッション取得 | `getSession()` を `.then()` |
| `onAuthStateChange` | 購読あり。**event を一切区別せず**全イベントで `checkSuperAdmin` を再実行 |
| `INITIAL_SESSION` ハンドリング | **明示的処理なし** |
| 追加機能 | なし |
| 再マウント対策 | なし。`useEffect` 依存配列が `[pathname, router]` → **ページ遷移ごとに useEffect が走り直す** |
| ログアウト | `await supabase.auth.signOut()` → `router.push` |
| cleanup | `subscription.unsubscribe()` のみ |

### 4.4 `app/tools/colors/components/ToolsAuthProvider.tsx`

| 項目 | 内容 |
|------|------|
| 適用範囲 | 不明（後述「使用箇所」参照） |
| セッション取得 | **`getSession()` 不使用**、`onAuthStateChange` の `INITIAL_SESSION` 待ちのみ |
| `INITIAL_SESSION` ハンドリング | `INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED` を同じブランチで処理 |
| 10秒タイムアウトで強制リダイレクト | あり |
| 後続データ取得 | `mini_app_sessions` 取得（1本） |
| 再マウント対策 | `loadedRef` のみ（マウント直後は必ず loading=true） |
| visibilitychange | なし |

### 4.5 `app/tools/stp/components/STPAuthProvider.tsx`

ToolsAuthProvider のコピー＋一部改変。`mini_app_sessions` 取得なし、`router.replace('/tools/stp')` に飛ばす。**他は ToolsAuthProvider と同型**。

### 4.6 `components/providers/UnifiedAuthProvider.tsx`

| 項目 | 内容 |
|------|------|
| 適用範囲 | `app/tools/colors/app/[sessionId]/layout.tsx`、`app/tools/stp/app/[sessionId]/layout.tsx`、`app/tools/persona/app/[sessionId]/layout.tsx` の3箇所 |
| セッション取得 | `onAuthStateChange` のみ（getSession 不使用） |
| `INITIAL_SESSION` ハンドリング | `INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED` を同じブランチで処理 |
| 10秒タイムアウト | あり |
| 後続データ取得 | なし（純粋な認証チェック） |
| 再マウント対策 | `loadedRef` のみ |
| visibilitychange | なし |

**重要：** `ToolsAuthProvider` と `STPAuthProvider` が現在どこから使われているか不明。実際のセッションページレイアウトは `UnifiedAuthProvider` を使用しており、ToolsAuthProvider / STPAuthProvider は dead code（または別ルート）の可能性が高い。

---

## 5. ログイン処理

### 5.1 `signInWithPassword` 呼び出し箇所

| ファイル | 行 | 用途 |
|----------|----|----|
| `app/admin/login/page.tsx` | L58 | 管理者ログイン |
| `app/portal/auth/page.tsx` | L80 | ポータル/メンバー ログイン |
| `app/portal/register/page.tsx` | L103 | セルフ登録後に自動ログイン |
| `app/portal/profile/page.tsx` | L258 | プロフィールでパスワード変更時に再認証 |
| `app/signup/page.tsx` | L157 | 新規企業作成後に自動ログイン |

### 5.2 `signInWithOAuth` 呼び出し箇所

| ファイル | 行 | プロバイダ |
|----------|----|----|
| `app/admin/login/page.tsx` | L110 | Google → `/admin/login/callback` |
| `app/portal/auth/page.tsx` | L105 | Google → `/portal/auth/callback` |

### 5.3 admin/login の処理フロー詳細

```
signInWithPassword
  → admin_users から is_superadmin を取得（直接 supabase クエリ）
  → superadmin なら setIsSuperAdmin(true) + setLoggedIn(true)
  → 通常管理者なら router.replace('/admin/members')
  → finally setLoading(false)
```

問題点：
- `router.replace('/admin/members')` 後、admin/layout の AuthProvider が初期マウントされる
- AuthProvider は `getSession()` から始まり、`fetchAdminUser` で **同じ admin_users を再度取得**（重複クエリ）
- さらに `members(+profiles)` も並列取得 → このタイミングで Supabase に少なくとも 3〜4 リクエストが集中
- ログイン直後は `__authInitialized = false` の状態でマウントされるので **loading=true から開始** → ここで「読み込み中」が表示される

### 5.4 OAuth コールバックの処理

`app/admin/login/callback/page.tsx`、`app/portal/auth/callback/page.tsx` ともに：
- `onAuthStateChange('SIGNED_IN')` を購読
- 並行して `getSession()` も実行
- 10秒タイムアウトで失敗 → エラー画面

`flowType: 'implicit'` のため hash fragment 経由でトークンを受け取り、`onAuthStateChange` が発火する想定。

---

## 6. レイアウトとProvider配置

```
app/layout.tsx (RootLayout)
  ├─ Provider なし（純粋な HTML wrap）
  │
  ├─ app/(marketing)/layout.tsx
  │   └─ Header + Footer のみ（認証 Provider なし）
  │     ※ Header.tsx 内で独自に supabase.auth.getSession() + onAuthStateChange 購読
  │
  ├─ app/admin/layout.tsx
  │   └─ AuthProvider
  │
  ├─ app/portal/layout.tsx
  │   └─ PortalLayoutClient
  │       └─ PortalAuthProvider
  │
  ├─ app/superadmin/layout.tsx
  │   └─ SuperAdminProvider
  │
  ├─ app/tools/colors/layout.tsx ─ Provider なし
  │   └─ app/tools/colors/app/[sessionId]/layout.tsx
  │       └─ UnifiedAuthProvider
  │
  ├─ app/tools/stp/layout.tsx ─ Provider なし
  │   └─ app/tools/stp/app/[sessionId]/layout.tsx
  │       └─ UnifiedAuthProvider
  │
  └─ app/tools/persona/layout.tsx ─ Provider なし
      └─ app/tools/persona/app/[sessionId]/layout.tsx
          └─ UnifiedAuthProvider
```

**Provider のネストはなし**（各サブツリーに1個ずつ）。ただし以下に注意：

- **marketing ページの Header.tsx も独自に `onAuthStateChange` を購読している** → 同一タブの中で複数の subscriber が常時アクティブ
- portal と admin を同時に開いた場合（または admin → portal 遷移）、両 Provider が同時マウントされる時間帯がある

---

## 7. cookie / localStorage 使用状況

### 7.1 認証関連
- **localStorage**: `branding-bz-auth` キーで Supabase セッション JWT を保存（`storageKey` 設定）
- **cookie 認証**: なし（middleware も無し）

### 7.2 認証外の利用
- `lib/analytics/track.ts`: visitor_id (`localStorage`)
- `components/analytics/MicroFeedback.tsx`: 24時間以内の送信フラグ (`localStorage`)
- `app/portal/visuals/page.tsx`: ガイドラインレイアウト設定 (`document.cookie`)
- `components/ui/sidebar.tsx`: サイドバー開閉状態 (`document.cookie`)

---

## 8. Supabase Auth 設定（推測）

コードから読み取れる範囲：

| 項目 | 推測値 / 根拠 |
|------|---------|
| JWT expiry | Supabase デフォルト = **3600 秒（1時間）** |
| Refresh Token rotation | デフォルト挙動 |
| Site URL | `https://branding.bz`（CLAUDE.md の本番URL） |
| Redirect URLs | `/admin/login/callback`、`/portal/auth/callback`（OAuth コールバック先） |
| Session timeout | 自動リフレッシュ ON のためトークン期限内は維持 |
| Email confirm | `email_confirm: true`（signup/join-company で明示） |

ダッシュボード側設定は確認できないが、コードからは **default 設定のまま運用** している可能性が高い。

---

## 9. 既存パッチの適用状況

| パッチ | 状況 | 適用ファイル | 未適用ファイル |
|--------|------|--------------|----------------|
| `lock` の Navigator LockManager 無効化 | ✅ 適用済み（一箇所のみ、`lib/supabase.ts`） | `lib/supabase.ts`（自前 Promise キュー版に進化） | （全体共通なので未適用箇所なし） |
| `getSession()` で即時セッション復元 | △ **部分適用** | admin AuthProvider / portal PortalAuthProvider / superadmin SuperAdminProvider（getSession 利用） | tools 系 3 Provider（ToolsAuthProvider / STPAuthProvider / UnifiedAuthProvider）は **getSession 不使用**、`onAuthStateChange` のみで `INITIAL_SESSION` を待つ |
| `INITIAL_SESSION` 時の `expires_at` チェック | ❌ **未適用** | どのProviderにも `expires_at` チェックは存在しない |  |
| `TOKEN_REFRESHED` イベントハンドリング | ✅ 適用済み | 全 6 Provider |  |
| `visibilitychange` でタブ復帰時セッション再検証 | △ **部分適用** | admin AuthProvider / portal PortalAuthProvider | superadmin / tools 系 4 Provider すべて未適用 |
| 再マウント時の loading=false 維持（モジュールフラグ） | △ **部分適用** | admin / portal のみ | superadmin / tools 系 4 Provider 未適用 |
| `refreshSession()` への置き換え | ❌ **未適用** | どこにも存在しない |  |

**結論：パッチが Provider ごとに統一されていない**。

---

## 10. 症状の原因推定

### 症状A: ログイン後「ログイン中」のままフリーズ

**最有力推定:** `app/admin/login/page.tsx` L72-76 の **admin_users 取得クエリ**が、自前 `lock` キューに詰まる。

**根拠:**
1. ログイン直後、`signInWithPassword` 成功 → 内部で `SIGNED_IN` イベント発火 → トークン保存処理が走る（Supabase内部で `lock` を取得）
2. 同時に L72-76 の `supabase.from('admin_users').select(...)` が auth トークンを使うため、Supabase 内部でセッション有効性確認が走る場合があり、これも `lock` を取得しようとする
3. `lib/supabase.ts` の `lock` 実装は「直前の lock 取得を**全て待つ** Promise キュー」。`signInWithPassword` の内部処理が長引くと、後続の admin_users クエリの `lock` 取得が永久待ちに近い状態になる
4. `setLoading(false)` は `finally` ブロックなのでクエリが返れば実行されるが、クエリが返らないと「ログイン中...」ボタンのまま固まる

**補強根拠:**
- ユーザー報告で「再読み込みすると治る」→ ページリロードで `__authLock` が初期化 + `lock` キューがリセットされる
- ローカルでは比較的速いが本番では起きやすい → ネットワーク遅延で `lock` キューの詰まりが顕在化

**別シナリオ:** `app/admin/login/page.tsx` L95 で `router.replace('/admin/members')` した直後、admin/layout の AuthProvider が初期マウント。AuthProvider の `getSession()` → `fetchAdminUser` で再度 admin_users + members 並列取得 → ここでも `lock` 競合 → admin AuthProvider 内の `loading=true` 表示「読み込み中…」が長引く。

### 症状B: 放置後に画面遷移しようとすると読み込まれない

**最有力推定:** **JWT 期限切れ → 自動リフレッシュ起動中に Provider の getSession() が `lock` 待ちで hang する**。

**根拠:**
1. JWT は1時間で期限切れ。Supabase はバックグラウンドで自動リフレッシュを試みる
2. ブラウザがバックグラウンドタブだと `setTimeout` が抑制され、自動リフレッシュタイマーがスキップされることがある
3. ユーザーが画面遷移すると、admin AuthProvider が**再マウント**（ページ遷移先で別レイアウトに切り替わる場合）または各ページの Supabase クエリが走る
4. このとき期限切れトークンを検出 → `refreshToken` で再取得を試みる
5. 自前 `lock` キューに溜まっていた古い lock（最初のリフレッシュ試行）が hang したまま → 新しい getSession / クエリも待ち状態に
6. **`tools/colors`、`tools/stp`、`tools/persona` の SessionLayout は UnifiedAuthProvider を使うが、`onAuthStateChange` の `INITIAL_SESSION` 待ちのみ**で `getSession` を呼ばない → INITIAL_SESSION イベント発火が `lock` 待ちで遅延すると 10 秒タイムアウトまで何も表示されない

**特に脆弱なケース:**
- portal `PortalAuthProvider.fetchMember` 内: `members` → `companies` → `brand_guidelines` → `admin_users` の **4本連続 await**。各クエリが内部で `lock` を取りに行くため、競合時の累積遅延が大きい
- `SuperAdminProvider` の `useEffect` 依存配列が `[pathname, router]` → ページ遷移ごとに `subscription.unsubscribe()` → 新規 subscribe → この狭間で発火イベントを取り逃すリスク
- `Header.tsx`（marketing 共通）も `onAuthStateChange` を購読 → 全タブで常時 subscriber が複数存在

---

## 11. 抜本改修に向けた所感

優先度順：

### 🔴 最優先（根本対応）
1. **`@supabase/ssr` への移行**
   - cookie ベースのセッション管理に変更
   - `middleware.ts` で `updateSession()` 一本化
   - Server Component / Route Handler から `createServerClient` で同じセッションを参照可能に
   - クライアント Provider は「UIに必要なメタデータ（profile/companyName 等）の取得」だけに専念できる
   - **Provider が「セッション存在チェック」と「アプリ固有データ取得」を兼ねている現状の設計が破綻している**

2. **Provider の統合 / 削減**
   - 現状 6 種類（admin / portal / superadmin / unified / tools / stp）。役割重複あり
   - 「セッション情報 Provider」（共通） + 「アプリ固有データ Provider」（admin / portal 専用）の2層に再設計
   - `ToolsAuthProvider` / `STPAuthProvider` は dead code 化している疑い → 削除確認

3. **自前 `lock` 実装の廃止**
   - 自前 Promise キューは「fn が hang すると全停止」の単一障害点
   - `@supabase/ssr` 移行で cookie ベースになれば、そもそも `lock` を上書きする必要がなくなる（cookie 経由なら LockManager 不要）

### 🟡 中優先（部分対応）
4. **`flowType` を `'pkce'` に変更**
   - 現在 `'implicit'` は古い。PKCE が現代の標準
   - hash fragment ではなく `code` パラメータ + サーバー側交換になり、セキュリティ・SSR との相性が向上
   - ※ 既存セッションは無効化されるので移行タイミング注意

5. **`signInWithPassword` 直後の admin_users 二重取得をやめる**
   - `app/admin/login/page.tsx` で取得 → 即遷移 → AuthProvider が再度取得 という二重実行
   - ログインページでは取得せず、`router.replace` 後の AuthProvider に任せる（または逆に AuthProvider 側を skip させる仕組みを入れる）

6. **`PortalAuthProvider.fetchMember` の並列化**
   - `members` → `companies` → `brand_guidelines` → `admin_users` のシーケンシャル await を Promise.all に
   - admin AuthProvider と同じパターン

### 🟢 低優先（クリーンアップ）
7. **Provider 全種にモジュールフラグ＋visibilitychange パッチを統一適用**
   - 現状 admin / portal のみ。superadmin と tools 系は同じ問題を抱えている
   - ただし「全部 `@supabase/ssr` に置き換える」方が筋がいいので、それまでの暫定パッチ

8. **`Header.tsx`（marketing）の `onAuthStateChange` 購読の見直し**
   - 「マイページ」表示のためだけに、全 marketing ページで auth 購読は重い
   - cookie ベースなら SSR でログイン状態を出し分けできる

9. **`SuperAdminProvider` の `useEffect` 依存配列修正**
   - `[pathname, router]` 依存は不要。`[]` で初回のみ実行に。

10. **`docs/auth-architecture.md` の整備**
    - 認証フロー、Provider の責務、cookie/storage 構造を1ページで俯瞰できるドキュメント
    - 改修後の設計図として最初に作るべき

---

## 補足：本調査で発見した周辺問題（任意対応）

- `app/portal/auth/page.tsx` の `redirectAfterAuth` 関数が `userId` 引数を受け取るが**未使用**（lint 警告）
- `STPAuthProvider` のロジック分岐に「SIGNED_IN かつ loadedRef.current のとき setLoading(false) して return」があるが、その前の `setUser(authSession.user)` が無条件で実行されるため、`SIGNED_IN` で同一ユーザーが来た場合に re-render を発生させる
- `app/admin/login/callback/page.tsx` と `app/portal/auth/callback/page.tsx` で `onAuthStateChange` を独自購読し、しかも getSession も並行実行している → callback 中に2系統からリダイレクトが走る競合可能性

---

**以上。コードは一切修正していない。** 本レポートを元に改修方針を決めてください。

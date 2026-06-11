# デザインシステム管理機能 移植指示書（include-bz → branding-bz）

> 作成: 2026-06-11 ／ 作成元: include-bz（ID側）セッション
> 目的: include-bz の管理画面 `/node/design-system` で稼働中の「デザインシステム機能」と同等のものを branding-bz の管理画面 `/admin` 配下に実装する。
> 参照元コードはすべて `~/dev/include-bz` にある。**実装前に必ず参照元ファイルを読むこと。**

---

## 1. 機能概要（include-bz で何が動いているか）

管理画面からデザイントークン（CSS変数）を編集すると、公開サイト全ページに約60秒以内に反映される仕組み＋デザイン仕様のビューア。

```
Supabase design_tokens テーブル
  ↓ 編集（管理画面エディタ）
design_token_history に履歴自動記録
  ↓ 保存時に POST /api/revalidate（tag: design-tokens）
Next.js unstable_cache のタグ無効化
  ↓
getDesignTokensCss() が :root { --color-*: ...; } を再生成
  ↓
app/layout.tsx の <head> に <style id="design-tokens"> として注入
  ↓
全ページの CSS変数が更新される
```

管理画面はタブ構成：

| タブ | 内容 | 編集可否 |
|------|------|---------|
| カラーパレット | design_tokens の閲覧・編集・保存・リセット・変更履歴ロールバック | **編集可** |
| タイポグラフィ | フォント・サイズ・行間の一覧表 | 閲覧のみ |
| スペーシング | 余白スケール・コンテナ幅一覧（クリックでコピー） | 閲覧のみ |
| コンポーネント | 実コンポーネントのライブプレビュー＋使用色の自動抽出＋クラス名コピー | 閲覧のみ |
| レイアウト | 標準レイアウトパターン・グリッド構成 | 閲覧のみ |
| レスポンシブ | ブレークポイントと変化点の一覧 | 閲覧のみ |

## 2. 参照元ファイル（include-bz、絶対パス）

| ファイル | 行数 | 役割 |
|---------|------|------|
| `~/dev/include-bz/app/node/(dashboard)/design-system/page.tsx` | 1,088 | メインページ。タブUI＋各タブの表示データ定義 |
| `~/dev/include-bz/app/node/(dashboard)/design-system/DesignTokenEditor.tsx` | 464 | カラーパレットタブ。編集・保存・履歴・ロールバック |
| `~/dev/include-bz/components/admin/design-system/ComponentPreview.tsx` | 218 | プレビュー汎用ラッパー。実DOMからの使用色抽出＋トークン逆引き |
| `~/dev/include-bz/app/node/(dashboard)/design-system/ds-preview.css` | 856 | プレビュー枠専用CSS（include-bz固有、後述の通り移植不要） |
| `~/dev/include-bz/lib/design-tokens.ts` | 37 | `getDesignTokensCss()`。unstable_cache 60秒＋タグキャッシュ |
| `~/dev/include-bz/app/api/design-tokens/route.ts` | 41 | GET でトークンを CSS 形式で返す |
| `~/dev/include-bz/app/api/revalidate/route.ts` | 51 | POST でキャッシュタグ無効化（要管理者認証） |
| `~/dev/include-bz/docs/DESIGN-SYSTEM.md` | 1,623 | 仕様書。構成の参考に（内容は include.bz サイト固有） |

## 3. DBスキーマ（このまま branding-bz の Supabase に migration 作成）

```sql
CREATE TABLE design_tokens (
  id              TEXT PRIMARY KEY,
  category        TEXT NOT NULL,        -- 'text' | 'bg' | 'border' | 'accent' | 'shadow'
  token_name      TEXT NOT NULL UNIQUE, -- CSS変数名（例: --color-bg-base）
  value           TEXT NOT NULL,        -- 現在値
  default_value   TEXT NOT NULL,        -- 初期値（リセット用）
  label           TEXT,                 -- 日本語ラベル
  description     TEXT,                 -- 用途説明
  sort_order      INT DEFAULT 0,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID
);
CREATE INDEX idx_design_tokens_category ON design_tokens(category, sort_order);

CREATE TABLE design_token_history (
  id              TEXT PRIMARY KEY,
  token_id        TEXT REFERENCES design_tokens(id),
  token_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_design_token_history_token_id ON design_token_history(token_id);
CREATE INDEX idx_design_token_history_changed_at ON design_token_history(changed_at DESC);
```

- 履歴は **UPDATE トリガーで自動記録**（include-bz 側の migration を参照して同じトリガーを作る）。
- RLS: authenticated（管理者）のみ書き込み可。読み取りは layout.tsx が SSR で行うため anon SELECT を許可するか、server client で読むかは branding-bz の既存方針に合わせる。
- migration は `supabase/migrations/20260611_create_design_tokens.sql` 形式で既存運用に従う。

## 4. branding-bz への適応ポイント（そのままコピーしてはいけない箇所）

include-bz と branding-bz は構成が違う。以下を読み替えること。

| 項目 | include-bz | branding-bz での対応 |
|------|-----------|---------------------|
| 管理画面パス | `/node/(dashboard)/design-system` | `/admin/design-system`（`app/admin/` 配下、既存の AdminHeader / AppSidebar 構成に組み込む） |
| 認証 | `checkAdminAuth()`（lib/admin-middleware） | `lib/learning/auth.ts` の `getAdminContext()` ＋ admin_users テーブル判定に置き換え |
| Supabase client | `createSupabaseBrowserClient()`（@/lib/supabase-client） | `lib/supabase/client.ts` の `createBrowserClient()` ／ server側は `lib/supabase/server.ts` |
| Tailwind | v4（@layer 構成） | **v3.4**。@layer の挙動と config 形式が違うため、エディタUI部分のクラスはほぼ流用可だが globals.css への手出しは v3 流儀で |
| CSS変数の名前空間 | `--color-*` | branding-bz は既に shadcn の HSL 変数（`--background` 等）と `--lp-*` を使用中。**衝突しない名前空間（`--ds-*` か `--color-*`）を新設**し、shadcn 変数は触らない |
| layout.tsx 注入 | `<style id="design-tokens">` を head に出力 | `app/layout.tsx` は現状 Metadata API のみ。同様に `getDesignTokensCss()` を await して `<style>` を直書き追加する |
| ds-preview.css | WordPress 由来 CSS の @layer wp 再宣言（856行） | **移植不要**。branding-bz は WP 由来 CSS がないので、プレビュー枠は素の Tailwind コンポーネントをそのまま描画すればよい。ComponentPreview.tsx の色抽出ロジックだけ流用 |
| タブの中身（タイポ・スペーシング・レイアウト・レスポンシブ） | include.bz サイトの実値をハードコード | **branding-bz の実値で作り直す**。CLAUDE.md / memory のデザインシステム記述（トークン表・スニペット）が一次ソース。include-bz の page.tsx はデータ構造（TYPE_SAMPLES / SPACING_SCALE / LAYOUT_PATTERNS 配列）の形だけ真似る |
| コンポーネントカタログ | include.bz の実コンポーネント17個 | branding-bz の `components/ui/`（shadcn 27個）＋ `components/shared/`（IndustrySelect, StepProgressBar, TitleDescriptionList）＋ brand/learning 系から、カタログに載せる価値のあるものを選定 |
| キャッシュタグ | `DESIGN_TOKENS_CACHE_TAG = 'design-tokens'` | 同名でよいが定数として新規定義。`unstable_cache` / `revalidateTag` の API シグネチャは branding-bz の Next.js バージョンで確認 |

## 5. 初期トークン（シードデータ）の決め方

include-bz のトークン値をコピーしない。branding-bz の現行デザインから抽出する：

1. `app/globals.css` の `:root`（shadcn HSL 変数、`--lp-orange` / `--lp-pink` / `--lp-gray` 等）と `tailwind.config.ts` のカスタムカラー（teal, lp-*）を棚卸し
2. **管理対象にするのは「公開ページ（LP・マーケティング画面）の色」から始める**のが安全。アプリUI（shadcn 変数）まで DB 管理に乗せると影響範囲が大きいので第1段階では対象外
3. カテゴリ（text / bg / border / accent / shadow）に分類して seed SQL を作成
4. ハードコードされている色を `var(--ds-*)` 参照に置換するのは段階的に（include-bz でも後追いで実施した: コミット be57044, 933a539 参照）

## 6. 実装ステップ（推奨順）

1. **Migration**: design_tokens / design_token_history テーブル＋履歴トリガー＋RLS＋seed
2. **lib/design-tokens.ts**: `getDesignTokensCss()`（unstable_cache、タグ付き）
3. **layout.tsx**: `<head>` に `<style id="design-tokens">` 注入。トークン未取得時は空文字でフォールバック（globals.css の静的値が効く）
4. **API**: `app/api/revalidate/route.ts`（管理者認証必須）。`app/api/design-tokens/route.ts` は SSR 注入だけなら省略可
5. **管理画面**: `app/admin/design-system/page.tsx`＋`DesignTokenEditor.tsx`。include-bz の実装をベースに認証・client を読み替え
6. **ComponentPreview**: 色抽出・クラス名コピー機能を流用してカタログタブを構築
7. **閲覧系タブ**: branding-bz の実デザイン値でタイポ・スペーシング・レイアウト・レスポンシブを記述
8. **動作確認**: トークン編集 → 保存 → revalidate → 公開ページ反映、リセット、履歴ロールバック
9. **CLAUDE.md 追記**: デザイントークンの管理場所が DB に変わったことを明記

## 7. 要確認事項（実装前に北川さんへ確認）

- **適用範囲**: デザイントークンで制御するのは公開LP側のみか、管理画面・メンバー画面のUIも含めるか（この指示書は LP側のみを想定）
- **マルチテナント**: branding-bz は companies 単位のデータ構造を持つが、デザイントークンは**全体共通（テナント非依存）でよいか**。include-bz は単一サイトなのでこの論点がなかった
- **タブ構成**: 6タブすべて作るか、まずカラーパレット（編集機能）だけ先行させるか

## 8. include-bz で踏んだ既知の落とし穴

- **@layer と !important**: layer 外の !important は layer 内の !important に負けるケースがある。スタイル衝突時は詳細度ではなくセレクタ・要素構造の変更で回避（include-bz の知見）
- **トークンの増やしすぎ**: 単発使用・重複トークンは後で統合する羽目になる（include-bz #133）。最初から「2箇所以上で使う色だけトークン化」を徹底
- **プレビューの静止化**: アニメーション付きコンポーネントはプレビューで初期 transform をリセットして静止表示にする
- **shadcn/ui のバージョン差**: include-bz は v4 系（asChild → render の破壊的変更あり）。branding-bz の shadcn 構成（new-york style）に合わせてコピペ時に調整

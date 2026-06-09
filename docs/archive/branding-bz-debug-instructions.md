# branding.bz 技術的負債 修正指示書

> Claude Code に以下の指示をコピーして渡してください。
> 優先度の高い順に並んでいます。1つずつ渡しても、まとめて渡してもOKです。

---

## 指示1: React Hooks purity / set-state-in-effect エラーの修正（優先度：高）

以下の5つのESLintエラーを修正してください。修正後に `npx eslint app/ components/ hooks/ lib/` でエラーが0件になることを確認してください。

### 1-A: `components/GoogleFontPicker.tsx`（2箇所）

**問題:** useEffect内で同期的にsetStateを呼んでいる（カスケードレンダリング）

- 272行目: `useEffect(() => { setVisibleCount(BATCH_SIZE) ... }, [items])`
  → `items` が変わったときの `visibleCount` リセットは、useEffectではなく `useMemo` または `items` を依存にした初期化ロジックで対応する。scrollTopのリセットはrefコールバック or useEffectで`flushSync`なしに行う。

- 330-336行目: `useEffect(() => { if (!open) return; setSelected(value); setSearch(''); ... }, [open, value])`
  → `open` が `true` になったときの初期化。`key` propを使ったアンマウント/リマウントパターン、または state の初期値を `value` から導出する形にリファクタリング。

### 1-B: `hooks/useBrandFonts.ts`（1箇所）

**問題:** 20行目 `setFonts(cache.get(companyId)!)` がuseEffect内で同期呼び出し

→ `useState` の初期化関数（12行目）ですでにキャッシュを読んでいるので、useEffect内のキャッシュヒット分岐（19-21行目）は削除可能。`companyId` が変わった場合の再初期化は、`key={companyId}` パターンを親で使うか、`useSyncExternalStore` で対応。

### 1-C: `components/analytics/BrandPageTracker.tsx`（1箇所）

**問題:** 20行目でレンダー中に `Date.now()` を呼んでいる（不純関数）

→ `useRef<number>(0)` で初期化し、useEffect内で `startTimeRef.current = Date.now()` を設定する（32行目で既にやっているので、20行目の初期値を `0` にするだけでOK）。

### 1-D: `components/ui/sidebar.tsx`（1箇所）

**問題:** 665行目 `useMemo` 内で `Math.random()` を呼んでいる（不純関数）

→ `useId()` をシードにした決定的な幅計算に置き換えるか、`useRef` + `useEffect` で初回のみランダム値を生成する形にする。

---

## 指示2: 未使用 import / 変数の一括クリーンアップ（優先度：中）

以下のファイルから未使用の import と変数を削除してください:

```
app/tools/colors/app/[sessionId]/components/Step1BasicInfo.tsx  → prefilled (46行目)
app/tools/colors/app/[sessionId]/components/Step2ImageInput.tsx → onSaveField (27行目)
app/tools/colors/page.tsx                                       → Button, ArrowRight
app/tools/persona/app/[sessionId]/page.tsx                      → saveField (109行目)
app/tools/persona/page.tsx                                      → Brain, ArrowRight
app/tools/stp/app/[sessionId]/components/Step4Positioning.tsx   → Card, CardContent
app/tools/stp/page.tsx                                          → ArrowRight
hooks/useBrandFonts.ts                                          → DEFAULT_FONT_ID
lib/ci-manual/sections/toc.tsx                                  → MARGIN
lib/ci-manual/sections/visuals.tsx                               → brandColor (23行目)
components/BrandFontLoader.tsx                                   → 不要な eslint-disable ディレクティブ削除
```

修正後に `npx eslint app/ components/ hooks/ lib/ --quiet` で warning が減っていることを確認してください。

---

## 指示3: `<img>` タグを `next/image` の `<Image>` に置き換え（優先度：低）

以下のファイルで `<img>` タグを `next/image` の `<Image />` コンポーネントに置き換えてください。各画像に適切な `width`、`height`、`alt` を設定してください。動的URLの場合は `unoptimized` propを検討してください。

対象ファイル:
```
components/Header.tsx (2箇所)
app/superadmin/companies/page.tsx (1箇所)
app/portal/visuals/page.tsx (複数箇所)
app/portal/timeline/page.tsx (複数箇所)
app/admin/brand/visuals/page.tsx (複数箇所)
```

`next.config.ts` の `images.remotePatterns` に必要なドメインが登録されていることも確認してください。

---

## 指示4: `components/ui/chart.tsx` の any 型を修正（優先度：低）

110行目の `any` 型を適切な型（`Record<string, string>` や recharts の型）に置き換えてください。

---

## 指示5: CI Manual の画像に alt 属性を追加（アクセシビリティ）

以下のファイルで `<Image>` 要素に `alt` propを追加してください:
```
lib/ci-manual/sections/cover.tsx  (68行目, 89行目)
lib/ci-manual/sections/visuals.tsx (112行目, 137行目)
```

※ これは `@react-pdf/renderer` の `<Image>` なので、react-pdf が alt をサポートしているか確認し、サポートしていない場合はESLint側で当該ファイルを除外設定してください。

---

## 指示6: ESLint設定の改善

`eslint.config.mjs` で `.next` ディレクトリがignoreされているか確認してください。現在 `.next 2/` というフォルダが存在し、ESLintがビルド成果物を検査してしまっています。

- `.next*` をignoreパターンに追加
- 不要な `.next 2/` ディレクトリがあれば削除

---

## 検証手順

すべての修正完了後、以下を実行して問題がないことを確認:

```bash
# 型チェック
npx tsc --noEmit

# ESLint (エラー0件を目標)
npx eslint app/ components/ hooks/ lib/ --quiet

# ビルド
npm run build
```

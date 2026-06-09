# branding.bz ESLint エラー修正指示

branding-bz プロジェクトのESLintエラーをすべて解消してください。

## 現状

`npx eslint app/ components/ hooks/ lib/` を実行すると **11件のエラー** と **103件の警告** があります。
今回のゴールは **エラー0件** にすることです。警告の修正は任意です。

## 修正対象

### 1. `components/GoogleFontPicker.tsx` — useEffect内の同期setState（2箇所）

**272-275行目:**
```tsx
useEffect(() => {
  setVisibleCount(BATCH_SIZE)
  if (scrollRef.current) scrollRef.current.scrollTop = 0
}, [items])
```
→ `setVisibleCount` をuseEffect外に移す。`items` が変わったときに `visibleCount` をリセットするには、前回の `items` をrefで保持して比較し、変わっていたら初期値を返す形にするか、`items` のlengthをkeyにしたロジックに変更する。scrollTopのリセットはuseEffect内に残してOK。

**330-336行目:**
```tsx
useEffect(() => {
  if (!open) return
  setSelected(value)
  setSearch('')
  setTab('google')
  setManualInput(value || '')
}, [open, value])
```
→ `open` が前回 `false` → 今回 `true` に変わったタイミングだけ初期化したい。useRefで前回のopenを保持し、開いた瞬間にだけsetStateする形にリファクタ。または状態の初期化はuseEffect外の条件分岐で行う。

### 2. `hooks/useBrandFonts.ts` — useEffect内の同期setState（1箇所）

**19-21行目:**
```tsx
if (cache.has(companyId)) {
  setFonts(cache.get(companyId)!)
  return
}
```
→ 12-15行目の `useState` 初期化関数で既にキャッシュを読んでいるが、`companyId` が変わった場合に対応できていない。修正方法: `companyId` をkeyとして前回値を保持するrefを使い、変更時は初期化関数のロジックと同等の処理をuseEffect外で行う。または、このsetFonts呼び出しの前に早期リターン条件（現在のfontsと同じなら何もしない）を入れる。

### 3. `components/analytics/BrandPageTracker.tsx` — レンダー中の不純関数呼び出し（1箇所）

**20行目:**
```tsx
const startTimeRef = useRef<number>(Date.now())
```
→ `useRef<number>(0)` に変更。32行目のuseEffect内で既に `startTimeRef.current = Date.now()` をセットしているので、初期値は `0` で問題ない。

### 4. `components/ui/sidebar.tsx` — レンダー中の不純関数呼び出し（1箇所）

**663-666行目:**
```tsx
const width = React.useMemo(() => {
  return `${Math.floor(Math.random() * 40) + 50}%`
}, [])
```
→ `React.useId()` のハッシュ値から決定的にwidthを算出するか、`React.useRef` で初回だけ生成する形に変更。シンプルな解法: `useState` の初期化関数内で `Math.random()` を呼ぶ（初期化関数は1度しか実行されないため許容される）。

### 5. `components/ui/chart.tsx` — any型（1箇所）

**110行目の `any` 型を適切な型に置き換える。** rechartsの `Payload` 型や `Record<string, string>` など。

### 6. ESLint設定の修正

`eslint.config.mjs` の `globalIgnores` に `.next*` パターンを追加して、`.next 2/` ディレクトリもignoreされるようにしてください：

```js
globalIgnores([
  ".next*/**",   // ← .next と .next 2 の両方をカバー
  "out/**",
  "build/**",
  "next-env.d.ts",
]),
```

## 検証

すべての修正後、以下の2つを実行して確認：

```bash
npx tsc --noEmit          # 型エラー0件
npx eslint app/ components/ hooks/ lib/ --quiet   # エラー0件
```

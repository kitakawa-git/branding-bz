# archive/

現行のコードから参照されていない、または役割を終えたファイルの退避場所。
削除ではなく `git mv` で移動する運用（履歴と再検索性を保つ）。

## 現在の中身（2026-07-14 時点）

### `archive/components/`
- `Header.tsx` — 旧マーケヘッダー。現行は `app/(site)/` 内のヘッダーを使用、無参照
- `seo/SoftwareApplicationSchema.tsx` — SEO 用 structured data コンポーネント。追加されたが実際にどのページからも import されず

### `archive/scripts/`
- `verify-rls-branch.ts` — RLS Step 1 (2026-04-30) の Supabase branch 検証スクリプト。branch 削除済み・無参照
- `rollback-rls-step1.sql` — RLS Step 1 の緊急ロールバック SQL。Step 1 完了後は不要、後続 migration で一部ポリシー置換済み
- `verify-copy-stage2.ts` — コピー検証スクリプトの Stage2 版。Stage3/Stage4a に置き換わり済み

### `archive/sql/`
- `001_admin_users.sql` 〜 `009_stp_session_data.sql` — Supabase migrations 化以前の旧 SQL 群
- 現在は `supabase/migrations/` に完全移行済み

## 復活させたい場合

`git mv archive/<path> <original-path>` で戻す。

---
name: healthcheck
description: プロジェクトの動作確認を一括実行し、結果を報告する
---

# ヘルスチェック

プロジェクトの動作確認を実施してください。以下を順番に実行し、結果を報告してください。

## チェック項目

1. **環境変数**: `.env.local` が存在し、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認（値は表示しない）
2. **Git履歴**: `git log --oneline -5` で直近のコミットが残っているか確認
3. **依存パッケージ**: `npm install` を実行し、エラーなく完了するか確認
4. **TypeScript型チェック**: `npx tsc --noEmit` を実行し、型エラーがないか確認
5. **ビルド**: `npx next build` を実行し、ビルドが成功するか確認
6. **CLAUDE.md**: CLAUDE.mdが存在し、読み込めるか確認
7. **Supabase接続**: Supabase MCPでテーブル一覧を取得できるか確認

## 報告フォーマット

| # | チェック項目 | 結果 | 備考 |
|---|-------------|------|------|
| 1 | 環境変数 | ✅ or ❌ | |
| 2 | Git履歴 | ✅ or ❌ | |
| 3 | npm install | ✅ or ❌ | |
| 4 | 型チェック | ✅ or ❌ | エラー数 |
| 5 | ビルド | ✅ or ❌ | |
| 6 | CLAUDE.md | ✅ or ❌ | |
| 7 | Supabase接続 | ✅ or ❌ | |

❌がある場合は原因と修正方法を提案してください。

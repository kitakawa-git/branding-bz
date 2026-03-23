# branding.bz Code Review ルール

## 必ずチェックすべき項目
- Supabaseクエリで company_id フィルタが漏れていないか
- APIルートで認証チェック（supabase.auth.getUser()）が入っているか
- brand_survey_responses に profile_id が含まれていないか（匿名性の設計要件）
- .env.local の値がハードコードされていないか
- RLSポリシーに関わるテーブル操作が安全か

## 指摘不要な項目
- 変数名やコメントの日英混在
- Tailwindクラスの並び順
- import文の順序
- console.log（開発中は許容）

## プロジェクト固有の注意点
- git pushは明示的な指示がない限り行わない
- companies テーブルが Single Source of Truth（ツールとの同期に注意）
- card_events / brand_page_views は匿名ユーザーからのINSERTが必要（RLS設計に注意）
- 日本語コミットメッセージを使用

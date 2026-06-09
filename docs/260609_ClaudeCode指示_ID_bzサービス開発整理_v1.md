# ① Claude Code 指示文 ── ID_bzサービス開発フォルダの整理

> これをClaude Codeにそのまま貼って実行させる。

## 前提・状況
- 対象フォルダ: `~/Documents/Claude/ID_bzサービス開発/`（iCloud上。多くが「オンラインのみ」で未ダウンロード）
- コード本体 `branding-bz` は既に `~/dev/branding-bz` へ移行済み（GitHub正本: https://github.com/kitakawa-git/branding-bz、clone・npm install・起動確認済み）
- このフォルダ直下に散らばる .md / xlsx / svg / txt を、ルールに沿って仕分けるのが目的

## 大前提のルール
- 完了済みの一回限り指示書 → `archive/` へ
- 残す知識 .md → `~/dev/branding-bz/docs/` へ移動しGitコミット（.mdはGitHub管理）
- 成果物（xlsx / svg / txt）→ Googleドライブの共有フォルダへ
- 認証情報 → GitHubにもpublic Driveにも置かない（隔離）
- 別プロジェクトの物 → 該当プロジェクトフォルダへ
- ゴミ → 削除（破壊的操作は実行前に確認）

## 手順

### 0. 事前準備（iCloud実体化）
操作前に各ファイルを実体化（`brctl download "<path>"` か Finder「今すぐダウンロード」）。バスエラー時はダウンロード後リトライ。

### 1. archive/ へ退避（完了済み指示書・約24本）
`ID_bzサービス開発/archive/` を作り以下を移動：
- `260607_brand_values_リネーム指示書_v1.md`
- `260608_Step0_証拠と禁則テーブル_実装指示書_v1.md`
- `260608_Step1a_Step3_読み取り切替_指示書_v1.md`
- `260608_Step1a_Step4_編集UI切替_指示書_v1.md`
- `260608_Step1a_Step6_マイグレ整合とDROP_指示書_v1.md`
- `260608_Step1a_理念要素ID化_実装指示書_v1.md`
- `260608_Step1b_デモ関係投入とE2E検証_指示書_v1.md`
- `260608_Step1b_関係グラフ_実装指示書_v1.md`
- `260608_Step1スキーマ設計_v1.md`
- `260608_Step2_整合性チェック_実装指示書_v1.md`
- `260608_WIP整理Phase2_指示書_v1.md`
- `260608_WIP整理_指示書_v1.md`
- `260608_admin_usersコミットpush_指示書_v1.md`
- `260608_admin_users緊急RLS是正_指示書_v1.md`
- `260608_ガードレール注入拡大_実装指示書_v1.md`
- `260608_コミット整理とpush_指示書_v1.md`
- `260608_低リスクRLS是正_指示書_v1.md`
- `260608_低リスク是正コミットpushとDROP完了_指示書_v1.md`
- `260608_負債調査_指示書_v1.md`
- `260608_順序5_Phase2実行_指示書_v1.md`
- `260608_順序5_slogan_mvvバグ修正_指示書_v1.md`
- `260608_順序6_values_キー統一_指示書_v1.md`
- `SEO対策_実装指示書.md`
- `UXテスト_修正指示書.md` / `_高優先度.md` / `_中優先度.md` / `_低優先度.md`
- `branding_bz_UXテスト完全レポート.xlsx`（旧版。`_v2`を残しこれはarchive）

### 2. 残す知識.md → ~/dev/branding-bz/docs/（GitHub管理）
移動 →`git add`→ コミット（日本語）。pushは確認後。
- `BRD-PROJECT-STATUS.md`
- `260608_複数名開発_運用ガイド_v1.md`
- `260608_証拠と禁則_定義ガイド_v1.md`
- `260608_ブランドオントロジー_ノード採用表_v1.md`
- `260608_順序5_slogan_mvv突合表_v1.md`
- `260608_負債調査報告_v1.md`
- `260608_WIP整理_仕分け表_v1.md`
- `CLAUDE.md`（直下の1.6K版。repoのCLAUDE.mdと比較し必要分のみ取込。重複なら不要）

### 3. 成果物 → Googleドライブ共有フォルダ
移動先Driveパスは**ユーザーに確認してから**移動：
- `branding-bz-plan-structure-final.xlsx`
- `branding-bz_SEO監査レポート.xlsx`
- `branding_bz_UXテストレポート.xlsx`
- `branding_bz_UXテスト完全レポート_v2.xlsx`
- `260608_ブランドオントロジー概念図_v1.svg`
- `260608_理念体系DB構造図_v1.svg`
- `branding-bz_サービス概要.txt`

### 4. 別プロジェクト（RTM）→ RTMフォルダ
移動先（例 `~/Documents/Claude/RTM_アプリ開発/`）を確認して移動：
- `260608_リィツメディカル_データ投入指示書_v1.md`
- `260608_リィツメディカル_証拠と禁則_草案_v1.md`

### 5. 認証情報 → 隔離
- `project-credentials.md` はGitHub・public Driveに置かない。repo内に置く場合は`.gitignore`で追跡対象外を確認。置き場所はユーザーに確認。

### 6. ゴミ削除（実行前に確認）
- `branding-bz_broken/` ／ `us.sitesucker.mac.sitesucker/` ／ `.DS_Store`

## 厳守
- `git push`・破壊的削除は実行前にユーザー確認。
- 各ステップ結果（移動件数・コミットハッシュ等）を報告。
- 迷うファイルは動かさず確認。

# ② 【お知らせ・作業指示】branding-bz のファイル場所と作業フォルダが変わりました

> 各セッション／メンバーに共有する通知＋作業指示。Coworkや各Claudeセッションの冒頭にも貼れます。

## 1. 何が変わったか
branding-bz を、散らかった iCloud フォルダから整理して移しました。**置き場所が種類ごとに分かれます。**

| 種類 | 新しい場所 | 旧（使わない） |
|------|-----------|----------------|
| コード | `~/dev/branding-bz`（ローカル）。正本は GitHub `github.com/kitakawa-git/branding-bz` | `~/Documents/Claude/ID_bzサービス開発/branding-bz`（凍結） |
| .md 知識（要件・用語・STATUS・タスク） | リポジトリ内（GitHub）。`CLAUDE.md` が `@import` で束ねる | 散在の指示書 → archive |
| 成果物（Excel・図・PDF等） | Google ドライブ共有フォルダ | 同上 |
| 認証情報（.env.local 等） | 各自の手元（Git・公開Driveに置かない） | — |

## 2. 今後の作業フォルダ
- Cowork / Claude Code の作業フォルダを `~/dev/branding-bz` に切り替える。
- 旧 iCloud フォルダ（`ID_bzサービス開発/branding-bz`）では新規作業しない（当面は保管庫）。

## 3. 各メンバーがやること（初回のみ）
```bash
git clone https://github.com/kitakawa-git/branding-bz.git ~/dev/branding-bz
cd ~/dev/branding-bz
# .env.local を安全な経路で受け取り配置（Git/公開Driveに載せない）
npm install
npm run dev   # http://localhost:3004 で確認
```
5. Cowork / Claude Code の作業フォルダを `~/dev/branding-bz` に設定。
6. 成果物を扱うなら Google ドライブ共有フォルダを「オフラインで使用可能」に設定。

## 4. これからのルール
- コードは push して共有（未pushは共有も本番反映もされない）。
- .md 知識はリポジトリ内に置き、`CLAUDE.md` から `@import` で束ねる。
- 成果物は Google ドライブ。コードは Drive に置かない（node_modules/.git の同期事故防止）。
- 認証情報は Git にも public Drive にも置かない。
- 命名：コードのパスは ASCII・スペースなし。Drive 資料は日本語可だが `/`・スペース・括弧は避ける。

## 5. 旧フォルダの扱い
`~/Documents/Claude/ID_bzサービス開発/` は当面「保管庫」として残す（未push分の保険）。数週間で不要と確認できたら削除。新規作業はここではしない。

# 順序5: companies.slogan / mvv 突合表・是正方針 v1（Phase 1・報告のみ）

- 対象: branding-bz（project `wfabdmfgngjtihhlrrpk`）
- 種別: **Phase 1＝調査＋データ突合の報告のみ。破壊操作（DROP/上書き）は未実施**（grep / SELECT のみ）。
- 前提: `260608_負債調査報告_v1.md` B章。
- 実害: superadmin企業詳細の slogan/mvv 編集が表示に反映されない（no-op）。二重管理。

---

## 1A. コード経路の確定（再grep）

### slogan
| 役割 | 参照元 | 箇所 |
|------|--------|------|
| **表示（ポータル/カード/PDF）** | **`brand_guidelines.slogan`** | PortalDataProvider:160/176→portal/page:744・PortalSidebar:151／portal/guidelines:100/223／card/[slug]:188/424／lib/ci-manual:214 |
| **正規の編集UI** | **`brand_guidelines.slogan`** | `app/admin/brand/guidelines/page.tsx`:651-652（slogan入力）→:510 保存。**同UIで mission/vision/values も編集**（mission_copy/body・vision_copy/body・values配列） |
| superadmin編集（**no-op**） | `companies.slogan` | superadmin/companies/[id]:80/162（編集→companies.slogan。表示はbg側のため反映されない） |
| superadmin一覧 表示 | `companies.slogan` | superadmin/companies:62/172（企業一覧にcompanies.sloganを表示） |
| **AI文脈（brand-score）読み取り** ⚠ | `companies.slogan` | tag-mappings/suggest:58/106／surveys/[id]/generate-questions:126/67／lib/brand-score/brand-data:68/128（**DROP前に要repoint**） |
| 初期化 | `companies.slogan=''` | signup:82／create-company:119 |

→ **結論**: slogan の表示・正規編集は `brand_guidelines.slogan`。superadmin の slogan欄は **正規UI(admin/brand/guidelines)と重複かつ no-op**。ただし **companies.slogan は brand-score AI が読んでいる**ため、DROP前に repoint 必須。

### mvv
| 役割 | 参照元 | 箇所 |
|------|--------|------|
| superadmin編集（**no-op**） | `companies.mvv` | superadmin/companies/[id]:81/163 |
| 初期化 | `companies.mvv=''` | signup:83／create-company:120 |
| **表示** | **なし** | （`lib/brand-mvv` 等の "mvv" はユーティリティ名で別物。カードのMVVは bg mission/vision/values を表示） |
| AI読み取り | **なし** | brand-score は mission/vision を読む。companies.mvv は不参照 |

→ **結論**: `companies.mvv` は **superadmin編集フォームが読むだけの完全な no-op 欄**。表示なし・AI不使用。bg側に単一の対応カラムは無い（mission/vision/values に分離済み）。

---

## 1B. slogan データ突合（全9社）

| 企業 | companies.slogan | brand_guidelines.slogan（表示中） | 判定 | 移行方針 |
|------|------------------|-----------------------------------|------|----------|
| CTD株式会社 | （空） | （null） | 両空 | 対応不要 |
| **ID INC.** | ブランドを、約束にする。 | **Start with ID.** | 不一致 | bg正・companies破棄（要バックアップ） |
| **MEGUTAMA** | **Logistics as a wheel of life.** | （null） | bg空 | **companies値を bg.slogan へ移植**（消失防止） |
| テスト株式会社 | （空） | （null） | 両空 | 対応不要 |
| **合同会社ナチュラルキッチン** | 自然の恵みを、食卓に。 | **自然の恵みを、毎日の食卓に。** | 不一致 | bg正・companies破棄（要バックアップ） |
| 株式会社アーバンクラフト | つくる人を、つくる。 | つくる人を、つくる。 | 一致 | companies破棄でOK |
| 株式会社あいうえお | （空） | （null） | 両空 | 対応不要 |
| 株式会社テックブリッジ | テクノロジーで、人と人をつなぐ。 | テクノロジーで、人と人をつなぐ。 | 一致 | companies破棄でOK |
| 株式会社リィツメディカル | （空） | Bright view, Bright life. | companies空 | bg正・対応不要 |

→ **移植が必要なのは MEGUTAMA 1社のみ**（companies「Logistics as a wheel of life.」→ bg.slogan）。
→ ID INC.・ナチュラルキッチンは companies側に別表現が残るが**表示中の bg を正とし破棄**（値はDROP migrationコメントにバックアップ）。

---

## 1C. mvv の内容と扱い（非NULL 4社）

| 企業 | companies.mvv | bg側（mission/vision/values） | 判定 |
|------|---------------|-------------------------------|------|
| 株式会社テックブリッジ | Mission: デジタルの力で…/ Vision: すべての企業が…/ Values: 誠実・挑戦・共創 | mission/vision がほぼ同文・values 3件 | **bg mission/vision/values の連結＝重複** |
| ID INC. | ミッション：中小企業のブランド価値を最大化する | mission「AI×ブランディングで人々が誇れる理想を…」vision/values あり | 旧版・表現違い（bgが richer・表示中） |
| 合同会社ナチュラルキッチン | 地産地消で地域の食文化を守り…未来の食卓を豊かにする | mission「地元の食材で家庭の温もりを届ける」vision「おばあちゃんの味を残したい」 | 旧版・表現違い |
| 株式会社アーバンクラフト | 若手クリエイターが自分らしく活躍できる場をつくる | mission「若手クリエイターの才能を社会に届ける」vision「つくる人を、つくる。」 | 旧版・表現違い |

→ **結論**: `companies.mvv` は **構造化前の旧MVV単一フィールド**。表示なし・AI不使用。bg.mission/vision/values が後継で表示中。テックブリッジは完全重複、他3社も旧表現で内容的に bg に包含。
→ **推奨**: 全社分を**バックアップ記録の上 DROP**。ただし旧表現が独自に価値あるなら退避先を指定（北川さん確認）。

---

## Phase 2 提案（承認後のみ実施）

### 2A. コード修正（**撤去案＝推奨**）
正規UI `admin/brand/guidelines` が bg.slogan + mission/vision/values を編集できるため、superadmin の slogan/mvv 欄は重複。
- `superadmin/companies/[id]/page.tsx`: **slogan/mvv 編集欄を撤去**（編集導線は admin/brand/guidelines へ一本化）
- `superadmin/companies/page.tsx`（一覧）: companies.slogan 表示列を撤去（または bg.slogan へ）
- brand-score 3箇所（tag-mappings/surveys/brand-data）: slogan の取得元を **companies → brand_guidelines** へ repoint（AI文脈が表示中の正しい slogan になる副次的改善）
- signup/create-company: `slogan:''` / `mvv:''` 初期化を削除
- （**代替案＝向き先修正**: superadmin で slogan 編集を続けたい場合は書込先を bg.slogan に変更。ただし mvv は bg に単一対応が無いため mvv 欄は撤去が前提）

→ **要承認**: 撤去案 / 向き先修正案 のどちらにするか。

### 2B. データ移行（非破壊）
- **MEGUTAMA のみ**: `brand_guidelines.slogan` が空なので companies.slogan「Logistics as a wheel of life.」を bg へ移植。
- 両方値がある社（ID INC.・ナチュラルキッチン）の **bg.slogan は上書きしない**（非破壊厳守）。
- mvv: 承認方針に従う（推奨はバックアップのみ＝移行先なし）。

### 2C. DROP（コード修正デプロイ＋本番非参照確認後のみ）
```sql
-- 事前に companies(id, slogan, mvv) の非NULL行をmigrationコメントに記録（下記バックアップ参照）
ALTER TABLE public.companies DROP COLUMN slogan;
ALTER TABLE public.companies DROP COLUMN mvv;
NOTIFY pgrst, 'reload schema';
```
**順序厳守（portal/valuesの教訓）**: 2Aコード修正を commit→push→デプロイ→本番が companies.slogan/mvv を参照しないことを確認→**その後にDROP**。

#### DROP前バックアップ（非NULL値）
- slogan: ID INC.「ブランドを、約束にする。」／MEGUTAMA「Logistics as a wheel of life.」(→bgへ移植)／ナチュラルキッチン「自然の恵みを、食卓に。」／アーバンクラフト「つくる人を、つくる。」／テックブリッジ「テクノロジーで、人と人をつなぐ。」
- mvv: 上記1C表の4社分。

---

## 承認いただきたい点（Phase 2 着手前）
1. **2A の方針**: 「撤去案（推奨）」か「向き先修正案」か。
2. **mvv の扱い**: 「バックアップの上DROP（推奨）」でよいか、旧MVV表現に独自価値があり退避が要るか。
3. slogan は **MEGUTAMA のみ移植**・他は bg正で破棄、で問題ないか（ID INC./ナチュラルキッチンの companies側別表現は破棄＝バックアップ記録のみ）。
4. Phase 2 実施（コード修正のcommit/push＝デプロイを伴う）の可否。

ここで停止し、承認を待ちます。

-- 企業のプラン管理カラムを追加し、既存企業を初期割り振りする。
-- 根拠: 260716_プラン制限実装_指示書_v1.md（v1.3 まで反映）
--
-- ⚠️ card は check 制約に含めない（販売終了・v1.1）。
--    コード側の Plan 型にだけ温存し、Early Access 終了時の受け皿復活に備える。
-- ⚠️ 実効プランの判定は plan_expires_at と併せて entitlements 側で行う（遅延評価）。
--    このテーブルの plan を直接参照する箇所を作らないこと。

-- ── 1. カラム追加 ──
alter table companies
  add column plan text not null default 'free'
    check (plan in ('free','standard','premium','enterprise')),
  add column plan_started_at timestamptz,
  add column plan_expires_at timestamptz,
  add column is_demo boolean not null default false;

comment on column companies.plan is
  '契約プラン。free/standard/premium/enterprise。card は販売終了のため制約に含めない。実効プランの判定は plan_expires_at と併せて entitlements 側で行う';
comment on column companies.plan_started_at is 'プラン開始日時';
comment on column companies.plan_expires_at is
  'プラン有効期限。NULL=無期限。現在時刻を過ぎている場合は free として扱う（遅延評価）';
comment on column companies.is_demo is
  'デモ・テスト用企業。実顧客カウント・対外的な数値集計から除外する';

-- ── 2. 既存企業の初期割り振り ──
-- 指示書は「premium は上記以外すべて」と書いているが、2026-08-13 に新規登録の
-- 株式会社C&S（approval_status='pending'）が増えており、この書き方だと
-- 承認待ちの新規登録が premium になってしまう。全プランを id で明示指定する。

-- free（3社・デモ）
update companies set plan = 'free', is_demo = true
 where id in (
   '74ea3c4d-20a3-4d0b-8e31-4c1803c07820',  -- cospark
   '788c47c8-02ce-4bad-a6c2-443b120f6bb7',  -- うま屋ラーメン
   '085878f0-8f78-4a76-b5c6-e76e015bf1f6'   -- atelier Kiitos
 );

-- standard（2社・デモ）
update companies set plan = 'standard', plan_started_at = now(), is_demo = true
 where id in (
   '66b3f69c-cba5-4a81-b18e-9aad192ccfa2',  -- 合同会社ナチュラルキッチン
   '74299c3d-cf6b-46fe-9e0e-33938bb348cf'   -- 株式会社アーバンクラフト
 );

-- premium（5社。ID INC. だけは実企業＝is_demo は下の 4. で false に戻す）
update companies set plan = 'premium', plan_started_at = now(), is_demo = true
 where id in (
   'f00c36e9-4c1d-4f7f-a84b-1ec8db440ebd',  -- TAKUMI
   '4ce466c3-6b18-4c80-a122-6ae092f31f87',  -- 株式会社リィツメディカル
   '8f797cf0-1579-484b-8406-2ad59158b7d5',  -- MEGUTAMA
   '37a91975-415d-45e4-b6cb-49de32dd2fa7',  -- CTD株式会社
   'd57a4cea-3ee0-4254-8522-14a5e89d9034'   -- ID INC.
 );

-- enterprise（1社・デモ）。サーベイ／スコアのデモデータが最も充実しており
-- enterprise ゲートの実機検証に使うため
update companies set plan = 'enterprise', plan_started_at = now(), is_demo = true
 where id = '128a1513-54cc-4e59-8278-3d02b591e336';  -- 株式会社テックブリッジ

-- ID INC. のみ実企業扱い（自社ドッグフーディング用の本番アカウント）
update companies set is_demo = false
 where id = 'd57a4cea-3ee0-4254-8522-14a5e89d9034';

-- 株式会社C&S（2026-08-13 の新規登録・承認待ち）は plan/is_demo とも既定値のまま。
-- plan='free' / is_demo=false ＝ 実顧客候補として扱う。

-- ── 3. 新規登録の既定を承認待ちに ──
-- 新規 owner 登録は superadmin 全件承認制（2026-06-30 の設計）だが、既定値が
-- 'active' のままだった。既存行の値は変更しない。
-- ※ /api/superadmin/create-company は approval_status を渡していないため、
--   この変更に合わせて 'active' を明示的に渡す修正を同じコミットで入れる。
alter table companies alter column approval_status set default 'pending';

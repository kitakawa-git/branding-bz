-- 役職区分の「未設定」を廃止し、既定を staff に統一。
-- 目的: ポータルの表示出し分けが null=未設定でフォールバック（全ページ表示）になっていたのを、
-- 「区分は必ず入っている＝迷いなく出し分けできる」状態へ揃える。
--
-- 手順:
--   1) 既存の null 行を staff にバックフィル
--   2) default を staff にし、NOT NULL 制約を付ける
--   3) コメントを更新

update public.profiles set role_category = 'staff' where role_category is null;

alter table public.profiles
  alter column role_category set default 'staff',
  alter column role_category set not null;

comment on column public.profiles.role_category is
  'メンバー区分: executive=経営層 / manager=管理職 / staff=従業員（既定）。ポータルの表示出し分け（目標・KPI 等）に使用。サーベイの role_category と同語彙。既存の null は 2026-08-06 に staff へバックフィル済み・以後 NOT NULL。';

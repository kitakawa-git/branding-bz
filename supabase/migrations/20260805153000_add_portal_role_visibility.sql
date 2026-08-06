-- 区分ごとのポータル表示設定（会社ごと）。管理画面「設定」の区分×ページ表で編集する。
-- { "<pageKey>": { "executive": bool, "manager": bool, "staff": bool } }
-- null/未設定は既定（目標・KPI は従業員のみ非表示、他は全表示）。加算のみで既存挙動は不変。
alter table public.companies
  add column if not exists portal_role_visibility jsonb;

comment on column public.companies.portal_role_visibility is
  '区分ごとのポータル表示設定。{ "<pageKey>": { "executive": bool, "manager": bool, "staff": bool } }。null/未設定は既定（目標・KPIは従業員のみ非表示、他は全表示）。管理者と区分未設定のメンバーは常に表示。';

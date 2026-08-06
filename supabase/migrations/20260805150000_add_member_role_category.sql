-- メンバー区分（経営層/管理職/従業員）を profiles に追加。
-- ポータルの表示出し分け（目標・KPI 等）に使用。null=未設定。
-- サーベイの role_category と同じ語彙（executive/manager/staff）にそろえる。
alter table public.profiles
  add column if not exists role_category text
  check (role_category in ('executive','manager','staff'));

comment on column public.profiles.role_category is
  'メンバー区分: executive=経営層 / manager=管理職 / staff=従業員。null=未設定。ポータルの表示出し分け（目標・KPI等）に使用。サーベイの role_category と同語彙。';

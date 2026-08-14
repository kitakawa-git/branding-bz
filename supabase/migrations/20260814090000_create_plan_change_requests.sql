-- プラン変更の依頼をためる箱。
--
-- 決済を自前で持たないので、契約者が画面から希望プランを出す → スーパー管理で
-- 中身を確認してこちらが companies.plan を変える、という運用にする。
-- 「お問い合わせ」に流すと本文から意図を読み取る手間がかかるため、
-- どの会社がどのプランを希望したかを構造化して受ける。
--
-- 1社につき pending は1件だけ。気が変わったら同じ行を上書きする（部分ユニーク索引）。

create table if not exists plan_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- 依頼時点の実効プラン。あとから companies.plan が変わっても依頼の文脈が残るように控える
  current_plan text not null,
  requested_plan text not null,
  -- 契約者が書いた補足（人数・時期・相談したいこと）
  note text,
  requested_by uuid,
  requested_by_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- 却下したときの理由。依頼者に伝える文面ではなく社内メモ
  handled_note text,
  handled_at timestamptz,
  handled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table plan_change_requests is
  'プラン変更の依頼。承認するとスーパー管理から companies.plan を書き換える';
comment on column plan_change_requests.current_plan is
  '依頼時点の実効プラン。承認判断のときに「どこから変わるのか」を見るため控える';

create unique index if not exists plan_change_requests_one_pending_per_company
  on plan_change_requests (company_id)
  where status = 'pending';

create index if not exists plan_change_requests_status_created_idx
  on plan_change_requests (status, created_at desc);

alter table plan_change_requests enable row level security;

-- 参照は自社ぶんだけ。書き込みは service_role の API を通す（anon には insert を開けない）。
-- 自社の依頼状況を画面に出すために select だけ許す。
drop policy if exists plan_change_requests_select_own on plan_change_requests;
create policy plan_change_requests_select_own on plan_change_requests
  for select
  using (
    company_id in (
      select company_id from admin_users where auth_id = (select auth.uid())
      union
      select company_id from members where auth_id = (select auth.uid())
    )
  );

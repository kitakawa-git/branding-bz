-- 入力サポート（オンライン相談）の依頼をためる箱。
--
-- セットアップに詰まった管理者からの「相談したい」を、ログインした画面の中で受ける。
-- 以前は外部の問い合わせフォームに飛ばしていたが、サービスサイトに出てしまい
-- 「アプリの中で助けてもらえる」感じが切れていた。
--
-- カレンダー連携はしない。空き時間の照合・二重予約の防止まで自前で持つと、
-- 相談件数が読めないうちから予約システムの難所を抱えることになる。
-- ここは希望を構造化して受けるまでを担い、日程調整は人がやる。
--
-- 1社につき pending は1件だけ。気が変わったら同じ行を上書きする（部分ユニーク索引）。

create table if not exists setup_support_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  -- 依頼時点のセットアップ進捗。あとから進んでも「どの段階で詰まったか」が残るので、
  -- 担当者が相談前に状況を把握できる。判定は lib/onboarding/status.ts と共通
  progress_done int,
  progress_total int,
  -- 希望日時。「平日の午後なら」のような曖昧な希望もそのまま受けたいので自由記述
  preferred_slots text,
  -- 相談したいこと
  note text,
  requested_by uuid,
  requested_by_email text,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  -- 対応時の社内メモ。依頼者に見せる文面ではない
  handled_note text,
  handled_at timestamptz,
  handled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table setup_support_requests is
  '入力サポートの相談依頼。日程調整は画面の外（人）で行う';
comment on column setup_support_requests.progress_done is
  '依頼時点で完了していたステップ数。progress_total と対で見る';

create unique index if not exists setup_support_requests_one_pending_per_company
  on setup_support_requests (company_id)
  where status = 'pending';

create index if not exists setup_support_requests_status_created_idx
  on setup_support_requests (status, created_at desc);

alter table setup_support_requests enable row level security;

-- 参照は自社ぶんだけ。書き込みは service_role の API を通す（anon には insert を開けない）。
-- 自社の依頼状況を画面に出すために select だけ許す。
drop policy if exists setup_support_requests_select_own on setup_support_requests;
create policy setup_support_requests_select_own on setup_support_requests
  for select
  using (
    company_id in (
      select company_id from admin_users where auth_id = (select auth.uid())
      union
      select company_id from members where auth_id = (select auth.uid())
    )
  );

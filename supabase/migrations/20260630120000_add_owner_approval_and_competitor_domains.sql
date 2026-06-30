-- 新規owner登録 superadmin承認制＋競合ドメイン警告
-- 設計: Documents/Claude/ID_bzサービス開発/260630_新規owner登録_競合ドメイン承認制_設計_v1.md
-- ※本マイグレーションは 2026-06-30 に本番へ先行適用済み（履歴記録用）。

-- 1) 競合ドメイン ブロックリスト（superadmin 手動メンテ）
create table if not exists public.blocked_competitor_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  label text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid
);
alter table public.blocked_competitor_domains enable row level security;
drop policy if exists blocked_domains_superadmin_all on public.blocked_competitor_domains;
create policy blocked_domains_superadmin_all on public.blocked_competitor_domains
  for all to authenticated
  using (public.is_current_user_superadmin())
  with check (public.is_current_user_superadmin());

-- 2) companies に承認状態・競合フラグ（既存行は default 'active'/false で埋まる）
alter table public.companies
  add column if not exists approval_status text not null default 'active',
  add column if not exists competitor_flag boolean not null default false;

alter table public.companies drop constraint if exists companies_approval_status_check;
alter table public.companies add constraint companies_approval_status_check
  check (approval_status in ('pending','active','rejected'));

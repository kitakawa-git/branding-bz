-- Web Push 購読情報テーブル（PWAステップ④ プッシュ通知）
-- 1ユーザーが複数端末を購読しうる。endpoint は購読の一意キー。
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,           -- 購読の公開鍵（keys.p256dh）
  auth text not null,             -- 購読の認証シークレット（keys.auth）
  user_agent text,                -- 端末識別の参考
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- FK インデックス（プロジェクト方針: 全FKにインデックス）
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_company on public.push_subscriptions(company_id);

-- RLS（プロジェクト方針: 全テーブル有効・auth.uid() は (select ...) でラップ）
alter table public.push_subscriptions enable row level security;

-- 本人のみ自分の購読を管理（cookieセッション=authenticated）。配信は service_role（RLSバイパス）で行う。
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

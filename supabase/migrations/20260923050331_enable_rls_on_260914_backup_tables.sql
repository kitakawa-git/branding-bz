-- 2026-09-14 の文言修正（news 10記事・wiki_terms 8語）で作った退避表4つが
-- RLS 無効のまま anon / authenticated に全権限（SELECT〜TRUNCATE）が付いていた。
-- security advisor の rls_disabled_in_public（ERROR）。
--
-- public スキーマに CREATE TABLE ... AS で作ると、Supabase の既定権限で
-- anon / authenticated に GRANT が付き、RLS は無効で生まれる。
-- 退避表は scripts/news-fix-260914/・scripts/wiki-fix-260914/ の 04_restore
-- から SQL Editor（postgres）で読むだけなので、API ロールからは一切触れなくてよい。
--
-- ポリシーは作らない＝service_role（と postgres）だけが読める。
-- DROP はしない（退避表は維持する決定。docs/BRD-PROJECT-STATUS.md）。
-- 先例: 20260611011653_enable_rls_on_traits_backup_tables

alter table public.news_backup_260914 enable row level security;
alter table public.news_after_260914  enable row level security;
alter table public.wiki_backup_260914 enable row level security;
alter table public.wiki_after_260914  enable row level security;
revoke all on public.news_backup_260914, public.news_after_260914,
              public.wiki_backup_260914, public.wiki_after_260914
  from anon, authenticated;

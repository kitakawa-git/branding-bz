-- 公開名刺は lib/public-card.ts（service_role・必要な列だけ）で読むようになったため、
-- anon が profiles の全列（email・phone 含む）を一覧で読めるポリシーを廃止する
drop policy if exists profiles_public_card_select on public.profiles;

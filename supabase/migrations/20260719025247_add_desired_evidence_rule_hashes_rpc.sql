-- 未来設計 §14.2: achievement_rule のハッシュを DB 側で算出する RPC
-- 人間判断（desired_evidence_evaluations）の override 失効判定（§6-1・§14.1）に使う。
-- ハッシュは必ず DB 側で計算する（クライアント側の JSON 直列化差でハッシュがぶれるのを防ぐ）。
-- ※本番適用済み（version 20260719025247）。ここは適用済みSQLの記録。
create or replace function public.desired_evidence_rule_hashes(p_company_id uuid)
returns table(id uuid, rule_hash text)
language sql
security definer
set search_path = public, extensions
as $$
  select id, encode(extensions.digest(achievement_rule::text, 'sha256'), 'hex')
  from public.desired_evidence
  where company_id = p_company_id;
$$;

-- service_role（サーバー側 API）からのみ呼ぶ。クライアントには公開しない。
revoke all on function public.desired_evidence_rule_hashes(uuid) from public;
revoke all on function public.desired_evidence_rule_hashes(uuid) from anon;
revoke all on function public.desired_evidence_rule_hashes(uuid) from authenticated;

notify pgrst, 'reload schema';

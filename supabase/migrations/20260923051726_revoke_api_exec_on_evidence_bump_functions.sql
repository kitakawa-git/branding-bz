-- 欲しい証拠（desired_evidence）の鮮度管理に使う SECURITY DEFINER 関数5つから、
-- API ロール（anon / authenticated）と PUBLIC の EXECUTE を外す。
-- security advisor の anon_security_definer_function_executable（5件）と
-- authenticated_security_definer_function_executable（うち5件）への対応。
--
-- 作成元: 20260718141841_create_desired_evidence_evaluations。
-- 作成時に Supabase の既定権限で PUBLIC / anon / authenticated に EXECUTE が付いていた。
-- PUBLIC にも付いているので、anon だけ外しても PUBLIC 経由で呼べてしまう。3つとも外す。
--
-- | 関数                        | 役割                                                   | 呼ばれ方 |
-- |-----------------------------|--------------------------------------------------------|----------|
-- | bump_de_evidence_version    | desired_evidence.evidence_updated_at を now() にする   | 下の trg_* 3つから PERFORM のみ |
-- | dee_fill_snapshot           | 評価行に rule_hash / evidence_version_at_eval を付与   | desired_evidence_evaluations の BEFORE INSERT トリガ |
-- | trg_pp_bump                 | proof_points 更新時に、検証先の証拠を bump            | proof_points の AFTER UPDATE トリガ |
-- | trg_ppm_bump                | 計測値の増減時に、検証先の証拠を bump                 | proof_point_measurements の AFTER I/U/D トリガ |
-- | trg_verifies_bump           | verifies 関係の追加・削除時に、対象の証拠を bump      | element_relations の AFTER I/D トリガ |
--
-- アプリから .rpc() で直接呼んでいる箇所は無い（app / lib / components を検索して0件）。
--
-- 塞ぐ理由: bump_de_evidence_version は入力を検証せず、渡された ID の証拠を会社を問わず更新する。
-- element_relations は anon から SELECT できる（element_relations_public_select）ので、
-- verifies 関係の target_id から証拠の ID を集めて /rest/v1/rpc/bump_de_evidence_version を叩けば、
-- 未ログインのまま全社の評価を「証拠が更新された＝要再評価」に見せかけられた。
-- trg_* と dee_fill_snapshot は returns trigger なので直接呼んでもエラーになるだけだが、
-- API から見える必要も無いので一緒に外す。
--
-- トリガは止まらない: EXECUTE 権限が確認されるのは CREATE TRIGGER の時だけで、発火時には見ない。
-- trg_* の中から呼ぶ bump_de_evidence_version も、SECURITY DEFINER の中なので所有者（postgres）の権限で通る。
-- 適用前に一時オブジェクトで同じ構成を作り、authenticated の INSERT → 権限を外した
-- DEFINER トリガ → 権限を外した DEFINER 関数、の順で呼ばれて更新まで通ることを確認した（ROLLBACK 済み）。
--
-- service_role / postgres の EXECUTE は残る（明示付与のため）。

revoke execute on function public.bump_de_evidence_version(uuid[]) from public, anon, authenticated;
revoke execute on function public.dee_fill_snapshot()              from public, anon, authenticated;
revoke execute on function public.trg_pp_bump()                    from public, anon, authenticated;
revoke execute on function public.trg_ppm_bump()                   from public, anon, authenticated;
revoke execute on function public.trg_verifies_bump()              from public, anon, authenticated;
notify pgrst, 'reload schema';

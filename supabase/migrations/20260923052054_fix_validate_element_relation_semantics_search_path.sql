-- element_relations の BEFORE トリガ関数 validate_element_relation_semantics の search_path を固定する。
-- security advisor の function_search_path_mutable（WARN）への対応。
--
-- SECURITY INVOKER で、中身は NEW の列を見て組み合わせを検証するだけ（他のオブジェクトを参照しない）。
-- 固定しても挙動は変わらない。呼び出し側の search_path に左右されない形にしておく。
-- 他の関数と同じく public, pg_temp（pg_temp を最後に置き、一時スキーマでの差し替えを防ぐ）。
--
-- なお、20260923051726 で塞がなかった SECURITY DEFINER の is_current_user_superadmin() は、
-- admin_users / companies / element_relations / philosophy_elements / copy_* 5表 /
-- blocked_competitor_domains の計10ポリシーから参照されているため、authenticated の EXECUTE を残す。
-- 引数は無く、auth.uid() 本人が superadmin かを返すだけなので、他人の情報は取れない。
-- anon の EXECUTE は 20260608061829 で外してある。

alter function public.validate_element_relation_semantics() set search_path = public, pg_temp;

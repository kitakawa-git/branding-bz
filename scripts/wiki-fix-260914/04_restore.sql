-- ============================================================
-- §8 用語集 8語の文言修正 / STEP 4: 復元（必要なときだけ）
-- 02 実行後に誰かが編集していたら中止します。
-- ============================================================
begin;

do $$
declare n int; bad text;
begin
  if to_regclass('public.wiki_after_260914') is null then
    raise exception '03 のスナップショット wiki_after_260914 がありません。復元できません。';
  end if;
  select count(*) into n from public.wiki_after_260914;
  if n <> 8 then raise exception 'スナップショットの件数が8件ではありません (%)', n; end if;

  select string_agg(w.slug, ', ') into bad
  from public.wiki_terms w join public.wiki_after_260914 a on a.id = w.id
  where md5(w.short_def) is distinct from a.short_md5 or md5(w.long_def) is distinct from a.long_md5;
  if bad is not null then
    raise exception '02 実行後に編集された用語があります: %。上書きを避けるため中止します。', bad;
  end if;
end $$;

update public.wiki_terms w set
  short_def = b.short_def,
  long_def  = b.long_def,
  updated_at = now()
from public.wiki_backup_260914 b
where b.id = w.id;

do $$
declare n int;
begin
  select count(*) into n from public.wiki_terms w join public.wiki_backup_260914 b on b.id = w.id
  where w.short_def is not distinct from b.short_def and w.long_def is not distinct from b.long_def;
  if n <> 8 then raise exception '復元できたのは%件です。ロールバックします。', n; end if;
end $$;

commit;

-- ============================================================
-- §7 ニュース記事 文言修正 / STEP 4: 復元（必要なときだけ）
-- 02 の変更だけを元に戻します。
-- 02 実行後に誰かが編集していた場合は、その編集を守るため中止します。
-- ============================================================
begin;

-- ガード: 02 の直後の状態から変わっていないこと
-- （02 の結果ハッシュを記録した news_after_260914 と照合）
do $$
declare n int; bad text;
begin
  if to_regclass('public.news_after_260914') is null then
    raise exception '03 実行時のスナップショット news_after_260914 がありません。復元できません。';
  end if;
  select count(*) into n from public.news_after_260914;
  if n <> 10 then raise exception 'スナップショットの件数が10件ではありません (%)', n; end if;

  select string_agg(x.slug, ', ') into bad
  from public.news x
  join public.news_after_260914 a on a.id = x.id
  where md5(x.body) is distinct from a.body_md5
     or x.title is distinct from a.title
     or x.summary is distinct from a.summary;
  if bad is not null then
    raise exception '02 実行後に編集された記事があります: %。上書きを避けるため中止します。', bad;
  end if;
end $$;

-- 復元
update public.news n set
  title = b.title,
  summary = b.summary,
  body = b.body,
  updated_at = now()
from public.news_backup_260914 b
where b.id = n.id;

-- 件数確認
do $$
declare n int;
begin
  select count(*) into n
  from public.news x join public.news_backup_260914 b on b.id = x.id
  where x.body = b.body and x.title = b.title and x.summary is not distinct from b.summary;
  if n <> 10 then raise exception '復元できたのは%件です。ロールバックします。', n; end if;
end $$;

commit;

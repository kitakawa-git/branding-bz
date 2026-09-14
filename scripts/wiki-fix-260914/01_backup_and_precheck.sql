-- ============================================================
-- §8 用語集 8語の文言修正 / STEP 1: 退避 + 事前確認
-- 実行順: 01 → 02 → 03 （戻す場合のみ 04）
-- データは変更しません（退避表の作成のみ）
-- ============================================================

create table public.wiki_backup_260914 as
select id, slug, term, short_def, long_def, updated_at, now() as backed_up_at
from public.wiki_terms
where slug in (
  'nps','ブランド想起','ブランドフォント','プレミアムブランド',
  'ロイヤリティプログラム','提供価値の重み付け','コンセプトビジュアル','周年ブランディング'
);

-- 8件であること
select count(*) as backup_rows from public.wiki_backup_260914;

-- 重複 slug が無いこと（0件）
select slug, count(*) from public.wiki_terms
where slug in ('nps','ブランド想起','ブランドフォント','プレミアムブランド','ロイヤリティプログラム','提供価値の重み付け','コンセプトビジュアル','周年ブランディング')
group by slug having count(*) > 1;

-- 変更前ハッシュ
select slug, md5(short_def) as short_md5, md5(long_def) as long_md5, status
from public.wiki_terms
where slug in ('nps','ブランド想起','ブランドフォント','プレミアムブランド','ロイヤリティプログラム','提供価値の重み付け','コンセプトビジュアル','周年ブランディング')
order by slug;

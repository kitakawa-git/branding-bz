-- ============================================================
-- §8 用語集 8語の文言修正 / STEP 3: 事後確認（読み取り＋スナップショット）
-- ============================================================

-- 1. 8件すべて更新されたか
select w.slug, (w.updated_at > b.updated_at) as updated,
       length(b.short_def) as before_short, length(w.short_def) as after_short,
       length(b.long_def)  as before_long,  length(w.long_def)  as after_long
from public.wiki_terms w join public.wiki_backup_260914 b on b.id = w.id
order by w.slug;

-- 2. 古い表現が残っていないこと（全項目 0）
select 'nps/10段階' as item, count(*) from public.wiki_terms where slug='nps' and short_def like '%を10段階で聞き%'
union all select '想起/最初に浮かぶ', count(*) from public.wiki_terms where slug='ブランド想起' and (short_def like '%最初に浮かぶ%' or long_def like '%顧客の頭の中で最初に浮かぶ%')
union all select 'フォント/同義', count(*) from public.wiki_terms where slug='ブランドフォント' and (short_def like '%タイポグラフィーとも呼ばれる。%' or long_def like '%タイポグラフィーとも呼ばれ、色や余白%')
union all select 'プレミアム/高体験', count(*) from public.wiki_terms where slug='プレミアムブランド' and (short_def like '%高体験%' or long_def like '%高体験%')
union all select 'ロイヤリティ/インセンティブ化', count(*) from public.wiki_terms where slug='ロイヤリティプログラム' and (short_def like '%インセンティブ化%' or long_def like '%インセンティブ化%')
union all select '重み付け/優先度づけ', count(*) from public.wiki_terms where slug='提供価値の重み付け' and short_def like '%優先度づけ%'
union all select 'CV/1枚', count(*) from public.wiki_terms where slug='コンセプトビジュアル' and (short_def like '%1枚の画像・映像%' or long_def like '%1枚の写真・グラフィック・映像%')
union all select '周年/節目タイミング', count(*) from public.wiki_terms where slug='周年ブランディング' and short_def like '%節目タイミング%';

-- 3. slug・term・status が変わっていないこと（0件）
select w.slug from public.wiki_terms w join public.wiki_backup_260914 b on b.id = w.id
where w.slug is distinct from b.slug or w.term is distinct from b.term;

-- 4. 新しい short_def を目視確認
select slug, short_def from public.wiki_terms
where slug in ('nps','ブランド想起','ブランドフォント','プレミアムブランド','ロイヤリティプログラム','提供価値の重み付け','コンセプトビジュアル','周年ブランディング')
order by slug;

-- 5. 復元に備えたスナップショット
create table public.wiki_after_260914 as
select id, slug, md5(short_def) as short_md5, md5(long_def) as long_md5, now() as snapshot_at
from public.wiki_terms
where slug in ('nps','ブランド想起','ブランドフォント','プレミアムブランド','ロイヤリティプログラム','提供価値の重み付け','コンセプトビジュアル','周年ブランディング');
select count(*) as snapshot_rows from public.wiki_after_260914;

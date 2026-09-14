-- ============================================================
-- §8 用語集 8語の文言修正 / STEP 2: 更新
-- 前提: 01 を実行済みで wiki_backup_260914 が8件あること
-- 1トランザクション。条件を満たさなければ全体を中止します。
-- 変更するのは short_def / long_def / updated_at のみ。
-- slug・term・status・categories・aliases は変更しません。
-- 「ブランドパーソナリティの5次元」は監修待ちのため対象外です。
-- ============================================================
begin;

-- ガード1: 退避表が8件
do $$
declare n int;
begin
  select count(*) into n from public.wiki_backup_260914;
  if n <> 8 then raise exception '退避表の件数が8件ではありません (%). 01 を先に実行してください。', n; end if;
end $$;

-- ガード2: 退避後に編集されていないこと
do $$
declare bad text;
begin
  select string_agg(w.slug, ', ') into bad
  from public.wiki_terms w
  join public.wiki_backup_260914 b on b.id = w.id
  where w.short_def is distinct from b.short_def or w.long_def is distinct from b.long_def;
  if bad is not null then raise exception '退避後に編集された用語があります: %。中止します。', bad; end if;
end $$;

-- ガード3: 置換対象が実在すること
do $$
declare missing text := '';
begin
  if not exists (select 1 from public.wiki_terms where slug='nps' and short_def like '%を10段階で聞き%') then missing := missing || ' nps/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ブランド想起' and short_def like '%顧客の頭に最初に浮かぶ%') then missing := missing || ' 想起/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ブランド想起' and long_def like '%顧客の頭の中で最初に浮かぶ%') then missing := missing || ' 想起/long'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ブランドフォント' and short_def like '%タイポグラフィーとも呼ばれる。%') then missing := missing || ' フォント/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ブランドフォント' and long_def like '%タイポグラフィーとも呼ばれ、色や余白%') then missing := missing || ' フォント/long'; end if;
  if not exists (select 1 from public.wiki_terms where slug='プレミアムブランド' and short_def like '%高体験%') then missing := missing || ' プレミアム/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='プレミアムブランド' and long_def like '%高体験%') then missing := missing || ' プレミアム/long'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ロイヤリティプログラム' and short_def like '%インセンティブ化%') then missing := missing || ' ロイヤリティ/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='ロイヤリティプログラム' and long_def like '%インセンティブ化%') then missing := missing || ' ロイヤリティ/long'; end if;
  if not exists (select 1 from public.wiki_terms where slug='提供価値の重み付け' and short_def like '%優先度づけした設計%') then missing := missing || ' 重み付け/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='コンセプトビジュアル' and short_def like '%1枚の画像・映像に凝縮%') then missing := missing || ' CV/short'; end if;
  if not exists (select 1 from public.wiki_terms where slug='コンセプトビジュアル' and long_def like '%1枚の写真・グラフィック・映像に凝縮%') then missing := missing || ' CV/long'; end if;
  if not exists (select 1 from public.wiki_terms where slug='周年ブランディング' and short_def like '%節目タイミング%') then missing := missing || ' 周年/short'; end if;
  if missing <> '' then raise exception '置換対象が見つかりません:%。既に適用済みの可能性があります。中止します。', missing; end if;
end $$;

-- 8-1 NPS -----------------------------------------------------
update public.wiki_terms set
  short_def = replace(short_def, 'を10段階で聞き', 'を0〜10の11段階で聞き'),
  updated_at = now()
where slug = 'nps';

-- 8-2 ブランド想起 --------------------------------------------
update public.wiki_terms set
  short_def = '特定のカテゴリや状況を手がかりに、顧客がブランドを思い出すこと。最初に思い浮かぶブランドは、第一想起（トップオブマインド）と呼ぶ。',
  long_def  = replace(long_def,
                '特定のカテゴリや状況を思い浮かべたときに、顧客の頭の中で最初に浮かぶブランドの想起されやすさを指す',
                '特定のカテゴリや状況を手がかりに、顧客がブランドを思い出すことを指す'),
  updated_at = now()
where slug = 'ブランド想起';

-- 8-3 ブランドフォント ----------------------------------------
update public.wiki_terms set
  short_def = replace(short_def,
                '書体（フォント）のこと。タイポグラフィーとも呼ばれる。',
                '書体（フォント）のこと。書体に加えてサイズ・字間・行間まで含めた文字組み全体はタイポグラフィと呼ぶ。'),
  long_def  = replace(long_def,
                'タイポグラフィーとも呼ばれ、色や余白と並んでブランドの印象を左右する視覚要素の柱の一つになる。',
                '色や余白と並んでブランドの印象を左右する視覚要素の柱の一つで、書体に加えてサイズ・字間・行間まで含めた文字組み全体はタイポグラフィと呼ぶ。'),
  updated_at = now()
where slug = 'ブランドフォント';

-- 8-4 プレミアムブランド --------------------------------------
update public.wiki_terms set
  short_def = replace(short_def,
                '高価格・高品質・高体験のポジションを取るブランド。',
                '高価格・高品質で、質の高い顧客体験を提供するポジションを取るブランド。'),
  long_def  = replace(long_def,
                '高価格・高品質・高体験のポジションを取るブランドを指す',
                '高価格・高品質で、質の高い顧客体験を提供するポジションを取るブランドを指す'),
  updated_at = now()
where slug = 'プレミアムブランド';

-- 8-5 ロイヤリティプログラム ----------------------------------
update public.wiki_terms set
  short_def = 'ポイントや特典を通じて、継続的な購買・利用を促す仕組み。',
  long_def  = replace(long_def,
                '継続的な購買や利用を報酬でインセンティブ化する取り組みを指す',
                '継続的な購買や利用を促す取り組みを指す'),
  updated_at = now()
where slug = 'ロイヤリティプログラム';

-- 8-6 提供価値の重み付け --------------------------------------
update public.wiki_terms set
  short_def = '自社が提供する複数の価値の中で、伝える価値に優先順位をつけること。',
  updated_at = now()
where slug = '提供価値の重み付け';

-- 8-7 コンセプトビジュアル ------------------------------------
update public.wiki_terms set
  short_def = replace(short_def,
                'ブランドの世界観を1枚の画像・映像に凝縮した象徴的なビジュアル。',
                'ブランドの世界観を、画像や映像に凝縮した象徴的なビジュアル。'),
  long_def  = replace(long_def, '1枚の写真・グラフィック・映像に凝縮し', '写真・グラフィック・映像に凝縮し'),
  updated_at = now()
where slug = 'コンセプトビジュアル';

-- 8-8 周年ブランディング --------------------------------------
update public.wiki_terms set
  short_def = replace(short_def, '企業の節目タイミングを活用して行う', '企業の節目を活かして行う'),
  updated_at = now()
where slug = '周年ブランディング';

-- ガード4: 古い表現が残っていないこと
do $$
declare left_over text := '';
begin
  if exists (select 1 from public.wiki_terms where slug='nps' and short_def like '%を10段階で聞き%') then left_over := left_over || ' nps'; end if;
  if exists (select 1 from public.wiki_terms where slug='ブランド想起' and (short_def like '%最初に浮かぶ%' or long_def like '%顧客の頭の中で最初に浮かぶ%')) then left_over := left_over || ' 想起'; end if;
  if exists (select 1 from public.wiki_terms where slug='ブランドフォント' and (short_def like '%タイポグラフィーとも呼ばれる。%' or long_def like '%タイポグラフィーとも呼ばれ、色や余白%')) then left_over := left_over || ' フォント'; end if;
  if exists (select 1 from public.wiki_terms where slug='プレミアムブランド' and (short_def like '%高体験%' or long_def like '%高体験%')) then left_over := left_over || ' プレミアム'; end if;
  if exists (select 1 from public.wiki_terms where slug='ロイヤリティプログラム' and (short_def like '%インセンティブ化%' or long_def like '%インセンティブ化%')) then left_over := left_over || ' ロイヤリティ'; end if;
  if exists (select 1 from public.wiki_terms where slug='提供価値の重み付け' and short_def like '%優先度づけ%') then left_over := left_over || ' 重み付け'; end if;
  if exists (select 1 from public.wiki_terms where slug='コンセプトビジュアル' and (short_def like '%1枚の画像・映像%' or long_def like '%1枚の写真・グラフィック・映像%')) then left_over := left_over || ' CV'; end if;
  if exists (select 1 from public.wiki_terms where slug='周年ブランディング' and short_def like '%節目タイミング%') then left_over := left_over || ' 周年'; end if;
  if left_over <> '' then raise exception '置換が完了していません:%。ロールバックします。', left_over; end if;
end $$;

-- ガード5: 8件すべてが更新されたこと
do $$
declare n int;
begin
  select count(*) into n from public.wiki_terms w join public.wiki_backup_260914 b on b.id = w.id
  where w.updated_at > b.updated_at;
  if n <> 8 then raise exception '更新された用語が%件です（8件であるべき）。ロールバックします。', n; end if;
end $$;

commit;

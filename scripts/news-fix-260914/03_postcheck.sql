-- ============================================================
-- §7 ニュース記事 文言修正 / STEP 3: 事後確認（読み取りのみ）
-- ============================================================

-- 1. 10件すべてが更新されたか（updated_at が退避時より新しいこと）
select n.slug,
       (n.updated_at > b.updated_at) as updated,
       length(b.body) as before_len,
       length(n.body) as after_len,
       (length(n.body) - length(b.body)) as diff
from public.news n
join public.news_backup_260914 b on b.id = n.id
order by n.slug;

-- 2. 古い表現が残っていないこと（0件であること）
select 'persona/定着' as item, count(*) from public.news where slug='persona-builder-journey-map' and (body like '%購入 → 定着%' or summary like '%認知から定着まで%')
union all select 'launch/類を見ません', count(*) from public.news where slug='branding-bz-launch' and body like '%他に類を見ません%'
union all select 'launch/無料でお試し', count(*) from public.news where slug='branding-bz-launch' and body like '%（無料でお試し可能）%'
union all select 'quiz/解説で学習', count(*) from public.news where slug='brand-comprehension-quiz' and body like '%テスト本人には解説で学習%'
union all select 'stp/最適な2軸', count(*) from public.news where slug='stp-positioning-map' and body like '%最適な2軸%'
union all select 'stp/連携モーダル', count(*) from public.news where slug='stp-positioning-map' and body like '%連携モーダルを刷新%'
union all select 'personality/収斂', count(*) from public.news where slug='brand-personality-tool' and body like '%への収斂は許容しつつ%'
union all select 'video/セッション', count(*) from public.news where slug='video-learning-launch' and body like '%視聴セッションごとに1行%'
union all select 'pwa/カタカナ', count(*) from public.news where slug='pwa-and-mobile-ux' and (body like '%スタンドアロン起動%' or body like '%オフラインフォールバック%' or body like '%トーストで通知%')
union all select 'portal/4象限', count(*) from public.news where slug='portal-brand-four-quadrants' and (title like '%4象限%' or body like '%4象限%' or summary like '%4象限%')
union all select 'vlcat/生存', count(*) from public.news where slug='video-learning-categories' and body like '%未分類の動画も生存%'
union all select 'push/購読', count(*) from public.news where slug='web-push-notifications' and body like '%無効になった購読%';

-- 3. 注記が1回ずつだけ入っていること（count が 1 であること）
select slug,
  (length(body) - length(replace(body,'作成結果をブランド情報に反映する操作を指します',''))) / length('作成結果をブランド情報に反映する操作を指します') as note_count
from public.news
where slug in ('stp-positioning-map','brand-personality-tool','persona-builder-journey-map')
order by slug;

-- 4. slug・公開日・公開状態が変わっていないこと（0件であること）
select n.slug from public.news n
join public.news_backup_260914 b on b.id = n.id
where n.slug is distinct from b.slug;

-- 5. 各記事の末尾を目視確認
select slug, right(body, 240) as tail from public.news
where slug in ('persona-builder-journey-map','branding-bz-launch','brand-comprehension-quiz','stp-positioning-map','brand-personality-tool')
order by slug;

-- ============================================================
-- 6. 復元に備えて、02 直後の状態を記録する
--    （04_restore.sql はこの表と照合してから戻します）
-- ============================================================
create table public.news_after_260914 as
select id, slug, title, summary, md5(body) as body_md5, now() as snapshot_at
from public.news
where slug in (
  'persona-builder-journey-map','branding-bz-launch','brand-comprehension-quiz',
  'stp-positioning-map','brand-personality-tool','video-learning-launch',
  'pwa-and-mobile-ux','portal-brand-four-quadrants',
  'video-learning-categories','web-push-notifications'
);
select count(*) as snapshot_rows from public.news_after_260914;

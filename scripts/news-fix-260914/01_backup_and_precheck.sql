-- ============================================================
-- §7 ニュース記事 文言修正 / STEP 1: 退避 + 事前確認
-- 実行順: 01 → 02 → 03 （戻す場合のみ 04）
-- このファイルはデータを変更しません（バックアップ表の作成のみ）
-- ============================================================

-- 1. 変更前データを退避（既に存在する場合はエラーで停止＝二重実行防止）
create table public.news_backup_260914 as
select id, slug, title, summary, body, updated_at, now() as backed_up_at
from public.news
where slug in (
  'persona-builder-journey-map','branding-bz-launch','brand-comprehension-quiz',
  'stp-positioning-map','brand-personality-tool','video-learning-launch',
  'pwa-and-mobile-ux','portal-brand-four-quadrants',
  'video-learning-categories','web-push-notifications'
);

-- 2. 件数確認（10件でなければ以降を実行しないこと）
select count(*) as backup_rows from public.news_backup_260914;

-- 3. 重複 slug が無いこと（0件であること）
select slug, count(*) from public.news
where slug in (
  'persona-builder-journey-map','branding-bz-launch','brand-comprehension-quiz',
  'stp-positioning-map','brand-personality-tool','video-learning-launch',
  'pwa-and-mobile-ux','portal-brand-four-quadrants',
  'video-learning-categories','web-push-notifications'
)
group by slug having count(*) > 1;

-- 4. 変更前の本文ハッシュ（02 の照合値と一致することを目視確認）
select slug, md5(body) as body_md5, length(body) as len, is_published
from public.news
where slug in (
  'persona-builder-journey-map','branding-bz-launch','brand-comprehension-quiz',
  'stp-positioning-map','brand-personality-tool','video-learning-launch',
  'pwa-and-mobile-ux','portal-brand-four-quadrants',
  'video-learning-categories','web-push-notifications'
)
order by slug;

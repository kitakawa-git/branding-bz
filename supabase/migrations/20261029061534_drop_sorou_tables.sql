-- 日程調整ツール（sorou）の取り下げ（2026-10-29）
-- 持ってくる予定のツールの取り違えだったため、追加したテーブルと利用回数の行を消す。
-- 中身はテックブリッジ（デモ）の確認用1件（回答2人）だけ
delete from public.mini_app_sessions where app_type = 'sorou';
drop table if exists public.sorou_participants;
drop table if exists public.sorou_events;

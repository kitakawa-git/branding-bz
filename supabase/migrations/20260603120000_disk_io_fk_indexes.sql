-- Disk IO 削減 A-①: 不足していた外部キーのインデックスを追加
-- すべて IF NOT EXISTS の「追加のみ」。既存の挙動・データ・RLS には一切影響しない。
-- Supabase advisor: unindexed_foreign_keys（29件）への対応。
create index if not exists idx_admin_users_company_id on public.admin_users (company_id);
create index if not exists idx_announcement_likes_company_id on public.announcement_likes (company_id);
create index if not exists idx_announcement_likes_user_id on public.announcement_likes (user_id);
create index if not exists idx_announcement_reads_company_id on public.announcement_reads (company_id);
create index if not exists idx_announcements_author_id on public.announcements (author_id);
create index if not exists idx_brand_guidelines_updated_by on public.brand_guidelines (updated_by);
create index if not exists idx_brand_micro_feedbacks_source_profile_id on public.brand_micro_feedbacks (source_profile_id);
create index if not exists idx_brand_page_views_source_profile_id on public.brand_page_views (source_profile_id);
create index if not exists idx_brand_personalities_updated_by on public.brand_personalities (updated_by);
create index if not exists idx_brand_quiz_answers_question_id on public.brand_quiz_answers (question_id);
create index if not exists idx_brand_quiz_attempts_company_id on public.brand_quiz_attempts (company_id);
create index if not exists idx_brand_quiz_attempts_profile_id on public.brand_quiz_attempts (profile_id);
create index if not exists idx_brand_score_snapshots_inner_survey_id on public.brand_score_snapshots (inner_survey_id);
create index if not exists idx_brand_survey_responses_question_id on public.brand_survey_responses (question_id);
create index if not exists idx_brand_values_company_id on public.brand_values (company_id);
create index if not exists idx_brand_visuals_updated_by on public.brand_visuals (updated_by);
create index if not exists idx_card_views_profile_id on public.card_views (profile_id);
create index if not exists idx_invite_links_created_by on public.invite_links (created_by);
create index if not exists idx_members_invited_by on public.members (invited_by);
create index if not exists idx_members_profile_id on public.members (profile_id);
create index if not exists idx_profiles_company_id on public.profiles (company_id);
create index if not exists idx_survey_participants_profile_id on public.survey_participants (profile_id);
create index if not exists idx_timeline_comments_company_id on public.timeline_comments (company_id);
create index if not exists idx_timeline_comments_post_id on public.timeline_comments (post_id);
create index if not exists idx_timeline_comments_user_id on public.timeline_comments (user_id);
create index if not exists idx_timeline_likes_company_id on public.timeline_likes (company_id);
create index if not exists idx_timeline_likes_user_id on public.timeline_likes (user_id);
create index if not exists idx_timeline_posts_company_id on public.timeline_posts (company_id);
create index if not exists idx_timeline_posts_user_id on public.timeline_posts (user_id);

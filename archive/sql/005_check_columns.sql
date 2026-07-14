-- ============================================
-- カラム存在確認クエリ
-- Supabase SQL Editor で実行して、brand_story / provided_values が
-- companies テーブルに存在するか確認してください
-- ============================================

-- companiesテーブルのカラム一覧
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- profilesテーブルのカラム一覧（SNSカラム確認）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================
-- もし brand_story, provided_values が表示されない場合は
-- sql/004_card_enhancements.sql を先に実行してください：
--
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_story text;
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS provided_values text[];
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_x text;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_linkedin text;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_facebook text;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_instagram text;
-- ============================================

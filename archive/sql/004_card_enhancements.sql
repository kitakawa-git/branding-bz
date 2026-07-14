-- ============================================
-- スマート名刺強化: SNSリンク・ブランドストーリー・提供価値
-- ※ Supabase SQL Editor で実行してください
-- ============================================

-- profilesテーブル: SNSリンク追加
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_x text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_linkedin text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_facebook text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sns_instagram text;

-- companiesテーブル: ブランドストーリー・提供価値追加
ALTER TABLE companies ADD COLUMN IF NOT EXISTS brand_story text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS provided_values text[];

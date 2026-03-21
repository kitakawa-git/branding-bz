-- brand_personasテーブルにペルソナビルダー用カラムを追加
ALTER TABLE brand_personas
  ADD COLUMN IF NOT EXISTS persona_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS journey_map_data jsonb DEFAULT NULL;

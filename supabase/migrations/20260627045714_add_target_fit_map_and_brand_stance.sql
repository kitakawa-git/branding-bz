-- STP分析ツール再設計: brand_personas にターゲット適合マップ／自社の立ち位置を保存する列を追加
ALTER TABLE brand_personas
  ADD COLUMN target_fit_map_data jsonb,
  ADD COLUMN brand_stance_statements jsonb;

COMMENT ON COLUMN brand_personas.target_fit_map_data IS
  'STP分析のターゲット適合マップ（顧客側軸＋ターゲット点＋自社カバー範囲）';
COMMENT ON COLUMN brand_personas.brand_stance_statements IS
  'STP分析の自社の立ち位置（ターゲット別×3本のポジショニング文）';

-- PostgREST スキーマキャッシュ再読込
notify pgrst, 'reload schema';

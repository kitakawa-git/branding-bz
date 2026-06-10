-- business_content の ID化 ステージ1: philosophy_elements.element_type に 'service' を追加。
-- service = 事業内容（具体サービス）。事業領域は companies.industry_category が保持。
-- service は複数可。部分ユニーク uq_philosophy_singleton は mission/vision のみ対象＝service は除外で正しい。
ALTER TABLE public.philosophy_elements DROP CONSTRAINT philosophy_elements_element_type_check;
ALTER TABLE public.philosophy_elements ADD CONSTRAINT philosophy_elements_element_type_check
  CHECK (element_type IN ('mission','vision','value','action_guideline','service'));
NOTIFY pgrst, 'reload schema';

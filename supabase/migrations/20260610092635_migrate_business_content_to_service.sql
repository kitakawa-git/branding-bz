-- business_content の ID化 ステージ2 backfill（dual-run: brand_guidelines.business_content jsonb は残す）。
-- 冪等: 当該 company に service 行が既にあればスキップ。空 title はスキップ。架空データは作らない。
-- title=title, body=description, sort_order=added_index（無ければ配列順）, parent_element_id=NULL。
INSERT INTO public.philosophy_elements (company_id, element_type, title, body, sort_order, status)
SELECT bg.company_id, 'service',
       e.elem->>'title',
       COALESCE(e.elem->>'description',''),
       COALESCE((e.elem->>'added_index')::int, (e.ord-1)::int),
       'published'
FROM public.brand_guidelines bg
CROSS JOIN LATERAL jsonb_array_elements(bg.business_content) WITH ORDINALITY AS e(elem, ord)
WHERE jsonb_typeof(bg.business_content) = 'array'
  AND (e.elem->>'title') IS NOT NULL AND btrim(e.elem->>'title') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.philosophy_elements pe
                  WHERE pe.company_id = bg.company_id AND pe.element_type = 'service');

NOTIFY pgrst, 'reload schema';

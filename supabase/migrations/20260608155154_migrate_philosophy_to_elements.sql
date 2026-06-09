-- Step 1a backfill（dual-run: brand_guidelines の jsonb/列は残す）。
-- 冪等: 当該 company×element_type の行が既にあればスキップ。空 mission/vision は行を作らない。
-- parent_element_id は NULL（value↔action_guideline の紐付け情報が無いため捏造しない）。

-- mission（body=全文・titleは空）
INSERT INTO public.philosophy_elements (company_id, element_type, title, body, sort_order, status)
SELECT bg.company_id, 'mission', NULL, bg.mission, 0, 'published'
FROM public.brand_guidelines bg
WHERE bg.mission IS NOT NULL AND btrim(bg.mission) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.philosophy_elements pe
                  WHERE pe.company_id = bg.company_id AND pe.element_type = 'mission');

-- vision
INSERT INTO public.philosophy_elements (company_id, element_type, title, body, sort_order, status)
SELECT bg.company_id, 'vision', NULL, bg.vision, 0, 'published'
FROM public.brand_guidelines bg
WHERE bg.vision IS NOT NULL AND btrim(bg.vision) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.philosophy_elements pe
                  WHERE pe.company_id = bg.company_id AND pe.element_type = 'vision');

-- values（{name,added_index,description}）→ value 行（title=name, body=description, sort_order=added_index）
INSERT INTO public.philosophy_elements (company_id, element_type, title, body, sort_order, status)
SELECT bg.company_id, 'value',
       e.elem->>'name',
       COALESCE(e.elem->>'description',''),
       COALESCE((e.elem->>'added_index')::int, (e.ord-1)::int),
       'published'
FROM public.brand_guidelines bg
CROSS JOIN LATERAL jsonb_array_elements(bg.values) WITH ORDINALITY AS e(elem, ord)
WHERE jsonb_typeof(bg.values) = 'array'
  AND (e.elem->>'name') IS NOT NULL AND btrim(e.elem->>'name') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.philosophy_elements pe
                  WHERE pe.company_id = bg.company_id AND pe.element_type = 'value');

-- action_guidelines（{title,description}）→ action_guideline 行（sort_order=配列順, parent=NULL）
INSERT INTO public.philosophy_elements (company_id, element_type, title, body, sort_order, status)
SELECT bg.company_id, 'action_guideline',
       e.elem->>'title',
       COALESCE(e.elem->>'description',''),
       (e.ord-1)::int,
       'published'
FROM public.brand_guidelines bg
CROSS JOIN LATERAL jsonb_array_elements(bg.action_guidelines) WITH ORDINALITY AS e(elem, ord)
WHERE jsonb_typeof(bg.action_guidelines) = 'array'
  AND (e.elem->>'title') IS NOT NULL AND btrim(e.elem->>'title') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.philosophy_elements pe
                  WHERE pe.company_id = bg.company_id AND pe.element_type = 'action_guideline');

NOTIFY pgrst, 'reload schema';

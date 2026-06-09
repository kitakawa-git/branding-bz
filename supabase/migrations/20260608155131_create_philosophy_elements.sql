-- Step 1a: 理念中核要素(mission/vision/value/action_guideline)のID化テーブル。
-- 要素単位の浸透度測定・AI参照を可能にする。element_relations/business_content は次カット。
CREATE TABLE public.philosophy_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  element_type text NOT NULL CHECK (element_type IN ('mission','vision','value','action_guideline')),
  title text,
  body text,
  parent_element_id uuid REFERENCES public.philosophy_elements(id) ON DELETE SET NULL,
  sort_order int DEFAULT 0,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  updated_by uuid,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.philosophy_elements IS
  '理念の中核要素(mission/vision/value/action_guideline)をID付き行で保持。brand_guidelines の mission/vision text・values/action_guidelines jsonb の正規化先。value→action_guideline 階層は parent_element_id（現状は未紐付け=NULL）。';

-- mission/vision は各社1件
CREATE UNIQUE INDEX uq_philosophy_singleton ON public.philosophy_elements(company_id, element_type)
  WHERE element_type IN ('mission','vision');
CREATE INDEX idx_philosophy_company ON public.philosophy_elements(company_id);
CREATE INDEX idx_philosophy_parent ON public.philosophy_elements(parent_element_id);

ALTER TABLE public.philosophy_elements ENABLE ROW LEVEL SECURITY;

-- RLS: brand_guidelines をミラー（公開SELECT＋company admin 書込）。
--   行CRUD化に伴い DELETE を追加。superadmin 全社操作は is_current_user_superadmin() を再利用。
CREATE POLICY philosophy_elements_public_select ON public.philosophy_elements
  FOR SELECT USING (true);

CREATE POLICY philosophy_elements_admin_insert ON public.philosophy_elements
  FOR INSERT WITH CHECK (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );
CREATE POLICY philosophy_elements_admin_update ON public.philosophy_elements
  FOR UPDATE USING (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  ) WITH CHECK (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );
CREATE POLICY philosophy_elements_admin_delete ON public.philosophy_elements
  FOR DELETE USING (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );

CREATE POLICY philosophy_elements_superadmin_all ON public.philosophy_elements
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());

NOTIFY pgrst, 'reload schema';

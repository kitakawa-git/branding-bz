-- Step 1b: element_relations（型付き関係グラフ・ポリモーフィック端点）
-- 既存の直接FK（proof_points.value_proposition_id 等）は残し、本テーブルは「型をまたぐ／FFで表せない関係」を保持する。
-- 端点は (kind, id) のポリモーフィック。FK整合は効かないため存在＋同一company をトリガで検証する。

CREATE TABLE public.element_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN
    ('philosophy_element','value_proposition','proof_point','governance_rule','persona')),
  source_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN
    ('philosophy_element','value_proposition','proof_point','governance_rule','persona')),
  target_id uuid NOT NULL,
  relation_type text NOT NULL CHECK (relation_type IN
    ('guides','evidencedBy','promisedTo','communicatedAs','constrainedBy','conflictsWith')),
  note text,
  sort_order int DEFAULT 0,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- 自己参照禁止
  CONSTRAINT no_self_relation CHECK (NOT (source_kind=target_kind AND source_id=target_id))
);
COMMENT ON TABLE public.element_relations IS
  '理念オントロジーの型付き関係グラフ。端点はポリモーフィック(kind+id)。跨ぐ関係(型をまたぐ/直接FFで表せない関係)を保持。端点存在＆同一companyはトリガ validate_element_relation_endpoints で担保。';

-- 重複関係の禁止
CREATE UNIQUE INDEX uq_element_relation
  ON public.element_relations(company_id, source_kind, source_id, target_kind, target_id, relation_type);
CREATE INDEX idx_er_company ON public.element_relations(company_id);
CREATE INDEX idx_er_source ON public.element_relations(source_kind, source_id);
CREATE INDEX idx_er_target ON public.element_relations(target_kind, target_id);

-- 端点存在＋同一company 検証トリガ。
-- kind→テーブルへ動的に EXISTS。endpoint が company_id を跨ぐ関係も弾く（跨company禁止）。
-- SECURITY DEFINER: 端点テーブルのRLSに依らず実体で存在判定する。search_path 固定。
CREATE OR REPLACE FUNCTION public.validate_element_relation_endpoints()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_table text;
  tgt_table text;
  ok boolean;
BEGIN
  src_table := CASE NEW.source_kind
    WHEN 'philosophy_element' THEN 'philosophy_elements'
    WHEN 'value_proposition'  THEN 'value_propositions'
    WHEN 'proof_point'        THEN 'proof_points'
    WHEN 'governance_rule'    THEN 'governance_rules'
    WHEN 'persona'            THEN 'brand_personas'
  END;
  tgt_table := CASE NEW.target_kind
    WHEN 'philosophy_element' THEN 'philosophy_elements'
    WHEN 'value_proposition'  THEN 'value_propositions'
    WHEN 'proof_point'        THEN 'proof_points'
    WHEN 'governance_rule'    THEN 'governance_rules'
    WHEN 'persona'            THEN 'brand_personas'
  END;

  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1 AND company_id = $2)', src_table)
    INTO ok USING NEW.source_id, NEW.company_id;
  IF NOT ok THEN
    RAISE EXCEPTION 'element_relations: source (% / %) が company % に存在しません', NEW.source_kind, NEW.source_id, NEW.company_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id = $1 AND company_id = $2)', tgt_table)
    INTO ok USING NEW.target_id, NEW.company_id;
  IF NOT ok THEN
    RAISE EXCEPTION 'element_relations: target (% / %) が company % に存在しません', NEW.target_kind, NEW.target_id, NEW.company_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_element_relation_endpoints
  BEFORE INSERT OR UPDATE ON public.element_relations
  FOR EACH ROW EXECUTE FUNCTION public.validate_element_relation_endpoints();

ALTER TABLE public.element_relations ENABLE ROW LEVEL SECURITY;

-- RLS: philosophy_elements と同方針（公開SELECT＋company admin 書込＋superadmin ALL）。
CREATE POLICY element_relations_public_select ON public.element_relations
  FOR SELECT USING (true);

CREATE POLICY element_relations_admin_insert ON public.element_relations
  FOR INSERT WITH CHECK (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );
CREATE POLICY element_relations_admin_update ON public.element_relations
  FOR UPDATE USING (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  ) WITH CHECK (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );
CREATE POLICY element_relations_admin_delete ON public.element_relations
  FOR DELETE USING (
    company_id IN (SELECT admin_users.company_id FROM admin_users WHERE admin_users.auth_id = (select auth.uid()))
  );

CREATE POLICY element_relations_superadmin_all ON public.element_relations
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());

NOTIFY pgrst, 'reload schema';

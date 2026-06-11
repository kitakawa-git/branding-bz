-- ============================================================
-- 幽霊エッジ対策: クリーンアップ＋削除時トリガ（再発防止）
-- ============================================================
-- 背景:
--   element_relations はポリモーフィック端点（kind+id）のため FK CASCADE が効かず、
--   要素削除時に関係が掃除されない構造的な穴がある。登録時の検証トリガ
--   （validate_element_relation_endpoints）はあるが、削除時の連動が無かった。
--
-- クリーンアップ実施記録（2026-06-11 適用時点のバックアップ）:
--   適用前スキャン結果: 幽霊エッジ 0件（全18本・リィツ13本とも端点の存在＋company一致を確認済み）。
--   指示書v1で疑われていたリィツの1本
--     edge_id=35f3c5f4-0464-4d38-a1b7-f4e3ebc5d80b
--     （philosophy_element:b1eb9fe4-f08b-4842-8eb3-b4892f68c013 -guides->
--       value_proposition:21cd8de8-0dd3-4eba-af27-ed3a5a883856「商品：医療現場に貢献」）
--   は、実在する mission 行（company一致・title=null・body にテキスト）を指しており幽霊ではない。
--   よって本マイグレーションの DELETE は 0行（汎用の掃除として冪等に残す）。
--   ※ 削除行が発生した場合に備えたバックアップ欄: （該当なし）

-- ------------------------------------------------------------
-- 1. クリーンアップ（汎用・冪等）: 端点が解決できない関係を削除
--    （存在しない id / company 不一致 / 不正な kind のいずれも対象）
-- ------------------------------------------------------------
DELETE FROM public.element_relations er
WHERE NOT (
  (CASE er.source_kind
    WHEN 'philosophy_element' THEN EXISTS(SELECT 1 FROM public.philosophy_elements t WHERE t.id = er.source_id AND t.company_id = er.company_id)
    WHEN 'value_proposition'  THEN EXISTS(SELECT 1 FROM public.value_propositions t WHERE t.id = er.source_id AND t.company_id = er.company_id)
    WHEN 'proof_point'        THEN EXISTS(SELECT 1 FROM public.proof_points t WHERE t.id = er.source_id AND t.company_id = er.company_id)
    WHEN 'governance_rule'    THEN EXISTS(SELECT 1 FROM public.governance_rules t WHERE t.id = er.source_id AND t.company_id = er.company_id)
    WHEN 'persona'            THEN EXISTS(SELECT 1 FROM public.brand_personas t WHERE t.id = er.source_id AND t.company_id = er.company_id)
    ELSE false END)
  AND
  (CASE er.target_kind
    WHEN 'philosophy_element' THEN EXISTS(SELECT 1 FROM public.philosophy_elements t WHERE t.id = er.target_id AND t.company_id = er.company_id)
    WHEN 'value_proposition'  THEN EXISTS(SELECT 1 FROM public.value_propositions t WHERE t.id = er.target_id AND t.company_id = er.company_id)
    WHEN 'proof_point'        THEN EXISTS(SELECT 1 FROM public.proof_points t WHERE t.id = er.target_id AND t.company_id = er.company_id)
    WHEN 'governance_rule'    THEN EXISTS(SELECT 1 FROM public.governance_rules t WHERE t.id = er.target_id AND t.company_id = er.company_id)
    WHEN 'persona'            THEN EXISTS(SELECT 1 FROM public.brand_personas t WHERE t.id = er.target_id AND t.company_id = er.company_id)
    ELSE false END)
);

-- ------------------------------------------------------------
-- 2. 再発防止: 端点テーブルの AFTER DELETE で関係を掃除する共有トリガ関数
--    SECURITY DEFINER + search_path=public（validate_element_relation_endpoints と同じ流儀）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_element_relations_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  k := CASE TG_TABLE_NAME
    WHEN 'philosophy_elements' THEN 'philosophy_element'
    WHEN 'value_propositions'  THEN 'value_proposition'
    WHEN 'proof_points'        THEN 'proof_point'
    WHEN 'governance_rules'    THEN 'governance_rule'
    WHEN 'brand_personas'      THEN 'persona'
  END;
  IF k IS NULL THEN
    RETURN OLD;
  END IF;
  DELETE FROM public.element_relations
   WHERE (source_kind = k AND source_id = OLD.id)
      OR (target_kind = k AND target_id = OLD.id);
  RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.cleanup_element_relations_on_delete() IS
  '端点要素の削除時に、その要素を端点に持つ element_relations を掃除する（幽霊エッジの再発防止）。AFTER DELETE トリガ専用。';

-- 直接RPC実行は不要のため権限を剥奪（advisor 0028/0029 対策を最初から適用。
-- トリガは EXECUTE 権限が無くても発火する）
REVOKE EXECUTE ON FUNCTION public.cleanup_element_relations_on_delete() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. 5つの端点テーブルへトリガ設置（冪等）
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_cleanup_er_on_philosophy_delete ON public.philosophy_elements;
CREATE TRIGGER trg_cleanup_er_on_philosophy_delete
  AFTER DELETE ON public.philosophy_elements
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_element_relations_on_delete();

DROP TRIGGER IF EXISTS trg_cleanup_er_on_vp_delete ON public.value_propositions;
CREATE TRIGGER trg_cleanup_er_on_vp_delete
  AFTER DELETE ON public.value_propositions
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_element_relations_on_delete();

DROP TRIGGER IF EXISTS trg_cleanup_er_on_proof_delete ON public.proof_points;
CREATE TRIGGER trg_cleanup_er_on_proof_delete
  AFTER DELETE ON public.proof_points
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_element_relations_on_delete();

DROP TRIGGER IF EXISTS trg_cleanup_er_on_rule_delete ON public.governance_rules;
CREATE TRIGGER trg_cleanup_er_on_rule_delete
  AFTER DELETE ON public.governance_rules
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_element_relations_on_delete();

DROP TRIGGER IF EXISTS trg_cleanup_er_on_persona_delete ON public.brand_personas;
CREATE TRIGGER trg_cleanup_er_on_persona_delete
  AFTER DELETE ON public.brand_personas
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_element_relations_on_delete();

NOTIFY pgrst, 'reload schema';

-- brand_personality_tag_mappings に SELECT ポリシーを追加
-- 背景: RLS有効・ポリシー0で誰も SELECT できず、ポータル /portal/verbal の
--   期待印象タグ表示が空になっていた。
-- 対応: brand_terms / brand_personalities などと同じ「自社の admin_users または members が読める」
--   標準パターンで SELECT ポリシーを付与。
CREATE POLICY brand_personality_tag_mappings_select
ON public.brand_personality_tag_mappings
FOR SELECT
USING (
  company_id IN (
    SELECT admin_users.company_id
    FROM admin_users
    WHERE admin_users.auth_id = (SELECT auth.uid())
    UNION
    SELECT members.company_id
    FROM members
    WHERE members.auth_id = (SELECT auth.uid())
  )
);

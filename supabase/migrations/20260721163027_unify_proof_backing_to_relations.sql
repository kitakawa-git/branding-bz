-- 「実績の裏づけ」の正を element_relations（evidencedBy）に一本化する。
-- これまで proof_points.value_proposition_id（FK・1:N）と evidencedBy 辺（多対多）の
-- 二重表現で、消費側すべてが union する必要があった（正が2つある状態）。
-- FK の中身を辺へ移行し、FK は空にする（列は当面残す＝旧コードが読んでも壊れない。
-- コードのデプロイ後、期間をおいて DROP する）。

-- 1) FK → evidencedBy 辺（既に同じ辺があればスキップ）
insert into public.element_relations
  (company_id, source_kind, source_id, target_kind, target_id, relation_type, note, sort_order, source)
select
  pp.company_id,
  'value_proposition', pp.value_proposition_id,
  'proof_point', pp.id,
  'evidencedBy',
  '実績作成時の裏づけ指定（旧・直接ひも付けからの移行）',
  coalesce((select max(er.sort_order) from public.element_relations er where er.company_id = pp.company_id), -1)
    + row_number() over (partition by pp.company_id order by pp.sort_order),
  'manual'
from public.proof_points pp
where pp.value_proposition_id is not null
on conflict (company_id, source_kind, source_id, target_kind, target_id, relation_type) do nothing;

-- 2) FK を空にする（正は辺に一本化）
update public.proof_points
set value_proposition_id = null
where value_proposition_id is not null;

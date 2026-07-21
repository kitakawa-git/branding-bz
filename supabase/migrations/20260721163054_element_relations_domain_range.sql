-- 関係種別ごとの端点の型（ドメイン/レンジ）をDBで強制する。
-- これまで CHECK は「kind が6種のどれか」「type が10種のどれか」を別々に見るだけで、
-- 組み合わせ（例: ペルソナ -evidencedBy-> 表現ルール）は何でも通った。
-- 意味定義はプロンプト内の日本語にしかなく、データが綺麗なのは承認者の良識頼みだった。
-- コード側の正は lib/brand/elements-catalog.ts の RELATION_RULES（このトリガと同内容を保つこと）。
--
-- communicatedAs は許可表に載せない＝新規作成不可（廃止）。
-- 現在の要素6種に「表現物」にあたる種が存在せず、レンジを定義できないため。
-- 既存行は0件。復活させる場合は表現物の kind を設計してから。

create or replace function public.validate_element_relation_semantics()
returns trigger
language plpgsql
as $$
begin
  if not (
    -- 理念が方向づける（理念どうし・提供価値へ）
    (new.relation_type = 'guides'
      and new.source_kind = 'philosophy_element'
      and new.target_kind in ('philosophy_element', 'value_proposition'))
    -- 約束・理念が実績に裏づけられる
    or (new.relation_type = 'evidencedBy'
      and new.source_kind in ('philosophy_element', 'value_proposition')
      and new.target_kind = 'proof_point')
    -- 約束の相手（ペルソナ）
    or (new.relation_type = 'promisedTo'
      and new.source_kind in ('philosophy_element', 'value_proposition')
      and new.target_kind = 'persona')
    -- 表現ルールによる制約
    or (new.relation_type = 'constrainedBy'
      and new.source_kind in ('philosophy_element', 'value_proposition')
      and new.target_kind = 'governance_rule')
    -- 矛盾しうる組（対称）
    or (new.relation_type = 'conflictsWith'
      and new.source_kind in ('philosophy_element', 'value_proposition', 'governance_rule')
      and new.target_kind in ('philosophy_element', 'value_proposition', 'governance_rule'))
    -- 未来設計: 現在の約束が理想を目指す
    or (new.relation_type = 'aspiresTo'
      and new.source_kind = 'value_proposition'
      and new.target_kind = 'philosophy_element')
    -- 未来設計: 理想の実現に獲得目標が必要
    or (new.relation_type = 'requires'
      and new.source_kind = 'philosophy_element'
      and new.target_kind = 'desired_evidence')
    -- 未来設計: 未来の約束は獲得目標で裏づく予定
    or (new.relation_type = 'toBeEvidencedBy'
      and new.source_kind = 'value_proposition'
      and new.target_kind = 'desired_evidence')
    -- 未来設計: 実績が獲得目標の達成を立証する
    or (new.relation_type = 'verifies'
      and new.source_kind = 'proof_point'
      and new.target_kind = 'desired_evidence')
  ) then
    raise exception '関係「%」に 種別 % -> % の組み合わせは使えません（ドメイン/レンジ違反）',
      new.relation_type, new.source_kind, new.target_kind;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_element_relation_semantics on public.element_relations;
create trigger trg_validate_element_relation_semantics
  before insert or update on public.element_relations
  for each row execute function public.validate_element_relation_semantics();

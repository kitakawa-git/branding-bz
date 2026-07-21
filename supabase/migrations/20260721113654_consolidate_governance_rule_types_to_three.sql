-- 表現ルールの区分を5→3に統合する。
--   banned_word（禁止ワード：使ってはいけない語そのもの）
--   tone_rule（トーンルール：話し方・語り口。ポータルに表示されるのはこれだけ）
--   compliance_rule（コンプラルール：法令や自社方針として根拠なく言い切ってはいけないこと）
-- 廃止:
--   claim_rule … 中身が compliance_rule と重複していたため統合（既存4件を移行）
--   discouraged_expression … 0件かつAI分類のフォールバック先だった（名前と役割が噛み合っていない）
-- ※順序が重要：先にデータを移してから制約を締める（逆にすると既存行が制約違反になる）。
-- ※本番適用済み（version 20260721113654）。ここは適用済みSQLの記録。

update public.governance_rules
set rule_type = 'compliance_rule', updated_at = now()
where rule_type in ('claim_rule', 'discouraged_expression');

alter table public.governance_rules
  drop constraint if exists governance_rules_rule_type_check;

alter table public.governance_rules
  add constraint governance_rules_rule_type_check
  check (rule_type = any (array['banned_word'::text, 'tone_rule'::text, 'compliance_rule'::text]));

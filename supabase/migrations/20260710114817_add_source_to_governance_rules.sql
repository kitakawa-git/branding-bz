-- governance_rules に source カラムを追加し、personality診断連携で入ったルールを識別可能にする
-- 背景: 診断ツール /tools/personality の連携で tone_rules が INSERT されるが、
--   AI出力が毎回微妙に異なる rule_text を返すため「同一rule_textスキップ」では重複が防げず、
--   ID INC.（6/11に3本 + 7/10に3本 = 6本重複）のような蓄積が発生していた。
-- 対応: source ('personality_diagnosis' | 'manual') を持たせ、connect時は
--   自社の source='personality_diagnosis' を全削除→新規INSERT（置換）とする。
--   手動追加（tone-rules API・superadminエディタ）は source='manual' で残す。

-- 1. カラム追加（デフォルト 'manual'。DBチェックで許可値も強制）
ALTER TABLE public.governance_rules
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'personality_diagnosis'));

-- 2. 既存の tone_rule を personality診断連携由来として更新する対象:
--    personality の完了/進行中セッションが存在する企業の tone_rule。
--    現状これに該当するのは ID INC.（6本）と テックブリッジ（3本）。
--    これらの会社では 表現ルールを手動編集した実績がないため、safely 一律で
--    personality_diagnosis に切替可能。
UPDATE public.governance_rules gr
SET source = 'personality_diagnosis'
WHERE gr.rule_type = 'tone_rule'
  AND EXISTS (
    SELECT 1 FROM mini_app_sessions s
    WHERE s.company_id = gr.company_id
      AND s.app_type = 'personality'
  );

NOTIFY pgrst, 'reload schema';

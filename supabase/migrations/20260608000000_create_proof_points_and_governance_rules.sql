-- ============================================================
-- ブランドオントロジー Step 0:
--   proof_points（証拠・実績）／ governance_rules（表現ルール・禁則）
-- ============================================================
-- 背景:
--   AIによるコピー生成・草案提案が「言葉の平均値」に陥るのを防ぐため、企業ごとの
--   「証拠（ProofPoint）」と「表現ルール（GovernanceRule）」を構造化して保持し、
--   生成プロンプトに参照させる。
--   設計経緯: 260608_ブランドオントロジー_ノード採用表_v1.md（案A・最小実装）。
--
-- 案A（最小実装）の方針:
--   - FK は value_propositions のみに張る（jsonb内のValueへの接続はStep 1）。
--   - brand_elements / element_relations は作らない（Step 1）。
--   - 既存jsonb（brand_guidelines.values / action_guidelines / business_content）には触らない。
--
-- RLS方針（重要）:
--   既存の brand_terms / brand_personas と同じスコープ方式を踏襲する。
--   - 読み取り: 自社 company_id のメンバー（admin_users ∪ members）
--   - 書き込み: 当面はスーパー管理者（admin_users.is_superadmin = true）ロールのみ。
--     ※ ハードコードでID社限定にせず is_superadmin ロールで判定。
--       将来クライアント管理者へ開放する場合は company 単位の admin ALL ポリシーを追加するだけ。
--   auth.uid() は initplan 最適化のため必ず (select auth.uid()) でラップする。
--
-- 適用後の注意:
--   末尾の NOTIFY pgrst, 'reload schema'; で PostgREST スキーマキャッシュを再読込
--   （新規テーブルがキャッシュに乗らず PGRST204 になる既知の罠を回避）。
-- ============================================================

-- ------------------------------------------------------------
-- 証拠・実績
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proof_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  value_proposition_id uuid REFERENCES public.value_propositions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  source_type text CHECK (source_type IN ('jisseki','jirei','data','voice','award','other')),
  source_url text,
  evidence_date date,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.proof_points IS
  '提供価値を裏づける証拠・実績・具体例。value_proposition_idで「どの約束の証拠か」を指す。AI生成時に参照し抽象語への逃げを防ぐ。';

-- ------------------------------------------------------------
-- 表現ルール・禁則
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN
    ('banned_word','discouraged_expression','tone_rule','claim_rule','compliance_rule')),
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN
    ('global','claim','benefit','audience','service','action_guideline')),
  target_value_proposition_id uuid REFERENCES public.value_propositions(id) ON DELETE SET NULL,
  rule_text text NOT NULL,
  ng_example text,
  ok_example text,
  severity text DEFAULT 'warn' CHECK (severity IN ('info','warn','block')),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.governance_rules IS
  'ブランドの表現ルール・禁則。NGワード集ではなくルール（トーン・主張・コンプラ）も持つ。brand_termsは単語レベルの推奨/回避用語として存続し、本テーブルはルールレベルを担当。';

-- ------------------------------------------------------------
-- インデックス（全FKに付与 = unindexed_fk=0 の不変条件を維持）
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_proof_points_company ON public.proof_points(company_id);
CREATE INDEX IF NOT EXISTS idx_proof_points_vp ON public.proof_points(value_proposition_id);
CREATE INDEX IF NOT EXISTS idx_governance_rules_company ON public.governance_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_governance_rules_target_vp ON public.governance_rules(target_value_proposition_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.proof_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_rules ENABLE ROW LEVEL SECURITY;

-- proof_points: 読み取り = 自社メンバー
CREATE POLICY proof_points_select ON public.proof_points
  FOR SELECT
  USING (
    company_id IN (
      SELECT admin_users.company_id FROM admin_users
        WHERE admin_users.auth_id = (select auth.uid())
      UNION
      SELECT members.company_id FROM members
        WHERE members.auth_id = (select auth.uid())
    )
  );

-- proof_points: 書き込み（＋全社横断の読み）= スーパー管理者ロール
CREATE POLICY proof_points_superadmin_all ON public.proof_points
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = (select auth.uid())
        AND admin_users.is_superadmin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = (select auth.uid())
        AND admin_users.is_superadmin = true
    )
  );

-- governance_rules: 読み取り = 自社メンバー
CREATE POLICY governance_rules_select ON public.governance_rules
  FOR SELECT
  USING (
    company_id IN (
      SELECT admin_users.company_id FROM admin_users
        WHERE admin_users.auth_id = (select auth.uid())
      UNION
      SELECT members.company_id FROM members
        WHERE members.auth_id = (select auth.uid())
    )
  );

-- governance_rules: 書き込み（＋全社横断の読み）= スーパー管理者ロール
CREATE POLICY governance_rules_superadmin_all ON public.governance_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = (select auth.uid())
        AND admin_users.is_superadmin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = (select auth.uid())
        AND admin_users.is_superadmin = true
    )
  );

-- PostgREST スキーマキャッシュ再読込（PGRST204 回避）
NOTIFY pgrst, 'reload schema';

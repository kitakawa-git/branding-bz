-- ============================================================
-- コピーAI クリエイティブ・パイプライン スキーマ Stage 1
-- 5新規テーブル / RLS superadmin_all + member_select(子はproject経由) / FK索引
-- ============================================================

-- 1. プロジェクト
CREATE TABLE public.copy_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  persona_id  uuid REFERENCES public.brand_personas(id) ON DELETE SET NULL,
  name        text NOT NULL,
  brief       text,
  status      text NOT NULL DEFAULT 'diagnosing'
              CHECK (status IN ('diagnosing','insight','angle','drafting','reviewing','done')),
  created_by  uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
COMMENT ON TABLE public.copy_projects IS 'コピーAI: 生成の単位（1案件=1ペルソナ×1ブリーフ）';

-- 2. インサイト候補（Stage2出力・人間ゲートで is_selected）
CREATE TABLE public.copy_insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.copy_projects(id) ON DELETE CASCADE,
  body        text NOT NULL,
  psych_type  text NOT NULL
              CHECK (psych_type IN ('hidden_anxiety','vanity','self_image','social_fear','aspiration','frustration')),
  rationale   text NOT NULL,
  source_ref  jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 接地元: { kind:'pain_point'|'micro_feedback'|'survey', ref:'...原文/ID' }
  is_selected boolean NOT NULL DEFAULT false,
  selected_by uuid,
  created_at  timestamptz DEFAULT now()
);
COMMENT ON TABLE public.copy_insights IS 'コピーAI: 隠れた本音の候補。source_refで既存データへ接地（捏造防止）';

-- 3. 切り口候補（Stage3出力・Stage4で is_selected）
CREATE TABLE public.copy_angles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.copy_projects(id) ON DELETE CASCADE,
  insight_id  uuid NOT NULL REFERENCES public.copy_insights(id) ON DELETE CASCADE,
  angle_type  text NOT NULL
              CHECK (angle_type IN ('contrarian','identity_first','villain_first','reframe','secret')),
  stance      text NOT NULL,
  premise     text,
  is_selected boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);
COMMENT ON TABLE public.copy_angles IS 'コピーAI: 切り口（態度表明）。insightに紐づく';

-- 4. ドラフト（Stage5生成＋Stage7リライト。parent_draft_id でリライト系譜）
CREATE TABLE public.copy_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES public.copy_projects(id) ON DELETE CASCADE,
  angle_id        uuid REFERENCES public.copy_angles(id) ON DELETE SET NULL,
  parent_draft_id uuid REFERENCES public.copy_drafts(id) ON DELETE SET NULL,
  copy_role       text NOT NULL
                  CHECK (copy_role IN ('hero_h1','section_heading','body_copy','cta','form_microcopy')),
  register        text NOT NULL DEFAULT 'neutral'
                  CHECK (register IN ('casual','neutral','formal','reverent')),
  body            text NOT NULL,
  generation_meta jsonb NOT NULL DEFAULT '{}'::jsonb,  -- 注入したproof_point_id配列/診断snapshot/モデル名/版
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','reviewed','approved','discarded')),
  created_at      timestamptz DEFAULT now()
);
COMMENT ON TABLE public.copy_drafts IS 'コピーAI: 生成本文。parent_draft_idでリライト系譜・generation_metaで根拠を遡れる';

-- 5. 品質レビュー（Stage6。craft_scoreはコード合成値）
CREATE TABLE public.copy_quality_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        uuid NOT NULL REFERENCES public.copy_drafts(id) ON DELETE CASCADE,
  craft_score     int  NOT NULL,
  brand_fit_score int  NOT NULL,
  axis_scores     jsonb NOT NULL,   -- { tension, stance, differentiation, specificity, cliche_density, inheritance_overlap }
  red_flag        boolean NOT NULL DEFAULT false,
  critique        text,
  suggestions     jsonb,            -- surgical_edits 等の処方箋（リライト本文は持たない＝原則②）
  reviewer_model  text,
  created_at      timestamptz DEFAULT now()
);
COMMENT ON TABLE public.copy_quality_reviews IS 'コピーAI: 批評。craft_scoreはTS合成・赤旗で自動リライト送還';

-- FK 索引（unindexed_fk=0 方針を維持）
CREATE INDEX idx_copy_projects_company  ON public.copy_projects(company_id);
CREATE INDEX idx_copy_projects_persona  ON public.copy_projects(persona_id);
CREATE INDEX idx_copy_insights_project  ON public.copy_insights(project_id);
CREATE INDEX idx_copy_angles_project    ON public.copy_angles(project_id);
CREATE INDEX idx_copy_angles_insight    ON public.copy_angles(insight_id);
CREATE INDEX idx_copy_drafts_project    ON public.copy_drafts(project_id);
CREATE INDEX idx_copy_drafts_angle      ON public.copy_drafts(angle_id);
CREATE INDEX idx_copy_drafts_parent     ON public.copy_drafts(parent_draft_id);
CREATE INDEX idx_copy_reviews_draft     ON public.copy_quality_reviews(draft_id);

-- RLS 有効化
ALTER TABLE public.copy_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_insights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_angles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_drafts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copy_quality_reviews ENABLE ROW LEVEL SECURITY;

-- 親: copy_projects（superadmin全権 + 自社memberは閲覧のみ）
CREATE POLICY copy_projects_superadmin_all ON public.copy_projects
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());
CREATE POLICY copy_projects_member_select ON public.copy_projects
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM admin_users WHERE auth_id = (select auth.uid()))
  );

-- 子4テーブル: superadmin全権 + member_select は project 経由で company 判定
-- copy_insights
CREATE POLICY copy_insights_superadmin_all ON public.copy_insights
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());
CREATE POLICY copy_insights_member_select ON public.copy_insights
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.copy_projects p
      WHERE p.company_id IN (SELECT company_id FROM admin_users WHERE auth_id = (select auth.uid()))
    )
  );
-- copy_angles
CREATE POLICY copy_angles_superadmin_all ON public.copy_angles
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());
CREATE POLICY copy_angles_member_select ON public.copy_angles
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.copy_projects p
      WHERE p.company_id IN (SELECT company_id FROM admin_users WHERE auth_id = (select auth.uid()))
    )
  );
-- copy_drafts
CREATE POLICY copy_drafts_superadmin_all ON public.copy_drafts
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());
CREATE POLICY copy_drafts_member_select ON public.copy_drafts
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM public.copy_projects p
      WHERE p.company_id IN (SELECT company_id FROM admin_users WHERE auth_id = (select auth.uid()))
    )
  );
-- copy_quality_reviews（draft → project → company）
CREATE POLICY copy_reviews_superadmin_all ON public.copy_quality_reviews
  FOR ALL USING (public.is_current_user_superadmin())
  WITH CHECK (public.is_current_user_superadmin());
CREATE POLICY copy_reviews_member_select ON public.copy_quality_reviews
  FOR SELECT USING (
    draft_id IN (
      SELECT d.id FROM public.copy_drafts d
      JOIN public.copy_projects p ON p.id = d.project_id
      WHERE p.company_id IN (SELECT company_id FROM admin_users WHERE auth_id = (select auth.uid()))
    )
  );

NOTIFY pgrst, 'reload schema';

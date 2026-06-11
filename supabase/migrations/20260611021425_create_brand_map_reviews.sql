-- ============================================================
-- ブランドマップ AIレビューの永続化: brand_map_reviews
-- ============================================================
-- 1社1行（company_id unique）。保存済みがあればページ読込時に固定表示（AI呼び出しなし）、
-- 無ければ初回表示時に自動生成して保存。再生成はボタン押下時のみ上書き。
-- facts_snapshot は生成時点のグラフ事実（関係数・要素数・島数など）。現在の事実と比較して
-- 鮮度ヒント（「データが更新されています」）の表示に使う。
-- RLS は profiling_acknowledgments と同型の superadmin_all のみ（社内運用・書込みはAPI経由）。
CREATE TABLE IF NOT EXISTS public.brand_map_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  review_text text NOT NULL,
  facts_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.brand_map_reviews IS
  'ブランドマップのAIレビュー保存（1社1行）。facts_snapshotは生成時のグラフ事実で、現在値との差分で鮮度ヒントを出す。';

ALTER TABLE public.brand_map_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_map_reviews_superadmin_all ON public.brand_map_reviews
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

NOTIFY pgrst, 'reload schema';

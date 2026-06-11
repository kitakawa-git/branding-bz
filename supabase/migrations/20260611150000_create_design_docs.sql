-- ============================================================
-- design_docs: デザインシステム画面の手書きメモ（design.md の自由記述部分）
-- scope（website/service）別に1行。自動生成サマリーと結合して design.md を構成する。
-- 管理メモなので RLS は superadmin のみ（公開不要）。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.design_docs (
  scope       TEXT PRIMARY KEY CHECK (scope IN ('website', 'service')),
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ,
  updated_by  UUID
);

ALTER TABLE public.design_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY design_docs_superadmin_all ON public.design_docs
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

INSERT INTO public.design_docs (scope, body) VALUES
  ('website', ''),
  ('service', '')
ON CONFLICT (scope) DO NOTHING;

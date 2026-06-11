-- ============================================================
-- プロファイリングの「保留」永続化: profiling_acknowledgments
-- ============================================================
-- 「まだ無い」「わからない」の回答を保留として記録する。
-- - target_ref は 'value_proposition:<uuid>' 形式（質問の対象検出を指す）。
-- - 検出が解消（実績登録）されたらUI側が該当行を削除する。残っていても
--   ロジック上は「現存する検出」とのAND評価のため無害。
-- - RLS: 社内（superadmin）運用のみのメタデータのため superadmin_all のみ。
--   将来クライアント開放時に member select を追加する。
CREATE TABLE IF NOT EXISTS public.profiling_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_ref text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, target_ref)
);
COMMENT ON TABLE public.profiling_acknowledgments IS
  'プロファイリング質問の保留記録（まだ無い/わからない）。質問生成のデフォルト除外とウィザード完了判定（解消済み∪保留済みで全件カバー）に使う。';

CREATE INDEX IF NOT EXISTS idx_profiling_acks_company ON public.profiling_acknowledgments(company_id);

ALTER TABLE public.profiling_acknowledgments ENABLE ROW LEVEL SECURITY;

-- 書き込み・読み取りとも スーパー管理者ロールのみ（proof_points_superadmin_all と同型）
CREATE POLICY profiling_acknowledgments_superadmin_all ON public.profiling_acknowledgments
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

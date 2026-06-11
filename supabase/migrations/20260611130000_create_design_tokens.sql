-- ============================================================
-- デザイントークン管理（公開LP用）
--
-- design_tokens: 公開LP（マーケティングページ）の CSS 変数を DB 管理する。
--   app/layout.tsx が getDesignTokensCss() で :root を生成し
--   <style id="design-tokens"> として注入 → globals.css の静的値を上書き。
-- design_token_history: UPDATE トリガーで自動記録される変更履歴（ロールバック用）。
--
-- 設計判断:
-- - 名前空間は --ds-* のみ。shadcn の HSL 変数（--background 等）や --lp-* には触れない
-- - テナント非依存（branding.bz 自体のLPなので company_id を持たない）
-- - 読み取りは公開（LP の SSR が anon キーで読む）、書き込みはスーパー管理者のみ
-- ============================================================

CREATE TABLE IF NOT EXISTS public.design_tokens (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category        TEXT NOT NULL CHECK (category IN ('text', 'bg', 'border', 'accent', 'shadow')),
  token_name      TEXT NOT NULL UNIQUE,  -- CSS変数名（例: --ds-text-strong）
  value           TEXT NOT NULL,         -- 現在値
  default_value   TEXT NOT NULL,         -- 初期値（リセット用）
  label           TEXT,                  -- 日本語ラベル
  description     TEXT,                  -- 用途説明
  sort_order      INT DEFAULT 0,
  updated_at      TIMESTAMPTZ,
  updated_by      UUID
);
CREATE INDEX IF NOT EXISTS idx_design_tokens_category ON public.design_tokens(category, sort_order);

CREATE TABLE IF NOT EXISTS public.design_token_history (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_id        TEXT REFERENCES public.design_tokens(id),
  token_name      TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  changed_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_design_token_history_token_id ON public.design_token_history(token_id);
CREATE INDEX IF NOT EXISTS idx_design_token_history_changed_at ON public.design_token_history(changed_at DESC);

-- ------------------------------------------------------------
-- 履歴自動記録トリガー
-- RLS（履歴テーブルは superadmin のみ）を越えて書き込むため SECURITY DEFINER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_design_token_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.design_token_history (token_id, token_name, old_value, new_value)
    VALUES (OLD.id, NEW.token_name, OLD.value, NEW.value);
  END IF;
  RETURN NEW;
END;
$$;

-- トリガー関数は直接呼び出し不要（admin_users RLS 是正時と同じ方針で EXECUTE を絞る）
REVOKE EXECUTE ON FUNCTION public.record_design_token_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_design_tokens_history ON public.design_tokens;
CREATE TRIGGER trg_design_tokens_history
  AFTER UPDATE OF value ON public.design_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.record_design_token_change();

-- ------------------------------------------------------------
-- RLS（proof_points の superadmin_all パターンを踏襲）
-- ------------------------------------------------------------
ALTER TABLE public.design_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_token_history ENABLE ROW LEVEL SECURITY;

-- トークン読み取り: 公開（LP の SSR が anon キーで読むため）
CREATE POLICY design_tokens_select ON public.design_tokens
  FOR SELECT
  USING (true);

-- トークン書き込み: スーパー管理者のみ
CREATE POLICY design_tokens_superadmin_all ON public.design_tokens
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

-- 履歴: スーパー管理者のみ閲覧（INSERT は SECURITY DEFINER トリガー経由のみ）
CREATE POLICY design_token_history_superadmin_select ON public.design_token_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.auth_id = (select auth.uid())
        AND admin_users.is_superadmin = true
    )
  );

-- ------------------------------------------------------------
-- 初期トークン（branding.bz LP の現行デザインから抽出）
-- 出典: app/(marketing)/page.tsx ＋ components/Header.tsx / Footer.tsx
-- ------------------------------------------------------------
INSERT INTO public.design_tokens (id, category, token_name, value, default_value, label, description, sort_order) VALUES
  -- text
  ('ds-text-strong',       'text',   '--ds-text-strong',       '#111827', '#111827', '見出し・強調', 'LP見出し（h1/h2/h3）と強調文。旧 text-gray-900', 10),
  ('ds-text-body',         'text',   '--ds-text-body',         '#374151', '#374151', 'リード文', 'ヒーロー・CTAのリード段落。旧 text-gray-700', 20),
  ('ds-text-muted',        'text',   '--ds-text-muted',        '#4b5563', '#4b5563', '本文', 'カード説明文・About本文。旧 text-gray-600', 30),
  ('ds-text-meta',         'text',   '--ds-text-meta',         '#6b7280', '#6b7280', '補足テキスト', 'セクションのサブテキスト。旧 text-gray-500', 40),
  ('ds-text-inverse',      'text',   '--ds-text-inverse',      '#ffffff', '#ffffff', '反転テキスト', '黒CTAボタン上の白文字', 50),
  -- bg
  ('ds-bg-base',           'bg',     '--ds-bg-base',           '#ffffff', '#ffffff', 'ベース背景', '機能紹介セクション等の白背景', 10),
  ('ds-bg-section',        'bg',     '--ds-bg-section',        '#f9fafb', '#f9fafb', 'セクション背景', 'About等の薄グレー背景。旧 bg-gray-50', 20),
  ('ds-bg-media',          'bg',     '--ds-bg-media',          '#f3f4f6', '#f3f4f6', 'メディア枠背景', '機能GIFの枠背景。旧 bg-gray-100', 30),
  ('ds-bg-glass',          'bg',     '--ds-bg-glass',          'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.12)', 'グラスカード背景', '3レイヤー・機能紹介カードの半透明背景', 40),
  ('ds-bg-cta-primary',    'bg',     '--ds-bg-cta-primary',    'rgba(0, 0, 0, 0.75)', 'rgba(0, 0, 0, 0.75)', '主要CTA背景', '「無料で始める」等の黒ピルボタン', 50),
  ('ds-bg-cta-secondary',  'bg',     '--ds-bg-cta-secondary',  'rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.25)', '副次CTA背景', '「料金を見る」等の白グラスピルボタン', 60),
  ('ds-bg-badge',          'bg',     '--ds-bg-badge',          'rgba(0, 97, 255, 0.1)', 'rgba(0, 97, 255, 0.1)', 'バッジ背景', '「AIガイドで約5〜10分」等の青グラスバッジ', 70),
  -- border
  ('ds-border-glass',      'border', '--ds-border-glass',      'rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.25)', 'グラス枠線', 'グラスカードの枠線', 10),
  ('ds-border-glass-strong', 'border', '--ds-border-glass-strong', 'rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.4)', 'グラス枠線（強）', '副次CTAボタンの枠線', 20),
  -- accent
  ('ds-accent-primary',    'accent', '--ds-accent-primary',    '#1d4ed8', '#1d4ed8', 'アクセント（青）', 'バッジ文字色。旧 text-blue-700', 10),
  -- shadow
  ('ds-shadow-glass',      'shadow', '--ds-shadow-glass',      '0px 8px 24px 0 rgba(12, 74, 110, 0.12)', '0px 8px 24px 0 rgba(12, 74, 110, 0.12)', 'グラスカード影', 'グラスカードのドロップシャドウ', 10)
ON CONFLICT (id) DO NOTHING;

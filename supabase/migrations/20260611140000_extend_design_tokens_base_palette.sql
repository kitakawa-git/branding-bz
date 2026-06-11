-- ============================================================
-- デザイントークン拡張: shadcn 基盤変数（HSL成分）＋アプリ青アクセント
--
-- 目的: パレットでサービス全体の色を制御する（基盤色まで）。
-- 前提: ダーク非運用 → :root(ライト)値のみDB管理。値=現行 globals.css リテラル
--       のコピーなので、注入後も見た目は不変（トークン化＝同値をDB経由にするだけ）。
-- shadcn変数は HSL成分形式（"0 0% 9%"）。getDesignTokensCss が透過出力し
-- tailwind の hsl(var(--x)) が解決する。hsl() ラップはしない（二重ラップ防止）。
-- ============================================================

-- category 拡張
ALTER TABLE public.design_tokens DROP CONSTRAINT design_tokens_category_check;
ALTER TABLE public.design_tokens ADD CONSTRAINT design_tokens_category_check
  CHECK (category IN ('text','bg','border','accent','shadow','base','sidebar','chart','radius','app'));

-- base: shadcn 基盤色（HSL成分・globals.css :root の現行値）
INSERT INTO public.design_tokens (id, category, token_name, value, default_value, label, description, sort_order) VALUES
  ('base-background',            'base', '--background',            '0 0% 100%',   '0 0% 100%',   '背景', 'アプリUI全体のベース背景', 100),
  ('base-foreground',           'base', '--foreground',            '0 0% 3.9%',   '0 0% 3.9%',   '前景（文字）', 'アプリUI全体の基本文字色', 102),
  ('base-card',                 'base', '--card',                  '0 0% 100%',   '0 0% 100%',   'カード背景', '', 104),
  ('base-card-foreground',      'base', '--card-foreground',       '0 0% 3.9%',   '0 0% 3.9%',   'カード文字', '', 106),
  ('base-popover',              'base', '--popover',               '0 0% 100%',   '0 0% 100%',   'ポップオーバー背景', '', 108),
  ('base-popover-foreground',   'base', '--popover-foreground',    '0 0% 3.9%',   '0 0% 3.9%',   'ポップオーバー文字', '', 110),
  ('base-primary',              'base', '--primary',               '0 0% 9%',     '0 0% 9%',     'プライマリ', '主要ボタン等の基調色（黒系）', 112),
  ('base-primary-foreground',   'base', '--primary-foreground',    '0 0% 98%',    '0 0% 98%',    'プライマリ文字', '', 114),
  ('base-secondary',            'base', '--secondary',             '0 0% 96.1%',  '0 0% 96.1%',  'セカンダリ背景', '', 116),
  ('base-secondary-foreground', 'base', '--secondary-foreground',  '0 0% 9%',     '0 0% 9%',     'セカンダリ文字', '', 118),
  ('base-muted',                'base', '--muted',                 '0 0% 96.1%',  '0 0% 96.1%',  'ミュート背景', '', 120),
  ('base-muted-foreground',     'base', '--muted-foreground',      '0 0% 40%',    '0 0% 40%',    'ミュート文字', '補助テキスト（WCAG AA確保のため濃色化済み）', 122),
  ('base-accent',               'base', '--accent',                '0 0% 96.1%',  '0 0% 96.1%',  'アクセント背景', 'ホバー等の薄い強調背景', 124),
  ('base-accent-foreground',    'base', '--accent-foreground',     '0 0% 9%',     '0 0% 9%',     'アクセント文字', '', 126),
  ('base-destructive',          'base', '--destructive',           '0 84.2% 60.2%', '0 84.2% 60.2%', '破壊的操作', '削除等の警告色（赤）', 128),
  ('base-destructive-foreground','base','--destructive-foreground','0 0% 98%',    '0 0% 98%',    '破壊的操作文字', '', 130),
  ('base-border',               'base', '--border',                '0 0% 89.8%',  '0 0% 89.8%',  'ボーダー', '罫線・区切り線', 132),
  ('base-input',                'base', '--input',                 '0 0% 89.8%',  '0 0% 89.8%',  '入力枠', 'フォーム入力の枠線', 134),
  ('base-ring',                 'base', '--ring',                  '0 0% 3.9%',   '0 0% 3.9%',   'フォーカスリング', '', 136),
  -- sidebar: 管理画面サイドバー（:root 暗色側）
  ('sidebar-background',          'sidebar', '--sidebar-background',          '220 13% 18%',      '220 13% 18%',      'サイドバー背景', '管理画面サイドバー（暗）', 200),
  ('sidebar-foreground',          'sidebar', '--sidebar-foreground',          '216 12% 84%',      '216 12% 84%',      'サイドバー文字', '', 202),
  ('sidebar-primary',             'sidebar', '--sidebar-primary',             '0 0% 100%',        '0 0% 100%',        'サイドバー強調', 'アクティブ項目の背景', 204),
  ('sidebar-primary-foreground',  'sidebar', '--sidebar-primary-foreground',  '220 13% 18%',      '220 13% 18%',      'サイドバー強調文字', '', 206),
  ('sidebar-accent',              'sidebar', '--sidebar-accent',              '218 14% 26%',      '218 14% 26%',      'サイドバーホバー背景', '', 208),
  ('sidebar-accent-foreground',   'sidebar', '--sidebar-accent-foreground',   '0 0% 100%',        '0 0% 100%',        'サイドバーホバー文字', '', 210),
  ('sidebar-border',              'sidebar', '--sidebar-border',              '218 14% 26%',      '218 14% 26%',      'サイドバー罫線', '', 212),
  ('sidebar-ring',                'sidebar', '--sidebar-ring',                '217.2 91.2% 59.8%','217.2 91.2% 59.8%','サイドバーフォーカス', '', 214),
  -- chart: グラフ配色
  ('chart-1', 'chart', '--chart-1', '12 76% 61%',  '12 76% 61%',  'グラフ色1', '', 300),
  ('chart-2', 'chart', '--chart-2', '173 58% 39%', '173 58% 39%', 'グラフ色2', '', 302),
  ('chart-3', 'chart', '--chart-3', '197 37% 24%', '197 37% 24%', 'グラフ色3', '', 304),
  ('chart-4', 'chart', '--chart-4', '43 74% 66%',  '43 74% 66%',  'グラフ色4', '', 306),
  ('chart-5', 'chart', '--chart-5', '27 87% 67%',  '27 87% 67%',  'グラフ色5', '', 308),
  -- radius
  ('radius-base', 'radius', '--radius', '0.5rem', '0.5rem', '角丸', 'ボタン・カード等の標準角丸', 400),
  -- app: アプリ青アクセント（hex・新トークン。ハードコード青の寄せ先）
  ('ds-app-accent',       'app', '--ds-app-accent',       '#2563eb', '#2563eb', 'アプリ青アクセント', 'リンク・選択状態・チャート青・ステップバー。旧 blue-600/#2563eb', 510),
  ('ds-app-accent-hover', 'app', '--ds-app-accent-hover', '#1d4ed8', '#1d4ed8', 'アプリ青（hover）', 'hover/濃い青文字。旧 blue-700/#1d4ed8', 520),
  ('ds-app-accent-soft',  'app', '--ds-app-accent-soft',  '#3b82f6', '#3b82f6', 'アプリ青（淡）', 'チャート副線。旧 #3b82f6/blue-500', 530)
ON CONFLICT (id) DO NOTHING;

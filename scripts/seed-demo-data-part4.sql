-- ============================================
-- Part 4: ペルソナ拡充（ターゲット詳細 + ポジショニングマップ）
-- seed-demo-data.sql + seed-demo-data-update.sql + seed-demo-data-expand.sql 実行後に実行
-- ============================================

-- 不足カラムがあれば追加
ALTER TABLE brand_personas ADD COLUMN IF NOT EXISTS segmentation_data JSONB;
ALTER TABLE brand_personas ADD COLUMN IF NOT EXISTS positioning_map_data JSONB;
ALTER TABLE brand_personas ADD COLUMN IF NOT EXISTS positioning_map_url TEXT;

DO $$
DECLARE
  v_company1_id UUID;
  v_company2_id UUID;
  v_persona1_id UUID;
  v_persona2_id UUID;
  v_persona_nk_id UUID;
BEGIN
  SELECT id INTO v_company1_id FROM companies WHERE name = '株式会社テックブリッジ';
  SELECT id INTO v_company2_id FROM companies WHERE name = '合同会社ナチュラルキッチン';

  -- ── 企業1: テックブリッジ ペルソナ1（最初のレコード）──
  SELECT id INTO v_persona1_id FROM brand_personas
    WHERE company_id = v_company1_id ORDER BY sort_order ASC LIMIT 1;

  UPDATE brand_personas SET
    name = '地方中小企業の経営者',
    target = '従業員10-50名の地方中小企業。IT専任者がおらず、デジタル化に課題を感じている経営者。業務効率化の必要性は感じているが、何から手をつけていいか分からない。',
    segmentation_data = '{
      "mode": "ai",
      "variables": [
        {
          "name": "企業規模",
          "reason": "IT投資の判断基準が規模で大きく異なる",
          "segments": [
            {"name": "小規模（10名以下）", "description": "経営者が1人でIT判断", "size_hint": "large", "selected": true},
            {"name": "中小規模（10-50名）", "description": "IT担当不在だが部署分化", "size_hint": "large", "selected": true},
            {"name": "中堅（50-200名）", "description": "IT担当者がいるが専門性不足", "size_hint": "medium", "selected": false}
          ]
        },
        {
          "name": "IT成熟度",
          "reason": "現状のIT活用レベルで提案内容が変わる",
          "segments": [
            {"name": "紙・電話中心", "description": "Excel以前の業務フロー", "size_hint": "medium", "selected": true},
            {"name": "Excel管理", "description": "表計算ソフトで業務管理", "size_hint": "large", "selected": true},
            {"name": "一部クラウド", "description": "会計や勤怠は導入済み", "size_hint": "medium", "selected": false}
          ]
        },
        {
          "name": "業種",
          "reason": "業種特有の業務課題がある",
          "segments": [
            {"name": "製造業", "description": "在庫管理・受発注の効率化ニーズ", "size_hint": "large", "selected": true},
            {"name": "サービス業", "description": "顧客管理・予約管理のニーズ", "size_hint": "large", "selected": false},
            {"name": "建設業", "description": "工程管理・見積のデジタル化", "size_hint": "medium", "selected": false}
          ]
        }
      ]
    }'::jsonb,
    positioning_map_data = '{
      "x_axis": {"left": "汎用的", "right": "業種特化"},
      "y_axis": {"bottom": "低価格", "top": "高機能"},
      "items": [
        {"name": "テックブリッジ", "x": 35, "y": 55, "color": "#2563EB", "size": "lg"},
        {"name": "フロンティアSaaS", "x": 75, "y": 85, "color": "#FF6B35", "size": "md"},
        {"name": "クラウドワークス", "x": 20, "y": 30, "color": "#00B4D8", "size": "md"},
        {"name": "kintone", "x": 25, "y": 70, "color": "#4ADE80", "size": "md"},
        {"name": "Salesforce", "x": 60, "y": 95, "color": "#0284C7", "size": "md"}
      ]
    }'::jsonb
  WHERE id = v_persona1_id;

  -- ── 企業1: テックブリッジ ペルソナ2（2番目のレコード）──
  SELECT id INTO v_persona2_id FROM brand_personas
    WHERE company_id = v_company1_id ORDER BY sort_order ASC OFFSET 1 LIMIT 1;

  IF v_persona2_id IS NOT NULL THEN
    UPDATE brand_personas SET
      name = '中堅企業のDX推進担当',
      age_range = '30-40歳',
      occupation = '中堅製造業 経営企画部 DX推進担当',
      description = '従業員50-200名の中堅企業。社長からDX推進を任されたが、何から始めるか悩んでいる。社内のITリテラシー格差が大きく、全員が使えるツールを求めている。',
      target = '従業員50-200名の中堅企業。社長からDX推進を任されたが、何から始めるか悩んでいる。社内のITリテラシー格差が大きく、全員が使えるツールを求めている。',
      needs = '["段階的に導入できるツール", "社内説得用の導入効果レポート", "他社の成功事例・ユースケース"]'::jsonb,
      pain_points = '["社内のITリテラシーにばらつきがある", "予算確保の社内稟議が通りにくい", "経営層と現場の温度差が大きい"]'::jsonb,
      segmentation_data = '{
        "mode": "ai",
        "variables": [
          {
            "name": "DX推進フェーズ",
            "reason": "フェーズで必要な支援が異なる",
            "segments": [
              {"name": "検討中", "description": "何を導入すべきか情報収集中", "size_hint": "large", "selected": true},
              {"name": "部分導入", "description": "一部ツールを試験的に導入", "size_hint": "medium", "selected": true},
              {"name": "全社展開", "description": "全社的なDXを推進中", "size_hint": "small", "selected": false}
            ]
          }
        ]
      }'::jsonb,
      positioning_map_data = NULL
    WHERE id = v_persona2_id;
  END IF;

  -- ── 企業2: ナチュラルキッチン ペルソナ1（最初のレコード）──
  SELECT id INTO v_persona_nk_id FROM brand_personas
    WHERE company_id = v_company2_id ORDER BY sort_order ASC LIMIT 1;

  IF v_persona_nk_id IS NOT NULL THEN
    UPDATE brand_personas SET
      name = '健康志向の30代ママ',
      age_range = '32-38歳',
      occupation = '会社員（時短勤務）',
      description = '子ども2人の母。食の安全に関心が高く、添加物を避けたい。平日は時短勤務で料理に時間をかけられない。週末は家族で外食が楽しみ。',
      target = '子ども2人の母（32-38歳）。食の安全に関心が高く、添加物を避けたい。平日は時短勤務で料理に時間をかけられない。週末は家族で外食が楽しみ。',
      needs = '["安心安全な食材で作られた料理", "子どもも喜ぶ優しい味", "テイクアウトできる手づくり家庭料理"]'::jsonb,
      pain_points = '["スーパーの野菜の産地が分からず不安", "外食は添加物が心配", "オーガニック専門店は価格が高すぎる"]'::jsonb,
      segmentation_data = '{
        "mode": "ai",
        "variables": [
          {
            "name": "食への関心度",
            "reason": "価格より品質を重視する層を特定",
            "segments": [
              {"name": "オーガニック志向", "description": "有機・無添加にこだわる", "size_hint": "medium", "selected": true},
              {"name": "健康意識", "description": "栄養バランスを気にする", "size_hint": "large", "selected": true},
              {"name": "コスパ重視", "description": "安くて量があればOK", "size_hint": "large", "selected": false}
            ]
          },
          {
            "name": "ライフステージ",
            "reason": "食事に求めるものが変わる",
            "segments": [
              {"name": "子育て世代", "description": "子どもの食育も重視", "size_hint": "large", "selected": true},
              {"name": "シニア", "description": "健康維持・減塩ニーズ", "size_hint": "medium", "selected": false},
              {"name": "単身", "description": "手軽さ重視", "size_hint": "medium", "selected": false}
            ]
          }
        ]
      }'::jsonb,
      positioning_map_data = '{
        "x_axis": {"left": "カジュアル", "right": "フォーマル"},
        "y_axis": {"bottom": "低価格", "top": "こだわり"},
        "items": [
          {"name": "ナチュラルキッチン", "x": 30, "y": 70, "color": "#16A34A", "size": "lg"},
          {"name": "オーガニックマルシェ", "x": 55, "y": 85, "color": "#F97316", "size": "md"},
          {"name": "ファミレスA", "x": 25, "y": 20, "color": "#94A3B8", "size": "md"},
          {"name": "高級レストランB", "x": 80, "y": 90, "color": "#94A3B8", "size": "md"}
        ]
      }'::jsonb
    WHERE id = v_persona_nk_id;
  END IF;

END $$;

SELECT 'Part 4 ペルソナ拡充完了' AS result;

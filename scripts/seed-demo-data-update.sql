-- ============================================
-- デモデータ追加更新（画像URL + ブランド掲示充実 + 企業2・3増量）
-- seed-demo-data.sql 実行後に Supabase SQL Editor で実行
-- ============================================

-- ============================================
-- Part 0: プロフィール写真 + 企業ロゴ URL更新
-- ============================================

-- 企業1: テックブリッジ プロフィール写真
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/yamada-taro.jpg' WHERE slug = 'yamada-taro';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/suzuki-hanako.jpg' WHERE slug = 'suzuki-hanako';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/tanaka-ichiro.jpg' WHERE slug = 'tanaka-ichiro';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/sato-misaki.jpg' WHERE slug = 'sato-misaki';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/takahashi-kenta.jpg' WHERE slug = 'takahashi-kenta';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/ito-yuko.jpg' WHERE slug = 'ito-yuko';

-- 企業2: ナチュラルキッチン プロフィール写真
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/nakamura-kazuya.jpg' WHERE slug = 'nakamura-kazuya';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/watanabe-sakura.jpg' WHERE slug = 'watanabe-sakura';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/kobayashi-daisuke.jpg' WHERE slug = 'kobayashi-daisuke';

-- 企業3: アーバンクラフト プロフィール写真
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/kimura-takuya.jpg' WHERE slug = 'kimura-takuya';
UPDATE profiles SET photo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/avatars/demo/matsumoto-akari.jpg' WHERE slug = 'matsumoto-akari';

-- 企業ロゴ
UPDATE companies SET logo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/logos/demo/techbridge.png' WHERE name = '株式会社テックブリッジ';
UPDATE companies SET logo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/logos/demo/natural-kitchen.png' WHERE name = '合同会社ナチュラルキッチン';
UPDATE companies SET logo_url = 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public/logos/demo/urbancraft.png' WHERE name = '株式会社アーバンクラフト';


-- ============================================
-- Part 1: 企業1（テックブリッジ）ブランド掲示充実
-- ============================================

-- brand_guidelines: 沿革・特性・ブランドステートメント追加
UPDATE brand_guidelines SET
  history = '[{"year":"2018","event":"川崎市で創業。最初のプロダクト「SmartTask」をリリース"},{"year":"2019","event":"シード資金調達。従業員10名に"},{"year":"2021","event":"顧客企業100社突破"},{"year":"2023","event":"シリーズA調達。オフィスを川崎駅前に移転"},{"year":"2025","event":"顧客企業500社突破。新プロダクト「BridgeConnect」をリリース"}]'::jsonb,
  traits = '[{"name":"信頼性","score":90,"description":"お客様との約束を必ず守る"},{"name":"革新性","score":75,"description":"常に新しい技術を取り入れる"},{"name":"親しみやすさ","score":85,"description":"専門用語を使わない分かりやすさ"},{"name":"誠実さ","score":95,"description":"嘘のない正直なコミュニケーション"}]'::jsonb,
  brand_statement = '中小企業の「困った」を、テクノロジーの力で「できた！」に変える。それが私たちテックブリッジの使命です。'
WHERE company_id = (SELECT id FROM companies WHERE name = '株式会社テックブリッジ');

-- brand_visuals: ロゴコンセプト・フォント・ビジュアルガイドライン追加
UPDATE brand_visuals SET
  logo_concept = '二つの要素を橋でつなぐ — テクノロジーと人、大企業と中小企業、現在と未来をつなぐ架け橋のイメージ。シンボルマークの「V」字は橋のアーチを表現し、上昇と前進を象徴する。',
  visual_guidelines = 'ロゴの最小サイズは24px。ロゴ周囲の余白はロゴ高さの50%以上を確保すること。配置可能な背景色はホワイト（#FFFFFF）またはダークグレー（#1F2937）上のみ。カラー写真の上への配置は禁止。',
  fonts = '{"primary_font":{"latin":"Inter","japanese":"Noto Sans JP","latin_source":"google","japanese_source":"google"},"secondary_font":{"latin":"Inter","japanese":"Noto Sans JP","latin_source":"google","japanese_source":"google"}}'::jsonb,
  color_palette = '{"brand_colors":[{"hex":"#2563EB","name":"テックブルー","role":"Primary"},{"hex":"#0EA5E9","name":"スカイブルー","role":"Secondary"}],"secondary_colors":[],"accent_colors":[{"hex":"#F59E0B","name":"アクセントアンバー","role":"Accent"}],"utility_colors":[{"hex":"#1F2937","name":"ダークグレー","role":"Text"},{"hex":"#F3F4F6","name":"ライトグレー","role":"Background"}]}'::jsonb
WHERE company_id = (SELECT id FROM companies WHERE name = '株式会社テックブリッジ');

-- brand_personalities: コミュニケーションスタイル追加
UPDATE brand_personalities SET
  communication_style = '専門用語を避け、分かりやすい言葉で誠実に伝える。お客様の立場に立った表現を心がける。「難しい」「できません」「IT用語の羅列」は避ける。'
WHERE company_id = (SELECT id FROM companies WHERE name = '株式会社テックブリッジ');

-- brand_personas: 2つ目のペルソナ追加
INSERT INTO brand_personas (company_id, name, sort_order, age_range, occupation, description, needs, pain_points)
VALUES (
  (SELECT id FROM companies WHERE name = '株式会社テックブリッジ'),
  '中堅企業のDX推進担当',
  2,
  '30-40歳',
  '中堅製造業 経営企画部 DX推進担当',
  '従業員100名の中堅企業。社長からDX推進を命じられたが、何から手をつけるか分からない状態。',
  '["段階的に導入できるツール", "社内説得用の資料", "他社の成功事例"]'::jsonb,
  '["社内のITリテラシーにばらつき", "予算確保が難しい", "経営層と現場の温度差"]'::jsonb
);

-- brand_terms: 用語ルール 5件
INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order) VALUES
  ((SELECT id FROM companies WHERE name = '株式会社テックブリッジ'), 'お客様', 'クライアント、顧客', '社外向け文書では常に「お客様」を使用', '呼称', 1),
  ((SELECT id FROM companies WHERE name = '株式会社テックブリッジ'), 'SmartTask', 'スマートタスク、smart task', '英字表記で統一。カタカナ不可', 'プロダクト名', 2),
  ((SELECT id FROM companies WHERE name = '株式会社テックブリッジ'), 'テックブリッジ', 'TB、テクブリ', '略称は使用しない', '社名', 3),
  ((SELECT id FROM companies WHERE name = '株式会社テックブリッジ'), '業務効率化クラウドサービス', 'SaaS、クラウドツール', '一般の方にも分かる表現を使用', 'サービス説明', 4),
  ((SELECT id FROM companies WHERE name = '株式会社テックブリッジ'), 'テクノロジーで、人と人をつなぐ', 'ITで繋ぐ、デジタルで繋ぐ', 'スローガンは正確に引用', '理念', 5);


-- ============================================
-- Part 2: 企業2（ナチュラルキッチン）ブランド関連データ増量
-- ============================================

-- companies: brand_story, secondary color 追加
UPDATE companies SET
  brand_story = '「おばあちゃんの味を残したい」。創業者・中村が幼少期に食べた祖母の手料理の温かさを、地元の食材で再現したいという想いから2020年に開業。川崎市内の農家5軒と直接契約し、朝採れ野菜を使った家庭料理を提供している。',
  brand_color_secondary = '#84CC16'
WHERE name = '合同会社ナチュラルキッチン';

-- brand_guidelines: brand_story, 沿革追加
UPDATE brand_guidelines SET
  brand_story = '「おばあちゃんの味を残したい」。創業者・中村が幼少期に食べた祖母の手料理の温かさを、地元の食材で再現したいという想いから2020年に開業。川崎市内の農家5軒と直接契約し、朝採れ野菜を使った家庭料理を提供している。',
  history = '[{"year":"2020","event":"川崎市宮前区で「ナチュラルキッチン」開業。地元農家との直接契約を開始"},{"year":"2021","event":"テイクアウト事業を開始。月間注文数100件達成"},{"year":"2023","event":"2号店を武蔵小杉にオープン"},{"year":"2025","event":"契約農家10軒に拡大。食育ワークショップを定期開催"}]'::jsonb
WHERE company_id = (SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン');

-- brand_visuals: カラー充実
UPDATE brand_visuals SET
  color_palette = '{"brand_colors":[{"hex":"#16A34A","name":"ナチュラルグリーン","role":"Primary"},{"hex":"#84CC16","name":"ライムグリーン","role":"Secondary"}],"secondary_colors":[],"accent_colors":[{"hex":"#F97316","name":"にんじんオレンジ","role":"Accent"}],"utility_colors":[{"hex":"#1C1917","name":"炭色","role":"Text"},{"hex":"#FAFAF9","name":"生成り","role":"Background"}]}'::jsonb,
  fonts = '{"primary_font":{"latin":"Inter","japanese":"Noto Sans JP","latin_source":"google","japanese_source":"google"},"secondary_font":{"latin":"","japanese":"","latin_source":"manual","japanese_source":"manual"}}'::jsonb
WHERE company_id = (SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン');

-- brand_personalities: 新規追加
INSERT INTO brand_personalities (company_id, tone_of_voice, communication_style)
VALUES (
  (SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン'),
  '温かく親しみやすい。家庭のリビングで話しているような自然体の言葉遣い。「〜です・ます」よりも「〜ですよ」「〜ですね」のやわらかい語尾を使う。',
  '旬の食材の魅力を五感で伝える。専門的な調理用語は避け、「おいしさの秘密」として分かりやすく表現する。'
);

-- brand_personas: 新規追加
INSERT INTO brand_personas (company_id, name, sort_order, age_range, occupation, description, needs, pain_points)
VALUES (
  (SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン'),
  '健康志向の30代ママ',
  1,
  '32-38歳',
  '会社員（時短勤務）',
  '子ども2人の母。食の安全に関心が高く、添加物を気にする。平日はなかなか料理に時間をかけられない。',
  '["安心安全な食材", "子どもも喜ぶ味", "テイクアウトできる家庭料理"]'::jsonb,
  '["スーパーの野菜の産地が分からない", "外食は添加物が心配", "オーガニック専門店は価格が高い"]'::jsonb
);

-- brand_terms: 用語ルール 3件
INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order) VALUES
  ((SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン'), '旬の食材', '季節の素材、シーズナルフード', '「旬」は漢字で表記', '食材', 1),
  ((SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン'), '農家さん', '生産者、サプライヤー', '親しみを込めて「さん」付け', '呼称', 2),
  ((SELECT id FROM companies WHERE name = '合同会社ナチュラルキッチン'), '手づくり', 'ハンドメイド、自家製', 'ひらがな表記で柔らかさを出す', '表現', 3);


-- ============================================
-- Part 3: 企業3（アーバンクラフト）ブランド関連データ増量
-- ============================================

-- companies: 基本情報追加
UPDATE companies SET
  slogan = 'つくる人を、つくる。',
  mvv = '若手クリエイターが自分らしく活躍できる場をつくる',
  brand_color_primary = '#6366F1',
  website_url = 'https://urbancraft.example.com',
  brand_stage = 'new'
WHERE name = '株式会社アーバンクラフト';

-- brand_guidelines: 新規追加
INSERT INTO brand_guidelines (company_id, mission, vision, values, business_content)
VALUES (
  (SELECT id FROM companies WHERE name = '株式会社アーバンクラフト'),
  '若手クリエイターの才能を社会に届ける',
  'つくる人を、つくる。',
  '[{"value":"自由","description":""},{"value":"表現","description":""},{"value":"共感","description":""}]'::jsonb,
  '[{"title":"デザインスタジオ","description":"ブランディング・Web・グラフィックのデザイン制作"}]'::jsonb
);

-- brand_visuals: 新規追加
INSERT INTO brand_visuals (company_id, color_palette)
VALUES (
  (SELECT id FROM companies WHERE name = '株式会社アーバンクラフト'),
  '{"brand_colors":[{"hex":"#6366F1","name":"クリエイティブパープル","role":"Primary"}],"secondary_colors":[],"accent_colors":[],"utility_colors":[]}'::jsonb
);

-- 企業3は brand_personalities, brand_personas, brand_terms は追加しない
-- → 「ブランド構築途中」の状態をシミュレート


-- ============================================
-- Part 4: ペルソナ拡充（ターゲット詳細 + ポジショニングマップ）
-- ============================================

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


-- ============================================
-- 完了
-- ============================================
SELECT 'デモデータ更新完了（Part 0-4）' AS result;

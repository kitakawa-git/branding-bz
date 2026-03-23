-- ============================================
-- Part 5: ビジュアルアイデンティティ画像登録
-- brand_visuals.logo_sections, visual_guidelines_images
-- brand_guidelines.concept_visual_url
-- ============================================
-- 実行前提: seed-demo-data.sql, seed-demo-data-update.sql, seed-demo-data-expand.sql 実行済み
-- 画像: generate-demo-images.ts → upload-demo-images.ts でStorageにアップロード済み

DO $$
DECLARE
  v_company1_id UUID;
  v_company2_id UUID;
  v_company3_id UUID;
  v_visuals1_id UUID;
  v_visuals2_id UUID;
  v_visuals3_id UUID;
  v_base_url TEXT := 'https://wfabdmfgngjtihhlrrpk.supabase.co/storage/v1/object/public';
BEGIN
  SELECT id INTO v_company1_id FROM companies WHERE name = '株式会社テックブリッジ';
  SELECT id INTO v_company2_id FROM companies WHERE name = '合同会社ナチュラルキッチン';
  SELECT id INTO v_company3_id FROM companies WHERE name = '株式会社アーバンクラフト';

  -- ── 企業1: テックブリッジ ──

  -- brand_visuals レコード取得（なければ作成）
  SELECT id INTO v_visuals1_id FROM brand_visuals WHERE company_id = v_company1_id LIMIT 1;
  IF v_visuals1_id IS NULL THEN
    INSERT INTO brand_visuals (company_id, logo_concept, logo_sections, logo_sections_sort, visual_guidelines, visual_guidelines_images, visual_guidelines_sort)
    VALUES (v_company1_id, '', '[]'::jsonb, 'registered', '', '[]'::jsonb, 'registered')
    RETURNING id INTO v_visuals1_id;
  END IF;

  -- logo_sections: 3セクション（メインロゴ / ロゴバリエーション / 使用ルール）
  UPDATE brand_visuals SET
    logo_concept = 'TechBridge のロゴは「架け橋」をモチーフに、テクノロジーと地方企業をつなぐ存在を表現しています。シンプルかつ堅実な印象で、信頼性とアクセシビリティを兼ね備えたデザインです。',
    logo_sections = jsonb_build_array(
      jsonb_build_object(
        'title', 'メインロゴ',
        'items', jsonb_build_array(
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-logo-main.png', 'caption', 'メインロゴ（カラー版）', 'added_index', 0),
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-logo-white.png', 'caption', 'メインロゴ（白抜き版）', 'added_index', 1),
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-logo-icon.png', 'caption', 'アイコン版', 'added_index', 2)
        )
      ),
      jsonb_build_object(
        'title', '使用ルール',
        'items', jsonb_build_array(
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-logo-usage-good.png', 'caption', '正しい使用例', 'added_index', 0),
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-logo-usage-bad.png', 'caption', '禁止事項', 'added_index', 1)
        )
      )
    ),
    logo_sections_sort = 'registered',
    visual_guidelines = 'TechBridge のビジュアルガイドラインは、プロフェッショナルさと親しみやすさのバランスを重視します。ブルーを基調としたカラーパレットは信頼性を、丸みのあるフォルムはアクセシビリティを表現します。写真は自然光を活かした明るいトーンで、地方の風景やオフィスシーンを採用します。',
    visual_guidelines_images = jsonb_build_array(
      jsonb_build_object('url', v_base_url || '/brand-assets/demo/techbridge-brand-image.png', 'caption', 'ブランドイメージ', 'added_index', 0)
    ),
    visual_guidelines_sort = 'registered',
    color_palette = '{
      "brand_colors": [
        {"name": "Primary Blue", "hex": "#2563EB"},
        {"name": "Dark Blue", "hex": "#1D4ED8"}
      ],
      "secondary_colors": [
        {"name": "Light Blue", "hex": "#60A5FA"},
        {"name": "Sky", "hex": "#EFF6FF"}
      ],
      "accent_colors": [
        {"name": "Orange", "hex": "#F97316"}
      ],
      "utility_colors": [
        {"name": "Dark Gray", "hex": "#1F2937"},
        {"name": "Light Gray", "hex": "#F3F4F6"},
        {"name": "White", "hex": "#FFFFFF"}
      ]
    }'::jsonb
  WHERE id = v_visuals1_id;

  -- brand_guidelines: concept_visual_url
  UPDATE brand_guidelines SET
    concept_visual_url = v_base_url || '/avatars/concept-visuals/techbridge-concept.png'
  WHERE company_id = v_company1_id;

  -- ── 企業2: ナチュラルキッチン ──

  SELECT id INTO v_visuals2_id FROM brand_visuals WHERE company_id = v_company2_id LIMIT 1;
  IF v_visuals2_id IS NULL THEN
    INSERT INTO brand_visuals (company_id, logo_concept, logo_sections, logo_sections_sort, visual_guidelines, visual_guidelines_images, visual_guidelines_sort)
    VALUES (v_company2_id, '', '[]'::jsonb, 'registered', '', '[]'::jsonb, 'registered')
    RETURNING id INTO v_visuals2_id;
  END IF;

  UPDATE brand_visuals SET
    logo_concept = 'Natural Kitchen のロゴは、有機的な曲線と葉のモチーフで「自然の恵み」を表現。グリーンを基調に、温かみと安心感を伝えるデザインです。',
    logo_sections = jsonb_build_array(
      jsonb_build_object(
        'title', 'メインロゴ',
        'items', jsonb_build_array(
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/natural-kitchen-logo-main.png', 'caption', 'メインロゴ（カラー版）', 'added_index', 0)
        )
      )
    ),
    logo_sections_sort = 'registered',
    visual_guidelines = '写真はナチュラルな色合いで、食材の新鮮さや料理の温かみを伝える。木目やリネンなど自然素材のテクスチャを背景に使用。',
    visual_guidelines_images = jsonb_build_array(
      jsonb_build_object('url', v_base_url || '/brand-assets/demo/natural-kitchen-brand-image.png', 'caption', 'ブランドイメージ', 'added_index', 0)
    ),
    visual_guidelines_sort = 'registered',
    color_palette = '{
      "brand_colors": [
        {"name": "Forest Green", "hex": "#16A34A"},
        {"name": "Dark Green", "hex": "#15803D"}
      ],
      "secondary_colors": [
        {"name": "Light Green", "hex": "#22C55E"},
        {"name": "Mint", "hex": "#F0FDF4"}
      ],
      "accent_colors": [
        {"name": "Warm Orange", "hex": "#F97316"}
      ],
      "utility_colors": [
        {"name": "Brown", "hex": "#78350F"},
        {"name": "Cream", "hex": "#FFFBEB"},
        {"name": "White", "hex": "#FFFFFF"}
      ]
    }'::jsonb
  WHERE id = v_visuals2_id;

  UPDATE brand_guidelines SET
    concept_visual_url = v_base_url || '/avatars/concept-visuals/natural-kitchen-concept.png'
  WHERE company_id = v_company2_id;

  -- ── 企業3: アーバンクラフト ──

  SELECT id INTO v_visuals3_id FROM brand_visuals WHERE company_id = v_company3_id LIMIT 1;
  IF v_visuals3_id IS NULL THEN
    INSERT INTO brand_visuals (company_id, logo_concept, logo_sections, logo_sections_sort, visual_guidelines, visual_guidelines_images, visual_guidelines_sort)
    VALUES (v_company3_id, '', '[]'::jsonb, 'registered', '', '[]'::jsonb, 'registered')
    RETURNING id INTO v_visuals3_id;
  END IF;

  UPDATE brand_visuals SET
    logo_concept = 'Urban Craft のロゴは、幾何学的なフォルムと手書き風のアクセントで「都市×手仕事」の融合を表現。インディゴを基調に、洗練さと個性を兼ね備えています。',
    logo_sections = jsonb_build_array(
      jsonb_build_object(
        'title', 'メインロゴ',
        'items', jsonb_build_array(
          jsonb_build_object('url', v_base_url || '/brand-assets/demo/urbancraft-logo-main.png', 'caption', 'メインロゴ（カラー版）', 'added_index', 0)
        )
      )
    ),
    logo_sections_sort = 'registered',
    visual_guidelines = '写真はコントラストを効かせたモダンなトーン。工房の風景や手作業のクローズアップ、都市と職人の対比を意識する。',
    visual_guidelines_images = '[]'::jsonb,
    visual_guidelines_sort = 'registered',
    color_palette = '{
      "brand_colors": [
        {"name": "Indigo", "hex": "#6366F1"},
        {"name": "Deep Indigo", "hex": "#4F46E5"}
      ],
      "secondary_colors": [
        {"name": "Light Indigo", "hex": "#818CF8"},
        {"name": "Lavender", "hex": "#EEF2FF"}
      ],
      "accent_colors": [
        {"name": "Amber", "hex": "#F59E0B"}
      ],
      "utility_colors": [
        {"name": "Charcoal", "hex": "#1E1B4B"},
        {"name": "Stone", "hex": "#F5F5F4"},
        {"name": "White", "hex": "#FFFFFF"}
      ]
    }'::jsonb
  WHERE id = v_visuals3_id;

  UPDATE brand_guidelines SET
    concept_visual_url = v_base_url || '/avatars/concept-visuals/urbancraft-concept.png'
  WHERE company_id = v_company3_id;

END $$;

SELECT 'Part 5 ビジュアルID画像登録完了' AS result;

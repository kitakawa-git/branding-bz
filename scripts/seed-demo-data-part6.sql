-- ============================================
-- Part 6: brand_guidelines.slogan 登録
-- PortalAuthProviderが brand_guidelines.slogan を参照しているため
-- companies.slogan と同じ値を brand_guidelines にも設定
-- ============================================

DO $$
DECLARE
  v_company1_id UUID;
  v_company2_id UUID;
  v_company3_id UUID;
BEGIN
  SELECT id INTO v_company1_id FROM companies WHERE name = '株式会社テックブリッジ';
  SELECT id INTO v_company2_id FROM companies WHERE name = '合同会社ナチュラルキッチン';
  SELECT id INTO v_company3_id FROM companies WHERE name = '株式会社アーバンクラフト';

  -- 企業1: テックブリッジ
  UPDATE brand_guidelines SET
    slogan = 'テクノロジーで、人と人をつなぐ。'
  WHERE company_id = v_company1_id;

  -- 企業2: ナチュラルキッチン
  UPDATE brand_guidelines SET
    slogan = '自然の恵みを、毎日の食卓に。'
  WHERE company_id = v_company2_id;

  -- 企業3: アーバンクラフト
  UPDATE brand_guidelines SET
    slogan = 'つくる人を、つくる。'
  WHERE company_id = v_company3_id;

END $$;

SELECT 'Part 6 スローガン登録完了' AS result;

-- ============================================
-- デモデータ クリーンアップ（seed 再実行前に実行）
-- 依存関係の順序で削除
-- ============================================

-- タイムライン関連（FK依存順）
DELETE FROM timeline_comments WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM timeline_likes WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM timeline_posts WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- お知らせ関連
DELETE FROM announcement_likes WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM announcement_reads WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM announcements WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- KPI関連
DELETE FROM goal_kpis WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM personal_goals WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM goal_periods WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- ブランドスコア関連
DELETE FROM brand_score_snapshots WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_micro_feedbacks WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_personality_tag_mappings WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- サーベイ関連
DELETE FROM survey_participants WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト')));
DELETE FROM brand_survey_responses WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト')));
DELETE FROM brand_survey_questions WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト')));
DELETE FROM brand_surveys WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- カード・閲覧関連
DELETE FROM brand_page_views WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM card_events WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM card_views WHERE profile_id IN (SELECT id FROM profiles WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト')));

-- ブランド関連
DELETE FROM value_propositions WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_terms WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_personas WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_personalities WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_visuals WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM brand_guidelines WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- メンバー・認証関連
DELETE FROM members WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM admin_users WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));
DELETE FROM profiles WHERE company_id IN (SELECT id FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト'));

-- 企業本体
DELETE FROM companies WHERE name IN ('株式会社テックブリッジ','合同会社ナチュラルキッチン','株式会社アーバンクラフト');

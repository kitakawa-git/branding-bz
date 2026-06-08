-- 順序5 Step4: companies.slogan / mvv を DROP（二重管理・no-op編集バグの解消）
-- 前提: 参照コードを brand_guidelines へ一本化/repoint しデプロイ済み（commit fed46f3・Vercel Ready 確認済）。
--   本番は companies.slogan/mvv を参照しない（grep + デプロイ済み新版で確認）。
-- ※ MCP apply_migration（remote）で version 20260608152657 として適用済み。
--
-- DROP前バックアップ（非NULL/非空・全社分）:
--   companies.slogan:
--     ID INC.「ブランドを、約束にする。」（bg「Start with ID.」が正・表示中／破棄）
--     MEGUTAMA「Logistics as a wheel of life.」（bg.slogan へ移植済み）
--     合同会社ナチュラルキッチン「自然の恵みを、食卓に。」（bg「自然の恵みを、毎日の食卓に。」が正／破棄）
--     株式会社アーバンクラフト「つくる人を、つくる。」（bgと一致）
--     株式会社テックブリッジ「テクノロジーで、人と人をつなぐ。」（bgと一致）
--   companies.mvv:
--     ID INC.「ミッション：中小企業のブランド価値を最大化する」
--     合同会社ナチュラルキッチン「地産地消で地域の食文化を守り、未来の食卓を豊かにする」
--     株式会社アーバンクラフト「若手クリエイターが自分らしく活躍できる場をつくる」
--     株式会社テックブリッジ「Mission: デジタルの力で中小企業の成長を支援する / Vision: すべての企業がテクノロジーの恩恵を受けられる世界 / Values: 誠実・挑戦・共創」

ALTER TABLE public.companies DROP COLUMN slogan;
ALTER TABLE public.companies DROP COLUMN mvv;

NOTIFY pgrst, 'reload schema';

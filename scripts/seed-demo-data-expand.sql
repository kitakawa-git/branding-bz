-- ============================================
-- デモデータ大幅拡充
-- seed-demo-data.sql + seed-demo-data-update.sql 実行後に Supabase SQL Editor で実行
-- ============================================

-- brand_values テーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS brand_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
DECLARE
  v_company1_id UUID;
  v_company2_id UUID;
  v_company3_id UUID;
  v_auth1 UUID := 'd537b5f5-3860-4eed-a0d5-ccf6fd7e352f';
  v_auth2 UUID := '72b59b39-5d8b-4283-80a0-f163d0b589ac';
  v_auth3 UUID := '4685e271-4522-4871-8ebe-01a8d3d270a3';
  v_persona1_id UUID;
  v_persona2_id UUID;
  v_period1_id UUID;
  v_goal1_id UUID;
  v_post_id UUID;
BEGIN
  -- 企業ID取得
  SELECT id INTO v_company1_id FROM companies WHERE name = '株式会社テックブリッジ';
  SELECT id INTO v_company2_id FROM companies WHERE name = '合同会社ナチュラルキッチン';
  SELECT id INTO v_company3_id FROM companies WHERE name = '株式会社アーバンクラフト';

  -- ============================================
  -- Part 1: プロフィール拡充（電話・SNS・Bio）
  -- ============================================

  -- 企業1: テックブリッジ
  UPDATE profiles SET
    phone = '044-555-0101',
    sns_x = 'https://x.com/yamada_techbridge',
    sns_linkedin = 'https://linkedin.com/in/yamada-taro',
    bio = '2018年にテックブリッジを創業。「中小企業のIT化は難しくない」という信念のもと、誰でも使えるクラウドサービスを開発しています。前職はSIerのPMとして10年間、100社以上の業務システム導入を経験。その中で感じた「中小企業が取り残されている」という課題を解決するため起業しました。休日は息子とプログラミング教室に通っています。'
  WHERE slug = 'yamada-taro';

  UPDATE profiles SET
    phone = '044-555-0102',
    sns_x = 'https://x.com/suzuki_tech',
    sns_linkedin = 'https://linkedin.com/in/suzuki-hanako',
    bio = 'テックブリッジのCTO。東京大学大学院で分散システムを研究後、大手クラウド企業でインフラエンジニアとして5年間勤務。「技術は人のためにある」がモットー。社内では技術勉強会を月2回主催し、メンバーの成長を支援しています。最近はAI活用の新機能開発に注力中。愛猫2匹と暮らしています。'
  WHERE slug = 'suzuki-hanako';

  UPDATE profiles SET
    phone = '044-555-0103',
    bio = 'フルスタックエンジニア。React/Next.jsとGoが得意です。前職のスタートアップでゼロからプロダクトを立ち上げた経験を活かし、SmartTaskのフロントエンド全般を担当。ユーザーの「使いやすい！」という声が一番の原動力。週末はOSSコントリビューションとランニングを楽しんでいます。'
  WHERE slug = 'tanaka-ichiro';

  UPDATE profiles SET
    phone = '044-555-0104',
    sns_instagram = 'https://instagram.com/misaki_design',
    bio = 'UI/UXデザイナー。武蔵野美術大学卒業後、Web制作会社を経てテックブリッジに入社。「ITが苦手な人にこそ使いやすいデザインを」を信条に、SmartTaskの画面設計からブランドデザインまで幅広く担当しています。ユーザーインタビューを大切にし、月に最低5人のお客様と直接お話ししています。'
  WHERE slug = 'sato-misaki';

  UPDATE profiles SET
    phone = '044-555-0105',
    sns_linkedin = 'https://linkedin.com/in/takahashi-kenta',
    bio = '営業マネージャー。大手人材会社で法人営業を8年経験した後、テックブリッジへ。「売る」のではなく「お客様の課題を一緒に解決する」スタイルで、導入企業の継続率98%を実現。展示会やセミナーでの登壇も積極的に行い、中小企業のDX推進を広める活動をしています。'
  WHERE slug = 'takahashi-kenta';

  UPDATE profiles SET
    phone = '044-555-0106',
    bio = 'カスタマーサクセス担当。お客様の「困った」を「できた！」に変えるのが私の仕事です。導入後のオンボーディングから活用支援、定期的なヘルスチェックまで、お客様に寄り添ったサポートを心がけています。前職はコールセンターのSV。お客様対応のプロフェッショナルです。'
  WHERE slug = 'ito-yuko';

  -- 企業2: ナチュラルキッチン
  UPDATE profiles SET
    phone = '044-555-0201',
    sns_instagram = 'https://instagram.com/natural_kitchen_kawasaki',
    bio = 'ナチュラルキッチン創業者・代表。祖母から受け継いだ「手づくりの温かさ」を大切に、地元川崎の農家さんと直接つながり、朝採れ野菜を使った家庭料理を提供しています。「食は人をつくる」という想いで、食育ワークショップも定期開催中。2児の父として、子どもに安心して食べさせられる料理を追求し続けています。'
  WHERE slug = 'nakamura-kazuya';

  UPDATE profiles SET
    phone = '044-555-0202',
    sns_instagram = 'https://instagram.com/sakura_cooking',
    bio = '料理長。調理師専門学校卒業後、和食料亭で10年修行。「おばあちゃんの味」を再現するために、化学調味料を一切使わない調理法を徹底しています。季節の食材を活かしたメニュー開発が得意。お客様から「実家の味がする」と言われることが最高の褒め言葉です。'
  WHERE slug = 'watanabe-sakura';

  UPDATE profiles SET
    phone = '044-555-0203',
    sns_x = 'https://x.com/kobayashi_nk',
    bio = '企画・マーケティング担当。食品メーカーでのマーケティング経験を活かし、ナチュラルキッチンのブランド発信を担当。SNS運用、チラシ制作、地域イベントの企画まで幅広く手がけています。「美味しい」を届けるだけでなく、農家さんの想いやストーリーも一緒に届けたいと考えています。'
  WHERE slug = 'kobayashi-daisuke';

  -- 企業3: アーバンクラフト
  UPDATE profiles SET
    phone = '044-555-0301',
    sns_x = 'https://x.com/kimura_urbancraft',
    sns_instagram = 'https://instagram.com/urbancraft_design',
    bio = 'アーバンクラフト代表・クリエイティブディレクター。多摩美術大学卒業後、広告代理店でアートディレクターとして活躍。2024年に独立し、若手クリエイターが自由に表現できる場としてアーバンクラフトを設立。「つくる人を、つくる。」をビジョンに、次世代のクリエイター育成にも力を入れています。'
  WHERE slug = 'kimura-takuya';

  UPDATE profiles SET
    phone = '044-555-0302',
    sns_instagram = 'https://instagram.com/akari_design',
    bio = 'Webデザイナー・フロントエンドエンジニア。美大在学中からフリーランスとして活動し、卒業と同時にアーバンクラフトに参画。デザインとコーディングの両方ができる強みを活かし、お客様のブランドをWebで表現しています。最近はモーショングラフィックスにも挑戦中。'
  WHERE slug = 'matsumoto-akari';


  -- ============================================
  -- Part 2: 提供価値（brand_values テーブル）
  -- ============================================

  -- 企業1: テックブリッジ
  INSERT INTO brand_values (company_id, title, description, sort_order) VALUES
    (v_company1_id, '業務効率の劇的改善', '煩雑な手作業をクラウドで自動化。導入企業の平均業務時間を30%削減した実績があります。', 0),
    (v_company1_id, '導入コストの最小化', '中小企業でも無理なく始められる料金体系。初期費用ゼロ、月額制で必要な分だけご利用いただけます。', 1),
    (v_company1_id, '専任サポートによる安心', '導入から運用まで専任のカスタマーサクセスが伴走。ITに不慣れな方でも安心してお使いいただけます。', 2),
    (v_company1_id, 'データドリブンな意思決定支援', 'リアルタイムのダッシュボードで経営データを可視化。勘や経験だけに頼らない意思決定をサポートします。', 3),
    (v_company1_id, 'スケーラブルなシステム設計', '従業員5名から500名まで、会社の成長に合わせてシームレスに拡張できるシステム設計です。', 4);

  -- 企業2: ナチュラルキッチン
  INSERT INTO brand_values (company_id, title, description, sort_order) VALUES
    (v_company2_id, '安心安全な食材', '川崎市内の契約農家10軒から届く朝採れ野菜。農薬の使用状況まで把握した、顔の見える食材を使用しています。', 0),
    (v_company2_id, '地産地消による鮮度', '収穫から調理まで最短3時間。地元の農家さんとの直接契約だからこそ実現できる、圧倒的な鮮度をお届けします。', 1),
    (v_company2_id, '家庭の温もりある味わい', '化学調味料を一切使わず、素材の味を活かした家庭料理。「おばあちゃんの味」を現代に受け継いでいます。', 2);


  -- ============================================
  -- Part 3: 行動指針（action_guidelines）
  -- ============================================

  -- 企業1: テックブリッジ — 1つ目のペルソナに設定
  SELECT id INTO v_persona1_id FROM brand_personas
    WHERE company_id = v_company1_id ORDER BY sort_order ASC LIMIT 1;

  UPDATE brand_personas SET
    action_guidelines = '[
      {"title": "お客様目線で考える", "description": "すべての判断基準は「お客様にとって価値があるか」。社内の都合ではなく、お客様の立場で考え、行動する。"},
      {"title": "仲間の成果を称える", "description": "チームメンバーの頑張りや成果に気づき、言葉にして伝える。小さな成功も見逃さず、互いに認め合う文化をつくる。"},
      {"title": "失敗を恐れずチャレンジする", "description": "新しいことに挑戦する勇気を大切にする。失敗は学びの機会。振り返りを行い、次に活かすことが重要。"},
      {"title": "シンプルに伝える", "description": "専門用語や難しい言葉を使わず、誰にでも分かる言葉で伝える。複雑なことをシンプルにするのがプロの仕事。"},
      {"title": "チームで成し遂げる", "description": "一人で抱え込まず、チームの力を信じる。部門を超えた協力で、お客様により大きな価値を届ける。"}
    ]'::jsonb
  WHERE id = v_persona1_id;

  -- 企業2: ナチュラルキッチン — 1つ目のペルソナに設定
  SELECT id INTO v_persona2_id FROM brand_personas
    WHERE company_id = v_company2_id ORDER BY sort_order ASC LIMIT 1;

  UPDATE brand_personas SET
    action_guidelines = '[
      {"title": "食の安心を届ける", "description": "食材の産地や調理法に妥協しない。お客様が安心して口にできるものだけを提供する。"},
      {"title": "地域とつながる", "description": "農家さん、地域の方々とのつながりを大切にする。顔の見える関係が、食の安心と美味しさの源。"},
      {"title": "笑顔を生み出す", "description": "料理を通じてお客様に笑顔を届ける。「美味しい」の一言が、私たちの最高のご褒美。"}
    ]'::jsonb
  WHERE id = v_persona2_id;


  -- ============================================
  -- Part 4: Good Job タイムライン（timeline_posts）
  -- ============================================

  -- 企業1: テックブリッジ（15件）— 投稿者: v_auth1（山田太郎）
  -- ※ user_id はauth.usersのID。デモでは管理者のみauth userが存在

  INSERT INTO timeline_posts (company_id, user_id, content, category, is_anonymous, created_at, updated_at) VALUES
  -- 1月の投稿
  (v_company1_id, v_auth1,
   '鈴木さんが深夜のシステム障害を30分で復旧してくれました。冷静な判断と的確な対応に感謝です。お客様への影響を最小限に抑えてくれたおかげで、翌朝のサポート問い合わせはゼロでした。本当にありがとう！',
   'チームで成し遂げる', false, '2026-01-08 09:15:00+09', '2026-01-08 09:15:00+09'),

  (v_company1_id, v_auth1,
   '佐藤さんがデザインしたSmartTaskの新しいダッシュボード画面、お客様から「直感的で分かりやすい」と大好評です。ユーザーインタビューの成果がしっかり反映されていて、さすがです。',
   'お客様目線で考える', false, '2026-01-14 14:30:00+09', '2026-01-14 14:30:00+09'),

  (v_company1_id, v_auth1,
   '田中さんが社内勉強会でNext.js App Routerの最新パターンを共有してくれました。実践的な内容で、チーム全体のスキルアップにつながっています。継続的な学びの姿勢、素晴らしい！',
   '失敗を恐れずチャレンジする', false, '2026-01-20 17:00:00+09', '2026-01-20 17:00:00+09'),

  (v_company1_id, v_auth1,
   '高橋さんが新規のお客様向けに作成した提案資料が秀逸でした。技術的な内容を「3つのポイント」にまとめ、IT用語を一切使わない分かりやすさ。お客様から即決いただけました！',
   'シンプルに伝える', false, '2026-01-27 11:00:00+09', '2026-01-27 11:00:00+09'),

  -- 2月の投稿
  (v_company1_id, v_auth1,
   '伊藤さんのカスタマーサクセスチームが、導入3ヶ月目のお客様フォローアップを実施。活用率が低かった機能の使い方レクチャーを行い、翌週から利用率が2倍に。お客様から感謝のメールをいただきました。',
   'お客様目線で考える', false, '2026-02-03 10:00:00+09', '2026-02-03 10:00:00+09'),

  (v_company1_id, v_auth1,
   '先週のスプリントレビューで、チーム全員が予定通りのデリバリーを達成！特に田中さんと鈴木さんのペアプログラミングで、難しいAPI連携を予定より2日早く完成させてくれました。',
   'チームで成し遂げる', false, '2026-02-10 16:30:00+09', '2026-02-10 16:30:00+09'),

  (v_company1_id, v_auth1,
   '佐藤さんが新しいデザインツールの導入を提案してくれました。チームで1週間トライアルした結果、作業効率が20%向上。失敗を恐れず新しいことに挑戦する姿勢が素晴らしいです。',
   '失敗を恐れずチャレンジする', false, '2026-02-14 13:45:00+09', '2026-02-14 13:45:00+09'),

  (v_company1_id, v_auth1,
   '高橋さんが既存のお客様から「こういう機能があれば嬉しい」というフィードバックを丁寧にヒアリングしてまとめてくれました。プロダクトチームへの共有も的確で、次のスプリントに3件反映予定です。',
   'お客様目線で考える', false, '2026-02-19 15:20:00+09', '2026-02-19 15:20:00+09'),

  (v_company1_id, v_auth1,
   '伊藤さんが作成したFAQドキュメントがとても分かりやすいと社内外から好評です。「お客様が実際に使う言葉」で書かれていて、サポート問い合わせが先月比15%減少しました。',
   'シンプルに伝える', false, '2026-02-25 09:30:00+09', '2026-02-25 09:30:00+09'),

  -- 3月の投稿
  (v_company1_id, v_auth1,
   'BridgeConnectのβ版リリースに向けて、開発・デザイン・営業が一丸となって追い込み中。鈴木さんのアーキテクチャ設計が堅牢で、大きなバグなく進んでいます。チームワークの結晶です！',
   'チームで成し遂げる', false, '2026-03-03 18:00:00+09', '2026-03-03 18:00:00+09'),

  (v_company1_id, v_auth1,
   '田中さんがお客様先での技術サポートで、その場で問題を特定して即修正。お客様から「エンジニアさんが直接来てくれるの初めて。すごく安心できた」と感動のお言葉をいただきました。',
   'お客様目線で考える', false, '2026-03-05 14:00:00+09', '2026-03-05 14:00:00+09');

  -- 匿名投稿（3件）
  INSERT INTO timeline_posts (company_id, user_id, content, category, is_anonymous, created_at, updated_at) VALUES
  (v_company1_id, v_auth1,
   '最近入社したばかりですが、チームの皆さんが温かく迎え入れてくれて感謝しています。分からないことを質問すると、どんなに忙しくても丁寧に教えてくれる。この文化を大切にしたいです。',
   '仲間の成果を称える', true, '2026-02-07 12:00:00+09', '2026-02-07 12:00:00+09'),

  (v_company1_id, v_auth1,
   '山田さんが全社ミーティングで「失敗は悪いことじゃない。チャレンジした証だ」と話してくれたのが印象的でした。実際にプロジェクトで失敗した時も責めるのではなく、一緒に振り返りをしてくれました。',
   '失敗を恐れずチャレンジする', true, '2026-02-21 10:30:00+09', '2026-02-21 10:30:00+09'),

  (v_company1_id, v_auth1,
   '高橋さんの営業プレゼンを見学させてもらいました。難しい機能の説明を「料理のレシピに例えると…」と身近な例で説明していて、お客様がどんどん前のめりに。シンプルに伝える力、見習いたいです。',
   'シンプルに伝える', true, '2026-03-07 16:45:00+09', '2026-03-07 16:45:00+09'),

  -- ラスト1件
  (v_company1_id, v_auth1,
   '顧客企業500社突破おめでとうございます！これはチーム全員の努力の結果。特に営業・CS・開発の連携が素晴らしかった。次は1000社を目指して、引き続きお客様に最高の価値を届けましょう！',
   'チームで成し遂げる', false, '2026-03-10 10:00:00+09', '2026-03-10 10:00:00+09');

  -- 企業2: ナチュラルキッチン（5件）— 投稿者: v_auth2（中村和也）
  INSERT INTO timeline_posts (company_id, user_id, content, category, is_anonymous, created_at, updated_at) VALUES
  (v_company2_id, v_auth2,
   '渡辺さんが新メニュー「旬の根菜たっぷりポトフ」を考案してくれました。試食会でスタッフ全員が「おばあちゃんの味がする！」と感動。早速来週からメニューに追加します。',
   '食の安心を届ける', false, '2026-01-15 11:00:00+09', '2026-01-15 11:00:00+09'),

  (v_company2_id, v_auth2,
   '小林さんが企画した「農家さん訪問ツアー」が大成功！お客様20名と一緒に契約農家の田中ファームを訪問。野菜の収穫体験と産地直送ランチを楽しんでいただきました。リピーター率が上がりそうです。',
   '地域とつながる', false, '2026-02-05 15:00:00+09', '2026-02-05 15:00:00+09'),

  (v_company2_id, v_auth2,
   '今日のランチタイム、小さなお子さん連れのお客様が「ここの野菜なら安心して食べさせられる」とおっしゃってくれました。渡辺さんの丁寧な食材選びが伝わっている証拠ですね。',
   '笑顔を生み出す', false, '2026-02-20 14:30:00+09', '2026-02-20 14:30:00+09'),

  (v_company2_id, v_auth2,
   '武蔵小杉の2号店が開店3ヶ月で常連のお客様が50名を超えました。小林さんのSNS発信と渡辺さんの料理の力、そしてスタッフ全員の笑顔の接客のおかげです。ありがとう！',
   '笑顔を生み出す', false, '2026-03-01 17:00:00+09', '2026-03-01 17:00:00+09'),

  (v_company2_id, v_auth2,
   '新しく契約した川崎市高津区の佐々木農園さんから、今朝とれたての春キャベツが届きました。甘くて柔らかくて最高の品質！農家さんとの信頼関係が広がっていることに感謝です。',
   '地域とつながる', false, '2026-03-08 09:00:00+09', '2026-03-08 09:00:00+09');

  -- タイムラインのいいね（各投稿に1-3件）
  -- 最新5件の投稿にいいねを追加
  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth1, v_company1_id, p.created_at + interval '2 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id
  ORDER BY p.created_at DESC
  LIMIT 8;

  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth2, v_company2_id, p.created_at + interval '1 hour'
  FROM timeline_posts p
  WHERE p.company_id = v_company2_id
  ORDER BY p.created_at DESC
  LIMIT 4;

  -- タイムラインのコメント（一部の投稿に）
  INSERT INTO timeline_comments (post_id, user_id, company_id, content, created_at)
  SELECT p.id, v_auth1, v_company1_id, 'チーム全員の頑張りが形になっていて嬉しいです。引き続き頑張りましょう！', p.created_at + interval '3 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.category = 'チームで成し遂げる'
  ORDER BY p.created_at DESC
  LIMIT 2;

  INSERT INTO timeline_comments (post_id, user_id, company_id, content, created_at)
  SELECT p.id, v_auth1, v_company1_id, 'お客様の声が直接聞けるのは本当に大切ですね。ありがとうございます。', p.created_at + interval '4 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.category = 'お客様目線で考える'
  ORDER BY p.created_at DESC
  LIMIT 2;


  -- ============================================
  -- Part 5: お知らせ（announcements）
  -- ============================================

  -- 企業1: テックブリッジ（5件）
  INSERT INTO announcements (company_id, author_id, title, content, category, images, is_published, created_at, updated_at) VALUES
  (v_company1_id, v_auth1,
   '新プロダクト「BridgeConnect」β版リリースのお知らせ',
   'お待たせしました！テックブリッジの新プロダクト「BridgeConnect」のβ版を本日リリースしました。BridgeConnectは、SmartTaskと連携して社内外のコミュニケーションをシームレスにつなぐツールです。β版テスターを社内から募集しますので、興味のある方は高橋までご連絡ください。皆さんのフィードバックをお待ちしています！',
   '重要', '{}', true, '2026-03-01 10:00:00+09', '2026-03-01 10:00:00+09'),

  (v_company1_id, v_auth1,
   '社内ハッカソン「TechBridge Innovation Day」開催決定！',
   '来月4月18日（土）に社内ハッカソンを開催します！テーマは「お客様の業務をもっとラクにするアイデア」。チーム編成は当日のくじ引きで決定。優勝チームには豪華ランチ券を進呈します。エンジニアだけでなく、営業・CS・デザインのメンバーも大歓迎です。普段と違うメンバーとの協業を楽しみましょう！',
   'イベント', '{}', true, '2026-02-20 14:00:00+09', '2026-02-20 14:00:00+09'),

  (v_company1_id, v_auth1,
   'ブランドガイドライン改訂のお知らせ',
   'ブランドガイドラインを改訂しました。主な変更点は以下の通りです：(1) ブランドカラーにアクセントアンバーを追加 (2) ロゴの使用ガイドラインを明確化 (3) 用語集を更新（「クライアント」→「お客様」の徹底）。改訂版はブランド掲示板で確認できます。不明点があれば佐藤までお気軽にどうぞ。',
   '更新', '{}', true, '2026-02-10 09:00:00+09', '2026-02-10 09:00:00+09'),

  (v_company1_id, v_auth1,
   '新メンバー加入のお知らせ',
   '3月1日付で新しいメンバーが加入しました！マーケティングチームに配属の木下さんです。前職はIT系メディアのライターとして5年の経験があり、コンテンツマーケティングの強化を担当いただきます。見かけたらぜひ声をかけてあげてください。木下さん、よろしくお願いします！',
   'その他', '{}', true, '2026-03-03 09:00:00+09', '2026-03-03 09:00:00+09'),

  (v_company1_id, v_auth1,
   '顧客満足度調査の結果報告',
   '先月実施した顧客満足度調査の結果をご報告します。総合満足度は5点満点中4.3点（前回比+0.2）、NPS（推奨度）は+42でした。特に「サポートの丁寧さ」「操作の分かりやすさ」が高評価をいただきました。一方で「レポート機能の充実」「モバイル対応」へのご要望も多く、今後の開発優先度に反映していきます。詳細レポートは後日共有します。',
   '重要', '{}', true, '2026-03-10 15:00:00+09', '2026-03-10 15:00:00+09');

  -- 企業2: ナチュラルキッチン（2件）
  INSERT INTO announcements (company_id, author_id, title, content, category, images, is_published, created_at, updated_at) VALUES
  (v_company2_id, v_auth2,
   '春の新メニュー発表会のお知らせ',
   '3月下旬から春の新メニューをスタートします！今年は契約農家さんから届く春キャベツ、新玉ねぎ、菜の花を使ったメニューを中心にラインナップ。メニュー発表会を3月20日（金）のまかない時間に開催しますので、全スタッフ参加をお願いします。渡辺さん渾身の新作メニュー、お楽しみに！',
   'イベント', '{}', true, '2026-03-05 08:00:00+09', '2026-03-05 08:00:00+09'),

  (v_company2_id, v_auth2,
   '食育ワークショップ「親子で学ぶ旬の食材」参加者募集',
   '4月12日（日）に食育ワークショップを開催します。テーマは「親子で学ぶ旬の食材」。川崎市内の契約農家・田中ファームさんでの野菜収穫体験と、採れたて野菜を使った親子クッキング教室の2部構成です。定員20組限定。お客様へのご案内と合わせて、スタッフの参加も歓迎します。詳細はチラシを確認してください。',
   'イベント', '{}', true, '2026-03-08 12:00:00+09', '2026-03-08 12:00:00+09');


  -- ============================================
  -- Part 6: 目標・KPI
  -- ============================================

  -- 企業1: 目標期間設定
  v_period1_id := gen_random_uuid();
  INSERT INTO goal_periods (id, company_id, type, start_date, end_date, is_current, status, created_at) VALUES
    (v_period1_id, v_company1_id, 'half_year', '2025-10-01', '2026-03-31', true, 'active', '2025-10-01 00:00:00+09');

  -- 企業1: companies.goal_period 更新
  UPDATE companies SET
    goal_period = '{"type": "half", "start_date": "2025-10-01", "end_date": "2026-03-31", "show_goal_banner": false, "show_review_banner": false}'::jsonb
  WHERE id = v_company1_id;

  -- 企業1: 個人目標
  v_goal1_id := gen_random_uuid();
  INSERT INTO personal_goals (id, company_id, user_id, title, goal_period_id, created_at, updated_at) VALUES
    (v_goal1_id, v_company1_id, v_auth1, 'ブランド認知度の向上と社内浸透', v_period1_id, '2025-10-15 09:00:00+09', '2026-03-01 10:00:00+09');

  -- 企業1: KPI（4件）
  INSERT INTO goal_kpis (id, goal_id, company_id, user_id, title, deadline, progress, weight, status, created_at, updated_at) VALUES
    (gen_random_uuid(), v_goal1_id, v_company1_id, v_auth1,
     'スマート名刺の月間閲覧数 500件達成',
     '2026-03-31', 68, '30', 'in_progress',
     '2025-10-15 09:00:00+09', '2026-03-10 10:00:00+09'),

    (gen_random_uuid(), v_goal1_id, v_company1_id, v_auth1,
     'SNSフォロワー数 1,000人達成',
     '2026-03-31', 45, '20', 'in_progress',
     '2025-10-15 09:00:00+09', '2026-03-10 10:00:00+09'),

    (gen_random_uuid(), v_goal1_id, v_company1_id, v_auth1,
     '顧客NPSスコア 8.0以上',
     '2026-03-31', 80, '30', 'in_progress',
     '2025-10-15 09:00:00+09', '2026-03-10 10:00:00+09'),

    (gen_random_uuid(), v_goal1_id, v_company1_id, v_auth1,
     'ブランドガイドライン社内浸透率 90%以上',
     '2026-03-31', 72, '20', 'in_progress',
     '2025-10-15 09:00:00+09', '2026-03-10 10:00:00+09');


  -- ============================================
  -- Part 7: ブランド用語追加（brand_terms）
  -- ============================================

  -- 企業1: 既存5件に追加で3件（sort_order 5,6,7）
  INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order) VALUES
    (v_company1_id, 'BridgeConnect', 'ブリッジコネクト、bridge connect', '英字表記で統一。SmartTaskと同じルール', 'プロダクト名', 5),
    (v_company1_id, '伴走支援', 'コンサルティング、アドバイス', 'お客様と一緒に走るイメージ。上から目線にならない', 'サービス説明', 6),
    (v_company1_id, '中小企業の「できた！」を増やす', '業務改善、DX推進', 'ミッションを引用する場合の正確な表現', '理念', 7);

  -- 企業2: 既存3件に追加で2件
  INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order) VALUES
    (v_company2_id, 'おうちごはん', '家庭料理、ホームクッキング', 'ひらがな表記でやわらかい印象に', '表現', 3),
    (v_company2_id, 'からだにやさしい', '健康的、ヘルシー', 'カタカナを避け、ひらがなで温もりを表現', '表現', 4);


  -- ============================================
  -- Part 8: 企業2・3 追加データ
  -- ============================================

  -- 企業2: brand_guidelines にtraitsとbrand_statementを追加
  UPDATE brand_guidelines SET
    traits = '[
      {"name": "安心感", "score": 95, "description": "食材の産地から調理法まで、すべてにおいて安心をお届けする"},
      {"name": "親しみやすさ", "score": 90, "description": "家庭のリビングにいるような温かい雰囲気"},
      {"name": "誠実さ", "score": 85, "description": "食材に嘘をつかない。添加物ゼロの約束"},
      {"name": "地域密着", "score": 80, "description": "川崎の農家さんとお客様をつなぐ架け橋"}
    ]'::jsonb,
    brand_statement = '「おばあちゃんの味を、あなたの食卓に。」私たちナチュラルキッチンは、地元川崎の農家さんから届く旬の食材で、家庭の温もりある料理をお届けします。',
    business_content = '[
      {"title": "店舗営業", "description": "川崎市宮前区の本店と武蔵小杉の2号店で、ランチ・ディナーを提供"},
      {"title": "テイクアウト", "description": "お弁当・惣菜のテイクアウト。当日朝の食材を使用"},
      {"title": "食育ワークショップ", "description": "親子向け料理教室、農家訪問ツアーなどを定期開催"},
      {"title": "法人向けケータリング", "description": "地元企業の会議・イベント向けケータリングサービス"}
    ]'::jsonb,
    mission = '地元の食材で、家庭の温もりを届ける',
    vision = 'おばあちゃんの味を残したい'
  WHERE company_id = v_company2_id;

  -- 企業2: brand_visuals にlogo_conceptを追加
  UPDATE brand_visuals SET
    logo_concept = '葉っぱのモチーフは「自然」と「成長」を表現。やわらかな緑色は安心感と新鮮さを、丸みのあるフォルムは家庭の温もりを象徴しています。',
    visual_guidelines = 'ロゴの最小サイズは20px。緑系の背景への配置は避け、白またはクリーム色の背景上で使用すること。写真との組み合わせ時は半透明の白オーバーレイを敷く。'
  WHERE company_id = v_company2_id;

  -- 企業3: brand_personalities 追加
  INSERT INTO brand_personalities (company_id, tone_of_voice, communication_style)
  VALUES (
    v_company3_id,
    'クリエイティブで刺激的。堅苦しさを排除し、同世代の仲間に話しかけるようなカジュアルなトーン。英語混じりもOK。',
    'ビジュアル重視。テキストは短く、画像や動画で語る。SNSのストーリーズのような軽やかさで、クリエイターの日常やプロセスを発信する。'
  );

  -- 企業3: brand_personas 追加
  INSERT INTO brand_personas (company_id, name, sort_order, age_range, occupation, description, needs, pain_points, action_guidelines)
  VALUES (
    v_company3_id,
    'デザインでブランドを変えたい経営者',
    0,
    '35-50歳',
    '中小企業 経営者・マーケティング責任者',
    'デザインの力でブランドイメージを刷新したい。しかし大手制作会社は予算が合わず、フリーランスは品質にばらつきがある。',
    '["適正価格で高品質なデザイン", "ブランド戦略から一貫したサポート", "若い感性を活かした新しい表現"]'::jsonb,
    '["大手制作会社は予算オーバー", "フリーランスの品質管理が難しい", "デザインの良し悪しが判断できない"]'::jsonb,
    '[{"title": "自由に発想する", "description": "既成概念にとらわれず、クリエイターの直感を大切にする"}, {"title": "共感でつながる", "description": "クライアントの想いに共感し、同じ目線でものづくりをする"}, {"title": "表現し続ける", "description": "完璧を待たずに発信する。作り続けることが成長につながる"}]'::jsonb
  );

  -- 企業3: brand_values 追加
  INSERT INTO brand_values (company_id, title, description, sort_order) VALUES
    (v_company3_id, '若い感性×戦略的デザイン', '20-30代クリエイターの斬新なアイデアに、戦略的なブランディング思考を掛け合わせた提案力。', 0),
    (v_company3_id, 'スピードと柔軟性', '大手にはないフットワークの軽さ。要望への素早い対応と柔軟なプラン調整が強みです。', 1);

  -- 企業3: brand_terms 追加
  INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order) VALUES
    (v_company3_id, 'クリエイター', 'デザイナー、作り手', 'デザイナーに限らず、すべての制作者を含む広い概念として使用', '呼称', 0),
    (v_company3_id, 'UrbanCraft', 'アーバンクラフト', 'ロゴ・英字表記では英字のみ。カタカナは文章中のみ可', '社名', 1);

END $$;

-- 完了確認
SELECT 'デモデータ拡充完了' AS result;

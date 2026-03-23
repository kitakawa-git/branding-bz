-- ============================================
-- Part 7: テックブリッジ メンバー追加 + タイムライン投稿追加
-- 鈴木・田中・佐藤・高橋・伊藤の5名をmembersに登録し、
-- 田中以外の4名からタイムライン投稿8件を追加
-- （田中一郎はメンバー登録済みだが投稿なし＝利用率5/6）
-- ============================================

DO $$
DECLARE
  v_company1_id UUID;
  -- 既存のauth_id（山田太郎）
  v_auth1 UUID := 'd537b5f5-3860-4eed-a0d5-ccf6fd7e352f';
  -- 5名分のダミーauth_id（membersテーブル用）
  v_auth_suzuki UUID := 'a1000001-0000-0000-0000-000000000001';
  v_auth_tanaka UUID := 'a1000002-0000-0000-0000-000000000002';
  v_auth_sato   UUID := 'a1000003-0000-0000-0000-000000000003';
  v_auth_takahashi UUID := 'a1000004-0000-0000-0000-000000000004';
  v_auth_ito    UUID := 'a1000005-0000-0000-0000-000000000005';
  -- profile_id
  v_p_suzuki UUID;
  v_p_tanaka UUID;
  v_p_sato   UUID;
  v_p_takahashi UUID;
  v_p_ito    UUID;
BEGIN
  SELECT id INTO v_company1_id FROM companies WHERE name = '株式会社テックブリッジ';

  -- ============================================
  -- 田中一郎の投稿のみクリーンアップ（前回実行分）
  -- メンバーとしては残す（投稿なし＝利用率5/6を表現）
  -- ============================================
  DELETE FROM timeline_likes WHERE user_id = v_auth_tanaka;
  DELETE FROM timeline_posts WHERE user_id = v_auth_tanaka;

  -- profile_id を取得
  SELECT id INTO v_p_suzuki FROM profiles WHERE slug = 'suzuki-hanako';
  SELECT id INTO v_p_tanaka FROM profiles WHERE slug = 'tanaka-ichiro';
  SELECT id INTO v_p_sato   FROM profiles WHERE slug = 'sato-misaki';
  SELECT id INTO v_p_takahashi FROM profiles WHERE slug = 'takahashi-kenta';
  SELECT id INTO v_p_ito    FROM profiles WHERE slug = 'ito-yuko';

  -- ============================================
  -- auth.users にダミーユーザーを作成（FK制約を満たすため）
  -- ※田中一郎はメンバー登録するが投稿なし（利用率5/6を表現）
  -- ============================================
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_auth_suzuki, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'suzuki@techbridge.example.com', crypt('demo-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_auth_tanaka, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'tanaka@techbridge.example.com', crypt('demo-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_auth_sato, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'sato@techbridge.example.com', crypt('demo-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_auth_takahashi, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'takahashi@techbridge.example.com', crypt('demo-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
    (v_auth_ito, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ito@techbridge.example.com', crypt('demo-password', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- auth.identities も作成（Supabase Auth が参照するため）
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES
    (v_auth_suzuki, v_auth_suzuki, 'suzuki@techbridge.example.com', 'email',
     jsonb_build_object('sub', v_auth_suzuki::text, 'email', 'suzuki@techbridge.example.com'), now(), now(), now()),
    (v_auth_tanaka, v_auth_tanaka, 'tanaka@techbridge.example.com', 'email',
     jsonb_build_object('sub', v_auth_tanaka::text, 'email', 'tanaka@techbridge.example.com'), now(), now(), now()),
    (v_auth_sato, v_auth_sato, 'sato@techbridge.example.com', 'email',
     jsonb_build_object('sub', v_auth_sato::text, 'email', 'sato@techbridge.example.com'), now(), now(), now()),
    (v_auth_takahashi, v_auth_takahashi, 'takahashi@techbridge.example.com', 'email',
     jsonb_build_object('sub', v_auth_takahashi::text, 'email', 'takahashi@techbridge.example.com'), now(), now(), now()),
    (v_auth_ito, v_auth_ito, 'ito@techbridge.example.com', 'email',
     jsonb_build_object('sub', v_auth_ito::text, 'email', 'ito@techbridge.example.com'), now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ============================================
  -- 5名を members テーブルに追加（既存チェック付き）
  -- 田中はメンバーだが投稿なし → 利用率 5/6
  -- ============================================
  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  SELECT v_auth_suzuki, v_company1_id, v_p_suzuki, '鈴木花子', 'suzuki@techbridge.example.com', true
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE profile_id = v_p_suzuki);

  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  SELECT v_auth_tanaka, v_company1_id, v_p_tanaka, '田中一郎', 'tanaka@techbridge.example.com', true
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE profile_id = v_p_tanaka);

  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  SELECT v_auth_sato, v_company1_id, v_p_sato, '佐藤美咲', 'sato@techbridge.example.com', true
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE profile_id = v_p_sato);

  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  SELECT v_auth_takahashi, v_company1_id, v_p_takahashi, '高橋健太', 'takahashi@techbridge.example.com', true
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE profile_id = v_p_takahashi);

  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  SELECT v_auth_ito, v_company1_id, v_p_ito, '伊藤裕子', 'ito@techbridge.example.com', true
  WHERE NOT EXISTS (SELECT 1 FROM members WHERE profile_id = v_p_ito);

  -- ============================================
  -- タイムライン投稿 8件追加
  -- ============================================
  INSERT INTO timeline_posts (company_id, user_id, content, category, is_anonymous, created_at, updated_at) VALUES

  -- 1. 鈴木花子 → 佐藤美咲（2.5ヶ月前 = 12月下旬）
  (v_company1_id, v_auth_suzuki,
   'ダッシュボードの新UIデザイン素晴らしい！ユーザーテストでも「見やすくなった」と好評でした。デザインシステムへの落とし込みまで完璧。佐藤さんのこだわりがプロダクトの品質を底上げしてくれています。',
   'お客様目線で考える', false, '2025-12-28 10:30:00+09', '2025-12-28 10:30:00+09'),

  -- 2. 鈴木花子 → 山田太郎（1ヶ月前 = 2月中旬）
  (v_company1_id, v_auth_suzuki,
   '全社ミーティングでのビジョン共有、チームの士気が上がりました。特に来期の戦略の説明が明快で、開発の方向性が定まりました。山田さんの言葉には説得力がありますね。',
   '仲間の成果を称える', false, '2026-02-13 16:00:00+09', '2026-02-13 16:00:00+09'),

  -- 3. 佐藤美咲 → 高橋健太（1.5ヶ月前 = 1月下旬）
  (v_company1_id, v_auth_sato,
   'カスタマーサポートページのFAQ構成案、ユーザー目線で整理されていて感動しました。問い合わせ数30%減に貢献してます。高橋さんのお客様理解力、デザインにも活かしたいです。',
   'シンプルに伝える', false, '2026-01-27 15:30:00+09', '2026-01-27 15:30:00+09'),

  -- 4. 佐藤美咲 → 山田太郎（2週間前 = 2月下旬）
  (v_company1_id, v_auth_sato,
   '展示会ブースのデザインについてアドバイスをいただきありがとうございます。山田さんのブランド戦略の知見がデザインに反映されて、来場者の反応も上々でした。経営視点でのフィードバックがデザインの説得力につながっています。',
   'チームで成し遂げる', false, '2026-02-27 11:45:00+09', '2026-02-27 11:45:00+09'),

  -- 5. 高橋健太 → 鈴木花子（1ヶ月前 = 2月中旬）
  (v_company1_id, v_auth_takahashi,
   '新機能のオンボーディングガイド、すごく丁寧で助かります。お客様に渡すとほぼ質問ゼロで使い始めてもらえるようになりました。鈴木さんの「ユーザーが迷わない設計」の姿勢、見習いたいです。',
   'シンプルに伝える', false, '2026-02-12 10:15:00+09', '2026-02-12 10:15:00+09'),

  -- 6. 高橋健太 → 伊藤裕子（1週間前 = 3月上旬）
  (v_company1_id, v_auth_takahashi,
   '社内勉強会の企画運営ありがとう！ブランディング基礎の回、現場でも意識が変わった実感があります。伊藤さんが選んでくれた事例が分かりやすくて、チーム全体の共通言語が増えました。',
   '失敗を恐れずチャレンジする', false, '2026-03-06 17:30:00+09', '2026-03-06 17:30:00+09'),

  -- 7. 伊藤裕子 → 佐藤美咲（3週間前 = 2月下旬）
  (v_company1_id, v_auth_ito,
   '社内報のデザインリニューアルありがとう！読む人が増えて、経営メッセージの浸透にも繋がっています。佐藤さんのデザインは「伝える力」があって、いつも感心しています。',
   '仲間の成果を称える', false, '2026-02-21 09:00:00+09', '2026-02-21 09:00:00+09'),

  -- 8. 伊藤裕子 → 高橋健太（5日前 = 3月上旬）
  (v_company1_id, v_auth_ito,
   '高橋さんが新規クライアントへの提案書を一緒に作り込んでくれたおかげで受注できました。お客様からも「提案内容が具体的で信頼できた」とお言葉をいただきました。高橋さんの粘り強い姿勢、チーム全体の士気を高めてくれています。',
   'チームで成し遂げる', false, '2026-03-08 13:00:00+09', '2026-03-08 13:00:00+09');

  -- ============================================
  -- 新規投稿にもいいねを追加（他メンバーから）
  -- ============================================

  -- 鈴木の投稿に山田・佐藤がいいね
  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth1, v_company1_id, p.created_at + interval '1 hour'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_suzuki
  ON CONFLICT (post_id, user_id) DO NOTHING;

  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth_sato, v_company1_id, p.created_at + interval '2 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_suzuki
  ON CONFLICT (post_id, user_id) DO NOTHING;

  -- 佐藤の投稿に鈴木・伊藤がいいね
  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth_suzuki, v_company1_id, p.created_at + interval '2 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_sato
  ON CONFLICT (post_id, user_id) DO NOTHING;

  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth_ito, v_company1_id, p.created_at + interval '4 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_sato
  ON CONFLICT (post_id, user_id) DO NOTHING;

  -- 高橋の投稿に山田・佐藤がいいね
  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth1, v_company1_id, p.created_at + interval '1 hour'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_takahashi
  ON CONFLICT (post_id, user_id) DO NOTHING;

  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth_sato, v_company1_id, p.created_at + interval '2 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_takahashi
  ON CONFLICT (post_id, user_id) DO NOTHING;

  -- 伊藤の投稿に山田・鈴木がいいね
  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth1, v_company1_id, p.created_at + interval '1 hour'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_ito
  ON CONFLICT (post_id, user_id) DO NOTHING;

  INSERT INTO timeline_likes (post_id, user_id, company_id, created_at)
  SELECT p.id, v_auth_suzuki, v_company1_id, p.created_at + interval '3 hours'
  FROM timeline_posts p
  WHERE p.company_id = v_company1_id AND p.user_id = v_auth_ito
  ON CONFLICT (post_id, user_id) DO NOTHING;

END $$;

SELECT 'Part 7 メンバー5名追加 + タイムライン投稿8件 完了（田中一郎は投稿なし＝利用率5/6）' AS result;

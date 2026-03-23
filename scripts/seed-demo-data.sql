-- ============================================
-- デモ企業データ シードスクリプト（3社分）
-- ============================================
-- 事前準備:
--   1. Supabase Dashboard > Authentication > Users で以下の3ユーザーを作成（Auto Confirm ON）
--      - demo-admin1@branding.bz / Demo1234!
--      - demo-admin2@branding.bz / Demo1234!
--      - demo-admin3@branding.bz / Demo1234!
--   2. 各ユーザーの UUID をコピーして下記の v_auth1〜v_auth3 に貼り付け
--   3. Supabase SQL Editor でこのスクリプトを実行
-- ============================================

DO $$
DECLARE
  -- ★ Auth UUIDs: Supabase ダッシュボードで作成後にここに貼る
  v_auth1 uuid := 'd537b5f5-3860-4eed-a0d5-ccf6fd7e352f';  -- demo-admin1@branding.bz
  v_auth2 uuid := '72b59b39-5d8b-4283-80a0-f163d0b589ac';  -- demo-admin2@branding.bz
  v_auth3 uuid := '4685e271-4522-4871-8ebe-01a8d3d270a3';  -- demo-admin3@branding.bz

  -- 企業ID
  v_company1 uuid;
  v_company2 uuid;
  v_company3 uuid;

  -- 企業1: プロフィールID（6名）
  v_p1_1 uuid; v_p1_2 uuid; v_p1_3 uuid;
  v_p1_4 uuid; v_p1_5 uuid; v_p1_6 uuid;

  -- 企業2: プロフィールID（3名）
  v_p2_1 uuid; v_p2_2 uuid; v_p2_3 uuid;

  -- 企業3: プロフィールID（2名）
  v_p3_1 uuid; v_p3_2 uuid;

  -- サーベイID
  v_survey1 uuid;
  v_survey2 uuid;

  -- サーベイ設問ID配列
  v_q1_ids uuid[];
  v_q2_ids uuid[];

  -- ループ変数
  v_i int;
  v_qid uuid;
  v_score int;
  v_cat text;
  v_dept text;
  v_role text;
  v_profile_id uuid;
  v_event_type text;
  v_tag text;
  v_tags text[];
  v_rand float;
  v_day_offset int;
  v_ip text;

BEGIN

  -- ============================================
  -- 企業1: 株式会社テックブリッジ（フルデータ）
  -- ============================================

  INSERT INTO companies (
    name, industry_category, industry_subcategory, slogan, mvv,
    brand_story, brand_color_primary, brand_color_secondary,
    website_url, brand_stage, competitors, target_segments
  ) VALUES (
    '株式会社テックブリッジ',
    'IT・テクノロジー',
    'SaaS',
    'テクノロジーで、人と人をつなぐ。',
    'Mission: デジタルの力で中小企業の成長を支援する / Vision: すべての企業がテクノロジーの恩恵を受けられる世界 / Values: 誠実・挑戦・共創',
    '2018年、地方の中小企業がITツールを使いこなせず困っている現場を目の当たりにし創業。',
    '#2563EB',
    '#0EA5E9',
    'https://techbridge-demo.example.com',
    'rebrand',
    '[{"name":"フロンティアSaaS","url":"https://frontier.example.com","colors":["#FF6B35"],"notes":"大手向け"},{"name":"クラウドワークス","url":"https://cw.example.com","colors":["#00B4D8"],"notes":"フリーランス向け"}]'::jsonb,
    '[{"name":"地方中小企業の経営者","description":"従業員10-50名、IT専任者不在"},{"name":"中堅企業のDX推進担当","description":"従業員50-200名、デジタル化推進中"}]'::jsonb
  ) RETURNING id INTO v_company1;

  -- メンバー（profiles）6名
  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '山田太郎', '代表取締役CEO', '経営', 'yamada-taro', 'yamada@techbridge.example.com', 'テクノロジーで中小企業を元気にしたい')
  RETURNING id INTO v_p1_1;

  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '鈴木花子', '取締役CTO', '開発', 'suzuki-hanako', 'suzuki@techbridge.example.com', 'エンジニアリングで価値を届ける')
  RETURNING id INTO v_p1_2;

  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '田中一郎', '営業部長', '営業', 'tanaka-ichiro', 'tanaka@techbridge.example.com', 'お客様の課題解決が喜び')
  RETURNING id INTO v_p1_3;

  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '佐藤美咲', 'デザイナー', '開発', 'sato-misaki', 'sato@techbridge.example.com', 'ユーザー体験を大切にしたい')
  RETURNING id INTO v_p1_4;

  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '高橋健太', 'カスタマーサクセス', '営業', 'takahashi-kenta', 'takahashi@techbridge.example.com', '顧客の成功が自分の成功')
  RETURNING id INTO v_p1_5;

  INSERT INTO profiles (company_id, name, position, department, slug, email, bio)
  VALUES (v_company1, '伊藤裕子', '人事・総務', '管理', 'ito-yuko', 'ito@techbridge.example.com', '働きやすい環境づくり')
  RETURNING id INTO v_p1_6;

  -- admin_users
  INSERT INTO admin_users (auth_id, company_id, role)
  VALUES (v_auth1, v_company1, 'owner');

  -- members（Auth ユーザーを持つ管理者のみ）
  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  VALUES (v_auth1, v_company1, v_p1_1, '山田太郎', 'yamada@techbridge.example.com', true);

  -- brand_guidelines
  INSERT INTO brand_guidelines (company_id, mission, vision, values, brand_story, business_content)
  VALUES (
    v_company1,
    'デジタルの力で中小企業の成長を支援する',
    'すべての企業がテクノロジーの恩恵を受けられる世界',
    '[{"value":"誠実","description":"嘘のない、正直なコミュニケーション"},{"value":"挑戦","description":"現状に満足せず、常に新しい価値を追求"},{"value":"共創","description":"顧客と共に創り上げる姿勢"}]'::jsonb,
    '2018年、地方の中小企業がITツールを使いこなせず困っている現場を目の当たりにし創業。「テクノロジーは難しいもの」という壁を壊し、すべての企業が当たり前にデジタルの恩恵を受けられる世界を目指しています。',
    '[{"title":"業務効率化SaaS","description":"中小企業向けの業務管理・顧客管理クラウドサービス"},{"title":"DX導入支援","description":"IT専任者不在の企業へのデジタル化コンサルティング"}]'::jsonb
  );

  -- brand_visuals
  INSERT INTO brand_visuals (company_id, color_palette)
  VALUES (
    v_company1,
    '{"brand_colors":[{"hex":"#2563EB","name":"テックブルー","role":"Primary"},{"hex":"#0EA5E9","name":"スカイブルー","role":"Secondary"}],"accent_colors":[{"hex":"#F59E0B","name":"アクセントアンバー","role":"Accent"}],"utility_colors":[{"hex":"#1F2937","name":"ダークグレー","role":"Text"},{"hex":"#F3F4F6","name":"ライトグレー","role":"Background"}]}'::jsonb
  );

  -- brand_personalities
  INSERT INTO brand_personalities (company_id, tone_of_voice)
  VALUES (v_company1, 'プロフェッショナルで温かみのある。専門用語を避け、分かりやすい言葉で誠実に伝える。');

  -- brand_personas
  INSERT INTO brand_personas (company_id, name, sort_order, age_range, occupation, description, needs, pain_points)
  VALUES (
    v_company1,
    '地方中小企業の経営者',
    1,
    '45-55歳',
    '製造業 代表取締役',
    '従業員30名程度の製造業を営む。ITに詳しくないが、業務効率化の必要性は感じている。',
    '["簡単に使えるITツール", "コスト負担の少ない導入", "手厚いサポート"]'::jsonb,
    '["IT専任者がいない", "導入しても使いこなせない不安", "費用対効果が見えにくい"]'::jsonb
  );

  -- ── card_views: 過去60日分、約120件 ──
  FOR v_i IN 1..120 LOOP
    v_day_offset := floor(random() * 60)::int;
    -- 山田・田中・高橋を多めに
    v_rand := random();
    IF v_rand < 0.25 THEN v_profile_id := v_p1_1;
    ELSIF v_rand < 0.35 THEN v_profile_id := v_p1_2;
    ELSIF v_rand < 0.55 THEN v_profile_id := v_p1_3;
    ELSIF v_rand < 0.65 THEN v_profile_id := v_p1_4;
    ELSIF v_rand < 0.85 THEN v_profile_id := v_p1_5;
    ELSE v_profile_id := v_p1_6;
    END IF;

    -- IP: 35ユニーク前後を生成
    v_ip := '192.168.' || (floor(random() * 5) + 1)::text || '.' || (floor(random() * 35) + 1)::text;

    INSERT INTO card_views (profile_id, viewed_at, ip_address, user_agent)
    VALUES (
      v_profile_id,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval,
      v_ip,
      'Mozilla/5.0 (demo seed)'
    );
  END LOOP;

  -- ── card_events: 過去60日分、約50件 ──
  FOR v_i IN 1..50 LOOP
    v_day_offset := floor(random() * 60)::int;
    v_rand := random();

    -- プロフィールランダム
    IF v_rand < 0.3 THEN v_profile_id := v_p1_1;
    ELSIF v_rand < 0.5 THEN v_profile_id := v_p1_3;
    ELSIF v_rand < 0.7 THEN v_profile_id := v_p1_5;
    ELSIF v_rand < 0.8 THEN v_profile_id := v_p1_2;
    ELSIF v_rand < 0.9 THEN v_profile_id := v_p1_4;
    ELSE v_profile_id := v_p1_6;
    END IF;

    -- イベントタイプ分布: vcard_download 20, brand_page_click 15, sns_click 8, website_click 5, email_click 2
    IF v_i <= 20 THEN v_event_type := 'vcard_download';
    ELSIF v_i <= 35 THEN v_event_type := 'brand_page_click';
    ELSIF v_i <= 43 THEN v_event_type := 'sns_click';
    ELSIF v_i <= 48 THEN v_event_type := 'website_click';
    ELSE v_event_type := 'email_click';
    END IF;

    INSERT INTO card_events (profile_id, company_id, event_type, visitor_id, created_at)
    VALUES (
      v_profile_id,
      v_company1,
      v_event_type,
      'visitor-' || (floor(random() * 35) + 1)::text,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    );
  END LOOP;

  -- ── brand_page_views: 過去60日分、約30件 ──
  FOR v_i IN 1..30 LOOP
    v_day_offset := floor(random() * 60)::int;
    v_rand := random();
    IF v_rand < 0.3 THEN v_profile_id := v_p1_1;
    ELSIF v_rand < 0.6 THEN v_profile_id := v_p1_3;
    ELSE v_profile_id := v_p1_5;
    END IF;

    INSERT INTO brand_page_views (company_id, source_profile_id, page_type, visitor_id, sections_viewed, duration_seconds, created_at)
    VALUES (
      v_company1,
      v_profile_id,
      'guidelines',
      'visitor-' || (floor(random() * 35) + 1)::text,
      CASE
        WHEN random() < 0.4 THEN ARRAY['vision','values']
        WHEN random() < 0.7 THEN ARRAY['vision','values','mission']
        ELSE ARRAY['vision']
      END,
      (floor(random() * 60) + 15)::int,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    );
  END LOOP;

  -- ── サーベイ（status: closed, 30日前〜14日前） ──
  INSERT INTO brand_surveys (company_id, title, status, starts_at, ends_at, target_response_rate, total_members)
  VALUES (v_company1, '第1回ブランドサーベイ', 'closed', now() - interval '30 days', now() - interval '14 days', 70, 6)
  RETURNING id INTO v_survey1;

  -- ── サーベイ設問 15問（WHY 5 + HOW 5 + WHAT 5） ──
  v_q1_ids := ARRAY[]::uuid[];

  -- WHY 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'why', '自社のミッション・ビジョンを自分の言葉で説明できる', 1) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'why', '自社のブランドストーリーに共感している', 2) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'why', '自社の存在意義を理解している', 3) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'why', '会社の方向性に納得している', 4) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'why', '自社ブランドを誇りに思う', 5) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;

  -- HOW 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'how', 'ブランドカラー・ロゴの使用ルールを知っている', 6) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'how', '自社らしいコミュニケーションスタイルを理解している', 7) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'how', '自社の強み・ポジショニングを説明できる', 8) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'how', 'ターゲット顧客像をイメージできる', 9) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'how', '自社の提供価値を一言で表現できる', 10) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;

  -- WHAT 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'what', '日々の業務でブランド価値観を意識して行動している', 11) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'what', '社外の人にブランドの魅力を伝えている', 12) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'what', 'ブランドガイドラインに沿った資料を作成している', 13) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'what', 'ブランドらしい振る舞いを心がけている', 14) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey1, 'what', '同僚の良い行動を認め合える文化がある', 15) RETURNING id INTO v_qid;
  v_q1_ids := v_q1_ids || v_qid;

  -- ── サーベイ回答 15問×6名 = 90件 ──
  -- 回答者1: 山田（経営/executive） WHY 4-5, HOW 4-5, WHAT 4-5
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;      -- WHY: 4-5
    ELSIF v_i <= 10 THEN v_score := 4 + floor(random() * 2)::int;   -- HOW: 4-5
    ELSE v_score := 4 + floor(random() * 2)::int;                    -- WHAT: 4-5
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '経営', 'executive');
  END LOOP;

  -- 回答者2: 鈴木（開発/manager） WHY 4-5, HOW 4-5, WHAT 3-4
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 4 + floor(random() * 2)::int;
    ELSE v_score := 3 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '開発', 'manager');
  END LOOP;

  -- 回答者3: 田中（営業/manager） WHY 4-5, HOW 3-4, WHAT 4-5
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 3 + floor(random() * 2)::int;
    ELSE v_score := 4 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '営業', 'manager');
  END LOOP;

  -- 回答者4: 佐藤（開発/staff） WHY 3-4, HOW 4-5, WHAT 3-4
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 3 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 4 + floor(random() * 2)::int;
    ELSE v_score := 3 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '開発', 'staff');
  END LOOP;

  -- 回答者5: 高橋（営業/staff） WHY 4-5, HOW 2-3, WHAT 4-5
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 2 + floor(random() * 2)::int;
    ELSE v_score := 4 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '営業', 'staff');
  END LOOP;

  -- 回答者6: 伊藤（管理/staff） WHY 3-4, HOW 3-4, WHAT 2-3
  FOR v_i IN 1..15 LOOP
    v_qid := v_q1_ids[v_i];
    IF v_i <= 5 THEN v_score := 3 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 3 + floor(random() * 2)::int;
    ELSE v_score := 2 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey1, v_qid, v_score, '管理', 'staff');
  END LOOP;

  -- survey_participants: 全員回答済み
  INSERT INTO survey_participants (survey_id, profile_id, responded_at) VALUES
    (v_survey1, v_p1_1, now() - interval '20 days'),
    (v_survey1, v_p1_2, now() - interval '19 days'),
    (v_survey1, v_p1_3, now() - interval '18 days'),
    (v_survey1, v_p1_4, now() - interval '17 days'),
    (v_survey1, v_p1_5, now() - interval '16 days'),
    (v_survey1, v_p1_6, now() - interval '15 days');

  -- ── タグマッピング（8タグ） ──
  INSERT INTO brand_personality_tag_mappings (company_id, tag, is_expected) VALUES
    (v_company1, '信頼感',       true),
    (v_company1, '革新的',       true),
    (v_company1, '親しみやすい', true),
    (v_company1, '専門的',       true),
    (v_company1, '洗練された',   false),
    (v_company1, '情熱的',       false),
    (v_company1, '堅実',         false),
    (v_company1, '遊び心がある', false);

  -- ── マイクロフィードバック 40件 ──
  -- 分布: 信頼感70%, 専門的55%, 親しみやすい40%, 革新的30%, 堅実20%, 洗練10%, 情熱8%, 遊び心5%
  FOR v_i IN 1..40 LOOP
    v_tags := ARRAY[]::text[];
    IF random() < 0.70 THEN v_tags := array_append(v_tags, '信頼感'); END IF;
    IF random() < 0.55 THEN v_tags := array_append(v_tags, '専門的'); END IF;
    IF random() < 0.40 THEN v_tags := array_append(v_tags, '親しみやすい'); END IF;
    IF random() < 0.30 THEN v_tags := array_append(v_tags, '革新的'); END IF;
    IF random() < 0.20 THEN v_tags := array_append(v_tags, '堅実'); END IF;
    IF random() < 0.10 THEN v_tags := array_append(v_tags, '洗練された'); END IF;
    IF random() < 0.08 THEN v_tags := array_append(v_tags, '情熱的'); END IF;
    IF random() < 0.05 THEN v_tags := array_append(v_tags, '遊び心がある'); END IF;

    -- 最低1つのタグを保証
    IF array_length(v_tags, 1) IS NULL THEN
      v_tags := ARRAY['信頼感'];
    END IF;

    -- ランダムなプロフィール
    v_rand := random();
    IF v_rand < 0.3 THEN v_profile_id := v_p1_1;
    ELSIF v_rand < 0.5 THEN v_profile_id := v_p1_3;
    ELSIF v_rand < 0.7 THEN v_profile_id := v_p1_5;
    ELSE v_profile_id := v_p1_2;
    END IF;

    v_day_offset := floor(random() * 60)::int;

    INSERT INTO brand_micro_feedbacks (company_id, source_profile_id, tags, visitor_id, created_at)
    VALUES (
      v_company1,
      v_profile_id,
      v_tags,
      'fb-visitor-' || (floor(random() * 30) + 1)::text,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    );
  END LOOP;

  -- ── スナップショット 3件（右肩上がり） ──
  -- 3ヶ月前: total 50, inner 58, outer 42, rank B
  INSERT INTO brand_score_snapshots (
    company_id, snapshot_date, period_days,
    inner_score, inner_why, inner_how, inner_what, inner_survey_id, inner_response_rate,
    outer_score, outer_reach, outer_interest, outer_transition, outer_engagement, outer_impression,
    total_score, rank, metadata
  ) VALUES (
    v_company1, (current_date - interval '90 days')::date, 30,
    58, 65, 52, 57, v_survey1, 100,
    42, 35, 40, 45, 48, NULL,
    50, 'B', '{}'::jsonb
  );

  -- 2ヶ月前: total 58, inner 62, outer 55, rank B
  INSERT INTO brand_score_snapshots (
    company_id, snapshot_date, period_days,
    inner_score, inner_why, inner_how, inner_what, inner_survey_id, inner_response_rate,
    outer_score, outer_reach, outer_interest, outer_transition, outer_engagement, outer_impression,
    total_score, rank, metadata
  ) VALUES (
    v_company1, (current_date - interval '60 days')::date, 30,
    62, 68, 58, 60, v_survey1, 100,
    55, 45, 52, 58, 62, NULL,
    58, 'B+', '{}'::jsonb
  );

  -- 1ヶ月前: total 66, inner 68, outer 65, rank B+
  INSERT INTO brand_score_snapshots (
    company_id, snapshot_date, period_days,
    inner_score, inner_why, inner_how, inner_what, inner_survey_id, inner_response_rate,
    outer_score, outer_reach, outer_interest, outer_transition, outer_engagement, outer_impression,
    total_score, rank, metadata
  ) VALUES (
    v_company1, (current_date - interval '30 days')::date, 30,
    68, 72, 63, 68, v_survey1, 100,
    65, 55, 62, 68, 72, NULL,
    66, 'B+', '{}'::jsonb
  );

  -- スケジュール設定: brand_score_schedules テーブル未作成のためスキップ


  -- ============================================
  -- 企業2: 合同会社ナチュラルキッチン（中程度データ）
  -- ============================================

  INSERT INTO companies (
    name, industry_category, industry_subcategory, slogan, mvv,
    brand_color_primary, website_url, brand_stage, competitors, target_segments
  ) VALUES (
    '合同会社ナチュラルキッチン',
    'サービス',
    '飲食',
    '自然の恵みを、食卓に。',
    '地産地消で地域の食文化を守り、未来の食卓を豊かにする',
    '#16A34A',
    'https://natural-kitchen.example.com',
    'new',
    '[{"name":"オーガニックマルシェ","url":"","colors":[],"notes":""}]'::jsonb,
    '[{"name":"健康志向の30-40代女性","description":"子育て世代、食の安全に関心が高い"}]'::jsonb
  ) RETURNING id INTO v_company2;

  -- メンバー（profiles）3名
  INSERT INTO profiles (company_id, name, position, department, slug, email)
  VALUES (v_company2, '中村和也', '代表', '経営', 'nakamura-kazuya', 'nakamura@natural-kitchen.example.com')
  RETURNING id INTO v_p2_1;

  INSERT INTO profiles (company_id, name, position, department, slug, email)
  VALUES (v_company2, '渡辺さくら', '店長', '店舗', 'watanabe-sakura', 'watanabe@natural-kitchen.example.com')
  RETURNING id INTO v_p2_2;

  INSERT INTO profiles (company_id, name, position, department, slug, email)
  VALUES (v_company2, '小林大輔', '料理長', 'キッチン', 'kobayashi-daisuke', 'kobayashi@natural-kitchen.example.com')
  RETURNING id INTO v_p2_3;

  -- admin_users
  INSERT INTO admin_users (auth_id, company_id, role)
  VALUES (v_auth2, v_company2, 'owner');

  -- members（Auth ユーザーを持つ管理者のみ）
  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  VALUES (v_auth2, v_company2, v_p2_1, '中村和也', 'nakamura@natural-kitchen.example.com', true);

  -- brand_guidelines（一部のみ）
  INSERT INTO brand_guidelines (company_id, mission, vision, values, business_content)
  VALUES (
    v_company2,
    '地産地消で地域の食文化を守る',
    '未来の食卓を豊かにする',
    '[{"value":"地産地消","description":""},{"value":"安心安全","description":""},{"value":"おもてなし","description":""}]'::jsonb,
    '[{"title":"地産地消レストラン","description":"地元農家から仕入れた旬の食材を使った料理を提供"}]'::jsonb
  );

  -- brand_visuals（primary 1色のみ）
  INSERT INTO brand_visuals (company_id, color_palette)
  VALUES (
    v_company2,
    '{"brand_colors":[{"hex":"#16A34A","name":"ナチュラルグリーン","role":"Primary"}],"accent_colors":[],"utility_colors":[]}'::jsonb
  );

  -- ── card_views: 過去60日分、約20件 ──
  FOR v_i IN 1..20 LOOP
    v_day_offset := floor(random() * 60)::int;
    v_rand := random();
    IF v_rand < 0.5 THEN v_profile_id := v_p2_1;
    ELSIF v_rand < 0.8 THEN v_profile_id := v_p2_2;
    ELSE v_profile_id := v_p2_3;
    END IF;

    v_ip := '10.0.' || (floor(random() * 3) + 1)::text || '.' || (floor(random() * 10) + 1)::text;

    INSERT INTO card_views (profile_id, viewed_at, ip_address, user_agent)
    VALUES (
      v_profile_id,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval,
      v_ip,
      'Mozilla/5.0 (demo seed)'
    );
  END LOOP;

  -- ── card_events: 約8件 ──
  FOR v_i IN 1..8 LOOP
    v_day_offset := floor(random() * 60)::int;
    v_rand := random();
    IF v_rand < 0.5 THEN v_profile_id := v_p2_1;
    ELSE v_profile_id := v_p2_2;
    END IF;

    IF v_i <= 4 THEN v_event_type := 'vcard_download';
    ELSIF v_i <= 6 THEN v_event_type := 'brand_page_click';
    ELSIF v_i <= 7 THEN v_event_type := 'sns_click';
    ELSE v_event_type := 'website_click';
    END IF;

    INSERT INTO card_events (profile_id, company_id, event_type, visitor_id, created_at)
    VALUES (
      v_profile_id,
      v_company2,
      v_event_type,
      'visitor-nk-' || (floor(random() * 10) + 1)::text,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 86400) || ' seconds')::interval
    );
  END LOOP;

  -- ── brand_page_views: 約5件 ──
  FOR v_i IN 1..5 LOOP
    v_day_offset := floor(random() * 60)::int;
    INSERT INTO brand_page_views (company_id, source_profile_id, page_type, visitor_id, sections_viewed, duration_seconds, created_at)
    VALUES (
      v_company2,
      v_p2_1,
      'guidelines',
      'visitor-nk-' || (floor(random() * 10) + 1)::text,
      ARRAY['vision','values'],
      (floor(random() * 40) + 10)::int,
      now() - (v_day_offset || ' days')::interval
    );
  END LOOP;

  -- ── サーベイ（status: closed） ──
  INSERT INTO brand_surveys (company_id, title, status, starts_at, ends_at, target_response_rate, total_members)
  VALUES (v_company2, '第1回ブランドサーベイ', 'closed', now() - interval '28 days', now() - interval '14 days', 70, 3)
  RETURNING id INTO v_survey2;

  -- サーベイ設問 15問
  v_q2_ids := ARRAY[]::uuid[];

  -- WHY 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'why', '自社のミッション・ビジョンを自分の言葉で説明できる', 1) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'why', '自社のブランドストーリーに共感している', 2) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'why', '自社の存在意義を理解している', 3) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'why', '会社の方向性に納得している', 4) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'why', '自社ブランドを誇りに思う', 5) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;

  -- HOW 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'how', 'ブランドカラー・ロゴの使用ルールを知っている', 6) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'how', '自社らしいコミュニケーションスタイルを理解している', 7) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'how', '自社の強み・ポジショニングを説明できる', 8) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'how', 'ターゲット顧客像をイメージできる', 9) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'how', '自社の提供価値を一言で表現できる', 10) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;

  -- WHAT 5問
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'what', '日々の業務でブランド価値観を意識して行動している', 11) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'what', '社外の人にブランドの魅力を伝えている', 12) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'what', 'ブランドガイドラインに沿った資料を作成している', 13) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'what', 'ブランドらしい振る舞いを心がけている', 14) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;
  INSERT INTO brand_survey_questions (survey_id, category, question_text, sort_order)
  VALUES (v_survey2, 'what', '同僚の良い行動を認め合える文化がある', 15) RETURNING id INTO v_qid;
  v_q2_ids := v_q2_ids || v_qid;

  -- ── サーベイ回答 15問×3名 = 45件 ──
  -- 中村（経営/executive） WHY 4-5, HOW 3-4, WHAT 4-5
  FOR v_i IN 1..15 LOOP
    v_qid := v_q2_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 3 + floor(random() * 2)::int;
    ELSE v_score := 4 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey2, v_qid, v_score, '経営', 'executive');
  END LOOP;

  -- 渡辺（店舗/staff） WHY 4-5, HOW 2-3, WHAT 3-4
  FOR v_i IN 1..15 LOOP
    v_qid := v_q2_ids[v_i];
    IF v_i <= 5 THEN v_score := 4 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 2 + floor(random() * 2)::int;
    ELSE v_score := 3 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey2, v_qid, v_score, '店舗', 'staff');
  END LOOP;

  -- 小林（キッチン/staff） WHY 3-4, HOW 2-3, WHAT 3-4
  FOR v_i IN 1..15 LOOP
    v_qid := v_q2_ids[v_i];
    IF v_i <= 5 THEN v_score := 3 + floor(random() * 2)::int;
    ELSIF v_i <= 10 THEN v_score := 2 + floor(random() * 2)::int;
    ELSE v_score := 3 + floor(random() * 2)::int;
    END IF;
    INSERT INTO brand_survey_responses (survey_id, question_id, score, department, role_category)
    VALUES (v_survey2, v_qid, v_score, 'キッチン', 'staff');
  END LOOP;

  -- survey_participants: 全員回答済み
  INSERT INTO survey_participants (survey_id, profile_id, responded_at) VALUES
    (v_survey2, v_p2_1, now() - interval '20 days'),
    (v_survey2, v_p2_2, now() - interval '18 days'),
    (v_survey2, v_p2_3, now() - interval '16 days');

  -- ── タグマッピング（8タグ） ──
  INSERT INTO brand_personality_tag_mappings (company_id, tag, is_expected) VALUES
    (v_company2, '親しみやすい', true),
    (v_company2, '堅実',         true),
    (v_company2, '信頼感',       true),
    (v_company2, '革新的',       false),
    (v_company2, '専門的',       false),
    (v_company2, '洗練された',   false),
    (v_company2, '情熱的',       false),
    (v_company2, '遊び心がある', false);

  -- ── マイクロフィードバック 10件のみ（閾値30件未満） ──
  FOR v_i IN 1..10 LOOP
    v_tags := ARRAY[]::text[];
    IF random() < 0.60 THEN v_tags := array_append(v_tags, '親しみやすい'); END IF;
    IF random() < 0.40 THEN v_tags := array_append(v_tags, '信頼感'); END IF;
    IF random() < 0.30 THEN v_tags := array_append(v_tags, '堅実'); END IF;
    IF random() < 0.15 THEN v_tags := array_append(v_tags, '情熱的'); END IF;

    IF array_length(v_tags, 1) IS NULL THEN
      v_tags := ARRAY['親しみやすい'];
    END IF;

    v_day_offset := floor(random() * 60)::int;

    INSERT INTO brand_micro_feedbacks (company_id, source_profile_id, tags, visitor_id, created_at)
    VALUES (
      v_company2,
      v_p2_1,
      v_tags,
      'fb-visitor-nk-' || (floor(random() * 8) + 1)::text,
      now() - (v_day_offset || ' days')::interval
    );
  END LOOP;

  -- スナップショット: なし
  -- スケジュール: なし


  -- ============================================
  -- 企業3: 株式会社アーバンクラフト（最低限データ）
  -- ============================================

  INSERT INTO companies (
    name, industry_category, industry_subcategory, competitors, target_segments
  ) VALUES (
    '株式会社アーバンクラフト',
    'クリエイティブ',
    'デザイン',
    '[]'::jsonb,
    '[]'::jsonb
  ) RETURNING id INTO v_company3;

  -- メンバー（profiles）2名
  INSERT INTO profiles (company_id, name, position, slug, email)
  VALUES (v_company3, '木村拓也', '代表', 'kimura-takuya', 'kimura@urbancraft.example.com')
  RETURNING id INTO v_p3_1;

  INSERT INTO profiles (company_id, name, position, slug, email)
  VALUES (v_company3, '松本あかり', 'デザイナー', 'matsumoto-akari', 'matsumoto@urbancraft.example.com')
  RETURNING id INTO v_p3_2;

  -- admin_users
  INSERT INTO admin_users (auth_id, company_id, role)
  VALUES (v_auth3, v_company3, 'owner');

  -- members（Auth ユーザーを持つ管理者のみ）
  INSERT INTO members (auth_id, company_id, profile_id, display_name, email, is_active)
  VALUES (v_auth3, v_company3, v_p3_1, '木村拓也', 'kimura@urbancraft.example.com', true);

  -- ブランド関連データ: 全て未入力（レコードなし）
  -- アウターデータ: 全て0件
  -- インナーデータ: 全て0件
  -- マイクロFB: 0件
  -- スナップショット: なし
  -- スケジュール: なし


  -- ============================================
  -- 完了ログ
  -- ============================================
  RAISE NOTICE '=== デモデータ投入完了 ===';
  RAISE NOTICE '企業1 (テックブリッジ):       %', v_company1;
  RAISE NOTICE '企業2 (ナチュラルキッチン):   %', v_company2;
  RAISE NOTICE '企業3 (アーバンクラフト):     %', v_company3;
  RAISE NOTICE '';
  RAISE NOTICE 'ログイン情報:';
  RAISE NOTICE '  demo-admin1@branding.bz / Demo1234! → テックブリッジ（フル）';
  RAISE NOTICE '  demo-admin2@branding.bz / Demo1234! → ナチュラルキッチン（中程度）';
  RAISE NOTICE '  demo-admin3@branding.bz / Demo1234! → アーバンクラフト（最低限）';

END $$;

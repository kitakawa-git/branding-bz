-- ============================================
-- Part 8: プラン別モデルケース調整
-- テックブリッジ → Brand Premium（変更なし）
-- ナチュラルキッチン → Brand Standard（Premium限定データ削除）
-- アーバンクラフト → Brand Card（名刺データ追加）
-- ============================================

DO $$
DECLARE
  v_company2_id UUID;
  v_company3_id UUID;
  v_p3_1 UUID;  -- 木村拓也
  v_p3_2 UUID;  -- 松本あかり
  v_day_offset INT;
  v_rand FLOAT;
  v_profile_id UUID;
  v_ip TEXT;
  v_visitor_id TEXT;
  v_event_type TEXT;
  v_tags TEXT[];
  v_i INT;
BEGIN
  SELECT id INTO v_company2_id FROM companies WHERE name = '合同会社ナチュラルキッチン';
  SELECT id INTO v_company3_id FROM companies WHERE name = '株式会社アーバンクラフト';
  SELECT id INTO v_p3_1 FROM profiles WHERE slug = 'kimura-takuya';
  SELECT id INTO v_p3_2 FROM profiles WHERE slug = 'matsumoto-akari';

  -- ============================================
  -- 企業2: ナチュラルキッチン → Brand Standard
  -- Premium限定データを削除
  -- ============================================

  -- 1. サーベイ関連を全削除（Premium限定）
  DELETE FROM survey_participants
    WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id = v_company2_id);

  DELETE FROM brand_survey_responses
    WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id = v_company2_id);

  DELETE FROM brand_survey_questions
    WHERE survey_id IN (SELECT id FROM brand_surveys WHERE company_id = v_company2_id);

  DELETE FROM brand_surveys WHERE company_id = v_company2_id;

  -- 2. ブランドスコアスナップショット削除（Premium限定）
  DELETE FROM brand_score_snapshots WHERE company_id = v_company2_id;

  -- 3. 印象タグマッピングAI提案を削除（Premium限定）
  -- ※マイクロFB自体はStandardでも○なので残す
  DELETE FROM brand_personality_tag_mappings WHERE company_id = v_company2_id;

  -- ※ ナチュラルキッチンにはタイムライン・お知らせ・KPIデータはもともと存在しない
  -- ※ brand_score_schedules もデータなし（テーブル自体がseed時点では未作成だったため）

  RAISE NOTICE '企業2（ナチュラルキッチン）: Premium限定データ削除完了';

  -- ============================================
  -- 企業2: brand_terms に2件追加（Standard の価値: 掲示充実）
  -- 既存: sort_order 0〜4 の5件
  -- ============================================

  INSERT INTO brand_terms (company_id, preferred_term, avoided_term, context, category, sort_order)
  VALUES
    (v_company2_id, 'ご来店', '来店、入店', 'お客様向け文書では丁寧な表現を使用。「ご来店ありがとうございます」が基本形', '接客', 5),
    (v_company2_id, '季節メニュー', '期間限定メニュー、限定メニュー', '「季節」という言葉の温かみを大切に。旬の食材と季節感を伝える', '表現', 6)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '企業2（ナチュラルキッチン）: brand_terms 2件追加完了';

  -- ============================================
  -- 企業3: アーバンクラフト → Brand Card
  -- 名刺データを追加（Card プランの価値: 名刺＋閲覧解析）
  -- ============================================

  -- 1. card_views: 過去30日分、15件
  --    木村多め（10件）、松本（5件）
  --    ユニークvisitor: 7名前後
  FOR v_i IN 1..15 LOOP
    v_day_offset := floor(random() * 30)::int;

    -- 木村:松本 = 10:5
    IF v_i <= 10 THEN
      v_profile_id := v_p3_1;
    ELSE
      v_profile_id := v_p3_2;
    END IF;

    -- 7ユニークIP
    v_ip := '10.0.1.' || ((v_i % 7) + 1)::text;

    INSERT INTO card_views (profile_id, viewed_at, ip_address, user_agent)
    VALUES (
      v_profile_id,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 43200) || ' seconds')::interval,
      v_ip,
      'Mozilla/5.0 (demo seed)'
    );
  END LOOP;

  RAISE NOTICE '企業3（アーバンクラフト）: card_views 15件追加完了';

  -- 2. card_events: 6件
  --    vcard_download: 3件, sns_click: 2件, website_click: 1件
  FOR v_i IN 1..6 LOOP
    v_day_offset := floor(random() * 30)::int;

    -- 木村多め
    IF v_i <= 4 THEN
      v_profile_id := v_p3_1;
    ELSE
      v_profile_id := v_p3_2;
    END IF;

    -- イベントタイプ
    IF v_i <= 3 THEN
      v_event_type := 'vcard_download';
    ELSIF v_i <= 5 THEN
      v_event_type := 'sns_click';
    ELSE
      v_event_type := 'website_click';
    END IF;

    v_visitor_id := 'visitor-uc-' || ((v_i % 5) + 1)::text;

    INSERT INTO card_events (profile_id, company_id, event_type, visitor_id, created_at)
    VALUES (
      v_profile_id,
      v_company3_id,
      v_event_type,
      v_visitor_id,
      now() - (v_day_offset || ' days')::interval - (floor(random() * 43200) || ' seconds')::interval
    );
  END LOOP;

  RAISE NOTICE '企業3（アーバンクラフト）: card_events 6件追加完了';

  -- 3. brand_micro_feedbacks: 5件
  --    閾値30件未満なので印象一致度は「データ収集中」
  FOR v_i IN 1..5 LOOP
    v_tags := ARRAY[]::text[];

    -- タグをランダムに付与
    IF random() < 0.60 THEN v_tags := array_append(v_tags, '洗練された'); END IF;
    IF random() < 0.50 THEN v_tags := array_append(v_tags, '革新的'); END IF;
    IF random() < 0.30 THEN v_tags := array_append(v_tags, '専門的'); END IF;
    IF random() < 0.20 THEN v_tags := array_append(v_tags, '情熱的'); END IF;

    -- 最低1タグ保証
    IF array_length(v_tags, 1) IS NULL THEN
      v_tags := ARRAY['洗練された'];
    END IF;

    v_day_offset := floor(random() * 30)::int;

    -- 木村のプロフィールに対するFB
    INSERT INTO brand_micro_feedbacks (company_id, source_profile_id, tags, visitor_id, created_at)
    VALUES (
      v_company3_id,
      v_p3_1,
      v_tags,
      'fb-visitor-uc-' || v_i::text,
      now() - (v_day_offset || ' days')::interval
    );
  END LOOP;

  RAISE NOTICE '企業3（アーバンクラフト）: brand_micro_feedbacks 5件追加完了';

END $$;

SELECT 'Part 8 プラン別モデルケース調整完了' AS result;

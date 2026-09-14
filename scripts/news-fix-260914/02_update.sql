-- ============================================================
-- §7 ニュース記事 文言修正 / STEP 2: 更新
-- 前提: 01_backup_and_precheck.sql を実行済みで、10件が退避されていること
-- 全体が1トランザクション。1つでも条件を満たさなければ全体を中止します。
-- 変更するのは title / summary / body / updated_at のみ。
-- slug・published_at・is_published・category は変更しません。
-- ============================================================
begin;

-- ------------------------------------------------------------
-- ガード1: 退避表が存在し10件あること
-- ------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from public.news_backup_260914;
  if n <> 10 then
    raise exception '退避表の件数が10件ではありません (%). 01 を先に実行してください。', n;
  end if;
end $$;

-- ------------------------------------------------------------
-- ガード2: 01 実行時点から本文が変わっていないこと（他セッションの編集検出）
-- ------------------------------------------------------------
do $$
declare bad text;
begin
  select string_agg(n.slug, ', ') into bad
  from public.news n
  join public.news_backup_260914 b on b.id = n.id
  where md5(n.body) is distinct from md5(b.body)
     or n.title is distinct from b.title
     or n.summary is distinct from b.summary;
  if bad is not null then
    raise exception '退避後に編集された記事があります: %。中止します。', bad;
  end if;
end $$;

-- ------------------------------------------------------------
-- ガード3: 置換対象の文字列が実在すること（1つでも欠けたら中止）
-- ------------------------------------------------------------
do $$
declare missing text := '';
begin
  -- 本文中に必ず存在すべき断片
  if not exists (select 1 from public.news where slug='persona-builder-journey-map' and body like '%認知 → 興味 → 検討 → 購入 → 定着%') then missing := missing || ' persona/定着'; end if;
  if not exists (select 1 from public.news where slug='persona-builder-journey-map' and body like '%手がかりが厚くなります%') then missing := missing || ' persona/手がかり'; end if;
  if not exists (select 1 from public.news where slug='persona-builder-journey-map' and summary like '%認知から定着まで%') then missing := missing || ' persona/summary'; end if;
  if not exists (select 1 from public.news where slug='branding-bz-launch' and body like '%他に類を見ません%') then missing := missing || ' launch/類を見ません'; end if;
  if not exists (select 1 from public.news where slug='branding-bz-launch' and body like '%（無料でお試し可能）%') then missing := missing || ' launch/無料'; end if;
  if not exists (select 1 from public.news where slug='brand-comprehension-quiz' and body like '%テスト本人には解説で学習%') then missing := missing || ' quiz/解説で学習'; end if;
  if not exists (select 1 from public.news where slug='stp-positioning-map' and body like '%最適な2軸を自動提案%') then missing := missing || ' stp/最適な2軸'; end if;
  if not exists (select 1 from public.news where slug='stp-positioning-map' and body like '%連携モーダルを刷新%') then missing := missing || ' stp/モーダル'; end if;
  if not exists (select 1 from public.news where slug='brand-personality-tool' and body like '%への収斂は許容しつつ%') then missing := missing || ' personality/収斂'; end if;
  if not exists (select 1 from public.news where slug='video-learning-launch' and body like '%視聴セッションごとに1行で管理され%') then missing := missing || ' video/セッション'; end if;
  if not exists (select 1 from public.news where slug='pwa-and-mobile-ux' and body like '%スタンドアロン起動%') then missing := missing || ' pwa/スタンドアロン'; end if;
  if not exists (select 1 from public.news where slug='pwa-and-mobile-ux' and body like '%オフラインフォールバック%') then missing := missing || ' pwa/フォールバック'; end if;
  if not exists (select 1 from public.news where slug='pwa-and-mobile-ux' and body like '%トーストで通知%') then missing := missing || ' pwa/トースト'; end if;
  if not exists (select 1 from public.news where slug='portal-brand-four-quadrants' and title like '%4象限構造に刷新%') then missing := missing || ' portal/title'; end if;
  if not exists (select 1 from public.news where slug='portal-brand-four-quadrants' and body like '%## 新しい4象限%') then missing := missing || ' portal/見出し'; end if;
  if not exists (select 1 from public.news where slug='video-learning-categories' and body like '%未分類の動画も生存%') then missing := missing || ' vlcat/生存'; end if;
  if not exists (select 1 from public.news where slug='web-push-notifications' and body like '%無効になった購読は自動クリーンアップ%') then missing := missing || ' push/購読'; end if;

  if missing <> '' then
    raise exception '置換対象の文字列が見つかりません:%。既に適用済みの可能性があります。中止します。', missing;
  end if;
end $$;

-- ============================================================
-- 更新本体
-- 日付は「実行した日（日本時間）」が入ります。SQL作成日は埋め込みません。
-- ============================================================

-- 1. persona-builder-journey-map ------------------------------
update public.news set
  body = replace(replace(body,
           '認知 → 興味 → 検討 → 購入 → 定着',
           '認知 → 興味 → 検討 → 購入 → 継続'),
           '後段の検討（メッセージ・施策）の手がかりが厚くなります',
           'メッセージや施策を考える手がかりが増えます')
         || E'\n\n---\n\n'
         || '※ ' || to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD')
         || ' 訂正：公開時に最終フェーズを「定着」と記載していましたが、正しくは「継続」です。' || E'\n\n'
         || '※ 本記事の「branding.bz 本体への連携」は、作成結果をブランド情報に反映する操作を指します。',
  summary = replace(summary, '認知から定着まで', '認知から継続まで'),
  updated_at = now()
where slug = 'persona-builder-journey-map';

-- 2. branding-bz-launch ---------------------------------------
update public.news set
  body = replace(replace(body,
           '社員サーベイ（インナー）と名刺の閲覧・反応データ（アウター）を同じスコアに統合。両方を測れるブランディングSaaSは他に類を見ません',
           '社員サーベイ（インナー）と名刺の閲覧・反応データ（アウター）を、同じスコアに統合して確認できます'),
           '（無料でお試し可能）', '（無料登録でお試し可能）')
         || E'\n\n---\n\n'
         || '※ ' || to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD')
         || ' 更新：比較根拠を確認できない独自性の表現を削除しました。' || E'\n\n'
         || '※ 現在、Good Jobタイムラインは「Good Action投稿」という名称で提供しています。' || E'\n\n'
         || '※ 現在、市場調査を含むアウターと統合したスコアはEnterpriseプランで提供しています。最新の内容は[料金プラン](https://branding.bz/plan)をご覧ください。（'
         || to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD') || '時点）',
  updated_at = now()
where slug = 'branding-bz-launch';

-- 3. brand-comprehension-quiz ---------------------------------
update public.news set
  body = replace(body,
           '- **テスト本人には解説で学習** — 不正解の設問にはAIによる「なぜそうなのか」の解説を表示し、その場でブランド理解を深められます',
           '- **回答後の解説で、理解を深められます** — 不正解の設問には、AIが「なぜそうなのか」の解説を表示します')
         || E'\n\n---\n\n'
         || '※ 現在、この機能は「理解度×共感ギャップ分析」という名称で提供しています。（'
         || to_char(now() at time zone 'Asia/Tokyo','YYYY-MM-DD') || '時点）',
  updated_at = now()
where slug = 'brand-comprehension-quiz';

-- 4. stp-positioning-map --------------------------------------
update public.news set
  body = replace(replace(body,
           '最適な2軸を自動提案', '業界やターゲットに応じた2軸を自動提案'),
           '- **branding.bz 本体への連携モーダルを刷新** — 単純な確認ダイアログから、**連携項目を個別にON/OFF** できるチェックボックス式へ。既存値がある場合は事前にプレビューと上書き警告を表示します',
           '- **ブランド情報に反映する項目を、1つずつ選べるようになりました** — 既存値がある場合は事前にプレビューと上書き警告を表示します')
         || E'\n\n'
         || '※ 本記事の「branding.bz 本体への連携」は、作成結果をブランド情報に反映する操作を指します。',
  updated_at = now()
where slug = 'stp-positioning-map';

-- 5. brand-personality-tool -----------------------------------
update public.news set
  body = replace(body,
           'ブランドの型（誠実型・革新型 など）への収斂は許容しつつ、固有のコピーや事例を含むキャラクター文で個性を立たせます',
           '基本タイプ（誠実型・革新型 など）を手がかりにしながら、固有のコピーや事例で自社ならではの個性を言葉にします')
         || E'\n\n---\n\n'
         || '※ 本記事の「branding.bz 本体への連携」は、作成結果をブランド情報に反映する操作を指します。',
  updated_at = now()
where slug = 'brand-personality-tool';

-- 6. video-learning-launch ------------------------------------
update public.news set
  body = replace(body,
           '視聴セッションごとに1行で管理され、90%到達／再生終了で「完了」と判定されます',
           '動画ごとの視聴状況を記録し、90%まで見るか再生し終えると「完了」になります'),
  updated_at = now()
where slug = 'video-learning-launch';

-- 7. pwa-and-mobile-ux ----------------------------------------
update public.news set
  body = replace(replace(replace(body,
           'ネイティブアプリのようにスタンドアロン起動できる',
           'ネイティブアプリのようにブラウザの枠のない画面で起動できる'),
           '- **オフラインフォールバック** — 通信が切れたときは認証情報を含まない静的ページを表示。再接続時は自動でレジューム',
           '- **オフライン時の案内** — 通信が切れたときは専用の案内画面を表示します。この画面に認証情報は含まれません'),
           '画面下にトーストで通知し', '画面下に短いメッセージで通知し'),
  updated_at = now()
where slug = 'pwa-and-mobile-ux';

-- 8. portal-brand-four-quadrants ------------------------------
update public.news set
  title   = replace(title, '4象限構造に刷新', '4つの視点で共有できるように'),
  body    = replace(body, '4象限', '4つの視点'),
  summary = replace(summary, '4象限', '4つの視点'),
  updated_at = now()
where slug = 'portal-brand-four-quadrants';

-- 9. video-learning-categories --------------------------------
update public.news set
  body = replace(body,
           '- **未分類の動画も生存** — テーマを削除しても動画は失われず、自動的に「その他」グループへ。安全に整理ができます',
           '- **テーマを削除しても動画は残ります** — 自動的に「その他」グループへ移り、安全に整理できます'),
  updated_at = now()
where slug = 'video-learning-categories';

-- 10. web-push-notifications ----------------------------------
update public.news set
  body = replace(body,
           '- **無効になった購読は自動クリーンアップ** — 削除されたデバイス・許可取り消しの購読はサーバー側で検知して自動削除し、配信を健全に保ちます',
           '- **送信できなくなった登録情報は自動で削除** — 通知を送信できなくなった登録情報は、自動で削除されます。削除されたデバイスや許可を取り消した端末をサーバー側で検知し、配信を健全に保ちます'),
  updated_at = now()
where slug = 'web-push-notifications';

-- ------------------------------------------------------------
-- ガード4: 置換後に古い文字列が残っていないこと
-- ------------------------------------------------------------
do $$
declare left_over text := '';
begin
  if exists (select 1 from public.news where slug='persona-builder-journey-map' and (body like '%購入 → 定着%' or summary like '%認知から定着まで%')) then left_over := left_over || ' persona/定着'; end if;
  if exists (select 1 from public.news where slug='branding-bz-launch' and (body like '%他に類を見ません%' or body like '%（無料でお試し可能）%')) then left_over := left_over || ' launch'; end if;
  if exists (select 1 from public.news where slug='brand-comprehension-quiz' and body like '%テスト本人には解説で学習%') then left_over := left_over || ' quiz'; end if;
  if exists (select 1 from public.news where slug='stp-positioning-map' and (body like '%最適な2軸%' or body like '%連携モーダルを刷新%')) then left_over := left_over || ' stp'; end if;
  if exists (select 1 from public.news where slug='brand-personality-tool' and body like '%への収斂は許容しつつ%') then left_over := left_over || ' personality'; end if;
  if exists (select 1 from public.news where slug='video-learning-launch' and body like '%視聴セッションごとに1行%') then left_over := left_over || ' video'; end if;
  if exists (select 1 from public.news where slug='pwa-and-mobile-ux' and (body like '%スタンドアロン起動%' or body like '%オフラインフォールバック%' or body like '%トーストで通知%')) then left_over := left_over || ' pwa'; end if;
  if exists (select 1 from public.news where slug='portal-brand-four-quadrants' and (title like '%4象限%' or body like '%4象限%' or summary like '%4象限%')) then left_over := left_over || ' portal'; end if;
  if exists (select 1 from public.news where slug='video-learning-categories' and body like '%未分類の動画も生存%') then left_over := left_over || ' vlcat'; end if;
  if exists (select 1 from public.news where slug='web-push-notifications' and body like '%無効になった購読は自動クリーンアップ%') then left_over := left_over || ' push'; end if;
  if left_over <> '' then
    raise exception '置換が完了していません:%。ロールバックします。', left_over;
  end if;
end $$;

-- ------------------------------------------------------------
-- ガード5: 注記が二重に入っていないこと
-- ------------------------------------------------------------
do $$
declare dup text;
begin
  select string_agg(slug, ', ') into dup
  from public.news
  where slug in ('stp-positioning-map','brand-personality-tool','persona-builder-journey-map')
    and (length(body) - length(replace(body, '作成結果をブランド情報に反映する操作を指します', ''))) / length('作成結果をブランド情報に反映する操作を指します') > 1;
  if dup is not null then
    raise exception '注記が二重に追加されています: %。ロールバックします。', dup;
  end if;
end $$;

-- 問題がなければ確定
commit;

-- 初回セットアップ案内を「あとで」で閉じたことを覚える列。
--
-- 置き場所を admin_users にした理由:
--   案内を閉じるのは個人の判断なので、会社単位（companies）だと
--   管理者が複数いる会社で1人が閉じると全員から消えてしまう。
--   localStorage だと同じ人が別デバイスで開くたびに復活し、
--   「消したのに出てくる」という不具合に見える。
--
-- 効き方:
--   ポータル側の案内カードだけを非表示にする。
--   管理画面の鏡写しカードは 4/4 完了まで残す（案内は消せるが迷子にはさせない）。

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

COMMENT ON COLUMN admin_users.onboarding_dismissed_at IS
  '初回セットアップ案内を「あとで」で閉じた日時。ポータル側の案内のみ非表示にし、管理画面の鏡写しカードは4/4完了まで残す';

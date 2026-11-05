-- ポータルのサイドバーに出す入力サポートの案内（「入力にお困りですか？」）の表示を会社ごとに切り替える。
-- スーパー管理のブランド詳細で設定する。既定は従来どおり表示
alter table public.companies
  add column if not exists setup_support_banner_enabled boolean not null default true;

comment on column public.companies.setup_support_banner_enabled is
  'ポータルのサイドバーに入力サポートの案内を出すか。出す条件（管理者・セットアップ未完了）に加えて見る';

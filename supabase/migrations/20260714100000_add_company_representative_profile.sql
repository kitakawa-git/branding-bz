-- 代表者プロフィール（経歴・自己紹介など複数行テキスト）を companies に追加
-- 管理画面 /admin/company で編集 → ポータル /portal/about で表示

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS representative_profile TEXT;

COMMENT ON COLUMN public.companies.representative_profile IS
'代表者プロフィール（経歴・自己紹介など複数行テキスト）。管理画面 /admin/company → ポータル /portal/about で表示。';

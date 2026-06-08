-- brand_values → value_propositions リネーム
-- 目的: 「顧客への提供価値（バリュープロポジション）」テーブルを、MVVのバリュー
--       （brand_guidelines.values jsonb／行動規範）と明確に区別する。
-- 付随: brand_values を名前に含むインデックス・制約も同時にリネーム。
--       ポリシー名は "auth_all"（brand_values を含まない）ため変更不要。
--       互換ビューは作らない（参照箇所はすべてコード側で更新済み）。

DO $$
DECLARE
  r record;
BEGIN
  -- テーブル本体（既にリネーム済みなら何もしない＝再実行安全）
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'brand_values' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE public.brand_values RENAME TO value_propositions';
  END IF;

  -- 名前に brand_values を含む制約（PK / FK 等）をリネーム
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.value_propositions'::regclass
      AND conname LIKE '%brand_values%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.value_propositions RENAME CONSTRAINT %I TO %I',
      r.conname, replace(r.conname, 'brand_values', 'value_propositions')
    );
  END LOOP;

  -- 名前に brand_values を含むインデックスをリネーム
  --   （20260603120000_disk_io_fk_indexes.sql で作成した
  --     idx_brand_values_company_id → idx_value_propositions_company_id 等）
  FOR r IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'value_propositions'
      AND indexname LIKE '%brand_values%'
  LOOP
    EXECUTE format(
      'ALTER INDEX public.%I RENAME TO %I',
      r.indexname, replace(r.indexname, 'brand_values', 'value_propositions')
    );
  END LOOP;
END $$;

-- 意味を固定するDBコメント
COMMENT ON TABLE public.value_propositions IS
  '顧客への提供価値（バリュープロポジション）。1件=1行、sort_orderで表示順管理。MVVのバリューではない（それは brand_guidelines.values）。旧名: brand_values';

COMMENT ON COLUMN public.brand_guidelines.values IS
  'MVVのバリュー（行動規範）のjsonb配列。顧客への提供価値は value_propositions テーブル側。';

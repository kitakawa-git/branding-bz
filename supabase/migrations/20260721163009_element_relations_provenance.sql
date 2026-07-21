-- 関係の出所（provenance）を構造化する。
-- これまで「AI提案かどうか」は note の先頭文字列 'AI提案:' だけで表現されており、
-- note を編集すると出所情報が消える状態だった。
-- source: 'manual'（人が作成）| 'ai_scan'（AIスキャン提案を人が承認）
-- ai_confidence: AI提案時の確信度（manual のときは null）
-- created_by: 作成者（クライアント経由の INSERT は auth.uid()。service_role 経由は null）

alter table public.element_relations
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'ai_scan')),
  add column if not exists ai_confidence text
    check (ai_confidence in ('high', 'medium')),
  add column if not exists created_by uuid default auth.uid();

-- バックフィル: note の 'AI提案:' プレフィックスを構造化列へ移し、note は理由文だけにする
update public.element_relations
set source = 'ai_scan',
    note = nullif(btrim(substring(note from char_length('AI提案:') + 1)), '')
where note like 'AI提案:%';

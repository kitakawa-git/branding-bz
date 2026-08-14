-- timeline_likes に DELETE ポリシーを足す。
--
-- 【背景】
-- timeline_likes には INSERT と SELECT のポリシーしか無く、DELETE は誰にも許可されて
-- いなかった。つまり「いいね解除」はずっと RLS に拒否され続けている。
-- これまでは 0 行削除でもエラーにならなかったため、画面上は解除されたように見えて
-- リロードすると復活する状態だった（app/portal/timeline/page.tsx の handleLike）。
--
-- 20260814130000 と同じく「開く方向」の変更なので、範囲を DELETE 1本に限定する。
-- プラン条件は付けない。いいねの取り消しは自分が付けたものを片付ける操作で、
-- 投稿・コメントの DELETE をプランで止めていないのと同じ扱いにする。
--
-- 【差し替え前の状態】
--   timeline_likes には DELETE ポリシーが存在しない（＝全拒否）
--
-- ※ auth.uid() は initplan 最適化のため (select auth.uid()) でラップする（CLAUDE.md）。

create policy "timeline_likes_delete" on public.timeline_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

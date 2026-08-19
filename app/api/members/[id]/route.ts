// メンバー削除API
// DELETE /api/members/[id] — Service Role で members / profiles / auth.users をまとめて削除
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { supabase } from '@/lib/supabase'

// 認証ユーザーの company_id を取得
async function getAdminCompanyId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  const supabaseAdmin = getSupabaseAdmin()
  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('company_id')
    .eq('auth_id', user.id)
    .single()

  return admin?.company_id || null
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberId } = await context.params

    const companyId = await getAdminCompanyId(request)
    if (!companyId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // 対象メンバーの確認（同じ企業配下）
    const { data: member, error: memberError } = await supabaseAdmin
      .from('members')
      .select('id, auth_id, profile_id, display_name')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: '対象のメンバーが見つかりません' }, { status: 404 })
    }

    // 関連レコードを先に削除（FK制約回避）
    // 投稿に対するいいね・コメントは投稿削除前に消す必要があるため順序に注意
    if (member.auth_id) {
      // 自分が押したいいね・自分が書いたコメント
      await supabaseAdmin.from('timeline_likes').delete().eq('user_id', member.auth_id)
      await supabaseAdmin.from('timeline_comments').delete().eq('user_id', member.auth_id)

      // 自分の投稿に紐づくいいね・コメントを消してから投稿を削除
      const { data: ownPosts } = await supabaseAdmin
        .from('timeline_posts')
        .select('id')
        .eq('user_id', member.auth_id)
      const postIds = (ownPosts || []).map(p => p.id)
      if (postIds.length > 0) {
        await supabaseAdmin.from('timeline_likes').delete().in('post_id', postIds)
        await supabaseAdmin.from('timeline_comments').delete().in('post_id', postIds)
        await supabaseAdmin.from('timeline_posts').delete().in('id', postIds)
      }
    }

    // members 削除
    const { error: deleteMemberError } = await supabaseAdmin
      .from('members')
      .delete()
      .eq('id', memberId)

    if (deleteMemberError) {
      console.error('[MemberDelete] members削除エラー:', deleteMemberError.message)
      return NextResponse.json(
        { error: `メンバー削除に失敗しました: ${deleteMemberError.message}` },
        { status: 500 }
      )
    }

    // profiles 削除
    //
    // ⚠️ card_views の FK は ON DELETE 指定が無い（＝削除を拒否する）ため、
    //    名刺が一度でも閲覧されたプロフィールはそのままでは消せない。
    //    以前はこの失敗を warn で握りつぶしており、メンバーだけ消えて
    //    プロフィールが孤立し、/card/<slug> が公開されたまま残っていた
    //    （管理画面の一覧から消えるので、UI では止めようがない状態になる）。
    //    閲覧ログを先に消してから本体を消す。
    if (member.profile_id) {
      await supabaseAdmin.from('card_views').delete().eq('profile_id', member.profile_id)

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', member.profile_id)

      if (profileError) {
        // それでも消せないときは、少なくとも公開だけは止める。
        // 「消えなかった」で終わらせると公開ページが残るため
        console.error('[MemberDelete] profiles削除エラー:', profileError.message)
        const { error: disableError } = await supabaseAdmin
          .from('profiles')
          .update({ card_enabled: false })
          .eq('id', member.profile_id)
        if (disableError) {
          console.error('[MemberDelete] 名刺の公開停止も失敗:', disableError.message)
        }
      }
    }

    // Supabase Auth ユーザー削除
    // 失敗したら呼び出し元に伝える＋削除後に getUserById で残存確認（成功偽装の検出）
    if (member.auth_id) {
      // shouldSoftDelete を明示的に false（hard delete）
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(member.auth_id, false)
      if (authError) {
        console.error('[MemberDelete] auth.users削除エラー:', authError.message)
        return NextResponse.json(
          {
            error: `Auth user削除に失敗しました（同じメールアドレスでの再登録ができなくなる可能性があります）: ${authError.message}`,
            partial: true,
          },
          { status: 500 }
        )
      }

      // 念のため getUserById で本当に消えたか確認（Supabase内部で成功偽装される稀なケース対策）
      const { data: stillExists } = await supabaseAdmin.auth.admin.getUserById(member.auth_id)
      if (stillExists?.user) {
        console.error('[MemberDelete] auth.users削除コール成功も実際には残存:', member.auth_id)
        return NextResponse.json(
          {
            error: `Auth userが削除コール後も残存しています（auth_id=${member.auth_id}）。Supabaseダッシュボードで手動削除してください。`,
            partial: true,
            authId: member.auth_id,
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[MemberDelete] エラー:', err)
    return NextResponse.json(
      { error: `サーバーエラー: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}

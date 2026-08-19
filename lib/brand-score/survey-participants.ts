// 配信中サーベイの参加者を後から入ったメンバーにも広げる。
//
// survey_participants は「draft → active にした瞬間の profiles」を写し取って作られる。
// そのままだと、配信開始より後に入った人には参加者レコードが無く、ポータルの
// 回答バナーも回答画面も出ない（実際 ID INC. で発生した）。
// メンバーが増える経路からここを呼び、配信中のサーベイに足していく。
//
// 管理者（admin_users）はインナーサーベイの対象にしない。
// 設問が「会社をどう見ているか」を従業員に聞くもので、集計する側が
// 母集団に混ざると自己評価が混ざるため。
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * サーベイの対象になる profile_id。
 *
 * 母集団は profiles ではなく「有効なメンバー」から作る。
 * profiles だけを見ると、members に紐づかない孤立プロフィール（ログイン手段が無く
 * 構造上ぜったいに回答できない）まで分母に入り、回答率が永久に上がらなくなる。
 */
export async function fetchSurveyTargetProfileIds(companyId: string): Promise<string[]> {
  const admin = getSupabaseAdmin()

  const { data: members } = await admin
    .from('members')
    .select('profile_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .not('profile_id', 'is', null)

  const ids = [...new Set((members ?? []).map((m) => m.profile_id as string).filter(Boolean))]
  if (ids.length === 0) return []

  const adminProfileIds = await fetchAdminProfileIds(companyId)
  return ids.filter((id) => !adminProfileIds.has(id))
}

/** その会社の管理者の profile_id。admin_users → members → profiles と辿る */
async function fetchAdminProfileIds(companyId: string): Promise<Set<string>> {
  const admin = getSupabaseAdmin()

  const { data: admins } = await admin
    .from('admin_users')
    .select('auth_id')
    .eq('company_id', companyId)

  const authIds = (admins ?? []).map((a) => a.auth_id as string).filter(Boolean)
  if (authIds.length === 0) return new Set()

  const { data: members } = await admin
    .from('members')
    .select('profile_id')
    .eq('company_id', companyId)
    .in('auth_id', authIds)

  return new Set((members ?? []).map((m) => m.profile_id as string).filter(Boolean))
}

/**
 * 配信中（status='active'）のサーベイに、渡したプロフィールを参加者として足す。
 * 管理者はここで弾くので、呼び出し側は絞り込まなくてよい。
 *
 * バナーを出すためだけの補助処理なので、失敗してもメンバー追加自体は成功させる
 * （呼び出し側は await するが例外は投げない）。
 */
export async function addToActiveSurveys(companyId: string, profileIds: string[]): Promise<void> {
  try {
    const candidates = profileIds.filter(Boolean)
    if (candidates.length === 0) return

    // 対象条件は新規サーベイ作成時とまったく同じものを使う（二重定義しない）
    const allowed = new Set(await fetchSurveyTargetProfileIds(companyId))
    const targets = candidates.filter((id) => allowed.has(id))
    if (targets.length === 0) return

    const admin = getSupabaseAdmin()

    // 外部調査の取り込み（source='imported'）は participants を持たず
    // respondent_count で回答数を持つので触らない。
    // source が null の旧データは内部調査として扱う
    const { data: surveys } = await admin
      .from('brand_surveys')
      .select('id, source')
      .eq('company_id', companyId)
      .eq('status', 'active')

    const internalSurveys = (surveys ?? []).filter((s) => s.source !== 'imported')
    if (internalSurveys.length === 0) return

    for (const survey of internalSurveys) {
      const { error } = await admin.from('survey_participants').upsert(
        targets.map((profileId) => ({
          survey_id: survey.id as string,
          profile_id: profileId,
          responded_at: null,
          reminded_at: null,
        })),
        { onConflict: 'survey_id,profile_id', ignoreDuplicates: true },
      )

      if (error) {
        console.error('[addToActiveSurveys] participants upsert エラー:', error.message)
        continue
      }

      // 回答率の分母は total_members。参加者を足したらここも合わせないと
      // 「3人中2人回答」なのに 2人中2人＝100% と出てしまう
      const { count } = await admin
        .from('survey_participants')
        .select('id', { count: 'exact', head: true })
        .eq('survey_id', survey.id as string)

      if (typeof count === 'number') {
        await admin.from('brand_surveys').update({ total_members: count }).eq('id', survey.id as string)
      }
    }
  } catch (err) {
    console.error('[addToActiveSurveys] 予期しないエラー:', err)
  }
}

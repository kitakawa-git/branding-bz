// 初回セットアップの完了判定（サーバ専用）。
//
// 判定は「データがあるか」だけを見る。案内カード（/api/onboarding）と
// 入力サポートの相談リクエスト（/api/setup-support-requests）の両方が使うので、
// 判定は必ずここ1箇所を通す。2箇所に書くと、片方だけ直す日が必ず来る。
//
// ⚠️ getSupabaseAdmin（service_role）を使うので、呼ぶ前に必ず認証と
//    company_id の解決を済ませること。この関数自体は権限を見ない。
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { OnboardingStatus } from '@/lib/onboarding/steps'

/** 自社に1件でもあるか。count だけ取るので行は読まない */
async function exists(table: string, companyId: string) {
  const { count } = await getSupabaseAdmin()
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  return (count ?? 0) > 0
}

/**
 * プランによって使うステップが違うので、全ステップぶんの判定をまとめて返し、
 * どれを見るかは lib/onboarding/steps.ts の定義に任せる。
 * どれも件数だけを見る（head: true）ので行は読まない。
 */
export async function computeOnboardingStatus(companyId: string): Promise<OnboardingStatus> {
  const admin = getSupabaseAdmin()

  // 招待は「招待リンクの発行」と「管理者以外のメンバーが居る」の OR。
  // 招待リンクを使わず直接追加した会社（テックブリッジ等）を未完了にしないため。
  // ビジュアルは brand_visuals の行。
  // companies.brand_color_primary は DEFAULT '#000000' で最初から値が入るため
  // 判定には使えない（使うと初日から完了扱いになる）。
  //
  // バーバルは brand_personalities.communication_style（トーン）と brand_terms（用語）の OR。
  // バーバル画面はトーンだけ保存しても用語の行を作らないので、用語だけを見ると
  // 説明どおりに操作した人が未完了のまま残る。
  // なお communication_style はパーソナリティ診断の本体連携でも書かれるため、
  // 診断から連携した人は画面を開かずに完了になる。中身は実際に入っているので許容する。
  const [
    philosophy,
    post,
    announcement,
    invited,
    visuals,
    traitsOrSummary,
    archetype,
    terms,
    tone,
    memberCount,
    companyRow,
  ] = await Promise.all([
    exists('philosophy_elements', companyId),
    exists('timeline_posts', companyId),
    exists('announcements', companyId),
    exists('invite_links', companyId),
    exists('brand_visuals', companyId),
    // パーソナリティは手入力（特性・要約）と診断連携（アーキタイプ）で
    // 入る先が違うので、どの経路で登録しても完了になるよう OR で見る
    admin
      .from('brand_guidelines')
      .select('traits, personality_summary')
      .eq('company_id', companyId)
      .maybeSingle()
      .then((r) => {
        const g = r.data as { traits?: unknown[] | null; personality_summary?: string | null } | null
        return (g?.traits?.length ?? 0) > 0 || !!g?.personality_summary
      }),
    admin
      .from('brand_personalities')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('archetype', 'is', null)
      .then((r) => (r.count ?? 0) > 0),
    exists('brand_terms', companyId),
    admin
      .from('brand_personalities')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('communication_style', 'is', null)
      .then((r) => (r.count ?? 0) > 0),
    admin
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)
      .then((r) => r.count ?? 0),
    admin
      .from('companies')
      .select('industry_category')
      .eq('id', companyId)
      .maybeSingle()
      .then((r) => r.data),
  ])

  return {
    // ロゴは任意なので条件に入れない（画像を持たない会社が永久に未完了になる）
    basics: !!companyRow?.industry_category,
    philosophy,
    personality: traitsOrSummary || archetype,
    visuals,
    verbal: tone || terms,
    post,
    announcement,
    // 管理者自身も members に居るので、2名以上で「他の人を入れた」と見る
    invite: invited || memberCount >= 2,
  }
}

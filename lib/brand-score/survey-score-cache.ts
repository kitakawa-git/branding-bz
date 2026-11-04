// 回答受付を終えたサーベイの集計結果をサーバーにキャッシュする（サーバー専用）。
//
// 回答が1万行を超える会社（実例 11,760行）では、集計のたびに PostgREST へ12往復して
// 約2.5MB の行を読み直していた。ダッシュボードの inner-score と trend、続けて開くサーベイ画面の
// inner-score が同時に走ると、これが3本重なる。closed のサーベイは回答が増えないので、結果を使い回す。
//
// - 所属の確認は呼び出し側でキャッシュの外で行うこと（ここは権限を見ない）
// - 配信中（active）は回答が増えるのでキャッシュしない
// - 設問やサーベイを直す API は invalidateSurveyScore を呼ぶ
// - キーにデプロイの SHA を含める。Data Cache はデプロイをまたいで残るため、集計ロジックを直しても古い結果が返るのを防ぐ
import { revalidateTag, unstable_cache } from 'next/cache'

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev'
// 直接 SQL で直した場合はここまでで追いつく（期限後の初回は古い値を返し、裏で取り直す）
const REVALIDATE_SECONDS = 60 * 60

const tagOf = (surveyId: string) => `survey-score-${surveyId}`

export function cachedSurveyScore<T>(
  survey: { id: string; status: string },
  name: 'inner-score' | 'trend',
  compute: () => Promise<T>,
): Promise<T> {
  if (survey.status !== 'closed') return compute()
  return unstable_cache(compute, ['survey-score', name, survey.id, BUILD], {
    tags: [tagOf(survey.id)],
    revalidate: REVALIDATE_SECONDS,
  })()
}

export function invalidateSurveyScore(surveyId: string): void {
  revalidateTag(tagOf(surveyId), { expire: 0 })
}

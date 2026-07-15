import { AuthSplash } from '@/components/admin/AuthSplash'

/* Next.js 大遷移スプラッシュ。Suspense fallback として使われる。
   /admin/login と統一した白背景で無地表示にする。 */
export default function Loading() {
  return <AuthSplash />
}

// 承認キューは企業一覧の上のアコーディオンへ移した。
// 旧 URL をブックマークしている人が空白に着かないよう転送する。
import { redirect } from 'next/navigation'

export default function SignupRequestsRedirect() {
  redirect('/superadmin/companies')
}

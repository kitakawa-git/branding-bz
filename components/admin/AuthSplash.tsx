/* 認証中間・リダイレクト中の共通スプラッシュ。
   GateShell と同じ白背景で、ライト↔ダーク切替時の白フラッシュを防ぐ。
   OAuth コールバック / 旧URL からのリダイレクト / 読み込み中の表示に使う。 */
export function AuthSplash({ message = '読み込み中...' }: { message?: string } = {}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-sans">
      <p className="text-sm text-black/40">{message}</p>
    </div>
  )
}

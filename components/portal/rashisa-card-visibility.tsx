'use client'

// ダッシュボードの「私たちの『らしさ』」ショートカットカードを出す/隠す。
//
// サイドバーに同じ5項目が常時あるので、毎日使う人にはカードが場所を取るだけになる。
// 一方で入ったばかりの人には「どこに何があるか」の地図として要る。
// どちらか一方に決めず、見る人が切り替えられるようにした。
//
// スイッチはサイドバーの見出し、カードはダッシュボード本体と、置き場所が離れている。
// 状態だけをここで共有する（ヘッダー検索の PortalSearchProvider と同じ考え方）。
//
// 保存は localStorage ＝ 端末ごとの見た目の好みで、他の人や他の端末に持ち出す
// ものではない。DB に持つと会社設定と紛らわしくなる（あちらは管理者が全員に効かせる設定）。
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Switch } from '@/components/ui/switch'

// 既定は非表示なので、保存するのは「表示する」を選んだときだけ
const STORAGE_KEY = 'portal-rashisa-card-shown'

type RashisaCardValue = {
  visible: boolean
  setVisible: (v: boolean) => void
}

const RashisaCardContext = createContext<RashisaCardValue | null>(null)

export function RashisaCardVisibilityProvider({ children }: { children: React.ReactNode }) {
  // 既定は非表示＝同じ5項目がサイドバーに常時あるので、まずは畳んでおく。
  // SSR とクライアントの初回描画を揃えるため、localStorage はマウント後に読む
  // （初期値に入れると hydration がずれる）
  const [visible, setVisibleState] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setVisibleState(true)
    } catch {
      // localStorage が使えない環境では畳んだままにする
    }
  }, [])

  const value = useMemo(
    () => ({
      visible,
      setVisible: (v: boolean) => {
        setVisibleState(v)
        try {
          if (v) localStorage.setItem(STORAGE_KEY, '1')
          else localStorage.removeItem(STORAGE_KEY)
        } catch {
          // 保存できなくても切り替え自体は効かせる
        }
      },
    }),
    [visible],
  )

  return <RashisaCardContext.Provider value={value}>{children}</RashisaCardContext.Provider>
}

/** カード側から呼ぶ。Provider の外ならスイッチが無いので、既定どおり畳んでおく */
export function useRashisaCardVisible(): boolean {
  return useContext(RashisaCardContext)?.visible ?? false
}

/** サイドバーの「私たちの『らしさ』」見出しの右に置くスイッチ */
export function RashisaCardSwitch() {
  const ctx = useContext(RashisaCardContext)
  if (!ctx) return null

  return (
    <Switch
      checked={ctx.visible}
      onCheckedChange={ctx.setVisible}
      // 見出しは小さな行なので、既定（h-5 w-9）だとスイッチが主役になる。
      // 一回り小さくして、つまみの移動量も幅に合わせる。
      //
      // -translate-y-[0.5px]: items-center で箱の中心は既に揃っているが、
      // 和文は行ボックスの下側に余白が多く、字面の中心が箱の中心より
      // 0.6px ほど上に来る。その分だけ上げて見た目の中心を合わせる
      className="ml-auto h-4 w-7 -translate-y-[0.5px] [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3"
      aria-label="ダッシュボードに「私たちの『らしさ』」のカードを表示"
      title={
        ctx.visible
          ? 'ダッシュボードのショートカットカードを隠す'
          : 'ダッシュボードにショートカットカードを表示する'
      }
    />
  )
}

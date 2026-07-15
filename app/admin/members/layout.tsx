import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'アカウント一覧',
}

/* /admin/members だけ公開LPと同じダーク基調で表示する。
   親レイアウトの <main class="px-5 pt-4 pb-6"> をネガティブマージンで打ち消し、
   ページ全域を #08080a で染める。他の管理画面は従来のライト基調のまま。 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 -mt-4 -mb-6 min-h-[calc(100vh-64px)] bg-[#08080a] px-5 pt-6 pb-10 text-white">
      {children}
    </div>
  )
}

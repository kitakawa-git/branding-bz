'use client'

// 管理画面「表示設定」: 機能の表示設定（オン/オフトグル）
// FEATURE_TOGGLES を唯一の定義源として map でトグル行を生成する（個別ハードコード禁止）。
// 機能を増やすときは lib/constants/feature-toggles.ts に1行追加するだけでここに反映される。
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AdminDataProvider'
import {
  FEATURE_TOGGLES,
  isFeatureEnabled,
  type FeatureToggle,
} from '@/lib/constants/feature-toggles'
import {
  GATEABLE_PORTAL_PAGES,
  MEMBER_ROLE_OPTIONS,
  resolveRoleVisibility,
  type RoleVisibilityConfig,
  type MemberRole,
} from '@/lib/constants/member-roles'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function AdminSettingsPage() {
  const { companyId, company, updateCompany } = useAuth()

  // 更新中のトグルキー（連打防止用）
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // オフ切り替え確認ダイアログの対象
  const [confirmOff, setConfirmOff] = useState<FeatureToggle | null>(null)

  // 区分ごとの表示設定（保存値＋既定値をマージした完全な状態を保持）
  const [roleVis, setRoleVis] = useState<RoleVisibilityConfig>(() => resolveRoleVisibility(company))
  const [savingRoleCell, setSavingRoleCell] = useState<string | null>(null)
  useEffect(() => {
    setRoleVis(resolveRoleVisibility(company))
  }, [company])

  // 区分×ページの1セルを更新して即保存
  const toggleRoleVisibility = async (pageKey: string, role: MemberRole, value: boolean) => {
    if (!companyId) return
    const cellId = `${pageKey}:${role}`
    const next: RoleVisibilityConfig = {
      ...roleVis,
      [pageKey]: { ...roleVis[pageKey], [role]: value },
    }
    setRoleVis(next)
    setSavingRoleCell(cellId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company_id: companyId, portal_role_visibility: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      updateCompany({ portal_role_visibility: next })
      toast.success('設定を更新しました')
    } catch (err) {
      console.error('[Settings] 区分表示 更新エラー:', err)
      setRoleVis(resolveRoleVisibility(company)) // 失敗時は元に戻す
      const detail = err instanceof Error ? err.message : ''
      toast.error(detail ? `設定の更新に失敗しました：${detail}` : '設定の更新に失敗しました')
    } finally {
      setSavingRoleCell(null)
    }
  }

  // companies の該当カラムを更新（service_role API 経由 / 自社のみ）
  const save = async (key: string, value: boolean) => {
    if (!companyId) return
    setSavingKey(key)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ company_id: companyId, [key]: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)

      // 成功時のみコンテキスト上の company を即時更新 → 画面に即反映
      updateCompany({ [key]: value })
      toast.success('設定を更新しました')
    } catch (err) {
      // 失敗時はトーストのみ。company は変更していないのでトグルは元の状態のまま
      // API は原因（未作成カラム名など）を返すので、握りつぶさず表示する
      console.error('[Settings] 更新エラー:', err)
      const detail = err instanceof Error ? err.message : ''
      toast.error(detail ? `設定の更新に失敗しました：${detail}` : '設定の更新に失敗しました')
    } finally {
      setSavingKey(null)
    }
  }

  // トグル操作: オフにするときだけ確認、オンに戻すときは即時
  const handleToggle = (toggle: FeatureToggle, checked: boolean) => {
    if (!checked) {
      setConfirmOff(toggle)
    } else {
      save(toggle.key, true)
    }
  }

  return (
    <div>
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5">
          <h2 className="text-base font-bold text-foreground mb-1">機能の表示設定</h2>
          <p className="text-sm text-muted-foreground m-0 mb-5">
            ポータルに表示する機能のオン/オフを切り替えます。オフにしてもデータは削除されません。
          </p>

          {FEATURE_TOGGLES.map((toggle, i) => {
            const enabled = isFeatureEnabled(company, toggle.key)
            return (
              <div key={toggle.key}>
                {i > 0 && <Separator className="my-5" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground m-0">
                      {toggle.label}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1 m-0">
                      {toggle.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-xs font-medium text-muted-foreground w-7 text-right">
                      {enabled ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      checked={enabled}
                      disabled={savingKey === toggle.key}
                      onCheckedChange={(checked) => handleToggle(toggle, checked)}
                      aria-label={toggle.label}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* 区分ごとの表示設定 */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mt-4">
        <CardContent className="p-5">
          <h2 className="text-base font-bold text-foreground mb-1">区分ごとの表示設定</h2>
          <p className="text-sm text-muted-foreground m-0 mb-5 leading-relaxed">
            メンバーの区分（経営層／管理職／従業員・アカウント管理で設定、既定は「従業員」）に応じて、ポータルのページを出し分けます。※ 管理者は区分に関わらず常に表示されます。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">ページ</th>
                  {MEMBER_ROLE_OPTIONS.map((opt) => (
                    <th key={opt.value} className="px-3 py-2 font-medium text-center">{opt.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GATEABLE_PORTAL_PAGES.map((page) => {
                  const featureOn = page.featureKey ? isFeatureEnabled(company, page.featureKey) : true
                  return (
                    <tr key={page.key} className="border-b last:border-b-0">
                      <td className="px-3 py-3">
                        <span className="text-sm font-semibold text-foreground">{page.label}</span>
                        {!featureOn && (
                          <span className="ml-2 text-[11px] text-muted-foreground">（機能オフ）</span>
                        )}
                      </td>
                      {MEMBER_ROLE_OPTIONS.map((opt) => {
                        const role = opt.value as MemberRole
                        const cellId = `${page.key}:${role}`
                        return (
                          <td key={role} className="px-3 py-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={roleVis[page.key]?.[role] ?? true}
                                disabled={savingRoleCell === cellId}
                                onCheckedChange={(checked) => toggleRoleVisibility(page.key, role, checked)}
                                aria-label={`${page.label} を ${opt.label} に表示`}
                              />
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* オフ切り替え確認ダイアログ */}
      <AlertDialog
        open={!!confirmOff}
        onOpenChange={(open) => {
          if (!open) setConfirmOff(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmOff?.label} をオフにしますか？</AlertDialogTitle>
            <AlertDialogDescription>{confirmOff?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOff) save(confirmOff.key, false)
                setConfirmOff(null)
              }}
            >
              オフにする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

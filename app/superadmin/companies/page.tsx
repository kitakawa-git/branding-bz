'use client'

// スーパー管理画面: 企業一覧ページ
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Building2, Plus, ArrowRight } from 'lucide-react'

type CompanyWithCount = {
  id: string
  name: string
  logo_url: string | null
  slogan: string | null
  created_at: string
  member_count: number
  admin_count: number
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        // 全企業を取得
        const { data: companiesData, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[SuperAdmin] 企業一覧取得エラー:', error.message)
          setLoading(false)
          return
        }

        // 各企業の社員数と管理者数を取得
        const companiesWithCounts = await Promise.all(
          (companiesData || []).map(async (company) => {
            // 社員数
            const { count: memberCount } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)

            // 管理者数
            const { count: adminCount } = await supabase
              .from('admin_users')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)

            return {
              id: company.id,
              name: company.name || '（名前なし）',
              logo_url: company.logo_url,
              slogan: company.slogan,
              created_at: company.created_at,
              member_count: memberCount || 0,
              admin_count: adminCount || 0,
            }
          })
        )

        setCompanies(companiesWithCounts)
      } catch (err) {
        console.error('[SuperAdmin] 企業一覧取得例外:', err)
      }
      setLoading(false)
    }

    fetchCompanies()
  }, [])

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-0">
            <div className="p-4">
              <div className="flex bg-muted px-4 py-3 gap-4 border-b border-border rounded-t-md">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-4 w-20" />
                ))}
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex px-4 py-3 gap-4 border-b border-border items-center">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* ===== ヘッダー（タイトルはパンくずに移動） ===== */}
      <div className="flex justify-end items-center mb-6">
        <Button asChild variant="outline" className="py-2 px-4 text-[13px]">
          <Link href="/superadmin/companies/new">
            <Plus size={16} />
            新規企業を登録
          </Link>
        </Button>
      </div>

      {/* ===== 企業一覧テーブル ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-0">
          {companies.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">企業データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">企業名</th>
                    <th className="px-4 py-3 font-medium">スローガン</th>
                    <th className="px-4 py-3 font-medium text-center">従業員数</th>
                    <th className="px-4 py-3 font-medium text-center">管理者</th>
                    <th className="px-4 py-3 font-medium">作成日</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt=""
                              className="size-9 rounded-md object-cover shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <Building2 size={16} className="text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm font-bold text-foreground">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{company.slogan || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-foreground">{company.member_count}名</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-foreground">{company.admin_count}名</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(company.created_at).toLocaleDateString('ja-JP')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-blue-600 hover:text-blue-700" asChild>
                          <Link href={`/superadmin/companies/${company.id}`}>
                            詳細
                            <ArrowRight size={14} />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 統計サマリー */}
      <div className="mt-4 text-xs text-muted-foreground text-right">
        全{companies.length}社
      </div>
    </div>
  )
}

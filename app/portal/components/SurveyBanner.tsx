'use client'

// 未回答サーベイのバナー通知
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePortalAuth } from './PortalDataProvider'
import { Button } from '@/components/ui/button'
import { ClipboardList } from 'lucide-react'

type PendingSurvey = {
  id: string
  title: string
}

export function SurveyBanner() {
  const router = useRouter()
  const { user, companyId } = usePortalAuth()
  const [survey, setSurvey] = useState<PendingSurvey | null>(null)

  useEffect(() => {
    if (!user?.id || !companyId) return

    const fetchPending = async () => {
      try {
        // 1. members → profiles で profile_id を取得
        const { data: memberData, error: mError } = await supabase
          .from('members')
          .select('profile:profiles(id)')
          .eq('auth_id', user.id)
          .eq('company_id', companyId)
          .eq('is_active', true)
          .single()

        if (mError || !memberData) return

        const profileRaw = memberData.profile as
          | { id: string }
          | { id: string }[]
          | null
        const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw
        if (!profile?.id) return

        // 2. survey_participants から未回答レコードを取得
        const { data: participants, error: pError } = await supabase
          .from('survey_participants')
          .select('survey_id')
          .eq('profile_id', profile.id)
          .is('responded_at', null)

        if (pError || !participants || participants.length === 0) return

        const surveyIds = participants.map(p => p.survey_id)

        // 3. activeなサーベイのみ取得（最新順）
        const { data: surveys, error: sError } = await supabase
          .from('brand_surveys')
          .select('id, title, created_at')
          .in('id', surveyIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)

        if (sError || !surveys || surveys.length === 0) return

        setSurvey({ id: surveys[0].id, title: surveys[0].title })
      } catch {
        // バナーなのでエラーは無視
      }
    }

    fetchPending()
  }, [user?.id, companyId])

  if (!survey) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
      <div className="shrink-0 text-ds-app-accent">
        <ClipboardList size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-ds-app-accent m-0">
          ブランド浸透度調査にご回答ください
        </p>
        <p className="text-sm text-muted-foreground m-0 mt-0.5 truncate">
          {survey.title}
        </p>
      </div>
      <Button
        onClick={() => router.push(`/portal/survey/${survey.id}`)}
        className="shrink-0 h-11 px-5 rounded-full"
      >
        回答
      </Button>
    </div>
  )
}

'use client'

// Step 2: ペルソナ構築（候補選択 → 詳細作成の2段階）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, ArrowRight, WandSparkles, Check } from 'lucide-react'
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

// === 型定義 ===
interface Candidate {
  id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  catchcopy: string
  keywords: string[]
  selected: boolean
}

interface PersonaDetail {
  candidate_id: string
  name: string
  age: number
  gender: string
  occupation: string
  title: string
  catchcopy: string
  keywords: string[]
  income: string
  location: string
  family: string
  hobbies: string
  info_sources: string
  personality: string
  values: string
  daily_routine: string
  challenges: string
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
  [key: string]: unknown
}

// Step2が管理するデータ全体
interface Step2Data {
  candidates: Candidate[]
  selected_candidate_ids: string[]
  personas: PersonaDetail[]
}

interface Step2Props {
  step2Data: Step2Data
  basicInfo: BasicInfo
  onNext: (data: Step2Data) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: Step2Data) => Promise<void>
}

const MAX_SELECT = 3

export function Step2Demographics({ step2Data, basicInfo, onNext, onBack, onSaveField }: Step2Props) {
  const [candidates, setCandidates] = useState<Candidate[]>(step2Data.candidates || [])
  const [selectedIds, setSelectedIds] = useState<string[]>(step2Data.selected_candidate_ids || [])
  const [personas, setPersonas] = useState<PersonaDetail[]>(step2Data.personas || [])
  // 候補があり選択済みIDがある && 詳細データもある場合は details フェーズ
  const [phase, setPhase] = useState<'candidates' | 'details'>(
    step2Data.candidates?.length > 0 && step2Data.selected_candidate_ids?.length > 0 && step2Data.personas?.length > 0
      ? 'details'
      : 'candidates'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRegenCandidates, setConfirmRegenCandidates] = useState(false)
  const [confirmRegenDetail, setConfirmRegenDetail] = useState(false)
  const [confirmBackToSelect, setConfirmBackToSelect] = useState(false)
  const [activeTab, setActiveTab] = useState('')
  const [regenTargetId, setRegenTargetId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  // オートセーブ
  const triggerAutoSave = useCallback((c: Candidate[], sIds: string[], p: PersonaDetail[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSaveField({ candidates: c, selected_candidate_ids: sIds, personas: p })
    }, 1000)
  }, [onSaveField])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // === Phase 1: 候補取得 ===
  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tools/persona/suggest-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || '候補の取得に失敗しました')
        return
      }
      const { candidates: suggested } = await res.json()
      setCandidates(suggested)
      setSelectedIds([])
      triggerAutoSave(suggested, [], personas)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [basicInfo, personas, triggerAutoSave])

  // 初回マウント時
  useEffect(() => {
    if (candidates.length === 0 && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchCandidates()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 候補の選択トグル
  const toggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      let next: string[]
      if (prev.includes(id)) {
        next = prev.filter(x => x !== id)
      } else {
        if (prev.length >= MAX_SELECT) return prev
        next = [...prev, id]
      }
      const updatedCandidates = candidates.map(c => ({ ...c, selected: next.includes(c.id) }))
      setCandidates(updatedCandidates)
      triggerAutoSave(updatedCandidates, next, personas)
      return next
    })
  }

  // === Phase 2: 詳細生成 ===
  const fetchDetails = useCallback(async (targetIds: string[]) => {
    setLoading(true)
    setError('')
    try {
      const selectedCandidates = candidates.filter(c => targetIds.includes(c.id))
      const res = await fetch('/api/tools/persona/suggest-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo, candidates: selectedCandidates }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || '詳細の生成に失敗しました')
        return
      }
      const { personas: suggested } = await res.json()
      // 既存の詳細データとマージ（新しく追加された候補のみ上書き）
      setPersonas(prev => {
        const existing = prev.filter(p => !targetIds.includes(p.candidate_id))
        const merged = [...existing, ...suggested]
        if (!activeTab && merged.length > 0) {
          setActiveTab(merged[0].candidate_id)
        }
        triggerAutoSave(candidates, selectedIds, merged)
        return merged
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [basicInfo, candidates, selectedIds, activeTab, triggerAutoSave])

  // 候補選択 → 詳細へ
  const handleGoToDetails = async () => {
    // 選択済みIDを保存
    const updatedCandidates = candidates.map(c => ({ ...c, selected: selectedIds.includes(c.id) }))
    setCandidates(updatedCandidates)

    // 既存の詳細データがない候補のみAPI呼び出し
    const existingDetailIds = personas.map(p => p.candidate_id)
    const newIds = selectedIds.filter(id => !existingDetailIds.includes(id))
    // 選択から外れた候補の詳細は削除
    const cleanedPersonas = personas.filter(p => selectedIds.includes(p.candidate_id))
    setPersonas(cleanedPersonas)

    setPhase('details')
    if (cleanedPersonas.length > 0) {
      setActiveTab(cleanedPersonas[0].candidate_id)
    }

    if (newIds.length > 0) {
      await fetchDetails(newIds)
    } else {
      // 全員分の詳細が既にある
      if (cleanedPersonas.length > 0 && !activeTab) {
        setActiveTab(cleanedPersonas[0].candidate_id)
      }
    }
  }

  // 詳細フィールド更新
  const updatePersonaField = useCallback((candidateId: string, key: keyof PersonaDetail, value: string | number) => {
    setPersonas(prev => {
      const next = prev.map(p =>
        p.candidate_id === candidateId ? { ...p, [key]: value } : p
      )
      triggerAutoSave(candidates, selectedIds, next)
      return next
    })
  }, [candidates, selectedIds, triggerAutoSave])

  // 1人分の詳細を再生成
  const regenOneDetail = async (candidateId: string) => {
    await fetchDetails([candidateId])
  }

  // Step 2 → Step 3 へ
  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const data: Step2Data = { candidates, selected_candidate_ids: selectedIds, personas }
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  // ==========================================
  // Phase 1: 候補選択UI
  // ==========================================
  if (phase === 'candidates') {
    if (loading) {
      return (
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-6">Step 2: ペルソナ構築</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-xl border bg-white p-5">
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-4">AIがペルソナ候補を生成中...</p>
        </div>
      )
    }

    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: ペルソナ構築</h1>
        <p className="mb-5 text-[13px] text-muted-foreground">
          AIがターゲット情報をもとに5人の候補を提案しました。1〜3人を選んでください。
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
            {error}
            <button onClick={fetchCandidates} className="ml-2 font-medium underline hover:no-underline">再試行</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {candidates.map(c => {
            const isSelected = selectedIds.includes(c.id)
            const isDisabled = !isSelected && selectedIds.length >= MAX_SELECT
            return (
              <button
                key={c.id}
                onClick={() => !isDisabled && toggleCandidate(c.id)}
                className={`relative text-left rounded-xl border-2 p-5 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/30'
                    : isDisabled
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-[hsl(0_0%_97%)] hover:border-gray-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <p className="text-lg font-bold text-foreground mb-0.5">
                  {c.name}（{c.age}歳・{c.gender}）
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  {c.occupation} {c.title}
                </p>
                <p className="text-sm italic text-gray-600 mb-2">
                  「{c.catchcopy}」
                </p>
                <div className="flex flex-wrap gap-1">
                  {c.keywords.map((kw, ki) => (
                    <Badge key={ki} variant="secondary" className="text-xs">
                      #{kw}
                    </Badge>
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          選択中: {selectedIds.length}人 / 最大{MAX_SELECT}人
        </p>

        {/* フッター */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> 戻る
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (candidates.length > 0) { setConfirmRegenCandidates(true); return }
                fetchCandidates()
              }}
              className="gap-1.5 text-xs"
            >
              <WandSparkles className="h-3.5 w-3.5" /> 再提案
            </Button>
          </div>
          <Button onClick={handleGoToDetails} disabled={selectedIds.length === 0} className="gap-1">
            次へ <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <AlertDialog open={confirmRegenCandidates} onOpenChange={setConfirmRegenCandidates}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確認</AlertDialogTitle>
              <AlertDialogDescription>現在の候補は破棄されます。再提案しますか？</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={() => fetchCandidates()}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ==========================================
  // Phase 2: 詳細編集UI
  // ==========================================
  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 2: ペルソナ構築</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">ペルソナの詳細を生成中...</p>
        </div>
      </div>
    )
  }

  // 表示対象のペルソナ（選択順を維持）
  const orderedPersonas = selectedIds
    .map(id => personas.find(p => p.candidate_id === id))
    .filter((p): p is PersonaDetail => !!p)

  const currentTab = activeTab || (orderedPersonas[0]?.candidate_id ?? '')

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: ペルソナ構築</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        ペルソナの詳細を確認・編集してください。AIの提案をカスタマイズできます。
      </p>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {error}
        </div>
      )}

      {orderedPersonas.length > 1 ? (
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            {orderedPersonas.map(p => (
              <TabsTrigger key={p.candidate_id} value={p.candidate_id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {orderedPersonas.map(p => (
            <TabsContent key={p.candidate_id} value={p.candidate_id}>
              <PersonaDetailForm
                persona={p}
                onUpdate={(key, value) => updatePersonaField(p.candidate_id, key, value)}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : orderedPersonas.length === 1 ? (
        <PersonaDetailForm
          persona={orderedPersonas[0]}
          onUpdate={(key, value) => updatePersonaField(orderedPersonas[0].candidate_id, key, value)}
        />
      ) : null}

      {/* フッター */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfirmBackToSelect(true)} className="gap-1 text-xs">
            <ArrowLeft className="h-4 w-4" /> 候補選択に戻る
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const target = orderedPersonas.find(p => p.candidate_id === currentTab)
              if (target) {
                setRegenTargetId(target.candidate_id)
                setConfirmRegenDetail(true)
              }
            }}
            className="gap-1.5 text-xs"
          >
            <WandSparkles className="h-3.5 w-3.5" /> AIに再提案
          </Button>
        </div>
        <Button onClick={handleNext} disabled={saving || orderedPersonas.length === 0} className="gap-1">
          {saving ? '保存中...' : 'ゴール・課題へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* 候補選択に戻る確認 */}
      <AlertDialog open={confirmBackToSelect} onOpenChange={setConfirmBackToSelect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>詳細データは保持されます。候補選択に戻りますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => setPhase('candidates')}>戻る</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 1人分の再提案確認 */}
      <AlertDialog open={confirmRegenDetail} onOpenChange={setConfirmRegenDetail}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = orderedPersonas.find(p => p.candidate_id === regenTargetId)
                return t ? `${t.name}の詳細を再提案します。編集内容は上書きされます。` : ''
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenTargetId && regenOneDetail(regenTargetId)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// === 詳細編集フォーム ===
function PersonaDetailForm({ persona, onUpdate }: {
  persona: PersonaDetail
  onUpdate: (key: keyof PersonaDetail, value: string | number) => void
}) {
  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5 space-y-5">
        {/* 基本プロフィール */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-gray-700">基本プロフィール</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">名前</label>
              <Input value={persona.name} onChange={e => onUpdate('name', e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">年齢</label>
                <Input type="number" value={persona.age} onChange={e => onUpdate('age', parseInt(e.target.value) || 0)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">性別</label>
                <Input value={persona.gender} onChange={e => onUpdate('gender', e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">職業</label>
              <Input value={persona.occupation} onChange={e => onUpdate('occupation', e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">役職</label>
              <Input value={persona.title} onChange={e => onUpdate('title', e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* 詳細属性 */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-gray-700">詳細属性</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">年収</label>
              <Input value={persona.income} onChange={e => onUpdate('income', e.target.value)} placeholder="550万円" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">居住地</label>
              <Input value={persona.location} onChange={e => onUpdate('location', e.target.value)} placeholder="東京都世田谷区" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">家族構成</label>
              <Input value={persona.family} onChange={e => onUpdate('family', e.target.value)} placeholder="夫と2人暮らし" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">趣味・関心</label>
              <Input value={persona.hobbies} onChange={e => onUpdate('hobbies', e.target.value)} placeholder="ヨガ、カフェ巡り" className="h-9 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">情報収集チャネル</label>
              <Input value={persona.info_sources} onChange={e => onUpdate('info_sources', e.target.value)} placeholder="Twitter、note、業界メディア" className="h-9 text-sm" />
            </div>
          </div>
        </div>

        {/* 性格・価値観 */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-gray-700">性格・価値観</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">性格</label>
              <Textarea value={persona.personality} onChange={e => onUpdate('personality', e.target.value)} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">価値観</label>
              <Textarea value={persona.values} onChange={e => onUpdate('values', e.target.value)} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">1日の過ごし方</label>
              <Textarea value={persona.daily_routine} onChange={e => onUpdate('daily_routine', e.target.value)} rows={2} className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">課題・悩み</label>
              <Textarea value={persona.challenges} onChange={e => onUpdate('challenges', e.target.value)} rows={2} className="text-sm" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

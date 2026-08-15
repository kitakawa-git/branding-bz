'use client'

// ブランドパーソナリティ 編集ページ
// 特性（人格スコア）: brand_guidelines.traits / traits_sort（旧 ブランド方針 から移動）
//   ※ traits は brand_guidelines の1カラム。guidelines ページは PATCH（部分更新）で traits を触らないため二重更新の競合はしない。
//   ※ トーンオブボイスは /admin/brand/verbal（バーバル）へ移設済み。
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { fetchWithRetry } from '@/lib/supabase-fetch'
import { useAuth } from '../../components/AdminDataProvider'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { resolveTraitCopy } from '@/lib/brand-mvv'
import { GripVertical, Plus, Trash2, Check } from 'lucide-react'
import { Fab, FabButton } from '@/components/ui/fab'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type TraitItem = { name: string; score: number; copy: string; description: string; added_index: number }

type ArchetypeSide = { key: string; label: string; copy: string; description: string }
type Archetype = { primary: ArchetypeSide; secondary: ArchetypeSide } | null

type PersonalityCache = {
  guidelinesId: string | null
  summary: string
  traits: TraitItem[]
  traitsSort: 'registered' | 'custom'
  archetype: Archetype
}

function SortableTraitItem({
  id, trait, index, onUpdate, onRemove,
}: {
  id: string; trait: TraitItem; index: number
  onUpdate: (index: number, field: keyof TraitItem, value: string | number) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="rounded-xl border border-border bg-background p-3 mb-2">
      <div className="flex gap-2 items-center mb-2">
        <button type="button" className="p-1 rounded hover:bg-gray-200 cursor-grab active:cursor-grabbing text-muted-foreground shrink-0" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </button>
        <Input type="text" value={trait.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder="特性のカテゴリー（例：誠実）" className="h-10 flex-1" />
        <Input type="number" min={1} max={5} value={trait.score} onChange={(e) => onUpdate(index, 'score', parseInt(e.target.value) || 3)} className="h-10 w-[64px] text-center shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">/5</span>
        <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
      </div>
      <Input type="text" value={trait.copy} onChange={(e) => onUpdate(index, 'copy', e.target.value)} placeholder="特性のコピー（例：相手の立場で考え、最後まで寄り添う。）" className="h-10 mb-2" />
      <AutoResizeTextarea value={trait.description} onChange={(e) => onUpdate(index, 'description', e.target.value)} placeholder="説明文（例：相手を第一に考え、信頼関係を大切にする姿勢）" className="min-h-[60px]" />
    </div>
  )
}

export default function BrandPersonalityPage() {
  const { companyId } = useAuth()
  const cacheKey = `admin-brand-personality-${companyId}`
  const cached = companyId ? getPageCache<PersonalityCache>(cacheKey) : null
  const [guidelinesId, setGuidelinesId] = useState<string | null>(cached?.guidelinesId ?? null)
  const [summary, setSummary] = useState<string>(cached?.summary ?? '')
  const [traits, setTraits] = useState<TraitItem[]>(cached?.traits ?? [])
  const [traitsSort, setTraitsSort] = useState<'registered' | 'custom'>(cached?.traitsSort ?? 'registered')
  const [archetype, setArchetype] = useState<Archetype>(cached?.archetype ?? null)
  const [loading, setLoading] = useState(!cached)
  const [fetchError, setFetchError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    if (!companyId) return
    setLoading(true)
    setFetchError('')

    try {
      // 特性（brand_guidelines.traits）＋ アーキタイプ（brand_personalities.archetype）。新規企業は行が未作成のため maybeSingle
      const [guidelinesRes, personalitiesRes] = await Promise.all([
        fetchWithRetry(() =>
          supabase.from('brand_guidelines').select('id, traits, traits_sort, personality_summary').eq('company_id', companyId).maybeSingle()
        ),
        fetchWithRetry(() =>
          supabase.from('brand_personalities').select('archetype').eq('company_id', companyId).maybeSingle()
        ),
      ])
      if (guidelinesRes.error) throw new Error(guidelinesRes.error)
      const parsedArchetype = ((personalitiesRes.data as Record<string, unknown> | null)?.archetype as Archetype) || null
      setArchetype(parsedArchetype)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const guidelinesData = guidelinesRes.data as Record<string, any> | null

      let parsedGuidelinesId: string | null = null
      let parsedSummary = ''
      let parsedTraits: TraitItem[] = []
      let parsedTraitsSort: 'registered' | 'custom' = 'registered'
      if (guidelinesData) {
        parsedGuidelinesId = guidelinesData.id
        parsedSummary = (guidelinesData.personality_summary as string) || ''
        setSummary(parsedSummary)
        parsedTraits = ((guidelinesData.traits as { name?: string; score?: number; copy?: string; description?: string; added_index?: number }[]) || []).map((t, i) => {
          // 旧データ（description に「コピー\n説明文」）を copy/description に分割して正規化
          const { copy, description } = resolveTraitCopy(t)
          return { name: t.name ?? '', score: t.score ?? 3, copy, description, added_index: t.added_index ?? i }
        })
        parsedTraitsSort = (guidelinesData.traits_sort as 'registered' | 'custom') || 'registered'
        setGuidelinesId(parsedGuidelinesId)
        setTraits(parsedTraits)
        setTraitsSort(parsedTraitsSort)
      }

      setPageCache(cacheKey, {
        guidelinesId: parsedGuidelinesId,
        summary: parsedSummary,
        traits: parsedTraits,
        traitsSort: parsedTraitsSort,
        archetype: parsedArchetype,
      })
    } catch (err) {
      console.error('[BrandPersonality] データ取得エラー:', err)
      const msg = err instanceof Error ? err.message : 'データの取得に失敗しました'
      setFetchError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!companyId) return
    if (getPageCache<PersonalityCache>(cacheKey)) return
    fetchData()
  }, [companyId, cacheKey])

  // --- 特性（traits）操作 ---
  const addTrait = () => {
    if (traits.length >= 5) return
    const maxIndex = traits.reduce((max, t) => Math.max(max, t.added_index), -1)
    setTraits([...traits, { name: '', score: 3, copy: '', description: '', added_index: maxIndex + 1 }])
  }
  const updateTrait = (index: number, field: keyof TraitItem, value: string | number) => {
    const updated = [...traits]
    updated[index] = { ...updated[index], [field]: value }
    setTraits(updated)
  }
  const removeTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index))
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const handleTraitsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = traits.findIndex((_, i) => `trait-${i}` === active.id)
    const newIndex = traits.findIndex((_, i) => `trait-${i}` === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      setTraits(arrayMove(traits, oldIndex, newIndex))
    }
  }

  // Supabase REST API直接fetch
  const supabasePatch = async (table: string, id: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      return { ok: true }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const supabaseInsert = async (table: string, data: Record<string, unknown>, token: string): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const body = await res.text()
        return { ok: false, error: `HTTP ${res.status}: ${body}` }
      }
      const result = await res.json()
      return { ok: true, data: result[0] }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'タイムアウト（10秒）' }
      }
      return { ok: false, error: err instanceof Error ? err.message : '不明なエラー' }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      // 特性保存（brand_guidelines.traits を部分更新／無ければ行作成）
      const cleanedTraits = traits.filter(t => t.name.trim() !== '')
      let gResult: { ok: boolean; error?: string; data?: Record<string, unknown> }
      if (guidelinesId) {
        gResult = await supabasePatch('brand_guidelines', guidelinesId, {
          traits: cleanedTraits.length > 0 ? cleanedTraits : [],
          traits_sort: traitsSort,
          personality_summary: summary.trim() || null,
        }, token)
      } else {
        gResult = await supabaseInsert('brand_guidelines', {
          company_id: companyId,
          traits: cleanedTraits.length > 0 ? cleanedTraits : [],
          traits_sort: traitsSort,
          personality_summary: summary.trim() || null,
        }, token)
        if (gResult.ok && gResult.data) {
          setGuidelinesId(gResult.data.id as string)
        }
      }
      if (!gResult.ok) {
        throw new Error('特性保存エラー: ' + gResult.error)
      }
      setTraits(cleanedTraits)

      toast.success('保存しました')
    } catch (err) {
      console.error('[BrandPersonality Save] エラー:', err)
      toast.error('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* パーソナリティ概要 */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-[90px] w-full rounded-md" />
          </CardContent>
        </Card>
        {/* 特性（カテゴリー/コピー/説明文の縦積みカード × 3） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-2/3" />
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-10 flex-1 rounded-md" />
                  <Skeleton className="h-10 w-16 rounded-md" />
                  <Skeleton className="size-9 rounded-md" />
                </div>
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-center p-10">
        <p className="text-red-600 text-sm mb-3">{fetchError}</p>
        <Button variant="outline" onClick={fetchData} className="py-2 px-4 text-[13px]">再読み込み</Button>
      </div>
    )
  }

  return (
    <div>
      {/* タイトルはヘッダーのパンくずに移管 */}
      <form id="personality-form" onSubmit={handleSubmit} className="space-y-4">
        {/* パーソナリティ概要＋特性（1カードに統合） */}
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="p-5 space-y-6">
            {/* 概要（ポータルの「感じられ方」レーダー下に表示） */}
            <div>
              <h2 className="text-xs font-bold mb-2">パーソナリティ概要</h2>
              <p className="text-xs text-muted-foreground mb-3">
                ブランドの人格全体を要約する概要文。ポータルの「感じられ方」でレーダーチャートの下に表示されます。
              </p>
              <AutoResizeTextarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="例：誠実さと革新性を兼ね備えた知性的なブランド。長期的な信頼関係を築きながら、常に新しい価値づくりに挑戦している。"
                className="min-h-[90px]"
              />
            </div>

            {/* 特性（人格スコア／brand_guidelines.traits） */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold">特性（最大5つ）</h2>
                {traits.length > 1 && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button type="button" onClick={() => setTraitsSort('registered')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${traitsSort === 'registered' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      登録順
                    </button>
                    <button type="button" onClick={() => setTraitsSort('custom')}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${traitsSort === 'custom' ? 'bg-foreground text-background' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                      カスタム
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                ブランドの性格を表す「カテゴリー・コピー・説明文」とスコア（1〜5）を設定します
              </p>
              {traitsSort === 'custom' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTraitsDragEnd}>
                  <SortableContext items={traits.map((_, i) => `trait-${i}`)} strategy={verticalListSortingStrategy}>
                    {traits.map((trait, index) => (
                      <SortableTraitItem key={`trait-${index}`} id={`trait-${index}`} trait={trait} index={index} onUpdate={updateTrait} onRemove={removeTrait} />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <>
                  {[...traits]
                    .sort((a, b) => (a.added_index ?? 0) - (b.added_index ?? 0))
                    .map((trait) => {
                      const realIndex = traits.indexOf(trait)
                      return (
                        <div key={realIndex} className="rounded-xl border border-border bg-background p-3 mb-2">
                          <div className="flex gap-2 items-center mb-2">
                            <Input type="text" value={trait.name} onChange={(e) => updateTrait(realIndex, 'name', e.target.value)} placeholder="特性のカテゴリー（例：誠実）" className="h-10 flex-1" />
                            <Input type="number" min={1} max={5} value={trait.score} onChange={(e) => updateTrait(realIndex, 'score', parseInt(e.target.value) || 3)} className="h-10 w-[64px] text-center shrink-0" />
                            <span className="text-xs text-muted-foreground shrink-0">/5</span>
                            <Button type="button" variant="outline" size="icon" onClick={() => removeTrait(realIndex)} className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></Button>
                          </div>
                          <Input type="text" value={trait.copy} onChange={(e) => updateTrait(realIndex, 'copy', e.target.value)} placeholder="特性のコピー（例：相手の立場で考え、最後まで寄り添う。）" className="h-10 mb-2" />
                          <AutoResizeTextarea value={trait.description} onChange={(e) => updateTrait(realIndex, 'description', e.target.value)} placeholder="説明文（例：相手を第一に考え、信頼関係を大切にする姿勢）" className="min-h-[60px]" />
                        </div>
                      )
                    })}
                </>
              )}
              {traits.length < 5 && (
                <Button type="button" variant="outline" onClick={addTrait} className="py-2 px-4 text-[13px]">
                  <Plus size={16} />特性を追加
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* アーキタイプ（読み取り専用。パーソナリティ診断ツールの連携で登録される／brand_personalities.archetype） */}
        {archetype && (
          <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold">アーキタイプ（主・副人格）</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">診断連携・読み取り専用</span>
              </div>
              <div className="rounded-xl border-2 border-ds-app-accent bg-blue-50/40 p-4">
                <p className="text-[10px] font-semibold tracking-wide text-ds-app-accent-hover mb-1">主人格</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg font-bold text-foreground">{archetype.primary.label}</span>
                  {archetype.primary.copy && <span className="text-sm font-semibold text-ds-app-accent-hover">{archetype.primary.copy}</span>}
                </div>
                {archetype.primary.description && (
                  <p className="mt-2 text-xs text-foreground/80 leading-relaxed">{archetype.primary.description}</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-1">副人格</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-base font-bold text-foreground">{archetype.secondary.label}</span>
                  {archetype.secondary.copy && <span className="text-sm font-semibold text-muted-foreground">{archetype.secondary.copy}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </form>

      {/* FabBar との重なりを防ぐスペーサー */}
      <div className="h-24" />

      {/* 保存 FAB（右下固定） */}
      <Fab>
        <FabButton type="submit" form="personality-form" disabled={saving} icon={<Check size={16} />}>
          {saving ? '保存中...' : '保存'}
        </FabButton>
      </Fab>
    </div>
  )
}

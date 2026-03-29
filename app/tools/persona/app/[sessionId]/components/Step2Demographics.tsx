'use client'

// Step 2: デモグラフィック（AI提案＋編集）
import { useState, useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, ArrowRight, WandSparkles, Plus, X } from 'lucide-react'
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

interface Demographics {
  persona_name: string
  age: number | string
  gender: string
  occupation: string
  company_role: string
  company_size: string
  location: string
  annual_income: string
  family: string
  education: string
  hobbies: string[]
  media_channels: string[]
  personality_traits: string[]
  daily_routine: string
  quote: string
}

interface BasicInfo {
  company_name: string
  industry_category: string
  industry_subcategory: string
  products: string
  target_description: string
}

interface Step2Props {
  demographics: Demographics
  basicInfo: BasicInfo
  onNext: (data: Demographics) => Promise<boolean>
  onBack: () => void
  onSaveField: (data: Demographics) => Promise<void>
}

const EMPTY_DEMOGRAPHICS: Demographics = {
  persona_name: '', age: '', gender: '', occupation: '', company_role: '',
  company_size: '', location: '', annual_income: '', family: '', education: '',
  hobbies: [], media_channels: [], personality_traits: [], daily_routine: '', quote: '',
}

export function Step2Demographics({ demographics, basicInfo, onNext, onBack, onSaveField }: Step2Props) {
  const [data, setData] = useState<Demographics>({
    ...EMPTY_DEMOGRAPHICS,
    ...demographics,
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiRequestedRef = useRef(false)

  // オートセーブ（1秒デバウンス）
  const triggerAutoSave = useCallback((d: Demographics) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { onSaveField(d) }, 1000)
  }, [onSaveField])

  const updateField = useCallback(<K extends keyof Demographics>(key: K, value: Demographics[K]) => {
    setData(prev => {
      const next = { ...prev, [key]: value }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  // AI提案
  const fetchAISuggestion = useCallback(async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/tools/persona/suggest-demographics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basic_info: basicInfo }),
      })
      if (!res.ok) {
        const d = await res.json()
        setAiError(d.error || 'AI提案の取得に失敗しました')
        return
      }
      const { demographics: suggested } = await res.json()
      const merged = { ...EMPTY_DEMOGRAPHICS, ...suggested }
      setData(merged)
      triggerAutoSave(merged)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setAiLoading(false)
    }
  }, [basicInfo, triggerAutoSave])

  // 初回マウント時、データがなければ自動でAI提案
  useEffect(() => {
    if (!data.persona_name && !aiRequestedRef.current) {
      aiRequestedRef.current = true
      fetchAISuggestion()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleRegenerate = () => {
    if (data.persona_name) { setConfirmOpen(true); return }
    fetchAISuggestion()
  }

  // タグ操作ヘルパー
  const addTag = (key: 'hobbies' | 'media_channels' | 'personality_traits') => {
    updateField(key, [...(data[key] || []), ''])
  }
  const removeTag = (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number) => {
    updateField(key, (data[key] || []).filter((_, i) => i !== idx))
  }
  const updateTag = (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number, value: string) => {
    const arr = [...(data[key] || [])]
    arr[idx] = value
    updateField(key, arr)
  }

  const handleNext = async () => {
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(data)
    if (!success) setSaving(false)
  }

  const isValid = data.persona_name?.trim() && data.occupation?.trim()

  if (aiLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">Step 2: デモグラフィック</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5">
              <Skeleton className="mb-4 h-5 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400">AIがペルソナを分析中...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Step 2: デモグラフィック</h1>
      <p className="mb-5 text-[13px] text-muted-foreground">
        ペルソナの基本属性を定義します。AIの提案を編集してカスタマイズできます。
      </p>

      {!aiLoading && (
        <div className="flex justify-start mb-3">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-1.5 text-xs">
            <WandSparkles className="h-3.5 w-3.5" />
            {data.persona_name ? 'AIに再提案してもらう' : 'AIに提案してもらう'}
          </Button>
        </div>
      )}

      {aiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
          {aiError}
          <button onClick={fetchAISuggestion} className="ml-2 font-medium underline hover:no-underline">再試行</button>
        </div>
      )}

      <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
        <CardContent className="p-5 space-y-5">
          {/* 基本プロフィール */}
          <div>
            <h3 className="text-sm font-bold mb-3 text-gray-700">基本プロフィール</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">名前</label>
                <Input value={data.persona_name} onChange={e => updateField('persona_name', e.target.value)} placeholder="架空の名前" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">年齢</label>
                  <Input type="number" value={data.age} onChange={e => updateField('age', e.target.value)} placeholder="35" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">性別</label>
                  <Input value={data.gender} onChange={e => updateField('gender', e.target.value)} placeholder="男性 / 女性" className="h-9 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">職業</label>
                <Input value={data.occupation} onChange={e => updateField('occupation', e.target.value)} placeholder="マーケティング部マネージャー" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">役職</label>
                <Input value={data.company_role} onChange={e => updateField('company_role', e.target.value)} placeholder="課長" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">勤務先規模</label>
                <Input value={data.company_size} onChange={e => updateField('company_size', e.target.value)} placeholder="50〜100名" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">居住地</label>
                <Input value={data.location} onChange={e => updateField('location', e.target.value)} placeholder="東京都世田谷区" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">年収</label>
                <Input value={data.annual_income} onChange={e => updateField('annual_income', e.target.value)} placeholder="500〜700万円" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">家族構成</label>
                <Input value={data.family} onChange={e => updateField('family', e.target.value)} placeholder="妻、子ども2人" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">学歴</label>
                <Input value={data.education} onChange={e => updateField('education', e.target.value)} placeholder="私立大学 経営学部卒" className="h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* 趣味・関心 */}
          <TagSection label="趣味・関心" items={data.hobbies || []} fieldKey="hobbies" placeholder="例: ランニング" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />

          {/* 情報収集チャネル */}
          <TagSection label="情報収集チャネル" items={data.media_channels || []} fieldKey="media_channels" placeholder="例: X (Twitter)" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />

          {/* 性格特性 */}
          <TagSection label="性格特性" items={data.personality_traits || []} fieldKey="personality_traits" placeholder="例: 慎重派" onAdd={addTag} onRemove={removeTag} onUpdate={updateTag} />

          {/* 日常の過ごし方 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">1日の過ごし方</label>
            <Textarea value={data.daily_routine} onChange={e => updateField('daily_routine', e.target.value)} placeholder="朝7時に起床、通勤中にニュースアプリをチェック..." rows={2} className="text-sm" />
          </div>

          {/* 口癖 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">口癖・座右の銘</label>
            <Input value={data.quote} onChange={e => updateField('quote', e.target.value)} placeholder="「まずは数字で見せないと」" className="h-9 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="gap-1">
          {saving ? '保存中...' : 'ゴール・課題へ'}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認</AlertDialogTitle>
            <AlertDialogDescription>現在の内容が上書きされます。よろしいですか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => fetchAISuggestion()}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// タグ入力セクション
function TagSection({ label, items, fieldKey, placeholder, onAdd, onRemove, onUpdate }: {
  label: string
  items: string[]
  fieldKey: 'hobbies' | 'media_channels' | 'personality_traits'
  placeholder: string
  onAdd: (key: 'hobbies' | 'media_channels' | 'personality_traits') => void
  onRemove: (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number) => void
  onUpdate: (key: 'hobbies' | 'media_channels' | 'personality_traits', idx: number, value: string) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-bold mb-2 text-gray-700">{label}</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white pl-3 pr-1 py-1">
            <Input
              value={item}
              onChange={e => onUpdate(fieldKey, idx, e.target.value)}
              placeholder={placeholder}
              className="h-6 w-28 border-0 p-0 text-xs focus-visible:ring-0"
            />
            <button onClick={() => onRemove(fieldKey, idx)} className="rounded-full p-0.5 hover:bg-gray-100">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onAdd(fieldKey)} className="h-8 text-xs gap-1 rounded-full">
          <Plus className="h-3 w-3" /> 追加
        </Button>
      </div>
    </div>
  )
}

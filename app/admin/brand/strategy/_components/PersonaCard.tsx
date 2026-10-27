// ペルソナカード（ペルソナ一覧の編集。ニーズ・課題・意思決定要因・購買障壁などの行操作を含む）
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea'
import { Plus, Trash2, UserCircle } from 'lucide-react'
import { AVATAR_EMOJIS } from '@/lib/persona/avatars'
import { type PersonaItem } from './types'

const emptyPersona = (): PersonaItem => ({
  name: '',
  avatar_emoji: '',
  age_range: '',
  occupation: '',
  description: '',
  needs: [],
  pain_points: [],
  decision_factors: [],
  buying_barriers: [],
  brand_expectations: '',
})

// Tier1 配列項目（意思決定要因・購買障壁）
type PersonaListField = 'decision_factors' | 'buying_barriers'

type Props = {
  personas: PersonaItem[]
  setPersonas: (personas: PersonaItem[]) => void
  openAvatarIdx: number | null
  setOpenAvatarIdx: (index: number | null) => void
}

export function PersonaCard({ personas, setPersonas, openAvatarIdx, setOpenAvatarIdx }: Props) {
  // ペルソナ操作
  const addPersona = () => {
    if (personas.length >= 5) return
    setPersonas([...personas, emptyPersona()])
  }

  const updatePersona = (index: number, field: keyof PersonaItem, value: string | string[]) => {
    const updated = [...personas]
    updated[index] = { ...updated[index], [field]: value }
    setPersonas(updated)
  }

  const removePersona = (index: number) => {
    setPersonas(personas.filter((_, i) => i !== index))
  }

  // ニーズの操作
  const addNeed = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: [...updated[personaIndex].needs, ''],
    }
    setPersonas(updated)
  }

  const updateNeed = (personaIndex: number, needIndex: number, value: string) => {
    const updated = [...personas]
    const needs = [...updated[personaIndex].needs]
    needs[needIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], needs }
    setPersonas(updated)
  }

  const removeNeed = (personaIndex: number, needIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      needs: updated[personaIndex].needs.filter((_, i) => i !== needIndex),
    }
    setPersonas(updated)
  }

  // 課題の操作
  const addPainPoint = (personaIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: [...updated[personaIndex].pain_points, ''],
    }
    setPersonas(updated)
  }

  const updatePainPoint = (personaIndex: number, pointIndex: number, value: string) => {
    const updated = [...personas]
    const pain_points = [...updated[personaIndex].pain_points]
    pain_points[pointIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], pain_points }
    setPersonas(updated)
  }

  const removePainPoint = (personaIndex: number, pointIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      pain_points: updated[personaIndex].pain_points.filter((_, i) => i !== pointIndex),
    }
    setPersonas(updated)
  }

  // Tier1 配列項目（意思決定要因・購買障壁）の汎用操作。needs/pain_points と同じ要領。
  const addPersonaListItem = (personaIndex: number, field: PersonaListField) => {
    const updated = [...personas]
    updated[personaIndex] = { ...updated[personaIndex], [field]: [...updated[personaIndex][field], ''] }
    setPersonas(updated)
  }
  const updatePersonaListItem = (personaIndex: number, field: PersonaListField, itemIndex: number, value: string) => {
    const updated = [...personas]
    const list = [...updated[personaIndex][field]]
    list[itemIndex] = value
    updated[personaIndex] = { ...updated[personaIndex], [field]: list }
    setPersonas(updated)
  }
  const removePersonaListItem = (personaIndex: number, field: PersonaListField, itemIndex: number) => {
    const updated = [...personas]
    updated[personaIndex] = {
      ...updated[personaIndex],
      [field]: updated[personaIndex][field].filter((_, i) => i !== itemIndex),
    }
    setPersonas(updated)
  }

  return (
    <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
      <CardContent className="p-5">
        <div>
          <h2 className="text-xs font-bold mb-3">ペルソナ</h2>
          <p className="text-xs text-muted-foreground mb-4">
            ターゲット顧客のペルソナを設定します（最大5件）
          </p>

          {personas.map((persona, index) => (
            <div key={index} className="border border-border rounded-xl p-4 mb-3 bg-background">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-bold text-muted-foreground">
                  ペルソナ {index + 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removePersona(index)}
                  className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>

              <div className="mb-5">
                <h2 className="text-xs font-bold mb-3">顔アイコン</h2>
                <div className="relative w-fit">
                  <button
                    type="button"
                    onClick={() => setOpenAvatarIdx(openAvatarIdx === index ? null : index)}
                    title="顔アイコンを変更"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition hover:ring-2 hover:ring-ds-app-accent/40"
                  >
                    {persona.avatar_emoji
                      ? <span className="text-3xl leading-none" role="img" aria-label="顔アイコン">{persona.avatar_emoji}</span>
                      : <UserCircle className="h-10 w-10 text-gray-400" />}
                  </button>
                  {openAvatarIdx === index && (
                    <div className="absolute left-0 top-14 z-20 w-56 rounded-lg border border-border bg-white p-2 shadow-lg">
                      <div className="grid grid-cols-6 gap-1">
                        {AVATAR_EMOJIS.map(em => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => { updatePersona(index, 'avatar_emoji', persona.avatar_emoji === em ? '' : em); setOpenAvatarIdx(null) }}
                            className={`flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted ${persona.avatar_emoji === em ? 'bg-ds-app-accent/5 ring-1 ring-ds-app-accent' : ''}`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-xs font-bold mb-3">ペルソナ名称</h2>
                <Input
                  type="text"
                  value={persona.name}
                  onChange={(e) => updatePersona(index, 'name', e.target.value)}
                  placeholder="例: 情報感度の高いマーケター"
                  className="h-10"
                />
              </div>

              <div className="flex gap-3">
                <div className="mb-5 flex-1">
                  <h2 className="text-xs font-bold mb-3">年齢層</h2>
                  <Input
                    type="text"
                    value={persona.age_range}
                    onChange={(e) => updatePersona(index, 'age_range', e.target.value)}
                    placeholder="例: 30-40代"
                    className="h-10"
                  />
                </div>
                <div className="mb-5 flex-1">
                  <h2 className="text-xs font-bold mb-3">職業</h2>
                  <Input
                    type="text"
                    value={persona.occupation}
                    onChange={(e) => updatePersona(index, 'occupation', e.target.value)}
                    placeholder="例: マーケティング担当者"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="mb-5">
                <h2 className="text-xs font-bold mb-3">説明</h2>
                <AutoResizeTextarea
                  value={persona.description}
                  onChange={(e) => updatePersona(index, 'description', e.target.value)}
                  placeholder="このペルソナの背景や特徴"
                  className="min-h-[80px]"
                />
              </div>

              <div className="mb-5">
                <h2 className="text-xs font-bold mb-3">ニーズ</h2>
                {persona.needs.map((need, needIndex) => (
                  <div key={needIndex} className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={need}
                      onChange={(e) => updateNeed(index, needIndex, e.target.value)}
                      placeholder={`ニーズ ${needIndex + 1}`}
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeNeed(index, needIndex)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addNeed(index)}
                  className="py-1.5 px-3 text-xs"
                >
                  <Plus size={16} />ニーズを追加
                </Button>
              </div>

              <div>
                <h2 className="text-xs font-bold mb-3">課題・ペインポイント</h2>
                {persona.pain_points.map((point, pointIndex) => (
                  <div key={pointIndex} className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={point}
                      onChange={(e) => updatePainPoint(index, pointIndex, e.target.value)}
                      placeholder={`課題 ${pointIndex + 1}`}
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePainPoint(index, pointIndex)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addPainPoint(index)}
                  className="py-1.5 px-3 text-xs"
                >
                  <Plus size={16} />課題を追加
                </Button>
              </div>

              <div className="mt-5">
                <h2 className="text-xs font-bold mb-3">意思決定要因</h2>
                {persona.decision_factors.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={item}
                      onChange={(e) => updatePersonaListItem(index, 'decision_factors', itemIndex, e.target.value)}
                      placeholder={`意思決定要因 ${itemIndex + 1}`}
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePersonaListItem(index, 'decision_factors', itemIndex)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addPersonaListItem(index, 'decision_factors')}
                  className="py-1.5 px-3 text-xs"
                >
                  <Plus size={16} />意思決定要因を追加
                </Button>
              </div>

              <div className="mt-5">
                <h2 className="text-xs font-bold mb-3">購買障壁</h2>
                {persona.buying_barriers.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex gap-2 mb-2">
                    <Input
                      type="text"
                      value={item}
                      onChange={(e) => updatePersonaListItem(index, 'buying_barriers', itemIndex, e.target.value)}
                      placeholder={`購買障壁 ${itemIndex + 1}`}
                      className="h-10 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removePersonaListItem(index, 'buying_barriers', itemIndex)}
                      className="size-9 shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addPersonaListItem(index, 'buying_barriers')}
                  className="py-1.5 px-3 text-xs"
                >
                  <Plus size={16} />購買障壁を追加
                </Button>
              </div>

              <div className="mt-5">
                <h2 className="text-xs font-bold mb-3">ブランドへの期待</h2>
                <AutoResizeTextarea
                  value={persona.brand_expectations}
                  onChange={(e) => updatePersona(index, 'brand_expectations', e.target.value)}
                  placeholder="このペルソナがブランドに期待する価値"
                  className="min-h-[60px]"
                />
              </div>
            </div>
          ))}

          {personas.length < 5 && (
            <Button
              type="button"
              variant="outline"
              onClick={addPersona}
              className="py-2 px-4 text-[13px]"
            >
              <Plus size={16} />ペルソナを追加
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

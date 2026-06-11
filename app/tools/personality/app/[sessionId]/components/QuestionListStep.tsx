'use client'

// 診断質問の共通UI（Step 2/3 で使用）
// 5問×1画面。選択式（single/multi）＋Q9のみ任意自由記述。1秒デバウンスのオートセーブ。
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import {
  type DiagnosisQuestion,
  type DiagnosisAnswers,
  isPageAnswered,
} from '../../../lib/questions'

interface QuestionListStepProps {
  stepNumber: number
  title: string
  questions: DiagnosisQuestion[]
  answers: DiagnosisAnswers
  nextLabel: string
  onNext: (answers: DiagnosisAnswers) => Promise<boolean>
  onBack: () => void
  onSaveField: (answers: DiagnosisAnswers) => Promise<void>
}

export function QuestionListStep({
  stepNumber,
  title,
  questions,
  answers,
  nextLabel,
  onNext,
  onBack,
  onSaveField,
}: QuestionListStepProps) {
  const [localAnswers, setLocalAnswers] = useState<DiagnosisAnswers>(answers)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRenderRef = useRef(true)

  // 回答変更を1秒デバウンスでオートセーブ
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSaveField(localAnswers)
    }, 1000)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [localAnswers]) // eslint-disable-line react-hooks/exhaustive-deps

  const getSelected = (questionId: string): string[] => {
    const a = localAnswers[questionId]
    return Array.isArray(a) ? a : []
  }

  const handleSelect = (question: DiagnosisQuestion, option: string) => {
    setLocalAnswers(prev => {
      const current = prev[question.id]
      const selected = Array.isArray(current) ? current : []
      let next: string[]

      if (question.type === 'single') {
        next = [option]
      } else {
        const max = question.maxSelections ?? question.options.length
        if (selected.includes(option)) {
          next = selected.filter(o => o !== option)
        } else if (selected.length < max) {
          next = [...selected, option]
        } else {
          return prev // 上限到達時は無視（解除してから選び直す）
        }
      }

      return { ...prev, [question.id]: next }
    })
  }

  const handleFreeText = (questionId: string, value: string) => {
    setLocalAnswers(prev => ({ ...prev, [`${questionId}_free`]: value }))
  }

  const handleNext = async () => {
    if (!isPageAnswered(questions, localAnswers)) return
    setSaving(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const success = await onNext(localAnswers)
    if (!success) setSaving(false)
  }

  const answeredCount = questions.filter(q => getSelected(q.id).length > 0).length
  const isValid = isPageAnswered(questions, localAnswers)

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold text-foreground">{`Step ${stepNumber}: ${title}`}</h1>
        <span className="text-xs text-muted-foreground">{answeredCount} / {questions.length} 問回答済み</span>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        選択肢に正解はありません。「うちのブランドらしいかどうか」の直感で選んでください。
      </p>

      <div className="space-y-5">
        {questions.map((question) => {
          const selected = getSelected(question.id)
          const max = question.maxSelections
          return (
            <Card key={question.id} className="bg-[hsl(0_0%_97%)] border shadow-none">
              <CardContent className="p-5">
                <h2 className="text-sm font-bold text-foreground mb-1">
                  <span className="text-blue-600 mr-2">Q{question.number}.</span>
                  {question.text}
                </h2>
                {question.type === 'multi' && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {max ? `最大${max}つまで選択できます` : '複数選択できます'}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const isSelected = selected.includes(option)
                    const isDisabled =
                      question.type === 'multi' &&
                      !isSelected &&
                      max !== undefined &&
                      selected.length >= max
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSelect(question, option)}
                        disabled={isDisabled}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : isDisabled
                              ? 'border-border bg-background text-muted-foreground/40 cursor-not-allowed'
                              : 'border-border bg-background text-foreground hover:border-blue-400 hover:bg-blue-50'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        {option}
                      </button>
                    )
                  })}
                </div>
                {question.hasFreeText && (
                  <div className="mt-4">
                    <Textarea
                      value={(localAnswers[`${question.id}_free`] as string) || ''}
                      onChange={(e) => handleFreeText(question.id, e.target.value)}
                      placeholder={question.freeTextPlaceholder}
                      maxLength={500}
                      rows={2}
                      className="bg-background text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* フッターナビゲーション */}
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-background/80 backdrop-blur border-t border-border px-6 py-3 flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={saving} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>
        <Button onClick={handleNext} disabled={saving || !isValid} className="gap-1">
          {saving ? '保存中...' : nextLabel}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

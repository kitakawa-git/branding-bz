'use client'

// Step 2: 診断質問 前半（Q1〜Q5）
import { QuestionListStep } from './QuestionListStep'
import { QUESTIONS_PAGE_1, type DiagnosisAnswers } from '../../../lib/questions'

interface Step2Props {
  answers: DiagnosisAnswers
  onNext: (answers: DiagnosisAnswers) => Promise<boolean>
  onBack: () => void
  onSaveField: (answers: DiagnosisAnswers) => Promise<void>
}

export function Step2Questions({ answers, onNext, onBack, onSaveField }: Step2Props) {
  return (
    <QuestionListStep
      stepNumber={2}
      title="診断質問（前半）"
      questions={QUESTIONS_PAGE_1}
      answers={answers}
      nextLabel="後半の質問へ"
      onNext={onNext}
      onBack={onBack}
      onSaveField={onSaveField}
    />
  )
}

'use client'

// Step 3: 診断質問 後半（Q6〜Q10）
import { QuestionListStep } from './QuestionListStep'
import { QUESTIONS_PAGE_2, type DiagnosisAnswers } from '../../../lib/questions'

interface Step3Props {
  answers: DiagnosisAnswers
  onNext: (answers: DiagnosisAnswers) => Promise<boolean>
  onBack: () => void
  onSaveField: (answers: DiagnosisAnswers) => Promise<void>
}

export function Step3Questions({ answers, onNext, onBack, onSaveField }: Step3Props) {
  return (
    <QuestionListStep
      stepNumber={3}
      title="診断質問（後半）"
      questions={QUESTIONS_PAGE_2}
      answers={answers}
      nextLabel="AI診断へ"
      onNext={onNext}
      onBack={onBack}
      onSaveField={onSaveField}
    />
  )
}

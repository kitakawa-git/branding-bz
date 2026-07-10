'use client'

// Step 1: 基本情報フォーム（共通コンポーネント ToolStep1BasicInfo の薄いラッパー）
// ペルソナビルダーは競合企業欄を表示しない。顧客層からペルソナを生成する。
import { ToolStep1BasicInfo, type ToolBasicInfo } from '@/components/shared/ToolStep1BasicInfo'

interface Step1Props {
  basicInfo: Partial<ToolBasicInfo>
  onNext: (data: ToolBasicInfo) => Promise<boolean>
  onSaveField: (data: ToolBasicInfo) => Promise<void>
}

export function Step1BasicInfo({ basicInfo, onNext, onSaveField }: Step1Props) {
  return (
    <ToolStep1BasicInfo
      basicInfo={basicInfo}
      onNext={onNext}
      onSaveField={onSaveField}
      nextLabel="ペルソナ生成へ"
      showCompetitors={false}
      targetLabel="主なターゲット"
      targetLead="現在ビジネスをしている顧客像を入力してください。ここで挙げた顧客層ごとに、次のステップでペルソナを生成します。"
    />
  )
}

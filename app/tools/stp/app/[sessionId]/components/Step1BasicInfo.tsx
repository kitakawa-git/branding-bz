'use client'

// Step 1: 基本情報フォーム（共通コンポーネント ToolStep1BasicInfo の薄いラッパー）
// STP は競合企業欄を表示する。
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
      nextLabel="セグメンテーションへ"
      showCompetitors
    />
  )
}

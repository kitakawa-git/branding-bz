// 実行: npx tsx lib/tools/prompt-context.test.ts
//
// 期待値は 2026-10-27、共通化する前の各 route のコード断片をそのまま実行して記録したもの
// （stpFull＝suggest-segments、stpBasic＝suggest-target-fit-map、demo*＝suggest-demographics、
//   goal*＝suggest-goals、journeyBd＝suggest-journey）。Claude に渡る文字列が1文字も変わらないことを固定する。
import assert from 'node:assert/strict'
import {
  pushStpCompanyProfile,
  pushStpCompanyBasics,
  formatBusinessDescriptions,
  formatTargetSegments,
} from './prompt-context'

const fixtures: Record<string, Record<string, unknown>> = {
  "full": {
    "company_name": "テスト株式会社",
    "industry_category": "製造業",
    "industry_subcategory": "金属加工",
    "business_descriptions": [
      {
        "title": " 精密加工 ",
        "description": " 試作から量産まで "
      },
      {
        "title": "",
        "description": "空タイトルは除外"
      },
      {
        "title": "検査",
        "description": ""
      }
    ],
    "target_segments": [
      {
        "name": "自動車部品メーカー",
        "description": "Tier1"
      },
      {
        "name": " ",
        "description": "除外"
      },
      {
        "name": "医療機器",
        "description": ""
      }
    ]
  },
  "legacy": {
    "company_name": "旧形式社",
    "industry": "その他",
    "industry_other": "伝統工芸",
    "products": "漆器の製造販売",
    "current_customers": "百貨店",
    "target_description": "贈答品を探す40代"
  },
  "legacyIndustry": {
    "industry": "小売業",
    "products": "雑貨"
  },
  "empty": {},
  "emptyArrays": {
    "business_descriptions": [],
    "target_segments": []
  }
}

const expected: Record<string, {
  stpFull: string[]; stpBasic: string[]
  demoBd: string; demoTs: string; goalBd: string; goalTs: string; journeyBd: string
}> = {
  "full": {
    "stpFull": [
      "## 企業情報",
      "- 企業名・ブランド名: テスト株式会社",
      "- 業種: 製造業（金属加工）",
      "- 事業内容:\n  1. 精密加工: 試作から量産まで\n  2. 検査",
      "- 現状の主要顧客:\n  1. 自動車部品メーカー: Tier1\n  2. 医療機器"
    ],
    "stpBasic": [
      "## 企業情報",
      "- 企業名・ブランド名: テスト株式会社",
      "- 業種: 製造業（金属加工）",
      "- 事業内容:\n  1. 精密加工: 試作から量産まで\n  2. 検査"
    ],
    "demoBd": " 精密加工 :  試作から量産まで \n  検査",
    "demoTs": "自動車部品メーカー: Tier1\n  医療機器",
    "goalBd": " 精密加工 :  試作から量産まで 、検査",
    "goalTs": "自動車部品メーカー: Tier1、医療機器",
    "journeyBd": " 精密加工 :  試作から量産まで 、検査"
  },
  "legacy": {
    "stpFull": [
      "## 企業情報",
      "- 企業名・ブランド名: 旧形式社",
      "- 業種: 伝統工芸",
      "- 事業内容: 漆器の製造販売",
      "- 現状の主要顧客: 百貨店"
    ],
    "stpBasic": [
      "## 企業情報",
      "- 企業名・ブランド名: 旧形式社",
      "- 業種: 伝統工芸"
    ],
    "demoBd": "漆器の製造販売",
    "demoTs": "贈答品を探す40代",
    "goalBd": "漆器の製造販売",
    "goalTs": "贈答品を探す40代",
    "journeyBd": "漆器の製造販売"
  },
  "legacyIndustry": {
    "stpFull": [
      "## 企業情報",
      "- 業種: 小売業",
      "- 事業内容: 雑貨"
    ],
    "stpBasic": [
      "## 企業情報",
      "- 業種: 小売業"
    ],
    "demoBd": "雑貨",
    "demoTs": "",
    "goalBd": "雑貨",
    "goalTs": "",
    "journeyBd": "雑貨"
  },
  "empty": {
    "stpFull": [
      "## 企業情報"
    ],
    "stpBasic": [
      "## 企業情報"
    ],
    "demoBd": "",
    "demoTs": "",
    "goalBd": "",
    "goalTs": "",
    "journeyBd": ""
  },
  "emptyArrays": {
    "stpFull": [
      "## 企業情報"
    ],
    "stpBasic": [
      "## 企業情報"
    ],
    "demoBd": "",
    "demoTs": "",
    "goalBd": "",
    "goalTs": "",
    "journeyBd": ""
  }
}

for (const [name, basicInfo] of Object.entries(fixtures)) {
  const e = expected[name]
  const full: string[] = []
  pushStpCompanyProfile(full, basicInfo)
  assert.deepEqual(full, e.stpFull, `${name}: pushStpCompanyProfile`)

  const basics: string[] = []
  pushStpCompanyBasics(basics, basicInfo)
  assert.deepEqual(basics, e.stpBasic, `${name}: pushStpCompanyBasics`)

  assert.equal(formatBusinessDescriptions(basicInfo, '\n  '), e.demoBd, `${name}: demographics 事業内容`)
  assert.equal(formatTargetSegments(basicInfo, '\n  '), e.demoTs, `${name}: demographics 主要顧客`)
  assert.equal(formatBusinessDescriptions(basicInfo, '、'), e.goalBd, `${name}: goals 事業内容`)
  assert.equal(formatTargetSegments(basicInfo, '、'), e.goalTs, `${name}: goals 主要顧客`)
  assert.equal(formatBusinessDescriptions(basicInfo, '、'), e.journeyBd, `${name}: journey 事業内容`)
}

// pushStpCompanyBasics は basic_info が無くても落ちない（元の suggest-brand-stance / target-fit-map と同じ）
const none: string[] = []
pushStpCompanyBasics(none, undefined)
assert.deepEqual(none, ['## 企業情報'])

console.log('prompt-context: all tests passed')

// AI機能の利用上限（web_search等のコスト管理）。
// 上限を変える場合はこの定数のみを変更する（唯一の定義源）。

// 競合提案: 1社あたり月あたりの実行回数上限
export const COMPETITOR_SUGGEST_MONTHLY_LIMIT = 1

// ターゲット提案: 1社あたり月あたりの実行回数上限（管理画面・STP共有）
export const TARGET_SUGGEST_MONTHLY_LIMIT = 1

// パーソナリティ診断: 1社あたり月あたりの実行回数上限
// （web_search なしのため連打対策水準。company_id なしのツール単独ユーザーはセッション上限で制御）
export const PERSONALITY_DIAGNOSIS_MONTHLY_LIMIT = 10

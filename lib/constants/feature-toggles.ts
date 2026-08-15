// 機能のオン/オフトグル定義（唯一の定義源）
// 管理画面「設定」ページとポータル側の出し分けの両方から参照する。
// 機能を追加するときは、companies に boolean カラムを足し、この配列に1行追加するだけでよい。
// 設定ページはこの配列を map してトグル行を生成する（個別ハードコード禁止）。

export const FEATURE_TOGGLES = [
  {
    key: 'timeline_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'Good Actionタイムライン',
    description:
      'オフにすると、ポータルのタイムラインページとサイドバーメニューが非表示になります。投稿データは削除されません。',
  },
  {
    key: 'kpi_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: '目標・KPI管理',
    description:
      'オフにすると、ポータルと管理画面の両方から目標・KPI関連の表示が非表示になります。設定済みのデータは削除されません。',
  },
  {
    key: 'card_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'スマート名刺',
    description:
      'オフにすると、公開名刺ページ（/card/[slug]）が「非公開」表示になり、ポータルの名刺プレビュー・管理画面のQRコード出力/アクセス解析も非表示になります。名刺URL（slug）やプロフィールは削除されず、再オンで一斉に復活します。',
  },
  {
    key: 'learning_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'ラーニング',
    description:
      'オフにすると、ポータルと管理画面の両方からラーニング関連の表示が非表示になります。登録済みの動画・カテゴリー・視聴履歴は削除されず、再オンで復活します。',
  },
  {
    key: 'announcements_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'お知らせ配信',
    description:
      'オフにすると、管理画面のお知らせ管理とポータルのお知らせ表示が非表示になります。配信済みのお知らせは削除されません。',
  },
  {
    key: 'survey_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'インナーサーベイ',
    description:
      'オフにすると、管理画面のサーベイ管理とポータルのサーベイ結果が非表示になります。実施済みのサーベイと回答は削除されません。',
  },
  {
    key: 'market_survey_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: '市場調査',
    description:
      'オフにすると、管理画面とポータルの両方から市場調査が非表示になります。取り込み済みの調査データは削除されません。',
  },
  {
    key: 'quiz_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'ブランド理解度テスト',
    description:
      'オフにすると、管理画面の理解度テストが非表示になります。作成済みの設問と回答は削除されません。',
  },
  {
    key: 'ci_manual_enabled', // companies のカラム名（boolean NOT NULL DEFAULT true）
    label: 'CIマニュアル出力',
    description:
      'オフにすると、管理画面のCIマニュアル出力が非表示になります。ブランドの登録内容は削除されません。',
  },
] as const

export type FeatureToggle = (typeof FEATURE_TOGGLES)[number]
export type FeatureToggleKey = FeatureToggle['key']

// companies レコードから参照すべきカラム名一覧（providers の select 構築に使う）
export const FEATURE_TOGGLE_COLUMNS: readonly string[] = FEATURE_TOGGLES.map(
  (t) => t.key
)

// 判定は全箇所で `!== false` 方式に統一する。
// カラム未追加（undefined）・null でも「有効」扱いになり安全。
export function isFeatureEnabled(
  company: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  return company?.[key] !== false
}

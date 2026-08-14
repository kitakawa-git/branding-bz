// Googleフォーム回答（Excel/CSV）取り込みAPI
// POST /api/brand-score/surveys/import
// ============================================================
// multipart/form-data で受け取り、mode で分岐する。
//   mode=preview … パース結果を返すだけ（DB書き込みなし）
//   mode=commit  … サーベイ・設問・回答を新規作成する
// ファイルは preview / commit で2回送信されるが、数十KBのため
// 一時保存の複雑さを持ち込むよりも単純さを優先している。
//
// 複数ファイルを1サーベイにまとめられる。職種別にフォームを分けた場合
// （例: 営業向け／本社向け）、ファイルごとに部署ラベルを変えて取り込むと
// 部署別スコアで両者を比較できる。設問は文言が一致するものを同一とみなし、
// 片方にしかない設問は追加の設問として登録する（文言は書き換えない）。
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { fileToRows } from '@/lib/brand-score/excel-rows'
import { getAdminContext } from '@/lib/learning/auth'
import {
  parseGoogleFormRows,
  type ParsedImport,
  type SurveyCategory,
} from '@/lib/brand-score/import-google-form'
import { mergeQuestions, buildIndexMap } from '@/lib/brand-score/merge-questions'
import { guardCompanyFeature } from '@/lib/billing/guard'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const VALID_ROLE_CATEGORIES = ['executive', 'manager', 'staff'] as const
const VALID_CATEGORIES: SurveyCategory[] = ['why', 'how', 'what']
// Supabase の一括 INSERT を分割する単位（243名×30問 = 7,290行を想定）
const INSERT_CHUNK_SIZE = 1000

// ファイル → 2次元配列の変換は lib/brand-score/excel-rows.ts に移設した
// （市場調査の GT表取り込みでも同じものを使うため）

// ────────────────────────────────────────────
// POST
// ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminContext()
    if (!admin) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
    const denied = await guardCompanyFeature(admin.companyId, 'innerSurvey')
    if (denied) return denied

    const form = await request.formData()
    const mode = String(form.get('mode') ?? 'preview')
    const files = form.getAll('files').filter((f): f is File => f instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 })
    }

    let totalSize = 0
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json({ error: `${file.name} が空です` }, { status: 400 })
      }
      if (!/\.(xlsx|csv)$/i.test(file.name)) {
        return NextResponse.json(
          { error: `${file.name} は .xlsx または .csv ではありません` },
          { status: 400 }
        )
      }
      totalSize += file.size
    }
    if (totalSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '合計ファイルサイズは10MB以下にしてください' },
        { status: 400 }
      )
    }

    // パース（ファイル単位）
    const parsedList: ParsedImport[] = []
    for (const file of files) {
      try {
        const rows = await fileToRows(file)
        parsedList.push(parseGoogleFormRows(rows))
      } catch (err) {
        return NextResponse.json(
          {
            error: `${file.name}: ${err instanceof Error ? err.message : 'ファイルを解析できませんでした'}`,
          },
          { status: 400 }
        )
      }
    }

    const merged = mergeQuestions(parsedList)

    if (mode === 'preview') {
      return NextResponse.json({
        files: files.map((f, i) => ({
          fileName: f.name,
          questionCount: parsedList[i].stats.questionCount,
          respondentCount: parsedList[i].stats.respondentCount,
          blankCells: parsedList[i].stats.blankCells,
          unmappedLabels: parsedList[i].unmappedLabels,
        })),
        merged,
        stats: {
          fileCount: files.length,
          questionCount: merged.length,
          respondentCount: parsedList.reduce((a, p) => a + p.stats.respondentCount, 0),
          sharedQuestionCount: merged.filter((m) => m.fileIndexes.length === files.length).length,
        },
      })
    }

    if (mode !== 'commit') {
      return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
    }

    // ── commit ──────────────────────────────

    // 未変換ラベルが残っている状態で取り込むと、その回答が黙って欠落する
    for (let i = 0; i < parsedList.length; i++) {
      const unmapped = parsedList[i].unmappedLabels
      if (unmapped.length > 0) {
        return NextResponse.json(
          {
            error: `${files[i].name}: 1〜5に変換できない回答があります: ${unmapped.slice(0, 5).join('、')}`,
            unmappedLabels: unmapped,
          },
          { status: 400 }
        )
      }
    }

    const title = String(form.get('title') ?? '').trim()
    const totalMembersRaw = String(form.get('totalMembers') ?? '').trim()

    // ファイルごとの部署・役職ラベル（送信順はファイルと対応する）
    const departments = form.getAll('departments').map((v) => String(v).trim())
    const roleCategories = form.getAll('roleCategories').map((v) => String(v).trim())

    if (!title) {
      return NextResponse.json({ error: 'サーベイ名を入力してください' }, { status: 400 })
    }
    if (departments.length !== files.length || roleCategories.length !== files.length) {
      return NextResponse.json(
        { error: '部署・役職の件数がファイル数と一致しません' },
        { status: 400 }
      )
    }
    for (const role of roleCategories) {
      if (role && !VALID_ROLE_CATEGORIES.includes(role as never)) {
        return NextResponse.json(
          { error: 'roleCategory は executive / manager / staff のいずれかです' },
          { status: 400 }
        )
      }
    }

    const totalRespondents = parsedList.reduce((a, p) => a + p.stats.respondentCount, 0)
    const totalMembers = Number(totalMembersRaw)
    if (!Number.isInteger(totalMembers) || totalMembers < totalRespondents) {
      return NextResponse.json(
        {
          error: `配布対象者数は回答者数の合計（${totalRespondents}名）以上の整数で入力してください`,
        },
        { status: 400 }
      )
    }

    // 設問カテゴリの上書き（プレビュー画面で変更された場合）。マージ後の並びに対応する。
    const categoriesRaw = form.get('categories')
    let questions: { sortOrder: number; category: SurveyCategory; questionText: string }[] = merged
    if (typeof categoriesRaw === 'string' && categoriesRaw.trim() !== '') {
      let overrides: unknown
      try {
        overrides = JSON.parse(categoriesRaw)
      } catch {
        return NextResponse.json({ error: 'categories の形式が不正です' }, { status: 400 })
      }
      if (!Array.isArray(overrides) || overrides.length !== merged.length) {
        return NextResponse.json(
          { error: 'categories の件数が設問数と一致しません' },
          { status: 400 }
        )
      }
      if (!overrides.every((c) => VALID_CATEGORIES.includes(c as SurveyCategory))) {
        return NextResponse.json(
          { error: 'categories は why / how / what のいずれかです' },
          { status: 400 }
        )
      }
      questions = merged.map((q, i) => ({ ...q, category: overrides[i] as SurveyCategory }))
    }

    const supabase = getSupabaseAdmin()

    // 回答期間は全ファイルのタイムスタンプの min/max から決める
    const timestamps = parsedList
      .flatMap((p) => p.respondents.map((r) => r.submittedAt))
      .filter((t): t is string => t !== null)
      .sort()
    const startsAt = timestamps[0] ?? null
    const endsAt = timestamps[timestamps.length - 1] ?? null

    // 1. サーベイ作成（外部実施済みなので closed で登録する）
    const { data: survey, error: surveyError } = await supabase
      .from('brand_surveys')
      .insert({
        company_id: admin.companyId,
        title,
        status: 'closed',
        source: 'imported',
        total_members: totalMembers,
        respondent_count: totalRespondents,
        starts_at: startsAt,
        ends_at: endsAt,
      })
      .select('id')
      .single()

    if (surveyError || !survey) {
      console.error('[Import] サーベイ作成エラー:', surveyError?.message)
      return NextResponse.json(
        { error: surveyError?.message ?? 'サーベイの作成に失敗しました' },
        { status: 500 }
      )
    }

    // 以降の失敗はサーベイごと削除して巻き戻す（FK CASCADE で設問・回答も消える）
    const rollback = async (message: string, detail?: string) => {
      console.error('[Import] ロールバック:', message, detail ?? '')
      await supabase.from('brand_surveys').delete().eq('id', survey.id)
      return NextResponse.json({ error: message }, { status: 500 })
    }

    // 2. 設問を一括作成
    const { data: insertedQuestions, error: questionsError } = await supabase
      .from('brand_survey_questions')
      .insert(
        questions.map((q) => ({
          survey_id: survey.id,
          category: q.category,
          question_text: q.questionText,
          source: 'custom',
          sort_order: q.sortOrder,
          is_active: true,
          reference_data: {},
        }))
      )
      .select('id, sort_order')

    if (questionsError || !insertedQuestions) {
      return rollback('設問の作成に失敗しました', questionsError?.message)
    }

    // マージ後の並びで question_id を引けるようにする
    const idBySortOrder = new Map<number, string>(
      insertedQuestions.map((q) => [q.sort_order as number, q.id as string])
    )
    const questionIds = questions.map((q) => idBySortOrder.get(q.sortOrder))
    if (questionIds.some((id) => !id)) {
      return rollback('設問IDの解決に失敗しました')
    }

    // 3. 回答を展開（1回答者 × N設問 → N行）
    // ファイルごとに設問の並びが違いうるため、ファイル内index → マージ後index に写像する
    const importedAt = new Date().toISOString()
    const responseRows: {
      survey_id: string
      question_id: string
      score: number
      department: string | null
      role_category: string | null
      submitted_at: string
    }[] = []

    parsedList.forEach((parsed, fileIndex) => {
      const indexMap = buildIndexMap(parsed, merged)
      const department = departments[fileIndex] || null
      const roleCategory = roleCategories[fileIndex] || null

      for (const respondent of parsed.respondents) {
        // 1提出ぶんは submitted_at を同一値に揃える（既存 respond API と同じ流儀）
        const submittedAt = respondent.submittedAt ?? importedAt
        respondent.scores.forEach((score, i) => {
          if (score === null) return // 未回答は行を作らない
          responseRows.push({
            survey_id: survey.id,
            question_id: questionIds[indexMap[i]] as string,
            score,
            department,
            role_category: roleCategory,
            submitted_at: submittedAt,
          })
        })
      }
    })

    // 4. チャンク分割して INSERT
    for (let i = 0; i < responseRows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = responseRows.slice(i, i + INSERT_CHUNK_SIZE)
      const { error: insertError } = await supabase.from('brand_survey_responses').insert(chunk)
      if (insertError) {
        return rollback('回答の登録に失敗しました', insertError.message)
      }
    }

    return NextResponse.json({
      success: true,
      surveyId: survey.id,
      fileCount: files.length,
      questionCount: questions.length,
      respondentCount: totalRespondents,
      responseCount: responseRows.length,
    })
  } catch (err) {
    console.error('[Import] 予期しないエラー:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

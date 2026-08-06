// アカウント一括登録のCSV解析（I/O を持たない純関数）
// ============================================================
// 期待する列（順不同・見出し行が必要）:
//   氏名 / メールアドレス / パスワード / 区分（任意）
//
// 1行でも壊れていたら全体を止める、という作りにはしない。
// 50人ぶんのファイルで1行のtypoのために全部やり直すのは現実的でないため、
// 行ごとに ok / error を返して、画面で確認してから実行させる。
// ============================================================

import { MEMBER_ROLE_OPTIONS, type MemberRole } from '@/lib/constants/member-roles'

export interface MemberCsvRow {
  /** CSVの行番号（見出しを1行目とした実際の行。エラー表示に使う） */
  lineNumber: number
  displayName: string
  email: string
  password: string
  roleCategory: MemberRole | null
  /** この行を登録できない理由。null なら登録できる */
  error: string | null
}

export interface MemberCsvParseResult {
  rows: MemberCsvRow[]
  /** 見出しが見つからない等、ファイル全体が扱えないときの理由 */
  fatal: string | null
}

/** 見出しのゆらぎを吸収する。全角スペースや「メール」だけの表記も拾う */
const HEADER_ALIASES: Record<keyof Omit<MemberCsvRow, 'lineNumber' | 'error'>, string[]> = {
  displayName: ['氏名', '名前', '表示名', 'name', 'display_name'],
  email: ['メールアドレス', 'メール', 'email', 'mail', 'e-mail'],
  password: ['パスワード', 'password', 'pass'],
  roleCategory: ['区分', '役職区分', 'role', 'role_category'],
}

function normalizeHeader(v: unknown): string {
  return String(v ?? '')
    .replace(/[\s　]/g, '')
    .toLowerCase()
}

/** 「経営層」「manager」どちらでも受ける。空欄は未設定（null） */
export function parseRoleCategory(value: unknown): MemberRole | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const byLabel = MEMBER_ROLE_OPTIONS.find((o) => o.label === raw)
  if (byLabel) return byLabel.value
  const byValue = MEMBER_ROLE_OPTIONS.find((o) => o.value === raw.toLowerCase())
  if (byValue) return byValue.value
  return 'invalid'
}

/** ざっくりした形式チェック。厳密な検証は Supabase 側に任せる */
function isEmailLike(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/** Supabase の既定の下限に合わせる */
export const MIN_PASSWORD_LENGTH = 6

/**
 * 表形式（fileToRows の出力）を1行=1アカウントに変換する。
 * 同じファイル内でメールアドレスが重複していたら後の行をエラーにする。
 */
export function parseMemberRows(table: unknown[][]): MemberCsvParseResult {
  if (!table || table.length === 0) {
    return { rows: [], fatal: 'ファイルが空です' }
  }

  // 見出し行を探す。先頭に説明文が入っているファイルがあるので上から10行見る
  let headerIndex = -1
  let columnOf: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {}

  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const cells = (table[i] ?? []).map(normalizeHeader)
    const found: typeof columnOf = {}
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = cells.findIndex((c) => aliases.some((a) => c === normalizeHeader(a)))
      if (idx >= 0) found[key as keyof typeof HEADER_ALIASES] = idx
    }
    if (found.displayName !== undefined && found.email !== undefined) {
      headerIndex = i
      columnOf = found
      break
    }
  }

  if (headerIndex === -1) {
    return {
      rows: [],
      fatal: '見出し行が見つかりません。1行目に「氏名」「メールアドレス」「パスワード」を入れてください',
    }
  }
  if (columnOf.password === undefined) {
    return { rows: [], fatal: '「パスワード」の列が見つかりません' }
  }

  const cell = (row: unknown[], key: keyof typeof HEADER_ALIASES): string => {
    const idx = columnOf[key]
    if (idx === undefined) return ''
    return String(row[idx] ?? '').trim()
  }

  const seenEmails = new Set<string>()
  const rows: MemberCsvRow[] = []

  for (let i = headerIndex + 1; i < table.length; i++) {
    const raw = table[i] ?? []
    const displayName = cell(raw, 'displayName')
    const email = cell(raw, 'email')
    const password = cell(raw, 'password')
    const roleRaw = cell(raw, 'roleCategory')

    // 完全な空行は黙って飛ばす（末尾の空行でエラーを出さない）
    if (!displayName && !email && !password) continue

    const role = parseRoleCategory(roleRaw)

    let error: string | null = null
    if (!displayName) error = '氏名が空です'
    else if (!email) error = 'メールアドレスが空です'
    else if (!isEmailLike(email)) error = 'メールアドレスの形式が正しくありません'
    else if (!password) error = 'パスワードが空です'
    else if (password.length < MIN_PASSWORD_LENGTH)
      error = `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`
    else if (role === 'invalid') error = `区分「${roleRaw}」は経営層／管理職／従業員のいずれかにしてください`
    else if (seenEmails.has(email.toLowerCase())) error = 'このファイル内でメールアドレスが重複しています'

    if (!error) seenEmails.add(email.toLowerCase())

    rows.push({
      lineNumber: i + 1,
      displayName,
      email,
      password,
      roleCategory: role === 'invalid' ? null : role,
      error,
    })
  }

  if (rows.length === 0) {
    return { rows: [], fatal: '登録できる行がありません' }
  }
  return { rows, fatal: null }
}

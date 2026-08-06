// 実行: npx tsx lib/members/parse-member-csv.test.ts
import assert from 'node:assert/strict'
import {
  MIN_PASSWORD_LENGTH,
  parseMemberRows,
  parseRoleCategory,
} from './parse-member-csv'

// ── 区分の受け方 ──
assert.equal(parseRoleCategory('経営層'), 'executive')
assert.equal(parseRoleCategory('manager'), 'manager')
assert.equal(parseRoleCategory('MANAGER'), 'manager')
assert.equal(parseRoleCategory(''), null, '空欄は未設定')
assert.equal(parseRoleCategory('部長'), 'invalid')

// ── 見出しのゆらぎ ──
{
  const r = parseMemberRows([
    ['名前', 'メール', 'password'],
    ['山田太郎', 'yamada@example.com', 'secret123'],
  ])
  assert.equal(r.fatal, null)
  assert.equal(r.rows[0].displayName, '山田太郎')
  assert.equal(r.rows[0].error, null)
}

// ── 見出しが上から数行下にあっても拾う ──
{
  const r = parseMemberRows([
    ['※このシートに入力してください'],
    [],
    ['氏名', 'メールアドレス', 'パスワード', '区分'],
    ['佐藤花子', 'sato@example.com', 'secret123', '管理職'],
  ])
  assert.equal(r.fatal, null)
  assert.equal(r.rows.length, 1)
  assert.equal(r.rows[0].roleCategory, 'manager')
  assert.equal(r.rows[0].lineNumber, 4, 'エラー表示のため実際の行番号を持つ')
}

// ── 行ごとにエラーを返し、全体は止めない ──
{
  const r = parseMemberRows([
    ['氏名', 'メールアドレス', 'パスワード', '区分'],
    ['正常', 'ok@example.com', 'secret123', '従業員'],
    ['', 'noname@example.com', 'secret123', ''],
    ['形式不正', 'not-an-email', 'secret123', ''],
    ['短い', 'short@example.com', '123', ''],
    ['重複', 'ok@example.com', 'secret123', ''],
    ['区分不正', 'role@example.com', 'secret123', '部長'],
    [],
  ])
  assert.equal(r.fatal, null)
  assert.equal(r.rows.length, 6, '完全な空行は飛ばす')
  assert.equal(r.rows[0].error, null)
  assert.equal(r.rows[1].error, '氏名が空です')
  assert.equal(r.rows[2].error, 'メールアドレスの形式が正しくありません')
  assert.equal(r.rows[3].error, `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`)
  assert.equal(r.rows[4].error, 'このファイル内でメールアドレスが重複しています')
  assert.ok(r.rows[5].error?.includes('区分'))
}

// ── ファイル全体が扱えない場合 ──
{
  assert.ok(parseMemberRows([]).fatal)
  assert.ok(parseMemberRows([['都道府県', '人口'], ['東京', '1400万']]).fatal, '見出しが無い')
  assert.equal(
    parseMemberRows([['氏名', 'メールアドレス'], ['山田', 'y@example.com']]).fatal,
    '「パスワード」の列が見つかりません'
  )
  assert.ok(parseMemberRows([['氏名', 'メールアドレス', 'パスワード']]).fatal, '見出しだけ')
}

console.log('✓ parse-member-csv: 全テスト通過')

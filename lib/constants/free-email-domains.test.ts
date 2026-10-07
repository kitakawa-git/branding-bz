// free-email-domains の単体テスト（例外許可リスト）
// 実行: npx tsx lib/constants/free-email-domains.test.ts
import assert from 'node:assert/strict'
import { parseEmailAllowlist, isBlockedFreeEmail, isFreeEmailDomain } from './free-email-domains'

const allow = parseEmailAllowlist(' Allowed.User@gmail.com , other@yahoo.co.jp ,, ')

// 一覧の解釈: 空白・空要素を除き、小文字化する
assert.deepEqual([...allow].sort(), ['allowed.user@gmail.com', 'other@yahoo.co.jp'])
assert.equal(parseEmailAllowlist(undefined).size, 0)
assert.equal(parseEmailAllowlist('').size, 0)

// 許可リストのアドレスは通す（大文字小文字・前後空白は無視）
assert.equal(isBlockedFreeEmail('allowed.user@gmail.com', allow), false)
assert.equal(isBlockedFreeEmail('ALLOWED.USER@GMAIL.COM', allow), false)
assert.equal(isBlockedFreeEmail(' allowed.user@gmail.com ', allow), false)
assert.equal(isBlockedFreeEmail('other@yahoo.co.jp', allow), false)

// それ以外のフリーメールは今までどおり拒否（同じドメインでも別アドレスは拒否）
assert.equal(isBlockedFreeEmail('someone@gmail.com', allow), true)
assert.equal(isBlockedFreeEmail('allowed.user+x@gmail.com', allow), true)
assert.equal(isBlockedFreeEmail('allowed.user@googlemail.com', allow), true)
assert.equal(isBlockedFreeEmail('someone@gmail.com', new Set()), true)

// 企業ドメインはリストに関係なく通す
assert.equal(isBlockedFreeEmail('taro@include.bz', allow), false)
assert.equal(isBlockedFreeEmail('taro@include.bz', new Set()), false)

// 判定の土台（フリーメール判定そのもの）は変えていない
assert.equal(isFreeEmailDomain('someone@gmail.com'), true)
assert.equal(isFreeEmailDomain('taro@include.bz'), false)

console.log('free-email-domains.test: all passed')

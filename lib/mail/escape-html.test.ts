// 実行: npx tsx lib/mail/escape-html.test.ts
//
// 通知メールの HTML に利用者の入力を差し込むときの XSS 対策。挙動を変えないよう固定する。
import assert from 'node:assert/strict'
import { escapeHtml } from './escape-html'

assert.equal(escapeHtml(''), '')
assert.equal(escapeHtml('株式会社テスト'), '株式会社テスト')
assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
assert.equal(escapeHtml(`a & b 'c'`), 'a &amp; b &#039;c&#039;')
// & を最初に置換するので二重エスケープにならない
assert.equal(escapeHtml('&lt;'), '&amp;lt;')
assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;')

console.log('escape-html: all tests passed')

# 問い合わせフォーム完全実装指示

branding-bz の問い合わせフォームを動くようにしてください。以下3つの作業を行います。

## 作業1: Supabase に contact_inquiries テーブルを作成

Supabase ダッシュボードの SQL Editor、または supabase CLI で以下を実行してください。

```sql
CREATE TABLE contact_inquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS有効化
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

-- 誰でもINSERTできる（公開フォームのため）
CREATE POLICY "Anyone can submit inquiry"
  ON contact_inquiries FOR INSERT
  WITH CHECK (true);

-- super_admin のみ閲覧・更新可能
CREATE POLICY "Only super admins can view inquiries"
  ON contact_inquiries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can update inquiries"
  ON contact_inquiries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
```

マイグレーションファイルも作成:
`supabase/migrations/YYYYMMDDHHMMSS_create_contact_inquiries.sql` に上記SQLを保存。

## 作業2: スーパー管理画面に「お問い合わせ」メニューと一覧ページを追加

### 2-A: サイドバーにメニュー追加

`app/superadmin/components/SuperAdminSidebar.tsx` の navItems 配列に追加:

```tsx
import { Building2, Newspaper, MessageSquare, ArrowLeft, type LucideIcon } from 'lucide-react'

const navItems: NavItem[] = [
  { href: '/superadmin/companies', label: '企業一覧', icon: Building2 },
  { href: '/superadmin/news', label: 'ニュース', icon: Newspaper },
  { href: '/superadmin/inquiries', label: 'お問い合わせ', icon: MessageSquare },
]
```

### 2-B: 問い合わせ一覧ページを新規作成

`app/superadmin/inquiries/page.tsx` を新規作成。以下の要件で実装:

- Supabase から `contact_inquiries` テーブルを `created_at DESC` で取得
- テーブル形式で一覧表示（列: ステータス、会社名、担当者名、メール、送信日時）
- ステータスは色分けバッジで表示:
  - `new` → 青「新規」
  - `in_progress` → 黄「対応中」
  - `done` → 緑「完了」
- 行クリックで詳細ダイアログ（Dialog）を表示し、問い合わせ内容の全文とステータス変更ボタンを配置
- ステータス変更は supabase の update で即時反映
- UIスタイルは既存の `app/superadmin/companies/page.tsx` に合わせる（Card、テーブル、muted色のヘッダー等）
- `'use client'` コンポーネントとして実装

## 作業3: メール通知機能の追加

問い合わせが送信されたら kitakawa@include.bz に通知メールを送る。

### 3-A: Resend をインストール

```bash
npm install resend
```

### 3-B: 環境変数を追加

`.env.local` に追加（値は後で設定）:
```
RESEND_API_KEY=re_xxxxxxxx
CONTACT_NOTIFICATION_EMAIL=kitakawa@include.bz
```

Vercel の環境変数にも同じキーを追加すること。

### 3-C: API route を修正

`app/api/contact/route.ts` を修正し、Supabase INSERT 成功後にメール送信を追加:

```tsx
import { Resend } from 'resend'

// POST handler 内、INSERT成功後に追加:
const resendApiKey = process.env.RESEND_API_KEY
const notificationEmail = process.env.CONTACT_NOTIFICATION_EMAIL

if (resendApiKey && notificationEmail) {
  const resend = new Resend(resendApiKey)
  try {
    await resend.emails.send({
      from: 'branding.bz <noreply@branding.bz>',  // ※ Resendでドメイン認証済みの送信元に変更
      to: notificationEmail,
      subject: `【branding.bz】新しいお問い合わせ: ${contact_name.trim()}`,
      html: `
        <h2>新しいお問い合わせが届きました</h2>
        <table style="border-collapse:collapse;">
          <tr><td style="padding:8px;font-weight:bold;">会社名</td><td style="padding:8px;">${company_name?.trim() || '未入力'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">担当者名</td><td style="padding:8px;">${contact_name.trim()}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">メール</td><td style="padding:8px;">${email.trim()}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">電話番号</td><td style="padding:8px;">${phone?.trim() || '未入力'}</td></tr>
        </table>
        <h3>お問い合わせ内容</h3>
        <p style="white-space:pre-wrap;">${message.trim()}</p>
        <hr />
        <p><a href="https://branding.bz/superadmin/inquiries">管理画面で確認する</a></p>
      `,
    })
  } catch (emailError) {
    // メール送信失敗してもフォーム送信自体は成功扱い
    console.error('notification email error:', emailError)
  }
}
```

**重要:**
- メール送信が失敗しても、フォーム送信のレスポンスは成功（200）を返すこと
- Resend API Key が未設定の場合はメール送信をスキップすること（開発環境対応）
- HTMLメール内のユーザー入力値はXSS対策としてエスケープすること

## 検証

```bash
npx tsc --noEmit              # 型エラー0件
npx eslint app/superadmin/inquiries/ app/api/contact/ --quiet  # エラー0件
```

動作確認:
1. /contact にアクセスしてフォーム送信 → 成功画面が表示される
2. /superadmin/inquiries に送信した問い合わせが一覧表示される
3. ステータスを「対応中」「完了」に変更できる
4. RESEND_API_KEY 設定時、通知メールが届く

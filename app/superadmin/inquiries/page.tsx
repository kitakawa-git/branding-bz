'use client'

// スーパー管理画面: お問い合わせ一覧ページ
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Inquiry = {
  id: string
  company_name: string | null
  contact_name: string
  email: string
  phone: string | null
  message: string
  status: 'new' | 'in_progress' | 'done'
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new:         { label: '新規',   className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '対応中', className: 'bg-yellow-100 text-yellow-700' },
  done:        { label: '完了',   className: 'bg-green-100 text-green-700' },
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Inquiry | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchInquiries = async () => {
    const { data, error } = await supabase
      .from('contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[SuperAdmin] 問い合わせ取得エラー:', error.message)
    } else {
      setInquiries((data as Inquiry[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchInquiries()
  }, [])

  const updateStatus = async (id: string, status: Inquiry['status']) => {
    setUpdating(true)
    const { error } = await supabase
      .from('contact_inquiries')
      .update({ status })
      .eq('id', id)

    if (!error) {
      setInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      )
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : prev)
    }
    setUpdating(false)
  }

  if (loading) {
    return <p className="text-muted-foreground text-center p-10">読み込み中...</p>
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground">お問い合わせ</h2>
      </div>

      {/* テーブル */}
      <Card className="bg-muted/50 border shadow-none">
        <CardContent className="p-6">
          {inquiries.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">
              お問い合わせはありません
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">ステータス</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">会社名</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">担当者名</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">メール</th>
                  <th className="text-left px-4 py-3 bg-muted text-muted-foreground font-semibold border-b border-border text-xs">送信日時</th>
                  <th className="px-4 py-3 bg-muted border-b border-border"></th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => {
                  const s = STATUS_LABELS[inquiry.status] ?? STATUS_LABELS.new
                  return (
                    <tr key={inquiry.id}>
                      <td className="px-4 py-3 border-b border-border">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.className}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px]">
                        {inquiry.company_name || '—'}
                      </td>
                      <td className="px-4 py-3 border-b border-border text-foreground font-semibold">
                        {inquiry.contact_name}
                      </td>
                      <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px]">
                        {inquiry.email}
                      </td>
                      <td className="px-4 py-3 border-b border-border text-muted-foreground text-[13px]">
                        {new Date(inquiry.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="px-4 py-3 border-b border-border">
                        <button
                          onClick={() => setSelected(inquiry)}
                          className="text-blue-600 text-sm font-semibold"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 text-[13px] text-muted-foreground text-right">
        全{inquiries.length}件
      </div>

      {/* 詳細ダイアログ */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>お問い合わせ詳細</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-y-2">
                <span className="text-muted-foreground font-semibold">会社名</span>
                <span className="col-span-2">{selected.company_name || '—'}</span>
                <span className="text-muted-foreground font-semibold">担当者名</span>
                <span className="col-span-2">{selected.contact_name}</span>
                <span className="text-muted-foreground font-semibold">メール</span>
                <span className="col-span-2">{selected.email}</span>
                <span className="text-muted-foreground font-semibold">電話番号</span>
                <span className="col-span-2">{selected.phone || '—'}</span>
                <span className="text-muted-foreground font-semibold">送信日時</span>
                <span className="col-span-2">{new Date(selected.created_at).toLocaleString('ja-JP')}</span>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold mb-1">お問い合わせ内容</p>
                <p className="whitespace-pre-wrap bg-muted rounded-md p-3">{selected.message}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold mb-2">ステータス変更</p>
                <div className="flex gap-2">
                  {(['new', 'in_progress', 'done'] as const).map((st) => {
                    const s = STATUS_LABELS[st]
                    const isActive = selected.status === st
                    return (
                      <Button
                        key={st}
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        disabled={updating || isActive}
                        onClick={() => updateStatus(selected.id, st)}
                      >
                        {s.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

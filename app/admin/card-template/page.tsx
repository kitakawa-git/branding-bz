'use client'

// スマート名刺ページ: 印象タグ設定 + QRコード出力を統合
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AdminDataProvider'
import { isFeatureEnabled } from '@/lib/constants/feature-toggles'
import { ALL_IMPRESSION_TAGS as ALL_TAGS } from '@/lib/brand-score/impression-tags'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getPageCache, setPageCache } from '@/lib/page-cache'
import { QrCode, WandSparkles, Loader2, Check } from 'lucide-react'
import {
  generatePreviewQRDataURL,
  generateHighResQRDataURL,
  downloadDataURLAsFile,
  getQRFilename,
  dataURLToUint8Array,
  downloadQRCode,
} from '@/lib/qr-download'

// ============================================
// 印象タグ設定（語彙は lib/brand-score/impression-tags.ts が唯一の定義源）
// ============================================

interface TagMapping {
  tag: string
  is_expected: boolean
  updated_at: string | null
}

// ============================================
// QRコード
// ============================================
type MemberWithQR = {
  id: string
  name: string
  slug: string
  position: string
  department: string
  qrPreview: string
}

export default function SmartCardPage() {
  const { companyId, company } = useAuth()

  // 機能トグル: スマート名刺が無効なら案内のみ表示（リダイレクトはしない）
  const cardEnabled = isFeatureEnabled(company, 'card_enabled')

  // --- 印象タグ設定 state ---
  const [mappings, setMappings] = useState<TagMapping[]>([])
  const [tagLoading, setTagLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState<string[] | null>(null)

  // --- QRコード state ---
  const cacheKey = `admin-card-template-${companyId}`
  const cached = getPageCache<MemberWithQR[]>(cacheKey)
  const [members, setMembers] = useState<MemberWithQR[]>(cached ?? [])
  const [qrLoading, setQrLoading] = useState(!cached)
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ============================================
  // 印象タグ設定ロジック
  // ============================================
  const fetchMappings = useCallback(async () => {
    if (!companyId) return
    setTagLoading(true)
    try {
      const res = await fetch(`/api/brand-score/tag-mappings?company_id=${companyId}`)
      if (!res.ok) throw new Error('取得失敗')
      const data = await res.json()
      setMappings(data.mappings || [])
    } catch (err) {
      console.error('[settings] タグマッピング取得エラー:', err)
      toast.error('タグマッピングの取得に失敗しました')
    } finally {
      setTagLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  const toggleTag = (tag: string) => {
    setMappings(prev =>
      prev.map(m => (m.tag === tag ? { ...m, is_expected: !m.is_expected } : m)),
    )
  }

  const selectedCount = mappings.filter(m => m.is_expected).length

  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    try {
      const res = await fetch('/api/brand-score/tag-mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          mappings: mappings.map(m => ({ tag: m.tag, is_expected: m.is_expected })),
        }),
      })
      if (!res.ok) throw new Error('保存失敗')
      toast.success('保存しました')
    } catch (err) {
      console.error('[settings] 保存エラー:', err)
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const applySuggestion = (tags: string[]) => {
    setMappings(prev =>
      prev.map(m => ({ ...m, is_expected: tags.includes(m.tag) })),
    )
  }

  const handleSuggest = async () => {
    if (!companyId) return
    setSuggesting(true)
    try {
      const res = await fetch('/api/brand-score/tag-mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'AI提案に失敗しました')
      }
      const data = await res.json()
      const suggestedTags: string[] = data.expected_tags || []

      if (selectedCount > 0) {
        setPendingSuggestion(suggestedTags)
        setShowOverwriteDialog(true)
      } else {
        applySuggestion(suggestedTags)
        toast.success('AIの提案を反映しました')
      }
    } catch (err) {
      console.error('[settings] AI提案エラー:', err)
      toast.error(err instanceof Error ? err.message : 'AI提案に失敗しました')
    } finally {
      setSuggesting(false)
    }
  }

  const handleConfirmOverwrite = () => {
    if (pendingSuggestion) {
      applySuggestion(pendingSuggestion)
      toast.success('AIの提案を反映しました')
    }
    setPendingSuggestion(null)
    setShowOverwriteDialog(false)
  }

  // ============================================
  // QRコードロジック
  // ============================================
  useEffect(() => {
    if (!companyId) return
    if (getPageCache<MemberWithQR[]>(cacheKey)) return

    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, position, department, slug')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const withQR = await Promise.all(
          data.map(async (m) => ({
            ...m,
            qrPreview: await generatePreviewQRDataURL(m.slug),
          }))
        )
        setMembers(withQR)
        setPageCache(cacheKey, withQR)
      }
      setQrLoading(false)
    }
    fetchMembers()
  }, [companyId, cacheKey])

  const handleDownload = async (slug: string, name: string, id: string) => {
    setDownloadingId(id)
    try {
      await downloadQRCode(slug, name)
    } catch (err) {
      console.error('QRコード生成エラー:', err)
    }
    setDownloadingId(null)
  }

  const handleBulkDownload = async () => {
    setBulkDownloading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      await Promise.all(
        members.map(async (m) => {
          const dataUrl = await generateHighResQRDataURL(m.slug)
          const uint8 = dataURLToUint8Array(dataUrl)
          zip.file(getQRFilename(m.name), uint8)
        })
      )

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      downloadDataURLAsFile(url, '名刺QR_一括.zip')
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('一括ダウンロードエラー:', err)
      alert('一括ダウンロードに失敗しました')
    }
    setBulkDownloading(false)
  }

  // ============================================
  // レンダリング
  // ============================================
  // 機能トグルがオフ: 内容は表示せず、案内のみ（設定ページから再オン可能）
  if (!cardEnabled) {
    return (
      <div>
        <Card className="bg-[hsl(0_0%_97%)] border shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-[15px] m-0 mb-4">
              この機能は現在オフになっています。設定ページから再度オンにできます。
            </p>
            <Link
              href="/admin/settings"
              className="text-sm font-semibold text-ds-app-accent hover:underline no-underline"
            >
              設定ページを開く
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* タイトルはヘッダーのパンくずに移動 */}
      {/* ===== セクション1: 印象タグ設定 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-bold text-foreground">印象タグ設定</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggest}
              disabled={suggesting}
            >
              {suggesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <WandSparkles size={14} />
              )}
              {suggesting ? 'AI提案中...' : 'AIに提案してもらう'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            名刺閲覧者から集めた印象と、期待するブランドイメージの一致度を測定します。選ばれてほしいタグを3〜4個選んでください。
          </p>

          {tagLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {mappings.map(m => (
                  <button
                    key={m.tag}
                    type="button"
                    onClick={() => toggleTag(m.tag)}
                    className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-md ${
                      m.is_expected
                        ? 'border-ds-app-accent-soft bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          m.is_expected ? 'text-ds-app-accent-hover' : 'text-gray-700'
                        }`}
                      >
                        {m.tag}
                      </span>
                      {m.is_expected && (
                        <div className="w-5 h-5 rounded-full bg-ds-app-accent-soft flex items-center justify-center shrink-0">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  {selectedCount}個選択中
                  {selectedCount > 0 && selectedCount < 3 && '（3〜4個の選択を推奨します）'}
                  {selectedCount > 4 && '（3〜4個の選択を推奨します）'}
                </p>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存する'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== セクション2: QRコード出力 ===== */}
      <Card className="bg-[hsl(0_0%_97%)] border shadow-none mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-foreground">QRコード出力</h2>
            <Button
              size="sm"
              onClick={handleBulkDownload}
              disabled={bulkDownloading || members.length === 0}
              className={bulkDownloading || members.length === 0 ? 'opacity-60' : ''}
            >
              {bulkDownloading ? '生成中...' : <><QrCode className="h-4 w-4" />一括ダウンロード</>}
            </Button>
          </div>

          {qrLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="border border-border rounded-xl p-5 text-center">
                  <Skeleton className="w-[120px] h-[120px] mx-auto mb-3" />
                  <Skeleton className="h-4 w-24 mx-auto mb-1" />
                  <Skeleton className="h-3 w-32 mx-auto mb-3" />
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-muted-foreground text-center p-10">
              従業員が登録されていません
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
              {members.map((member) => (
                <div key={member.id} className="border border-border rounded-xl p-5 text-center">
                  {member.qrPreview && (
                    <img
                      src={member.qrPreview}
                      alt={`${member.name} QR`}
                      width={120}
                      height={120}
                      className="block mx-auto mb-3"
                    />
                  )}
                  <p className="text-sm font-bold text-foreground mb-1">
                    {member.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {member.position || '-'} / {member.department || '-'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(member.slug, member.name, member.id)}
                    disabled={downloadingId === member.id}
                    className={`w-full text-[13px] py-2 px-3 ${downloadingId === member.id ? 'opacity-50' : ''}`}
                  >
                    {downloadingId === member.id ? '生成中...' : 'ダウンロード'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 印刷ガイド */}
      <Card className="bg-blue-50 border-blue-200 shadow-none">
        <CardContent className="p-5">
          <h3 className="text-[15px] font-bold text-foreground mb-3">
            印刷ガイド
          </h3>
          <ul className="m-0 pl-5 text-sm text-foreground leading-8">
            <li>推奨サイズ: <strong>20mm x 20mm</strong>(名刺裏面に最適)</li>
            <li>推奨配置: 名刺裏面の右下または中央</li>
            <li>解像度: 1000 x 1000 px(300dpi相当の印刷用高解像度)</li>
            <li>形式: PNG(白背景)</li>
            <li>余白を確保し、QRコードの周囲に最低2mmの白マージンを設けてください</li>
            <li>読み取りテスト: 印刷後、スマートフォンで読み取れることを必ず確認してください</li>
          </ul>
        </CardContent>
      </Card>

      {/* 上書き確認ダイアログ */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>現在の設定を上書きしますか?</AlertDialogTitle>
            <AlertDialogDescription>
              AIが提案したタグで現在の選択を置き換えます。この操作は保存するまで確定しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSuggestion(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              上書きする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

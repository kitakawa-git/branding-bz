'use client'

// 名刺プレビューDialog: スマホフレーム内にiframeで名刺ページを表示
// 最適化: slugが確定した時点でiframeをプリロードし、Dialog表示時は即座に表示
import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, QrCode } from 'lucide-react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string | null
  name: string | null
}

// フレーム実寸: スマホ(844 + padding 16) + ボタン(40 + margin 20) = 920px
const FRAME_HEIGHT = 920

export function CardPreviewDialog({ open, onOpenChange, slug, name }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(1)
  const [iframeReady, setIframeReady] = useState(false)
  const loadedSlugRef = useRef<string | null>(null)

  useEffect(() => {
    const update = () => {
      const available = window.innerHeight * 0.92
      setScale(Math.min(1, available / FRAME_HEIGHT))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // slug変更時にリセット
  useEffect(() => {
    if (slug !== loadedSlugRef.current) {
      setIframeReady(false)
      loadedSlugRef.current = null
    }
  }, [slug])

  const handleIframeLoad = useCallback(() => {
    setIframeReady(true)
    loadedSlugRef.current = slug
  }, [slug])

  if (!slug) return null

  const cardUrl = `/card/${slug}`

  const handleDownloadQR = async () => {
    setDownloading(true)
    try {
      const { downloadQRCode } = await import('@/lib/qr-download')
      await downloadQRCode(slug, name || 'member')
    } catch (err) {
      console.error('QRコード生成エラー:', err)
    }
    setDownloading(false)
  }

  return (
    <>
      {/* プリロード用: Dialog外でiframeを常時レンダリング（非表示） */}
      {!open && !iframeReady && (
        <iframe
          src={cardUrl}
          onLoad={handleIframeLoad}
          className="fixed -left-[9999px] -top-[9999px]"
          style={{ width: 390, height: 844, visibility: 'hidden' }}
          tabIndex={-1}
          aria-hidden="true"
          title="名刺プリロード"
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[430px] p-0 gap-0 bg-transparent border-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">名刺プレビュー</DialogTitle>

          {/* scaleした実寸をコンテナの高さに反映させる */}
          <div style={{ height: FRAME_HEIGHT * scale }}>
            <div className="flex flex-col items-center origin-top" style={{ transform: `scale(${scale})` }}>
              {/* スマホフレーム */}
              <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
                {/* ノッチ */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-900 rounded-b-2xl z-10" />

                {/* スクリーン */}
                <div className="relative bg-white rounded-[2rem] overflow-hidden" style={{ width: 390, height: 844 }}>
                  {/* ローディングスケルトン */}
                  {!iframeReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
                      <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse mb-4" />
                      <div className="w-32 h-4 bg-gray-100 rounded animate-pulse mb-2" />
                      <div className="w-24 h-3 bg-gray-50 rounded animate-pulse" />
                    </div>
                  )}
                  <iframe
                    src={cardUrl}
                    onLoad={handleIframeLoad}
                    className="w-full h-full border-0"
                    title="名刺プレビュー"
                  />
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-3 mt-5 w-full max-w-[390px]">
                <Button
                  asChild
                  className="flex-1 h-10 gap-2"
                >
                  <a href={cardUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} />
                    名刺ページを開く
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadQR}
                  disabled={downloading}
                  className="flex-1 h-10 gap-2"
                >
                  <QrCode size={14} />
                  {downloading ? '生成中...' : 'QRダウンロード'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

import QRCode from 'qrcode'

// === 定数 ===
const BASE_URL = 'https://branding.bz'
const HIGH_RES_WIDTH = 1000
const HIGH_RES_MARGIN = 2
const PREVIEW_WIDTH = 160
const PREVIEW_MARGIN = 1

// === ユーティリティ関数 ===

/** カードURLを生成 */
export function getCardUrl(slug: string): string {
  return `${BASE_URL}/card/${slug}`
}

/** ダウンロードファイル名を生成 */
export function getQRFilename(name: string): string {
  return `名刺QR_${name}.png`
}

/** 高解像度QRコード data URL を生成（1000x1000px） */
export async function generateHighResQRDataURL(slug: string): Promise<string> {
  const url = getCardUrl(slug)
  return QRCode.toDataURL(url, {
    width: HIGH_RES_WIDTH,
    margin: HIGH_RES_MARGIN,
    errorCorrectionLevel: 'M',
  })
}

/** プレビュー用QRコード data URL を生成（160x160px） */
export async function generatePreviewQRDataURL(slug: string): Promise<string> {
  const url = getCardUrl(slug)
  return QRCode.toDataURL(url, {
    width: PREVIEW_WIDTH,
    margin: PREVIEW_MARGIN,
  })
}

/** ブラウザでファイルをダウンロード（data URLまたはblob URL対応） */
export function downloadDataURLAsFile(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** QRコードを生成してダウンロード（ワンステップ） */
export async function downloadQRCode(slug: string, name: string): Promise<void> {
  const dataUrl = await generateHighResQRDataURL(slug)
  const filename = getQRFilename(name)
  downloadDataURLAsFile(dataUrl, filename)
}

/** data URL から Uint8Array を取得（JSZip用） */
export function dataURLToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

'use client'

// YouTube IFrame Player API で再生イベントを捕捉し、視聴進捗を記録するプレイヤー。
// - セッション開始: 最初の PLAYING で POST /api/learning/views → view_id 保持
// - 進捗送信: PLAYING 中は 15秒ごとに PATCH（間引き）。PAUSED/ENDED で即送信
// - 離脱時: visibilitychange(hidden) / beforeunload で keepalive 付き PATCH
// - 完了判定: progress >= 90% もしくは ENDED で completed=true
// - duration 確定: 初回 getDuration() を進捗 PATCH に同梱（動画側 duration 未設定時のみ確定）
import { useEffect, useRef } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

// IFrame Player API を一度だけロードする（複数プレイヤー・再マウントに耐える）
let apiPromise: Promise<any> | null = null
function loadYouTubeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    // 既存のコールバックがあれば連鎖させる
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
  return apiPromise
}

const PROGRESS_INTERVAL_MS = 15000

type Props = {
  // YouTube の動画ID（11桁）
  youtubeVideoId: string
  // DB 上の learning_videos.id（UUID）
  dbVideoId: string
  // 動画側 duration_seconds が確定済みか（未確定なら初回進捗で送る）
  durationKnown?: boolean
  // 進捗が更新されるたびに呼ばれる（UIバッジ更新用）
  onProgress?: (progressPercent: number, completed: boolean) => void
}

export function YouTubePlayer({ youtubeVideoId, dbVideoId, durationKnown, onProgress }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const viewIdRef = useRef<string | null>(null)
  const startingRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationSentRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  useEffect(() => {
    let destroyed = false

    // 現在の再生位置から進捗を算出
    const computeProgress = (): { watched: number; duration: number; progress: number } => {
      try {
        const p = playerRef.current
        if (!p || typeof p.getCurrentTime !== 'function') {
          return { watched: 0, duration: 0, progress: 0 }
        }
        const watched = p.getCurrentTime() || 0
        const duration = (typeof p.getDuration === 'function' ? p.getDuration() : 0) || 0
        const progress = duration > 0 ? Math.min(100, Math.round((watched / duration) * 100)) : 0
        return { watched, duration, progress }
      } catch {
        return { watched: 0, duration: 0, progress: 0 }
      }
    }

    // 視聴セッション開始（最初の PLAYING で1回だけ）
    const startSession = async () => {
      if (viewIdRef.current || startingRef.current) return
      startingRef.current = true
      try {
        const res = await fetch('/api/learning/views', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: dbVideoId }),
        })
        if (res.ok) {
          const data = await res.json()
          viewIdRef.current = data.view_id ?? null
        }
      } catch {
        // セッション作成失敗時は記録なしで再生継続（UXを阻害しない）
      } finally {
        startingRef.current = false
      }
    }

    // 進捗送信
    const sendProgress = (opts?: { ended?: boolean; keepalive?: boolean }) => {
      const viewId = viewIdRef.current
      if (!viewId) return
      const { watched, duration, progress } = computeProgress()
      const completed = !!opts?.ended || progress >= 90

      const body: Record<string, unknown> = {
        watched_seconds: Math.round(watched),
        progress_percent: progress,
        completed,
      }
      // duration 未確定なら初回のみ同梱
      if (!durationKnown && !durationSentRef.current && duration > 0) {
        body.duration_seconds = Math.round(duration)
        durationSentRef.current = true
      }

      try {
        fetch(`/api/learning/views/${viewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: opts?.keepalive === true,
        }).catch(() => {})
      } catch {
        // 送信失敗は無視
      }
      onProgressRef.current?.(progress, completed)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    const startInterval = () => {
      stopInterval()
      intervalRef.current = setInterval(() => sendProgress(), PROGRESS_INTERVAL_MS)
    }

    const handleStateChange = (event: any) => {
      const YT = window.YT
      const state = event?.data
      if (!YT) return
      if (state === YT.PlayerState.PLAYING) {
        // セッション確保後に間引き送信を開始
        startSession().then(() => {
          if (destroyed) return
          startInterval()
        })
      } else if (state === YT.PlayerState.PAUSED) {
        sendProgress()
        stopInterval()
      } else if (state === YT.PlayerState.ENDED) {
        sendProgress({ ended: true })
        stopInterval()
      }
    }

    // 離脱時の最終送信（keepalive）
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') sendProgress({ keepalive: true })
    }
    const handleBeforeUnload = () => {
      sendProgress({ keepalive: true })
    }

    loadYouTubeApi().then((YT) => {
      if (destroyed || !hostRef.current || !YT) return
      // YT.Player は渡した要素を iframe で「置き換える」。React 管理下の要素を直接渡すと
      // アンマウント時に React が置き換え済みノードを削除しようとして NotFoundError になる。
      // そこで React 管理の wrapper(hostRef) の中に手動で生成したノードを差し込み、
      // それを YT に置き換えさせる（wrapper は React がそのまま管理できる）。
      const target = document.createElement('div')
      hostRef.current.appendChild(target)
      playerRef.current = new YT.Player(target, {
        videoId: youtubeVideoId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: handleStateChange,
        },
      })
      document.addEventListener('visibilitychange', handleVisibility)
      window.addEventListener('beforeunload', handleBeforeUnload)
    })

    // クリーンアップ
    return () => {
      destroyed = true
      stopInterval()
      // 最終進捗を keepalive で送る
      sendProgress({ keepalive: true })
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy()
        }
      } catch {
        // destroy 失敗は無視
      }
      playerRef.current = null
      viewIdRef.current = null
      durationSentRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeVideoId, dbVideoId, durationKnown])

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-xl bg-black [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:h-full [&>iframe]:w-full"
      style={{ aspectRatio: '16 / 9' }}
    />
  )
}

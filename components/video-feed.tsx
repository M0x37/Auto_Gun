"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { STREAM_URL } from "@/lib/tracking-types"

interface VideoFeedProps {
  onImageReady?: (img: HTMLImageElement, width: number, height: number) => void
  onStreamStatus?: (connected: boolean) => void
  onFpsUpdate?: (fps: number) => void
}

export function VideoFeed({ onImageReady, onStreamStatus, onFpsUpdate }: VideoFeedProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [connected, setConnected] = useState(false)
  const [noSignal, setNoSignal] = useState(false)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(Date.now())
  const animFrameRef = useRef<number>(0)

  const handleLoad = useCallback(() => {
    setConnected(true)
    setNoSignal(false)
    onStreamStatus?.(true)
  }, [onStreamStatus])

  const handleError = useCallback(() => {
    setConnected(false)
    setNoSignal(true)
    onStreamStatus?.(false)
  }, [onStreamStatus])

  // FPS counting + frame forwarding loop
  useEffect(() => {
    let running = true

    const tick = () => {
      if (!running) return

      frameCountRef.current++
      const now = Date.now()
      const elapsed = now - lastFpsTimeRef.current

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed)
        onFpsUpdate?.(fps)
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }

      const img = imgRef.current
      const canvas = canvasRef.current
      if (img && canvas && connected && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        onImageReady?.(img, img.naturalWidth, img.naturalHeight)
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [connected, onImageReady, onFpsUpdate])

  // Retry connection on error
  useEffect(() => {
    if (!noSignal) return
    const timer = setInterval(() => {
      const img = imgRef.current
      if (img) {
        img.src = ""
        img.src = STREAM_URL
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [noSignal])

  return (
    <div className="relative w-full bg-[#0a0a0a] rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
      {/* MJPEG stream image (hidden, used as source) */}
      <img
        ref={imgRef}
        src={STREAM_URL}
        alt="Live camera feed"
        crossOrigin="anonymous"
        onLoad={handleLoad}
        onError={handleError}
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* Canvas overlay for tracking drawings */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* No Signal overlay */}
      {noSignal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/90 z-10">
          <div className="w-16 h-16 mb-4 border-2 border-cyan rounded-full flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-cyan"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>
          <p className="text-cyan font-mono text-lg font-semibold tracking-wider">NO SIGNAL</p>
          <p className="text-muted-foreground font-mono text-xs mt-2">Reconnecting...</p>
        </div>
      )}
    </div>
  )
}

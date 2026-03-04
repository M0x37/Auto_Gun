"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { STREAM_URL } from "@/lib/tracking-types"
import type { TrackingData, TrackingSettings } from "@/lib/tracking-types"
import { DEFAULT_TRACKING_DATA, DEFAULT_SETTINGS } from "@/lib/tracking-types"
import { ControlsSidebar } from "@/components/controls-sidebar"
import { Crosshair } from "lucide-react"

// Expose global tracking data for ESP32
declare global {
  interface Window {
    trackingData: TrackingData
  }
}

interface FaceResult {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

interface PoseResult {
  x: number
  y: number
  width: number
  height: number
}

export function Tracker() {
  const [settings, setSettings] = useState<TrackingSettings>(DEFAULT_SETTINGS)
  const [trackingData, setTrackingData] = useState<TrackingData>(DEFAULT_TRACKING_DATA)
  const [streamConnected, setStreamConnected] = useState(false)
  const [noSignal, setNoSignal] = useState(false)
  const [fps, setFps] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceDetectorRef = useRef<any>(null)
  const poseDetectorRef = useRef<any>(null)
  const processingRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(Date.now())
  const lastFaceRef = useRef<FaceResult | null>(null)
  const lastPoseRef = useRef<PoseResult | null>(null)
  const scriptLoadedRef = useRef(false)
  const settingsRef = useRef(settings)

  // Keep ref in sync
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  // Load MediaPipe
  useEffect(() => {
    if (scriptLoadedRef.current) return
    scriptLoadedRef.current = true

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const s = document.createElement("script")
        s.src = src
        s.crossOrigin = "anonymous"
        s.onload = () => resolve()
        s.onerror = reject
        document.head.appendChild(s)
      })

    async function init() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js")
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js")
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js")

        const win = window as any
        if (win.FaceDetection) {
          const fd = new win.FaceDetection({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
          })
          fd.setOptions({ model: "full", minDetectionConfidence: 0.4 })
          fd.onResults((results: any) => {
            if (results.detections?.length > 0) {
              const bb = results.detections[0].boundingBox
              lastFaceRef.current = {
                x: bb.xCenter - bb.width / 2,
                y: bb.yCenter - bb.height / 2,
                width: bb.width,
                height: bb.height,
                centerX: bb.xCenter,
                centerY: bb.yCenter,
              }
            } else {
              lastFaceRef.current = null
            }
          })
          faceDetectorRef.current = fd
        }

        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js")

        if (win.Pose) {
          const pose = new win.Pose({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
          })
          pose.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })
          pose.onResults((results: any) => {
            if (results.poseLandmarks?.length > 0) {
              let minX = 1, minY = 1, maxX = 0, maxY = 0
              for (const lm of results.poseLandmarks) {
                if (lm.x < minX) minX = lm.x
                if (lm.y < minY) minY = lm.y
                if (lm.x > maxX) maxX = lm.x
                if (lm.y > maxY) maxY = lm.y
              }
              const pad = 0.05
              lastPoseRef.current = {
                x: Math.max(0, minX - pad),
                y: Math.max(0, minY - pad),
                width: Math.min(1, maxX - minX + pad * 2),
                height: Math.min(1, maxY - minY + pad * 2),
              }
            } else {
              lastPoseRef.current = null
            }
          })
          poseDetectorRef.current = pose
        }
      } catch (err) {
        console.error("[v0] MediaPipe init error:", err)
      }
    }

    init()
  }, [])

  // Main render/tracking loop
  useEffect(() => {
    let running = true

    const tick = async () => {
      if (!running) return

      // FPS
      frameCountRef.current++
      const now = Date.now()
      const elapsed = now - lastFpsTimeRef.current
      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed)
        setFps(currentFps)
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }

      const img = imgRef.current
      const canvas = canvasRef.current
      if (img && canvas && img.naturalWidth > 0) {
        const w = img.naturalWidth
        const h = img.naturalHeight
        canvas.width = w
        canvas.height = h

        // Send to MediaPipe
        if (!processingRef.current) {
          processingRef.current = true
          try {
            if (settingsRef.current.faceTrackingEnabled && faceDetectorRef.current) {
              await faceDetectorRef.current.send({ image: img })
            } else {
              lastFaceRef.current = null
            }
            if (settingsRef.current.bodyTrackingEnabled && poseDetectorRef.current) {
              await poseDetectorRef.current.send({ image: img })
            } else {
              lastPoseRef.current = null
            }
          } catch {
            // ignore
          }
          processingRef.current = false
        }

        // Draw overlays
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.clearRect(0, 0, w, h)

          const face = lastFaceRef.current
          const pose = lastPoseRef.current

          // Body box (green, dashed)
          if (settingsRef.current.bodyTrackingEnabled && pose) {
            ctx.strokeStyle = "#22c55e"
            ctx.lineWidth = 2
            ctx.setLineDash([8, 4])
            ctx.strokeRect(pose.x * w, pose.y * h, pose.width * w, pose.height * h)
            ctx.setLineDash([])
            ctx.fillStyle = "#22c55e"
            ctx.font = "bold 12px monospace"
            ctx.fillText("BODY", pose.x * w + 4, pose.y * h - 6)
          }

          // Face box (cyan, bracket corners) + crosshair
          if (settingsRef.current.faceTrackingEnabled && face) {
            const fx = face.x * w
            const fy = face.y * h
            const fw = face.width * w
            const fh = face.height * h
            const cl = Math.min(fw, fh) * 0.25

            ctx.strokeStyle = "#00d4ff"
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(fx, fy + cl); ctx.lineTo(fx, fy); ctx.lineTo(fx + cl, fy)
            ctx.moveTo(fx + fw - cl, fy); ctx.lineTo(fx + fw, fy); ctx.lineTo(fx + fw, fy + cl)
            ctx.moveTo(fx + fw, fy + fh - cl); ctx.lineTo(fx + fw, fy + fh); ctx.lineTo(fx + fw - cl, fy + fh)
            ctx.moveTo(fx + cl, fy + fh); ctx.lineTo(fx, fy + fh); ctx.lineTo(fx, fy + fh - cl)
            ctx.stroke()

            // Crosshair
            const cx = face.centerX * w
            const cy = face.centerY * h
            ctx.strokeStyle = "#00d4ff"
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy)
            ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(cx, cy, 4, 0, Math.PI * 2)
            ctx.stroke()

            ctx.fillStyle = "#00d4ff"
            ctx.font = "bold 12px monospace"
            ctx.fillText("FACE", fx + 4, fy - 6)
          }

          // FPS top-left
          ctx.fillStyle = "#00d4ff"
          ctx.font = "bold 14px monospace"
          ctx.fillText(`FPS: ${fps}`, 12, 24)

          // Update tracking data
          const data: TrackingData = {
            faceDetected: !!face,
            faceX: face ? parseFloat(face.centerX.toFixed(3)) : 0,
            faceY: face ? parseFloat(face.centerY.toFixed(3)) : 0,
            personDetected: !!pose,
            fps,
            timestamp: Date.now(),
          }
          window.trackingData = data
          setTrackingData(data)
        }
      }

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [fps])

  // Stream reconnection
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

  const handleStreamLoad = useCallback(() => {
    setStreamConnected(true)
    setNoSignal(false)
  }, [])

  const handleStreamError = useCallback(() => {
    setStreamConnected(false)
    setNoSignal(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-cyan/10">
            <Crosshair className="w-5 h-5 text-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-mono font-bold tracking-wider text-foreground uppercase">
              Auto Gun Tracking System
            </h1>
            <p className="text-xs font-mono text-muted-foreground">
              MediaPipe Face + Pose Detection
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6">
        {/* Video Feed Area */}
        <div className="flex-1 min-w-0">
          <div
            className="relative w-full bg-[#0a0a0a] rounded-lg overflow-hidden border border-border"
            style={{ aspectRatio: "16/9" }}
          >
            {/* MJPEG Stream */}
            <img
              ref={imgRef}
              src={STREAM_URL}
              alt="Live camera feed"
              crossOrigin="anonymous"
              onLoad={handleStreamLoad}
              onError={handleStreamError}
              className="absolute inset-0 w-full h-full object-contain"
            />

            {/* Tracking overlay canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
            />

            {/* No Signal overlay */}
            {noSignal && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/95 z-20">
                <div className="w-20 h-20 mb-4 border-2 border-cyan/50 rounded-full flex items-center justify-center animate-pulse">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
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
                <p className="text-cyan font-mono text-xl font-bold tracking-[0.3em]">
                  NO SIGNAL
                </p>
                <p className="text-muted-foreground font-mono text-xs mt-2">
                  Attempting reconnection every 5s...
                </p>
                <p className="text-muted-foreground/60 font-mono text-[10px] mt-4">
                  Stream: {STREAM_URL}
                </p>
              </div>
            )}

            {/* Scan lines effect */}
            <div
              className="absolute inset-0 pointer-events-none z-5 opacity-[0.03]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.1) 2px, transparent 4px)",
              }}
            />
          </div>

          {/* Bottom status bar */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                Source: MJPEG
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {streamConnected ? "Stream Active" : "Stream Offline"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {mounted && trackingData.timestamp > 0
                ? new Date(trackingData.timestamp).toLocaleTimeString()
                : "--:--:--"}
            </span>
          </div>
        </div>

        {/* Sidebar */}
        <ControlsSidebar
          settings={settings}
          onSettingsChange={setSettings}
          trackingData={trackingData}
          streamConnected={streamConnected}
        />
      </main>
    </div>
  )
}

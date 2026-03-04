"use client"

import { useRef, useCallback, useEffect } from "react"
import type { TrackingData, TrackingSettings } from "@/lib/tracking-types"
import { DEFAULT_TRACKING_DATA } from "@/lib/tracking-types"

// Global tracking data exposed for ESP32 phase 2
declare global {
  interface Window {
    trackingData: TrackingData
  }
}

interface TrackingCanvasProps {
  settings: TrackingSettings
  onTrackingUpdate: (data: TrackingData) => void
  fps: number
}

interface FaceDetectionResult {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
}

interface PoseDetectionResult {
  x: number
  y: number
  width: number
  height: number
}

export function TrackingCanvas({ settings, onTrackingUpdate, fps }: TrackingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceDetectorRef = useRef<any>(null)
  const poseDetectorRef = useRef<any>(null)
  const processingRef = useRef(false)
  const animFrameRef = useRef<number>(0)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const lastFaceRef = useRef<FaceDetectionResult | null>(null)
  const lastPoseRef = useRef<PoseDetectionResult | null>(null)
  const scriptLoadedRef = useRef(false)

  // Load MediaPipe scripts
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

    async function initMediaPipe() {
      try {
        // Load face detection
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js")
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js")
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js")

        const win = window as any
        if (win.FaceDetection) {
          const fd = new win.FaceDetection({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
          })
          fd.setOptions({
            model: "short",
            minDetectionConfidence: 0.5,
          })
          fd.onResults((results: any) => {
            if (results.detections && results.detections.length > 0) {
              const det = results.detections[0]
              const bb = det.boundingBox
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

        // Load pose detection
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
            if (results.poseLandmarks && results.poseLandmarks.length > 0) {
              const landmarks = results.poseLandmarks
              let minX = 1, minY = 1, maxX = 0, maxY = 0
              for (const lm of landmarks) {
                if (lm.x < minX) minX = lm.x
                if (lm.y < minY) minY = lm.y
                if (lm.x > maxX) maxX = lm.x
                if (lm.y > maxY) maxY = lm.y
              }
              const padding = 0.05
              lastPoseRef.current = {
                x: Math.max(0, minX - padding),
                y: Math.max(0, minY - padding),
                width: Math.min(1, maxX - minX + padding * 2),
                height: Math.min(1, maxY - minY + padding * 2),
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

    initMediaPipe()
  }, [])

  // Process frame through MediaPipe
  const processFrame = useCallback(
    async (img: HTMLImageElement) => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        if (settings.faceTrackingEnabled && faceDetectorRef.current) {
          await faceDetectorRef.current.send({ image: img })
        } else {
          lastFaceRef.current = null
        }

        if (settings.bodyTrackingEnabled && poseDetectorRef.current) {
          await poseDetectorRef.current.send({ image: img })
        } else {
          lastPoseRef.current = null
        }
      } catch {
        // Ignore processing errors
      }

      processingRef.current = false
    },
    [settings.faceTrackingEnabled, settings.bodyTrackingEnabled]
  )

  // Expose method for parent to send images
  const handleImageReady = useCallback(
    (img: HTMLImageElement, width: number, height: number) => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = width
      canvas.height = height

      processFrame(img)

      // Draw overlays
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, width, height)

      const face = lastFaceRef.current
      const pose = lastPoseRef.current

      // Draw body bounding box (green)
      if (settings.bodyTrackingEnabled && pose) {
        ctx.strokeStyle = "#22c55e"
        ctx.lineWidth = 2
        ctx.setLineDash([8, 4])
        ctx.strokeRect(
          pose.x * width,
          pose.y * height,
          pose.width * width,
          pose.height * height
        )
        ctx.setLineDash([])

        // Label
        ctx.fillStyle = "#22c55e"
        ctx.font = "bold 12px monospace"
        ctx.fillText("BODY", pose.x * width + 4, pose.y * height - 6)
      }

      // Draw face bounding box (cyan)
      if (settings.faceTrackingEnabled && face) {
        ctx.strokeStyle = "#00d4ff"
        ctx.lineWidth = 2
        ctx.setLineDash([])

        const fx = face.x * width
        const fy = face.y * height
        const fw = face.width * width
        const fh = face.height * height

        // Corner brackets style
        const cornerLen = Math.min(fw, fh) * 0.25
        ctx.beginPath()
        // Top-left
        ctx.moveTo(fx, fy + cornerLen)
        ctx.lineTo(fx, fy)
        ctx.lineTo(fx + cornerLen, fy)
        // Top-right
        ctx.moveTo(fx + fw - cornerLen, fy)
        ctx.lineTo(fx + fw, fy)
        ctx.lineTo(fx + fw, fy + cornerLen)
        // Bottom-right
        ctx.moveTo(fx + fw, fy + fh - cornerLen)
        ctx.lineTo(fx + fw, fy + fh)
        ctx.lineTo(fx + fw - cornerLen, fy + fh)
        // Bottom-left
        ctx.moveTo(fx + cornerLen, fy + fh)
        ctx.lineTo(fx, fy + fh)
        ctx.lineTo(fx, fy + fh - cornerLen)
        ctx.stroke()

        // Crosshair at face center
        const cx = face.centerX * width
        const cy = face.centerY * height
        const crossSize = 15

        ctx.strokeStyle = "#00d4ff"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(cx - crossSize, cy)
        ctx.lineTo(cx + crossSize, cy)
        ctx.moveTo(cx, cy - crossSize)
        ctx.lineTo(cx, cy + crossSize)
        ctx.stroke()

        // Small circle at center
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.stroke()

        // Label
        ctx.fillStyle = "#00d4ff"
        ctx.font = "bold 12px monospace"
        ctx.fillText("FACE", fx + 4, fy - 6)
      }

      // FPS overlay (top-left)
      ctx.fillStyle = "#00d4ff"
      ctx.font = "bold 14px monospace"
      ctx.fillText(`FPS: ${fps}`, 12, 24)

      // Update global tracking data
      const trackingData: TrackingData = {
        faceDetected: !!face,
        faceX: face ? parseFloat(face.centerX.toFixed(3)) : 0,
        faceY: face ? parseFloat(face.centerY.toFixed(3)) : 0,
        personDetected: !!pose,
        fps,
        timestamp: Date.now(),
      }

      if (typeof window !== "undefined") {
        window.trackingData = trackingData
      }

      onTrackingUpdate(trackingData)
    },
    [settings.faceTrackingEnabled, settings.bodyTrackingEnabled, fps, processFrame, onTrackingUpdate]
  )

  // Expose handleImageReady via ref-like pattern
  useEffect(() => {
    ;(window as any).__trackingCanvasHandler = handleImageReady
    return () => {
      delete (window as any).__trackingCanvasHandler
    }
  }, [handleImageReady])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
    />
  )
}

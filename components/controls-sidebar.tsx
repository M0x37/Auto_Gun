"use client"

import { Switch } from "@/components/ui/switch"
import { Crosshair, User, Wifi, WifiOff, Activity } from "lucide-react"
import type { TrackingData, TrackingSettings } from "@/lib/tracking-types"

interface ControlsSidebarProps {
  settings: TrackingSettings
  onSettingsChange: (settings: TrackingSettings) => void
  trackingData: TrackingData
  streamConnected: boolean
}

export function ControlsSidebar({
  settings,
  onSettingsChange,
  trackingData,
  streamConnected,
}: ControlsSidebarProps) {
  return (
    <aside className="flex flex-col gap-4 w-full lg:w-80 shrink-0 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
      {/* System Status */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          System Status
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {streamConnected ? (
                <Wifi className="w-4 h-4 text-green" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
              <span className="text-sm font-mono text-foreground">Stream</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  streamConnected ? "bg-green animate-pulse" : "bg-destructive"
                }`}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {streamConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan" />
              <span className="text-sm font-mono text-foreground">FPS</span>
            </div>
            <span className="text-sm font-mono font-bold text-cyan tabular-nums">
              {trackingData.fps}
            </span>
          </div>
        </div>
      </div>

      {/* Tracking Controls */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Tracking Controls
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-cyan" />
              <span className="text-sm font-mono text-foreground">Face Tracking</span>
            </div>
            <Switch
              checked={settings.faceTrackingEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, faceTrackingEnabled: checked })
              }
              aria-label="Toggle face tracking"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-green" />
              <span className="text-sm font-mono text-foreground">Body Tracking</span>
            </div>
            <Switch
              checked={settings.bodyTrackingEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, bodyTrackingEnabled: checked })
              }
              aria-label="Toggle body tracking"
            />
          </div>
        </div>
      </div>

      {/* Face Detection Data */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Face Detection
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">Status</span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                trackingData.faceDetected
                  ? "bg-cyan/15 text-cyan"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {trackingData.faceDetected ? "Face Detected" : "No Face"}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-muted-foreground">X Position</span>
              <span className="text-lg font-mono font-bold text-cyan tabular-nums">
                {trackingData.faceDetected ? trackingData.faceX.toFixed(3) : "---"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono text-muted-foreground">Y Position</span>
              <span className="text-lg font-mono font-bold text-cyan tabular-nums">
                {trackingData.faceDetected ? trackingData.faceY.toFixed(3) : "---"}
              </span>
            </div>
          </div>

          {/* Visual position indicator */}
          <div className="relative bg-secondary rounded border border-border aspect-square w-full max-w-[140px] mx-auto">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-px h-full bg-border" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-px w-full bg-border" />
            </div>
            {trackingData.faceDetected && (
              <div
                className="absolute w-3 h-3 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,212,255,0.6)] transition-all duration-150"
                style={{
                  left: `${trackingData.faceX * 100}%`,
                  top: `${trackingData.faceY * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Body Detection */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Body Detection
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-muted-foreground">Status</span>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              trackingData.personDetected
                ? "bg-green/15 text-green"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {trackingData.personDetected ? "Person Detected" : "No Person"}
          </span>
        </div>
      </div>

    </aside>
  )
}

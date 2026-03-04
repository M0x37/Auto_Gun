export interface TrackingData {
  faceDetected: boolean
  faceX: number // 0.0 left -> 1.0 right
  faceY: number // 0.0 top -> 1.0 bottom
  personDetected: boolean
  fps: number
  timestamp: number
}

export interface TrackingSettings {
  faceTrackingEnabled: boolean
  bodyTrackingEnabled: boolean
}

export const DEFAULT_TRACKING_DATA: TrackingData = {
  faceDetected: false,
  faceX: 0,
  faceY: 0,
  personDetected: false,
  fps: 0,
  timestamp: 0,
}

export const DEFAULT_SETTINGS: TrackingSettings = {
  faceTrackingEnabled: true,
  bodyTrackingEnabled: true,
}

export const STREAM_URL = "http://192.168.178.128:4747/video"

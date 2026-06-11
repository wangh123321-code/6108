import { Vector3 } from '@babylonjs/core'

export type SpinType =
  | 'topspin'
  | 'backspin'
  | 'sidespin_left'
  | 'sidespin_right'
  | 'topside_left'
  | 'topside_right'
  | 'backside_left'
  | 'backside_right'

export interface ServeParams {
  speed: number
  spinType: SpinType
  spinRate: number
  serveAngleX: number
  serveAngleY: number
  tossHeight: number
}

export interface PhysicsState {
  position: Vector3
  velocity: Vector3
  angularVel: Vector3
  time: number
  hasBounced: boolean
  bounceCount: number
  rotation: Vector3
}

export interface BounceEvent {
  position: { x: number; y: number; z: number }
  incidentAngle: number
  reflectAngle: number
}

export interface SimFrame {
  time: number
  position: { x: number; y: number; z: number }
  velocity: { x: number; y: number; z: number }
  speed: number
  spinRate: number
  rotation: { x: number; y: number; z: number }
  bounceEvent?: BounceEvent
}

export interface SimControl {
  isPlaying: boolean
  isPaused: boolean
  playbackSpeed: number
  currentFrame: number
  totalFrames: number
  frames: SimFrame[]
  duration: number
}

export interface SpinTypeInfo {
  key: SpinType
  label: string
  color: string
  description: string
}

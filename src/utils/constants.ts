import type { SpinType, SpinTypeInfo } from '@/types'

export const BALL_RADIUS = 0.02
export const BALL_MASS = 0.0027
export const GRAVITY = 9.81
export const AIR_DENSITY = 1.225
export const DRAG_COEFFICIENT = 0.4
export const LIFT_COEFFICIENT = 0.3
export const RESTITUTION_COEFFICIENT = 0.82
export const FRICTION_COEFFICIENT = 0.25
export const TABLE_LENGTH = 2.74
export const TABLE_WIDTH = 1.525
export const TABLE_HEIGHT = 0.76
export const NET_HEIGHT = 0.1525
export const NET_OVERHANG = 0.1525
export const FRAME_RATE = 240
export const MAX_SIMULATION_TIME = 3.0

export const SPIN_TYPE_LIST: SpinTypeInfo[] = [
  { key: 'topspin', label: '上旋球', color: '#F97316', description: '向前旋转，球向下扎' },
  { key: 'backspin', label: '下旋球', color: '#06B6D4', description: '向后旋转，球向上飘' },
  { key: 'sidespin_left', label: '左侧旋', color: '#A855F7', description: '顺时针旋转，轨迹左弯' },
  { key: 'sidespin_right', label: '右侧旋', color: '#EC4899', description: '逆时针旋转，轨迹右弯' },
  { key: 'topside_left', label: '左侧上旋', color: '#FB923C', description: '上旋+左侧旋合成' },
  { key: 'topside_right', label: '右侧上旋', color: '#F472B6', description: '上旋+右侧旋合成' },
  { key: 'backside_left', label: '左侧下旋', color: '#22D3EE', description: '下旋+左侧旋合成' },
  { key: 'backside_right', label: '右侧下旋', color: '#34D399', description: '下旋+右侧旋合成' },
]

export const getSpinColor = (type: SpinType): string => {
  return SPIN_TYPE_LIST.find((s) => s.key === type)?.color || '#F59E0B'
}

export const getSpinLabel = (type: SpinType): string => {
  return SPIN_TYPE_LIST.find((s) => s.key === type)?.label || '未知旋转'
}

export const CAMERA_PRESETS = {
  default: {
    name: '默认视角',
    position: { x: -2.5, y: 2.2, z: 2.5 },
    target: { x: 0, y: 0.5, z: 0 },
  },
  serve: {
    name: '发球视角',
    position: { x: -3.5, y: 1.8, z: 0 },
    target: { x: 0, y: 0.8, z: 0 },
  },
  side: {
    name: '侧面视角',
    position: { x: 0, y: 2, z: 4 },
    target: { x: 0, y: 0.5, z: 0 },
  },
  top: {
    name: '俯视视角',
    position: { x: 0, y: 5, z: 0.01 },
    target: { x: 0, y: 0, z: 0 },
  },
}

export const DEFAULT_SERVE_PARAMS = {
  speed: 15,
  spinType: 'topspin' as SpinType,
  spinRate: 2500,
  serveAngleX: 0,
  serveAngleY: 10,
  tossHeight: 0.3,
}

import { Vector3, Color3, Color4 } from '@babylonjs/core'

export const vec3ToObj = (v: Vector3) => ({ x: v.x, y: v.y, z: v.z })

export const objToVec3 = (o: { x: number; y: number; z: number }) => new Vector3(o.x, o.y, o.z)

export const hexToColor3 = (hex: string): Color3 => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new Color3(r, g, b)
}

export const hexToColor4 = (hex: string, alpha: number = 1): Color4 => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new Color4(r, g, b, alpha)
}

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t
}

export const formatNumber = (num: number, digits: number = 2): string => {
  return num.toFixed(digits)
}

export const formatTime = (seconds: number): string => {
  return `${(seconds * 1000).toFixed(0)}ms`
}

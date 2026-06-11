import { Vector3 } from '@babylonjs/core'
import type { SpinType } from '@/types'
import {
  BALL_RADIUS,
  BALL_MASS,
  GRAVITY,
  AIR_DENSITY,
  DRAG_COEFFICIENT,
  LIFT_COEFFICIENT,
  RESTITUTION_COEFFICIENT,
  FRICTION_COEFFICIENT,
  TABLE_HEIGHT,
  TABLE_LENGTH,
  TABLE_WIDTH,
} from './constants'

const CROSS_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS
const MAGNUS_COEFF = 0.5 * AIR_DENSITY * LIFT_COEFFICIENT * CROSS_AREA * BALL_RADIUS
const DRAG_TERM = 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * CROSS_AREA

export const rpmToRadPerSec = (rpm: number): number => {
  return (rpm * 2 * Math.PI) / 60
}

export const radPerSecToRpm = (radPerSec: number): number => {
  return (radPerSec * 60) / (2 * Math.PI)
}

export const degToRad = (deg: number): number => {
  return (deg * Math.PI) / 180
}

export const radToDeg = (rad: number): number => {
  return (rad * 180) / Math.PI
}

export const spinTypeToAngularVel = (spinType: SpinType, rpm: number): Vector3 => {
  const omega = rpmToRadPerSec(rpm)
  switch (spinType) {
    case 'topspin':
      return new Vector3(omega, 0, 0)
    case 'backspin':
      return new Vector3(-omega, 0, 0)
    case 'sidespin_left':
      return new Vector3(0, 0, omega)
    case 'sidespin_right':
      return new Vector3(0, 0, -omega)
    case 'topside_left': {
      const w = omega * Math.SQRT1_2
      return new Vector3(w, 0, w)
    }
    case 'topside_right': {
      const w = omega * Math.SQRT1_2
      return new Vector3(w, 0, -w)
    }
    case 'backside_left': {
      const w = omega * Math.SQRT1_2
      return new Vector3(-w, 0, w)
    }
    case 'backside_right': {
      const w = omega * Math.SQRT1_2
      return new Vector3(-w, 0, -w)
    }
    default:
      return Vector3.Zero()
  }
}

export const createInitialVelocity = (
  speed: number,
  angleXDeg: number,
  angleYDeg: number,
): Vector3 => {
  const angleX = degToRad(angleXDeg)
  const angleY = degToRad(angleYDeg)

  const cosY = Math.cos(angleY)
  const vx = speed * cosY * Math.cos(angleX)
  const vy = speed * Math.sin(angleY)
  const vz = speed * cosY * Math.sin(angleX)

  return new Vector3(vx, vy, vz)
}

export const createInitialPosition = (tossHeight: number): Vector3 => {
  return new Vector3(-TABLE_LENGTH / 2 - 0.2, TABLE_HEIGHT + tossHeight, 0)
}

export const computeForces = (velocity: Vector3, angularVel: Vector3): Vector3 => {
  const gravity = new Vector3(0, -BALL_MASS * GRAVITY, 0)

  const speed = velocity.length()
  let drag = Vector3.Zero()
  if (speed > 0.001) {
    const dragMag = DRAG_TERM * speed * speed
    drag = velocity.scale(-dragMag / speed)
  }

  let magnus = Vector3.Zero()
  if (speed > 0.001 && angularVel.length() > 0.001) {
    magnus = Vector3.Cross(angularVel, velocity).scale(MAGNUS_COEFF)
  }

  return gravity.add(drag).add(magnus)
}

export interface Derivatives {
  dp: Vector3
  dv: Vector3
}

export const derivatives = (pos: Vector3, vel: Vector3, omega: Vector3): Derivatives => {
  const force = computeForces(vel, omega)
  const accel = force.scale(1 / BALL_MASS)
  return { dp: vel.clone(), dv: accel }
}

export const rk4Step = (
  pos: Vector3,
  vel: Vector3,
  omega: Vector3,
  dt: number,
): { newPos: Vector3; newVel: Vector3 } => {
  const k1 = derivatives(pos, vel, omega)
  const k2 = derivatives(
    pos.add(k1.dp.scale(dt / 2)),
    vel.add(k1.dv.scale(dt / 2)),
    omega,
  )
  const k3 = derivatives(
    pos.add(k2.dp.scale(dt / 2)),
    vel.add(k2.dv.scale(dt / 2)),
    omega,
  )
  const k4 = derivatives(
    pos.add(k3.dp.scale(dt)),
    vel.add(k3.dv.scale(dt)),
    omega,
  )

  const newPos = pos.add(
    k1.dp.add(k2.dp.scale(2)).add(k3.dp.scale(2)).add(k4.dp).scale(dt / 6),
  )
  const newVel = vel.add(
    k1.dv.add(k2.dv.scale(2)).add(k3.dv.scale(2)).add(k4.dv).scale(dt / 6),
  )

  return { newPos, newVel }
}

export const isOnTable = (pos: Vector3): boolean => {
  const halfL = TABLE_LENGTH / 2
  const halfW = TABLE_WIDTH / 2
  return (
    pos.x >= -halfL - 0.01 &&
    pos.x <= halfL + 0.01 &&
    pos.z >= -halfW - 0.01 &&
    pos.z <= halfW + 0.01 &&
    pos.y - BALL_RADIUS <= TABLE_HEIGHT + 0.001
  )
}

export interface BounceResult {
  position: Vector3
  velocity: Vector3
  angularVel: Vector3
  incidentAngle: number
  reflectAngle: number
}

export const handleBounce = (
  pos: Vector3,
  vel: Vector3,
  omega: Vector3,
): BounceResult => {
  const e = RESTITUTION_COEFFICIENT
  const mu = FRICTION_COEFFICIENT

  const incidentAngleRad = Math.atan2(-vel.y, Math.sqrt(vel.x * vel.x + vel.z * vel.z))
  const incidentAngle = radToDeg(incidentAngleRad)

  const v_y_normal = Math.abs(vel.y)

  const newVy = e * v_y_normal

  const vTangent = new Vector3(vel.x, 0, vel.z)
  const vTangentLen = vTangent.length()

  let newVx = vel.x
  let newVz = vel.z

  if (vTangentLen > 0.001) {
    const impulseNormal = (1 + e) * v_y_normal * BALL_MASS
    const maxFrictionImpulse = mu * impulseNormal
    const contactVel = vTangent.clone()

    const rCrossOmega = Vector3.Cross(new Vector3(0, BALL_RADIUS, 0), omega)
    const relTangentVel = contactVel.subtract(new Vector3(rCrossOmega.x, 0, rCrossOmega.z))
    const relVelLen = relTangentVel.length()

    if (relVelLen > 0.001) {
      const frictionDir = relTangentVel.scale(-1 / relVelLen)
      const frictionImpulseMag = Math.min(maxFrictionImpulse, BALL_MASS * relVelLen * 1.5)
      const deltaV = frictionDir.scale(frictionImpulseMag / BALL_MASS)
      newVx = vel.x + deltaV.x
      newVz = vel.z + deltaV.z

      const torqueAxis = new Vector3(0, BALL_RADIUS, 0).cross(frictionDir)
      const momentOfInertia = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS
      const deltaOmega = torqueAxis.scale(frictionImpulseMag / momentOfInertia)
      omega = omega.add(deltaOmega)
    }
  }

  const newPos = new Vector3(pos.x, TABLE_HEIGHT + BALL_RADIUS + 0.001, pos.z)
  const newVel = new Vector3(newVx, newVy, newVz)

  const reflectAngleRad = Math.atan2(newVy, Math.sqrt(newVx * newVx + newVz * newVz))
  const reflectAngle = radToDeg(reflectAngleRad)

  return {
    position: newPos,
    velocity: newVel,
    angularVel: omega,
    incidentAngle,
    reflectAngle,
  }
}

export const updateRotation = (rotation: Vector3, omega: Vector3, dt: number): Vector3 => {
  return new Vector3(
    rotation.x + omega.x * dt,
    rotation.y + omega.y * dt,
    rotation.z + omega.z * dt,
  )
}

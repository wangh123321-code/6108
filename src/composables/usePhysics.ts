import { Vector3 } from '@babylonjs/core'
import type { ServeParams, SimFrame, BounceEvent, PhysicsState } from '@/types'
import {
  spinTypeToAngularVel,
  createInitialVelocity,
  createInitialPosition,
  rk4Step,
  isOnTable,
  handleBounce,
  updateRotation,
  radPerSecToRpm,
} from '@/utils/physics'
import { FRAME_RATE, MAX_SIMULATION_TIME, BALL_RADIUS } from '@/utils/constants'
import { vec3ToObj } from '@/utils/helpers'

export function usePhysics() {
  const simulate = (params: ServeParams): { frames: SimFrame[]; duration: number } => {
    const frames: SimFrame[] = []
    const dt = 1 / FRAME_RATE
    const maxSteps = Math.floor(MAX_SIMULATION_TIME / dt)

    let position = createInitialPosition(params.tossHeight)
    let velocity = createInitialVelocity(params.speed, params.serveAngleX, params.serveAngleY)
    let angularVel = spinTypeToAngularVel(params.spinType, params.spinRate)
    let rotation = new Vector3(0, 0, 0)
    let time = 0
    let hasBounced = false
    let bounceCount = 0

    const addFrame = (bounceEvent?: BounceEvent) => {
      const speed = velocity.length()
      const spinRpm = radPerSecToRpm(angularVel.length())
      frames.push({
        time,
        position: vec3ToObj(position),
        velocity: vec3ToObj(velocity),
        speed,
        spinRate: spinRpm,
        rotation: vec3ToObj(rotation),
        bounceEvent,
      })
    }

    addFrame()

    for (let step = 1; step <= maxSteps; step++) {
      const prevPos = position.clone()
      const prevVel = velocity.clone()
      const prevBelow = prevPos.y - BALL_RADIUS

      const { newPos, newVel } = rk4Step(position, velocity, angularVel, dt)
      position = newPos
      velocity = newVel
      time += dt
      rotation = updateRotation(rotation, angularVel, dt)

      const nowBelow = position.y - BALL_RADIUS

      if (!hasBounced && prevVel.y < 0 && prevBelow >= 0.76 && nowBelow <= 0.76) {
        if (isOnTable(position)) {
          const bounceResult = handleBounce(position, velocity, angularVel)
          const bounceEvent: BounceEvent = {
            position: vec3ToObj(bounceResult.position),
            incidentAngle: bounceResult.incidentAngle,
            reflectAngle: bounceResult.reflectAngle,
          }
          position = bounceResult.position
          velocity = bounceResult.velocity
          angularVel = bounceResult.angularVel
          hasBounced = true
          bounceCount++
          addFrame(bounceEvent)
          continue
        }
      }

      if (hasBounced && prevVel.y < 0 && prevBelow >= 0.76 && nowBelow <= 0.76) {
        if (isOnTable(position) && bounceCount < 2) {
          const bounceResult = handleBounce(position, velocity, angularVel)
          const bounceEvent: BounceEvent = {
            position: vec3ToObj(bounceResult.position),
            incidentAngle: bounceResult.incidentAngle,
            reflectAngle: bounceResult.reflectAngle,
          }
          position = bounceResult.position
          velocity = bounceResult.velocity
          angularVel = bounceResult.angularVel
          bounceCount++
          addFrame(bounceEvent)
          continue
        }
      }

      if (position.y < 0 || Math.abs(position.x) > 5 || Math.abs(position.z) > 3) {
        addFrame()
        break
      }

      addFrame()
    }

    return { frames, duration: time }
  }

  const getStateAtTime = (frames: SimFrame[], targetTime: number): PhysicsState | null => {
    if (frames.length === 0) return null
    if (targetTime <= frames[0].time) {
      const f = frames[0]
      return {
        position: new Vector3(f.position.x, f.position.y, f.position.z),
        velocity: new Vector3(f.velocity.x, f.velocity.y, f.velocity.z),
        angularVel: Vector3.Zero(),
        time: f.time,
        hasBounced: false,
        bounceCount: 0,
        rotation: new Vector3(f.rotation.x, f.rotation.y, f.rotation.z),
      }
    }
    if (targetTime >= frames[frames.length - 1].time) {
      const f = frames[frames.length - 1]
      return {
        position: new Vector3(f.position.x, f.position.y, f.position.z),
        velocity: new Vector3(f.velocity.x, f.velocity.y, f.velocity.z),
        angularVel: Vector3.Zero(),
        time: f.time,
        hasBounced: true,
        bounceCount: 1,
        rotation: new Vector3(f.rotation.x, f.rotation.y, f.rotation.z),
      }
    }

    for (let i = 1; i < frames.length; i++) {
      if (frames[i].time >= targetTime) {
        const f0 = frames[i - 1]
        const f1 = frames[i]
        const t = (targetTime - f0.time) / (f1.time - f0.time || 1)
        const lerp = (a: number, b: number) => a + (b - a) * t
        return {
          position: new Vector3(
            lerp(f0.position.x, f1.position.x),
            lerp(f0.position.y, f1.position.y),
            lerp(f0.position.z, f1.position.z),
          ),
          velocity: new Vector3(
            lerp(f0.velocity.x, f1.velocity.x),
            lerp(f0.velocity.y, f1.velocity.y),
            lerp(f0.velocity.z, f1.velocity.z),
          ),
          angularVel: Vector3.Zero(),
          time: targetTime,
          hasBounced: !!f1.bounceEvent,
          bounceCount: 0,
          rotation: new Vector3(
            lerp(f0.rotation.x, f1.rotation.x),
            lerp(f0.rotation.y, f1.rotation.y),
            lerp(f0.rotation.z, f1.rotation.z),
          ),
        }
      }
    }
    return null
  }

  return { simulate, getStateAtTime }
}

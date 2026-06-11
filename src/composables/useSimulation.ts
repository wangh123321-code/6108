import { ref, computed, watch } from 'vue'
import type { ServeParams, SimFrame, CompareSlotData, SlotId, DiffLabel, BounceEvent } from '@/types'
import { usePhysics } from './usePhysics'
import { DEFAULT_SERVE_PARAMS } from '@/utils/constants'

const SLOT_COLORS: Record<SlotId, string> = {
  A: '#F97316',
  B: '#06B6D4',
  C: '#A855F7',
}

const createEmptySlot = (id: SlotId): CompareSlotData => ({
  id,
  params: null,
  frames: [],
  trajectoryPoints: [],
  bounceEvents: [],
  color: SLOT_COLORS[id],
  visible: false,
  saved: false,
})

export function useSimulation() {
  const { simulate } = usePhysics()

  const serveParams = ref<ServeParams>({ ...DEFAULT_SERVE_PARAMS })
  const frames = ref<SimFrame[]>([])
  const duration = ref(0)
  const currentFrameIdx = ref(0)
  const isPlaying = ref(false)
  const playbackSpeed = ref(1)
  const playbackTime = ref(0)
  let animationFrameId: number | null = null
  let lastTimestamp: number | null = null

  const compareSlots = ref<CompareSlotData[]>([
    createEmptySlot('A'),
    createEmptySlot('B'),
    createEmptySlot('C'),
  ])
  const activeSlotId = ref<SlotId | null>(null)

  const visibleCompareSlots = computed(() => {
    return compareSlots.value.filter((s) => s.saved && s.visible)
  })

  const getArcHeight = (points: { x: number; y: number; z: number }[]): { height: number; idx: number; point: { x: number; y: number; z: number } } => {
    if (points.length === 0) return { height: 0, idx: 0, point: { x: 0, y: 0, z: 0 } }
    let maxY = -Infinity
    let maxIdx = 0
    for (let i = 0; i < points.length; i++) {
      if (points[i].y > maxY) {
        maxY = points[i].y
        maxIdx = i
      }
    }
    return { height: maxY, idx: maxIdx, point: points[maxIdx] }
  }

  const getFirstBouncePoint = (slot: CompareSlotData): { x: number; y: number; z: number } | null => {
    if (slot.bounceEvents.length === 0) return null
    return slot.bounceEvents[0].event.position
  }

  const getNetHeight = (points: { x: number; y: number; z: number }[]): { height: number; idx: number; point: { x: number; y: number; z: number } } => {
    if (points.length === 0) return { height: 0, idx: 0, point: { x: 0, y: 0, z: 0 } }
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x)
      if (dist < closestDist) {
        closestDist = dist
        closestIdx = i
      }
    }
    return { height: points[closestIdx].y, idx: closestIdx, point: points[closestIdx] }
  }

  const computeDiffLabels = computed<DiffLabel[]>(() => {
    const visible = visibleCompareSlots.value
    if (visible.length < 2) return []

    const labels: DiffLabel[] = []
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const slotA = visible[i]
        const slotB = visible[j]

        const arcA = getArcHeight(slotA.trajectoryPoints)
        const arcB = getArcHeight(slotB.trajectoryPoints)
        if (arcA.idx !== 0 || arcB.idx !== 0) {
          const arcDiff = Math.abs(arcA.height - arcB.height)
          const midPoint = {
            x: (arcA.point.x + arcB.point.x) / 2,
            y: Math.max(arcA.height, arcB.height) + 0.15,
            z: (arcA.point.z + arcB.point.z) / 2,
          }
          labels.push({
            type: 'arc_height',
            position: midPoint,
            text: `最高弧线差: ${(arcDiff * 100).toFixed(1)}cm (${slotA.id}${arcA.height > arcB.height ? '↑' : '↓'}${slotB.id})`,
            slotA: slotA.id,
            slotB: slotB.id,
            valueA: arcA.height,
            valueB: arcB.height,
            diff: arcDiff,
          })
        }

        const bounceA = getFirstBouncePoint(slotA)
        const bounceB = getFirstBouncePoint(slotB)
        if (bounceA && bounceB) {
          const offset = Math.sqrt(
            (bounceA.x - bounceB.x) ** 2 + (bounceA.z - bounceB.z) ** 2,
          )
          const midPoint = {
            x: (bounceA.x + bounceB.x) / 2,
            y: Math.max(bounceA.y, bounceB.y) + 0.2,
            z: (bounceA.z + bounceB.z) / 2,
          }
          labels.push({
            type: 'bounce_offset',
            position: midPoint,
            text: `弹跳点偏移: ${(offset * 100).toFixed(1)}cm`,
            slotA: slotA.id,
            slotB: slotB.id,
            valueA: 0,
            valueB: 0,
            diff: offset,
          })
        }

        const netA = getNetHeight(slotA.trajectoryPoints)
        const netB = getNetHeight(slotB.trajectoryPoints)
        if (netA.idx !== 0 || netB.idx !== 0) {
          const netDiff = Math.abs(netA.height - netB.height)
          const midPoint = {
            x: 0,
            y: Math.max(netA.height, netB.height) + 0.15,
            z: (netA.point.z + netB.point.z) / 2,
          }
          labels.push({
            type: 'net_height',
            position: midPoint,
            text: `过网高度差: ${(netDiff * 100).toFixed(1)}cm`,
            slotA: slotA.id,
            slotB: slotB.id,
            valueA: netA.height,
            valueB: netB.height,
            diff: netDiff,
          })
        }
      }
    }
    return labels
  })

  const totalFrames = computed(() => frames.value.length)

  const currentFrame = computed<SimFrame | null>(() => {
    if (frames.value.length === 0) return null
    const idx = Math.min(currentFrameIdx.value, frames.value.length - 1)
    return frames.value[idx]
  })

  const bounceEvents = computed(() => {
    return frames.value
      .filter((f) => f.bounceEvent)
      .map((f) => ({ frame: f, event: f.bounceEvent! }))
  })

  const trajectoryPoints = computed(() => {
    return frames.value.map((f) => f.position)
  })

  const runSimulation = () => {
    stopPlayback()
    const result = simulate(serveParams.value)
    frames.value = result.frames
    duration.value = result.duration
    currentFrameIdx.value = 0
    playbackTime.value = 0
  }

  const resetSimulation = () => {
    stopPlayback()
    currentFrameIdx.value = 0
    playbackTime.value = 0
  }

  const play = () => {
    if (frames.value.length === 0) return
    if (currentFrameIdx.value >= frames.value.length - 1) {
      currentFrameIdx.value = 0
      playbackTime.value = 0
    }
    isPlaying.value = true
    lastTimestamp = null
    startLoop()
  }

  const pause = () => {
    isPlaying.value = false
    stopPlayback()
  }

  const stopPlayback = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    lastTimestamp = null
  }

  const startLoop = () => {
    const loop = (timestamp: number) => {
      if (!isPlaying.value) return
      if (lastTimestamp === null) lastTimestamp = timestamp
      const deltaMs = timestamp - lastTimestamp
      lastTimestamp = timestamp

      const deltaSimTime = (deltaMs / 1000) * playbackSpeed.value
      playbackTime.value += deltaSimTime

      if (frames.value.length > 0) {
        const frameTime = frames.value[frames.value.length - 1].time
        if (playbackTime.value >= frameTime) {
          playbackTime.value = frameTime
          currentFrameIdx.value = frames.value.length - 1
          isPlaying.value = false
          stopPlayback()
          return
        }

        for (let i = currentFrameIdx.value; i < frames.value.length - 1; i++) {
          if (frames.value[i + 1].time > playbackTime.value) {
            currentFrameIdx.value = i
            break
          }
        }
      }

      animationFrameId = requestAnimationFrame(loop)
    }
    animationFrameId = requestAnimationFrame(loop)
  }

  const setPlaybackSpeed = (speed: number) => {
    playbackSpeed.value = Math.max(0.1, Math.min(1, speed))
  }

  const seekToTime = (time: number) => {
    stopPlayback()
    isPlaying.value = false
    playbackTime.value = Math.max(0, Math.min(duration.value, time))
    if (frames.value.length > 0) {
      for (let i = 0; i < frames.value.length; i++) {
        if (frames.value[i].time >= playbackTime.value) {
          currentFrameIdx.value = Math.max(0, i - 1)
          break
        }
      }
    }
  }

  const seekToFrame = (idx: number) => {
    stopPlayback()
    isPlaying.value = false
    const clampedIdx = Math.max(0, Math.min(frames.value.length - 1, idx))
    currentFrameIdx.value = clampedIdx
    playbackTime.value = frames.value[clampedIdx]?.time || 0
  }

  const stepForward = () => {
    stopPlayback()
    isPlaying.value = false
    if (currentFrameIdx.value < frames.value.length - 1) {
      currentFrameIdx.value++
      playbackTime.value = frames.value[currentFrameIdx.value].time
    }
  }

  const stepBackward = () => {
    stopPlayback()
    isPlaying.value = false
    if (currentFrameIdx.value > 0) {
      currentFrameIdx.value--
      playbackTime.value = frames.value[currentFrameIdx.value].time
    }
  }

  const saveCompareSlot = (slotId: SlotId) => {
    const slot = compareSlots.value.find((s) => s.id === slotId)
    if (!slot) return
    const result = simulate(serveParams.value)
    slot.params = { ...serveParams.value }
    slot.frames = result.frames
    slot.trajectoryPoints = result.frames.map((f) => f.position)
    slot.bounceEvents = result.frames
      .filter((f) => f.bounceEvent)
      .map((f) => ({ frame: f, event: f.bounceEvent! }))
    slot.saved = true
    slot.visible = true
  }

  const toggleSlotVisible = (slotId: SlotId) => {
    const slot = compareSlots.value.find((s) => s.id === slotId)
    if (slot && slot.saved) {
      slot.visible = !slot.visible
    }
  }

  const updateSlotColor = (slotId: SlotId, color: string) => {
    const slot = compareSlots.value.find((s) => s.id === slotId)
    if (slot) {
      slot.color = color
    }
  }

  const applySlotParams = (slotId: SlotId) => {
    const slot = compareSlots.value.find((s) => s.id === slotId)
    if (!slot || !slot.params) return
    activeSlotId.value = slotId
    serveParams.value = { ...slot.params }
  }

  const clearSlot = (slotId: SlotId) => {
    const slot = compareSlots.value.find((s) => s.id === slotId)
    if (!slot) return
    slot.params = null
    slot.frames = []
    slot.trajectoryPoints = []
    slot.bounceEvents = []
    slot.saved = false
    slot.visible = false
    if (activeSlotId.value === slotId) {
      activeSlotId.value = null
    }
  }

  watch(
    () => serveParams.value,
    () => {
      runSimulation()
    },
    { deep: true },
  )

  return {
    serveParams,
    frames,
    duration,
    currentFrameIdx,
    totalFrames,
    currentFrame,
    bounceEvents,
    trajectoryPoints,
    isPlaying,
    playbackSpeed,
    playbackTime,
    runSimulation,
    resetSimulation,
    play,
    pause,
    setPlaybackSpeed,
    seekToTime,
    seekToFrame,
    stepForward,
    stepBackward,
    compareSlots,
    activeSlotId,
    visibleCompareSlots,
    computeDiffLabels,
    saveCompareSlot,
    toggleSlotVisible,
    updateSlotColor,
    applySlotParams,
    clearSlot,
  }
}

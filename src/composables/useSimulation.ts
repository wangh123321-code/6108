import { ref, computed, watch } from 'vue'
import type { ServeParams, SimFrame } from '@/types'
import { usePhysics } from './usePhysics'
import { DEFAULT_SERVE_PARAMS } from '@/utils/constants'

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
  }
}

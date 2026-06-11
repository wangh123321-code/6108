<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Gauge, Clock } from 'lucide-vue-next'
import type { SimFrame } from '@/types'
import { formatNumber, formatTime } from '@/utils/helpers'

const props = defineProps<{
  currentFrame: SimFrame | null
  duration: number
  playbackTime: number
  isPlaying: boolean
  playbackSpeed: number
  totalFrames: number
  currentFrameIdx: number
  bounceFrames: number[]
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stepBackward'): void
  (e: 'stepForward'): void
  (e: 'seek', time: number): void
  (e: 'setSpeed', speed: number): void
}>()

const speedOptions = [0.1, 0.25, 0.5, 1]
const progressPct = computed(() => {
  if (props.duration <= 0) return 0
  return Math.min(100, (props.playbackTime / props.duration) * 100)
})

const timelineRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)

const handleSeek = (clientX: number) => {
  if (!timelineRef.value || props.duration <= 0) return
  const rect = timelineRef.value.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  emit('seek', ratio * props.duration)
}

const onTimelineMouseDown = (e: MouseEvent) => {
  isDragging.value = true
  handleSeek(e.clientX)
  const onMove = (ev: MouseEvent) => handleSeek(ev.clientX)
  const onUp = () => {
    isDragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const bounceIndicators = computed(() => {
  if (props.duration <= 0 || props.totalFrames <= 0) return []
  return props.bounceFrames
    .map((idx) => {
      const pct = (idx / props.totalFrames) * 100
      return Math.max(0, Math.min(100, pct))
    })
    .filter((v) => v >= 0 && v <= 100)
})
</script>

<template>
  <div class="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-6 py-4">
    <div class="max-w-7xl mx-auto space-y-3">
      <div class="grid grid-cols-5 gap-3">
        <div class="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
          <div class="flex items-center gap-1.5 mb-1">
            <Clock class="w-3 h-3 text-slate-500" />
            <span class="text-[10px] text-slate-500 uppercase tracking-wider">仿真时间</span>
          </div>
          <div class="text-xl font-bold text-white font-mono">
            {{ formatTime(playbackTime) }}
            <span class="text-xs text-slate-600 ml-1">/ {{ formatTime(duration) }}</span>
          </div>
        </div>

        <div class="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">当前球速</div>
          <div class="text-xl font-bold text-emerald-400 font-mono">
            {{ formatNumber(currentFrame?.speed || 0, 2) }}
            <span class="text-xs text-slate-600 ml-1">m/s</span>
          </div>
        </div>

        <div class="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">旋转速度</div>
          <div class="text-xl font-bold text-orange-400 font-mono">
            {{ formatNumber(currentFrame?.spinRate || 0, 0) }}
            <span class="text-xs text-slate-600 ml-1">rpm</span>
          </div>
        </div>

        <div class="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
          <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">空间坐标 (m)</div>
          <div class="text-sm font-mono space-y-0.5">
            <div><span class="text-rose-400">X:</span> <span class="text-slate-300">{{ formatNumber(currentFrame?.position.x || 0, 3) }}</span></div>
            <div><span class="text-emerald-400">Y:</span> <span class="text-slate-300">{{ formatNumber(currentFrame?.position.y || 0, 3) }}</span></div>
            <div><span class="text-sky-400">Z:</span> <span class="text-slate-300">{{ formatNumber(currentFrame?.position.z || 0, 3) }}</span></div>
          </div>
        </div>

        <div class="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
          <div class="flex items-center gap-1.5 mb-2">
            <Gauge class="w-3 h-3 text-slate-500" />
            <span class="text-[10px] text-slate-500 uppercase tracking-wider">回放速度</span>
          </div>
          <div class="flex gap-1">
            <button
              v-for="speed in speedOptions"
              :key="speed"
              @click="emit('setSpeed', speed)"
              :class="[
                'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                playbackSpeed === speed
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'bg-slate-700/60 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
              ]"
            >
              {{ speed }}x
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1">
          <button
            @click="emit('stepBackward')"
            class="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all duration-200 flex items-center justify-center border border-slate-700/50 active:scale-95"
            title="逐帧后退"
          >
            <SkipBack class="w-4 h-4" />
          </button>

          <button
            @click="isPlaying ? emit('pause') : emit('play')"
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 transition-all duration-200 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95"
          >
            <Pause v-if="isPlaying" class="w-5 h-5" />
            <Play v-else class="w-5 h-5 ml-0.5" />
          </button>

          <button
            @click="emit('stepForward')"
            class="w-10 h-10 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all duration-200 flex items-center justify-center border border-slate-700/50 active:scale-95"
            title="逐帧前进"
          >
            <SkipForward class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1">
          <div
            ref="timelineRef"
            class="relative h-10 flex items-center cursor-pointer group"
            @mousedown="onTimelineMouseDown"
          >
            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                class="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/60 via-emerald-400 to-teal-400 rounded-full transition-[width] duration-75"
                :style="{ width: `${progressPct}%` }"
              ></div>
              <div
                v-if="currentFrame?.bounceEvent"
                class="absolute inset-y-0 left-0 bg-rose-500/30 rounded-full animate-pulse"
                :style="{ width: `${progressPct}%` }"
              ></div>
            </div>

            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none">
              <div
                v-for="(pct, i) in bounceIndicators"
                :key="`bounce-${i}`"
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                :style="{ left: `${pct}%` }"
              >
                <div class="relative flex flex-col items-center">
                  <div class="w-1 h-6 bg-rose-500 rounded-sm shadow-md shadow-rose-500/50"></div>
                  <div class="absolute -top-1 w-3 h-3 bg-rose-500 rotate-45 shadow-md shadow-rose-500/50 animate-pulse"></div>
                </div>
              </div>
            </div>

            <div
              class="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-xl shadow-black/50 border-2 border-emerald-500 transition-all duration-100 group-hover:scale-110 z-10"
              :style="{ left: `calc(${progressPct}% - 10px)` }"
            >
              <div class="absolute inset-0.5 bg-emerald-400 rounded-full"></div>
            </div>

            <div class="absolute inset-x-0 top-0 flex justify-between text-[10px] text-slate-600 font-mono">
              <span>0ms</span>
              <span>{{ formatTime(duration) }}</span>
            </div>
          </div>
        </div>

        <div class="text-right min-w-[120px]">
          <div class="text-xs text-slate-500">帧</div>
          <div class="text-sm font-bold text-slate-300 font-mono">
            {{ currentFrameIdx + 1 }} / {{ totalFrames }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

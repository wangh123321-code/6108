<script setup lang="ts">
import { Play, RotateCcw, Info } from 'lucide-vue-next'
import type { ServeParams } from '@/types'
import SpinSelector from './SpinSelector.vue'
import ParamSlider from './ParamSlider.vue'
import { getSpinLabel, getSpinColor } from '@/utils/constants'

const props = defineProps<{
  params: ServeParams
}>()

const emit = defineEmits<{
  (e: 'update:params', value: ServeParams): void
  (e: 'launch'): void
  (e: 'reset'): void
}>()

const updateParam = <K extends keyof ServeParams>(key: K, value: ServeParams[K]) => {
  emit('update:params', { ...props.params, [key]: value })
}
</script>

<template>
  <div class="h-full flex flex-col bg-slate-900/95 backdrop-blur-sm border-r border-slate-800">
    <div class="px-5 py-4 border-b border-slate-800">
      <h1 class="text-lg font-bold text-white tracking-wide flex items-center gap-2">
        <span class="text-2xl">🏓</span>
        <span>乒乓球旋转仿真</span>
      </h1>
      <p class="text-xs text-slate-500 mt-1 leading-relaxed">
        可视化理解旋转对球轨迹的影响
      </p>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
      <div class="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
        <div class="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
          <Info class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span class="text-slate-300 font-medium">物理模型：</span>
            马格努斯效应 · 空气阻力 · RK4积分 · 弹跳摩擦
          </div>
        </div>
      </div>

      <ParamSlider
        :model-value="params.speed"
        @update:model-value="(v) => updateParam('speed', v)"
        label="发球速度"
        unit="m/s"
        :min="5"
        :max="25"
        :step="0.5"
      />

      <ParamSlider
        :model-value="params.spinRate"
        @update:model-value="(v) => updateParam('spinRate', v)"
        label="旋转速度"
        unit="rpm"
        :min="500"
        :max="5000"
        :step="100"
      />

      <SpinSelector
        :model-value="params.spinType"
        @update:model-value="(v) => updateParam('spinType', v)"
      />

      <div class="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

      <ParamSlider
        :model-value="params.serveAngleY"
        @update:model-value="(v) => updateParam('serveAngleY', v)"
        label="垂直发射角"
        unit="°"
        :min="-10"
        :max="30"
        :step="1"
      />

      <ParamSlider
        :model-value="params.serveAngleX"
        @update:model-value="(v) => updateParam('serveAngleX', v)"
        label="水平偏转角"
        unit="°"
        :min="-30"
        :max="30"
        :step="1"
      />

      <ParamSlider
        :model-value="params.tossHeight"
        @update:model-value="(v) => updateParam('tossHeight', v)"
        label="抛球高度"
        unit="m"
        :min="0.1"
        :max="0.5"
        :step="0.01"
      />
    </div>

    <div class="px-5 py-4 border-t border-slate-800 space-y-3 bg-slate-900/90">
      <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
        <span class="text-xs text-slate-400">当前旋转</span>
        <div class="flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :style="{ backgroundColor: getSpinColor(params.spinType) }"
          ></span>
          <span
            class="text-sm font-semibold"
            :style="{ color: getSpinColor(params.spinType) }"
          >
            {{ getSpinLabel(params.spinType) }}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          @click="emit('reset')"
          class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all duration-200 active:scale-[0.98]"
        >
          <RotateCcw class="w-4 h-4" />
          重置
        </button>
        <button
          @click="emit('launch')"
          class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 active:scale-[0.98]"
        >
          <Play class="w-4 h-4" />
          发射
        </button>
      </div>
    </div>
  </div>
</template>

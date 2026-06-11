<script setup lang="ts">
import { Play, RotateCcw, Info, Save, Trash2, Check, Eye, EyeOff } from 'lucide-vue-next'
import type { ServeParams, CompareSlotData, SlotId } from '@/types'
import SpinSelector from './SpinSelector.vue'
import ParamSlider from './ParamSlider.vue'
import { getSpinLabel, getSpinColor } from '@/utils/constants'

const props = defineProps<{
  params: ServeParams
  compareSlots: CompareSlotData[]
  activeSlotId: SlotId | null
}>()

const emit = defineEmits<{
  (e: 'update:params', value: ServeParams): void
  (e: 'launch'): void
  (e: 'reset'): void
  (e: 'saveSlot', id: SlotId): void
  (e: 'toggleSlotVisible', id: SlotId): void
  (e: 'updateSlotColor', id: SlotId, color: string): void
  (e: 'applySlotParams', id: SlotId): void
  (e: 'clearSlot', id: SlotId): void
}>()

const updateParam = <K extends keyof ServeParams>(key: K, value: ServeParams[K]) => {
  emit('update:params', { ...props.params, [key]: value })
}

const PRESET_COLORS = [
  '#F97316', '#06B6D4', '#A855F7', '#EC4899',
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444',
]
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

      <div class="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white flex items-center gap-2">
            <span class="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-full"></span>
            轨迹对比模式
          </h3>
          <span class="text-[10px] text-slate-500">最多3组叠加对比</span>
        </div>

        <div
          v-for="slot in compareSlots"
          :key="slot.id"
          :class="[
            'p-3 rounded-xl border transition-all duration-200',
            slot.saved
              ? activeSlotId === slot.id
                ? 'bg-slate-800/80 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/60 border-slate-700/60'
              : 'bg-slate-800/30 border-slate-700/30',
          ]"
        >
          <div class="flex items-center justify-between mb-2.5">
            <div class="flex items-center gap-2">
              <div
                :class="[
                  'w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold',
                  slot.saved ? 'text-white' : 'text-slate-500 bg-slate-700/50',
                ]"
                :style="{ backgroundColor: slot.saved ? slot.color : undefined }"
              >
                {{ slot.id }}
              </div>
              <div>
                <div class="text-xs font-medium text-slate-200">
                  {{ slot.saved ? getSpinLabel(slot.params!.spinType) : '未保存' }}
                </div>
                <div class="text-[10px] text-slate-500">
                  {{ slot.saved ? `${slot.params!.speed}m/s · ${slot.params!.spinRate}rpm` : '点击保存当前参数' }}
                </div>
              </div>
            </div>
            <button
              v-if="slot.saved"
              @click="emit('toggleSlotVisible', slot.id)"
              :class="[
                'p-1.5 rounded-lg transition-all duration-200',
                slot.visible
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700/70 hover:text-slate-400',
              ]"
              :title="slot.visible ? '隐藏对比' : '显示对比'"
            >
              <Eye v-if="slot.visible" class="w-3.5 h-3.5" />
              <EyeOff v-else class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="slot.saved" class="space-y-2 mb-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-500 shrink-0 w-10">颜色</span>
              <div class="flex gap-1 flex-wrap">
                <button
                  v-for="color in PRESET_COLORS"
                  :key="color"
                  @click="emit('updateSlotColor', slot.id, color)"
                  :class="[
                    'w-4 h-4 rounded-full border-2 transition-all duration-150 hover:scale-110',
                    slot.color === color ? 'border-white scale-110' : 'border-transparent',
                  ]"
                  :style="{ backgroundColor: color }"
                ></button>
              </div>
            </div>
          </div>

          <div class="flex gap-1.5">
            <button
              v-if="!slot.saved"
              @click="emit('saveSlot', slot.id)"
              class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-700 hover:text-white transition-all duration-200 active:scale-[0.98]"
            >
              <Save class="w-3 h-3" />
              保存当前参数
            </button>
            <template v-else>
              <button
                @click="emit('applySlotParams', slot.id)"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98]',
                  activeSlotId === slot.id
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-700 hover:text-white',
                ]"
              >
                <Check v-if="activeSlotId === slot.id" class="w-3 h-3" />
                {{ activeSlotId === slot.id ? '当前组' : '应用参数' }}
              </button>
              <button
                @click="emit('saveSlot', slot.id)"
                class="p-2 rounded-lg bg-slate-700/60 text-slate-400 border border-slate-600/50 hover:bg-slate-700 hover:text-white transition-all duration-200 active:scale-[0.98]"
                title="重新保存当前参数"
              >
                <Save class="w-3.5 h-3.5" />
              </button>
              <button
                @click="emit('clearSlot', slot.id)"
                class="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-all duration-200 active:scale-[0.98]"
                title="清除该组"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </template>
          </div>
        </div>
      </div>
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

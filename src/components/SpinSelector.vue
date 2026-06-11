<script setup lang="ts">
import type { SpinType } from '@/types'
import { SPIN_TYPE_LIST } from '@/utils/constants'

const props = defineProps<{
  modelValue: SpinType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: SpinType): void
}>()

const selectSpin = (key: SpinType) => {
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-slate-300 mb-2">旋转类型</label>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="spin in SPIN_TYPE_LIST"
        :key="spin.key"
        @click="selectSpin(spin.key)"
        :class="[
          'relative px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border',
          'hover:scale-[1.02] active:scale-[0.98]',
          props.modelValue === spin.key
            ? 'text-white shadow-lg shadow-current/20 border-transparent'
            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700/60 hover:text-slate-200',
        ]"
        :style="
          props.modelValue === spin.key
            ? { backgroundColor: spin.color, borderColor: spin.color }
            : {}
        "
      >
        <div class="flex items-center gap-1.5">
          <span
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: spin.color }"
          ></span>
          <span>{{ spin.label }}</span>
        </div>
        <div
          class="text-[10px] mt-1 opacity-80 truncate"
          :title="spin.description"
        >
          {{ spin.description }}
        </div>
      </button>
    </div>
  </div>
</template>

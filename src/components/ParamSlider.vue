<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number
  min: number
  max: number
  step?: number
  label: string
  unit?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const step = computed(() => props.step || 1)

const percentage = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', parseFloat(target.value))
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-slate-300">{{ label }}</label>
      <div class="flex items-center gap-1">
        <input
          type="number"
          :value="modelValue"
          @input="handleInput"
          :min="min"
          :max="max"
          :step="step"
          class="w-20 px-2 py-1 text-xs text-right bg-slate-800/80 border border-slate-700 rounded-md text-emerald-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
        />
        <span class="text-xs text-slate-500 w-6">{{ unit }}</span>
      </div>
    </div>
    <div class="relative h-2 bg-slate-800/80 rounded-full overflow-hidden">
      <div
        class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400"
        :style="{ width: `${percentage}%` }"
      ></div>
      <input
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        @input="handleInput"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
    <div class="flex justify-between text-[10px] text-slate-600 font-mono">
      <span>{{ min }}{{ unit }}</span>
      <span>{{ max }}{{ unit }}</span>
    </div>
  </div>
</template>

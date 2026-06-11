<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSimulation } from '@/composables/useSimulation'
import ControlPanel from '@/components/ControlPanel.vue'
import BabylonScene from '@/components/BabylonScene.vue'
import TimelineBar from '@/components/TimelineBar.vue'

const sim = useSimulation()

const bounceFrames = computed(() => {
  return sim.bounceEvents.value
    .map((e) => {
      const idx = sim.frames.value.findIndex((f) => f.time === e.frame.time)
      return idx
    })
    .filter((idx) => idx >= 0)
})

const handleLaunch = () => {
  sim.runSimulation()
  setTimeout(() => {
    sim.play()
  }, 100)
}

const handleReset = () => {
  sim.runSimulation()
}

onMounted(() => {
  sim.runSimulation()
})
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden">
    <div class="flex-1 flex overflow-hidden">
      <div class="w-80 shrink-0 h-full overflow-hidden">
        <ControlPanel
          :params="sim.serveParams.value"
          :compare-slots="sim.compareSlots.value"
          :active-slot-id="sim.activeSlotId.value"
          @update:params="(p) => (sim.serveParams.value = p)"
          @launch="handleLaunch"
          @reset="handleReset"
          @save-slot="sim.saveCompareSlot"
          @toggle-slot-visible="sim.toggleSlotVisible"
          @update-slot-color="sim.updateSlotColor"
          @apply-slot-params="sim.applySlotParams"
          @clear-slot="sim.clearSlot"
        />
      </div>

      <div class="flex-1 h-full relative">
        <BabylonScene
          :frames="sim.frames.value"
          :current-frame="sim.currentFrame.value"
          :current-frame-idx="sim.currentFrameIdx.value"
          :bounce-events="sim.bounceEvents.value"
          :params="sim.serveParams.value"
          :trajectory-points="sim.trajectoryPoints.value"
          :compare-slots="sim.compareSlots.value"
          :diff-labels="sim.computeDiffLabels.value"
          :active-slot-id="sim.activeSlotId.value"
        />
      </div>
    </div>

    <TimelineBar
      :current-frame="sim.currentFrame.value"
      :duration="sim.duration.value"
      :playback-time="sim.playbackTime.value"
      :is-playing="sim.isPlaying.value"
      :playback-speed="sim.playbackSpeed.value"
      :total-frames="sim.totalFrames.value"
      :current-frame-idx="sim.currentFrameIdx.value"
      :bounce-frames="bounceFrames"
      @play="sim.play"
      @pause="sim.pause"
      @step-backward="sim.stepBackward"
      @step-forward="sim.stepForward"
      @seek="sim.seekToTime"
      @set-speed="sim.setPlaybackSpeed"
    />
  </div>
</template>

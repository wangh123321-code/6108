<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  LinesMesh,
  DynamicTexture,
  Quaternion,
  ShadowGenerator,
  DefaultRenderingPipeline,
  GlowLayer,
  PointLight,
  TransformNode,
} from '@babylonjs/core'
import type { SimFrame, ServeParams, BounceEvent } from '@/types'
import {
  TABLE_LENGTH,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  NET_HEIGHT,
  BALL_RADIUS,
  getSpinColor,
  CAMERA_PRESETS,
} from '@/utils/constants'
import { Camera, Eye, Maximize2 } from 'lucide-vue-next'

const props = defineProps<{
  frames: SimFrame[]
  currentFrame: SimFrame | null
  currentFrameIdx: number
  bounceEvents: { frame: SimFrame; event: BounceEvent }[]
  params: ServeParams
  trajectoryPoints: { x: number; y: number; z: number }[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = shallowRef<Engine | null>(null)
const scene = shallowRef<Scene | null>(null)
const camera = shallowRef<ArcRotateCamera | null>(null)
const ballMesh = shallowRef<any>(null)
const trajectoryLine = shallowRef<LinesMesh | null>(null)
const bounceMarkers = shallowRef<any[]>([])
const labelTexture = shallowRef<DynamicTexture | null>(null)

const activePreset = ref('default')
const showLabels = ref(true)

const disposeMarker = (marker: any) => {
  try {
    if (marker.sphere) marker.sphere.dispose()
    if (marker.arcIn) marker.arcIn.dispose()
    if (marker.arcOut) marker.arcOut.dispose()
    if (marker.label) marker.label.dispose()
  } catch (e) {}
}

const clearBounceMarkers = () => {
  bounceMarkers.value.forEach(disposeMarker)
  bounceMarkers.value = []
}

const createBallWithGridLines = (s: Scene) => {
  const sphere = MeshBuilder.CreateSphere(
    'ball',
    { diameter: BALL_RADIUS * 2, segments: 48 },
    s,
  )

  const ballMat = new StandardMaterial('ballMat', s)
  ballMat.diffuseColor = new Color3(1.0, 0.55, 0.1)
  ballMat.specularColor = new Color3(0.3, 0.2, 0.1)
  ballMat.specularPower = 32
  ballMat.emissiveColor = new Color3(0.1, 0.05, 0)
  sphere.material = ballMat

  const size = 512
  const texture = new DynamicTexture('ballTexture', { width: size, height: size }, s, false)
  const ctx = texture.getContext() as any

  ctx.fillStyle = '#FF8C1A'
  ctx.fillRect(0, 0, size, size)

  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 2

  const lonCount = 12
  for (let i = 0; i < lonCount; i++) {
    const x = Math.floor((i / lonCount) * size)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
  }

  const latCount = 8
  for (let i = 0; i <= latCount; i++) {
    const t = i / latCount
    const y = Math.floor(t * size)
    const scale = Math.abs(Math.sin(t * Math.PI))
    const width = Math.floor(size * 0.5 * scale)
    const cx = size / 2
    const rx = width
    const ry = Math.max(2, width * 0.25)
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      const px = cx + rx * Math.cos(a)
      const py = y + ry * Math.sin(a)
      if (a === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.6)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, size / 2)
  ctx.lineTo(size, size / 2)
  ctx.stroke()
  const cx = size / 2
  const cy = size / 2
  const rx2 = size / 2 - 2
  const ry2 = size / 4
  ctx.beginPath()
  for (let a = 0; a <= Math.PI * 2; a += 0.05) {
    const px = cx + rx2 * Math.cos(a)
    const py = cy + ry2 * Math.sin(a)
    if (a === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()

  texture.update()
  ballMat.diffuseTexture = texture

  return sphere
}

const createTable = (s: Scene) => {
  const topY = TABLE_HEIGHT
  const tableGroup = new TransformNode('tableGroup', s)

  const top = MeshBuilder.CreateBox(
    'tableTop',
    { width: TABLE_LENGTH, height: 0.05, depth: TABLE_WIDTH },
    s,
  )
  top.position.set(0, topY, 0)
  const topMat = new StandardMaterial('tableTopMat', s)
  topMat.diffuseColor = new Color3(0.05, 0.35, 0.22)
  topMat.specularColor = new Color3(0.1, 0.1, 0.1)
  topMat.specularPower = 8
  top.material = topMat
  top.parent = tableGroup

  const edgeMat = new StandardMaterial('edgeMat', s)
  edgeMat.diffuseColor = new Color3(0.9, 0.9, 0.95)

  const borderThickness = 0.02
  const borderHeight = 0.05
  const makeBorder = (name: string, w: number, d: number, x: number, z: number) => {
    const b = MeshBuilder.CreateBox(name, { width: w, height: borderHeight, depth: d }, s)
    b.position.set(x, topY + borderHeight / 2, z)
    b.material = edgeMat
    b.parent = tableGroup
    return b
  }
  makeBorder('borderFront', TABLE_LENGTH + borderThickness * 2, borderThickness, 0, -TABLE_WIDTH / 2 - borderThickness / 2)
  makeBorder('borderBack', TABLE_LENGTH + borderThickness * 2, borderThickness, 0, TABLE_WIDTH / 2 + borderThickness / 2)
  makeBorder('borderLeft', borderThickness, TABLE_WIDTH, -TABLE_LENGTH / 2 - borderThickness / 2, 0)
  makeBorder('borderRight', borderThickness, TABLE_WIDTH, TABLE_LENGTH / 2 + borderThickness / 2, 0)

  const lineMat = new StandardMaterial('lineMat', s)
  lineMat.diffuseColor = new Color3(1, 1, 1)
  lineMat.disableLighting = true
  lineMat.emissiveColor = new Color3(0.9, 0.9, 0.95)

  const centerLine = MeshBuilder.CreateBox(
    'centerLine',
    { width: 0.002, height: 0.052, depth: TABLE_WIDTH },
    s,
  )
  centerLine.position.set(0, topY + 0.026, 0)
  centerLine.material = lineMat
  centerLine.parent = tableGroup

  const legMat = new StandardMaterial('legMat', s)
  legMat.diffuseColor = new Color3(0.3, 0.3, 0.35)
  const legSize = 0.05
  const legY = (TABLE_HEIGHT - 0.05) / 2
  const legInset = 0.2
  const legPositions = [
    [-TABLE_LENGTH / 2 + legInset, legY, -TABLE_WIDTH / 2 + legInset],
    [TABLE_LENGTH / 2 - legInset, legY, -TABLE_WIDTH / 2 + legInset],
    [-TABLE_LENGTH / 2 + legInset, legY, TABLE_WIDTH / 2 - legInset],
    [TABLE_LENGTH / 2 - legInset, legY, TABLE_WIDTH / 2 - legInset],
  ]
  legPositions.forEach((pos, i) => {
    const leg = MeshBuilder.CreateBox(`leg${i}`, { width: legSize, height: TABLE_HEIGHT - 0.05, depth: legSize }, s)
    leg.position.set(pos[0], pos[1], pos[2])
    leg.material = legMat
    leg.parent = tableGroup
  })

  return tableGroup
}

const createNet = (s: Scene) => {
  const netGroup = new TransformNode('netGroup', s)

  const postMat = new StandardMaterial('postMat', s)
  postMat.diffuseColor = new Color3(0.2, 0.2, 0.25)

  const postHeight = TABLE_HEIGHT + NET_HEIGHT
  const postPos = TABLE_WIDTH / 2 + 0.05
  const leftPost = MeshBuilder.CreateCylinder('leftPost', { height: NET_HEIGHT, diameter: 0.01 }, s)
  leftPost.position.set(0, TABLE_HEIGHT + NET_HEIGHT / 2, -postPos)
  leftPost.material = postMat
  leftPost.parent = netGroup

  const rightPost = MeshBuilder.CreateCylinder('rightPost', { height: NET_HEIGHT, diameter: 0.01 }, s)
  rightPost.position.set(0, TABLE_HEIGHT + NET_HEIGHT / 2, postPos)
  rightPost.material = postMat
  rightPost.parent = netGroup

  const netTop = MeshBuilder.CreateCylinder('netTop', { height: TABLE_WIDTH + 0.1, diameter: 0.008 }, s)
  netTop.rotation.z = Math.PI / 2
  netTop.position.set(0, TABLE_HEIGHT + NET_HEIGHT, 0)
  netTop.material = postMat
  netTop.parent = netGroup

  const netMat = new StandardMaterial('netMat', s)
  netMat.diffuseColor = new Color3(0.85, 0.85, 0.9)
  netMat.alpha = 0.6
  netMat.backFaceCulling = false

  const netMesh = MeshBuilder.CreatePlane(
    'netMesh',
    { width: TABLE_WIDTH + 0.1, height: NET_HEIGHT },
    s,
  )
  netMesh.rotation.y = Math.PI / 2
  netMesh.position.set(0, TABLE_HEIGHT + NET_HEIGHT / 2, 0)
  netMesh.material = netMat
  netMesh.parent = netGroup

  return netGroup
}

const createTrajectoryLine = (s: Scene) => {
  const line = MeshBuilder.CreateLines(
    'trajectory',
    { points: [new Vector3(0, 0, 0)], updatable: true },
    s,
  )
  line.color = new Color3(1, 0.6, 0.1)
  line.alpha = 0.9
  line.isPickable = false
  return line
}

const updateTrajectory = (points: { x: number; y: number; z: number }[], colorHex: string, upToIdx: number) => {
  if (!trajectoryLine.value || !scene.value || points.length === 0) return
  const vecPoints: Vector3[] = []
  const hex = colorHex.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const maxIdx = Math.min(upToIdx, points.length - 1)
  const step = Math.max(1, Math.ceil(maxIdx / 500))

  for (let i = 0; i <= maxIdx; i += step) {
    const p = points[i]
    vecPoints.push(new Vector3(p.x, p.y, p.z))
  }
  const last = Math.min(maxIdx, points.length - 1)
  if (last % step !== 0) {
    const p = points[last]
    vecPoints.push(new Vector3(p.x, p.y, p.z))
  }

  MeshBuilder.CreateLines(
    'trajectory',
    { points: vecPoints, instance: trajectoryLine.value, updatable: true },
    scene.value,
  )
  if (trajectoryLine.value) {
    trajectoryLine.value.color = new Color3(r, g, b)
  }
}

const createBounceMarker = (s: Scene, event: BounceEvent, index: number) => {
  const marker: any = {}
  const baseY = TABLE_HEIGHT + 0.001

  marker.sphere = MeshBuilder.CreateSphere(`bounce${index}`, { diameter: 0.04 }, s)
  marker.sphere.position.set(event.position.x, baseY + 0.02, event.position.z)
  const mat = new StandardMaterial(`bounceMat${index}`, s)
  mat.diffuseColor = new Color3(1, 0.2, 0.2)
  mat.emissiveColor = new Color3(0.8, 0.1, 0.1)
  marker.sphere.material = mat

  const makeArc = (name: string, angleDeg: number, isIncoming: boolean) => {
    const points: Vector3[] = []
    const angle = (angleDeg * Math.PI) / 180
    const radius = 0.15
    const steps = 32
    const startAngle = isIncoming ? Math.PI : 0
    const endAngle = isIncoming ? Math.PI + angle : angle
    for (let i = 0; i <= steps; i++) {
      const t = startAngle + ((endAngle - startAngle) * i) / steps
      const x = event.position.x + radius * Math.cos(t)
      const y = baseY + 0.005 + radius * Math.abs(Math.sin(t))
      const z = event.position.z
      points.push(new Vector3(x, y, z))
    }
    const line = MeshBuilder.CreateLines(name, { points, updatable: false }, s)
    line.color = isIncoming ? new Color3(1, 0.6, 0.1) : new Color3(0.2, 0.8, 0.4)
    return line
  }

  marker.arcIn = makeArc(`arcIn${index}`, event.incidentAngle, true)
  marker.arcOut = makeArc(`arcOut${index}`, event.reflectAngle, false)

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 320
  labelCanvas.height = 100
  const ctx = labelCanvas.getContext('2d')!
  ctx.fillStyle = 'rgba(10,20,40,0.9)'
  ctx.roundRect?.(0, 0, 320, 100, 12)
  if (!ctx.roundRect) {
    ctx.fillRect(0, 0, 320, 100)
  } else {
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.font = 'bold 20px "PingFang SC", sans-serif'
  ctx.fillStyle = '#F97316'
  ctx.fillText(`入射: ${event.incidentAngle.toFixed(1)}°`, 16, 36)
  ctx.fillStyle = '#10B981'
  ctx.fillText(`反射: ${event.reflectAngle.toFixed(1)}°`, 16, 72)

  const dynTex = new DynamicTexture(`bounceLabel${index}`, { width: 320, height: 100 }, s, false)
  dynTex.getContext().drawImage(labelCanvas, 0, 0)
  dynTex.update()

  marker.label = MeshBuilder.CreatePlane(`labelPlane${index}`, { width: 0.32, height: 0.1 }, s)
  marker.label.position.set(event.position.x + 0.3, TABLE_HEIGHT + 0.25, event.position.z + 0.2)
  marker.label.billboardMode = 7
  const labelMat = new StandardMaterial(`labelMat${index}`, s)
  labelMat.diffuseTexture = dynTex
  labelMat.opacityTexture = dynTex
  labelMat.useAlphaFromDiffuseTexture = true
  labelMat.disableLighting = true
  labelMat.backFaceCulling = false
  marker.label.material = labelMat

  return marker
}

const applyBallTransform = (frame: SimFrame) => {
  if (!ballMesh.value) return
  ballMesh.value.position.set(frame.position.x, frame.position.y, frame.position.z)

  const q = Quaternion.FromEulerAngles(frame.rotation.x, frame.rotation.y, frame.rotation.z)
  ballMesh.value.rotationQuaternion = q
}

const setCameraPreset = (name: keyof typeof CAMERA_PRESETS) => {
  if (!camera.value) return
  activePreset.value = name
  const preset = CAMERA_PRESETS[name]
  camera.value.alpha = Math.atan2(-preset.position.z, -preset.position.x)
  const dist = Math.sqrt(
    preset.position.x ** 2 + preset.position.y ** 2 + preset.position.z ** 2,
  )
  camera.value.beta = Math.acos(preset.position.y / dist)
  camera.value.radius = dist
  camera.value.target = new Vector3(preset.target.x, preset.target.y, preset.target.z)
}

onMounted(() => {
  if (!canvasRef.value) return

  engine.value = new Engine(canvasRef.value, true, { preserveDrawingBuffer: true, stencil: true })
  scene.value = new Scene(engine.value)
  scene.value.clearColor = new Color4(0.03, 0.06, 0.12, 1)

  camera.value = new ArcRotateCamera(
    'camera',
    -Math.PI / 2.5,
    Math.PI / 3,
    5,
    new Vector3(0, 0.8, 0),
    scene.value,
  )
  camera.value.attachControl(canvasRef.value, true)
  camera.value.lowerRadiusLimit = 1.5
  camera.value.upperRadiusLimit = 12
  camera.value.lowerBetaLimit = 0.1
  camera.value.upperBetaLimit = Math.PI / 2 - 0.05
  camera.value.wheelDeltaPercentage = 0.01
  setCameraPreset('default')

  const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene.value)
  hemiLight.intensity = 0.5
  hemiLight.diffuse = new Color3(0.9, 0.9, 1.0)
  hemiLight.groundColor = new Color3(0.2, 0.25, 0.3)

  const dirLight = new DirectionalLight('dir', new Vector3(-0.5, -1, -0.3), scene.value)
  dirLight.position = new Vector3(3, 5, 2)
  dirLight.intensity = 1.2

  const fillLight = new PointLight('fill', new Vector3(2, 3, -2), scene.value)
  fillLight.intensity = 0.4
  fillLight.diffuse = new Color3(0.8, 0.85, 1)

  const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10, subdivisions: 1 }, scene.value)
  ground.position.y = 0
  const groundMat = new StandardMaterial('groundMat', scene.value)
  groundMat.diffuseColor = new Color3(0.04, 0.07, 0.14)
  groundMat.specularColor = new Color3(0, 0, 0)
  ground.material = groundMat

  createTable(scene.value)
  createNet(scene.value)

  ballMesh.value = createBallWithGridLines(scene.value)
  trajectoryLine.value = createTrajectoryLine(scene.value)

  const shadowGen = new ShadowGenerator(1024, dirLight)
  shadowGen.useBlurExponentialShadowMap = true
  shadowGen.blurKernel = 32
  shadowGen.addShadowCaster(ballMesh.value)

  const renderPipeline = new DefaultRenderingPipeline('pipeline', true, scene.value, [camera.value])
  renderPipeline.bloomEnabled = true
  renderPipeline.bloomThreshold = 0.7
  renderPipeline.bloomWeight = 0.3
  renderPipeline.bloomKernel = 32
  renderPipeline.bloomScale = 0.5

  const glow = new GlowLayer('glow', scene.value)
  glow.intensity = 0.6

  engine.value.runRenderLoop(() => {
    scene.value?.render()
  })

  const resize = () => engine.value?.resize()
  window.addEventListener('resize', resize)
  ;(window as any).__babylonCleanup = () => {
    window.removeEventListener('resize', resize)
  }
})

onUnmounted(() => {
  ;(window as any).__babylonCleanup?.()
  clearBounceMarkers()
  engine.value?.dispose()
})

watch(
  () => props.currentFrame,
  (frame) => {
    if (frame) applyBallTransform(frame)
  },
  { immediate: true },
)

watch(
  [() => props.trajectoryPoints, () => props.params.spinType, () => props.currentFrameIdx],
  ([points, spinType]) => {
    const upTo = props.currentFrame ? props.frames.indexOf(props.currentFrame) : points.length - 1
    updateTrajectory(points, getSpinColor(spinType), Math.max(0, upTo))
  },
  { immediate: true, deep: false },
)

watch(
  () => props.currentFrameIdx,
  (idx) => {
    const upTo = Math.max(0, Math.min(idx, props.trajectoryPoints.length - 1))
    updateTrajectory(props.trajectoryPoints, getSpinColor(props.params.spinType), upTo)
  },
)

watch(
  () => props.bounceEvents,
  (events) => {
    if (!scene.value) return
    clearBounceMarkers()
    events.forEach((e, i) => {
      bounceMarkers.value.push(createBounceMarker(scene.value!, e.event, i))
    })
  },
  { immediate: true, deep: true },
)

watch(
  () => props.frames.length,
  () => {
    if (!scene.value) return
    clearBounceMarkers()
    props.bounceEvents.forEach((e, i) => {
      bounceMarkers.value.push(createBounceMarker(scene.value!, e.event, i))
    })
    const upTo = props.currentFrame ? props.frames.indexOf(props.currentFrame) : props.trajectoryPoints.length - 1
    updateTrajectory(props.trajectoryPoints, getSpinColor(props.params.spinType), Math.max(0, upTo))
  },
)

defineExpose({ setCameraPreset })
</script>

<template>
  <div class="relative w-full h-full">
    <canvas ref="canvasRef" class="w-full h-full block"></canvas>

    <div class="absolute top-4 left-4 flex flex-col gap-2">
      <div class="flex gap-2 bg-slate-900/70 backdrop-blur-md rounded-xl p-1.5 border border-slate-700/50 shadow-xl">
        <button
          v-for="preset in ['default', 'serve', 'side', 'top'] as const"
          :key="preset"
          @click="setCameraPreset(preset)"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5',
            activePreset === preset
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
          ]"
        >
          <Camera v-if="preset === 'default'" class="w-3.5 h-3.5" />
          <Eye v-else-if="preset === 'serve'" class="w-3.5 h-3.5" />
          <Maximize2 v-else class="w-3.5 h-3.5" />
          {{ CAMERA_PRESETS[preset].name }}
        </button>
      </div>
    </div>

    <div class="absolute top-4 right-4 bg-slate-900/70 backdrop-blur-md rounded-xl px-4 py-2 border border-slate-700/50 shadow-xl">
      <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">操作提示</div>
      <div class="text-xs text-slate-400 space-y-0.5">
        <div>🖱️ 左键拖拽：旋转视角</div>
        <div>🖱️ 滚轮：缩放</div>
        <div>🖱️ 右键拖拽：平移</div>
      </div>
    </div>
  </div>
</template>

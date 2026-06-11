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
  DynamicTexture,
  Quaternion,
  ShadowGenerator,
  DefaultRenderingPipeline,
  GlowLayer,
  PointLight,
  TransformNode,
  Curve3,
} from '@babylonjs/core'
import type { SimFrame, ServeParams, BounceEvent, CompareSlotData, DiffLabel, SlotId } from '@/types'
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
  compareSlots: CompareSlotData[]
  diffLabels: DiffLabel[]
  activeSlotId: SlotId | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = shallowRef<Engine | null>(null)
const scene = shallowRef<Scene | null>(null)
const camera = shallowRef<ArcRotateCamera | null>(null)
const ballMesh = shallowRef<any>(null)
const trajectoryTubes = shallowRef<Map<SlotId | 'main', any>>(new Map())
const trajectoryMaterials = shallowRef<Map<SlotId | 'main', any>>(new Map())
const bounceMarkers = shallowRef<any[]>([])
const diffLabelMeshes = shallowRef<any[]>([])
const slotStartMarkers = shallowRef<Map<SlotId, any>>(new Map())

const activePreset = ref('default')
const showLabels = ref(true)

const hexToColor3 = (hex: string): Color3 => {
  const h = hex.replace('#', '')
  return new Color3(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}

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

const disposeDiffLabels = () => {
  diffLabelMeshes.value.forEach((m) => {
    try {
      m.dispose?.()
    } catch (e) {}
  })
  diffLabelMeshes.value = []
}

const disposeAllTrajectories = () => {
  trajectoryTubes.value.forEach((tube) => {
    try {
      tube.dispose?.()
    } catch (e) {}
  })
  trajectoryTubes.value.clear()

  trajectoryMaterials.value.forEach((mat) => {
    try {
      mat.dispose?.()
    } catch (e) {}
  })
  trajectoryMaterials.value.clear()

  slotStartMarkers.value.forEach((m) => {
    try {
      m.dispose?.()
    } catch (e) {}
  })
  slotStartMarkers.value.clear()
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

const createTrajectoryTube = (
  s: Scene,
  key: SlotId | 'main',
  points: { x: number; y: number; z: number }[],
  colorHex: string,
  upToIdx: number,
) => {
  if (!s || points.length < 2) return

  const maxIdx = Math.min(upToIdx, points.length - 1)
  const step = Math.max(1, Math.ceil(maxIdx / 300))

  const vecPoints: Vector3[] = []
  for (let i = 0; i <= maxIdx; i += step) {
    vecPoints.push(new Vector3(points[i].x, points[i].y, points[i].z))
  }
  const last = Math.min(maxIdx, points.length - 1)
  if (last % step !== 0) {
    vecPoints.push(new Vector3(points[last].x, points[last].y, points[last].z))
  }
  if (vecPoints.length < 2) return

  const existingTube = trajectoryTubes.value.get(key)
  if (existingTube) {
    try {
      existingTube.dispose()
    } catch (e) {}
  }

  const curve = Curve3.CreateCatmullRomSpline(
    vecPoints,
    Math.max(1, Math.floor(vecPoints.length / 2)),
    false,
  )
  const tube = MeshBuilder.CreateTube(
    `traj_${String(key)}`,
    {
      path: curve.getPoints(),
      radius: 0.006,
      tessellation: 10,
      updatable: false,
    },
    s,
  )
  tube.isPickable = false

  let mat = trajectoryMaterials.value.get(key)
  if (!mat) {
    mat = new StandardMaterial(`trajMat_${String(key)}`, s)
    mat.disableLighting = true
    trajectoryMaterials.value.set(key, mat)
  }
  const c3 = hexToColor3(colorHex)
  mat.emissiveColor = c3
  mat.diffuseColor = c3
  mat.alpha = key === 'main' ? 0.95 : 0.85
  tube.material = mat

  trajectoryTubes.value.set(key, tube)
}

const createSlotStartMarker = (
  s: Scene,
  slotId: SlotId,
  colorHex: string,
  position: { x: number; y: number; z: number },
) => {
  const existing = slotStartMarkers.value.get(slotId)
  if (existing) {
    try {
      existing.dispose()
    } catch (e) {}
  }

  const marker = new TransformNode(`slotStart_${slotId}`, s)

  const sphere = MeshBuilder.CreateSphere(
    `slotSphere_${slotId}`,
    { diameter: 0.06, segments: 16 },
    s,
  )
  sphere.position.set(position.x, position.y + 0.03, position.z)
  const mat = new StandardMaterial(`slotStartMat_${slotId}`, s)
  const c3 = hexToColor3(colorHex)
  mat.emissiveColor = c3
  mat.diffuseColor = c3
  mat.disableLighting = true
  sphere.material = mat
  sphere.parent = marker

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 64
  labelCanvas.height = 64
  const ctx = labelCanvas.getContext('2d')!
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = colorHex
  ctx.beginPath()
  ctx.arc(32, 32, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.font = 'bold 28px "PingFang SC", sans-serif'
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(slotId, 32, 33)

  const dynTex = new DynamicTexture(`slotLabelTex_${slotId}`, { width: 64, height: 64 }, s, false)
  dynTex.getContext().drawImage(labelCanvas, 0, 0)
  dynTex.update()

  const labelPlane = MeshBuilder.CreatePlane(`slotLabelPlane_${slotId}`, { width: 0.1, height: 0.1 }, s)
  labelPlane.position.set(position.x, position.y + 0.12, position.z)
  labelPlane.billboardMode = 7
  const labelMat = new StandardMaterial(`slotLabelMat_${slotId}`, s)
  labelMat.diffuseTexture = dynTex
  labelMat.opacityTexture = dynTex
  labelMat.useAlphaFromDiffuseTexture = true
  labelMat.disableLighting = true
  labelMat.backFaceCulling = false
  labelPlane.material = labelMat
  labelPlane.parent = marker

  slotStartMarkers.value.set(slotId, marker)
}

const createDiffLabelMesh = (s: Scene, label: DiffLabel, index: number) => {
  const group = new TransformNode(`diffGroup_${index}`, s)

  let bgColor = 'rgba(10,20,40,0.92)'
  let accentColor = '#F59E0B'
  if (label.type === 'arc_height') accentColor = '#F97316'
  if (label.type === 'bounce_offset') accentColor = '#10B981'
  if (label.type === 'net_height') accentColor = '#06B6D4'

  const titleMap: Record<string, string> = {
    arc_height: '📐 最高弧线差',
    bounce_offset: '📍 弹跳点偏移',
    net_height: '🌐 过网高度差',
  }

  const padding = 16
  const lineHeight = 28
  const titleText = titleMap[label.type] || label.type
  const lines = [
    titleText,
    label.text,
    `${label.slotA}: ${(label.valueA * 100).toFixed(1)}cm  |  ${label.slotB}: ${(label.valueB * 100).toFixed(1)}cm`,
  ]
  const canvasWidth = 360
  const canvasHeight = padding * 2 + lines.length * lineHeight

  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = canvasWidth
  labelCanvas.height = canvasHeight
  const ctx = labelCanvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.beginPath()
  const radius = 14
  ctx.moveTo(radius, 0)
  ctx.lineTo(canvasWidth - radius, 0)
  ctx.quadraticCurveTo(canvasWidth, 0, canvasWidth, radius)
  ctx.lineTo(canvasWidth, canvasHeight - radius)
  ctx.quadraticCurveTo(canvasWidth, canvasHeight, canvasWidth - radius, canvasHeight)
  ctx.lineTo(radius, canvasHeight)
  ctx.quadraticCurveTo(0, canvasHeight, 0, canvasHeight - radius)
  ctx.lineTo(0, radius)
  ctx.quadraticCurveTo(0, 0, radius, 0)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = accentColor + 'CC'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = accentColor
  ctx.fillRect(0, 0, 6, canvasHeight)

  lines.forEach((line, i) => {
    if (i === 0) {
      ctx.font = 'bold 18px "PingFang SC", sans-serif'
      ctx.fillStyle = accentColor
    } else if (i === 1) {
      ctx.font = 'bold 17px "PingFang SC", sans-serif'
      ctx.fillStyle = '#FFFFFF'
    } else {
      ctx.font = '13px "PingFang SC", sans-serif'
      ctx.fillStyle = 'rgba(200,200,220,0.75)'
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(line, padding + 8, padding + i * lineHeight + (i === 0 ? 0 : 2))
  })

  const dynTex = new DynamicTexture(`diffTex_${index}`, { width: canvasWidth, height: canvasHeight }, s, false)
  dynTex.getContext().drawImage(labelCanvas, 0, 0)
  dynTex.update()

  const planeWidth = 0.48
  const planeHeight = (canvasHeight / canvasWidth) * planeWidth
  const labelPlane = MeshBuilder.CreatePlane(`diffPlane_${index}`, { width: planeWidth, height: planeHeight }, s)
  labelPlane.position.set(label.position.x, label.position.y, label.position.z)
  labelPlane.billboardMode = 7
  const labelMat = new StandardMaterial(`diffMat_${index}`, s)
  labelMat.diffuseTexture = dynTex
  labelMat.opacityTexture = dynTex
  labelMat.useAlphaFromDiffuseTexture = true
  labelMat.disableLighting = true
  labelMat.backFaceCulling = false
  labelPlane.material = labelMat
  labelPlane.parent = group

  return group
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

const updateAllTrajectories = () => {
  if (!scene.value) return

  const visibleSlots = props.compareSlots.filter((s) => s.saved && s.visible)
  const existingKeys = new Set<SlotId | 'main'>(trajectoryTubes.value.keys())
  const neededKeys = new Set<SlotId | 'main'>(['main'])
  visibleSlots.forEach((s) => neededKeys.add(s.id))

  existingKeys.forEach((key) => {
    if (!neededKeys.has(key)) {
      const tube = trajectoryTubes.value.get(key)
      if (tube) {
        try {
          tube.dispose()
        } catch (e) {}
        trajectoryTubes.value.delete(key)
      }
      const mat = trajectoryMaterials.value.get(key)
      if (mat) {
        try {
          mat.dispose()
        } catch (e) {}
        trajectoryMaterials.value.delete(key)
      }
      const slotKey = key as SlotId
      if (slotStartMarkers.value.has(slotKey)) {
        try {
          slotStartMarkers.value.get(slotKey)?.dispose()
        } catch (e) {}
        slotStartMarkers.value.delete(slotKey)
      }
    }
  })

  const upToMain = props.currentFrame
    ? props.frames.indexOf(props.currentFrame)
    : props.trajectoryPoints.length - 1
  const mainColor = props.activeSlotId
    ? props.compareSlots.find((s) => s.id === props.activeSlotId)?.color || getSpinColor(props.params.spinType)
    : getSpinColor(props.params.spinType)
  createTrajectoryTube(
    scene.value,
    'main',
    props.trajectoryPoints,
    mainColor,
    Math.max(0, upToMain),
  )

  visibleSlots.forEach((slot) => {
    createTrajectoryTube(
      scene.value!,
      slot.id,
      slot.trajectoryPoints,
      slot.color,
      slot.trajectoryPoints.length - 1,
    )
    if (slot.trajectoryPoints.length > 0) {
      createSlotStartMarker(scene.value!, slot.id, slot.color, slot.trajectoryPoints[0])
    }
  })
}

const updateDiffLabels = () => {
  if (!scene.value) return
  disposeDiffLabels()
  props.diffLabels.forEach((label, i) => {
    const mesh = createDiffLabelMesh(scene.value!, label, i)
    diffLabelMeshes.value.push(mesh)
  })
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

  updateAllTrajectories()

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
  disposeDiffLabels()
  disposeAllTrajectories()
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
  () => [props.trajectoryPoints, props.params.spinType, props.currentFrameIdx],
  () => {
    updateAllTrajectories()
  },
  { immediate: true, deep: false },
)

watch(
  () => props.currentFrameIdx,
  () => {
    updateAllTrajectories()
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
    updateAllTrajectories()
  },
)

watch(
  () => [
    props.compareSlots.map((s) => `${s.id}:${s.saved}:${s.visible}:${s.color}:${s.frames.length}`).join('|'),
    props.activeSlotId,
  ],
  () => {
    updateAllTrajectories()
    updateDiffLabels()
  },
  { deep: false },
)

watch(
  () => props.diffLabels,
  () => {
    updateDiffLabels()
  },
  { deep: true },
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

    <div
      v-if="compareSlots.some(s => s.saved && s.visible)"
      class="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md rounded-xl px-4 py-3 border border-slate-700/50 shadow-xl"
    >
      <div class="text-[10px] text-slate-500 uppercase tracking-wider mb-2">轨迹图例</div>
      <div class="space-y-1.5">
        <div
          v-for="slot in compareSlots.filter(s => s.saved)"
          :key="slot.id"
          class="flex items-center gap-2"
        >
          <span
            class="w-3 h-3 rounded-full shrink-0"
            :class="{ 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900': activeSlotId === slot.id }"
            :style="{ backgroundColor: slot.color, opacity: slot.visible ? 1 : 0.3 }"
          ></span>
          <span
            class="text-xs font-medium"
            :style="{ color: slot.color, opacity: slot.visible ? 1 : 0.4 }"
          >
            {{ slot.id }}组 · {{ slot.params ? getSpinColor(slot.params.spinType) && '' : '' }}
            <span v-if="slot.params" class="text-slate-400 font-normal ml-1">
              {{ slot.params.speed }}m/s
            </span>
          </span>
          <span
            v-if="activeSlotId === slot.id"
            class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 ml-auto"
          >
            球体
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

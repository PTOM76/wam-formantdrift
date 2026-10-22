// 3 つの山の合成した周波数特性のディスプレイ。山の印をドラッグして、中心周波数を動かせる。
import { ACCENT, COLORS, el } from './dom.js'
import { BANDS, FORMANTS, dryGain, trimDb } from './params.js'

const WIDTH = 360
const HEIGHT = 124
const LOW_HZ = 60
const HIGH_HZ = 8000
const CURVE_POINTS = 180
const DB_RANGE = 40 // 縦軸の幅。0 dB が真ん中で、上下に ±20 dB
const GRID_HZ = [100, 200, 500, 1000, 2000, 5000]
const GRID_DB = [-12, 0, 12]

// 周波数（Hz）と横位置（px）の変換。対数
const xOfHz = (hz) => (Math.log(hz / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ)) * WIDTH
const hzOfX = (x) => LOW_HZ * (HIGH_HZ / LOW_HZ) ** Math.min(1, Math.max(0, x / WIDTH))
const yOfDb = (db) => HEIGHT * (0.5 - db / DB_RANGE)

// 特性を求める周波数の並び（対数で等間隔）
const CURVE_FREQS = Float32Array.from({ length: CURVE_POINTS }, (_, i) => LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / (CURVE_POINTS - 1)))

function createCanvas() {
  const canvas = el('canvas', `width:${WIDTH}px;height:${HEIGHT}px;display:block;border-radius:6px;border:1px solid ${COLORS.border};background:${COLORS.screen};cursor:ew-resize;touch-action:none`)
  // 高解像度の画面ではぼやけないように、描画の大きさを倍にする
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = WIDTH * ratio
  canvas.height = HEIGHT * ratio
  const g = canvas.getContext('2d')
  g.scale(ratio, ratio)
  return { canvas, g }
}

// 目盛りの線と文字（周波数の縦線、dB の横線）
function drawGrid(g) {
  g.lineWidth = 1
  g.font = '9px Consolas,monospace'
  g.fillStyle = '#4f6b7a'
  g.strokeStyle = COLORS.grid
  for (const hz of GRID_HZ) {
    g.beginPath(); g.moveTo(xOfHz(hz) + 0.5, 0); g.lineTo(xOfHz(hz) + 0.5, HEIGHT); g.stroke()
    g.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), xOfHz(hz) + 3, HEIGHT - 4)
  }
  for (const db of GRID_DB) {
    g.strokeStyle = db === 0 ? '#245066' : COLORS.grid
    g.beginPath(); g.moveTo(0, yOfDb(db) + 0.5); g.lineTo(WIDTH, yOfDb(db) + 0.5); g.stroke()
  }
}

// 全体の周波数特性（dB）。3 つの山の特性を複素数で掛け合わせ、ドライと混ぜて、出力の補正を足す
function responseCurve(probes, centers, { peak, sharp, mix }) {
  const magnitude = new Float32Array(CURVE_POINTS)
  const phase = new Float32Array(CURVE_POINTS)
  const re = new Float64Array(CURVE_POINTS).fill(1)
  const im = new Float64Array(CURVE_POINTS)
  probes.forEach((probe, index) => {
    probe.frequency.value = centers[index]
    probe.gain.value = peak
    probe.Q.value = BANDS[index].q * sharp
    probe.getFrequencyResponse(CURVE_FREQS, magnitude, phase)
    for (let k = 0; k < CURVE_POINTS; k++) {
      const nextRe = re[k] * magnitude[k] * Math.cos(phase[k]) - im[k] * magnitude[k] * Math.sin(phase[k])
      im[k] = re[k] * magnitude[k] * Math.sin(phase[k]) + im[k] * magnitude[k] * Math.cos(phase[k])
      re[k] = nextRe
    }
  })
  const dry = dryGain(mix)
  return Array.from(CURVE_FREQS, (_, k) => 20 * Math.log10(Math.hypot(dry + mix * re[k], mix * im[k]) + 1e-9) + trimDb(peak))
}

// 特性の線と、その下の塗り
function drawCurve(g, curve) {
  g.beginPath()
  curve.forEach((db, k) => (k === 0 ? g.moveTo(xOfHz(CURVE_FREQS[k]), yOfDb(db)) : g.lineTo(xOfHz(CURVE_FREQS[k]), yOfDb(db))))
  g.strokeStyle = ACCENT
  g.lineWidth = 2
  g.stroke()
  g.lineTo(WIDTH, HEIGHT); g.lineTo(0, HEIGHT); g.closePath()
  const gradient = g.createLinearGradient(0, 0, 0, HEIGHT)
  gradient.addColorStop(0, 'rgba(79,195,247,0.30)')
  gradient.addColorStop(1, 'rgba(79,195,247,0.02)')
  g.fillStyle = gradient
  g.fill()
}

// F1〜F3 の印。点線と名前は今の（揺れている）位置、下の小さな四角は設定した中心
function drawMarkers(g, node, centers, grabbed) {
  g.setLineDash([3, 3])
  g.lineWidth = 1
  centers.forEach((hz, index) => {
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.beginPath(); g.moveTo(xOfHz(hz), 14); g.lineTo(xOfHz(hz), HEIGHT); g.stroke()
    g.fillStyle = COLORS.textBright
    g.fillText(FORMANTS[index].label, xOfHz(hz) - 6, 10)
    g.fillStyle = grabbed === FORMANTS[index] ? '#fff' : ACCENT
    g.fillRect(xOfHz(node.values[FORMANTS[index].id]) - 2, HEIGHT - 8, 4, 4)
  })
  g.setLineDash([])
}

export function createDisplay(node, context) {
  const { canvas, g } = createCanvas()
  const probes = BANDS.map(() => new BiquadFilterNode(context, { type: 'peaking' }))

  // ドラッグ中の山（FORMANTS の項目）。押した位置に一番近い山を動かす
  let grabbed = null
  const xOfEvent = (event) => event.clientX - canvas.getBoundingClientRect().left
  const moveGrabbed = (event) => node.setValue(grabbed.id, Math.round(hzOfX(xOfEvent(event))))
  const distanceTo = (param, x) => Math.abs(xOfHz(node.values[param.id]) - x)
  const nearestFormant = (x) => FORMANTS.reduce((best, param) => (distanceTo(param, x) < distanceTo(best, x) ? param : best))
  canvas.addEventListener('pointerdown', (event) => {
    grabbed = nearestFormant(xOfEvent(event))
    canvas.setPointerCapture(event.pointerId)
    moveGrabbed(event)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (grabbed) moveGrabbed(event)
  })
  const release = () => { grabbed = null }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  const draw = () => {
    g.clearRect(0, 0, WIDTH, HEIGHT)
    drawGrid(g)
    const centers = node.bandFrequencies(context.currentTime)
    drawCurve(g, responseCurve(probes, centers, node.values))
    drawMarkers(g, node, centers, grabbed)
  }
  return { element: canvas, draw }
}

// プラグインの画面。3 つの山が動く様子を描くディスプレイと、5 つのつまみ（Peak、Sharp、Drift、Rate、Mix）を持つ。
import { BANDS, PARAMS, trimDb } from './params.js'

const ACCENT = '#4fc3f7'
const SVG = 'http://www.w3.org/2000/svg'
const SWEEP = 270

const el = (tag, style, text) => {
  const node = document.createElement(tag)
  if (style) node.style.cssText = style
  if (text !== undefined) node.textContent = text
  return node
}
const svg = (tag, attrs) => {
  const node = document.createElementNS(SVG, tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value))
  return node
}

// つまみの位置（0〜1）と値の変換
const toValue = (param, t) => (param.log ? param.min * (param.max / param.min) ** t : param.min + (param.max - param.min) * t)
const toPosition = (param, value) => (param.log ? Math.log(value / param.min) / Math.log(param.max / param.min) : (value - param.min) / (param.max - param.min))
const format = (param, value) => (param.percent ? `${Math.round(value * 100)}%` : `${value.toFixed(param.digits)} ${param.unit}`)

// 角度（上が 0 度）の円周上の点
const point = (radius, degrees) => {
  const rad = (degrees * Math.PI) / 180
  return [32 + radius * Math.sin(rad), 32 - radius * Math.cos(rad)]
}
const arc = (radius, from, to) => {
  const [x1, y1] = point(radius, from)
  const [x2, y2] = point(radius, to)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function createKnob(param, node, id) {
  const wrap = el('div', 'display:grid;justify-items:center;gap:2px;width:64px;user-select:none')
  const view = svg('svg', { viewBox: '0 0 64 64', width: 60, height: 60, tabindex: 0, role: 'slider', 'aria-label': param.label })
  view.style.cssText = 'cursor:ns-resize;touch-action:none;outline:none'
  view.innerHTML = `
    <defs>
      <radialGradient id="${id}-body" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#6d7d89"/><stop offset="1" stop-color="#1e272e"/></radialGradient>
      <radialGradient id="${id}-cap" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#9aa8b3"/><stop offset="0.55" stop-color="#55646f"/><stop offset="1" stop-color="#2b363e"/></radialGradient>
      <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.55"/></filter>
    </defs>`
  const track = svg('path', { d: arc(27, -SWEEP / 2, SWEEP / 2), fill: 'none', stroke: '#0c1216', 'stroke-width': 4, 'stroke-linecap': 'round' })
  const fill = svg('path', { fill: 'none', stroke: ACCENT, 'stroke-width': 4, 'stroke-linecap': 'round' })
  const body = svg('circle', { cx: 32, cy: 32, r: 21, fill: `url(#${id}-body)`, filter: `url(#${id}-shadow)` })
  const cap = svg('circle', { cx: 32, cy: 32, r: 16.5, fill: `url(#${id}-cap)`, stroke: '#1a2227', 'stroke-width': 0.8 })
  const mark = svg('line', { x1: 32, y1: 32 - 7, x2: 32, y2: 32 - 15, stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round' })
  view.append(track, fill, body, cap, mark)

  const label = el('div', 'font:600 11px/1.2 Segoe UI,Roboto,sans-serif;letter-spacing:.08em;color:#cfd8dc;text-transform:uppercase', param.label)
  const readout = el('div', 'font:11px/1.2 Consolas,monospace;color:#8fb7cc')
  wrap.append(view, label, readout)

  let shown = Number.NaN
  let dragging = false
  const draw = (value) => {
    shown = value
    const t = Math.min(1, Math.max(0, toPosition(param, value)))
    const angle = -SWEEP / 2 + SWEEP * t
    mark.setAttribute('transform', `rotate(${angle} 32 32)`)
    fill.setAttribute('d', t > 0.002 ? arc(27, -SWEEP / 2, angle) : '')
    readout.textContent = format(param, value)
    view.setAttribute('aria-valuenow', String(value))
  }
  const set = (t) => {
    const value = toValue(param, Math.min(1, Math.max(0, t)))
    draw(value)
    node.setParameterValues({ [param.id]: { id: param.id, value, normalized: false } })
  }

  let startY = 0
  let startT = 0
  view.addEventListener('pointerdown', (event) => {
    dragging = true
    startY = event.clientY
    startT = toPosition(param, shown)
    view.setPointerCapture(event.pointerId)
    view.focus()
  })
  view.addEventListener('pointermove', (event) => {
    if (dragging) set(startT + (startY - event.clientY) / (event.shiftKey ? 600 : 160))
  })
  const stop = () => { dragging = false }
  view.addEventListener('pointerup', stop)
  view.addEventListener('pointercancel', stop)
  view.addEventListener('dblclick', () => set(toPosition(param, param.def)))
  view.addEventListener('wheel', (event) => {
    event.preventDefault()
    set(toPosition(param, shown) - event.deltaY / 1500)
  }, { passive: false })
  view.addEventListener('keydown', (event) => {
    const step = { ArrowUp: 0.02, ArrowRight: 0.02, ArrowDown: -0.02, ArrowLeft: -0.02 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    set(toPosition(param, shown) + step)
  })

  // ホストのオートメーションなど、画面の外で値が変わったときに追う
  const sync = () => {
    if (!dragging && node.values[param.id] !== shown) draw(node.values[param.id])
  }
  draw(node.values[param.id])
  return { element: wrap, sync }
}

// ディスプレイ。3 つの山の合成した周波数特性（dB）を、今の山の位置で描く
function createDisplay(node, context) {
  const width = 360
  const height = 124
  const canvas = el('canvas', `width:${width}px;height:${height}px;display:block;border-radius:6px;border:1px solid #05090c;background:#0b1a22`)
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = width * ratio
  canvas.height = height * ratio
  const g = canvas.getContext('2d')
  g.scale(ratio, ratio)

  const lowHz = 60
  const highHz = 8000
  const freqs = Float32Array.from({ length: 180 }, (_, i) => lowHz * (highHz / lowHz) ** (i / 179))
  const xOf = (hz) => (Math.log(hz / lowHz) / Math.log(highHz / lowHz)) * width
  const yOf = (db) => height * (0.5 - db / 40)
  const probes = BANDS.map(() => new BiquadFilterNode(context, { type: 'peaking' }))
  const mag = new Float32Array(freqs.length)
  const phase = new Float32Array(freqs.length)

  const draw = () => {
    const { peak, sharp, mix } = node.values
    g.clearRect(0, 0, width, height)
    g.lineWidth = 1
    g.font = '9px Consolas,monospace'
    g.fillStyle = '#4f6b7a'
    g.strokeStyle = '#17323f'
    for (const hz of [100, 200, 500, 1000, 2000, 5000]) {
      g.beginPath(); g.moveTo(xOf(hz) + 0.5, 0); g.lineTo(xOf(hz) + 0.5, height); g.stroke()
      g.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), xOf(hz) + 3, height - 4)
    }
    for (const db of [-12, 0, 12]) {
      g.strokeStyle = db === 0 ? '#245066' : '#17323f'
      g.beginPath(); g.moveTo(0, yOf(db) + 0.5); g.lineTo(width, yOf(db) + 0.5); g.stroke()
    }

    // 3 つの山の特性を掛け合わせ（複素数）、ドライと混ぜて、出力の補正を足す
    const centers = node.bandFrequencies(context.currentTime)
    const re = new Float64Array(freqs.length).fill(1)
    const im = new Float64Array(freqs.length)
    probes.forEach((probe, index) => {
      probe.frequency.value = centers[index]
      probe.gain.value = peak
      probe.Q.value = BANDS[index].q * sharp
      probe.getFrequencyResponse(freqs, mag, phase)
      for (let k = 0; k < freqs.length; k++) {
        const r = re[k] * mag[k] * Math.cos(phase[k]) - im[k] * mag[k] * Math.sin(phase[k])
        im[k] = re[k] * mag[k] * Math.sin(phase[k]) + im[k] * mag[k] * Math.cos(phase[k])
        re[k] = r
      }
    })
    const dry = 1 - mix * 0.6
    const curve = freqs.map((_, k) => 20 * Math.log10(Math.hypot(dry + mix * re[k], mix * im[k]) + 1e-9) + trimDb(peak))

    g.beginPath()
    curve.forEach((db, k) => (k === 0 ? g.moveTo(xOf(freqs[k]), yOf(db)) : g.lineTo(xOf(freqs[k]), yOf(db))))
    g.strokeStyle = ACCENT
    g.lineWidth = 2
    g.stroke()
    g.lineTo(width, height); g.lineTo(0, height); g.closePath()
    const fillGradient = g.createLinearGradient(0, 0, 0, height)
    fillGradient.addColorStop(0, 'rgba(79,195,247,0.30)')
    fillGradient.addColorStop(1, 'rgba(79,195,247,0.02)')
    g.fillStyle = fillGradient
    g.fill()

    g.setLineDash([3, 3])
    g.lineWidth = 1
    centers.forEach((hz, index) => {
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.beginPath(); g.moveTo(xOf(hz), 14); g.lineTo(xOf(hz), height); g.stroke()
      g.fillStyle = '#cfe8f5'
      g.fillText(`F${index + 1}`, xOf(hz) - 6, 10)
    })
    g.setLineDash([])
  }
  return { element: canvas, draw }
}

export function createGui(node, context) {
  const id = `fd${Math.random().toString(36).slice(2, 7)}`
  const root = el('div', [
    'box-sizing:border-box;width:392px;padding:14px 14px 12px;border-radius:12px',
    'background:linear-gradient(180deg,#34414b,#1b232a);border:1px solid #0b1014',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 18px rgba(0,0,0,.35)',
    'font-family:Segoe UI,Roboto,sans-serif;color:#cfd8dc',
  ].join(';'))

  const header = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:10px')
  header.append(
    el('span', `width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 8px ${ACCENT}`),
    el('span', 'font:700 13px/1 Segoe UI,Roboto,sans-serif;letter-spacing:.22em', 'FORMANT DRIFT'),
  )

  const display = createDisplay(node, context)
  const knobs = el('div', 'display:flex;justify-content:space-between;margin-top:12px;padding:10px 4px 2px;border-top:1px solid rgba(0,0,0,.45);box-shadow:0 -1px 0 rgba(255,255,255,.06)')
  const items = PARAMS.map((param) => createKnob(param, node, `${id}-${param.id}`))
  items.forEach((item) => knobs.append(item.element))
  root.append(header, display.element, knobs)

  // 画面が外されたら描画をやめる
  const frame = () => {
    if (!root.isConnected && frame.seen) return
    if (root.isConnected) frame.seen = true
    display.draw()
    items.forEach((item) => item.sync())
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return root
}

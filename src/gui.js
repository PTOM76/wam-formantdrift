// プラグインの画面。3 つの山が動く様子を描くディスプレイ（山はドラッグで動かせる）と、F1〜F3 の数値入力と Random ボタン、5 つのつまみ（Peak、Sharp、Drift、Rate、Mix）を持つ。
import { BANDS, FORMANTS, KNOBS, trimDb } from './params.js'

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
const format = (param, value) => (param.percent ? `${Math.round(value * 100)}%` : `${value.toFixed(param.digits)} ${param.unit}`.trim())

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
  const wrap = el('div', 'display:grid;justify-items:center;gap:2px;width:58px;user-select:none')
  const view = svg('svg', { viewBox: '0 0 64 64', width: 54, height: 54, tabindex: 0, role: 'slider', 'aria-label': param.label })
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
  // 整数のつまみは、1 つぶんの位置の幅
  const unit = param.step ? param.step / (param.max - param.min) : 0
  const set = (t) => {
    const raw = toValue(param, Math.min(1, Math.max(0, t)))
    const value = param.step ? Math.round(raw / param.step) * param.step : raw
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
    if (dragging) set(startT + (startY - event.clientY) / (param.step ? 300 : event.shiftKey ? 600 : 160))
  })
  const stop = () => { dragging = false }
  view.addEventListener('pointerup', stop)
  view.addEventListener('pointercancel', stop)
  view.addEventListener('dblclick', () => set(toPosition(param, param.def)))
  view.addEventListener('wheel', (event) => {
    event.preventDefault()
    set(toPosition(param, shown) - Math.sign(event.deltaY) * (unit || Math.abs(event.deltaY) / 1500))
  }, { passive: false })
  view.addEventListener('keydown', (event) => {
    const sign = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key]
    if (sign === undefined) return
    event.preventDefault()
    set(toPosition(param, shown) + sign * (unit || 0.02))
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

  // F1〜F3 の印をドラッグして、山の中心周波数を動かす（一番近い山を動かす）
  const hzAt = (event) => lowHz * (highHz / lowHz) ** (Math.min(1, Math.max(0, (event.clientX - canvas.getBoundingClientRect().left) / width)))
  let grabbed = null
  canvas.style.cursor = 'ew-resize'
  canvas.style.touchAction = 'none'
  canvas.addEventListener('pointerdown', (event) => {
    const x = event.clientX - canvas.getBoundingClientRect().left
    const distances = FORMANTS.map((param) => Math.abs(xOf(node.values[param.id]) - x))
    grabbed = FORMANTS[distances.indexOf(Math.min(...distances))]
    canvas.setPointerCapture(event.pointerId)
    node.setValue(grabbed.id, Math.round(hzAt(event)))
  })
  canvas.addEventListener('pointermove', (event) => {
    if (grabbed) node.setValue(grabbed.id, Math.round(hzAt(event)))
  })
  const release = () => { grabbed = null }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

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
      // 設定した中心（ゆらぎの真ん中）
      g.fillStyle = grabbed === FORMANTS[index] ? '#fff' : ACCENT
      g.fillRect(xOf(node.values[FORMANTS[index].id]) - 2, height - 8, 4, 4)
    })
    g.setLineDash([])
  }
  return { element: canvas, draw }
}

// F1〜F3 の数値入力と、ランダムに決め直すボタン
function createFormantRow(node) {
  const row = el('div', 'display:flex;align-items:center;gap:6px;margin-top:8px')
  const inputStyle = 'width:52px;padding:2px 4px;border:1px solid #05090c;border-radius:3px;background:#0b1a22;color:#cfe8f5;font:11px Consolas,monospace;text-align:right'
  const inputs = FORMANTS.map((param) => {
    const input = el('input', inputStyle)
    input.type = 'number'
    input.min = String(param.min)
    input.max = String(param.max)
    input.step = '1'
    input.setAttribute('aria-label', param.label)
    input.addEventListener('change', () => {
      node.setValue(param.id, Number(input.value))
      input.value = String(Math.round(node.values[param.id]))
    })
    const label = el('label', 'display:flex;align-items:center;gap:4px;font:600 11px/1 Segoe UI,Roboto,sans-serif;color:#cfd8dc')
    label.append(param.label, input, el('span', 'font:10px Consolas,monospace;color:#8fb7cc', 'Hz'))
    row.append(label)
    return { param, input }
  })
  const random = el('button', 'margin-left:auto;padding:3px 10px;border:1px solid #05090c;border-radius:3px;background:#2b363e;color:#cfd8dc;font:600 11px Segoe UI,Roboto,sans-serif;cursor:pointer', 'Random')
  random.addEventListener('click', () => node.randomize())
  row.append(random)
  const sync = () => {
    for (const { param, input } of inputs) {
      if (document.activeElement !== input) input.value = String(Math.round(node.values[param.id]))
    }
  }
  sync()
  return { element: row, sync }
}

export function createGui(node, context) {
  const id = `fd${Math.random().toString(36).slice(2, 7)}`
  const root = el('div', [
    // 外枠は角を丸めず、ホストの枠にそのまま収まるようにする
    'box-sizing:border-box;width:392px;padding:14px 14px 12px',
    'background:linear-gradient(180deg,#34414b,#1b232a)',
    'font-family:Segoe UI,Roboto,sans-serif;color:#cfd8dc',
  ].join(';'))

  const header = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:10px')
  header.append(
    el('span', `width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 8px ${ACCENT}`),
    el('span', 'font:700 13px/1 Segoe UI,Roboto,sans-serif;letter-spacing:.22em', 'FORMANT DRIFT'),
  )

  const display = createDisplay(node, context)
  const knobs = el('div', 'display:flex;justify-content:space-between;margin-top:12px;padding:10px 4px 2px;border-top:1px solid rgba(0,0,0,.45);box-shadow:0 -1px 0 rgba(255,255,255,.06)')
  const formants = createFormantRow(node)
  const items = KNOBS.map((param) => createKnob(param, node, `${id}-${param.id}`))
  items.forEach((item) => knobs.append(item.element))
  root.append(header, display.element, formants.element, knobs)

  // 画面が外されたら描画をやめる
  const frame = () => {
    if (!root.isConnected && frame.seen) return
    if (root.isConnected) frame.seen = true
    display.draw()
    formants.sync()
    items.forEach((item) => item.sync())
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return root
}

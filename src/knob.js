// 画面のつまみ（ドラッグ、ホイール、矢印キー、ダブルクリックで初期値）。
import { ACCENT, COLORS, el, svg } from './dom.js'
import { formatValue } from './params.js'

const SWEEP = 270 // つまみが回る角度の合計
const CENTER = 32 // 64 × 64 の描画の中心
const TRACK_RADIUS = 27

// 操作の細かさ
const DRAG_PIXELS = 160 // つまみ全体を動かすのに必要な縦のドラッグ量（px）
const DRAG_PIXELS_FINE = 600 // Shift を押している間
const DRAG_PIXELS_STEPPED = 300 // 整数のつまみ
const WHEEL_PIXELS = 1500
const KEY_STEP = 0.02 // 矢印キー 1 回ぶん（つまみ全体を 1 としたときの割合）

// つまみの位置（0〜1）と値の変換
const toValue = (param, t) => (param.log ? param.min * (param.max / param.min) ** t : param.min + (param.max - param.min) * t)
const toPosition = (param, value) => (param.log ? Math.log(value / param.min) / Math.log(param.max / param.min) : (value - param.min) / (param.max - param.min))
const clamp01 = (t) => Math.min(1, Math.max(0, t))

// 角度（上が 0 度）の円周上の点と、その間の円弧
const pointOnCircle = (radius, degrees) => {
  const rad = (degrees * Math.PI) / 180
  return [CENTER + radius * Math.sin(rad), CENTER - radius * Math.cos(rad)]
}
const arc = (radius, from, to) => {
  const [x1, y1] = pointOnCircle(radius, from)
  const [x2, y2] = pointOnCircle(radius, to)
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// つまみの見た目（SVG）。show(t) で、位置 t（0〜1）に合わせて印と円弧を動かす
function createKnobView(param, id) {
  const view = svg('svg', { viewBox: '0 0 64 64', width: 54, height: 54, tabindex: 0, role: 'slider', 'aria-label': param.label })
  view.style.cssText = 'cursor:ns-resize;touch-action:none;outline:none'
  view.innerHTML = `
    <defs>
      <radialGradient id="${id}-body" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#6d7d89"/><stop offset="1" stop-color="#1e272e"/></radialGradient>
      <radialGradient id="${id}-cap" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#9aa8b3"/><stop offset="0.55" stop-color="#55646f"/><stop offset="1" stop-color="#2b363e"/></radialGradient>
      <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.55"/></filter>
    </defs>`
  const track = svg('path', { d: arc(TRACK_RADIUS, -SWEEP / 2, SWEEP / 2), fill: 'none', stroke: '#0c1216', 'stroke-width': 4, 'stroke-linecap': 'round' })
  const fill = svg('path', { fill: 'none', stroke: ACCENT, 'stroke-width': 4, 'stroke-linecap': 'round' })
  const body = svg('circle', { cx: CENTER, cy: CENTER, r: 21, fill: `url(#${id}-body)`, filter: `url(#${id}-shadow)` })
  const cap = svg('circle', { cx: CENTER, cy: CENTER, r: 16.5, fill: `url(#${id}-cap)`, stroke: '#1a2227', 'stroke-width': 0.8 })
  const mark = svg('line', { x1: CENTER, y1: CENTER - 7, x2: CENTER, y2: CENTER - 15, stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round' })
  view.append(track, fill, body, cap, mark)

  const show = (t) => {
    const angle = -SWEEP / 2 + SWEEP * t
    mark.setAttribute('transform', `rotate(${angle} ${CENTER} ${CENTER})`)
    fill.setAttribute('d', t > 0.002 ? arc(TRACK_RADIUS, -SWEEP / 2, angle) : '')
  }
  return { view, show }
}

export function createKnob(param, node, id) {
  const wrap = el('div', 'display:grid;justify-items:center;gap:2px;width:58px;user-select:none')
  const { view, show } = createKnobView(param, id)
  const label = el('div', `font:600 11px/1.2 Segoe UI,Roboto,sans-serif;letter-spacing:.08em;color:${COLORS.text};text-transform:uppercase`, param.label)
  const readout = el('div', `font:11px/1.2 Consolas,monospace;color:${COLORS.textDim}`)
  wrap.append(view, label, readout)

  let shown = Number.NaN // 画面に出している値
  let dragging = false

  const draw = (value) => {
    shown = value
    show(clamp01(toPosition(param, value)))
    readout.textContent = formatValue(param, value)
    view.setAttribute('aria-valuenow', String(value))
  }
  // 位置 t（0〜1）に動かす。画面とエフェクト本体の両方へ反映する
  const moveTo = (t) => {
    const raw = toValue(param, clamp01(t))
    const value = param.step ? Math.round(raw / param.step) * param.step : raw
    draw(value)
    node.setParameterValues({ [param.id]: { id: param.id, value, normalized: false } })
  }
  // ホイールと矢印キーの 1 回ぶんの動き。整数のつまみは、1 つぶんの位置の幅
  const stepSize = (fallback) => (param.step ? param.step / (param.max - param.min) : fallback)

  // つまみ全体を動かすのに必要なドラッグ量（px）。整数のつまみは粗く、Shift を押している間は細かく
  const dragPixels = (event) => {
    if (param.step) return DRAG_PIXELS_STEPPED
    return event.shiftKey ? DRAG_PIXELS_FINE : DRAG_PIXELS
  }

  // ドラッグ（上へで増える）
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
    if (!dragging) return
    moveTo(startT + (startY - event.clientY) / dragPixels(event))
  })
  const stopDrag = () => { dragging = false }
  view.addEventListener('pointerup', stopDrag)
  view.addEventListener('pointercancel', stopDrag)

  view.addEventListener('dblclick', () => moveTo(toPosition(param, param.def)))
  view.addEventListener('wheel', (event) => {
    event.preventDefault()
    moveTo(toPosition(param, shown) - Math.sign(event.deltaY) * stepSize(Math.abs(event.deltaY) / WHEEL_PIXELS))
  }, { passive: false })
  view.addEventListener('keydown', (event) => {
    const direction = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key]
    if (direction === undefined) return
    event.preventDefault()
    moveTo(toPosition(param, shown) + direction * stepSize(KEY_STEP))
  })

  // ホストのオートメーションなど、画面の外で値が変わったときに追う
  const sync = () => {
    if (!dragging && node.values[param.id] !== shown) draw(node.values[param.id])
  }
  draw(node.values[param.id])
  return { element: wrap, sync }
}

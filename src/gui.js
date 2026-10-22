// プラグインの画面。3 つの山が動く様子を描くディスプレイ（山はドラッグで動かせる）と、F1〜F3 の数値入力と Random ボタン、5 つのつまみ（Peak、Sharp、Drift、Rate、Mix）を持つ。
import { createDisplay } from './display.js'
import { ACCENT, COLORS, el } from './dom.js'
import { createKnob } from './knob.js'
import { FORMANTS, KNOBS } from './params.js'

const INPUT_STYLE = `width:52px;padding:2px 4px;border:1px solid ${COLORS.border};border-radius:3px;background:${COLORS.screen};color:${COLORS.textBright};font:11px Consolas,monospace;text-align:right`
const RANDOM_STYLE = `margin-left:auto;padding:3px 10px;border:1px solid ${COLORS.border};border-radius:3px;background:${COLORS.button};color:${COLORS.text};font:600 11px Segoe UI,Roboto,sans-serif;cursor:pointer`

// 山 1 つぶんの「F1 [ 数値 ] Hz」。入力が確定したら値を反映し、範囲に丸められた値を表示し直す
function createFormantInput(param, node) {
  const input = el('input', INPUT_STYLE)
  input.type = 'number'
  input.min = String(param.min)
  input.max = String(param.max)
  input.step = '1'
  input.setAttribute('aria-label', param.label)
  const showValue = () => { input.value = String(Math.round(node.values[param.id])) }
  input.addEventListener('change', () => {
    node.setValue(param.id, Number(input.value))
    showValue()
  })

  const label = el('label', `display:flex;align-items:center;gap:4px;font:600 11px/1 Segoe UI,Roboto,sans-serif;color:${COLORS.text}`)
  label.append(param.label, input, el('span', `font:10px Consolas,monospace;color:${COLORS.textDim}`, 'Hz'))
  // 入力中は、ディスプレイのドラッグなどによる書き換えで邪魔しない
  const sync = () => { if (document.activeElement !== input) showValue() }
  sync()
  return { element: label, sync }
}

// F1〜F3 の数値入力と、ランダムに決め直すボタン
function createFormantRow(node) {
  const row = el('div', 'display:flex;align-items:center;gap:6px;margin-top:8px')
  const inputs = FORMANTS.map((param) => createFormantInput(param, node))
  const random = el('button', RANDOM_STYLE, 'Random')
  random.addEventListener('click', () => node.randomize())
  row.append(...inputs.map((input) => input.element), random)
  return { element: row, sync: () => inputs.forEach((input) => input.sync()) }
}

export function createGui(node, context) {
  const id = `fd${Math.random().toString(36).slice(2, 7)}`
  const root = el('div', [
    // 外枠は角を丸めず、ホストの枠にそのまま収まるようにする
    'box-sizing:border-box;width:392px;padding:14px 14px 12px',
    'background:linear-gradient(180deg,#34414b,#1b232a)',
    `font-family:Segoe UI,Roboto,sans-serif;color:${COLORS.text}`,
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

  // 毎フレーム描き直す。ホストの画面に入ったあとで外されたら、描画をやめる
  let wasAttached = false
  const frame = () => {
    if (root.isConnected) wasAttached = true
    else if (wasAttached) return
    display.draw()
    formants.sync()
    items.forEach((item) => item.sync())
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return root
}

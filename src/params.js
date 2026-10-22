// フォルマントの山の動く範囲と、つまみの定義（エフェクト本体と画面で共有する）。

// 3 つの山の動く範囲（Hz）。男声から女声までの母音のフォルマント（F1、F2、F3）をおおまかにおさえている
export const BANDS = [
  { min: 280, max: 900, q: 6 },
  { min: 800, max: 2700, q: 7 },
  { min: 2300, max: 3600, q: 8 },
]

// log: つまみの位置と値を対数で結ぶ（速さのように、小さい側を細かく動かしたいもの）
export const PARAMS = [
  { id: 'peak', label: 'Peak', min: 0, max: 24, def: 12, unit: 'dB', digits: 1 },
  { id: 'sharp', label: 'Sharp', min: 0.3, max: 3, def: 1, unit: '×', digits: 2, log: true },
  { id: 'depth', label: 'Drift', min: 0, max: 1, def: 0.8, percent: true },
  { id: 'rate', label: 'Rate', min: 0.02, max: 3, def: 0.3, unit: 'Hz', digits: 2, log: true },
  { id: 'mix', label: 'Mix', min: 0, max: 1, def: 1, percent: true },
  // step: 整数のつまみ。ゆらぎの乱数の種で、同じ値なら毎回同じ動きになる
  { id: 'seed', label: 'Seed', min: 0, max: 99, def: 0, digits: 0, unit: '', step: 1 },
]

export const paramById = Object.fromEntries(PARAMS.map((param) => [param.id, param]))

// 山の高さに応じて出力を下げる量（dB）。山が増えると音量が上がるので補う
export const trimDb = (peak) => -0.65 * peak

// シード付きの乱数（mulberry32）。0 以上 1 未満の値を返す関数を作る
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 山ごと（band の番号）のゆらぎの元になる乱数の点（-1〜1）。seed と山の番号が同じなら、いつも同じ値になる
export function seededPoints(seed, band, length) {
  const random = mulberry32(Math.imul(Math.round(seed) + 1, 0x9e3779b1) ^ Math.imul(band + 1, 0x85ebca6b))
  random() // 最初の値は種との相関が強いので捨てる
  return Array.from({ length }, () => random() * 2 - 1)
}

// depth 1 で、山が動ける範囲（対数）の端から端まで動くセント数の半分
export const driftCents = (band, depth) => depth * 600 * Math.log2(band.max / band.min)

// WAM2 のパラメーター情報（getParameterInfo が返す形）
export const parameterInfo = (param) => ({
  id: param.id,
  label: param.label,
  type: param.step ? 'int' : 'float',
  defaultValue: param.def,
  minValue: param.min,
  maxValue: param.max,
  discreteStep: param.step ?? 0,
  exponent: 0,
  choices: [],
  units: param.percent ? '%' : param.unit ?? '',
  normalize: (value) => (value - param.min) / (param.max - param.min),
  denormalize: (position) => param.min + position * (param.max - param.min),
  valueString: (value) => (param.percent ? `${Math.round(value * 100)}%` : `${value.toFixed(param.digits)} ${param.unit}`.trim()),
})

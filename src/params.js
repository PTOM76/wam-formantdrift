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
]

export const paramById = Object.fromEntries(PARAMS.map((param) => [param.id, param]))

// 山の高さに応じて出力を下げる量（dB）。山が増えると音量が上がるので補う
export const trimDb = (peak) => -0.65 * peak

// depth 1 で、山が動ける範囲（対数）の端から端まで動くセント数の半分
export const driftCents = (band, depth) => depth * 600 * Math.log2(band.max / band.min)

// WAM2 のパラメーター情報（getParameterInfo が返す形）
export const parameterInfo = (param) => ({
  id: param.id,
  label: param.label,
  type: 'float',
  defaultValue: param.def,
  minValue: param.min,
  maxValue: param.max,
  discreteStep: 0,
  exponent: 0,
  choices: [],
  units: param.percent ? '%' : param.unit ?? '',
  normalize: (value) => (value - param.min) / (param.max - param.min),
  denormalize: (position) => param.min + position * (param.max - param.min),
  valueString: (value) => (param.percent ? `${Math.round(value * 100)}%` : `${value.toFixed(param.digits)} ${param.unit}`),
})

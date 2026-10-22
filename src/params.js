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
  // 山の中心周波数（画面のつまみの列には出さず、ディスプレイと数値入力で操作する）。値は保存されるので、いつも同じ音になる
  { id: 'f1', label: 'F1', min: BANDS[0].min, max: BANDS[0].max, def: Math.round(Math.sqrt(BANDS[0].min * BANDS[0].max)), unit: 'Hz', digits: 0, log: true, band: 0 },
  { id: 'f2', label: 'F2', min: BANDS[1].min, max: BANDS[1].max, def: Math.round(Math.sqrt(BANDS[1].min * BANDS[1].max)), unit: 'Hz', digits: 0, log: true, band: 1 },
  { id: 'f3', label: 'F3', min: BANDS[2].min, max: BANDS[2].max, def: Math.round(Math.sqrt(BANDS[2].min * BANDS[2].max)), unit: 'Hz', digits: 0, log: true, band: 2 },
]

// つまみの列に出すもの
export const KNOBS = PARAMS.filter((param) => param.band === undefined)
export const FORMANTS = PARAMS.filter((param) => param.band !== undefined)

export const paramById = Object.fromEntries(PARAMS.map((param) => [param.id, param]))

// 山の高さに応じて出力を下げる量（dB）。山が増えると音量が上がるので補う
export const trimDb = (peak) => -0.65 * peak

// 山ごとのゆらぎの動き。速さの比と位相をずらして、3 つの山が同じ動きにならないようにする（乱数は使わない）
export const WOBBLE = [
  { ratio: 1, phase: 0 },
  { ratio: 1.31, phase: 0.27 },
  { ratio: 1.73, phase: 0.61 },
]

// 位相（周期の数）での、山の動き（-1〜1）
export const wobbleAt = (index, cycles) => Math.sin(2 * Math.PI * (WOBBLE[index].ratio * cycles + WOBBLE[index].phase))

// 山の中心を、動ける範囲の中でランダムに選ぶ（対数で一様）。押したときだけ使い、結果は普通の値として保存される
export const randomFormants = (random = Math.random) => Object.fromEntries(FORMANTS.map((param) => [param.id, Math.round(param.min * (param.max / param.min) ** random())]))

// depth 1 で、山が中心から動くセント数（動ける範囲の幅の半分）
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

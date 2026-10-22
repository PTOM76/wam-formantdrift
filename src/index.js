// フォルマント・ドリフト（WAM2）。声のフォルマントにあたる 3 つの山が、ゆっくりランダムに揺らぎながら動いていく。
import { WebAudioModule } from '@webaudiomodules/sdk'
import { CompositeAudioNode, ParamMgrFactory } from '@webaudiomodules/sdk-parammgr'
import descriptor from '../descriptor.json'
import { createGui } from './gui.js'
import { BANDS, PARAMS, driftCents, paramById, parameterInfo, trimDb } from './params.js'

// -1〜1 の値を 1 秒に 1 つランダムに選び、間をなめらかにつないだ波形を作る。端をそろえてあるのでループしても切れ目がない。
// 再生の速さ（playbackRate）がそのまま「1 秒に何回目標を変えるか」になる
export const DRIFT_SECONDS = 24
const DRIFT_RATE = 8000

function driftBuffer(points, seconds = DRIFT_SECONDS, sampleRate = DRIFT_RATE) {
  const buffer = new AudioBuffer({ length: seconds * sampleRate, sampleRate, numberOfChannels: 1 })
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const position = i / sampleRate
    const index = Math.floor(position)
    const t = position - index
    const ease = t * t * (3 - 2 * t)
    data[i] = points[index] + (points[(index + 1) % seconds] - points[index]) * ease
  }
  return buffer
}

// 乱数の点から、位置（秒）での値を求める。画面で山の位置を描くときに、音と同じ値を使う
export function driftAt(points, position) {
  const seconds = points.length
  const wrapped = ((position % seconds) + seconds) % seconds
  const index = Math.floor(wrapped)
  const t = wrapped - index
  return points[index] + (points[(index + 1) % seconds] - points[index]) * (t * t * (3 - 2 * t))
}

class FormantDriftNode extends CompositeAudioNode {
  constructor(context, options) {
    super(context, options)
    this.audio = context
    // つまみの今の値。画面が読む
    this.values = Object.fromEntries(PARAMS.map((param) => [param.id, param.def]))
    // ゆらぎの位置（秒）を、速さが変わっても追えるように覚えておく
    this.phase0 = 0
    this.time0 = context.currentTime

    this.dry = new GainNode(context)
    this.wet = new GainNode(context)
    this.out = new GainNode(context)
    this.filters = BANDS.map((band) => new BiquadFilterNode(context, {
      type: 'peaking',
      frequency: Math.sqrt(band.min * band.max),
      Q: band.q,
      gain: 12,
    }))

    // このノード自身（GainNode）が入力。外への connect は _output に回るので、内部への接続は GainNode の connect を直接呼ぶ
    GainNode.prototype.connect.call(this, this.dry)
    GainNode.prototype.connect.call(this, this.filters[0])
    this.dry.connect(this.out)

    // 山ごとのゆらぎ。ループする乱数の波形を、周波数のずれ（detune、セント）に直接つなぐ（タイマーを使わないので、書き出しのような非リアルタイムの処理でも同じに動く）
    this.points = BANDS.map(() => Array.from({ length: DRIFT_SECONDS }, () => Math.random() * 2 - 1))
    this.sources = this.filters.map((filter, index) => {
      const source = new AudioBufferSourceNode(context, { buffer: driftBuffer(this.points[index]), loop: true, playbackRate: this.values.rate })
      const amount = new GainNode(context, { gain: 0 })
      source.connect(amount).connect(filter.detune)
      source.start()
      return { source, amount }
    })
    this.filters.forEach((filter, index) => {
      if (index > 0) this.filters[index - 1].connect(filter)
    })
    this.filters[this.filters.length - 1].connect(this.wet).connect(this.out)
    this._output = this.out
  }

  // つまみごとの音への反映のしかた
  applyParam(id, value) {
    switch (id) {
      case 'peak':
        this.filters.forEach((filter) => { filter.gain.value = value })
        this.out.gain.value = 10 ** (trimDb(value) / 20)
        break
      case 'sharp':
        this.filters.forEach((filter, index) => { filter.Q.value = BANDS[index].q * value })
        break
      case 'depth':
        this.sources.forEach(({ amount }, index) => { amount.gain.value = driftCents(BANDS[index], value) })
        break
      case 'rate':
        this.sources.forEach(({ source }) => { source.playbackRate.value = value })
        break
      case 'mix':
        this.dry.gain.value = 1 - value * 0.6
        this.wet.gain.value = value
        break
    }
  }

  // つまみの値を変える。値はここで持つ（パラメーターマネージャーの値は、音を鳴らしていない OfflineAudioContext では更新されず、
  // 読むと古い値や最小値だけずれた値が返るので、読み書きともこのノードで行う）
  setValue(id, raw) {
    const param = paramById[id]
    if (!param || !Number.isFinite(raw)) return
    const value = Math.min(param.max, Math.max(param.min, raw))
    // rate は、変える前の速さで位置を進めてから新しい速さにする
    if (id === 'rate') {
      this.phase0 = this.phaseAt(this.audio.currentTime)
      this.time0 = this.audio.currentTime
    }
    this.values[id] = value
    this.applyParam(id, value)
  }

  // WAM2 のパラメーターの API（パラメーターマネージャーを通さず、このノードで答える）
  async setParameterValues(updates) {
    for (const [id, update] of Object.entries(updates)) {
      const param = paramById[id]
      if (!param) continue
      this.setValue(id, update.normalized ? param.min + update.value * (param.max - param.min) : update.value)
    }
  }

  async getParameterValues(normalized = false, ...ids) {
    const wanted = ids.length ? ids : PARAMS.map((param) => param.id)
    return Object.fromEntries(wanted.filter((id) => paramById[id]).map((id) => {
      const param = paramById[id]
      const value = normalized ? (this.values[id] - param.min) / (param.max - param.min) : this.values[id]
      return [id, { id, value, normalized }]
    }))
  }

  async getParameterInfo(...ids) {
    const wanted = ids.length ? ids : PARAMS.map((param) => param.id)
    return Object.fromEntries(wanted.filter((id) => paramById[id]).map((id) => [id, parameterInfo(paramById[id])]))
  }

  async getState() {
    return { ...this.values }
  }

  async setState(state) {
    for (const [id, value] of Object.entries(state ?? {})) this.setValue(id, Number(value))
  }

  // 時刻つきの変更（オートメーション）は、届いた時点で値を変える
  async scheduleEvents(...events) {
    for (const event of events) {
      if (event.type === 'wam-automation' && event.data) this.setValue(event.data.id, event.data.normalized ? paramById[event.data.id].min + event.data.value * (paramById[event.data.id].max - paramById[event.data.id].min) : event.data.value)
    }
  }

  setup(wamNode) {
    this._wamNode = wamNode
    PARAMS.forEach((param) => this.setValue(param.id, param.def))
  }

  // time（秒）でのゆらぎの位置（秒）。再生の速さを時間で足し合わせる
  phaseAt(time) {
    return this.phase0 + (time - this.time0) * this.values.rate
  }

  // time（秒）での、山ごとの中心周波数（Hz）。音と同じ乱数から求めるので、画面の山は音と一緒に動く
  bandFrequencies(time) {
    const phase = this.phaseAt(time)
    return BANDS.map((band, index) => {
      const cents = driftAt(this.points[index], phase) * driftCents(band, this.values.depth)
      return Math.sqrt(band.min * band.max) * 2 ** (cents / 1200)
    })
  }

  destroy() {
    this.sources.forEach(({ source }) => source.stop())
    return super.destroy()
  }
}

export default class FormantDrift extends WebAudioModule {
  constructor(groupId, audioContext) {
    super(groupId, audioContext)
    // SDK の既定の名前（WebAudioModule_ とクラス名、WebAudioModuleVendor）をやめて、descriptor.json の内容にする
    Object.assign(this._descriptor, descriptor)
  }

  async createAudioNode(initialState) {
    const node = new FormantDriftNode(this.audioContext)
    // パラメーターマネージャーは、イベントの受け渡しや破棄などの土台として使う（つまみの値の読み書きはノード自身が行う）
    const paramMgr = await ParamMgrFactory.create(this, {
      internalParamsConfig: Object.fromEntries(PARAMS.map((param) => [param.id, { defaultValue: param.def, minValue: param.min, maxValue: param.max }])),
    })
    node.setup(paramMgr)
    if (initialState) await node.setState(initialState)
    return node
  }

  async createGui() {
    return createGui(this.audioNode, this.audioContext)
  }
}

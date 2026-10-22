// フォルマント・ドリフト（WAM2）。声のフォルマントにあたる 3 つの山が、ゆっくりランダムに揺らぎながら動いていく。
import { WebAudioModule } from '@webaudiomodules/sdk'
import { CompositeAudioNode, ParamMgrFactory } from '@webaudiomodules/sdk-parammgr'

// 3 つの山の動く範囲（Hz）。男声から女声までの母音のフォルマント（F1、F2、F3）をおおまかにおさえている
const BANDS = [
  { min: 280, max: 900, q: 6 },
  { min: 800, max: 2700, q: 7 },
  { min: 2300, max: 3600, q: 8 },
]

// -1〜1 の値を 1 秒に 1 つランダムに選び、間をなめらかにつないだ波形を作る。端をそろえてあるのでループしても切れ目がない。
// 再生の速さ（playbackRate）がそのまま「1 秒に何回目標を変えるか」になる
function driftBuffer(context, seconds = 24, sampleRate = 8000) {
  const points = Array.from({ length: seconds }, () => Math.random() * 2 - 1)
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

const LABELS = { peak: 'Peak', sharp: 'Sharp', depth: 'Drift', rate: 'Rate', mix: 'Mix' }

class FormantDriftNode extends CompositeAudioNode {
  constructor(context, options) {
    super(context, options)
    this.audio = context
    this.rate = 0.3

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
    this.sources = this.filters.map((filter) => {
      const source = new AudioBufferSourceNode(context, { buffer: driftBuffer(context), loop: true, playbackRate: this.rate })
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

  // 山の高さ（dB）、鋭さ、ドライとウェットの割合を AudioParam と同じ形で受け取る
  get paramConfig() {
    return {
      peak: { defaultValue: 12, minValue: 0, maxValue: 24, onChange: (value) => {
        this.filters.forEach((f) => { f.gain.value = value })
        this.out.gain.value = 10 ** (-0.65 * value / 20)
      } },
      sharp: { defaultValue: 1, minValue: 0.3, maxValue: 3, onChange: (value) => this.filters.forEach((f, i) => { f.Q.value = BANDS[i].q * value }) },
      depth: { defaultValue: 0.8, minValue: 0, maxValue: 1, onChange: (value) => this.setDepth(value) },
      rate: { defaultValue: 0.3, minValue: 0.02, maxValue: 3, onChange: (value) => this.sources.forEach(({ source }) => { source.playbackRate.value = value }) },
      mix: { defaultValue: 1, minValue: 0, maxValue: 1, onChange: (value) => this.setMix(value) },
    }
  }

  setMix(value) {
    this.dry.gain.value = 1 - value * 0.6
    this.wet.gain.value = value
  }

  setup(wamNode) {
    this._wamNode = wamNode
    this.setMix(1)
  }

  // 山が動く範囲（対数）の半分を、depth に応じたセントにして detune に掛ける
  setDepth(value) {
    this.sources.forEach(({ amount }, index) => {
      const { min, max } = BANDS[index]
      amount.gain.value = value * 600 * Math.log2(max / min)
    })
  }

  destroy() {
    this.sources.forEach(({ source }) => source.stop())
    return super.destroy()
  }
}

export default class FormantDrift extends WebAudioModule {
  async createAudioNode(initialState) {
    const node = new FormantDriftNode(this.audioContext)
    const paramMgr = await ParamMgrFactory.create(this, { internalParamsConfig: node.paramConfig })
    node.setup(paramMgr)
    if (initialState) await node.setState(initialState)
    return node
  }

  async createGui() {
    const root = document.createElement('div')
    root.style.cssText = 'font:12px sans-serif;padding:8px;display:grid;gap:6px;min-width:200px'
    const info = this.audioNode.getParameterInfo()
    for (const [id, param] of Object.entries(info)) {
      const label = document.createElement('label')
      label.style.cssText = 'display:grid;grid-template-columns:70px 1fr;align-items:center;gap:8px'
      label.append(LABELS[id] ?? id)
      const input = document.createElement('input')
      input.type = 'range'
      input.min = String(param.minValue)
      input.max = String(param.maxValue)
      input.step = 'any'
      input.value = String(param.defaultValue)
      input.oninput = () => this.audioNode.setParameterValues({ [id]: { id, value: Number(input.value), normalized: false } })
      label.append(input)
      root.append(label)
    }
    return root
  }
}

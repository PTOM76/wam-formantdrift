// フォルマント・ドリフトの音声ノード。3 つのピーキングフィルターと、その周波数を揺らす正弦波を持ち、つまみの値もここで持つ。
import { CompositeAudioNode } from '@webaudiomodules/sdk-parammgr'
import { BANDS, FORMANTS, PARAMS, WOBBLE, denormalize, driftCents, dryGain, normalize, paramById, parameterInfo, randomFormants, trimDb, wobbleAt } from './params.js'

// 山ごとの揺れ（正弦波）の波形。位相をずらしてあるので、3 つの山が同じ動きにならない
function wobbleWave(context, phase) {
  return new PeriodicWave(context, { real: [0, Math.sin(2 * Math.PI * phase)], imag: [0, Math.cos(2 * Math.PI * phase)] })
}

// 指定された id のうち存在するもの（指定がなければすべて）
const knownIds = (ids) => (ids.length ? ids : PARAMS.map((param) => param.id)).filter((id) => paramById[id])

export class FormantDriftNode extends CompositeAudioNode {
  constructor(context, options) {
    super(context, options)
    this.audio = context
    // つまみの今の値。画面が読む
    this.values = Object.fromEntries(PARAMS.map((param) => [param.id, param.def]))
    // ゆらぎの位置（周期の数）を、速さが変わっても追えるように覚えておく
    this.phase0 = 0
    this.time0 = context.currentTime

    this.dry = new GainNode(context)
    this.wet = new GainNode(context)
    this.out = new GainNode(context)
    // 山ごとのピーキングフィルター（F1 → F2 → F3 の順に直列につなぐ）
    this.filters = BANDS.map((band) => new BiquadFilterNode(context, {
      type: 'peaking',
      frequency: Math.sqrt(band.min * band.max),
      Q: band.q,
      gain: paramById.peak.def,
    }))
    this.wobbles = this.createWobbles()
    this.startWobbles()

    // このノード自身（GainNode）が入力。外への connect は _output に回るので、内部への接続は GainNode の connect を直接呼ぶ
    GainNode.prototype.connect.call(this, this.dry)
    GainNode.prototype.connect.call(this, this.filters[0])
    this.dry.connect(this.out)
    this.filters.reduce((previous, filter) => previous.connect(filter))
    this.filters[this.filters.length - 1].connect(this.wet).connect(this.out)
    this._output = this.out
  }

  // 山ごとの揺れ幅（amount）を、周波数のずれ（detune、セント）に直接つなぐ。揺れの音源（source）は startWobbles で作る
  // （タイマーを使わないので、書き出しのような非リアルタイムの処理でも同じに動く）
  createWobbles() {
    return WOBBLE.map((_, index) => {
      const amount = new GainNode(this.audio, { gain: 0 })
      amount.connect(this.filters[index].detune)
      return { amount, source: null }
    })
  }

  // 揺れの音源を、今の位相（phase0、time0）から作り直して鳴らし始める。山ごとに位相をずらした正弦波にする
  startWobbles() {
    this.wobbles.forEach((wobble, index) => {
      const { ratio, phase } = WOBBLE[index]
      wobble.source?.stop()
      wobble.source?.disconnect()
      const source = new OscillatorNode(this.audio, { frequency: ratio * this.values.rate })
      source.setPeriodicWave(wobbleWave(this.audio, phase + ratio * this.phase0))
      source.connect(wobble.amount)
      source.start()
      wobble.source = source
    })
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
        this.wobbles.forEach(({ amount }, index) => { amount.gain.value = driftCents(BANDS[index], value) })
        break
      case 'rate':
        this.wobbles.forEach(({ source }, index) => { source.frequency.value = WOBBLE[index].ratio * value })
        break
      case 'mix':
        this.dry.gain.value = dryGain(value)
        this.wet.gain.value = value
        break
      default:
        // F1〜F3 は、対応する山のフィルターの中心周波数
        if (paramById[id].band !== undefined) this.filters[paramById[id].band].frequency.value = value
    }
  }

  // つまみの値を変える。値はここで持つ（パラメーターマネージャーの値は、音を鳴らしていない OfflineAudioContext では更新されず、
  // 読むと古い値や最小値だけずれた値が返るので、読み書きともこのノードで行う）
  setValue(id, raw) {
    const param = paramById[id]
    if (!param || !Number.isFinite(raw)) return
    const stepped = param.step ? Math.round(raw / param.step) * param.step : raw
    const value = Math.min(param.max, Math.max(param.min, stepped))
    // rate は、変える前の速さで位置を進めてから新しい速さにする
    if (id === 'rate') {
      this.phase0 = this.phaseAt(this.audio.currentTime)
      this.time0 = this.audio.currentTime
    }
    this.values[id] = value
    this.applyParam(id, value)
  }

  // { value, normalized } の形の変更を反映する
  setUpdate(id, { value, normalized }) {
    this.setValue(id, normalized ? denormalize(paramById[id], value) : value)
  }

  // WAM2 のパラメーターの API（パラメーターマネージャーを通さず、このノードで答える）
  async setParameterValues(updates) {
    for (const [id, update] of Object.entries(updates)) {
      if (paramById[id]) this.setUpdate(id, update)
    }
  }

  async getParameterValues(normalized = false, ...ids) {
    return Object.fromEntries(knownIds(ids).map((id) => {
      const param = paramById[id]
      const value = normalized ? normalize(param, this.values[id]) : this.values[id]
      return [id, { id, value, normalized }]
    }))
  }

  async getParameterInfo(...ids) {
    return Object.fromEntries(knownIds(ids).map((id) => [id, parameterInfo(paramById[id])]))
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
      if (event.type === 'wam-automation' && paramById[event.data?.id]) this.setUpdate(event.data.id, event.data)
      if (event.type === 'wam-transport' && event.data) this.syncTransport(event.data)
    }
  }

  // ホストの再生位置（wam-transport）に、揺れの位相を合わせる。
  // 位置 0 の揺れは常に同じ位相から始まるので、同じ位置を再生すれば、再生のたびに（書き出しでも）同じ揺れになる
  syncTransport({ currentBar, currentBarStarted, tempo, timeSigNumerator = 4, timeSigDenominator = 4 }) {
    if (![currentBar, currentBarStarted, tempo].every(Number.isFinite) || tempo <= 0) return
    const barSeconds = (60 / tempo) * timeSigNumerator * (4 / timeSigDenominator)
    const zero = currentBarStarted - currentBar * barSeconds // 位置 0 にあたる context の時刻
    const now = this.audio.currentTime
    this.time0 = now
    this.phase0 = (now - zero) * this.values.rate
    this.startWobbles()
  }

  setup(wamNode) {
    this._wamNode = wamNode
    PARAMS.forEach((param) => this.setValue(param.id, param.def))
  }

  // time（秒）でのゆらぎの位置（周期の数）。再生の速さを時間で足し合わせる
  phaseAt(time) {
    return this.phase0 + (time - this.time0) * this.values.rate
  }

  // time（秒）での、山ごとの中心周波数（Hz）。音と同じ式で求めるので、画面の山は音と一緒に動く
  bandFrequencies(time) {
    const phase = this.phaseAt(time)
    return BANDS.map((band, index) => this.values[FORMANTS[index].id] * 2 ** ((wobbleAt(index, phase) * driftCents(band, this.values.depth)) / 1200))
  }

  // 3 つの山の中心を、動ける範囲の中でランダムに選び直す（押したときだけ。結果は普通の値になる）
  randomize() {
    for (const [id, value] of Object.entries(randomFormants())) this.setValue(id, value)
  }

  destroy() {
    this.wobbles.forEach(({ source }) => source.stop())
    return super.destroy()
  }
}

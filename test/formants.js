// F1〜F3 を同じ値にすれば同じ音になり、違う値なら違う音になることと、Random ボタンの結果が範囲内であることを確かめるページ。
import { initializeWamHost } from '@webaudiomodules/sdk'
import FormantDrift from '../dist/index.js'

async function render(f2) {
  const sampleRate = 44100
  const context = new OfflineAudioContext(1, sampleRate * 4, sampleRate)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  await wam.audioNode.setParameterValues({
    f2: { id: 'f2', value: f2, normalized: false },
    rate: { id: 'rate', value: 1, normalized: false },
  })
  const source = new OscillatorNode(context, { type: 'sawtooth', frequency: 130 })
  source.connect(wam.audioNode)
  wam.audioNode.connect(context.destination)
  source.start()
  return (await context.startRendering()).getChannelData(0)
}

// 再生位置（wam-transport）を渡して描く。startedAt は、位置 0 にあたる context の時刻（負なら、途中から始めたことになる）
async function renderFrom(startedAt, seconds) {
  const sampleRate = 44100
  const context = new OfflineAudioContext(1, sampleRate * seconds, sampleRate)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  await wam.audioNode.setParameterValues({ rate: { id: 'rate', value: 1, normalized: false } })
  await wam.audioNode.scheduleEvents({ type: 'wam-transport', time: 0, data: { currentBar: 0, currentBarStarted: startedAt, tempo: 120, timeSigNumerator: 4, timeSigDenominator: 4, playing: true } })
  // 130 Hz は 3 秒でちょうど整数周期なので、3 秒ずらしても入力の位相が同じになる
  const source = new OscillatorNode(context, { type: 'sawtooth', frequency: 130 })
  source.connect(wam.audioNode)
  wam.audioNode.connect(context.destination)
  source.start()
  return (await context.startRendering()).getChannelData(0)
}

const diff = (a, b) => a.reduce((max, value, i) => Math.max(max, Math.abs(value - b[i])), 0)

window.__run = async () => {
  const a1 = await render(1500)
  const a2 = await render(1500)
  const b = await render(2000)
  const context = new OfflineAudioContext(1, 128, 44100)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  const ranges = []
  for (let i = 0; i < 20; i++) {
    wam.audioNode.randomize()
    const { f1, f2, f3 } = wam.audioNode.values
    ranges.push(f1 >= 280 && f1 <= 900 && f2 >= 800 && f2 <= 2700 && f3 >= 2300 && f3 <= 3600)
  }
  // 3 秒目から始めた描画の 0.5〜1 秒は、頭から描いた 3.5〜4 秒と同じ揺れになる
  const sampleRate = 44100
  const whole = await renderFrom(0, 4)
  const resumed = await renderFrom(-3, 1)
  const offset = 3 * sampleRate
  const aligned = diff(whole.slice(offset + 0.5 * sampleRate, offset + sampleRate), resumed.slice(0.5 * sampleRate, sampleRate))
  const unaligned = diff(whole.slice(0.5 * sampleRate, sampleRate), resumed.slice(0.5 * sampleRate, sampleRate))
  return JSON.stringify({ same: diff(a1, a2), other: diff(a1, b), inRange: ranges.every(Boolean), aligned, unaligned })
}
document.title = 'ready'

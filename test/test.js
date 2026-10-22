// OfflineAudioContext に WAM をつないで描画し、音が出ることと、時間とともにスペクトルが変わっていくことを確かめる。
import { initializeWamHost } from '@webaudiomodules/sdk'
import FormantDrift from '../dist/index.js'

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k)
        const ur = re[i + k], ui = im[i + k]
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr
        re[i + k] = ur + vr; im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
      }
    }
  }
}

function centroid(samples, start, sampleRate) {
  const n = 4096
  const re = new Float64Array(n), im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = samples[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n))
  fft(re, im)
  let num = 0, den = 0
  // 山が動く 200〜4000Hz の範囲の重心を見る
  for (let k = 1; k < n / 2; k++) {
    const hz = k * sampleRate / n
    if (hz < 200 || hz > 4000) continue
    const mag = Math.hypot(re[k], im[k])
    num += mag * hz
    den += mag
  }
  return num / den
}

async function run() {
  const sampleRate = 44100
  const context = new OfflineAudioContext(1, sampleRate * 8, sampleRate)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  const info = wam.audioNode.getParameterInfo ? Object.keys(await wam.audioNode.getParameterInfo()) : []
  await wam.audioNode.setParameterValues({ rate: { id: 'rate', value: 1.5, normalized: false } })
  // 白色雑音を入力にして、スペクトルの変化がフィルターの動きだけで決まるようにする
  const noise = new AudioBuffer({ length: sampleRate, sampleRate, numberOfChannels: 1 })
  noise.getChannelData(0).forEach((_, i, a) => { a[i] = (Math.random() * 2 - 1) * 0.3 })
  const source = new AudioBufferSourceNode(context, { buffer: noise, loop: true })
  source.connect(wam.audioNode)
  wam.audioNode.connect(context.destination)
  source.start()
  const buffer = await context.startRendering()
  const data = buffer.getChannelData(0)
  const windows = []
  for (let t = 1; t < 7.5; t += 0.5) windows.push(Math.round(centroid(data, Math.floor(t * sampleRate), sampleRate)))
  const peak = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
  const finite = data.every(Number.isFinite)
  const spread = Math.max(...windows) - Math.min(...windows)
  return { info, peak: Number(peak.toFixed(3)), finite, windows, spread, ok: peak > 0.05 && finite && spread > 40 }
}

const report = (text) => fetch('/result', { method: 'POST', body: text })
run().then((r) => report(JSON.stringify(r))).catch((e) => report('ERROR ' + (e?.stack ?? e)))

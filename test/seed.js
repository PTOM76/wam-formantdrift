// 同じシードなら同じ音、違うシードなら違う音になることを確かめるページ。
import { initializeWamHost } from '@webaudiomodules/sdk'
import FormantDrift from '../dist/index.js'

async function render(seed) {
  const sampleRate = 44100
  const context = new OfflineAudioContext(1, sampleRate * 4, sampleRate)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  await wam.audioNode.setParameterValues({
    seed: { id: 'seed', value: seed, normalized: false },
    rate: { id: 'rate', value: 1, normalized: false },
  })
  const source = new OscillatorNode(context, { type: 'sawtooth', frequency: 130 })
  source.connect(wam.audioNode)
  wam.audioNode.connect(context.destination)
  source.start()
  return (await context.startRendering()).getChannelData(0)
}

const diff = (a, b) => a.reduce((max, value, i) => Math.max(max, Math.abs(value - b[i])), 0)

window.__run = async () => {
  const a1 = await render(7)
  const a2 = await render(7)
  const b = await render(8)
  return JSON.stringify({ same: diff(a1, a2), other: diff(a1, b) })
}
document.title = 'ready'

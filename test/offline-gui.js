// ホストと同じく、鳴らさない OfflineAudioContext でインスタンスを作り、つまみの値が読み書きできるかを調べるページ。
import { initializeWamHost } from '@webaudiomodules/sdk'
import FormantDrift from '../dist/index.js'

const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), ms))

async function main() {
  const context = new OfflineAudioContext(2, 128, 48000)
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  const node = wam.audioNode
  document.body.append(await wam.createGui())
  window.__node = node
  window.__probe = async () => {
    await node.setParameterValues({ sharp: { id: 'sharp', value: 2, normalized: false } })
    const got = await Promise.race([node.getParameterValues(false, 'sharp'), timeout(2000)])
    return JSON.stringify({ got, values: node.values })
  }
  document.title = 'ready'
}
main().catch((error) => { document.body.textContent = String(error?.stack ?? error); document.title = 'error' })

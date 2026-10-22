// プラグインの画面（createGui）を表示するだけのページ。スクリーンショット用。
import { initializeWamHost } from '@webaudiomodules/sdk'
import FormantDrift from '../dist/index.js'

async function main() {
  const context = new AudioContext()
  const [hostGroupId] = await initializeWamHost(context)
  const wam = await FormantDrift.createInstance(hostGroupId, context)
  document.body.style.cssText = 'margin:0;display:inline-block;line-height:0'
  document.body.append(await wam.createGui())
  window.__node = wam.audioNode
  window.__wam = wam
  document.title = 'ready'
}
main().catch((error) => { document.body.textContent = String(error?.stack ?? error); document.title = 'error' })

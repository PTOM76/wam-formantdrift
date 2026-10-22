// ホストと同じ鳴らさない OfflineAudioContext でも、つまみの値を書いて読み戻せる（古い値や、ずれた値が返らない）ことを確かめる。
import { build } from 'esbuild'
import { openPage, sleep } from './browser.mjs'

await build({ entryPoints: ['test/offline-gui.js'], outfile: 'test/out/offline-gui.js', bundle: true, format: 'esm', target: 'es2022' })
const page = await openPage('offline-gui.js')
await sleep(500)
const result = JSON.parse(await page.evaluate('window.__probe()'))
const initial = result.values
const ok = result.got?.sharp?.value === 2
  && Math.abs(initial.sharp - 2) < 1e-6
  && Math.abs(initial.rate - 0.3) < 1e-6
  && Math.abs(initial.peak - 12) < 1e-6
console.log(ok ? 'OK' : 'NG', JSON.stringify(result))
page.close()
process.exit(ok ? 0 : 1)

// 同じシードの描画が一致し、違うシードの描画が違うことを確かめる。
import { build } from 'esbuild'
import { openPage } from './browser.mjs'

await build({ entryPoints: ['test/seed.js'], outfile: 'test/out/seed.js', bundle: true, format: 'esm', target: 'es2022' })
const page = await openPage('seed.js')
const result = JSON.parse(await page.evaluate('window.__run()'))
const ok = result.same === 0 && result.other > 0.01
console.log(ok ? 'OK' : 'NG', JSON.stringify(result))
page.close()
process.exit(ok ? 0 : 1)

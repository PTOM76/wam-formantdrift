// 同じ F1〜F3 の描画が一致し、違う値の描画が違うことと、Random の結果が範囲内であることを確かめる。
import { build } from 'esbuild'
import { openPage } from './browser.mjs'

await build({ entryPoints: ['test/formants.js'], outfile: 'test/out/formants.js', bundle: true, format: 'esm', target: 'es2022' })
const page = await openPage('formants.js')
const result = JSON.parse(await page.evaluate('window.__run()'))
const ok = result.same === 0 && result.other > 0.01 && result.inRange
console.log(ok ? 'OK' : 'NG', JSON.stringify(result))
page.close()
process.exit(ok ? 0 : 1)

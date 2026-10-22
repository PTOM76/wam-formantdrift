// プラグインの画面を headless の Chrome に表示し、山が動くのを待ってから撮って screenshot.png に保存する。
import { build } from 'esbuild'
import { writeFile } from 'node:fs/promises'
import { openPage, sleep } from './browser.mjs'

await build({ entryPoints: ['test/gui.js'], outfile: 'test/out/gui.js', bundle: true, format: 'esm', target: 'es2022' })
const page = await openPage('gui.js')
await sleep(4000)
const rect = await page.evaluate('(() => { const r = document.body.lastElementChild.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()')
const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 2 } })
await writeFile('screenshot.png', Buffer.from(shot.result.data, 'base64'))
console.log(page.title === 'ready' ? 'screenshot.png を作りました' : `失敗: ${page.title}`)
page.close()
process.exit(page.title === 'ready' ? 0 : 1)

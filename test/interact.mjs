// つまみを操作して、値が戻らずに音と画面に反映されることを確かめる。
import { build } from 'esbuild'
import { openPage, sleep } from './browser.mjs'

await build({ entryPoints: ['test/gui.js'], outfile: 'test/out/gui.js', bundle: true, format: 'esm', target: 'es2022' })
const page = await openPage('gui.js')
const values = () => page.evaluate('JSON.stringify(window.__node.values)').then(JSON.parse)
const knobTexts = () => page.evaluate('JSON.stringify([...document.querySelectorAll("[role=slider]")].map((k) => k.nextSibling.nextSibling.textContent))').then(JSON.parse)

const results = []
const check = (name, ok, detail) => results.push({ name, ok, detail })

// ホスト経由でつまみを変えたとき（オートメーションと同じ経路）
await page.evaluate('window.__node.setParameterValues({ sharp: { id: "sharp", value: 2, normalized: false }, peak: { id: "peak", value: 6, normalized: false } })')
await sleep(1000)
let now = await values()
check('sharp が 2 のまま', Math.abs(now.sharp - 2) < 0.01, now.sharp)
check('peak が 6 のまま', Math.abs(now.peak - 6) < 0.01, now.peak)
check('つまみの表示が追従', (await knobTexts()).join('|').includes('2.00') , await knobTexts())

// 画面のつまみをドラッグしたとき（マウスの操作）
const box = await page.evaluate('(() => { const r = document.querySelectorAll("[role=slider]")[0].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()')
const mouse = (type, y) => page.send('Input.dispatchMouseEvent', { type, x: box.x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 })
await mouse('mousePressed', box.y)
for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', box.y - i * 5); await sleep(30) }
await mouse('mouseReleased', box.y - 40)
await sleep(100)
const right = (await knobTexts())[0]
await sleep(1500)
now = await values()
const later = (await knobTexts())[0]
check('ドラッグ直後と 1.5 秒後で表示が同じ', right === later, `${right} -> ${later}`)
check('ドラッグした値が内部にも入っている', Math.abs(now.peak - parseFloat(later)) < 0.06, `${now.peak} / ${later}`)

console.table(results)
page.close()
process.exit(results.every((item) => item.ok) ? 0 : 1)

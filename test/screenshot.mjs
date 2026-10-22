// プラグインの画面を headless の Chrome に表示し、DevTools で待ってから撮って screenshot.png に保存する。
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

await build({ entryPoints: ['test/gui.js'], outfile: 'test/out/gui.js', bundle: true, format: 'esm', target: 'es2022' })
const html = '<!doctype html><meta charset="utf-8"><body><script type="module" src="/gui.js"></script>'
const server = createServer(async (req, res) => {
  if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(html)
  try {
    const body = await readFile(`test/out${req.url}`)
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(4181)

const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const child = spawn(browser, [
  '--headless=new', '--disable-gpu', `--user-data-dir=${process.env.TEMP}/wam-shot-profile`, '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=9333', '--window-size=520,420', 'about:blank',
], { stdio: 'ignore' })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pageTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
      const page = list.find((item) => item.type === 'page')
      if (page) return page
    } catch { /* 起動待ち */ }
    await sleep(200)
  }
  throw new Error('ブラウザーに接続できません')
}

const target = await pageTarget()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => { socket.onopen = resolve })
let nextId = 0
const pending = new Map()
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  pending.get(message.id)?.(message)
}
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++nextId
  pending.set(id, resolve)
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value

await send('Page.navigate', { url: 'http://localhost:4181/' })
let title = ''
for (let i = 0; i < 100 && title !== 'ready' && title !== 'error'; i++) {
  await sleep(200)
  title = await evaluate('document.title')
}
await sleep(4000) // 山が動くのを少し待つ
console.log(await evaluate('JSON.stringify([window.__node.values, window.__wam.name, window.__wam.vendor, window.__wam.moduleId])'))
const rect = await evaluate('(() => { const r = document.body.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()')
const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...rect, scale: 2 } })
await writeFile('screenshot.png', Buffer.from(shot.result.data, 'base64'))
console.log(title === 'ready' ? 'screenshot.png を作りました' : `失敗: ${title}`)
socket.close()
child.kill()
server.close()
process.exit(title === 'ready' ? 0 : 1)

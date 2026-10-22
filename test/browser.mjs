// テスト用に、test/out の ES モジュールを静的サーバーで配り、headless の Chrome（なければ Edge）を DevTools で操作する。
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function openPage(script, { port = 4181, debugPort = 9333 } = {}) {
  const html = `<!doctype html><meta charset="utf-8"><body><script type="module" src="/${script}"></script>`
  const server = createServer(async (req, res) => {
    if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(html)
    try {
      const body = await readFile(`test/out${req.url}`)
      res.writeHead(200, { 'content-type': 'text/javascript' }).end(body)
    } catch {
      res.writeHead(404).end()
    }
  }).listen(port)

  const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', `--user-data-dir=${process.env.TEMP}/wam-test-profile`, '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${debugPort}`, '--window-size=520,420', 'about:blank',
  ], { stdio: 'ignore' })

  let target
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((item) => item.type === 'page')
    } catch { /* 起動待ち */ }
    if (!target) await sleep(200)
  }
  if (!target) throw new Error('ブラウザーに接続できません')

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
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.navigate', { url: `http://localhost:${port}/` })
  let title = ''
  for (let i = 0; i < 100 && title !== 'ready' && title !== 'error'; i++) {
    await sleep(200)
    title = await evaluate('document.title')
  }

  return {
    title,
    evaluate,
    send,
    close() {
      socket.close()
      child.kill()
      server.close()
    },
  }
}

// test/test.js をまとめて静的サーバーで配り、headless の Edge または Chrome で実行して結果を表示する。
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

await build({ entryPoints: ['test/test.js'], outfile: 'test/out/test.js', bundle: true, format: 'esm', target: 'es2022' })
const html = '<!doctype html><meta charset="utf-8"><body><script type="module" src="/test.js"></script>'
let resolveResult
const finished = new Promise((resolve) => { resolveResult = resolve })
const server = createServer(async (req, res) => {
  if (req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    res.writeHead(200).end()
    return resolveResult(body)
  }
  if (req.url === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(html)
  try {
    const body = await readFile(`test/out${req.url}`)
    res.writeHead(200, { 'content-type': 'text/javascript' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(4180)

const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const child = spawn(browser, ['--headless=new', '--disable-gpu', `--user-data-dir=${process.env.TEMP}/wam-test-profile`, '--autoplay-policy=no-user-gesture-required', 'http://localhost:4180/'], { stdio: 'ignore' })
const timer = setTimeout(() => resolveResult('TIMEOUT'), 90000)
const result = await finished
clearTimeout(timer)
child.kill()
server.close()
console.log(result)
process.exit(result.includes('"ok":true') ? 0 : 1)

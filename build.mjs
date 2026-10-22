// src/index.js を 1 本の ES モジュール dist/index.js にまとめる（SDK を同梱し、ブラウザーからそのまま import できるようにする）。
import { mkdir, copyFile } from 'node:fs/promises'
import { build } from 'esbuild'

await mkdir('dist', { recursive: true })
await build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
})
await copyFile('descriptor.json', 'dist/descriptor.json')
await copyFile('screenshot.svg', 'dist/screenshot.svg').catch(() => {})
console.log('dist/index.js を作りました')

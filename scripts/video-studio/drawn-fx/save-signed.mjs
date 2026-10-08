// Salva um vídeo a partir do link assinado devolvido pelo conector Magnific (mcp__magnific__stock_download).
// Uso: node scripts/video-studio/drawn-fx/save-signed.mjs <pasta> <id> <url>
import fs from 'node:fs/promises'
const [dir, id, url] = process.argv.slice(2)
await fs.mkdir(`${dir}/raw`, { recursive: true })
const r = await fetch(url)
if (!r.ok) throw Error(`HTTP ${r.status}`)
const body = Buffer.from(await r.arrayBuffer())
await fs.writeFile(`${dir}/raw/${id}.mp4`, body)
console.log('ok', id, Math.round(body.length / 1e6) + 'MB', r.headers.get('content-type'))

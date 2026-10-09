// Salva vários vídeos a partir de um JSON { id: urlAssinada } devolvido pelo conector Magnific.
// Uso: node scripts/video-studio/drawn-fx/save-batch.mjs <pasta> <arquivo.json>
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
const [dir, file] = process.argv.slice(2)
await fs.mkdir(`${dir}/raw`, { recursive: true })
for (const [id, url] of Object.entries(JSON.parse(await fs.readFile(file, 'utf8')))) {
  const out = `${dir}/raw/${id}.mp4`
  if (existsSync(out)) continue
  try {
    const r = await fetch(url)
    if (!r.ok) throw Error(`HTTP ${r.status}`)
    const body = Buffer.from(await r.arrayBuffer())
    await fs.writeFile(out, body)
    console.log('ok', id, Math.round(body.length / 1e5) / 10 + 'MB')
  } catch (e) { console.log('erro', id, e.message) }
}

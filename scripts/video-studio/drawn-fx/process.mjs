#!/usr/bin/env node
/**
 * Baixa (acervo Magnific, sem IA) e converte efeitos desenhados em WebM VP9 com transparência.
 *
 *   node --env-file=.env scripts/video-studio/drawn-fx/process.mjs <selected.json> <pasta> [--concurrency=3] [--offline]
 *
 * Por clipe: MP4 de até 1920 px → fundo detectado nos cantos (preto, verde ou branco) → alfa real:
 *  - preto: colorkey do quase preto com borda suave, cor original (desenho de cor chapada fica opaco);
 *  - verde: recorte pela cor medida do fundo (chromakey);
 *  - branco: colorkey do quase branco com borda suave (traço sobre papel).
 * Saída em <pasta>/fx/<id>.webm (1280 px; transições 1920 px), <pasta>/poster/<id>.png e <pasta>/library.json
 * (categoria, fundo, duração, quadros, caixa do conteúdo, procedência). Clipes já convertidos são pulados.
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { api } from "./api.mjs"

const run = promisify(execFile)
const [selectedFile, dir] = process.argv.slice(2)
const concurrency = Number(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || 3)
if (!selectedFile || !dir) { console.error('Uso: process.mjs <selected.json> <pasta>'); process.exit(1) }
for (const sub of ['raw', 'fx', 'poster']) await fs.mkdir(`${dir}/${sub}`, { recursive: true })
const selected = JSON.parse(await fs.readFile(selectedFile, 'utf8'))
const libraryFile = `${dir}/library.json`
const library = existsSync(libraryFile) ? JSON.parse(await fs.readFile(libraryFile, 'utf8')) : {}
const save = () => fs.writeFile(libraryFile, JSON.stringify(library, null, 1))

// --offline: usa o arquivo já baixado pelo conector Magnific da conta (save-signed.mjs), sem chamar a API
// (download de vídeo pela chave de API consome créditos).
const OFFLINE = process.argv.includes('--offline')
async function download(item) {
  const out = `${dir}/raw/${item.id}.mp4`
  if (OFFLINE) {
    if (!existsSync(out)) throw Error('arquivo do conector ainda não baixado')
    return { out, data: { name: item.title, url: `https://www.magnific.com/br/video/${item.id}`, author: null } }
  }
  const { data } = await api(`/v1/videos/${item.id}`)
  if (existsSync(out)) return { out, data }
  const options = data.options.filter(o => o.active && o.container === 'mp4')
  const opt = options.filter(o => o.width <= 1920).sort((a, b) => b.width - a.width)[0] || options.sort((a, b) => a.width - b.width)[0]
  const dl = await api(`/v1/videos/${item.id}/options/${opt.id}/download`)
  const r = await fetch(dl.data.url)
  if (!r.ok) throw Error(`HTTP ${r.status}`)
  await fs.writeFile(out, Buffer.from(await r.arrayBuffer()))
  return { out, data }
}

const probe = async file => {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration', '-of', 'json', file])
  const j = JSON.parse(stdout), s = j.streams[0], [n, d] = s.r_frame_rate.split('/').map(Number)
  return { width: s.width, height: s.height, fps: n / (d || 1), duration: Number(j.format.duration) }
}
// Cor do fundo: mediana dos quatro cantos no início do clipe.
async function background(file) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-ss', '0.05', '-i', file, '-frames:v', '1', '-vf', 'scale=160:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'], { encoding: 'buffer', maxBuffer: 1 << 26 })
  const { data, info } = await sharp(stdout).raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]] }
  const pts = [[2, 2], [info.width - 3, 2], [2, info.height - 3], [info.width - 3, info.height - 3]].map(([x, y]) => px(x, y))
  const med = [0, 1, 2].map(c => pts.map(p => p[c]).sort((a, b) => a - b)[1])
  const [r, g, b] = med
  if (r < 40 && g < 40 && b < 50) return { kind: 'black', color: med }
  if (g > 120 && g > r * 1.4 && g > b * 1.4) return { kind: 'green', color: med }
  if (r > 215 && g > 215 && b > 215) return { kind: 'white', color: med }
  return { kind: 'other', color: med }
}
const hex = c => '0x' + c.map(v => v.toString(16).padStart(2, '0')).join('')
// colorkey: recorta a cor do fundo com borda suave e mantém as cores do desenho (rápido; geq por pixel levava minutos).
const FILTER = {
  black: 'colorkey=0x000000:0.09:0.05,format=rgba',
  white: 'colorkey=0xffffff:0.09:0.05,format=rgba',
}
async function convert(item, raw, bg, meta) {
  const width = item.category === 'transicao' ? 1920 : 1280
  const key = bg.kind === 'green' ? `chromakey=${hex(bg.color)}:0.13:0.06,format=rgba,despill=type=green:mix=0.6:expand=0.15` : FILTER[bg.kind]
  const out = `${dir}/fx/${item.id}.webm`, seconds = Math.min(meta.duration, 6)
  await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', String(seconds), '-vf', `scale=${width}:-2:flags=lanczos,fps=30,${key}`,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-deadline', 'realtime', '-cpu-used', '7', '-auto-alt-ref', '0', '-an', out], { maxBuffer: 1 << 26 })
  return { out, seconds }
}
// Pôster no ponto de maior conteúdo e caixa do conteúdo (união dos quadros amostrados), em frações.
async function inspect(item, file, seconds) {
  let best = null, box = null
  for (let k = 1; k <= 6; k++) {
    const t = (seconds * k / 7).toFixed(2)
    const { stdout } = await run('ffmpeg', ['-v', 'error', '-c:v', 'libvpx-vp9', '-ss', t, '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], { encoding: 'buffer', maxBuffer: 1 << 27 })
    const { data, info } = await sharp(stdout).ensureAlpha().resize(160, null).raw().toBuffer({ resolveWithObject: true })
    let n = 0, x0 = info.width, y0 = info.height, x1 = 0, y1 = 0
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 40) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    if (n) box = box ? { x0: Math.min(box.x0, x0 / info.width), y0: Math.min(box.y0, y0 / info.height), x1: Math.max(box.x1, x1 / info.width), y1: Math.max(box.y1, y1 / info.height) } : { x0: x0 / info.width, y0: y0 / info.height, x1: x1 / info.width, y1: y1 / info.height }
    if (!best || n > best.n) best = { n, png: stdout, coverage: n / (info.width * info.height) }
  }
  if (best?.png) await fs.writeFile(`${dir}/poster/${item.id}.png`, best.png)
  return { box, coverage: best?.coverage || 0 }
}

async function processOne(item) {
  if (library[item.id]?.file) return
  try {
    const { out: raw, data } = await download(item)
    const meta = await probe(raw), bg = await background(raw)
    if (bg.kind === 'other') { library[item.id] = { id: item.id, skipped: `fundo ${bg.color.join(',')}` }; return }
    const { out, seconds } = await convert(item, raw, bg, meta)
    const { box, coverage } = await inspect(item, out, seconds)
    if (!box || coverage < .002) { library[item.id] = { id: item.id, skipped: 'sem conteúdo após o recorte' }; return }
    library[item.id] = { id: item.id, category: item.category, title: data.name, page: data.url, author: data.author?.name || null,
      background: bg.kind, seconds: Math.round(seconds * 100) / 100, frames: Math.round(seconds * 30), sourceSize: `${meta.width}x${meta.height}`,
      file: `fx/${item.id}.webm`, poster: `poster/${item.id}.png`, box, coverage: Math.round(coverage * 1000) / 1000, bytes: (await fs.stat(out)).size,
      downloadedAt: new Date().toISOString() }
    console.log('ok', item.id, item.category, bg.kind, library[item.id].seconds + 's', Math.round(library[item.id].bytes / 1024) + 'KB')
  } catch (error) {
    library[item.id] = { id: item.id, skipped: `erro: ${String(error.message || error).slice(0, 160)}` }
    console.log('erro', item.id, String(error.message || error).slice(0, 120))
  } finally { await save() }
}

const queue = [...selected]
await Promise.all(Array.from({ length: concurrency }, async () => { while (queue.length) await processOne(queue.shift()) }))
const done = Object.values(library), ok = done.filter(x => x.file)
const per = {}; for (const x of ok) per[x.category] = (per[x.category] || 0) + 1
console.log({ processados: ok.length, pulados: done.length - ok.length, porCategoria: per, MB: Math.round(ok.reduce((a, x) => a + x.bytes, 0) / 1e6) })

#!/usr/bin/env node
/**
 * Publica os efeitos desenhados processados (process.mjs) no catálogo do vídeo.
 *
 *   node scripts/video-studio/drawn-fx/publish.mjs <pasta-do-processamento> [--exclude=<id>,<id>] [--max-mb=8]
 *
 * Copia os WebM para public/video-studio/templates/drawn-fx/, gera shared/video-studio/drawn-fx-library.json
 * (medidas lidas do próprio arquivo) e docs/video-studio/drawn-fx-provenance.json. Depois:
 *   node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive
 */
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const dir = process.argv[2]
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const exclude = new Set((arg('exclude') || '').split(',').filter(Boolean).map(Number))
const maxBytes = Number(arg('max-mb') || 8) * 1e6
if (!dir) { console.error('Uso: publish.mjs <pasta> [--exclude=ids] [--max-mb=8]'); process.exit(1) }

const library = JSON.parse(await fs.readFile(`${dir}/library.json`, 'utf8'))
const target = 'public/video-studio/templates/drawn-fx'
await fs.mkdir(target, { recursive: true })
const clips = [], provenance = [], dropped = {}
for (const item of Object.values(library).sort((a, b) => a.id - b.id)) {
  const why = !item.file ? item.skipped : exclude.has(item.id) ? 'excluído na revisão' : item.coverage < .004 ? 'conteúdo pequeno demais' : item.bytes > maxBytes ? `arquivo grande (${Math.round(item.bytes / 1e6)} MB)` : null
  if (why) { dropped[why] = (dropped[why] || 0) + 1; continue }
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', `${dir}/${item.file}`])
  const [width, height] = stdout.trim().split(',').map(Number)
  await fs.copyFile(`${dir}/${item.file}`, `${target}/${item.id}.webm`)
  const r = n => Math.round(n * 1000) / 1000
  clips.push({ id: item.id, category: item.category, file: `drawn-fx/${item.id}.webm`, frames: item.frames, width, height,
    box: { x0: r(item.box.x0), y0: r(item.box.y0), x1: r(item.box.x1), y1: r(item.box.y1) }, coverage: item.coverage })
  provenance.push({ magnificId: item.id, titulo: item.title, pagina: item.page, autor: item.author, categoria: item.category, fundoOriginal: item.background, arquivo: `templates/drawn-fx/${item.id}.webm`, baixadoEm: item.downloadedAt })
}
await fs.writeFile('shared/video-studio/drawn-fx-library.json', JSON.stringify({ version: 1, clips }, null, 1) + '\n')
await fs.writeFile('docs/video-studio/drawn-fx-provenance.json', JSON.stringify({
  fonte: 'Magnific (antigo Freepik) — download do acervo de vídeo via API, plano Premium, uso interno para clientes (sem geração por IA). Fundo sólido removido localmente (colorkey/chromakey) e convertido para WebM VP9 com alfa.',
  licenca: 'https://www.magnific.com/legal/terms-of-use', referencia: 'RTFX Generator (VideoHive 19563523) usado só como referência de categorias; nenhum arquivo do pacote.',
  atualizadoEm: new Date().toISOString(), efeitos: provenance }, null, 1) + '\n')
const per = {}; for (const c of clips) per[c.category] = (per[c.category] || 0) + 1
console.log({ publicados: clips.length, porCategoria: per, descartados: dropped })

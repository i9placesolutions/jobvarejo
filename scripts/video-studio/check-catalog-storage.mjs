import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.mp4'])
const pending = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) await walk(file)
    else if (entry.isFile() && binaryExtensions.has(extname(file).toLowerCase())) pending.push(file)
  }
}
await walk('public/video-studio')
if (pending.length) {
  throw new Error(`${pending.length} mídias de vídeo ainda estão no código. Execute node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive antes do build.`)
}
const manifest = JSON.parse(await readFile('shared/video-studio/catalog-assets.json', 'utf8'))
if (manifest.version !== 1 || !Object.keys(manifest.assets || {}).length) throw new Error('Manifesto Wasabi do catálogo ausente ou inválido.')
console.log(`Catálogo Wasabi: ${Object.keys(manifest.assets).length} referências, nenhum binário no build.`)

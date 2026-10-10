import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

// O limite por chunk não detecta uma tela leve importando vários chunks pesados.
// Medir a árvore de preloads estáticos, sem incluir ferramentas abertas sob demanda.
const output = resolve(process.env.NUXT_OUTPUT_DIR || '.output')
const manifestPath = resolve(output, 'server/chunks/build/client.precomputed.mjs')
if (!existsSync(manifestPath)) {
  console.error('Build não encontrado. Rode npm run build antes de check:route-load.')
  process.exit(1)
}
globalThis.__timing__ ??= { logStart() {}, logEnd() {} }
const { default: manifest } = await import(pathToFileURL(manifestPath).href)
const routes = [
  'pages/index.vue',
  'pages/admin/users.vue',
  'pages/admin/builder/index.vue',
  'pages/flyer-templates.vue',
  'pages/label-templates.vue',
  'pages/radio-indoor/index.vue',
  'pages/cartazista/index.vue',
  'pages/art-studio/index.vue',
  'pages/profile.vue',
]
let failed = false
const results = routes.map(route => {
  const dependency = manifest.dependencies?.[route]
  if (!dependency) {
    failed = true
    return { route, error: 'Rota ausente no manifesto' }
  }
  const files = [...new Map(Object.values(dependency.preload)
    .filter(asset => asset.resourceType === 'script')
    .map(asset => [asset.file, asset])).values()]
  const heavy = files.filter(asset => /^(editor-|vendor-fabric$)/.test(asset.name || ''))
  if (heavy.length) failed = true
  let bytes = 0
  let gzipBytes = 0
  for (const asset of files) {
    const content = readFileSync(resolve(output, 'public/_nuxt', asset.file))
    bytes += content.length
    gzipBytes += gzipSync(content).length
  }
  return { route, requests: files.length, bytes, gzipBytes, heavy: heavy.map(asset => asset.name) }
})
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2))
else console.table(results.map(result => ({
  rota: result.route,
  arquivos: result.requests,
  'JS (KiB)': result.bytes === undefined ? '-' : (result.bytes / 1024).toFixed(1),
  'gzip (KiB)': result.gzipBytes === undefined ? '-' : (result.gzipBytes / 1024).toFixed(1),
  problema: result.error || result.heavy.join(', ') || 'nenhum',
})))
if (failed) {
  console.error('Falha: páginas de consulta não devem carregar o editor gráfico na entrada.')
  process.exitCode = 1
}

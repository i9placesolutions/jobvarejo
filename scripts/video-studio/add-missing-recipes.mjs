// Receitas de vídeo (e cabeçalho do Cartazista, que usa o mesmo catálogo) para modelos de encarte que ainda
// não têm, com a fórmula de build-all-recipes.mjs, efeitos desenhados (drawnFxForTheme) e música da biblioteca.
// Também atualiza o selo das receitas de modelos cujo selo foi trocado e gera selo para receitas só com título.
//
//   node --env-file=.env scripts/video-studio/add-missing-recipes.mjs [--apply] [--seal=<projeto>:<arquivo.png>,...]
//
// Sem --apply só lista o que faria. Com --apply grava os arquivos em public/video-studio/templates/catalog/ e as
// receitas em shared/video-studio/generated-flyer-recipes.json. Depois: migrate-catalog-to-wasabi.mjs --upload --archive.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import pg from 'pg'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { register } from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register()
const { PILOT_RECIPES } = await import('../../shared/video-studio/flyer-recipes.ts')
const { classifyCampaign, campaignStyle } = await import('../../shared/video-studio/campaign-direction.ts')
const { drawnFxForTheme } = await import('../../shared/video-studio/drawn-fx-catalog.ts')

const apply = process.argv.includes('--apply')
const sealArg = process.argv.find(a => a.startsWith('--seal='))?.slice(7)
const OUT = 'public/video-studio/templates/catalog'
const RECIPES = 'shared/video-studio/generated-flyer-recipes.json'
const recipes = JSON.parse(await readFile(RECIPES, 'utf8'))
const custom = JSON.parse(await readFile('shared/video-studio/custom-flyer-recipes.json', 'utf8'))
const fixed = (await readFile('shared/video-studio/flyer-recipes.ts', 'utf8')).match(/sourceProject:'([0-9a-f-]{36})'/g)?.map(s => s.slice(15, -1)) || []
const known = new Set([...recipes, ...custom].map(r => r.sourceProject).concat(fixed))
const music = JSON.parse(await readFile('shared/video-studio/music-library.json', 'utf8'))
const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const fetchKey = async key => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }))).Body.transformToByteArray())
const keyOf = src => new URL(src, 'http://localhost').searchParams.get('key')

// Mesma fórmula de build-all-recipes.mjs (variações, famílias, atmosferas e etiquetas).
const originals = Object.values(PILOT_RECIPES).filter(r => ['alerta', 'relampago', 'saldao'].includes(r.id))
const variants = ['whip-left', 'rise', 'slam', 'tilt', 'drop', 'whip-right', 'elastic', 'zoom-out'], texts = ['whip', 'stomp', 'stretch', 'rise', 'word-pop', 'tilt', 'tracking']
const family = n => /alerta/i.test(n) ? 'alarm' : /horti|feira|verde/i.test(n) ? 'harvest' : /carne|queima|churras|suína/i.test(n) ? 'embers' : /relâmpago|dia d|super dia/i.test(n) ? 'electric' : /criança|família|fim de ano/i.test(n) ? 'celebration' : /neon/i.test(n) ? 'neon' : /halloween/i.test(n) ? 'spooky' : /rosa/i.test(n) ? 'rose' : /hora|calendário|oferta do dia/i.test(n) ? 'clock' : /industrial|preto/i.test(n) ? 'industrial' : 'spotlight'
const fx = { alarm: ['shockwave', 'speed-lines', 'spark-burst'], electric: ['lightning', 'speed-lines', 'laser-sweep'], harvest: ['dust', 'orbit', 'bokeh'], embers: ['fire', 'embers', 'smoke-plumes', 'shockwave'], celebration: ['orbit', 'prism', 'ribbons', 'spark-burst'], neon: ['grid', 'laser-sweep', 'bokeh'], spooky: ['smoke-plumes', 'prism', 'embers'], rose: ['bokeh', 'ribbons', 'spotlights'], clock: ['orbit', 'speed-lines', 'spark-burst'], industrial: ['grid', 'embers', 'laser-sweep'], spotlight: ['spotlights', 'prism', 'ribbons'] }
const style = { alarm: 'electro', electric: 'drive', harvest: 'tropical', embers: 'rock', celebration: 'disco', neon: 'synth', spooky: 'dark', rose: 'pop', clock: 'funk', industrial: 'breakbeat', spotlight: 'house' }
const TYPE = { bakery: 'harvest', boom: 'embers', alarm: 'alarm', lightning: 'electric', grill: 'embers', clearance: 'embers', harvest: 'harvest', children: 'celebration', celebration: 'celebration', rose: 'rose', spooky: 'spooky', clock: 'clock', neon: 'neon', industrial: 'industrial', show: 'spotlight', savings: 'spotlight', impact: 'electric' }

async function palette(bytes) {
  const { data, info } = await sharp(bytes).resize(96, 96, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const bins = new Map()
  for (let p = 0; p < data.length; p += info.channels) { const rgb = [data[p], data[p + 1], data[p + 2]], key = rgb.map(v => Math.floor(v / 24)).join(','); const b = bins.get(key) || { sum: [0, 0, 0], count: 0 }; rgb.forEach((v, i) => b.sum[i] += v); b.count++; bins.set(key, b) }
  const colors = [...bins.values()].sort((a, b) => b.count - a.count).map(b => ({ rgb: b.sum.map(v => Math.round(v / b.count)), count: b.count }))
  const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
  const bright = colors.find(c => c.count > 15 && Math.max(...c.rgb) - Math.min(...c.rgb) > 65 && Math.max(...c.rgb) > 170 && c.rgb.reduce((n, v, i) => n + Math.abs(v - colors[0].rgb[i]), 0) > 180)
  return { base: hex(colors[0].rgb), accent: bright ? hex(bright.rgb) : '#ffffff' }
}

function recipeFor(a, i) {
  const seed = parseInt(a.id.slice(0, 8), 16), labelType = family(a.name), type = TYPE[classifyCampaign(a.name, a.id)], layout = i % 6
  const base = structuredClone(originals[layout % 3])
  if (layout >= 3) for (const k of Object.keys(base.horizontal)) { const b = base.horizontal[k]; b[0] = 1920 - b[0] - b[2] }
  for (const format of ['vertical', 'horizontal']) { const l = base[format], height = format === 'vertical' ? 100 : 96, gap = 12; l.name = [l.price[0], l.price[1] - height - gap, l.price[2], height]; l.condition = [l.price[0], l.name[1] - 42, l.price[2], 34] }
  const direction = campaignStyle(classifyCampaign(a.name, a.id), seed)
  // Música da biblioteca (a música própria por modelo é gerada por make_model_music.py, fora deste fluxo).
  const track = music[seed % music.length]
  return { ...base, id: 'flyer-' + a.id, revision: 19, energyBackground: undefined, energyBackgroundVertical: undefined, backgroundVariant: seed % 6, name: a.name,
    campaign: a.nativeTitle?.replace(/\n/g, ' ') || a.name.replace(/ — .*/, ''), sourceProject: a.id, accent: a.accent, base: a.base, background: a.background,
    seal: a.seal, nativeTitle: a.nativeTitle, nativeTitleColor: a.nativeTitleColor, sealAspect: a.sealAspect || 1, backgroundKind: type, seed,
    layoutName: ['Preço à esquerda', 'Preço à direita', 'Preço abaixo', 'Vitrine invertida', 'Destaque lateral', 'Palco central'][layout],
    music: track.id, musicStyle: style[labelType], bpm: track.bpm || [128, 136, 118, 124, 132, 140][i % 6], transition: direction.transition,
    motion: { ...base.motion, product: variants[i % variants.length], text: texts[i % texts.length], price: variants[(i + 3) % variants.length], camera: ['impact', 'swing', 'handheld', 'earthquake', 'zoom-pulse'][i % 5],
      atmosphere: /boom/i.test(a.name) ? ['smoke-plumes', 'embers', 'spark-burst'] : type === 'embers' && i % 2 ? ['fire-jets', 'embers', 'spark-burst'] : fx[type],
      ...Object.fromEntries(Object.entries(direction).filter(([key]) => key !== 'transition')), transitionSound: 'retail-whoosh-v1', accentSound: 'retail-pop-v1',
      // Efeitos desenhados à mão (drawn-fx) pelo tema do modelo.
      drawnFx: drawnFxForTheme(`${a.name} ${a.nativeTitle || ''}`, seed) },
    labelNames: labelType === 'electric' || labelType === 'industrial' ? ['preto/amarelo 3d', 'Padrão'] : labelType === 'harvest' || labelType === 'rose' ? ['Padrão', 'PRETA VERMELHA AMARELA'] : ['PRETA VERMELHA AMARELA', 'Padrão'] }
}

const db = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL }); await db.connect(); await db.query('begin read only')
const rows = (await db.query(`select id, name, canvas_data from projects where is_template = true and (template_config->>'category') is not null order by name, id`)).rows
await db.query('rollback'); await db.end()
const loadCanvas = async p => { const page = p.canvas_data.find(x => x.templateFormatId === 'stories') || p.canvas_data.find(x => x.width === 1080 && x.height === 1920) || p.canvas_data[0]; let b = await fetchKey(page.canvasDataPath); if (b[0] === 31 && b[1] === 139) b = gunzipSync(b); return JSON.parse(b) }
const visible = o => o.visible !== false && (o.opacity ?? 1) > 0
await mkdir(OUT, { recursive: true })
const created = []
for (const p of rows.filter(r => !known.has(r.id))) {
  const canvas = await loadCanvas(p), imgs = canvas.objects.filter(o => /^image$/i.test(o.type) && visible(o) && o.src)
  const bg = imgs.find(o => /^(fundo|campaign-background)/i.test(o.name || '')) || imgs.find(o => o.name === 'campaign-bg-header')
  const seal = imgs.find(o => /selo|campaign-seal/i.test(o.name || '') && !o.businessProfileField)
  if (!bg) { console.log('PULADO (sem fundo)', p.name); continue }
  const bgBytes = await sharp(await fetchKey(keyOf(bg.src))).png().toBuffer()
  const a = { id: p.id, name: p.name, background: `catalog/${p.id}-background.png`, ...(await palette(bgBytes)) }
  let sealBytes = null
  if (seal) { sealBytes = await sharp(await fetchKey(keyOf(seal.src))).trim({ threshold: 10 }).extend({ top: 3, bottom: 3, left: 3, right: 3, background: '#00000000' }).png().toBuffer(); a.seal = `catalog/${p.id}-seal-trimmed-v1.png`; const m = await sharp(sealBytes).metadata(); a.sealAspect = m.width / m.height }
  const title = canvas.objects.find(o => /^Selo editável/i.test(o.name || '') && o.text)
  if (title) { a.nativeTitle = title.text; a.nativeTitleColor = typeof title.fill === 'string' ? title.fill : '#ffffff' }
  const recipe = recipeFor(a, parseInt(p.id.slice(0, 8), 16) % 997)
  created.push(recipe)
  console.log(apply ? 'CRIADA' : 'criaria', p.name, '|', a.seal ? 'selo' : 'título', '|', recipe.music, '|', JSON.stringify(recipe.motion.drawnFx))
  if (apply) { await writeFile(`${OUT}/${p.id}-background.png`, bgBytes); if (sealBytes) await writeFile(`${OUT}/${p.id}-seal-trimmed-v1.png`, sealBytes) }
}
// Selo trocado no encarte: a receita (vídeo e cartaz) passa a usar a mesma arte.
const sealUpdates = (sealArg || '').split(',').filter(Boolean).map(pair => pair.split(':'))
for (const [project, file] of sealUpdates) {
  const r = recipes.find(x => x.sourceProject === project)
  if (!r) { console.log('SEM RECEITA', project); continue }
  const bytes = await sharp(file).trim({ threshold: 10 }).extend({ top: 3, bottom: 3, left: 3, right: 3, background: '#00000000' }).png().toBuffer(), m = await sharp(bytes).metadata()
  console.log(apply ? 'SELO ATUALIZADO' : 'atualizaria selo', r.name, r.seal, '→', `catalog/${project}-seal-v2.png`)
  if (apply) { await writeFile(`${OUT}/${project}-seal-v2.png`, bytes); Object.assign(r, { seal: `catalog/${project}-seal-v2.png`, sealAspect: m.width / m.height }) }
}
if (apply) { await writeFile(RECIPES, JSON.stringify([...recipes, ...created])); console.log({ receitas: recipes.length + created.length, novas: created.length, selos: sealUpdates.length }) }
s3.destroy()

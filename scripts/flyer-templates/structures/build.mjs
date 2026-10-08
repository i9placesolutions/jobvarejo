#!/usr/bin/env node
/**
 * Gera as variações de estrutura (Produto Herói, Setores, Faixa Lateral) dos temas da fábrica de
 * campanhas, nos 5 formatos. Não grava nada: escreve <saída>/<tema>/<estrutura>-<formato>.json
 * (modelo sem produtos, com receitas de grade / painel de setores), .png (prévia com produtos de
 * exemplo) e manifest.json (assets a enviar). A gravação é feita por structures/persist.mjs.
 *
 * Uso: node --env-file=.env scripts/flyer-templates/structures/build.mjs <lote> <saída> [tema...]
 *   <lote>: pasta da fábrica (ex.: output/campanhas-magnific-2026-10-06), com work/<tema> e out/<tema>.
 */
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { compose } from '../../campaign-factory/compose.mjs'
import { STRUCTURES, FORMATS } from './skeletons.mjs'
import { renderer, RUNTIME_OUT } from '../renderer.mjs'

const [lote, outDir, ...only] = process.argv.slice(2)
if (!lote || !outDir) { console.error('Uso: build.mjs <lote> <saída> [tema...]'); process.exit(1) }
const root = process.cwd()
const { CAMPAIGNS, PALETTES, DECOR, LOOK, theme } = await import(`${root}/${lote}/campaigns.mjs`)
const { designBackground } = await import(`${root}/${lote}/design.mjs`)

// Código do app usado em Node (motor de estrutura e painel de setores), compilado na hora.
const ENGINE_OUT = 'output/.flyer-structure-node.mjs'
execFileSync('npx', ['esbuild', 'utils/flyerSectorPanel.ts', '--bundle', '--format=esm', '--platform=node', `--outfile=${ENGINE_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
execFileSync('npx', ['esbuild', 'scripts/flyer-templates/runtime.ts', '--bundle', '--format=esm', '--platform=browser', `--outfile=${RUNTIME_OUT}`, '--log-level=warning'], { stdio: 'inherit' })
const engine = await import(`${root}/${ENGINE_OUT}`)
const flyerStructure = await import(`${root}/utils/flyerStructure.ts`)

const s3 = new S3Client({ endpoint: `https://${process.env.WASABI_ENDPOINT.replace(/^https?:\/\//, '')}`, region: process.env.WASABI_REGION,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY } })
const fetchKey = async key => { const r = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key })); return { body: Buffer.from(await r.Body.transformToByteArray()), type: r.ContentType || 'image/png' } }
const files = new Map()
const url = key => `/api/storage/p?key=${encodeURIComponent(key)}`
const meta = async file => { const m = await sharp(file).metadata(); return { width: m.width, height: m.height } }

// Produtos de exemplo para as prévias (fotos e preços reais do lote Rodrigues).
const productsRoot = 'output/rodrigues-carrinho-cheio-2026-10-05'
const catalog = (c => Array.isArray(c) ? c : c.products)(JSON.parse(await fs.readFile(`${productsRoot}/products.json`, 'utf8')))
const photo = async id => { for (const ext of ['webp', 'png', 'jpg']) { const b = await sharp(`${productsRoot}/assets/${id}.${ext}`).png().toBuffer().catch(() => null); if (b) return `data:image/png;base64,${b.toString('base64')}` } throw Error(`sem foto ${id}`) }
const sample = async ids => Promise.all(ids.map(async id => { const p = catalog.find(x => x.id === id); return { id, name: p.name, brand: '', variant: '', weight: '', price: p.price, imageDataUrl: await photo(id) } }))
const MIX = ['p09', 'p12', 'p16', 'p17', 'p02', 'p06', 'p29', 'p26', 'p15', 'p23']
const SECTOR_MIX = ['p09', 'p12', 'p16', 'p17', 'p02', 'p06', 'p04', 'p29', 'p30', 'p26', 'p22']

const donors = Object.fromEntries(await Promise.all(FORMATS.map(async f => [f.id, JSON.parse(await fs.readFile(`output/operacao-fecha-mes-reference-2026-10-01/${f.id}.json`, 'utf8'))])))
const copy = (await import(`${root}/${RUNTIME_OUT}`)).splitFooterValidityText({ startDate: '2026-10-01', endDate: '2026-10-02', mode: 'range', whileStocks: true, layout: 'offer-banner', copyStyle: 'padded' })
const previewFormat = f => engine.PREVIEW_FORMAT[f]
const STAR = { file: `${lote}/elements/19427445.png` }

const rr = await renderer(files, fetchKey)
try {
  for (const c of CAMPAIGNS.filter(c => !only.length || only.includes(c.slug))) {
    const buildMeta = JSON.parse(await fs.readFile(`${lote}/out/${c.slug}/build-meta.json`, 'utf8'))
    const { owner, projectId } = buildMeta
    const revision = 'structures-v1'
    const prefix = `projects/${owner}/${projectId}/${revision}`
    const T = theme(c), P = PALETTES[c.palette], style = LOOK[c.slug].style
    const items = DECOR[c.slug].items.map(i => ({ file: `${lote}/elements/${i.id}.png`, hue: i.hue || 0 }))
    const seed = c.slug.length * 7919 + c.seal % 1000
    // Selo já publicado pela fábrica; o arquivo local serve para renderizar.
    const sealKey = buildMeta.assets.seal.key
    files.set(sealKey, `${lote}/work/${c.slug}/seal.png`)
    const seal = { url: url(sealKey), meta: await meta(`${lote}/work/${c.slug}/seal.png`) }
    const dir = `${outDir}/${c.slug}`
    await fs.mkdir(dir, { recursive: true })
    const manifest = { slug: c.slug, name: c.name, owner, projectId, revision, assets: [], blueprints: [] }
    for (const [structureId, sk] of Object.entries(STRUCTURES)) {
      for (const f of FORMATS) {
        const L = sk.layout(f.id, f.width, f.height)
        const column = sk.columnBackground?.(f.id)
        const bgFile = `${dir}/bg-${structureId}-${f.id}.jpg`
        await fs.writeFile(bgFile, await designBackground({ W: f.width, H: f.height, f: column || f.id === 'tv' ? 'tv' : f.id, L, P, star: STAR, items, seed, style,
          header: column ? { x: 0, y: 0, w: L.panel.x - 4, h: f.height } : undefined }))
        const bgKey = `${prefix}/assets/background-${structureId}-${f.id}.jpg`
        files.set(bgKey, bgFile)
        manifest.assets.push({ key: bgKey, file: bgFile, contentType: 'image/jpeg' })
        const ids = { frame: randomUUID(), zone: randomUUID(), validity: copy }
        const page = { id: randomUUID(), width: f.width, height: f.height, templateFormatId: f.id, templateModelId: c.slug, templateModelName: c.name }
        const canvas = compose({ donor: donors[f.id], page, assets: { seal, elements: [], bg: { [f.id]: { url: url(bgKey), meta: await meta(bgFile) } } }, ids, theme: T, slug: c.slug, L })
        const corner = 24 * L.k
        const footer = canvas.objects.find(o => o.name === 'footer-premium-background')
        if (sk.footerStack?.(f.id) && footer) Object.assign(footer, { footerStack: true, footerColumnWeights: [1, 1.45, 2.2], rx: corner, ry: corner, strokeWidth: 3 * L.k,
          shadow: { color: T.shadow, blur: 12 * L.k, offsetX: 0, offsetY: 3 * L.k } })
        const zone = canvas.objects.find(o => o.isProductZone)
        let previewProducts, productsByZone, previewCanvas = canvas
        if (sk.sectorPanel) {
          const u = f.width / 1080
          Object.assign(zone, { sectorPanel: true, sectorPanelUnit: f.id === 'tv' ? 1 : u, sectorTitleHeight: (f.id === 'stories' ? 52 : 42) * (f.id === 'tv' ? 1 : u), zoneName: 'Setores' })
          const hidden = { version: '7.1.0', parentFrameId: zone.parentFrameId, _frameClipOwner: zone.parentFrameId, originX: 'left', originY: 'top', left: 0, top: 0, scaleX: 1, scaleY: 1, visible: false, selectable: false, evented: false, excludeFromExport: true }
          canvas.objects.push(
            { ...hidden, type: 'Rect', _customId: randomUUID(), name: 'sector-title-line-template', width: 10, height: 4, fill: T.card[2], rx: 2, ry: 2 },
            { ...hidden, type: 'Rect', _customId: randomUUID(), name: 'sector-title-bar-template', width: 200, height: 42, rx: corner, ry: corner, stroke: T.gold[1], strokeWidth: 3 * L.k,
              fill: { type: 'linear', gradientUnits: 'percentage', coords: { x1: 0, y1: 0, x2: 0, y2: 1 }, colorStops: [{ offset: 0, color: T.card[1] }, { offset: 1, color: T.card[3] }] },
              shadow: { color: T.shadow, blur: 8 * L.k, offsetX: 0, offsetY: 3 * L.k } },
            { ...hidden, type: 'Textbox', _customId: randomUUID(), name: 'sector-title-template', width: 200, text: 'SETOR', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, lineHeight: 1, fill: '#ffffff', textAlign: 'center', styles: {} })
          // Amostra dentro da capacidade do formato (quadrado comporta menos ofertas em setores).
          previewProducts = await sample(f.id === 'square' ? ['p09', 'p12', 'p02', 'p06', 'p29', 'p30'] : SECTOR_MIX)
          const plan = flyerStructure.chooseFlyerStructure(previewProducts, { format: f.id, preferred: 'setores' })
          const expanded = engine.expandSectorPanel(canvas, plan.sectors, f.id)
          previewCanvas = expanded.canvas
          const byId = new Map(previewProducts.map(p => [p.id, p]))
          productsByZone = Object.fromEntries(plan.sectors.map(s => [expanded.zoneBySector[s.title], s.productIds.map(id => byId.get(id))]))
        } else {
          for (const [count, recipe] of Object.entries(sk.recipes?.(f.id) || {})) engine.setZoneGridRecipe(zone, previewFormat(f.id), Number(count), recipe.columns, recipe.showcase)
          previewProducts = await sample(MIX.slice(0, sk.sample[f.id]))
          productsByZone = { [zone._customId]: previewProducts }
        }
        // Layout do rodapé gravado a partir do canvas sem produtos; prévia com produtos.
        const plain = await rr.render(canvas, f.width, f.height, f.id, {})
        const preview = await rr.render(previewCanvas, f.width, f.height, f.id, productsByZone)
        const name = `${structureId}-${f.id}`
        await fs.writeFile(`${dir}/${name}.json`, JSON.stringify(plain.persisted))
        await fs.writeFile(`${dir}/${name}.png`, preview.png)
        manifest.blueprints.push({ structureId, structureName: sk.name, formatId: f.id, width: f.width, height: f.height, file: `${dir}/${name}.json`, preview: `${dir}/${name}.png`,
          canvasDataPath: `${prefix}/pages/${name}.json.gz`, thumbnailPath: `${prefix}/pages/${name}.webp` })
        console.log('ok', c.slug, name)
      }
    }
    await fs.writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2))
  }
} finally { await rr.close(); s3.destroy() }

import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { StaticCanvas } from 'fabric/node'

// Teste offline: nenhum upload, banco de produção, assinatura ou API de imagem.
const root = process.cwd(), assets = resolve(process.argv[2] || 'output/economia-story-2026-10-07/assets')
const output = resolve('output/work-design-pilot')
await mkdir(output, { recursive: true })
await build({ entryPoints: ['server/utils/work-design/composition.ts', 'server/utils/work-design/render.ts', 'tests/work-design/fixtures.ts'],
  outdir: `${output}/runtime`, outbase: '.', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const module = path => import(pathToFileURL(`${output}/runtime/${path}.js`).href)
const { fixtureJob, fixtureLayout } = await module('tests/work-design/fixtures')
const { compileWorkPage, validateWorkLayout } = await module('server/utils/work-design/composition')
const { renderWorkCanvas } = await module('server/utils/work-design/render')
const files = ['coxao-mole.webp', 'almondega-bovina.webp', 'costela-bovina.webp', 'suan-suina.png', 'coxinha-asa.webp']
const image = async key => {
  const file = key.startsWith('logo/') ? 'logo.png' : files[Number(key.match(/test-(\d+)/)?.[1])]
  const bytes = await sharp(await readFile(`${assets}/${file}`)).png().toBuffer(), info = await sharp(bytes).metadata()
  return { width: info.width, height: info.height, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
}
const receipts = []
for (const count of [1, 5, 12]) {
  const job = fixtureJob(count), layout = fixtureLayout(job)
  validateWorkLayout(job, layout)
  for (const [index, page] of layout.pages.entries()) {
    const canvas = await compileWorkPage(job, page, image)
    const products = await Promise.all(page.slots.map(async slot => {
      const product = job.request.products.find(p => p.id === slot.productId)
      return { ...product, brand: '', variant: '', weight: '', imageFillCount: 1, imageDataUrl: (await image(product.imageKey)).dataUrl }
    }))
    const started = Date.now(), rendered = await renderWorkCanvas(canvas, products, page.format)
    const prefix = `${output}/${count}-${page.format}-${index}`
    const cards = rendered.canvas.objects.filter(o => o.isProductCard)
    if (cards.length !== products.length || cards.some((c, i) => c.productItemId !== products[i].id)) throw new Error('Produtos não preservados')
    const addressNodes = rendered.canvas.objects.filter(o => o.data?.workBinding?.startsWith('address:'))
    if (addressNodes.length !== 2 || addressNodes.some(o => o.type.toLowerCase() !== 'textbox')) throw new Error('Endereços não editáveis')
    for (const field of [...page.fields, ...(page.heading ? [{ binding: 'heading', box: page.heading.box }] : [])]) {
      const object = rendered.canvas.objects.find(o => o.data?.workBinding === field.binding)
      if (!object || (object.type.toLowerCase() === 'textbox' && object.height > field.box.height + 2))
        throw new Error(`Texto excede o bloco: ${field.binding}`)
    }
    await writeFile(`${prefix}.png`, rendered.png)
    await writeFile(`${prefix}.json`, JSON.stringify(rendered.canvas, null, 2))
    const roundtrip = new StaticCanvas(undefined, { width: canvas.width, height: canvas.height })
    await roundtrip.loadFromJSON(rendered.canvas)
    const address = roundtrip.getObjects().find(o => o.data?.workBinding === 'address:unidade-2')
    const prior = address.text; address.set('text', 'Endereço alterado para teste'); address.set('text', prior)
    if (address.text !== prior) throw new Error('Texto não editável')
    const reloadedCards = roundtrip.getObjects().filter(o => o.isProductCard)
    if (reloadedCards.length !== cards.length) throw new Error('Cards perdidos no roundtrip')
    const png = Buffer.from(roundtrip.toDataURL({ format: 'png' }).split(',')[1], 'base64')
    await writeFile(`${prefix}-roundtrip.png`, png)
    await roundtrip.dispose()
    receipts.push({ count, format: page.format, page: index, cards: cards.length, addresses: addressNodes.length,
      nativeCards: true, roundtrip: true, seconds: (Date.now() - started) / 1000, source: 'fixture local, não Work' })
    console.log(JSON.stringify(receipts.at(-1)))
  }
}
await writeFile(`${output}/validation.json`, JSON.stringify(receipts, null, 2))

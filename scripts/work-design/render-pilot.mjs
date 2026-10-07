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
await build({ entryPoints: ['server/utils/work-design/composition.ts', 'server/utils/work-design/render.ts', 'tests/work-design/fixtures.ts', 'utils/workDesignGeometry.ts'],
  outdir: `${output}/runtime`, outbase: '.', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
const module = path => import(pathToFileURL(`${output}/runtime/${path}.js`).href)
const { fixtureJob, fixtureLayout } = await module('tests/work-design/fixtures')
const { compileWorkPage, validateWorkLayout } = await module('server/utils/work-design/composition')
const { renderWorkCanvas } = await module('server/utils/work-design/render')
const { defaultWorkProductDesign } = await module('utils/workDesignGeometry')
const files = ['coxao-mole.webp', 'almondega-bovina.webp', 'costela-bovina.webp', 'suan-suina.png', 'coxinha-asa.webp']
const image = async key => {
  const file = key.startsWith('logo/') ? 'logo.png' : key.includes('test-seal') ? 'selo.png'
    : key.includes('test-background') ? 'fundo.png' : files[Number(key.match(/test-(\d+)/)?.[1])]
  const bytes = await sharp(await readFile(`${assets}/${file}`)).png().toBuffer(), info = await sharp(bytes).metadata()
  return { width: info.width, height: info.height, dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }
}
const receipts = []
const cases = [1, 5, 12].map(count => ({ name: String(count), job: fixtureJob(count) }))
const multi = fixtureJob(5)
multi.request.formats = ['stories', 'feed', 'square', 'tv', 'print']; multi.request.productsPerPage = 3
cases.push({ name: 'creative-pages', job: multi })
const showcase = fixtureJob(5); showcase.request.formats = ['stories']; showcase.request.sealKey = 'imagens/test-seal.png'
cases.push({ name: 'creative-story', job: showcase })
for (const {name, job} of cases) {
  const count = job.request.products.length, layout = fixtureLayout(job)
  if (name.startsWith('creative')) for (const page of layout.pages) {
    page.slots.forEach((slot, i) => { slot.design = defaultWorkProductDesign(page, i)
      slot.design.name.style.fontFamily = 'Barlow Condensed'; slot.design.price.style.fontFamily = 'Oswald' })
  }
  if (name === 'creative-story') {
    const page = layout.pages[0]; delete page.heading
    page.decorations = [{ kind: 'image', radius: 0, assetKey: 'imagens/test-background.png', box: { x: 0, y: 0, width: 1080, height: 1920 } },
      { kind: 'image', radius: 0, assetKey: showcase.request.sealKey, box: { x: 42, y: 62, width: 680, height: 334 } }]
    page.fields = page.fields.map(f => ({ ...f, box: f.binding === 'logo' ? { x: 785, y: 67, width: 245, height: 270 }
      : f.binding === 'companyName' ? { x: 725, y: 350, width: 325, height: 55 }
        : f.binding === 'validity' ? { x: 205, y: 428, width: 670, height: 57 }
          : { x: 55, y: f.binding === 'address:unidade-1' ? 1780 : 1846, width: 970, height: 62 },
      style: { ...f.style, fontFamily: 'Barlow Condensed', fontSize: f.binding === 'validity' ? 44 : f.binding === 'companyName' ? 24 : 28,
        color: f.binding === 'validity' ? '#083A9D' : '#FFFFFF' } }))
    page.slots.forEach((slot, i) => {
      const wide = i === 4
      slot.box = wide ? { x: 74, y: 1408, width: 932, height: 260 } : { x: i % 2 === 0 ? 74 : 569, y: i < 2 ? 512 : 960, width: 437, height: 425 }
      slot.design = { surface: { color: '#FFFFFF', radius: 25 },
        image: wide ? { x: 26, y: 10, width: 420, height: 239 } : { x: 26, y: 10, width: 385, height: 232 },
        name: { box: wide ? { x: 449, y: 35, width: 450, height: 60 } : { x: 18, y: 253, width: 401, height: 57 },
          style: { fontFamily: 'Barlow Condensed', fontSize: 43, bold: true, align: 'center', color: '#083A9D' } },
        price: { box: { x: wide ? 515 : 59, y: wide ? 125 : 319, width: 319, height: 95 },
          style: { fontFamily: 'Oswald', fontSize: 100, bold: true, align: 'center', color: '#083A9D' },
          decimalScale: .55, currencyScale: .3, background: '#FFD215', radius: 24 }, decorations: [] }
    })
  }
  validateWorkLayout(job, layout)
  for (const [index, page] of layout.pages.entries()) {
    const canvas = await compileWorkPage(job, page, image)
    const products = await Promise.all(page.slots.map(async slot => {
      const product = job.request.products.find(p => p.id === slot.productId)
      return { ...product, brand: '', variant: '', weight: '', imageFillCount: 1, imageDataUrl: (await image(product.imageKey)).dataUrl }
    }))
    const started = Date.now(), rendered = await renderWorkCanvas(canvas, products, page.format)
    const prefix = `${output}/${name}-${page.format}-${index}`
    const cards = rendered.canvas.objects.filter(o => o.isProductCard)
    if (cards.length !== products.length || cards.some((c, i) => c.productItemId !== products[i].id)) throw new Error('Produtos não preservados')
    for (const [i, card] of cards.entries()) {
      const nodes = card.objects.flatMap(o => [o, ...(o.objects || [])])
      if (nodes.find(o => o.name === 'price_value_text')?.text !== products[i].price ||
          nodes.find(o => o.name === 'smart_title')?.text !== products[i].name || !nodes.find(o => o.name === 'smart_image')?.src)
        throw new Error('Foto, nome ou preço divergente')
    }
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
    receipts.push({ test: name, count, format: page.format, page: index, cards: cards.length, addresses: addressNodes.length,
      nativeCards: true, roundtrip: true, seconds: (Date.now() - started) / 1000, source: 'fixture local, não Work' })
    console.log(JSON.stringify(receipts.at(-1)))
  }
}
await writeFile(`${output}/validation.json`, JSON.stringify(receipts, null, 2))

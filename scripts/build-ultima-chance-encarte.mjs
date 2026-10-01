#!/usr/bin/env node
/**
 * Monta o modelo de encarte Última Chance nos cinco formatos.
 *
 * O selo 3D fica no fundo. Logo, validade, WhatsApp, endereço e cartões
 * são campos nativos. A área branca é a zona de produtos.
 *
 *   node --env-file=.env scripts/build-ultima-chance-encarte.mjs
 *   node --env-file=.env scripts/build-ultima-chance-encarte.mjs --apply
 */
import { randomUUID, createHash } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import pg from 'pg'
import sharp from 'sharp'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { cloneZoneForFrame, DEFAULT_DONOR_TEMPLATE_ID, OWNER_ID, TEMPLATE_FORMATS } from './standardize-flyer-template-dynamics.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const artDir = join(root, 'tmp/ultima-chance-ref/backgrounds')
const previewDir = join(root, 'tmp/ultima-chance-ref/preview')
const MODEL_NAME = 'Última Chance'
const ASSET_PREFIX = 'imagens/modelos-encarte/ultima-chance/v1'
const CARD_IDS = ['cartao-82', 'cartao-81', 'cartao-84', 'cartao-80', 'cartao-79', 'cartao-86']

const id = () => randomUUID()
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

const iconSvg = {
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#25D366"/><path fill="#fff" d="M17.05 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"/><path fill="#fff" d="M12 2.2A9.78 9.78 0 0 0 3.6 16.7l-.9 3.3 3.4-1.1A9.8 9.8 0 1 0 12 2.2zm0 17.9a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2 .6.6-2-.2-.3A8.15 8.15 0 1 1 12 20.1z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#1a1a1a"/><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="17.2" cy="6.8" r="1" fill="#fff"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1a1a1a"/><path fill="#fff" d="M13.4 18.5v-6.1h2l.3-2.3h-2.3V8.6c0-.7.2-1.1 1.2-1.1H16V5.4c-.2 0-.9-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.7H9.2v2.3h2v6.1h2.2z"/></svg>`,
  address: `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24"><path fill="#ffe14a" d="M12 2.2A7.2 7.2 0 0 0 4.8 9.4c0 5.2 6.2 11.8 6.5 12.1.4.4 1 .4 1.4 0 .3-.3 6.5-6.9 6.5-12.1A7.2 7.2 0 0 0 12 2.2zm0 9.7a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z"/></svg>`
}

const base = (type, values) => ({
  type, version: '7.1.0', _customId: id(), originX: 'left', originY: 'top',
  left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0, opacity: 1, visible: true,
  objectCaching: false, strokeWidth: 0, ...values
})

const text = (frameId, name, value, box, size, fill, extra = {}) => base('Textbox', {
  name, parentFrameId: frameId, ...box, text: value, __rawText: value,
  fontFamily: 'Barlow', fontWeight: extra.fontWeight || 800, fontSize: size, fill,
  textAlign: extra.textAlign || 'left', lineHeight: 1.02, splitByGrapheme: false, styles: {},
  dynamicFieldResizeMode: 'reflow', dynamicFieldBaseFontSize: size, dynamicFieldAutoFitFontSize: size,
  dynamicFieldHeight: box.height, dynamicFieldAutoHeight: false, ...extra
})

const image = (frameId, name, file, box, natural) => {
  const sourceWidth = natural?.width || box.width
  const sourceHeight = natural?.height || box.height
  return base('Image', {
    name, parentFrameId: frameId, src: `/asset/${file}`,
    left: box.left, top: box.top, width: sourceWidth, height: sourceHeight,
    scaleX: box.width / sourceWidth, scaleY: box.height / sourceHeight,
    selectable: false, evented: false
  })
}

const prepareZone = (donor, frame, box, page) => {
  const zone = cloneZoneForFrame(donor, frame, box, {
    templateFormatId: page.templateFormatId,
    templateFormatLabel: page.templateFormatLabel,
    templateModelId: page.templateModelId,
    templateModelName: page.templateModelName
  })
  zone.name = 'gridZone'
  zone.isGridZone = true
  zone.contentStatus = 'empty'
  const palette = {
    cardColor: '#ffffff',
    highlightCardColor: '#d01212',
    prodNameColor: '#1a1208',
    highlightProdNameColor: '#fff8e6'
  }
  zone._zoneGlobalStyles = {
    ...(zone._zoneGlobalStyles || {}),
    cardColorMode: 'auto',
    templateProductPalette: palette
  }
  if (zone._zoneStateSnapshot) {
    zone._zoneStateSnapshot.cards = []
    zone._zoneStateSnapshot.globalStyles = {
      ...(zone._zoneStateSnapshot.globalStyles || {}),
      cardColorMode: 'auto',
      templateProductPalette: palette
    }
    if (zone._zoneStateSnapshot.zone) zone._zoneStateSnapshot.zone.contentStatus = 'empty'
  }
  for (const child of zone.objects || []) {
    if (String(child.type || '').toLowerCase() === 'rect') {
      child.fill = 'transparent'
      child.stroke = 'transparent'
      child.strokeWidth = 0
    }
  }
  return zone
}

const buildPage = (spec, page, donor, iconsReady) => {
  const frameId = id()
  const { width, height } = spec
  const scale = width / 1080
  const frame = base('Rect', {
    _customId: frameId, isFrame: true, clipContent: true, name: `template-frame-${page.templateFormatId}`,
    layerName: `${MODEL_NAME} · ${page.templateFormatLabel}`, originX: 'center', originY: 'center',
    left: width / 2, top: height / 2, width, height, fill: '#5a0400',
    templateModelId: page.templateModelId, templateModelName: page.templateModelName,
    templateFormatId: page.templateFormatId, templateFormatLabel: page.templateFormatLabel,
    templateCompositionManaged: true
  })
  const background = image(frameId, 'offerBackground', `${page.templateFormatId}.png`, { left: 0, top: 0, width, height })
  Object.assign(background, { selectable: false, evented: false, lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true })
  const objects = [frame, background]
  objects.push(prepareZone(donor, frame, spec.zone, page))

  const logo = spec.logo
  objects.push(base('Rect', {
    name: 'header-logo-slot', layerName: 'Logo da loja', parentFrameId: frameId, ...logo, fill: 'transparent',
    businessProfileField: 'logo', quickLogoSlot: true, quickFieldEnabled: true, quickLogoBackdropMode: 'none',
    quickLogoSource: '', quickLogoUseProfileInTemplate: true,
    quickLogoMaxWidth: logo.width, quickLogoMaxHeight: logo.height,
    quickLogoCenterX: logo.left + logo.width / 2, quickLogoCenterY: logo.top + logo.height / 2
  }))

  if (!spec.tv && spec.social) {
    const social = spec.social
    objects.push(base('Rect', {
      name: 'header-social-background', parentFrameId: frameId, ...social, fill: 'transparent',
      footerLayout: 'campaign-social', headerInstagramMaxWidth: social.width, headerInstagramCenterX: social.left + social.width / 2
    }))
    const icon = Math.min(social.height * .62, 34 * scale)
    const textLeft = social.left + icon * 2 + 16 * scale
    objects.push(image(frameId, 'header-icon-instagram', 'instagram.png', { left: social.left + 8 * scale, top: social.top + (social.height - icon) / 2, width: icon, height: icon }, { width: 128, height: 128 }))
    objects.push(image(frameId, 'header-icon-facebook', 'facebook.png', { left: social.left + icon + 12 * scale, top: social.top + (social.height - icon) / 2, width: icon, height: icon }, { width: 128, height: 128 }))
    objects.push(text(frameId, 'header-instagram', '@sualoja', {
      left: textLeft, top: social.top + social.height * .12, width: social.width - (textLeft - social.left) - 8 * scale, height: social.height * .76
    }, 22 * scale, '#1a1a1a', { businessProfileField: 'instagram', quickFieldEnabled: true, dynamicFieldKey: 'instagram', fontWeight: 700 }))
    objects.push(text(frameId, 'header-facebook', '@sualoja', {
      left: textLeft, top: social.top, width: 1, height: 1
    }, 22 * scale, '#1a1a1a', { businessProfileField: 'facebook', quickFieldEnabled: true, dynamicFieldKey: 'facebook', visible: false, fontWeight: 700 }))
  }

  const validity = spec.validity
  if (spec.tv) {
    objects.push(base('Rect', {
      name: 'standard-validity-background', parentFrameId: frameId, ...validity, fill: 'transparent', rx: 8, ry: 8
    }))
    objects.push(text(frameId, 'header-validity', 'OFERTAS VÁLIDAS DE 01 A 02 DE OUTUBRO  ·  ENQUANTO DURAREM OS ESTOQUES', validity, 28 * (height / 1080), '#ffe14a', {
      textAlign: 'center', quickDataField: 'validity', quickValidityLayout: 'inline-footer', quickFieldEnabled: true,
      quickValidityMode: 'period', quickValidityWhileStocks: true, fontWeight: 800
    }))
  } else {
    objects.push(base('Rect', {
      name: 'standard-validity-background', parentFrameId: frameId, ...validity, fill: 'transparent'
    }))
    const rows = [
      ['validity-heading', 'OFERTAS VÁLIDAS DE', 0, .28, 18 * scale, '#6a2200', 700],
      ['header-validity', '01 A 02 DE OUTUBRO', .28, .46, 30 * scale, '#1a0a00', 900],
      ['stock-validity', 'ENQUANTO DURAREM OS ESTOQUES', .74, .26, 13 * scale, '#6a2200', 700]
    ]
    for (const [name, value, start, portion, size, fill, weight] of rows) {
      const box = { left: validity.left, top: validity.top + validity.height * start, width: validity.width, height: validity.height * portion }
      const extra = { fontWeight: weight, textAlign: 'left' }
      if (name === 'header-validity') Object.assign(extra, {
        quickDataField: 'validity', quickValidityLayout: 'offer-banner', quickFieldEnabled: true,
        quickValidityMode: 'period', quickValidityWhileStocks: true
      })
      objects.push(text(frameId, name, value, box, size, fill, extra))
    }
  }
  if (spec.footer) {
    const footer = spec.footer
    const footerScale = spec.tv ? 1 : scale
    objects.push(base('Rect', {
      name: 'footer-premium-background', parentFrameId: frameId, ...footer, fill: 'transparent',
      footerLayout: 'campaign-retail', footerColumnWeights: [0.92, 1.5, 1.02]
    }))
    const inset = 18 * footerScale
    const gap = 14 * footerScale
    const colW = (footer.width - inset * 2 - gap * 2) / 3.3
    const weights = [0.92, 1.5, 1.02]
    const total = weights.reduce((sum, item) => sum + item, 0)
    const available = footer.width - inset * 2 - gap * 2
    let x = footer.left + inset
    const columns = weights.map(weight => {
      const width = available * weight / total
      const column = { left: x, width }
      x += width + gap
      return column
    })
    const iconSize = Math.min(46 * footerScale, footer.height * .42)
    const midY = footer.top + (footer.height - iconSize) / 2
    objects.push(image(frameId, 'icon-whatsapp', 'whatsapp.png', { left: columns[0].left, top: midY, width: iconSize, height: iconSize }, { width: 128, height: 128 }))
    objects.push(text(frameId, 'footer-dynamic-whatsapp', '(11) 99999-9999', {
      left: columns[0].left + iconSize + 10 * footerScale, top: footer.top + footer.height * .28,
      width: columns[0].width - iconSize - 14 * footerScale, height: footer.height * .5
    }, 28 * footerScale, '#ffffff', { businessProfileField: 'whatsapp', quickFieldEnabled: true, dynamicFieldKey: 'whatsapp', fontWeight: 800 }))
    objects.push(base('Rect', {
      name: 'footer-column-divider-1', parentFrameId: frameId,
      left: columns[0].left + columns[0].width + gap / 2, top: footer.top + footer.height * .22,
      width: 2 * footerScale, height: footer.height * .56, fill: '#ffe14a'
    }))
    objects.push(image(frameId, 'icon-address', 'address.png', { left: columns[1].left, top: midY, width: iconSize, height: iconSize }, { width: 128, height: 128 }))
    objects.push(text(frameId, 'footer-dynamic-address', 'Rua da Loja, 100 - Centro,\nCidade - UF', {
      left: columns[1].left + iconSize + 10 * footerScale, top: footer.top + footer.height * .16,
      width: columns[1].width - iconSize - 12 * footerScale, height: footer.height * .72
    }, 22 * footerScale, '#ffffff', { businessProfileField: 'address', quickFieldEnabled: true, dynamicFieldKey: 'address', fontWeight: 700 }))
    objects.push(base('Rect', {
      name: 'footer-column-divider-2', parentFrameId: frameId,
      left: columns[1].left + columns[1].width + gap / 2, top: footer.top + footer.height * .22,
      width: 2 * footerScale, height: footer.height * .56, fill: '#ffe14a'
    }))
    const payment = {
      left: columns[2].left, top: footer.top + footer.height * .12,
      width: columns[2].width, height: footer.height * .76
    }
    objects.push(base('Rect', {
      name: 'footer-payment-images', layerName: 'Cartões aceitos', parentFrameId: frameId, ...payment, fill: 'transparent',
      businessProfileField: 'footerPaymentImages', quickFieldEnabled: true,
      footerPaymentWidth: payment.width, footerPaymentHeight: payment.height, footerPaymentColumns: 3
    }))
    spec.payment = payment
  }
  void iconsReady
  return { version: '7.1.0', backgroundColor: '#5a0400', width, height, objects }
}

const paintCards = async (png, payment) => {
  if (!payment) return png
  const gapX = payment.width * .04
  const gapY = payment.height * .08
  const cellW = (payment.width - gapX * 2) / 3
  const cellH = (payment.height - gapY) / 2
  const composites = []
  for (const [index, cardId] of CARD_IDS.entries()) {
    const column = index % 3
    const row = Math.floor(index / 3)
    const file = join(root, 'public/cartoes', `${cardId}.png`)
    const resized = await sharp(file).resize(Math.round(cellW * .92), Math.round(cellH * .92), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    const meta = await sharp(resized).metadata()
    composites.push({
      input: resized,
      left: Math.round(payment.left + column * (cellW + gapX) + (cellW - meta.width) / 2),
      top: Math.round(payment.top + row * (cellH + gapY) + (cellH - meta.height) / 2)
    })
  }
  return sharp(png).composite(composites).png().toBuffer()
}

const createRenderer = () => new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/fabric.mjs') {
        res.setHeader('content-type', 'text/javascript')
        res.end(await readFile(join(root, 'node_modules/fabric/dist/index.min.mjs')))
        return
      }
      if (url.pathname === '/font.ttf') {
        res.end(await readFile(join(root, 'public/art-studio/fonts/Barlow-ExtraBold.ttf')))
        return
      }
      if (url.pathname.startsWith('/asset/')) {
        res.end(await readFile(join(artDir, url.pathname.slice('/asset/'.length))))
        return
      }
      res.setHeader('content-type', 'text/html')
      res.end(`<style>@font-face{font-family:Barlow;src:url('/font.ttf');font-weight:100 900}</style><script type="module">
import { StaticCanvas } from '/fabric.mjs';
await document.fonts.load('800 24px Barlow');
window.renderTemplate = async (data, width, height) => {
  const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, renderOnAddRemove: false });
  try {
    await canvas.loadFromJSON(data);
    canvas.renderAll();
    return canvas.toDataURL({ format: 'png', multiplier: 1 });
  } finally { await canvas.dispose(); }
};
</script>`)
    } catch (error) { res.statusCode = 500; res.end(String(error)) }
  })
  server.listen(0, '127.0.0.1', async () => {
    try {
    const profile = join(tmpdir(), `ultima-chance-${Date.now()}`)
    await mkdir(profile, { recursive: true })
    const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
    let output = ''
    const endpoint = await new Promise((ok, fail) => {
      const timeout = setTimeout(() => fail(new Error('Chrome não iniciou')), 20000)
      chrome.on('error', fail)
      chrome.stderr.on('data', chunk => {
        output += chunk
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/)
        if (match) { clearTimeout(timeout); ok(match[1]) }
      })
    })
    const port = new URL(endpoint).port
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
    const ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await new Promise(ok => ws.addEventListener('open', ok, { once: true }))
    let callId = 0
    const pending = new Map()
    ws.addEventListener('message', event => {
      const data = JSON.parse(event.data)
      const item = pending.get(data.id)
      if (!item) return
      pending.delete(data.id)
      data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result)
    })
    const call = (method, params = {}) => new Promise((ok, fail) => {
      pending.set(++callId, { resolve: ok, reject: fail })
      ws.send(JSON.stringify({ id: callId, method, params }))
    })
    await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const result = await call('Runtime.evaluate', { expression: 'typeof window.renderTemplate', returnByValue: true })
      if (result.result?.value === 'function') break
      await new Promise(ok => setTimeout(ok, 100))
      if (attempt === 99) throw new Error('Fabric não iniciou')
    }
    resolve({
      async render(canvas) {
        const result = await call('Runtime.evaluate', {
          expression: `window.renderTemplate(${JSON.stringify(canvas)},${canvas.width},${canvas.height})`,
          awaitPromise: true, returnByValue: true
        })
        if (result.exceptionDetails || !result.result?.value?.startsWith('data:image/png')) {
          throw new Error(`Falha ao renderizar: ${JSON.stringify(result.exceptionDetails || result)}`)
        }
        return Buffer.from(result.result.value.split(',')[1], 'base64')
      },
      async close() { ws.close(); chrome.kill(); await new Promise(ok => server.close(ok)) }
    })
    } catch (error) { reject(error) }
  })
  server.on('error', reject)
})

const loadDonor = async () => {
  const database = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL })
  database.on('error', () => {})
  await database.connect()
  try {
    const project = await database.query('select canvas_data from projects where id=$1 and user_id=$2 and is_template=true', [DEFAULT_DONOR_TEMPLATE_ID, OWNER_ID])
    const page = project.rows[0]?.canvas_data?.find(item => item?.canvasDataPath)
    if (!page) throw new Error('Página doadora ausente')
    const key = String(page.canvasDataPath).replace(/^\/api\/storage\/p\?key=/, '')
    const decoded = key.startsWith('projects/') || key.startsWith('imagens/') ? key : new URL(page.canvasDataPath, 'http://local').searchParams.get('key')
    const s3 = new S3Client({
      endpoint: process.env.WASABI_ENDPOINT?.startsWith('http') ? process.env.WASABI_ENDPOINT : `https://${process.env.WASABI_ENDPOINT}`,
      region: process.env.WASABI_REGION, forcePathStyle: true,
      credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY }
    })
    const response = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: decoded }))
    let bytes = Buffer.from(await response.Body.transformToByteArray())
    if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes)
    const canvas = JSON.parse(String(bytes))
    const zone = canvas.objects?.find(object => object?.isProductZone)
    if (!zone) throw new Error('Zona doadora ausente')
    s3.destroy()
    return zone
  } finally {
    await database.end().catch(() => {})
  }
}

const hash = value => createHash('sha256').update(value).digest('hex')

const persist = async (pages) => {
  const database = new pg.Client({ connectionString: process.env.POSTGRES_DATABASE_URL })
  database.on('error', error => console.error(`[ultima-chance] banco: ${error.message}`))
  await database.connect()
  const existing = await database.query(
    `select id, template_config from projects where user_id=$1 and is_template=true and name=$2`,
    [OWNER_ID, MODEL_NAME]
  )
  const update = process.argv.includes('--update')
  if (existing.rowCount && !update) throw new Error(`Já existe um modelo "${MODEL_NAME}" (${existing.rows[0].id}). Não vou criar outro.`)
  if (!existing.rowCount && update) throw new Error(`Modelo "${MODEL_NAME}" não existe para atualizar.`)
  const projectId = existing.rows[0]?.id || id()
  const modelId = pages[0].meta.templateModelId
  const s3 = new S3Client({
    endpoint: process.env.WASABI_ENDPOINT?.startsWith('http') ? process.env.WASABI_ENDPOINT : `https://${process.env.WASABI_ENDPOINT}`,
    region: process.env.WASABI_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY }
  })
  const revision = Date.now()
  const iconKeys = new Map()
  for (const file of ['whatsapp.png', 'instagram.png', 'facebook.png', 'address.png']) {
    const key = `${ASSET_PREFIX}/icons/${file}`
    await s3.send(new PutObjectCommand({
      Bucket: process.env.WASABI_BUCKET, Key: key,
      Body: await readFile(join(artDir, file)), ContentType: 'image/png'
    }))
    iconKeys.set(`/asset/${file}`, `/api/storage/p?key=${encodeURIComponent(key)}`)
  }
  const storedPages = []
  for (const page of pages) {
    const background = page.canvas.objects.find(object => object.name === 'offerBackground')
    const format = page.meta.templateFormatId
    const backgroundKey = `${ASSET_PREFIX}/${format}.png`
    await s3.send(new PutObjectCommand({
      Bucket: process.env.WASABI_BUCKET, Key: backgroundKey,
      Body: await readFile(join(artDir, `${format}.png`)), ContentType: 'image/png'
    }))
    background.src = `/api/storage/p?key=${encodeURIComponent(backgroundKey)}`
    for (const object of page.canvas.objects) {
      if (typeof object.src === 'string' && iconKeys.has(object.src)) object.src = iconKeys.get(object.src)
    }
    const raw = Buffer.from(JSON.stringify(page.canvas))
    const canvasKey = `projects/${OWNER_ID}/${projectId}/ultima-chance/${revision}/page_${page.meta.id}.json.gz`
    const thumbKey = `projects/${OWNER_ID}/${projectId}/ultima-chance/${revision}/thumb_${page.meta.id}.png`
    await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: canvasKey, Body: gzipSync(raw), ContentType: 'application/json', ContentEncoding: 'gzip' }))
    await s3.send(new PutObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: thumbKey, Body: page.thumbnail, ContentType: 'image/png' }))
    const back = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: canvasKey }))
    let bytes = Buffer.from(await back.Body.transformToByteArray())
    if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes)
    if (hash(bytes) !== hash(raw)) throw new Error(`Readback divergente em ${format}`)
    storedPages.push({
      ...page.meta,
      canvasDataPath: canvasKey,
      thumbnailUrl: thumbKey,
      canvasSavedAt: new Date().toISOString()
    })
  }
  const config = {
    version: 1,
    category: 'Ofertas',
    models: [{ id: modelId, name: MODEL_NAME }],
    defaultModelId: modelId,
    defaultFormatId: 'feed',
    formatIds: TEMPLATE_FORMATS.map(([formatId]) => formatId),
    pageBlueprints: storedPages.map(({ id: sourcePageId, ...page }) => ({ ...page, sourcePageId }))
  }
  const preview = storedPages.find(page => page.templateFormatId === 'feed')?.thumbnailUrl
  await database.query('begin')
  try {
    if (update) {
      const result = await database.query(
        `update public.projects
            set canvas_data=$1::jsonb, preview_url=$2, template_config=$3::jsonb, updated_at=now()
          where id=$4 and user_id=$5 and is_template=true and name=$6`,
        [JSON.stringify(storedPages), preview, JSON.stringify(config), projectId, OWNER_ID, MODEL_NAME]
      )
      if (result.rowCount !== 1) throw new Error('Não foi possível atualizar o modelo Última Chance')
    } else {
      await database.query(
        `insert into public.projects
           (id, name, canvas_data, preview_url, user_id, updated_at, is_template, template_config)
         values ($1, $2, $3::jsonb, $4, $5, now(), true, $6::jsonb)`,
        [projectId, MODEL_NAME, JSON.stringify(storedPages), preview, OWNER_ID, JSON.stringify(config)]
      )
    }
    await database.query('commit')
  } catch (error) {
    await database.query('rollback').catch(() => {})
    throw error
  }
  s3.destroy()
  await database.end()
  return { projectId, modelId }
}

const run = async () => {
  const apply = process.argv.includes('--apply')
  await mkdir(artDir, { recursive: true })
  await mkdir(previewDir, { recursive: true })
  for (const [name, svg] of Object.entries(iconSvg)) {
    await sharp(Buffer.from(svg)).resize(128, 128).png().toFile(join(artDir, `${name}.png`))
  }
  const layout = JSON.parse(await readFile(join(artDir, 'layout.json'), 'utf8'))
  const donor = await loadDonor()
  const modelId = id()
  const pages = []
  for (const format of TEMPLATE_FORMATS) {
    const [templateFormatId, templateFormatLabel, width, height] = format
    const spec = layout[templateFormatId]
    if (spec.width !== width || spec.height !== height) throw new Error(`Fundo ${templateFormatId} fora do formato`)
    const meta = {
      id: id(), name: `${MODEL_NAME} · ${templateFormatLabel}`, type: 'RETAIL_OFFER', width, height,
      templateModelId: modelId, templateModelName: MODEL_NAME, templateFormatId, templateFormatLabel,
      templateThemeId: modelId, templateThemeName: MODEL_NAME, templateCompositionManaged: true
    }
    const canvas = buildPage(spec, meta, donor, true)
    pages.push({ meta, canvas, spec })
  }
  const renderer = await createRenderer()
  try {
    for (const page of pages) {
      let png = await renderer.render(page.canvas)
      if (page.spec.payment) png = await paintCards(png, page.spec.payment)
      page.thumbnail = png
      await writeFile(join(previewDir, `${page.meta.templateFormatId}.png`), png)
      console.error(`[ultima-chance] prévia ${page.meta.templateFormatId}`)
    }
  } finally {
    await renderer.close()
  }
  const gallery = `<!doctype html><meta charset="utf-8"><title>Última Chance</title>
<style>body{margin:0;background:#111;color:#fff;font-family:sans-serif}figure{margin:16px}img{max-width:100%;background:#222}</style>
${pages.map(page => `<figure><figcaption>${page.meta.templateFormatLabel} · ${page.meta.width}×${page.meta.height}</figcaption><img src="${page.meta.templateFormatId}.png"></figure>`).join('')}`
  await writeFile(join(previewDir, 'index.html'), gallery)
  if (!apply) {
    console.log(JSON.stringify({ preview: previewDir, saved: false }))
    return
  }
  const saved = await persist(pages)
  console.log(JSON.stringify({ preview: previewDir, saved }))
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1 })

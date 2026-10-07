import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generateThumbnailFromCanvasJson } from '../../utils/editorThumbnail'

// Desenho nativo (fabric + node-canvas) da prévia do catálogo. É trabalho síncrono de CPU:
// em produção roda num processo filho (workers/catalog-preview/render-worker) para não travar
// o processo que atende login, páginas e o healthcheck. Este módulo não acessa rede nem banco;
// só grava as imagens embutidas em arquivos temporários durante o desenho.

export type CatalogPreviewDrawKind = 'flyer' | 'label'

export type CatalogPreviewDrawInput = {
  kind: CatalogPreviewDrawKind
  /** Canvas já neutralizado e com imagens embutidas (data URLs). */
  canvasJson: any
  width: number
  height: number
}

const MAX_IMAGE_PIXELS = 24_000_000

const loadFontsOnce = (() => {
  let loaded: Promise<void> | null = null
  return () => {
    if (loaded) return loaded
    loaded = (async () => {
      const candidates = [
        resolve(process.cwd(), 'public/art-studio/fonts'),
        resolve(process.cwd(), '.output/public/art-studio/fonts')
      ]
      for (const directory of candidates) {
        try {
          const fontFiles = (await readdir(directory)).filter(file => /\.ttf$/i.test(file))
          if (fontFiles.length) {
            const { registerFont } = await import('canvas')
            for (const file of fontFiles) {
              const stem = file.replace(/\.ttf$/i, '')
              const parts = stem.split('-')
              const variant = parts.pop() || ''
              const family = parts.join('-') || stem
              registerFont(resolve(directory, file), {
                family,
                weight: /ExtraBold/i.test(variant) ? '800' : /SemiBold/i.test(variant) ? '600' : /Bold/i.test(variant) ? '700' : /Light/i.test(variant) ? '300' : '400',
                style: /Italic/i.test(variant) ? 'italic' : 'normal'
              })
            }
            return
          }
        } catch {
          // Tenta o próximo local de fontes do runtime.
        }
      }
      throw new Error('Fontes de catálogo indisponíveis no runtime.')
    })()
    // Falha não fica em cache: a próxima prévia tenta de novo.
    loaded.catch(() => { loaded = null })
    return loaded
  }
})()

/**
 * Troca as imagens embutidas (data URLs) por arquivos temporários (file://). O jsdom do fabric/node
 * interpreta uma data URL de vários MB caractere por caractere: num modelo real eram 13 s de CPU
 * só nisso (o desenho em si leva < 1 s) e, no servidor de produção, passava do tempo limite.
 * Com file:// o jsdom lê o arquivo direto; a imagem final é idêntica.
 */
const externalizeDataImages = async (canvasJson: any, directory: string): Promise<void> => {
  const files = new Map<string, string>()
  const seen = new WeakSet<object>()
  const pending: unknown[] = [canvasJson]
  while (pending.length) {
    const node = pending.pop()
    if (!node || typeof node !== 'object' || seen.has(node)) continue
    seen.add(node)
    const record = node as Record<string, unknown>
    for (const property of ['src', 'source'] as const) {
      const value = record[property]
      if (typeof value !== 'string' || !value.startsWith('data:')) continue
      const comma = value.indexOf(',')
      if (comma < 0 || !/;base64$/i.test(value.slice(0, comma))) continue
      let url = files.get(value)
      if (!url) {
        const extension = value.slice(5, comma).match(/^image\/(png|jpe?g|webp|gif|svg\+xml)/i)?.[1]?.replace('svg+xml', 'svg') || 'png'
        const file = join(directory, `${files.size}.${extension}`)
        await writeFile(file, Buffer.from(value.slice(comma + 1), 'base64'))
        url = pathToFileURL(file).href
        files.set(value, url)
      }
      record[property] = url
    }
    for (const child of Object.values(record)) if (child && typeof child === 'object') pending.push(child)
  }
}

/** Desenha a prévia e devolve WebP otimizado. */
export const drawCatalogPreview = async (input: CatalogPreviewDrawInput): Promise<Buffer> => {
  const directory = await mkdtemp(join(tmpdir(), 'catalog-preview-'))
  try {
    await externalizeDataImages(input.canvasJson, directory)
    return await drawPreparedCatalogPreview(input)
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
  }
}

const drawPreparedCatalogPreview = async (input: CatalogPreviewDrawInput): Promise<Buffer> => {
  const { kind, canvasJson, width, height } = input
  await loadFontsOnce()
  const fabric = await import('fabric/node')
  const { StaticCanvas, getEnv } = fabric
  const document = getEnv().document
  let renderedBytes: Buffer
  if (kind === 'label') {
    const preview = new StaticCanvas(document.createElement('canvas'), {
      width: 320,
      height: 160,
      backgroundColor: 'transparent',
      enableRetinaScaling: false
    })
    try {
      const [group] = await fabric.util.enlivenObjects([canvasJson]) as any[]
      if (!group || typeof group.getBoundingRect !== 'function') throw new Error('Grupo da etiqueta inválido.')
      preview.add(group)
      group.setCoords()
      const bounds = group.getBoundingRect()
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) throw new Error('Grupo da etiqueta sem dimensões.')
      const fit = Math.min(288 / bounds.width, 128 / bounds.height)
      group.scaleX *= fit
      group.scaleY *= fit
      group.setCoords()
      const fitted = group.getBoundingRect()
      group.set({
        left: Number(group.left || 0) + 160 - (fitted.left + fitted.width / 2),
        top: Number(group.top || 0) + 80 - (fitted.top + fitted.height / 2)
      })
      group.setCoords()
      preview.renderAll()
      const dataUrl = preview.toDataURL({ format: 'png', multiplier: 1 })
      const dataMatch = dataUrl.match(/^data:image\/png;base64,([a-z\d+/]+=*)$/i)
      if (!dataMatch) throw new Error('O renderer nativo não produziu uma imagem válida.')
      renderedBytes = Buffer.from(dataMatch[1]!, 'base64')
    } finally {
      await preview.dispose()
    }
  } else {
    const dataUrl = await generateThumbnailFromCanvasJson({
      sourceJson: canvasJson,
      staticCanvasCtor: StaticCanvas,
      document: document as unknown as Pick<Document, 'createElement'>,
      pageWidth: width,
      pageHeight: height
    })
    const dataMatch = dataUrl.match(/^data:image\/(?:png|webp);base64,([a-z\d+/]+=*)$/i)
    if (!dataMatch) throw new Error('O renderer nativo não produziu uma imagem válida.')
    renderedBytes = Buffer.from(dataMatch[1]!, 'base64')
  }
  const { default: sharp } = await import('sharp')
  const result = await sharp(renderedBytes, { limitInputPixels: MAX_IMAGE_PIXELS }).webp({ quality: 76 }).toBuffer()
  if (!result.length || result.length > 8 * 1024 * 1024) throw new Error('A prévia renderizada excede o limite permitido.')
  return result
}

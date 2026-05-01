import { blobFromDataLikeUrl } from './browserBlob'

export type ExportImageFormat = 'png' | 'jpg'
export type ExportQualityPreset = 'print-300' | 'ultra-600'

/**
 * Multiplicador padrao de scale para export de alta resolucao (6x).
 * Suficiente para impressao em 300dpi a partir de canvas em viewport
 * de tela.
 */
export const HIGH_RES_EXPORT_SCALE = 6

/**
 * Qualidade JPG para export de alta resolucao (1.0 = max). PNG ignora
 * este valor (e lossless), mas mantemos a constante unificada.
 */
export const HIGH_RES_EXPORT_QUALITY = 1

/**
 * Saturacao aplicada na pos-pipeline de export para realcar cores
 * impressas (impressoras tendem a "comer" 5-10% da saturacao).
 */
export const EXPORT_COLOR_SATURATION = 1.12

/**
 * Contraste aplicado na pos-pipeline de export. Compensa perda de
 * contraste em papel comum.
 */
export const EXPORT_COLOR_CONTRAST = 1.08

/**
 * Brilho aplicado na pos-pipeline de export. Pequeno ajuste para
 * manter brancos puros mesmo apos contraste/saturacao.
 */
export const EXPORT_COLOR_BRIGHTNESS = 1.02

/**
 * Quality preset default quando o usuario nao seleciona explicitamente.
 * 'ultra-600' = 600dpi (overkill mas seguro para qualquer impressao).
 */
export const DEFAULT_EXPORT_QUALITY_PRESET: ExportQualityPreset = 'ultra-600'

/**
 * Modo default para export de multiplos frames: 'zip' agrupa em um
 * unico download, 'separate' faz N downloads individuais.
 */
export const DEFAULT_MULTI_FILE_MODE: 'zip' | 'separate' = 'zip'

/**
 * Normaliza string vinda da UI para um ExportImageFormat valido.
 * Aceita "jpeg" ou "jpg" como sinonimos para 'jpg'; qualquer outro
 * valor cai no default 'png'.
 */
export const normalizeExportImageFormat = (format: any): ExportImageFormat => (
    String(format) === 'jpeg' || String(format) === 'jpg' ? 'jpg' : 'png'
)

/**
 * Normaliza string vinda da UI para um ExportQualityPreset valido.
 * Apenas 'print-300' e reconhecido; qualquer outro valor cai em
 * 'ultra-600' (default de alta qualidade).
 */
export const normalizeExportQualityPreset = (value: any): ExportQualityPreset => (
    String(value) === 'print-300' ? 'print-300' : 'ultra-600'
)

const EXPORT_MAX_CANVAS_DIMENSION = 16384
const EXPORT_MAX_CANVAS_AREA = 140_000_000
const PDF_BASE_DPI = 300

export type ExportRetryInput = {
  width: number
  height: number
  qualityPreset: ExportQualityPreset
  format: ExportImageFormat
  renderDataUrlAtMultiplier: (multiplier: number) => Promise<string> | string
  postProcessDataUrl?: (dataUrl: string) => Promise<string> | string
}

export type ExportBlobResult = {
  blob: Blob
  dataUrl: string
  requestedMultiplier: number
  appliedMultiplier: number
  reducedFromRequested: boolean
  triedMultipliers: number[]
}

export type ZipEntryInput = {
  fileName: string
  blob: Blob
}

export type PdfPageInput = {
  imageBlob: Blob
  pageWidthPx: number
  pageHeightPx: number
}

const roundMultiplier = (value: number): number => {
  if (!Number.isFinite(value)) return 1
  return Number(Math.max(1, value).toFixed(3))
}

const clampMinPositive = (value: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, parsed)
}

export const getRequestedMultiplier = (
  qualityPreset: ExportQualityPreset,
  width: number,
  height: number
): number => {
  if (qualityPreset !== 'ultra-600') return 1

  const safeWidth = clampMinPositive(width)
  const safeHeight = clampMinPositive(height)
  const maxSide = Math.max(safeWidth, safeHeight)

  if (maxSide <= 1400) return 4
  if (maxSide <= 2200) return 3
  if (maxSide <= 3000) return 2.5
  return 2
}

export const getSafeMultiplier = (
  width: number,
  height: number,
  requested: number
): number => {
  const safeWidth = clampMinPositive(width)
  const safeHeight = clampMinPositive(height)
  const sourceArea = safeWidth * safeHeight
  const requestedScale = clampMinPositive(requested)

  const maxByDimension = Math.min(
    EXPORT_MAX_CANVAS_DIMENSION / safeWidth,
    EXPORT_MAX_CANVAS_DIMENSION / safeHeight
  )
  const maxByArea = Math.sqrt(EXPORT_MAX_CANVAS_AREA / Math.max(1, sourceArea))
  const hardLimit = Math.max(1, Math.min(maxByDimension, maxByArea))

  return roundMultiplier(Math.min(requestedScale, hardLimit))
}

export const buildMultiplierLadder = (start: number): number[] => {
  const first = roundMultiplier(start)
  if (first <= 1) return [1]

  const raw = [
    first,
    first * 0.85,
    first * 0.72,
    first * 0.6,
    first * 0.5,
    1
  ]
  const rounded = raw.map(roundMultiplier).filter((n) => n >= 1)
  const unique = Array.from(new Set(rounded))
  unique.sort((a, b) => b - a)
  if (unique[unique.length - 1] !== 1) unique.push(1)
  return unique
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const blob = await blobFromDataLikeUrl(dataUrl)
  if (!blob || blob.size <= 0) {
    throw new Error('Blob de exportação vazio')
  }
  return blob
}

const exportWithRetry = async (input: ExportRetryInput): Promise<ExportBlobResult> => {
  const requestedMultiplier = getRequestedMultiplier(input.qualityPreset, input.width, input.height)
  const safeStart = getSafeMultiplier(input.width, input.height, requestedMultiplier)
  const ladder = buildMultiplierLadder(safeStart)
  const triedMultipliers: number[] = []
  let lastError: unknown = null

  for (const multiplier of ladder) {
    triedMultipliers.push(multiplier)
    try {
      let dataUrl = await input.renderDataUrlAtMultiplier(multiplier)
      if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
        throw new Error('Data URL inválida para exportação')
      }
      if (input.postProcessDataUrl) {
        dataUrl = await input.postProcessDataUrl(dataUrl)
      }
      const blob = await dataUrlToBlob(dataUrl)
      return {
        blob,
        dataUrl,
        requestedMultiplier,
        appliedMultiplier: multiplier,
        reducedFromRequested: multiplier + 0.0001 < requestedMultiplier,
        triedMultipliers
      }
    } catch (err) {
      lastError = err
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new Error('Falha ao exportar após múltiplas tentativas')
}

export const exportFrameAsBlob = async (input: ExportRetryInput): Promise<ExportBlobResult> => {
  return await exportWithRetry(input)
}

export const exportObjectAsBlob = async (input: ExportRetryInput): Promise<ExportBlobResult> => {
  return await exportWithRetry(input)
}

export const sanitizeExportFileToken = (value: string, fallback = 'arquivo'): string => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return token || fallback
}

const sanitizeZipEntryName = (value: string): string => {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || `arquivo-${Date.now()}`
}

const normalizeUint8ToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  // FIX: avoid an unnecessary copy when the Uint8Array already covers the
  // entire backing buffer (common case for zipSync/pdfDoc.save output).
  // This halves peak memory for large exports.
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) {
    return bytes.buffer as ArrayBuffer
  }
  const start = bytes.byteOffset
  const end = bytes.byteOffset + bytes.byteLength
  return bytes.buffer.slice(start, end) as ArrayBuffer
}

export const formatExportTimestampToken = (date = new Date()): string => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${min}`
}

export const buildZipBlob = async (files: ZipEntryInput[]): Promise<Blob> => {
  const validFiles = (files || []).filter((file) => file?.blob && file?.fileName)
  if (!validFiles.length) {
    throw new Error('Nenhum arquivo válido para compactar')
  }

  const { zipSync } = await import('fflate')
  const entries: Record<string, Uint8Array> = {}
  const nameCount = new Map<string, number>()

  const toUniqueZipName = (rawName: string) => {
    const normalized = sanitizeZipEntryName(rawName)
    const dotIndex = normalized.lastIndexOf('.')
    const hasExt = dotIndex > 0 && dotIndex < normalized.length - 1
    const stem = hasExt ? normalized.slice(0, dotIndex) : normalized
    const ext = hasExt ? normalized.slice(dotIndex) : ''
    const current = Number(nameCount.get(normalized) || 0)
    if (current <= 0) {
      nameCount.set(normalized, 1)
      return normalized
    }
    const next = current + 1
    nameCount.set(normalized, next)
    return `${stem}-${next}${ext}`
  }

  for (const file of validFiles) {
    const fileName = toUniqueZipName(file.fileName)
    const buffer = await file.blob.arrayBuffer()
    entries[fileName] = new Uint8Array(buffer)
  }

  const zipped = zipSync(entries, { level: 6 })
  return new Blob([normalizeUint8ToArrayBuffer(zipped)], { type: 'application/zip' })
}

const pxToPt = (px: number, dpi: number) => (clampMinPositive(px) * 72) / clampMinPositive(dpi)

export const buildPdfBlob = async (
  pages: PdfPageInput[],
  opts: { dpiBase?: number } = {}
): Promise<Blob> => {
  const validPages = (pages || []).filter((page) => page?.imageBlob && page?.pageWidthPx > 0 && page?.pageHeightPx > 0)
  if (!validPages.length) {
    throw new Error('Nenhuma página válida para gerar PDF')
  }

  const dpiBase = clampMinPositive(opts.dpiBase ?? PDF_BASE_DPI)
  const { PDFDocument } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()

  for (const page of validPages) {
    const mime = String(page.imageBlob.type || '').toLowerCase()
    // FIX: pdf-lib only supports JPEG and PNG embedding.  If the image blob
    // is WebP, AVIF, or has an unknown/empty MIME type, convert it to PNG via
    // an offscreen canvas before embedding — otherwise pdfDoc.embedPng would
    // throw a cryptic error because the bytes are not valid PNG.
    let imageBlob = page.imageBlob
    if (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png')) {
      try {
        const bitmap = await createImageBitmap(imageBlob)
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0)
          imageBlob = await canvas.convertToBlob({ type: 'image/png' })
        }
        bitmap.close()
      } catch (convErr) {
        console.warn('[PDF] Failed to convert non-PNG/JPEG image, attempting raw embed:', convErr)
      }
    }
    const bytes = await imageBlob.arrayBuffer()
    const finalMime = String(imageBlob.type || '').toLowerCase()
    const image = finalMime.includes('jpeg') || finalMime.includes('jpg')
      ? await pdfDoc.embedJpg(bytes)
      : await pdfDoc.embedPng(bytes)

    const pageWidthPt = pxToPt(page.pageWidthPx, dpiBase)
    const pageHeightPt = pxToPt(page.pageHeightPx, dpiBase)
    const pdfPage = pdfDoc.addPage([pageWidthPt, pageHeightPt])
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: pageWidthPt,
      height: pageHeightPt
    })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([normalizeUint8ToArrayBuffer(pdfBytes)], { type: 'application/pdf' })
}

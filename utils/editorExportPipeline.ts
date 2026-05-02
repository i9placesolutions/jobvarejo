import { blobFromDataLikeUrl } from './browserBlob'
import {
  clampExportMinPositive,
  getRequestedMultiplier,
  getSafeMultiplier,
  roundExportMultiplier,
  type ExportImageFormat,
  type ExportQualityPreset
} from './editorExportConfig'

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

export const buildMultiplierLadder = (start: number): number[] => {
  const first = roundExportMultiplier(start)
  if (first <= 1) return [1]

  const raw = [
    first,
    first * 0.85,
    first * 0.72,
    first * 0.6,
    first * 0.5,
    1
  ]
  const rounded = raw.map(roundExportMultiplier).filter((n) => n >= 1)
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

const pxToPt = (px: number, dpi: number) => (clampExportMinPositive(px) * 72) / clampExportMinPositive(dpi)

export const buildPdfBlob = async (
  pages: PdfPageInput[],
  opts: { dpiBase?: number } = {}
): Promise<Blob> => {
  const validPages = (pages || []).filter((page) => page?.imageBlob && page?.pageWidthPx > 0 && page?.pageHeightPx > 0)
  if (!validPages.length) {
    throw new Error('Nenhuma página válida para gerar PDF')
  }

  const dpiBase = clampExportMinPositive(opts.dpiBase ?? PDF_BASE_DPI)
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

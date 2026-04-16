import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { parseProductsAuto, type ParsedProduct } from '../utils/product-text-parser'

const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_TEXT_CHARS = 60_000
const PDF_PARSE_TIMEOUT_MS = 28_000

const clampText = (value: unknown, maxChars = MAX_TEXT_CHARS): string => {
    const text = String(value ?? '').trim()
    if (!text) return ''
    return text.length > maxChars ? text.slice(0, maxChars) : text
}

const getErrorMessage = (err: any, fallback: string): string => {
    const msg = String(
        err?.data?.message ||
        err?.data?.statusMessage ||
        err?.statusMessage ||
        err?.message ||
        err?.cause?.message ||
        fallback
    ).trim()
    return msg || fallback
}

const parsePdfBufferToText = async (buf: Buffer): Promise<string> => {
    process.env.PDF2JSON_DISABLE_LOGS = process.env.PDF2JSON_DISABLE_LOGS || '1'
    const mod: any = await import('pdf2json')
    const PDFParser = mod?.default || mod
    const parser = new PDFParser(undefined, 1)

    return await new Promise<string>((resolve, reject) => {
        let settled = false
        const done = (cb: () => void) => {
            if (settled) return
            settled = true
            clearTimeout(timeoutId)
            try { parser.removeAllListeners?.() } catch { /* ignore */ }
            cb()
        }

        const timeoutId = setTimeout(() => {
            done(() => reject(new Error(`PDF parse timeout após ${PDF_PARSE_TIMEOUT_MS / 1000}s`)))
        }, PDF_PARSE_TIMEOUT_MS)

        parser.on('pdfParser_dataError', (errData: any) => {
            done(() => reject(errData?.parserError || errData || new Error('Failed to parse PDF')))
        })
        parser.on('pdfParser_dataReady', () => {
            done(() => {
                const rawText = typeof parser.getRawTextContent === 'function'
                    ? parser.getRawTextContent()
                    : ''
                resolve(String(rawText || ''))
            })
        })

        try {
            parser.parseBuffer(buf, 0)
        } catch (err) {
            done(() => reject(err))
        }
    })
}

export default defineEventHandler(async (event) => {
    try {
        const user = await requireAuthenticatedUser(event)
        await enforceRateLimit(event, `parse-products:${user.id}`, 60, 60_000)

        const contentType = String(getHeader(event, 'content-type') || '')
        let text: string | undefined
        let filename: string | undefined

        if (contentType.includes('multipart/form-data')) {
            const form = await readMultipartFormData(event)
            const textPart = form?.find(p => p.name === 'text')
            if (textPart?.data) text = clampText(Buffer.from(textPart.data).toString('utf8'))

            const filePart = form?.find(p => p.name === 'file')
            if (filePart?.data) {
                filename = filePart.filename || undefined
                const mime = String(filePart.type || '')
                const buf = Buffer.from(filePart.data)
                const fileSize = Number(buf.length || 0)
                if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
                    throw createError({ statusCode: 400, statusMessage: 'Tamanho de arquivo inválido (max 12MB)' })
                }

                if (mime.startsWith('image/')) {
                    throw createError({
                        statusCode: 415,
                        statusMessage: 'Importação por imagem foi desativada',
                        message: 'Cole o texto da lista ou faça upload de uma planilha (CSV/XLSX) ou PDF.'
                    })
                }

                const ext = (filename || '').toLowerCase().split('.').pop() || ''

                if (mime === 'application/pdf' || ext === 'pdf') {
                    text = clampText(await parsePdfBufferToText(buf))
                } else if (
                    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    mime === 'application/vnd.ms-excel' ||
                    ext === 'xlsx' ||
                    ext === 'xls'
                ) {
                    // @ts-expect-error subpath import intencional para evitar bundle CJS pesado
                    const mod: any = await import('xlsx/xlsx.mjs')
                    const XLSX = mod?.default || mod
                    try {
                        const wb = XLSX.read(buf, { type: 'buffer' })
                        const sheetName = wb.SheetNames?.[0]
                        const sheet = sheetName ? wb.Sheets?.[sheetName] : null
                        const csvRaw = sheet ? (XLSX.utils.sheet_to_csv(sheet, { FS: ';' }) || '') : ''
                        // Log para debug: mostra as primeiras linhas do CSV gerado
                        if (process.dev) {
                            const previewLines = csvRaw.split('\n').slice(0, 5).map((l: string, i: number) => `  [${i}] ${l}`)
                            console.log(`📋 [parse-products] CSV do XLSX (${csvRaw.length} chars, sheet: "${sheetName}"):\n${previewLines.join('\n')}`)
                        }
                        text = clampText(csvRaw)
                    } catch (xlsxErr: any) {
                        console.warn('⚠️ Falha ao ler Excel, tentando fallback texto:', xlsxErr?.message)
                        try { text = clampText(buf.toString('utf8')) } catch { text = '' }
                    }
                } else {
                    text = clampText(buf.toString('utf8'))
                }
            }
        } else {
            const body: any = await readBody(event)
            text = clampText(body?.text)

            if (!text && body?.image) {
                throw createError({
                    statusCode: 415,
                    statusMessage: 'Importação por imagem foi desativada',
                    message: 'Cole o texto da lista ou faça upload de uma planilha (CSV/XLSX) ou PDF.'
                })
            }
        }

        if (!text) {
            throw createError({ statusCode: 400, statusMessage: 'Texto ou arquivo é obrigatório' })
        }

        let products: ParsedProduct[]
        try {
            products = parseProductsAuto(text)
        } catch (parserErr: any) {
            console.error('❌ [parse-products] Falha no parser determinístico:', parserErr)
            throw createError({
                statusCode: 422,
                statusMessage: 'Não foi possível interpretar a lista',
                message: getErrorMessage(parserErr, 'Verifique o formato e tente novamente.')
            })
        }

        if (!products.length) {
            throw createError({
                statusCode: 422,
                statusMessage: 'Nenhum produto identificado',
                message: 'Verifique se o texto/planilha contém linhas com nome do produto e preço.'
            })
        }

        return { products }
    } catch (err: any) {
        const statusCode = Number(err?.statusCode || err?.status || 0)
        if (statusCode > 0) throw err
        console.error('Parse products error:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Falha ao processar produtos',
            message: getErrorMessage(err, 'Erro inesperado no parser')
        })
    }
})

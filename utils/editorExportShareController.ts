import { isValidClipPath } from '~/utils/canvasValidation'
import {
    downloadFile,
    downloadBlob,
    downloadMultipleFiles,
    shareFileFromDataUrl
} from '~/utils/editorFileTransfer'
import {
    buildExportPreflightWarnings,
    computeExportPreflightCounts
} from '~/utils/exportPreflightChecks'
import { getSelectedObjectExportFileBaseName } from '~/utils/exportSelectionHelpers'
import {
    EXPORT_COLOR_BRIGHTNESS,
    EXPORT_COLOR_CONTRAST,
    EXPORT_COLOR_SATURATION,
    DEFAULT_EXPORT_QUALITY_PRESET,
    DEFAULT_MULTI_FILE_MODE,
    HIGH_RES_EXPORT_QUALITY,
    HIGH_RES_EXPORT_SCALE,
    getRequestedMultiplier,
    getSafeMultiplier,
    normalizeExportImageFormat,
    normalizeExportQualityPreset,
    type ExportImageFormat,
    type ExportQualityPreset
} from '~/utils/editorExportConfig'
import {
    getFrameBounds,
    getFrameDisplayNameForExport
} from '~/utils/frameGeometry'

type RefLike<T> = { value: T }

export type EditorExportShareContext = {
    canvas: RefLike<any>
    exportSettings: RefLike<any>
    shareSettings: RefLike<any>
    showExportModal: RefLike<boolean>
    showShareModal: RefLike<boolean>
    isExportDownloadInProgress: RefLike<boolean>
    getAllFrames: () => any[]
    getFrameById: (id: string) => any
    isLikelyProductZone: (obj: any) => boolean
    resolveExportableSelectedObject: (preferred?: any) => any | null
    sanitizeAllClipPaths: () => void
    safeRequestRenderAll: () => void
    makeExportBatchBaseName: () => string
    startExportDownloadFeedback: (status?: string) => number
    stopExportDownloadFeedback: (token: number) => Promise<void>
    notifyEditorInfo: (message: string) => void
    notifyEditorError: (message: string) => void
}

const loadEditorExportPipeline = () => import('~/utils/editorExportPipeline')

type ScopedBlobExport = {
    blob: Blob
    fileName: string
    format: ExportImageFormat
    baseWidth: number
    baseHeight: number
    reducedFromRequested: boolean
}

const makeExportColorsVivid = async (
    dataUrl: string,
    format: 'png' | 'jpg' | 'jpeg',
    quality = HIGH_RES_EXPORT_QUALITY
): Promise<string> => {
    if (!dataUrl || typeof window === 'undefined') return dataUrl

    return await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
            try {
                const width = Math.max(1, Number(img.naturalWidth || img.width || 1))
                const height = Math.max(1, Number(img.naturalHeight || img.height || 1))
                const out = document.createElement('canvas')
                out.width = width
                out.height = height
                const ctx = out.getContext('2d')
                if (!ctx) {
                    resolve(dataUrl)
                    return
                }

                ctx.imageSmoothingEnabled = true
                ;(ctx as any).imageSmoothingQuality = 'high'
                ctx.filter = `saturate(${EXPORT_COLOR_SATURATION}) contrast(${EXPORT_COLOR_CONTRAST}) brightness(${EXPORT_COLOR_BRIGHTNESS})`
                ctx.drawImage(img, 0, 0, width, height)
                ctx.filter = 'none'

                const normalizedFormat = format === 'jpg' ? 'jpeg' : format
                const mime = normalizedFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
                const normalizedQuality = Math.max(0.9, Math.min(1, Number(quality) || 1))
                resolve(out.toDataURL(mime, normalizedQuality))
            } catch {
                resolve(dataUrl)
            }
        }
        img.onerror = () => resolve(dataUrl)
        img.src = dataUrl
    })
}

const runWithNeutralViewport = async <T>(
    ctx: EditorExportShareContext,
    action: () => Promise<T> | T
): Promise<T> => {
    if (!ctx.canvas.value) return await action()

    const c: any = ctx.canvas.value
    const prevVpt = Array.isArray(c.viewportTransform) ? [...c.viewportTransform] : [1, 0, 0, 1, 0, 0]
    const prevRenderOnAddRemove = c.renderOnAddRemove
    const prevSkipOffscreen = c.skipOffscreen
    const cacheSnapshot = (c.getObjects?.() || []).map((obj: any) => ({
        obj,
        objectCaching: obj?.objectCaching,
        noScaleCache: obj?.noScaleCache,
        statefullCache: obj?.statefullCache
    }))

    try {
        c.renderOnAddRemove = false
        c.skipOffscreen = false
        cacheSnapshot.forEach((state: any) => {
            const obj = state?.obj
            if (!obj) return
            obj.objectCaching = false
            obj.noScaleCache = false
            obj.statefullCache = false
            obj.dirty = true
            obj.setCoords?.()
        })
        c.setViewportTransform([1, 0, 0, 1, 0, 0])
        c.calcOffset?.()
        c.requestRenderAll?.()
        await new Promise(resolve => setTimeout(resolve, 0))
        return await action()
    } finally {
        c.setViewportTransform(prevVpt)
        c.renderOnAddRemove = prevRenderOnAddRemove
        c.skipOffscreen = prevSkipOffscreen
        cacheSnapshot.forEach((state: any) => {
            const obj = state?.obj
            if (!obj) return
            obj.objectCaching = state.objectCaching
            obj.noScaleCache = state.noScaleCache
            obj.statefullCache = state.statefullCache
            obj.dirty = true
            obj.setCoords?.()
        })
        c.calcOffset?.()
        c.requestRenderAll?.()
    }
}

const withProductZonesHiddenForOutput = async <T>(
    ctx: EditorExportShareContext,
    action: () => Promise<T> | T
): Promise<T> => {
    if (!ctx.canvas.value) return await action()

    const allObjects = ctx.canvas.value.getObjects() || []
    const zones = allObjects.filter((o: any) => ctx.isLikelyProductZone(o))

    if (!zones.length) return await action()

    const prevVisibility = zones.map((obj: any) => ({
        obj,
        visible: obj?.visible !== false
    }))

    zones.forEach((obj: any) => {
        obj?.set?.('visible', false)
        obj?.setCoords?.()
    })
    ctx.safeRequestRenderAll()
    await new Promise(resolve => setTimeout(resolve, 0))

    try {
        return await action()
    } finally {
        prevVisibility.forEach(({ obj, visible }: any) => {
            obj?.set?.('visible', visible)
            obj?.setCoords?.()
        })
        ctx.safeRequestRenderAll()
        await new Promise(resolve => setTimeout(resolve, 0))
    }
}

export const exportSelectedObject = async (
    ctx: EditorExportShareContext,
    format: 'png' | 'svg' | 'jpg' = 'png',
    targetObject?: any,
    options: { download?: boolean } = {}
): Promise<{ dataURL: string; fileName: string; format: 'png' | 'jpg' } | null> => {
    if (!ctx.canvas.value) return null
    const active = ctx.resolveExportableSelectedObject(targetObject)
    if (!active) {
        ctx.notifyEditorInfo('Selecione um objeto válido para exportar.')
        return null
    }

    const fileName = `objeto-${getSelectedObjectExportFileBaseName(active)}-${Date.now()}`
    const shouldDownload = options.download !== false

    if (format === 'svg') {
        const svgContent = active.toSVG()
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        if (shouldDownload) downloadFile(url, `${fileName}.svg`)
        return null
    }

    if (active.clipPath && !isValidClipPath(active.clipPath)) {
        console.warn('[Export Selected] Limpando clipPath inválido do objeto selecionado')
        active.set('clipPath', null)
    }

    const activeBounds = typeof active.getBoundingRect === 'function'
        ? active.getBoundingRect(true, true)
        : null
    const activeWidth = Math.max(1, Number(activeBounds?.width || active?.width || 1))
    const activeHeight = Math.max(1, Number(activeBounds?.height || active?.height || 1))
    const exportMultiplier = getSafeMultiplier(activeWidth, activeHeight, HIGH_RES_EXPORT_SCALE)

    let dataURL = ''
    try {
        dataURL = await runWithNeutralViewport(ctx, async () => (
            active.toDataURL({
                format,
                quality: 1,
                multiplier: exportMultiplier
            })
        ))
    } catch (exportErr) {
        console.error('[Export Selected] Erro ao exportar objeto:', exportErr)
        try {
            active.set('clipPath', null)
            dataURL = await runWithNeutralViewport(ctx, async () => (
                active.toDataURL({
                    format,
                    quality: 1,
                    multiplier: exportMultiplier
                })
            ))
        } catch (fallbackErr) {
            console.error('[Export Selected] Falha definitiva:', fallbackErr)
            ctx.notifyEditorError('Erro ao exportar objeto. Tente novamente.')
            return null
        }
    }

    dataURL = await makeExportColorsVivid(
        dataURL,
        format === 'jpg' ? 'jpg' : 'png',
        HIGH_RES_EXPORT_QUALITY
    )

    if (shouldDownload) {
        downloadFile(dataURL, `${fileName}.${format}`)
    }

    return { dataURL, fileName, format }
}

const exportSingleFrame = async (
    ctx: EditorExportShareContext,
    frame: any,
    format: 'png' | 'jpg' = 'png',
    scale = 1,
    quality = 0.9
) => {
    if (!ctx.canvas.value || !frame) return null

    const frameName = getFrameDisplayNameForExport(frame, 0).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'frame'
    const fileName = `frame-${frameName}-${Date.now()}`

    const bounds = getFrameBounds(frame)
    if (!bounds) return null
    const frameMultiplier = getSafeMultiplier(Number(bounds.width || 1), Number(bounds.height || 1), Math.max(1, Number(scale) || 1))

    let dataURL = ''
    try {
        dataURL = await withProductZonesHiddenForOutput(ctx, async () => (
            await runWithNeutralViewport(ctx, async () => {
                ctx.sanitizeAllClipPaths()
                return ctx.canvas.value.toDataURL({
                    format,
                    quality,
                    multiplier: frameMultiplier,
                    left: bounds.left,
                    top: bounds.top,
                    width: Math.max(1, bounds.width),
                    height: Math.max(1, bounds.height),
                    ...(format === 'jpg' ? { backgroundColor: '#ffffff' } : {})
                })
            })
        ))
    } catch (err) {
        console.warn('[Export Frame] Primeira tentativa falhou, tentando fallback:', err)
        try {
            dataURL = await withProductZonesHiddenForOutput(ctx, async () => (
                await runWithNeutralViewport(ctx, async () => (
                    ctx.canvas.value.toDataURL({
                        format,
                        quality,
                        multiplier: frameMultiplier,
                        left: bounds.left,
                        top: bounds.top,
                        width: Math.max(1, bounds.width),
                        height: Math.max(1, bounds.height),
                        ...(format === 'jpg' ? { backgroundColor: '#ffffff' } : {})
                    })
                ))
            ))
        } catch (fallbackErr) {
            console.error('[Export Frame] Error:', fallbackErr)
            return null
        }
    }

    dataURL = await makeExportColorsVivid(dataURL, format, quality)

    return { dataURL, fileName }
}

const exportAllFrames = async (
    ctx: EditorExportShareContext,
    format: 'png' | 'jpg' = 'png',
    scale = 1,
    quality = 0.9
) => {
    const frames = ctx.getAllFrames()
    if (!frames.length) {
        ctx.notifyEditorInfo('Nenhum frame encontrado para exportar.')
        return []
    }

    const exports: { dataURL: string; fileName: string }[] = []

    for (const frame of frames) {
        const result = await exportSingleFrame(ctx, frame, format, scale, quality)
        if (result) {
            exports.push(result)
        }
    }

    return exports
}

const exportSelectedObjectBlob = async (
    ctx: EditorExportShareContext,
    format: ExportImageFormat,
    qualityPreset: ExportQualityPreset,
    targetObject?: any
): Promise<ScopedBlobExport | null> => {
    if (!ctx.canvas.value) return null
    const active = ctx.resolveExportableSelectedObject(targetObject)
    if (!active) return null

    if (active.clipPath && !isValidClipPath(active.clipPath)) {
        active.set('clipPath', null)
    }

    const activeBounds = typeof active.getBoundingRect === 'function'
        ? active.getBoundingRect(true, true)
        : null
    const baseWidth = Math.max(1, Number(activeBounds?.width || active?.width || 1))
    const baseHeight = Math.max(1, Number(activeBounds?.height || active?.height || 1))
    const fileName = `objeto-${getSelectedObjectExportFileBaseName(active)}-${Date.now()}`

    const { exportObjectAsBlob } = await loadEditorExportPipeline()
    const result = await exportObjectAsBlob({
        width: baseWidth,
        height: baseHeight,
        qualityPreset,
        format,
        renderDataUrlAtMultiplier: async (multiplier: number) => {
            try {
                return await runWithNeutralViewport(ctx, async () => (
                    active.toDataURL({
                        format,
                        quality: HIGH_RES_EXPORT_QUALITY,
                        multiplier
                    })
                ))
            } catch {
                active.set('clipPath', null)
                return await runWithNeutralViewport(ctx, async () => (
                    active.toDataURL({
                        format,
                        quality: HIGH_RES_EXPORT_QUALITY,
                        multiplier
                    })
                ))
            }
        },
        postProcessDataUrl: async (dataUrl) => await makeExportColorsVivid(dataUrl, format, HIGH_RES_EXPORT_QUALITY)
    })

    return {
        blob: result.blob,
        fileName,
        format,
        baseWidth,
        baseHeight,
        reducedFromRequested: result.reducedFromRequested
    }
}

const exportSingleFrameBlob = async (
    ctx: EditorExportShareContext,
    frame: any,
    format: ExportImageFormat,
    qualityPreset: ExportQualityPreset,
    index = 0
): Promise<ScopedBlobExport | null> => {
    if (!ctx.canvas.value || !frame) return null

    const bounds = getFrameBounds(frame)
    if (!bounds) return null

    const baseWidth = Math.max(1, Number(bounds.width || 1))
    const baseHeight = Math.max(1, Number(bounds.height || 1))
    const frameName = getFrameDisplayNameForExport(frame, index).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'frame'
    const fileName = `frame-${frameName}-${index + 1}-${Date.now()}`

    const { exportFrameAsBlob } = await loadEditorExportPipeline()
    const result = await exportFrameAsBlob({
        width: baseWidth,
        height: baseHeight,
        qualityPreset,
        format,
        renderDataUrlAtMultiplier: async (multiplier: number) => {
            try {
                return await withProductZonesHiddenForOutput(ctx, async () => (
                    await runWithNeutralViewport(ctx, async () => {
                        ctx.sanitizeAllClipPaths()
                        return ctx.canvas.value.toDataURL({
                            format,
                            quality: HIGH_RES_EXPORT_QUALITY,
                            multiplier,
                            left: bounds.left,
                            top: bounds.top,
                            width: baseWidth,
                            height: baseHeight,
                            ...(format === 'jpg' ? { backgroundColor: '#ffffff' } : {})
                        })
                    })
                ))
            } catch {
                return await withProductZonesHiddenForOutput(ctx, async () => (
                    await runWithNeutralViewport(ctx, async () => (
                        ctx.canvas.value.toDataURL({
                            format,
                            quality: HIGH_RES_EXPORT_QUALITY,
                            multiplier,
                            left: bounds.left,
                            top: bounds.top,
                            width: baseWidth,
                            height: baseHeight,
                            ...(format === 'jpg' ? { backgroundColor: '#ffffff' } : {})
                        })
                    ))
                ))
            }
        },
        postProcessDataUrl: async (dataUrl) => await makeExportColorsVivid(dataUrl, format, HIGH_RES_EXPORT_QUALITY)
    })

    return {
        blob: result.blob,
        fileName,
        format,
        baseWidth,
        baseHeight,
        reducedFromRequested: result.reducedFromRequested
    }
}

const maybeWarnLargeBatchExport = (ctx: EditorExportShareContext, frames: any[], qualityPreset: ExportQualityPreset) => {
    const estimatedBytes = (frames || []).reduce((sum: number, frame: any) => {
        const bounds = getFrameBounds(frame)
        if (!bounds) return sum
        const width = Math.max(1, Number(bounds.width || 1))
        const height = Math.max(1, Number(bounds.height || 1))
        const requested = getRequestedMultiplier(qualityPreset, width, height)
        const safeMultiplier = getSafeMultiplier(width, height, requested)
        const rawBytes = width * height * safeMultiplier * safeMultiplier * 4
        return sum + (rawBytes * 0.55)
    }, 0)

    const estimatedMb = estimatedBytes / (1024 * 1024)
    if (estimatedMb >= 250) {
        ctx.notifyEditorInfo(`Exportação pesada (~${Math.round(estimatedMb)}MB). Pode levar mais tempo.`)
    }
}

const runExportPreflightChecks = (ctx: EditorExportShareContext): string[] => {
    if (!ctx.canvas.value) return []
    const counts = computeExportPreflightCounts({
        objects: ctx.canvas.value.getObjects?.() || [],
        isLikelyProductZone: ctx.isLikelyProductZone
    })
    return buildExportPreflightWarnings(counts)
}

export const performExport = async (ctx: EditorExportShareContext) => {
    if (!ctx.canvas.value) return
    if (ctx.isExportDownloadInProgress.value) return

    const preflightWarnings = runExportPreflightChecks(ctx)
    if (preflightWarnings.length > 0 && typeof window !== 'undefined') {
        const message = `Encontramos ${preflightWarnings.length} problema(s) antes da exportacao:\n\n` +
            preflightWarnings.map((w) => `• ${w}`).join('\n') +
            '\n\nDeseja exportar mesmo assim?'
        if (!window.confirm(message)) {
            return
        }
    }

    const feedbackToken = ctx.startExportDownloadFeedback('Preparando exportação...')
    ctx.showExportModal.value = false

    let reducedBySafety = false

    try {
        const activeBeforeExport = ctx.canvas.value.getActiveObject?.()
        ctx.canvas.value.discardActiveObject()
        ctx.safeRequestRenderAll()

        const { format, exportScope, selectedFrameId } = ctx.exportSettings.value
        const qualityPreset = normalizeExportQualityPreset(String(ctx.exportSettings.value.qualityPreset || DEFAULT_EXPORT_QUALITY_PRESET))
        const multiFileMode = ctx.exportSettings.value.multiFileMode === 'separate' ? 'separate' : 'zip'
        const isPdf = format === 'pdf'
        const imageFormat: ExportImageFormat = normalizeExportImageFormat(String(format || 'png'))

        if (exportScope === 'selected-object') {
            const objectExport = await exportSelectedObjectBlob(ctx, isPdf ? 'png' : imageFormat, qualityPreset, activeBeforeExport)
            if (!objectExport) {
                ctx.notifyEditorInfo('Selecione um objeto válido para exportar.')
                return
            }
            reducedBySafety = reducedBySafety || objectExport.reducedFromRequested

            if (isPdf) {
                const { buildPdfBlob } = await loadEditorExportPipeline()
                const pdfBlob = await buildPdfBlob([{
                    imageBlob: objectExport.blob,
                    pageWidthPx: objectExport.baseWidth,
                    pageHeightPx: objectExport.baseHeight
                }])
                downloadBlob(pdfBlob, `${objectExport.fileName}.pdf`)
            } else {
                downloadBlob(objectExport.blob, `${objectExport.fileName}.${imageFormat}`)
            }
        } else if (exportScope === 'selected-frame') {
            if (!selectedFrameId) {
                ctx.notifyEditorInfo('Selecione um frame para exportar.')
                return
            }
            const frame = ctx.getFrameById(selectedFrameId)
            if (!frame) {
                ctx.notifyEditorInfo('Frame selecionado não encontrado no canvas.')
                return
            }

            const frameExport = await exportSingleFrameBlob(ctx, frame, isPdf ? 'png' : imageFormat, qualityPreset)
            if (!frameExport) {
                ctx.notifyEditorError('Falha ao exportar o frame selecionado.')
                return
            }
            reducedBySafety = reducedBySafety || frameExport.reducedFromRequested

            if (isPdf) {
                const { buildPdfBlob } = await loadEditorExportPipeline()
                const pdfBlob = await buildPdfBlob([{
                    imageBlob: frameExport.blob,
                    pageWidthPx: frameExport.baseWidth,
                    pageHeightPx: frameExport.baseHeight
                }])
                downloadBlob(pdfBlob, `${frameExport.fileName}.pdf`)
            } else {
                downloadBlob(frameExport.blob, `${frameExport.fileName}.${imageFormat}`)
            }
        } else if (exportScope === 'all-frames') {
            const frames = ctx.getAllFrames()
            if (!frames.length) {
                ctx.notifyEditorInfo('Nenhum frame encontrado no canvas.')
                return
            }

            maybeWarnLargeBatchExport(ctx, frames, qualityPreset)
            const results: ScopedBlobExport[] = []
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i]
                const result = await exportSingleFrameBlob(ctx, frame, isPdf ? 'png' : imageFormat, qualityPreset, i)
                if (result) {
                    reducedBySafety = reducedBySafety || result.reducedFromRequested
                    results.push(result)
                }
            }

            if (!results.length) {
                ctx.notifyEditorError('Nenhum frame foi exportado com sucesso.')
                return
            }

            if (isPdf) {
                const pages = results.map((result) => ({
                    imageBlob: result.blob,
                    pageWidthPx: result.baseWidth,
                    pageHeightPx: result.baseHeight
                }))
                const { buildPdfBlob } = await loadEditorExportPipeline()
                const pdfBlob = await buildPdfBlob(pages)
                downloadBlob(pdfBlob, `${ctx.makeExportBatchBaseName()}.pdf`)
            } else if (multiFileMode === 'zip') {
                const zipEntries = results.map((result) => ({
                    fileName: `${result.fileName}.${imageFormat}`,
                    blob: result.blob
                }))
                const { buildZipBlob } = await loadEditorExportPipeline()
                const zipBlob = await buildZipBlob(zipEntries)
                downloadBlob(zipBlob, `${ctx.makeExportBatchBaseName()}.zip`)
            } else {
                await downloadMultipleFiles(results.map((result) => ({
                    blob: result.blob,
                    fileName: result.fileName,
                    format: imageFormat
                })))
            }
        } else {
            ctx.notifyEditorInfo('Selecione: objeto, frame ou todos os frames para exportar.')
            return
        }

        if (reducedBySafety) {
            ctx.notifyEditorInfo('Parte do export foi ajustada para escala segura por limite do navegador.')
        }
    } catch (err) {
        console.error('[Export] Falha ao exportar:', err)
        ctx.notifyEditorError('Falha ao exportar. Tente novamente ou reduza a qualidade.')
    } finally {
        await ctx.stopExportDownloadFeedback(feedbackToken)
    }
}

export const performShare = async (ctx: EditorExportShareContext) => {
    if (!ctx.canvas.value) return
    if (ctx.isExportDownloadInProgress.value) return
    const feedbackToken = ctx.startExportDownloadFeedback('Baixando arquivo...')
    ctx.showShareModal.value = false

    try {
        const activeBeforeShare = ctx.canvas.value.getActiveObject?.()
        ctx.canvas.value.discardActiveObject()
        ctx.safeRequestRenderAll()

        const { format, shareScope } = ctx.shareSettings.value
        const scale = HIGH_RES_EXPORT_SCALE
        const quality = HIGH_RES_EXPORT_QUALITY
        const imgFormat: 'png' | 'jpg' = (format === 'jpeg' || format === 'jpg') ? 'jpg' : 'png'
        const frameFormat: 'png' | 'jpg' = imgFormat === 'jpg' ? 'jpg' : 'png'

        if (shareScope === 'selected-object') {
            const objectResult = await exportSelectedObject(ctx, frameFormat, activeBeforeShare, { download: false })
            if (!objectResult) {
                ctx.notifyEditorInfo('Selecione um objeto válido para exportar.')
                return
            }
            const extension = objectResult.format === 'jpg' ? 'jpg' : 'png'
            const finalName = `${objectResult.fileName}.${extension}`
            const shared = await shareFileFromDataUrl(objectResult.dataURL, finalName, 'Objeto selecionado')
            if (!shared) {
                downloadFile(objectResult.dataURL, finalName)
            }
        } else if (shareScope === 'selected-frame') {
            const frameIds = ctx.shareSettings.value.selectedFrameIds
            if (!frameIds.length) {
                ctx.notifyEditorInfo('Selecione ao menos um frame para compartilhar.')
                return
            }
            if (frameIds.length === 1) {
                const frame = ctx.getFrameById(frameIds[0] as string)
                if (!frame) {
                    ctx.notifyEditorInfo('Frame selecionado não encontrado no canvas.')
                    return
                }
                const result = await exportSingleFrame(ctx, frame, frameFormat, scale, quality)
                if (result) {
                    const shared = await shareFileFromDataUrl(result.dataURL, `${result.fileName}.${frameFormat}`, (frame.layerName || frame.name || 'Frame'))
                    if (!shared) {
                        downloadFile(result.dataURL, `${result.fileName}.${frameFormat}`)
                    }
                }
            } else {
                const results = []
                for (const fid of frameIds) {
                    const frame = ctx.getFrameById(fid)
                    if (frame) {
                        const result = await exportSingleFrame(ctx, frame, frameFormat, scale, quality)
                        if (result) results.push({ dataURL: result.dataURL, fileName: result.fileName, format: frameFormat })
                    }
                }
                if (results.length > 0) {
                    await downloadMultipleFiles(results)
                } else {
                    ctx.notifyEditorInfo('Nenhum frame selecionado foi encontrado no canvas.')
                }
            }
        } else if (shareScope === 'all-frames') {
            const frames = ctx.getAllFrames()
            if (frames.length > 0) {
                if (frames.length === 1) {
                    const result = await exportSingleFrame(ctx, frames[0], frameFormat, scale, quality)
                    if (result) {
                        const shared = await shareFileFromDataUrl(result.dataURL, `${result.fileName}.${frameFormat}`, 'All Frames')
                        if (!shared) {
                            downloadFile(result.dataURL, `${result.fileName}.${frameFormat}`)
                        }
                    }
                } else {
                    ctx.notifyEditorInfo('Compartilhamento nativo suporta apenas um arquivo por vez. Os arquivos serão baixados.')
                    const frameExports = await exportAllFrames(ctx, frameFormat, scale, quality)
                    const filesToDownload = frameExports.map(e => ({
                        dataURL: e.dataURL,
                        fileName: e.fileName,
                        format: frameFormat
                    }))
                    await downloadMultipleFiles(filesToDownload)
                }
            } else {
                ctx.notifyEditorInfo('Nenhum frame encontrado no canvas.')
            }
        } else {
            ctx.notifyEditorInfo('Selecione: objeto, frame ou todos os frames para exportar.')
        }
    } catch (err) {
        console.error('[Share] Falha ao compartilhar:', err)
        ctx.notifyEditorError('Falha ao compartilhar. Tente novamente ou reduza a qualidade.')
    } finally {
        await ctx.stopExportDownloadFeedback(feedbackToken)
    }
}

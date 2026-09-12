/** Isola falhas por imagem sem descartar as demais imagens do design. */
import { CANVAS_IMAGE_PLACEHOLDER_DATA_URL } from './canvasJsonClassifiers'
import { isTrackableImageSrc } from './canvasImageTracking'

type Session = {
    timeoutMs: number
    retryCount?: number
    onSettled: (src: string, failed: boolean) => void
}
const registries = new WeakMap<object, WeakMap<AbortSignal, Session>>()

export const registerCanvasImageLoadSession = (
    imageClass: any,
    signal: AbortSignal,
    session: Session
): (() => void) => {
    let registry = registries.get(imageClass)
    if (!registry) {
        registry = new WeakMap()
        registries.set(imageClass, registry)
        const sessions = registry
        const original = imageClass.fromObject
        // Fabric 7 fecha util.loadImage no módulo ESM. fromObject é a entrada
        // pública usada também por imagens dentro de grupos e clipPaths.
        imageClass.fromObject = async function (object: any, options: any = {}) {
            const active = options.signal && sessions.get(options.signal)
            const src = String(object?.src || '').trim()
            if (!active || !isTrackableImageSrc(src)) {
                return original.call(this, object, options)
            }
            let controller = new AbortController()
            const abort = () => controller.abort()
            options.signal.addEventListener('abort', abort, { once: true })
            if (options.signal.aborted) controller.abort()
            let timer: ReturnType<typeof setTimeout> | undefined
            let failed = false
            try {
                const attempts = 1 + Math.min(1, Math.max(0, active.retryCount || 0))
                for (let attempt = 0; attempt < attempts; attempt++) {
                    controller = new AbortController()
                    if (options.signal.aborted) controller.abort()
                    const attemptController = controller
                    const timeout = new Promise<never>((_, reject) => {
                        timer = setTimeout(() => {
                            reject(new Error('Tempo limite da imagem excedido'))
                            attemptController.abort()
                        }, active.timeoutMs)
                    })
                    try {
                        return await Promise.race([
                            original.call(this, object, { ...options, signal: controller.signal }),
                            timeout
                        ])
                    } catch (error) {
                        if (options.signal.aborted) throw error
                        if (attempt + 1 < attempts) continue
                    } finally {
                        if (timer !== undefined) clearTimeout(timer)
                        controller.abort()
                    }
                }
                failed = true
                // Mantém dimensões, filtros e URL persistente para recuperar
                // depois. Somente a imagem que falhou recebe placeholder.
                return await original.call(this, {
                    ...object,
                    __originalSrc: object.__originalSrc || src,
                    src: CANVAS_IMAGE_PLACEHOLDER_DATA_URL
                }, options)
            } finally {
                if (timer !== undefined) clearTimeout(timer)
                options.signal.removeEventListener('abort', abort)
                if (!options.signal.aborted) active.onSettled(src, failed)
            }
        }
    }
    registry.set(signal, session)
    return () => registry.delete(signal)
}

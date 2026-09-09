/** Isola falhas por imagem sem descartar as demais imagens do design. */
import { CANVAS_IMAGE_PLACEHOLDER_DATA_URL } from './canvasJsonClassifiers'
import { isTrackableImageSrc } from './canvasImageTracking'

type Session = {
    timeoutMs: number
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
            const controller = new AbortController()
            const abort = () => controller.abort()
            options.signal.addEventListener('abort', abort, { once: true })
            if (options.signal.aborted) controller.abort()
            let timer: ReturnType<typeof setTimeout> | undefined
            let failed = false
            try {
                const timeout = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error('Tempo limite da imagem excedido'))
                        controller.abort()
                    }, active.timeoutMs)
                })
                try {
                    return await Promise.race([
                        original.call(this, object, { ...options, signal: controller.signal }),
                        timeout
                    ])
                } catch (error) {
                    if (options.signal.aborted) throw error
                    failed = true
                    // Mantém dimensões, filtros e URL persistente para recuperar
                    // depois. Somente a imagem que falhou recebe placeholder.
                    return await original.call(this, {
                        ...object,
                        __originalSrc: object.__originalSrc || src,
                        src: CANVAS_IMAGE_PLACEHOLDER_DATA_URL
                    }, options)
                }
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

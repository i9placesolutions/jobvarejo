import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerCanvasImageLoadSession } from '../../utils/canvasImageLoadSession'
import { CANVAS_IMAGE_PLACEHOLDER_DATA_URL } from '../../utils/canvasJsonClassifiers'

afterEach(() => vi.useRealTimers())

describe('carregamento isolado de imagens do canvas', () => {
    it('preserva imagem saudável, geometria e origem da imagem que falhou sem mutar JSON', async () => {
        const imageClass = { fromObject: vi.fn(async (object: any, _options?: any) => {
            if (object.src === '/broken') throw new Error('404')
            return { ...object }
        }) }
        const controller = new AbortController()
        const onSettled = vi.fn()
        const unregister = registerCanvasImageLoadSession(imageClass, controller.signal, { timeoutMs: 100, onSettled })
        const broken = { src: '/broken', width: 300, height: 200, scaleX: 2, __originalSrc: 'saved/key' }
        const [healthy, fallback] = await Promise.all([
            imageClass.fromObject({ src: '/healthy' }, { signal: controller.signal }),
            imageClass.fromObject(broken, { signal: controller.signal })
        ])
        expect(healthy.src).toBe('/healthy')
        expect(fallback).toEqual({ ...broken, src: CANVAS_IMAGE_PLACEHOLDER_DATA_URL })
        expect(broken.src).toBe('/broken')
        expect(onSettled.mock.calls).toEqual(expect.arrayContaining([['/healthy', false], ['/broken', true]]))
        unregister()
        await expect(imageClass.fromObject(broken, { signal: controller.signal })).rejects.toThrow('404')
    })

    it('libera uma imagem travada no prazo sem abortar a sessão inteira', async () => {
        vi.useFakeTimers()
        const imageClass = { fromObject: vi.fn((object: any, _options?: any) => object.src === '/stuck'
            ? new Promise(() => {}) : Promise.resolve(object)) }
        const controller = new AbortController()
        const onSettled = vi.fn()
        registerCanvasImageLoadSession(imageClass, controller.signal, { timeoutMs: 100, onSettled })
        const loading = imageClass.fromObject({ src: '/stuck', width: 100 }, { signal: controller.signal })
        await vi.advanceTimersByTimeAsync(100)
        expect(await loading).toMatchObject({ src: CANVAS_IMAGE_PLACEHOLDER_DATA_URL, __originalSrc: '/stuck', width: 100 })
        expect(controller.signal.aborted).toBe(false)
        expect(onSettled).toHaveBeenCalledWith('/stuck', true)
        expect(vi.getTimerCount()).toBe(0)
    })

    it('não converte cancelamento de página em placeholder', async () => {
        const imageClass = { fromObject: vi.fn((object: any, options: any) => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })) }
        const controller = new AbortController()
        const onSettled = vi.fn()
        registerCanvasImageLoadSession(imageClass, controller.signal, { timeoutMs: 100, onSettled })
        const loading = imageClass.fromObject({ src: '/image' }, { signal: controller.signal })
        controller.abort()
        await expect(loading).rejects.toThrow('aborted')
        expect(onSettled).not.toHaveBeenCalled()
    })
})

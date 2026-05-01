/**
 * Reparador "live" (runtime) de price groups apos loadFromJSON. Roda
 * sobre objetos Fabric ja hidratados — corrige:
 *  - imagem de fundo (splash_image) com nome generico/custom_image_*
 *  - elementos shell (Rect/Image) marcados como invisible
 *  - price_bg com fill transparent + sem imagem de fundo (restaura cor)
 *  - splash_image com src stripped (substitui por Rect price_bg)
 *
 * Cobertura: tests/utils/livePriceGroupRepair.test.ts
 */

import {
    collectObjectsDeep,
    isLikelyProductCard,
    isTextLikeObject
} from './fabricObjectClassifiers'
import {
    getPriceGroupFromAny,
    getSinglePriceBackgroundImageCandidate
} from './priceLayoutClassifiers'
import {
    isPriceGroupVisualShellNode,
    isRenderablePriceGroupTemplateImageNode,
    isPriceGroupTemplateImageNode
} from './canvasJsonClassifiers'

/**
 * Construtor de Rect Fabric (DI). Recebe props e retorna um Rect Fabric.
 * Tipo permissivo (any) porque so e' chamado em runtime; o caller injeta
 * `(p) => new fabric.Rect(p)`.
 */
export type FabricRectFactory = (props: any) => any

const PRICE_BG_NAMES_LIVE = new Set([
    'price_bg', 'price_bg_image', 'splash_image',
    'price_header_bg', 'offerBackground',
    'atac_banner_bg', 'atac_wholesale_bg', 'atac_retail_bg'
])

/**
 * Repara price groups vivos (objetos Fabric) — caller injeta:
 *  - `canvasInstance`: o canvas Fabric (ou qualquer container com `getObjects`)
 *  - `createRect`: factory para criar `new fabric.Rect(...)` (opcional —
 *    se omitido, o reparo de splash_image stripped e' pulado).
 *
 * Mutates objetos Fabric in place. Retorna o numero de reparos.
 */
export const repairLivePriceGroupBackgrounds = (
    canvasInstance: any,
    createRect?: FabricRectFactory
): number => {
    if (!canvasInstance || typeof canvasInstance.getObjects !== 'function') return 0
    let repaired = 0

    const allObjects = collectObjectsDeep(canvasInstance)
    const productCards = allObjects.filter((obj: any) =>
        obj?.type === 'group' && (obj?.isSmartObject || obj?.isProductCard || isLikelyProductCard(obj))
    )

    for (const card of productCards) {
        const pg = getPriceGroupFromAny(card)
        if (!pg || typeof pg.getObjects !== 'function') continue

        const pgChildren = collectObjectsDeep(pg)
        const hasVisibleText = pgChildren.some((o: any) =>
            isTextLikeObject(o) && o.visible !== false
        )
        if (!hasVisibleText) continue

        const bgCandidate = getSinglePriceBackgroundImageCandidate(pgChildren)
        if (bgCandidate && String(bgCandidate?.type || '').toLowerCase() === 'image') {
            const bgName = String(bgCandidate?.name || '').trim()
            if (!bgName || bgName.startsWith('custom_image_')) {
                bgCandidate.set?.('name', 'splash_image')
                bgCandidate.name = 'splash_image'
                bgCandidate.dirty = true
                repaired++
            }
            const currentSrc = String((bgCandidate as any)?.src || '').trim()
            if (currentSrc && !(bgCandidate as any).__originalSrc) {
                (bgCandidate as any).__originalSrc = currentSrc
            }
        }

        for (const child of pgChildren) {
            if (!child || child === pg) continue
            if (!child || child.visible !== false) continue
            const name = String(child.name || '')
            if (PRICE_BG_NAMES_LIVE.has(name) || isPriceGroupVisualShellNode(child)) {
                child.set('visible', true)
                child.visible = true
                child.dirty = true
                repaired++
            }
        }

        if (pg.visible === false) {
            pg.set('visible', true)
            pg.visible = true
            pg.dirty = true
            repaired++
        }

        const priceBgEl = pgChildren.find((o: any) => o?.name === 'price_bg')
        if (priceBgEl) {
            const hasBgImg = pgChildren.some((o: any) => isRenderablePriceGroupTemplateImageNode(o))
            if (!hasBgImg) {
                const curFill = priceBgEl.fill
                if (!curFill || curFill === 'transparent' || curFill === '') {
                    const saved = (priceBgEl as any).__originalFill
                    const restored = typeof saved === 'string' && saved !== 'transparent' ? saved : '#000000'
                    priceBgEl.set('fill', restored)
                    priceBgEl.dirty = true
                    repaired++
                }
            }
            if (typeof (priceBgEl as any).__originalFill === 'undefined' && priceBgEl.fill && priceBgEl.fill !== 'transparent') {
                (priceBgEl as any).__originalFill = priceBgEl.fill
            }
        }

        const brokenTemplateImage = pgChildren.find((o: any) =>
            isPriceGroupTemplateImageNode(o) && !isRenderablePriceGroupTemplateImageNode(o)
        )
        if (brokenTemplateImage && !priceBgEl && createRect) {
            const imgW = Number(brokenTemplateImage.width || 0) * Math.abs(Number(brokenTemplateImage.scaleX || 1))
            const imgH = Number(brokenTemplateImage.height || 0) * Math.abs(Number(brokenTemplateImage.scaleY || 1))
            const fallbackBg = createRect({
                width: Math.max(imgW, 100),
                height: Math.max(imgH, 40),
                fill: '#000000',
                rx: Math.min(imgH / 2, 20),
                ry: Math.min(imgH / 2, 20),
                originX: brokenTemplateImage.originX || 'center',
                originY: brokenTemplateImage.originY || 'center',
                left: Number(brokenTemplateImage.left || 0),
                top: Number(brokenTemplateImage.top || 0),
                name: 'price_bg',
                visible: true
            })
            if (typeof pg.remove === 'function' && typeof pg.add === 'function') {
                pg.remove(brokenTemplateImage)
                pg.add(fallbackBg)
                if (typeof fallbackBg.sendToBack === 'function') fallbackBg.sendToBack()
                pg.dirty = true
                repaired++
            }
        }
    }

    return repaired
}

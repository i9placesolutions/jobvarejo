import { clamp, toFinite } from './mathHelpers'

type Bounds = {
    minX: number
    maxX: number
    minY: number
    maxY: number
    width: number
    height: number
    centerX: number
    centerY: number
}

type LayoutManualTemplateGroupDeps = {
    collectObjectsDeep: (obj: any) => any[]
    findByName: (objects: any[], name: string) => any
    isTextLikeObject: (obj: any) => boolean
    isRedBurstPriceGroup: (group: any) => boolean
    tuneRedBurstPriceGroupLayout: (group: any) => void
}

const bakeLargeGroupScaleIntoChildren = (priceGroup: any, threshold = 1.15): boolean => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return false

    const sx = Math.abs(toFinite(priceGroup.scaleX, 1)) || 1
    const sy = Math.abs(toFinite(priceGroup.scaleY, 1)) || 1
    if (sx <= threshold && sy <= threshold) return false

    const children = priceGroup.getObjects() || []
    children.forEach((child: any) => {
        if (!child || typeof child.set !== 'function') return
        const next: Record<string, number> = {}
        if (Number.isFinite(Number(child.left))) next.left = Number(child.left || 0) * sx
        if (Number.isFinite(Number(child.top))) next.top = Number(child.top || 0) * sy
        if (Number.isFinite(Number(child.scaleX))) next.scaleX = Number(child.scaleX || 1) * sx
        if (Number.isFinite(Number(child.scaleY))) next.scaleY = Number(child.scaleY || 1) * sy
        child.set(next)
        child.initDimensions?.()
        child.setCoords?.()
        child.dirty = true
    })

    const bakedW = Math.max(1, toFinite(priceGroup.width, 1) * sx)
    const bakedH = Math.max(1, toFinite(priceGroup.height, 1) * sy)
    priceGroup.set({
        width: bakedW,
        height: bakedH,
        scaleX: 1,
        scaleY: 1
    })
    priceGroup.dirty = true
    priceGroup.setCoords?.()
    return true
}

export const layoutManualTemplateGroup = (
    priceGroup: any,
    cardW: number,
    cardH: number,
    deps: LayoutManualTemplateGroupDeps
) => {
    if (!priceGroup) return null

    const {
        collectObjectsDeep,
        findByName,
        isTextLikeObject,
        isRedBurstPriceGroup,
        tuneRedBurstPriceGroupLayout
    } = deps

    const all = collectObjectsDeep(priceGroup)
    if (isRedBurstPriceGroup(priceGroup)) {
        tuneRedBurstPriceGroupLayout(priceGroup)
    }

    let baseW = Number((priceGroup as any).__manualTemplateBaseW)
    let baseH = Number((priceGroup as any).__manualTemplateBaseH)
    const hasPersistedBase =
        Number.isFinite(baseW) && baseW > 0 &&
        Number.isFinite(baseH) && baseH > 0
    const sx = Math.abs(toFinite(priceGroup.scaleX, 1)) || 1
    const sy = Math.abs(toFinite(priceGroup.scaleY, 1)) || 1
    const rawW = toFinite(priceGroup.width, 0)
    const rawH = toFinite(priceGroup.height, 0)
    const scaledW = toFinite(priceGroup.getScaledWidth?.(), rawW * sx)
    const scaledH = toFinite(priceGroup.getScaledHeight?.(), rawH * sy)
    const inferredBaseW = rawW > 0 ? rawW : (scaledW > 0 ? scaledW / sx : 1)
    const inferredBaseH = rawH > 0 ? rawH : (scaledH > 0 ? scaledH / sy : 1)
    if (!hasPersistedBase) {
        baseW = Math.max(1, inferredBaseW)
        baseH = Math.max(1, inferredBaseH)
        ;(priceGroup as any).__manualTemplateBaseW = baseW
        ;(priceGroup as any).__manualTemplateBaseH = baseH
    }

    const getSize = (obj: any, axis: 'x' | 'y') => {
        if (!obj) return 0
        const fallback = axis === 'x'
            ? (Number(obj.width || 0) * Math.abs(Number(obj.scaleX ?? 1) || 1))
            : (Number(obj.height || 0) * Math.abs(Number(obj.scaleY ?? 1) || 1))
        const measured = axis === 'x'
            ? Number(obj.getScaledWidth?.() || 0)
            : Number(obj.getScaledHeight?.() || 0)
        const size = Number.isFinite(measured) && measured > 0 ? measured : fallback
        return Number.isFinite(size) && size > 0 ? size : 0
    }

    const edgeX = (obj: any) => {
        if (!obj) return null
        const w = getSize(obj, 'x')
        if (!w) return null
        const x = Number(obj.left || 0)
        const ox = String(obj.originX || 'left')
        if (ox === 'center') return { min: x - (w / 2), max: x + (w / 2) }
        if (ox === 'right') return { min: x - w, max: x }
        return { min: x, max: x + w }
    }

    const edgeY = (obj: any) => {
        if (!obj) return null
        const h = getSize(obj, 'y')
        if (!h) return null
        const y = Number(obj.top || 0)
        const oy = String(obj.originY || 'top')
        if (oy === 'center') return { min: y - (h / 2), max: y + (h / 2) }
        if (oy === 'bottom') return { min: y - h, max: y }
        return { min: y, max: y + h }
    }

    const isShown = (obj: any) => !!(obj && obj.visible !== false && Number(obj.scaleX ?? 1) !== 0 && Number(obj.scaleY ?? 1) !== 0)
    const visibleBounds = (objects: any[]): Bounds | null => {
        const xs: Array<{ min: number; max: number }> = []
        const ys: Array<{ min: number; max: number }> = []
        ;(objects || []).forEach((obj: any) => {
            if (!isShown(obj)) return
            if (isTextLikeObject(obj) && typeof obj.initDimensions === 'function') obj.initDimensions()
            const ex = edgeX(obj)
            const ey = edgeY(obj)
            if (ex) xs.push(ex)
            if (ey) ys.push(ey)
        })
        if (!xs.length || !ys.length) return null
        const minX = Math.min(...xs.map((e) => e.min))
        const maxX = Math.max(...xs.map((e) => e.max))
        const minY = Math.min(...ys.map((e) => e.min))
        const maxY = Math.max(...ys.map((e) => e.max))
        return {
            minX,
            maxX,
            minY,
            maxY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        }
    }

    const hasAtacarejoStructure = !!findByName(all, 'atac_retail_bg')
    const directChildren = typeof priceGroup.getObjects === 'function' ? (priceGroup.getObjects() || []) : []
    const findNamedTarget = (name: string) => {
        const direct = directChildren.find((obj: any) => String(obj?.name || '') === name)
        return direct || findByName(all, name)
    }
    const atacAnchors = [
        findNamedTarget('atac_retail_bg'),
        findNamedTarget('atac_banner_bg'),
        findNamedTarget('atac_wholesale_bg')
    ].filter((obj: any) => isShown(obj))
    const singleAnchors = [
        findNamedTarget('price_bg'),
        findNamedTarget('price_bg_image'),
        findNamedTarget('splash_image'),
        findNamedTarget('label_bg_image')
    ].filter((obj: any) => isShown(obj))
    const fitTargets = atacAnchors.length > 0
        ? atacAnchors
        : (singleAnchors.length > 0 ? singleAnchors : directChildren)
    const directChildrenVisibleBounds = visibleBounds(directChildren)

    const hasSaneBounds = (bounds: Bounds | null, referenceBounds?: Bounds | null) => {
        if (!bounds) return false
        if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return false
        if (bounds.width <= 0 || bounds.height <= 0) return false
        if (bounds.width < 14 || bounds.height < 10) return false
        if (bounds.width > 10000 || bounds.height > 10000) return false
        if (referenceBounds && Number.isFinite(referenceBounds.width) && referenceBounds.width > 0) {
            if (bounds.width < (referenceBounds.width * 0.45)) return false
        }
        if (referenceBounds && Number.isFinite(referenceBounds.height) && referenceBounds.height > 0) {
            if (bounds.height < (referenceBounds.height * 0.45)) return false
        }
        return true
    }

    const shouldUseVisibleBoundsFallback = (bounds: Bounds | null, referenceBounds?: Bounds | null) => {
        if (!hasSaneBounds(bounds, referenceBounds)) return false
        if (!bounds) return false
        if (!Number.isFinite(baseW) || !Number.isFinite(baseH) || baseW <= 0 || baseH <= 0) return true
        const ratioW = baseW / Math.max(1, bounds.width)
        const ratioH = baseH / Math.max(1, bounds.height)
        return ratioW > 1.35 || ratioW < 0.62 || ratioH > 1.35 || ratioH < 0.62
    }

    let effectiveW = baseW
    let effectiveH = baseH
    const normalizeChildrenByScale = (scaleX: number, scaleY: number) => {
        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 1.15 || scaleY <= 1.15) return
        directChildren.forEach((child: any) => {
            if (!child || typeof child.set !== 'function') return
            const next: Record<string, number> = {}
            if (Number.isFinite(Number(child.left))) next.left = Number(child.left || 0) / scaleX
            if (Number.isFinite(Number(child.top))) next.top = Number(child.top || 0) / scaleY
            if (Number.isFinite(Number(child.scaleX))) next.scaleX = Number(child.scaleX || 1) / scaleX
            if (Number.isFinite(Number(child.scaleY))) next.scaleY = Number(child.scaleY || 1) / scaleY
            child.set(next)
            child.initDimensions?.()
            child.setCoords?.()
            child.dirty = true
        })
    }

    const normalizePreviouslyBakedChildren = (referenceObjects: any[], targetW: number, targetH: number) => {
        const bounds = visibleBounds(referenceObjects)
        if (!bounds || !hasSaneBounds(bounds)) return
        const ratioW = bounds.width / Math.max(1, targetW)
        const ratioH = bounds.height / Math.max(1, targetH)
        const ratiosAreUniform = Math.abs(ratioW - ratioH) <= Math.max(0.18, Math.max(ratioW, ratioH) * 0.16)
        if (!ratiosAreUniform) return
        normalizeChildrenByScale(ratioW, ratioH)
    }

    if (hasAtacarejoStructure) {
        const centerBounds = visibleBounds(directChildren)
        if (centerBounds && (Math.abs(centerBounds.centerX) > 0.001 || Math.abs(centerBounds.centerY) > 0.001)) {
            directChildren.forEach((obj: any) => {
                if (!obj || typeof obj.set !== 'function') return
                obj.set({
                    left: Number(obj.left || 0) - centerBounds.centerX,
                    top: Number(obj.top || 0) - centerBounds.centerY
                })
                obj.setCoords?.()
            })
        }

        const fitAnchors = atacAnchors.length > 0 ? atacAnchors : directChildren
        let bounds = visibleBounds(fitAnchors)
        if (!bounds || !hasSaneBounds(bounds, directChildrenVisibleBounds)) {
            bounds = visibleBounds(directChildren)
        }
        if (bounds && hasSaneBounds(bounds, directChildrenVisibleBounds)) {
            effectiveW = Math.max(1, bounds.width)
            effectiveH = Math.max(1, bounds.height)
        }
        normalizePreviouslyBakedChildren(fitAnchors, effectiveW, effectiveH)
    } else {
        let bounds = visibleBounds(fitTargets)
        if (!bounds && fitTargets !== directChildren) bounds = directChildrenVisibleBounds
        if (!hasSaneBounds(bounds, directChildrenVisibleBounds) && hasSaneBounds(directChildrenVisibleBounds, directChildrenVisibleBounds)) {
            bounds = directChildrenVisibleBounds
        }
        if (!hasPersistedBase && bounds && shouldUseVisibleBoundsFallback(bounds, directChildrenVisibleBounds)) {
            effectiveW = Math.max(1, Number(bounds.width || baseW || 1))
            effectiveH = Math.max(1, Number(bounds.height || baseH || 1))
            ;(priceGroup as any).__manualTemplateBaseW = effectiveW
            ;(priceGroup as any).__manualTemplateBaseH = effectiveH
        }
        normalizePreviouslyBakedChildren(fitTargets, effectiveW, effectiveH)
    }

    const wholesaleBg = findByName(all, 'atac_wholesale_bg')
    const bannerBg = findByName(all, 'atac_banner_bg')
    const bannerText = findByName(all, 'wholesale_banner_text')
    const atacHeightRatio = hasAtacarejoStructure
        ? (isShown(wholesaleBg) ? 0.62 : ((isShown(bannerBg) && isShown(bannerText)) ? 0.5 : 0.44))
        : 0.44
    const maxW = Math.max(120, cardW * 0.98)
    const maxH = Math.max(42, cardH * atacHeightRatio)
    const fitScale = clamp(Math.min(maxW / Math.max(1, effectiveW), maxH / Math.max(1, effectiveH)), 0.2, 4)

    priceGroup.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        angle: 0,
        width: Math.max(1, effectiveW),
        height: Math.max(1, effectiveH),
        scaleX: fitScale,
        scaleY: fitScale
    })
    bakeLargeGroupScaleIntoChildren(priceGroup)

    priceGroup.dirty = true
    priceGroup.setCoords?.()
    return {
        pillW: Math.max(1, toFinite(priceGroup.width, effectiveW * fitScale)),
        pillH: Math.max(1, toFinite(priceGroup.height, effectiveH * fitScale))
    }
}

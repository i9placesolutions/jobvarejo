/**
 * useEditorSnapping — extracao do setupSnapping do EditorCanvas.vue.
 *
 * Todas as dependencias externas sao injetadas via `deps` para manter
 * o composable puro e testavel.
 */
import { ref, type Ref } from 'vue'
import {
    GUIDE_COLOR,
    GUIDE_STROKE_WIDTH,
    SNAP_RANGE_PX,
    SNAP_HYSTERESIS_HOLD_FACTOR,
    SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE,
    SNAP_MOVE_EPSILON_PX,
    SNAP_MOVE_EPSILON_PX_RECT_IMAGE,
    SNAP_RANGE_FACTOR_RECT_IMAGE,
    SNAP_FAST_MOVE_SUPPRESSION_PX,
    SNAP_FAST_MOVE_SUPPRESSION_PX_RECT_IMAGE,
} from '~/utils/snapConstants'
import { clamp } from '~/utils/mathHelpers'

type SnapBounds = {
    left: number
    right: number
    top: number
    bottom: number
    centerX: number
    centerY: number
    width: number
    height: number
}

export type EditorSnappingDeps = {
    canvasInstance: any
    canvasEl: HTMLCanvasElement | null
    fabric: any
    snapToObjects: Ref<boolean>
    snapToGuides: Ref<boolean>
    snapToGrid: Ref<boolean>
    gridSize: Ref<number>
    viewShowGuides: Ref<boolean>
    activePage: Ref<any>
    userGuidesIndex: Ref<Array<{ id: string; axis: 'x' | 'y'; pos: number }>>
    isLikelyProductCard: (obj: any) => boolean
    isLikelyProductZone: (obj: any) => boolean
    isActiveSelectionObject: (obj: any) => boolean
    getFrameDescendants: (frame: any) => any[]
    syncObjectFrameClip: (target: any) => void
    applyContainmentConstraints: (obj: any) => void
    shouldApplyContainmentConstraints: (obj: any) => boolean
    getZoneMetrics: (zone: any) => any
    safeRequestRenderAll: (canvasInstance?: any) => void
    refreshSelectedRef: () => void
    flushZoneRelayoutOnDrop: () => void
}

export type EditorSnappingApi = {
    setup: () => void
    teardown: () => void
}

export function useEditorSnapping(deps: EditorSnappingDeps): EditorSnappingApi {
    const teardownRef = ref<(() => void) | null>(null)

    const setup = () => {
        if (!deps.canvasInstance) return

        if (teardownRef.value) {
            teardownRef.value()
            teardownRef.value = null
        }

        const canvasInstance = deps.canvasInstance

        // Defensive cleanup for old guide instances left from prior setup runs.
        const staleGuides = canvasInstance
            .getObjects()
            .filter((o: any) => o?.id === 'guide-vertical' || o?.id === 'guide-horizontal')
        staleGuides.forEach((g: any) => {
            try {
                canvasInstance.remove(g)
            } catch {
                // ignore stale guide removal errors
            }
        })

        const verticalGuide = new deps.fabric.Line([0, 0, 0, 100], {
            stroke: GUIDE_COLOR,
            strokeWidth: GUIDE_STROKE_WIDTH,
            selectable: false,
            evented: false,
            visible: false,
            opacity: 1,
            strokeDashArray: [10, 6],
            strokeLineCap: 'round',
            strokeUniform: true,
            objectCaching: false,
            id: 'guide-vertical',
            excludeFromExport: true
        })
        const horizontalGuide = new deps.fabric.Line([0, 0, 100, 0], {
            stroke: GUIDE_COLOR,
            strokeWidth: GUIDE_STROKE_WIDTH,
            selectable: false,
            evented: false,
            visible: false,
            opacity: 1,
            strokeDashArray: [10, 6],
            strokeLineCap: 'round',
            strokeUniform: true,
            objectCaching: false,
            id: 'guide-horizontal',
            excludeFromExport: true
        })

        canvasInstance.add(verticalGuide)
        canvasInstance.add(horizontalGuide)
        try {
            if (typeof canvasInstance.bringObjectToFront === 'function') {
                canvasInstance.bringObjectToFront(verticalGuide)
                canvasInstance.bringObjectToFront(horizontalGuide)
            }
        } catch {
            // ignore
        }

        const getBounds = (o: any): SnapBounds => {
            const width = Math.abs((o.width || 0) * (o.scaleX || 1))
            const height = Math.abs((o.height || 0) * (o.scaleY || 1))
            let actualLeft = o.left || 0
            let actualTop = o.top || 0
            if (o.originX === 'center') {
                actualLeft = (o.left || 0) - width / 2
            } else if (o.originX === 'right') {
                actualLeft = (o.left || 0) - width
            }
            if (o.originY === 'center') {
                actualTop = (o.top || 0) - height / 2
            } else if (o.originY === 'bottom') {
                actualTop = (o.top || 0) - height
            }
            return {
                left: actualLeft,
                right: actualLeft + width,
                top: actualTop,
                bottom: actualTop + height,
                centerX: actualLeft + width / 2,
                centerY: actualTop + height / 2,
                width,
                height
            }
        }

        const w = (o: any) => Math.abs((o.width || 0) * (o.scaleX || 1))
        const h = (o: any) => Math.abs((o.height || 0) * (o.scaleY || 1))

        const setObjLeft = (obj: any, x: number) => {
            const width = w(obj)
            if (obj.originX === 'center') {
                obj.set('left', x + width / 2)
            } else if (obj.originX === 'right') {
                obj.set('left', x + width)
            } else {
                obj.set('left', x)
            }
        }
        const setObjRight = (obj: any, x: number) => {
            const width = w(obj)
            if (obj.originX === 'center') {
                obj.set('left', x - width / 2)
            } else if (obj.originX === 'right') {
                obj.set('left', x)
            } else {
                obj.set('left', x - width)
            }
        }
        const setObjTop = (obj: any, y: number) => {
            const height = h(obj)
            if (obj.originY === 'center') {
                obj.set('top', y + height / 2)
            } else if (obj.originY === 'bottom') {
                obj.set('top', y + height)
            } else {
                obj.set('top', y)
            }
        }
        const setObjBottom = (obj: any, y: number) => {
            const height = h(obj)
            if (obj.originY === 'center') {
                obj.set('top', y - height / 2)
            } else if (obj.originY === 'bottom') {
                obj.set('top', y)
            } else {
                obj.set('top', y - height)
            }
        }
        const setObjCenterX = (obj: any, x: number) => {
            const width = w(obj)
            if (obj.originX === 'left') {
                obj.set('left', x - width / 2)
            } else if (obj.originX === 'right') {
                obj.set('left', x + width / 2)
            } else {
                obj.set('left', x)
            }
        }
        const setObjCenterY = (obj: any, y: number) => {
            const height = h(obj)
            if (obj.originY === 'top') {
                obj.set('top', y - height / 2)
            } else if (obj.originY === 'bottom') {
                obj.set('top', y + height / 2)
            } else {
                obj.set('top', y)
            }
        }

        const isControl = (o: any) => {
            const n = (o?.name || '').toString()
            return n === 'path_node' || n === 'bezier_handle' || n === 'control_point' || n === 'handle_line'
        }

        let cachedSnapTargets: any[] | null = null
        let cachedSnapExclude: any = null
        let cachedTargetBounds: Map<any, SnapBounds> | null = null
        const frameLookup = new Map<string, any | null>()
        let cachedZones: any[] | null = null
        let cachedZoneById: Map<string, any> | null = null
        let cachedZoneMetrics: Map<any, any> | null = null

        const invalidateSnapCache = () => {
            cachedSnapTargets = null
            cachedSnapExclude = null
            cachedTargetBounds = null
            cachedZones = null
            cachedZoneById = null
            cachedZoneMetrics = null
            frameLookup.clear()
        }

        const getSnapTargets = (exclude: any) => {
            if (cachedSnapTargets && cachedSnapExclude === exclude && cachedTargetBounds) return cachedSnapTargets

            const all = canvasInstance.getObjects()
            const parentFrameId = (exclude as any)?.parentFrameId as string | undefined
            const frameDescendants = (exclude as any)?.isFrame ? new Set(deps.getFrameDescendants(exclude)) : null
            const nextTargets: any[] = []
            const nextBounds = new Map<any, SnapBounds>()

            for (const o of all) {
                if (!o || o === exclude) continue
                if (frameDescendants && frameDescendants.has(o)) continue
                if (o.excludeFromExport || isControl(o)) continue
                if (o.id === 'artboard-bg' || o.id === 'guide-vertical' || o.id === 'guide-horizontal') continue
                if (parentFrameId && o.isFrame && o._customId === parentFrameId) continue
                nextTargets.push(o)
                nextBounds.set(o, getBounds(o))
            }

            cachedSnapTargets = nextTargets
            cachedTargetBounds = nextBounds
            cachedSnapExclude = exclude
            return cachedSnapTargets
        }

        const getCachedBounds = (o: any): SnapBounds => {
            const cached = cachedTargetBounds?.get(o)
            if (cached) return cached
            const fresh = getBounds(o)
            if (cachedTargetBounds) cachedTargetBounds.set(o, fresh)
            return fresh
        }

        const getSnapFrameById = (frameId: string | undefined) => {
            if (!frameId) return null
            if (frameLookup.has(frameId)) return frameLookup.get(frameId) || null
            const frame = canvasInstance.getObjects().find((o: any) => o.isFrame && o._customId === frameId) || null
            frameLookup.set(frameId, frame)
            return frame
        }

        const getCachedZoneMetrics = (zone: any) => {
            if (!zone) return null
            if (!cachedZoneMetrics) cachedZoneMetrics = new Map<any, any>()
            if (cachedZoneMetrics.has(zone)) return cachedZoneMetrics.get(zone) || null
            const metrics = deps.getZoneMetrics(zone) ?? zone.getBoundingRect(true)
            cachedZoneMetrics.set(zone, metrics)
            return metrics
        }

        const getCachedZones = () => {
            if (cachedZones && cachedZoneById && cachedZoneMetrics) return cachedZones
            const zones = canvasInstance.getObjects().filter((o: any) => deps.isLikelyProductZone(o))
            const byId = new Map<string, any>()
            const metricsMap = new Map<any, any>()
            zones.forEach((zone: any) => {
                const id = String(zone?._customId || '').trim()
                if (id) byId.set(id, zone)
                metricsMap.set(zone, deps.getZoneMetrics(zone) ?? zone.getBoundingRect(true))
            })
            cachedZones = zones
            cachedZoneById = byId
            cachedZoneMetrics = metricsMap
            return zones
        }

        const getCachedZoneById = (zoneId: string) => {
            const id = String(zoneId || '').trim()
            if (!id) return null
            if (!cachedZoneById) getCachedZones()
            return cachedZoneById?.get(id) || null
        }

        let lastPointer = { x: 0, y: 0 }
        let constrainAxis: 'x' | 'y' | null = null
        let constrainRef = { left: 0, top: 0 }
        let stickySnapOwner: any = null
        let stickyVerticalSnap: { x: number; type: 'left' | 'right' | 'center' } | null = null
        let stickyHorizontalSnap: { y: number; type: 'top' | 'bottom' | 'center' } | null = null
        let lastMoveEvalPoint = { x: 0, y: 0 }
        let hasLastMoveEvalPoint = false
        let moveActivationPoint = { x: 0, y: 0 }
        let hasMoveActivationPoint = false
        let isMoveArmedForSnap = false
        const clearStickySnaps = () => {
            stickyVerticalSnap = null
            stickyHorizontalSnap = null
        }
        let lastGuideRender = {
            vVisible: false,
            hVisible: false,
            vX: 0,
            hY: 0
        }
        const getVerticalSnapDistance = (
            bounds: SnapBounds,
            snap: { x: number; type: 'left' | 'right' | 'center' }
        ) => {
            if (snap.type === 'left') return Math.abs(bounds.left - snap.x)
            if (snap.type === 'right') return Math.abs(bounds.right - snap.x)
            return Math.abs(bounds.centerX - snap.x)
        }
        const getHorizontalSnapDistance = (
            bounds: SnapBounds,
            snap: { y: number; type: 'top' | 'bottom' | 'center' }
        ) => {
            if (snap.type === 'top') return Math.abs(bounds.top - snap.y)
            if (snap.type === 'bottom') return Math.abs(bounds.bottom - snap.y)
            return Math.abs(bounds.centerY - snap.y)
        }
        const hideGuides = () => {
            if (verticalGuide.visible) verticalGuide.set({ visible: false })
            if (horizontalGuide.visible) horizontalGuide.set({ visible: false })
            lastGuideRender.vVisible = false
            lastGuideRender.hVisible = false
        }

        const getViewportBounds = () => {
            const vpt = canvasInstance.viewportTransform || [1, 0, 0, 1, 0, 0]
            const w = (typeof canvasInstance.getWidth === 'function' ? canvasInstance.getWidth() : canvasInstance.width) || 0
            const h = (typeof canvasInstance.getHeight === 'function' ? canvasInstance.getHeight() : canvasInstance.height) || 0
            try {
                const inv = deps.fabric.util.invertTransform(vpt)
                const tl = deps.fabric.util.transformPoint({ x: 0, y: 0 }, inv)
                const br = deps.fabric.util.transformPoint({ x: w, y: h }, inv)
                const minX = Math.min(tl.x, br.x)
                const maxX = Math.max(tl.x, br.x)
                const minY = Math.min(tl.y, br.y)
                const maxY = Math.max(tl.y, br.y)
                return { minX, maxX, minY, maxY }
            } catch {
                return { minX: -100000, maxX: 100000, minY: -100000, maxY: 100000 }
            }
        }

        const syncMovingFrameClip = (target: any) => {
            if (!target || target.isFrame || target.excludeFromExport) return
            if (!(target as any).parentFrameId) return
            try {
                deps.syncObjectFrameClip(target)
            } catch {
                // ignore clip sync errors during drag
            }
        }

        const getPointer = (evt: MouseEvent) => {
            const el = deps.canvasEl || canvasInstance.getElement?.()
            if (!el) return { x: 0, y: 0 }
            const rect = el.getBoundingClientRect()
            const vpt = canvasInstance.viewportTransform || [1, 0, 0, 1, 0, 0]
            const z = canvasInstance.getZoom() || 1
            return {
                x: (evt.clientX - rect.left - vpt[4]) / z,
                y: (evt.clientY - rect.top - vpt[5]) / z
            }
        }

        const objectMovingHandler = (e: any) => {
            const obj = e.target
            const evt = e.e as MouseEvent | undefined
            const currentTransform: any = (canvasInstance as any)?._currentTransform
            const transformAction = String(currentTransform?.action || '').toLowerCase()
            const isScaleTransform = !!currentTransform && transformAction.includes('scale')
            const zoom = Math.max(0.01, Number(canvasInstance.getZoom?.() || 1))
            const snapRange = SNAP_RANGE_PX / zoom
            const isRectOrImage = String(obj.type || '').toLowerCase() === 'rect' || String(obj.type || '').toLowerCase() === 'image'
            const activeSnapRange = snapRange * (isRectOrImage ? SNAP_RANGE_FACTOR_RECT_IMAGE : 1)
            const snapReleaseFactor = isRectOrImage ? SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE : SNAP_HYSTERESIS_HOLD_FACTOR

            if (!obj || isControl(obj)) {
                hideGuides()
                return
            }

            if (!evt?.shiftKey && !evt?.altKey && !isScaleTransform) {
                const pointerScreen = evt
                    ? { x: Number(evt.clientX || 0), y: Number(evt.clientY || 0) }
                    : null
                const currentMoveX = pointerScreen?.x ?? Number(obj.left || 0)
                const currentMoveY = pointerScreen?.y ?? Number(obj.top || 0)
                const moveGatePx = isRectOrImage ? SNAP_MOVE_EPSILON_PX_RECT_IMAGE : SNAP_MOVE_EPSILON_PX
                const fastMoveSuppressionPx = isRectOrImage
                    ? SNAP_FAST_MOVE_SUPPRESSION_PX_RECT_IMAGE
                    : SNAP_FAST_MOVE_SUPPRESSION_PX

                if (!hasMoveActivationPoint) {
                    moveActivationPoint = { x: currentMoveX, y: currentMoveY }
                    hasMoveActivationPoint = true
                    isMoveArmedForSnap = false
                }

                if (!isMoveArmedForSnap) {
                    const moveFromActivation = Math.hypot(currentMoveX - moveActivationPoint.x, currentMoveY - moveActivationPoint.y)
                    if (moveFromActivation < moveGatePx) {
                        hasLastMoveEvalPoint = true
                        lastMoveEvalPoint = { x: currentMoveX, y: currentMoveY }
                        hideGuides()
                        syncMovingFrameClip(obj)
                        return
                    }
                    isMoveArmedForSnap = true
                }

                const perFrameMoveGatePx = isRectOrImage ? moveGatePx : SNAP_MOVE_EPSILON_PX
                if (hasLastMoveEvalPoint) {
                    const moveDelta = Math.hypot(currentMoveX - lastMoveEvalPoint.x, currentMoveY - lastMoveEvalPoint.y)
                    if (moveDelta < perFrameMoveGatePx) {
                        lastMoveEvalPoint = { x: currentMoveX, y: currentMoveY }
                        hideGuides()
                        syncMovingFrameClip(obj)
                        return
                    }
                    if (moveDelta >= fastMoveSuppressionPx) {
                        lastMoveEvalPoint = { x: currentMoveX, y: currentMoveY }
                        hideGuides()
                        clearStickySnaps()
                        syncMovingFrameClip(obj)
                        return
                    }
                } else {
                    hasLastMoveEvalPoint = true
                }
                lastMoveEvalPoint = { x: currentMoveX, y: currentMoveY }
            } else {
                hasMoveActivationPoint = false
                hasLastMoveEvalPoint = false
                isMoveArmedForSnap = false
            }

            const isTransforming =
                !!currentTransform &&
                (transformAction.includes('scale') || transformAction.includes('rotate') || transformAction.includes('skew'))
            const allowPositionSnap = !(isTransforming && currentTransform?.target === obj)
            if (stickySnapOwner !== obj) {
                stickySnapOwner = obj
                clearStickySnaps()
                hasMoveActivationPoint = false
                isMoveArmedForSnap = false
                hasLastMoveEvalPoint = false
            }

            if (deps.isActiveSelectionObject(obj) && typeof obj.getObjects === 'function') {
                const members = (obj.getObjects() || []).slice()
                members.forEach((member: any) => {
                    if (!member) return
                    if (member.group && !member.group.isSmartObject && !member.group.isProductCard && deps.isLikelyProductCard(member.group)) {
                        member.group.isSmartObject = true
                        member.group.isProductCard = true
                    }
                    if (deps.shouldApplyContainmentConstraints(member)) {
                        deps.applyContainmentConstraints(member)
                    }
                    try {
                        if (member.parentFrameId) deps.syncObjectFrameClip(member)
                    } catch {
                        // ignore clip sync errors during drag
                    }
                })
                hideGuides()
                clearStickySnaps()
                return
            }

            if (obj.group && !obj.group.isSmartObject && !obj.group.isProductCard && deps.isLikelyProductCard(obj.group)) {
                obj.group.isSmartObject = true
                obj.group.isProductCard = true
            }

            if (obj.group && (obj.group as any).isSmartObject) {
                hideGuides()
                clearStickySnaps()
                const parentGroup = obj.group
                const cardW = (parentGroup as any)._cardWidth || parentGroup.width
                const cardH = (parentGroup as any)._cardHeight || parentGroup.height

                ;(obj as any).__manualTransform = true
                ;(obj as any).__manualTransformCardW = Number(cardW) || (obj as any).__manualTransformCardW
                ;(obj as any).__manualTransformCardH = Number(cardH) || (obj as any).__manualTransformCardH

                const halfW = cardW / 2, halfH = cardH / 2
                const objW = obj.getScaledWidth(), objH = obj.getScaledHeight()
                let minX = -halfW, maxX = halfW, minY = -halfH, maxY = halfH
                if (obj.originX === 'center') { minX = -halfW + objW / 2; maxX = halfW - objW / 2 } else if (obj.originX === 'left') { maxX = halfW - objW }
                if (obj.originY === 'center') { minY = -halfH + objH / 2; maxY = halfH - objH / 2 } else if (obj.originY === 'top') { maxY = halfH - objH }
                if (minX > maxX) { const t = minX; minX = maxX; maxX = t }
                if (minY > maxY) { const t = minY; minY = maxY; maxY = t }
                if (obj.left < minX) obj.set('left', minX); if (obj.left > maxX) obj.set('left', maxX)
                if (obj.top < minY) obj.set('top', minY); if (obj.top > maxY) obj.set('top', maxY)
                obj.setCoords?.()
                syncMovingFrameClip(obj)
                return
            }

            const isCardLike = !!(
                obj.isSmartObject ||
                obj.isProductCard ||
                String(obj.name || '').startsWith('product-card') ||
                deps.isLikelyProductCard(obj) ||
                String((obj as any).parentZoneId || '').trim().length
            )
            let handledCardZoneDrag = false
            if (isCardLike) {
                if (!obj.isProductCard && !obj.isSmartObject && deps.isLikelyProductCard(obj)) {
                    obj.isProductCard = true
                    obj.isSmartObject = true
                }

                let zone: any = null
                const zoneId = String((obj as any).parentZoneId || '').trim()
                if (zoneId) {
                    zone = getCachedZoneById(zoneId)
                }
                if (!zone) {
                    const slotZoneId = String((obj as any)?._zoneSlot?.zoneId || '').trim()
                    if (slotZoneId) {
                        zone = getCachedZoneById(slotZoneId)
                    }
                }

                if (!zone) {
                    hideGuides()
                    clearStickySnaps()
                    syncMovingFrameClip(obj)
                    return
                }

                if (zone) {
                    const boundZone = zone
                    const center = typeof obj.getCenterPoint === 'function' ? obj.getCenterPoint() : null
                    const objW = obj.getScaledWidth?.() ?? 0
                    const objH = obj.getScaledHeight?.() ?? 0

                    if (center) {
                        const zr = getCachedZoneMetrics(boundZone) ?? boundZone.getBoundingRect(true)
                        const pad = typeof (boundZone as any)._zonePadding === 'number' ? (boundZone as any)._zonePadding : 20
                        let minCx = zr.left + pad + (objW / 2)
                        let maxCx = (zr.left + zr.width) - pad - (objW / 2)
                        let minCy = zr.top + pad + (objH / 2)
                        let maxCy = (zr.top + zr.height) - pad - (objH / 2)
                        if (minCx > maxCx) {
                            const centerX = zr.left + (zr.width / 2)
                            minCx = centerX
                            maxCx = centerX
                        }
                        if (minCy > maxCy) {
                            const centerY = zr.top + (zr.height / 2)
                            minCy = centerY
                            maxCy = centerY
                        }
                        const cx = clamp(center.x, minCx, maxCx)
                        const cy = clamp(center.y, minCy, maxCy)
                        setObjCenterX(obj, cx)
                        setObjCenterY(obj, cy)
                        obj.setCoords()
                        handledCardZoneDrag = true
                    }
                }
            }

            if (handledCardZoneDrag) {
                hideGuides()
                clearStickySnaps()
                syncMovingFrameClip(obj)
                return
            }

            if (obj.group && (obj.group as any).isProductZone) {
                hideGuides()
                clearStickySnaps()
                const zone = obj.group
                const zoneW = (zone as any)._zoneWidth || zone.width
                const zoneH = (zone as any)._zoneHeight || zone.height
                const halfW = zoneW / 2, halfH = zoneH / 2
                const cardW = obj.getScaledWidth(), cardH = obj.getScaledHeight()
                let minX = -halfW, maxX = halfW - cardW, minY = -halfH, maxY = halfH - cardH
                if (obj.originX === 'center') { minX = -halfW + cardW / 2; maxX = halfW - cardW / 2 }
                if (obj.originY === 'center') { minY = -halfH + cardH / 2; maxY = halfH - cardH / 2 }
                if (obj.left < minX) obj.set('left', minX); if (obj.left > maxX) obj.set('left', maxX)
                if (obj.top < minY) obj.set('top', minY); if (obj.top > maxY) obj.set('top', maxY)
                syncMovingFrameClip(obj)
                return
            }

            if (evt?.shiftKey) {
                hideGuides()
                clearStickySnaps()
                const ptr = getPointer(evt)
                const dx = Math.abs(ptr.x - lastPointer.x)
                const dy = Math.abs(ptr.y - lastPointer.y)
                if (constrainAxis === null && (dx > 2 || dy > 2)) {
                    constrainAxis = dx >= dy ? 'y' : 'x'
                    constrainRef = { left: obj.left, top: obj.top }
                }
                if (constrainAxis === 'x') obj.set('top', constrainRef.top)
                if (constrainAxis === 'y') obj.set('left', constrainRef.left)
                lastPointer = ptr
                syncMovingFrameClip(obj)
                return
            }
            constrainAxis = null
            if (evt) lastPointer = getPointer(evt)

            if (evt?.altKey) {
                hideGuides()
                clearStickySnaps()
                syncMovingFrameClip(obj)
                return
            }

            if (obj.group && String(obj.group.type || '').toLowerCase() !== 'activeselection') {
                hideGuides()
                clearStickySnaps()
                syncMovingFrameClip(obj)
                return
            }

            const anySnapEnabled = !!(deps.snapToObjects.value || (deps.snapToGuides.value && deps.viewShowGuides.value) || deps.snapToGrid.value)
            if (!anySnapEnabled) {
                hideGuides()
                clearStickySnaps()
                syncMovingFrameClip(obj)
                return
            }

            const targets = deps.snapToObjects.value ? (getSnapTargets(obj) || []) : []
            const b = getBounds(obj)

            const parentFrameId = (obj as any).parentFrameId as string | undefined
            const parentFrame = getSnapFrameById(parentFrameId)

            const pageW = deps.activePage.value?.width ?? 1080
            const pageH = deps.activePage.value?.height ?? 1920
            const container = parentFrame
                ? (() => {
                    const fb = getCachedBounds(parentFrame)
                    return {
                        left: fb.left,
                        right: fb.right,
                        top: fb.top,
                        bottom: fb.bottom,
                        centerX: fb.centerX,
                        centerY: fb.centerY
                    }
                })()
                : {
                    left: 0,
                    right: pageW,
                    top: 0,
                    bottom: pageH,
                    centerX: pageW / 2,
                    centerY: pageH / 2
                }

            let vVisible = false, hVisible = false
            let vX = 0, hY = 0
            let bestVDist = snapRange + 1
            let bestHDist = snapRange + 1
            let snapVType: 'left' | 'right' | 'center' = 'center'
            let snapHType: 'top' | 'bottom' | 'center' = 'center'

            if (deps.snapToObjects.value) {
                const dlc = Math.abs(b.left - container.left)
                const drc = Math.abs(b.right - container.right)
                const dcc = Math.abs(b.centerX - container.centerX)
                if (dlc < bestVDist) { bestVDist = dlc; vX = container.left; snapVType = 'left' }
                if (drc < bestVDist) { bestVDist = drc; vX = container.right; snapVType = 'right' }
                if (dcc < bestVDist) { bestVDist = dcc; vX = container.centerX; snapVType = 'center' }

                const dtc = Math.abs(b.top - container.top)
                const dbc = Math.abs(b.bottom - container.bottom)
                const dmc = Math.abs(b.centerY - container.centerY)
                if (dtc < bestHDist) { bestHDist = dtc; hY = container.top; snapHType = 'top' }
                if (dbc < bestHDist) { bestHDist = dbc; hY = container.bottom; snapHType = 'bottom' }
                if (dmc < bestHDist) { bestHDist = dmc; hY = container.centerY; snapHType = 'center' }
            }

            const snapWindow = Math.max(240, snapRange * 20)
            for (const t of targets) {
                if (!t) continue
                const tb = getCachedBounds(t)
                if (
                    tb.right < b.left - snapWindow ||
                    tb.left > b.right + snapWindow ||
                    tb.bottom < b.top - snapWindow ||
                    tb.top > b.bottom + snapWindow
                ) {
                    continue
                }

                const dl = Math.abs(b.left - tb.left)
                const dr = Math.abs(b.right - tb.right)
                const dlr = Math.abs(b.left - tb.right)
                const drl = Math.abs(b.right - tb.left)
                const dc = Math.abs(b.centerX - tb.centerX)

                if (dl < bestVDist) { bestVDist = dl; vX = tb.left; snapVType = 'left' }
                if (dr < bestVDist) { bestVDist = dr; vX = tb.right; snapVType = 'right' }
                if (dlr < bestVDist) { bestVDist = dlr; vX = tb.right; snapVType = 'left' }
                if (drl < bestVDist) { bestVDist = drl; vX = tb.left; snapVType = 'right' }
                if (dc < bestVDist) { bestVDist = dc; vX = tb.centerX; snapVType = 'center' }

                const dt = Math.abs(b.top - tb.top)
                const dbo = Math.abs(b.bottom - tb.bottom)
                const dtb = Math.abs(b.top - tb.bottom)
                const dbt = Math.abs(b.bottom - tb.top)
                const dcy2 = Math.abs(b.centerY - tb.centerY)

                if (dt < bestHDist) { bestHDist = dt; hY = tb.top; snapHType = 'top' }
                if (dbo < bestHDist) { bestHDist = dbo; hY = tb.bottom; snapHType = 'bottom' }
                if (dtb < bestHDist) { bestHDist = dtb; hY = tb.bottom; snapHType = 'top' }
                if (dbt < bestHDist) { bestHDist = dbt; hY = tb.top; snapHType = 'bottom' }
                if (dcy2 < bestHDist) { bestHDist = dcy2; hY = tb.centerY; snapHType = 'center' }
            }

            if (deps.snapToGuides.value && deps.viewShowGuides.value) {
                const gids = deps.userGuidesIndex.value || []
                for (const g of gids) {
                    if (!g) continue
                    if (g.axis === 'x') {
                        const gx = Number(g.pos || 0)
                        const dl = Math.abs(b.left - gx)
                        const dr = Math.abs(b.right - gx)
                        const dc = Math.abs(b.centerX - gx)
                        if (dl < bestVDist) { bestVDist = dl; vX = gx; snapVType = 'left' }
                        if (dr < bestVDist) { bestVDist = dr; vX = gx; snapVType = 'right' }
                        if (dc < bestVDist) { bestVDist = dc; vX = gx; snapVType = 'center' }
                    } else {
                        const gy = Number(g.pos || 0)
                        const dt = Math.abs(b.top - gy)
                        const db = Math.abs(b.bottom - gy)
                        const dc = Math.abs(b.centerY - gy)
                        if (dt < bestHDist) { bestHDist = dt; hY = gy; snapHType = 'top' }
                        if (db < bestHDist) { bestHDist = db; hY = gy; snapHType = 'bottom' }
                        if (dc < bestHDist) { bestHDist = dc; hY = gy; snapHType = 'center' }
                    }
                }
            }

            const snapReleaseRange = activeSnapRange * snapReleaseFactor

            if (!allowPositionSnap) {
                clearStickySnaps()
            }

            const verticalStickyDist = stickyVerticalSnap ? getVerticalSnapDistance(b, stickyVerticalSnap) : Number.POSITIVE_INFINITY
            if (allowPositionSnap && stickyVerticalSnap && verticalStickyDist <= snapReleaseRange) {
                vVisible = true
                vX = stickyVerticalSnap.x
                snapVType = stickyVerticalSnap.type
            } else {
                if (stickyVerticalSnap && verticalStickyDist > snapReleaseRange) {
                    stickyVerticalSnap = null
                }
                if (bestVDist <= activeSnapRange) {
                    vVisible = true
                    stickyVerticalSnap = { x: vX, type: snapVType }
                }
            }

            const horizontalStickyDist = stickyHorizontalSnap ? getHorizontalSnapDistance(b, stickyHorizontalSnap) : Number.POSITIVE_INFINITY
            if (allowPositionSnap && stickyHorizontalSnap && horizontalStickyDist <= snapReleaseRange) {
                hVisible = true
                hY = stickyHorizontalSnap.y
                snapHType = stickyHorizontalSnap.type
            } else {
                if (stickyHorizontalSnap && horizontalStickyDist > snapReleaseRange) {
                    stickyHorizontalSnap = null
                }
                if (bestHDist <= activeSnapRange) {
                    hVisible = true
                    stickyHorizontalSnap = { y: hY, type: snapHType }
                }
            }

            if (allowPositionSnap && vVisible) {
                if (snapVType === 'left') setObjLeft(obj, vX)
                else if (snapVType === 'right') setObjRight(obj, vX)
                else setObjCenterX(obj, vX)
            }
            if (allowPositionSnap && hVisible) {
                if (snapHType === 'top') setObjTop(obj, hY)
                else if (snapHType === 'bottom') setObjBottom(obj, hY)
                else setObjCenterY(obj, hY)
            }

            if (allowPositionSnap && deps.snapToGrid.value && !isRectOrImage && !vVisible && !hVisible) {
                const gs = Math.max(4, Math.round(Number(deps.gridSize.value) || 20))
                const snappedLeft = Math.round(b.left / gs) * gs
                const snappedTop = Math.round(b.top / gs) * gs
                const dl = Math.abs(b.left - snappedLeft)
                const dt = Math.abs(b.top - snappedTop)
                if (dl <= activeSnapRange) {
                    setObjLeft(obj, snappedLeft)
                    vVisible = true
                    vX = snappedLeft
                    snapVType = 'left'
                }
                if (dt <= activeSnapRange) {
                    setObjTop(obj, snappedTop)
                    hVisible = true
                    hY = snappedTop
                    snapHType = 'top'
                }
            }

            if (allowPositionSnap && (vVisible || hVisible)) {
                obj.setCoords()
            }

            if (vVisible || hVisible) {
                const vb = getViewportBounds()
                const viewW = Math.max(1, vb.maxX - vb.minX)
                const viewH = Math.max(1, vb.maxY - vb.minY)
                const pad = Math.max(400, Math.max(viewW, viewH) * 0.5)

                if (vVisible) {
                    if (!lastGuideRender.vVisible || lastGuideRender.vX !== vX) {
                        verticalGuide.set({ x1: vX, y1: vb.minY - pad, x2: vX, y2: vb.maxY + pad, visible: true })
                        lastGuideRender.vX = vX
                    }
                    lastGuideRender.vVisible = true
                } else if (lastGuideRender.vVisible) {
                    verticalGuide.set({ visible: false })
                    lastGuideRender.vVisible = false
                }

                if (hVisible) {
                    if (!lastGuideRender.hVisible || lastGuideRender.hY !== hY) {
                        horizontalGuide.set({ x1: vb.minX - pad, y1: hY, x2: vb.maxX + pad, y2: hY, visible: true })
                        lastGuideRender.hY = hY
                    }
                    lastGuideRender.hVisible = true
                } else if (lastGuideRender.hVisible) {
                    horizontalGuide.set({ visible: false })
                    lastGuideRender.hVisible = false
                }

                if (lastGuideRender.vVisible || lastGuideRender.hVisible) {
                    try {
                        if (typeof canvasInstance.bringObjectToFront === 'function') {
                            canvasInstance.bringObjectToFront(verticalGuide)
                            canvasInstance.bringObjectToFront(horizontalGuide)
                        }
                    } catch {
                        // ignore
                    }
                }
            } else {
                if (lastGuideRender.vVisible) {
                    verticalGuide.set({ visible: false })
                    lastGuideRender.vVisible = false
                }
                if (lastGuideRender.hVisible) {
                    horizontalGuide.set({ visible: false })
                    lastGuideRender.hVisible = false
                }
            }

            syncMovingFrameClip(obj)
        }

        let objectMoveRafId: number | null = null
        let pendingObjectMoveEvent: { target: any; e?: MouseEvent } | null = null

        const flushPendingObjectMove = () => {
            if (!pendingObjectMoveEvent) return
            const nextEvent = pendingObjectMoveEvent
            pendingObjectMoveEvent = null
            objectMovingHandler(nextEvent as any)
        }

        const queueObjectMove = (e: any) => {
            pendingObjectMoveEvent = {
                target: e?.target,
                e: e?.e
            }
            if (objectMoveRafId !== null) return
            objectMoveRafId = requestAnimationFrame(() => {
                objectMoveRafId = null
                flushPendingObjectMove()
            })
        }

        const mouseUpHandler = () => {
            if (objectMoveRafId !== null) {
                cancelAnimationFrame(objectMoveRafId)
                objectMoveRafId = null
            }
            flushPendingObjectMove()
            hideGuides()
            constrainAxis = null
            clearStickySnaps()
            stickySnapOwner = null
            hasLastMoveEvalPoint = false
            hasMoveActivationPoint = false
            isMoveArmedForSnap = false
            invalidateSnapCache()
            deps.flushZoneRelayoutOnDrop()
            deps.safeRequestRenderAll(canvasInstance)
            deps.refreshSelectedRef()
        }

        canvasInstance.on('object:moving', queueObjectMove)
        canvasInstance.on('object:scaling', queueObjectMove)
        canvasInstance.on('object:rotating', queueObjectMove)
        canvasInstance.on('mouse:up', mouseUpHandler)
        canvasInstance.on('object:added', invalidateSnapCache)
        canvasInstance.on('object:removed', invalidateSnapCache)
        canvasInstance.on('object:modified', invalidateSnapCache)

        teardownRef.value = () => {
            try {
                canvasInstance.off('object:moving', queueObjectMove)
                canvasInstance.off('object:scaling', queueObjectMove)
                canvasInstance.off('object:rotating', queueObjectMove)
                canvasInstance.off('mouse:up', mouseUpHandler)
                canvasInstance.off('object:added', invalidateSnapCache)
                canvasInstance.off('object:removed', invalidateSnapCache)
                canvasInstance.off('object:modified', invalidateSnapCache)
            } catch {
                // ignore teardown errors
            }
            if (objectMoveRafId !== null) {
                cancelAnimationFrame(objectMoveRafId)
                objectMoveRafId = null
            }
            pendingObjectMoveEvent = null
            clearStickySnaps()
            stickySnapOwner = null
            hideGuides()
            try {
                if (verticalGuide.canvas === canvasInstance) canvasInstance.remove(verticalGuide)
                if (horizontalGuide.canvas === canvasInstance) canvasInstance.remove(horizontalGuide)
            } catch {
                // ignore guide cleanup errors
            }
            invalidateSnapCache()
        }
    }

    const teardown = () => {
        if (teardownRef.value) {
            teardownRef.value()
            teardownRef.value = null
        }
    }

    return { setup, teardown }
}

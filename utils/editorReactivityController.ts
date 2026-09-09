type GlobalStyles = Record<string, any>

export type EditorReactivityContext = Record<string, any>

export const createEditorReactivityController = (ctx: EditorReactivityContext) => {
    const { applyCardFrameBinding, applyContainmentConstraints, applyVisibleSelectionChrome, canvas, canvasContextMenu, clamp, collectObjectsDeep, configureDynamicBusinessTextObject, enableCardElementRotationControl, ensureCardZoneBinding, ensureFramesBelowContents, ensurePersistentContentFlags, ensureZoneSanity, fabric, findFrameUnderObject, findProductCardParentGroup, findProductZoneById, fitDynamicBusinessTextObject, flushTextEditSave, focusProductZoneFromDblClickTarget, getCardSizeForPriceGroup, getFrameById, getFrameDescendants, getObjectCenterInParentPlane, getOrCreateFrameClipRect, getResolvedZoneFrameId, getZoneChildren, getZoneGlobalStyles, getZoneRect, hasParentZoneBinding, invalidateContainmentZoneCache, invalidateFrameRuntimeCache, invalidateScrollbarBounds, invalidateZoneRuntimeIndex, isActiveSelectionObject, isCanvasDestroyed, isControlLikeObject, isDesignLoading, isDynamicBusinessFieldObject, isFrameLikeObject, isHistoryProcessing, isLikelyProductZone, isNodeEditing, isPenMode, isPriceGroupBackground, isPriceGroupObject, isProductCardContainer, isProductNameText, isQuickLogoImageObject, isQuickMode, isQuickModeLockedObject, isTextStyleObject, isTransientCanvasObject, isValidFabricCanvasObject, layersContextMenu, makeCanvasObjectId, markFrameLabelsDirty, markPriceGroupAsManuallyCustomized, markPriceGroupTransformAsManual, maybeReparentToFrameOnDrop, moveFrameDescendants, normalizeGlobalStyles, normalizePriceGroupPlacementInCard, priceGroupsWithDeepSelect, productZoneState, queueTextEditSave, reflowDynamicBusinessTextObject, refreshCanvasObjects, refreshSelectedRef, relayoutProductZonesAfterCardRemoval, resizeSmartObject, resolvePriceGroupAncestor, resolveSelectedProductImageActionContext, safeAddWithUpdate, safeRequestRenderAll, sanitizeCanvasObjectStack, scheduleViewportCulling, selectedPriceGroupSelectionKind, selectedPriceGroupSubTarget, setFabricControlsHiddenDuringTransform, setObjectCenterInParentPlane, setPriceGroupInteractionMode, shouldApplyContainmentConstraints, showProductReviewModal, syncCardProductDataNameFromTitleTarget, syncCardProductDataTitleWidthFromTarget, syncFrameClips, syncObjectFrameClip, syncQuickLogoBackdrop, syncZoneCardFrameBindings, trimContainerEmptySpace, updateFloatingUI, updatePriceGroupSelectionIntent, updateProductImageSelectionIntent, updateScrollbars, updateSelection } = ctx

const setupReactivity = () => {
    if (!canvas.value) return;
    if (ctx.getReactivityBoundCanvas() === canvas.value) return;
    // Teardown any previous binding to avoid duplicate listeners
    const existingTeardownReactivity = ctx.getTeardownReactivity()
    if (existingTeardownReactivity) {
        existingTeardownReactivity();
        ctx.setTeardownReactivity(null);
    }
    if (!canvas.value) return;

    const tracked: Array<{ event: string; handler: any }> = [];
    const trackOn = (event: string, handler: any) => {
        canvas.value!.on(event, handler);
        tracked.push({ event, handler });
    };

    ctx.setReactivityBoundCanvas(canvas.value);

    type QuickModeZoneTransform = {
        left: number;
        top: number;
        scaleX: number;
        scaleY: number;
        angle: number;
        skewX: number;
        skewY: number;
        flipX: boolean;
        flipY: boolean;
    };

    // A zona continua editável no modo avançado, mas é uma estrutura fixa no
    // modo rápido. Guardamos o transform apenas em memória para impedir um
    // drag/scale/rotate acidental sem gravar flags de bloqueio no modelo.
    const quickModeZoneTransforms = new WeakMap<object, QuickModeZoneTransform>();
    const getQuickModeLockedZones = (obj: any): any[] => {
        if (!isQuickMode.value || !obj) return [];
        const zones: any[] = [];
        const visited = new Set<any>();
        const visit = (candidate: any) => {
            if (!candidate || typeof candidate !== 'object' || visited.has(candidate)) return;
            visited.add(candidate);
            if (isLikelyProductZone(candidate)) {
                if (!zones.includes(candidate)) zones.push(candidate);
                return;
            }
            if (isActiveSelectionObject(candidate) && typeof candidate.getObjects === 'function') {
                (candidate.getObjects() || []).forEach((member: any) => visit(member));
                return;
            }
            if (candidate.group) visit(candidate.group);
        };
        visit(obj);
        return zones;
    };
    const rememberQuickModeZoneTransform = (zone: any) => {
        if (!zone || !isQuickMode.value || !isLikelyProductZone(zone) || quickModeZoneTransforms.has(zone)) return;
        const numberOr = (value: any, fallback: number) => (
            typeof value === 'number' && Number.isFinite(value) ? value : fallback
        );
        quickModeZoneTransforms.set(zone, {
            left: numberOr(zone.left, 0),
            top: numberOr(zone.top, 0),
            scaleX: numberOr(zone.scaleX, 1),
            scaleY: numberOr(zone.scaleY, 1),
            angle: numberOr(zone.angle, 0),
            skewX: numberOr(zone.skewX, 0),
            skewY: numberOr(zone.skewY, 0),
            flipX: zone.flipX === true,
            flipY: zone.flipY === true
        });
    };
    const restoreQuickModeZoneTransform = (zone: any): boolean => {
        if (!zone || !isQuickMode.value || !isLikelyProductZone(zone)) return false;
        const initial = quickModeZoneTransforms.get(zone);
        if (!initial) return false;
        zone.set(initial);
        zone.setCoords?.();
        zone.set?.('dirty', true);
        return true;
    };
    const discardQuickModeLockedSelection = (obj: any): boolean => {
        const zones = getQuickModeLockedZones(obj);
        if (!zones.length) return false;
        zones.forEach((zone: any) => {
            rememberQuickModeZoneTransform(zone);
            restoreQuickModeZoneTransform(zone);
        });
        try {
            canvas.value?.discardActiveObject?.();
        } catch {
            // ignore — a seleção pode já ter sido removida pelo Fabric
        }
        safeRequestRenderAll();
        return true;
    };

    trackOn('object:added', invalidateFrameRuntimeCache);
    trackOn('object:removed', invalidateFrameRuntimeCache);
    trackOn('object:modified', invalidateFrameRuntimeCache);
    trackOn('object:added', invalidateContainmentZoneCache);
    trackOn('object:removed', invalidateContainmentZoneCache);
    trackOn('object:modified', invalidateContainmentZoneCache);
    trackOn('object:added', invalidateZoneRuntimeIndex);
    trackOn('object:removed', invalidateZoneRuntimeIndex);
    trackOn('object:modified', invalidateZoneRuntimeIndex);
    trackOn('object:added', (e: any) => {
        if (e?.target?.isFrame) markFrameLabelsDirty();
    });
    trackOn('object:removed', (e: any) => {
        if (e?.target?.isFrame) markFrameLabelsDirty();
    });
    trackOn('object:modified', (e: any) => {
        if (e?.target?.isFrame) markFrameLabelsDirty();
    });

    const isLikelyProductCard = (obj: any) => {
        if (!obj) return false;
        if (obj.excludeFromExport) return false;
        if (obj.isFrame) return false;
        if (isLikelyProductZone(obj)) return false;
        if (obj.type !== 'group' || typeof obj.getObjects !== 'function') return false;
        if (obj.isSmartObject || obj.isProductCard) return true;
        if (String(obj.name || '').startsWith('product-card')) return true;
        if (String((obj as any).parentZoneId || '').trim()) return true;
        const objs = obj.getObjects() || [];
        if (objs.some((o: any) => o?.name === 'offerBackground')) return true;
        const hasImage = objs.some((o: any) => String(o?.type || '').toLowerCase() === 'image');
        const hasPriceGroup = objs.some((o: any) => (
            String(o?.type || '').toLowerCase() === 'group' && String(o?.name || '') === 'priceGroup'
        ));
        return hasImage && hasPriceGroup;
    };

    const getStylesForCard = (card: any): Partial<GlobalStyles> => {
        if (!canvas.value) return normalizeGlobalStyles(productZoneState.globalStyles.value);
        const zoneId = card?.parentZoneId;
        if (zoneId) {
            const zone = findProductZoneById(zoneId);
            if (zone) return getZoneGlobalStyles(zone);
        }
        return normalizeGlobalStyles(productZoneState.globalStyles.value);
    };

    const isProductCardImage = (img: any) => {
        if (!img || String(img.type || '').toLowerCase() !== 'image') return false;
        const owner =
            (isProductCardContainer((img as any).group) ? (img as any).group : null) ||
            (isProductCardContainer((img as any).parent) ? (img as any).parent : null) ||
            findProductCardParentGroup(img);
        if (!owner) return false;
        return !!(
            owner.isSmartObject ||
            owner.isProductCard ||
            hasParentZoneBinding(owner) ||
            String(owner.name || '').startsWith('product-card') ||
            isLikelyProductCard(owner)
        );
    };

    const sanitizeProductCardImageTransform = (img: any, opts: { clampWithinCard?: boolean } = {}) => {
        if (!img || !isProductCardImage(img)) return false;
        const clampWithinCard = opts.clampWithinCard !== false;
        const nextScaleX = Math.abs(Number(img.scaleX ?? 1)) || 1;
        const nextScaleY = Math.abs(Number(img.scaleY ?? 1)) || 1;

        img.set({
            scaleX: nextScaleX,
            scaleY: nextScaleY,
            flipX: false,
            flipY: false,
            lockScalingFlip: true,
            lockSkewingX: true,
            lockSkewingY: true
        });
        img.setCoords?.();

        if (clampWithinCard) {
            applyContainmentConstraints(img);
        }

        const parent = img.group;
        if (parent) {
            parent.dirty = true;
            parent.setCoords?.();
        }

        return true;
    };

    const normalizeCardScaleAndRelayout = (card: any, opts: { save?: boolean } = {}) => {
        if (!canvas.value || !card || card.type !== 'group') return;
        if (!isLikelyProductCard(card)) return;

        const shouldSave = opts.save !== false;
        const center = typeof card.getCenterPoint === 'function' ? card.getCenterPoint() : { x: card.left ?? 0, y: card.top ?? 0 };
        const scaledW = Math.abs(typeof card.getScaledWidth === 'function' ? card.getScaledWidth() : (Number(card.width || 0) * Number(card.scaleX || 1)));
        const scaledH = Math.abs(typeof card.getScaledHeight === 'function' ? card.getScaledHeight() : (Number(card.height || 0) * Number(card.scaleY || 1)));
        const nextW = Math.max(50, Math.round(Number(scaledW) || 0));
        const nextH = Math.max(50, Math.round(Number(scaledH) || 0));
        if (!nextW || !nextH) return;

        // Resetar scale e posição — NÃO setar width/height aqui
        // resizeSmartObject cuida de width/height + _cardWidth/_cardHeight
        card.set({
            originX: 'center',
            originY: 'center',
            left: center.x,
            top: center.y,
            scaleX: 1,
            scaleY: 1,
            flipX: false,
            flipY: false
        });

        const styles = getStylesForCard(card);
        resizeSmartObject(card, nextW, nextH, styles);
        card.setCoords();
        safeRequestRenderAll();
        if (shouldSave) ctx.getSaveCurrentState()();
    };

    const isProductCardImageSelectionCandidate = (obj: any) => {
        if (!isProductCardImage(obj)) return false;
        const smartType = String((obj as any)?.data?.smartType || '').toLowerCase();
        const name = String((obj as any)?.name || '').toLowerCase();
        if (name === 'label_bg_image' || name === 'price_bg_image' || name === 'splash_image') return false;
        if (smartType === 'product-image') return true;
        if (name === 'smart_image' || name === 'product_image' || name === 'productimage') return true;
        if (name.startsWith('extra_image_')) return true;
        return true;
    };

    const getCardImageCandidatesDeep = (card: any) => {
        if (!card || !isLikelyProductCard(card)) return [] as any[];
        const out: any[] = [];
        const walk = (node: any) => {
            if (!node) return;
            if (isProductCardImageSelectionCandidate(node) && node?.visible !== false) {
                out.push(node);
            }
            if (typeof node?.getObjects === 'function') {
                const children = node.getObjects() || [];
                children.forEach((child: any) => walk(child));
            }
        };
        walk(card);
        return out;
    };

    const pickPreferredProductImageFromCard = (card: any) => {
        if (!card || !isLikelyProductCard(card) || typeof card.getObjects !== 'function') return null;
        try {
            card.set?.({
                subTargetCheck: true,
                interactive: true,
                selectable: true,
                evented: true
            });
            card.setCoords?.();
        } catch {
            // ignore
        }
        const children = getCardImageCandidatesDeep(card);
        if (!children.length) return null;

        const primary = children.find((child: any) => {
            const smartType = String((child as any)?.data?.smartType || '').toLowerCase();
            const name = String((child as any)?.name || '').toLowerCase();
            return smartType === 'product-image' || name === 'smart_image' || name === 'product_image' || name === 'productimage';
        });
        const preferred = primary || children[children.length - 1] || null;
        if (!preferred) return null;
        try {
            preferred.set?.({
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true
            });
            preferred.setCoords?.();
        } catch {
            // ignore
        }
        return preferred;
    };

    const getDeepSelectedProductImageFromCard = (card: any) => {
        if (!card || !isLikelyProductCard(card)) return null;
        const deepActive = (card as any)?._activeObject;
        if (isProductCardImageSelectionCandidate(deepActive)) return deepActive;
        return null;
    };

    const resolveSelectionRootObject = (obj: any, opts: { keepCardImages?: boolean } = {}) => {
        if (!obj || isTransientCanvasObject(obj)) return null;
        const keepCardImages = opts.keepCardImages !== false;
        if (isProductNameText(obj) || String(obj?.name || '') === 'priceGroup' || obj?.isPriceGroup === true) return obj;
        if (keepCardImages && isProductCardImageSelectionCandidate(obj)) return obj;
        if (keepCardImages && isLikelyProductCard(obj)) {
            const deepSelected = getDeepSelectedProductImageFromCard(obj);
            if (deepSelected) return deepSelected;
        }
        if (keepCardImages && isLikelyProductCard(obj)) {
            const preferred = pickPreferredProductImageFromCard(obj);
            if (preferred) return preferred;
        }
        if (isLikelyProductCard(obj)) return obj;
        const parentCard = findProductCardParentGroup(obj);
        if (keepCardImages && parentCard) {
            const preferred = pickPreferredProductImageFromCard(parentCard);
            if (preferred) return preferred;
        }
        if (parentCard) return parentCard;
        return obj;
    };

    const collectNormalizedSelectionMembers = (activeObj: any) => {
        if (!activeObj) return [] as any[];
        const rawMembers = isActiveSelectionObject(activeObj) && typeof activeObj.getObjects === 'function'
            ? (activeObj.getObjects() || [])
            : [activeObj];
        const keepCardImages = rawMembers.some((member: any) => isProductCardImageSelectionCandidate(member));
        const unique: any[] = [];
        rawMembers.forEach((member: any) => {
            const root = resolveSelectionRootObject(member, { keepCardImages });
            if (!root) return;
            if (!unique.includes(root)) unique.push(root);
        });

        // When drag-selecting, if frames/backgrounds are included alongside non-frame objects,
        // remove the frames — the user wants the objects ON the frame, not the frame itself.
        if (unique.length > 1) {
            const frames = unique.filter((o: any) => o.isFrame || isFrameLikeObject(o));
            const zones = unique.filter((o: any) => isLikelyProductZone(o));
            const nonFrameNonZone = unique.filter((o: any) => !o.isFrame && !isFrameLikeObject(o) && !isLikelyProductZone(o));

            if (nonFrameNonZone.length > 0 && (frames.length > 0 || zones.length > 0)) {
                // Keep only objects that are NOT frames/zones encompassing the selection
                return nonFrameNonZone;
            }
        }

        return unique;
    };

    const isProductTextOrPriceSelectionTarget = (obj: any) =>
        isProductNameText(obj) || String(obj?.name || '') === 'priceGroup' || obj?.isPriceGroup === true;

    // Shift+multi-select:
    // - keep deep-selected product images as independent targets (allows multi-select of images in a card)
    // - still prefer whole product cards for non-image inner elements.
    const resolveShiftSelectionRootObject = (obj: any) => {
        if (!obj || isTransientCanvasObject(obj)) return null;
        // Uma imagem já selecionada em profundidade continua independente:
        // converter para o card fazia Shift na segunda cópia alternar o mesmo card.
        if (isProductTextOrPriceSelectionTarget(obj)) return obj;
        if (isProductCardImageSelectionCandidate(obj)) return obj;
        if (isQuickMode.value) {
            const card = isLikelyProductCard(obj) ? obj : findProductCardParentGroup(obj);
            if (card) return card;
        }
        if (isLikelyProductCard(obj)) {
            const deepSelected = getDeepSelectedProductImageFromCard(obj);
            if (deepSelected) return deepSelected;
            const preferred = pickPreferredProductImageFromCard(obj);
            if (preferred) return preferred;
        }
        if (isLikelyProductCard(obj)) return obj;
        const parentCard = findProductCardParentGroup(obj);
        if (parentCard) {
            const preferred = pickPreferredProductImageFromCard(parentCard);
            if (preferred) return preferred;
        }
        if (parentCard) return parentCard;

        return resolveSelectionRootObject(obj, { keepCardImages: true });
    };

    const collectShiftSelectionMembers = (activeObj: any) => {
        if (!activeObj) return [] as any[];
        const rawMembers = isActiveSelectionObject(activeObj) && typeof activeObj.getObjects === 'function'
            ? (activeObj.getObjects() || [])
            : [activeObj];
        const unique: any[] = [];
        rawMembers.forEach((member: any) => {
            const root = resolveShiftSelectionRootObject(member);
            if (!root) return;
            if (!unique.includes(root)) unique.push(root);
        });
        return unique;
    };

    let shiftSelectionBaselineMembers: any[] = [];
    const refreshShiftSelectionBaseline = (activeOverride?: any) => {
        const source = typeof activeOverride !== 'undefined'
            ? activeOverride
            : canvas.value?.getActiveObject?.();
        shiftSelectionBaselineMembers = collectShiftSelectionMembers(source);
    };

    const getScenePointFromNativeEvent = (nativeEvt: any) => {
        if (!canvas.value || !nativeEvt) return null;
        try {
            const canvasAny = canvas.value as any;
            const scenePoint = canvasAny.getScenePoint?.(nativeEvt) || canvasAny.getPointer?.(nativeEvt, true);
            if (scenePoint && Number.isFinite(scenePoint.x) && Number.isFinite(scenePoint.y)) return scenePoint;
        } catch {
            // ignore
        }
        return null;
    };

    const getFabricHitInfoAtPointer = (nativeEvt: any): { target: any; subTargets: any[] } => {
        if (!canvas.value || !nativeEvt) return { target: null, subTargets: [] };
        try {
            const canvasAny = canvas.value as any;
            const scenePoint = getScenePointFromNativeEvent(nativeEvt);
            if (!scenePoint) return { target: null, subTargets: [] };
            const rootObjects = (typeof canvasAny.getObjects === 'function' ? canvasAny.getObjects() : canvasAny._objects) || [];
            if (typeof canvasAny.searchPossibleTargets === 'function') {
                const info = canvasAny.searchPossibleTargets(rootObjects, scenePoint);
                const target = info?.target || null;
                const subTargets = Array.isArray(info?.subTargets) ? info.subTargets.filter(Boolean) : [];
                if (target || subTargets.length) return { target, subTargets };
            }
            if (typeof canvasAny.findTarget === 'function') {
                const info = canvasAny.findTarget(nativeEvt);
                const target = info?.target ?? info ?? null;
                const subTargets = Array.isArray(info?.subTargets) ? info.subTargets.filter(Boolean) : [];
                if (target || subTargets.length) return { target, subTargets };
            }
        } catch {
            // ignore
        }
        return { target: null, subTargets: [] };
    };

    const findProductImagesAtPointer = (nativeEvt: any) => {
        if (!canvas.value || !nativeEvt) return [] as any[];
        const scenePoint = getScenePointFromNativeEvent(nativeEvt);
        if (!scenePoint) return [] as any[];

        const hits: Array<{
            obj: any;
            precise: boolean;
            distance: number;
            area: number;
            zRank: number;
        }> = [];
        const seen = new Set<any>();
        let zRank = 0;
        const cards = (canvas.value.getObjects() || []).slice().reverse().filter((obj: any) => isLikelyProductCard(obj));
        for (const card of cards) {
            if (card?.visible === false || typeof card?.getObjects !== 'function') continue;
            const children = getCardImageCandidatesDeep(card).slice().reverse();

            for (const child of children) {
                zRank += 1;
                if (!child || seen.has(child)) continue;
                let isHit = false;
                let isPreciseHit = false;
                let hitArea = Number.POSITIVE_INFINITY;
                try {
                    if (typeof child?.containsPoint === 'function' && child.containsPoint(scenePoint, undefined, true)) {
                        isHit = true;
                        isPreciseHit = true;
                    }
                } catch {
                    // ignore and fallback to bounds
                }
                try {
                    const br = child?.getBoundingRect?.(true, true) || child?.getBoundingRect?.(true);
                    if (br) {
                        hitArea = Math.max(1, Math.abs(Number(br.width || 0) * Number(br.height || 0)));
                        if (!isHit && scenePoint.x >= br.left && scenePoint.x <= (br.left + br.width) && scenePoint.y >= br.top && scenePoint.y <= (br.top + br.height)) {
                            isHit = true;
                        }
                    }
                } catch {
                    // ignore
                }
                if (!isHit) continue;
                const center = typeof child?.getCenterPoint === 'function'
                    ? child.getCenterPoint()
                    : { x: Number(child?.left || 0), y: Number(child?.top || 0) };
                const dx = Number(scenePoint.x || 0) - Number(center?.x || 0);
                const dy = Number(scenePoint.y || 0) - Number(center?.y || 0);
                const distance = Math.hypot(dx, dy);
                try {
                    child.set?.({
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true
                    });
                    child.setCoords?.();
                } catch {
                    // ignore
                }
                hits.push({
                    obj: child,
                    precise: isPreciseHit,
                    distance,
                    area: hitArea,
                    zRank
                });
                seen.add(child);
            }
        }
        hits.sort((a, b) => {
            // 1) precise geometry hit beats bounds-only hit
            if (a.precise !== b.precise) return a.precise ? -1 : 1;
            // 2) nearest center to pointer first
            if (Math.abs(a.distance - b.distance) > 0.01) return a.distance - b.distance;
            // 3) smaller footprint first (avoids giant stale bbox stealing clicks)
            if (Math.abs(a.area - b.area) > 0.01) return a.area - b.area;
            // 4) fallback: top-most by z traversal
            return b.zRank - a.zRank;
        });
        return hits.map((entry) => entry.obj);
    };

    const findTopProductImageAtPointer = (nativeEvt: any, opts: { exclude?: any[] } = {}) => {
        const hits = findProductImagesAtPointer(nativeEvt);
        if (!Array.isArray(hits) || hits.length === 0) return null;
        const excluded = new Set((opts.exclude || []).filter(Boolean));
        const firstAvailable = hits.find((img: any) => !excluded.has(img));
        return firstAvailable || hits[0] || null;
    };

    const findTopProductCardAtPointer = (nativeEvt: any) => {
        if (!canvas.value || !nativeEvt) return null;
        const scenePoint = getScenePointFromNativeEvent(nativeEvt);
        if (!scenePoint) return null;
        const cards = (canvas.value.getObjects() || []).slice().reverse().filter((obj: any) => isLikelyProductCard(obj));
        for (const card of cards) {
            if (card?.visible === false || card?.selectable === false) continue;
            try {
                if (typeof card?.containsPoint === 'function' && card.containsPoint(scenePoint, undefined, true)) return card;
            } catch {
                // ignore and fallback
            }
            try {
                const br = card?.getBoundingRect?.(true, true) || card?.getBoundingRect?.(true);
                if (!br) continue;
                if (scenePoint.x >= br.left && scenePoint.x <= (br.left + br.width) && scenePoint.y >= br.top && scenePoint.y <= (br.top + br.height)) {
                    return card;
                }
            } catch {
                // ignore
            }
        }
        return null;
    };

    const isShiftSelectableTarget = (obj: any) => {
        if (!obj) return false;
        if (isTransientCanvasObject(obj) || isControlLikeObject(obj)) return false;
        if (obj.selectable === false) return false;
        return true;
    };

    const pickGenericShiftTargetAtPointer = (nativeEvt: any, opts: { exclude?: any[] } = {}) => {
        if (!canvas.value || !nativeEvt) return null;
        const excludeList = opts.exclude || [];
        const excludedRoots = new Set(
            excludeList
                .map((entry: any) => resolveShiftSelectionRootObject(entry))
                .filter(Boolean)
        );
        // Also add the raw objects themselves to excludedRoots
        for (const entry of excludeList) {
            if (entry) excludedRoots.add(entry);
        }

        const isValidPick = (candidate: any): any | null => {
            if (!candidate || !isShiftSelectableTarget(candidate)) return null;
            if (String(candidate?.id || '') === 'artboard-bg') return null;
            if (excludedRoots.has(candidate)) return null;
            const root = resolveShiftSelectionRootObject(candidate);
            if (!root || !isShiftSelectableTarget(root)) return null;
            if (String(root?.id || '') === 'artboard-bg') return null;
            if (excludedRoots.has(root)) return null;
            return root;
        };

        const canvasAny = canvas.value as any;
        const scenePoint = getScenePointFromNativeEvent(nativeEvt);
        // Also get viewport-space pointer (for getBoundingRect comparison)
        let viewportPoint: { x: number; y: number } | null = null;
        try {
            viewportPoint = canvasAny.getViewportPoint?.(nativeEvt) || canvasAny.getPointer?.(nativeEvt, false);
        } catch { /* ignore */ }

        if (!scenePoint && !viewportPoint) return null;

        const objContainsPoint = (obj: any): boolean => {
            // Method 1: Fabric's containsPoint with scene coordinates
            if (scenePoint) {
                try {
                    if (typeof obj.containsPoint === 'function' && obj.containsPoint(scenePoint)) {
                        return true;
                    }
                } catch { /* ignore */ }
            }
            // Method 2: bounding rect comparison (viewport coordinates)
            try {
                const br = obj.getBoundingRect?.() || obj.getBoundingRect?.(true);
                const pt = viewportPoint || scenePoint;
                if (br && pt && pt.x >= br.left && pt.x <= (br.left + br.width) && pt.y >= br.top && pt.y <= (br.top + br.height)) {
                    return true;
                }
            } catch { /* ignore */ }
            // Method 3: manual bounds check using object position (scene coordinates)
            if (scenePoint) {
                try {
                    const oLeft = Number(obj.left ?? 0);
                    const oTop = Number(obj.top ?? 0);
                    const oW = Number(obj.width ?? 0) * Number(obj.scaleX ?? 1);
                    const oH = Number(obj.height ?? 0) * Number(obj.scaleY ?? 1);
                    if (oW > 0 && oH > 0 && scenePoint.x >= oLeft && scenePoint.x <= oLeft + oW && scenePoint.y >= oTop && scenePoint.y <= oTop + oH) {
                        return true;
                    }
                } catch { /* ignore */ }
            }
            return false;
        };

        // Iterate canvas objects in z-order (top to bottom = reverse array order).
        // Collect ALL valid hits at this point, then let the caller pick the best.
        // This handles the case where the user wants an object below the topmost hit.
        const allObjects = canvas.value.getObjects() || [];
        const hits: any[] = [];
        for (let i = allObjects.length - 1; i >= 0; i--) {
            const obj = allObjects[i];
            if (!obj) continue;
            const picked = isValidPick(obj);
            if (picked && objContainsPoint(picked)) {
                hits.push(picked);
            }
            // Also check children of groups/frames
            if (typeof obj.getObjects === 'function') {
                const children = obj.getObjects() || [];
                for (let c = children.length - 1; c >= 0; c--) {
                    const child = children[c];
                    if (!child) continue;
                    const childPicked = isValidPick(child);
                    if (childPicked && objContainsPoint(childPicked)) {
                        hits.push(childPicked);
                    }
                }
            }
        }

        // Return the first valid hit (topmost in z-order)
        if (hits.length > 0) return hits[0];
        return null;
    };

    const pickShiftSelectionTarget = (evtPayload: any) => {
        // Hit-test nomes e etiquetas antes do card/imagem que os contém.
        const point = getScenePointFromNativeEvent(evtPayload?.e);
        if (point && canvas.value) {
            const candidates = collectObjectsDeep(canvas.value).filter(isProductTextOrPriceSelectionTarget).reverse();
            for (const candidate of candidates) {
                if (candidate.visible === false) continue;
                candidate.setCoords?.();
                if (candidate.containsPoint?.(point)) return candidate;
            }
        }
        const primary = evtPayload?.target || null;
        const subTargets = Array.isArray(evtPayload?.subTargets) ? evtPayload.subTargets.filter(Boolean) : [];
        const preferCardImages = shiftSelectionBaselineMembers.some((member: any) => isProductCardImageSelectionCandidate(member));

        // Trust Fabric's direct target first — if it's valid and not already selected, use it.
        // This prevents product-specific pickers from hijacking non-product clicks (e.g. coins, logos).
        if (primary && !isActiveSelectionObject(primary)) {
            const resolved = resolveShiftSelectionRootObject(primary);
            if (resolved) {
                const alreadyInBaseline = shiftSelectionBaselineMembers.some(
                    (m: any) => m === resolved || resolveShiftSelectionRootObject(m) === resolved
                );
                if (!alreadyInBaseline) return primary;
            }
        }

        if (!preferCardImages) {
            const pointerGenericFirst = pickGenericShiftTargetAtPointer(evtPayload?.e, {
                exclude: shiftSelectionBaselineMembers
            });
            if (pointerGenericFirst) return pointerGenericFirst;
        }
        // IMPORTANT: Prefer geometric pointer hit first.
        // Fabric can occasionally report a stale active child as target when clicking inside interactive groups.
        const pointerImageFirst = findTopProductImageAtPointer(evtPayload?.e, {
            exclude: shiftSelectionBaselineMembers
        });
        if (pointerImageFirst) return pointerImageFirst;
        const pointerCardFirst = findTopProductCardAtPointer(evtPayload?.e);
        if (pointerCardFirst) {
            const preferred = pickPreferredProductImageFromCard(pointerCardFirst);
            if (preferred) return preferred;
            const deepSelected = getDeepSelectedProductImageFromCard(pointerCardFirst);
            if (deepSelected) return deepSelected;
            return pointerCardFirst;
        }
        const fabricHitInfo = getFabricHitInfoAtPointer(evtPayload?.e);
        const fabricPointerTarget = fabricHitInfo.target;
        const fabricSubTargets = Array.isArray(fabricHitInfo.subTargets) ? fabricHitInfo.subTargets : [];
        const fabricImageSubTarget = fabricSubTargets.find((item: any) => isProductCardImageSelectionCandidate(item));
        if (fabricImageSubTarget) return fabricImageSubTarget;
        if (fabricPointerTarget) {
            if (isProductCardImageSelectionCandidate(fabricPointerTarget)) return fabricPointerTarget;
            const pointerCard = isProductCardContainer(fabricPointerTarget)
                ? fabricPointerTarget
                : findProductCardParentGroup(fabricPointerTarget);
            if (pointerCard) {
                const pointerImage = findTopProductImageAtPointer(evtPayload?.e, {
                    exclude: shiftSelectionBaselineMembers
                });
                if (pointerImage) return pointerImage;
                const preferred = pickPreferredProductImageFromCard(pointerCard);
                if (preferred) return preferred;
                const deepSelected = getDeepSelectedProductImageFromCard(pointerCard);
                if (deepSelected) return deepSelected;
                return pointerCard;
            }
        }
        // Prefer deep-selected card images when available.
        const imageSubTarget = subTargets.find((item: any) => isProductCardImageSelectionCandidate(item));
        if (imageSubTarget) return imageSubTarget;
        if (primary && isProductCardImageSelectionCandidate(primary)) return primary;

        // Otherwise prefer a card-like target (sub-target or primary).
        const cardSubTarget = subTargets.find((item: any) => {
            const root = resolveSelectionRootObject(item);
            return !!(root && isLikelyProductCard(root));
        });
        if (cardSubTarget) {
            const cardRoot = resolveSelectionRootObject(cardSubTarget);
            if (preferCardImages && cardRoot && isLikelyProductCard(cardRoot)) {
                const preferredImage = pickPreferredProductImageFromCard(cardRoot);
                if (preferredImage) return preferredImage;
            }
            return cardSubTarget;
        }

        if (preferCardImages) {
            const primaryRoot = resolveSelectionRootObject(primary);
            if (primaryRoot && isLikelyProductCard(primaryRoot)) {
                const preferredImage = pickPreferredProductImageFromCard(primaryRoot);
                if (preferredImage) return preferredImage;
            }
        }

        // Fallback for product zones: when Fabric reports only zone/null on Shift+click,
        // find the top card under pointer and use it as additive selection target.
        const nativeEvt = evtPayload?.e;
        if (canvas.value && nativeEvt) {
            try {
                const canvasAny = canvas.value as any;
                const scenePoint = canvasAny.getScenePoint?.(nativeEvt) || canvasAny.getPointer?.(nativeEvt, true);
                if (scenePoint && Number.isFinite(scenePoint.x) && Number.isFinite(scenePoint.y)) {
                    const all = canvas.value.getObjects().slice().reverse();
                    for (const obj of all) {
                        if (!obj || !isLikelyProductCard(obj)) continue;
                        if (obj.visible === false || obj.selectable === false) continue;
                        try {
                            if (typeof obj.containsPoint === 'function' && obj.containsPoint(scenePoint, undefined, true)) {
                                if (preferCardImages) {
                                    const preferredImage = pickPreferredProductImageFromCard(obj);
                                    if (preferredImage) return preferredImage;
                                }
                                return obj;
                            }
                        } catch {
                            // ignore containsPoint errors for corrupted objects
                        }
                        try {
                            const br = obj.getBoundingRect?.(true);
                            if (br && scenePoint.x >= br.left && scenePoint.x <= (br.left + br.width) && scenePoint.y >= br.top && scenePoint.y <= (br.top + br.height)) {
                                if (preferCardImages) {
                                    const preferredImage = pickPreferredProductImageFromCard(obj);
                                    if (preferredImage) return preferredImage;
                                }
                                return obj;
                            }
                        } catch {
                            // ignore bounding rect errors
                        }
                    }
                }
            } catch {
                // ignore fallback errors
            }
        }

        if (isActiveSelectionObject(primary)) {
            const pointerGeneric = pickGenericShiftTargetAtPointer(evtPayload?.e, {
                exclude: shiftSelectionBaselineMembers
            });
            if (pointerGeneric) return pointerGeneric;
        }

        return primary;
    };

    let isNormalizingShiftSelection = false;
    const normalizeActiveSelectionForProductCards = () => {
        if (!canvas.value || isNormalizingShiftSelection) return false;
        const activeObj = canvas.value.getActiveObject();
        if (!isActiveSelectionObject(activeObj) || typeof activeObj.getObjects !== 'function') return false;

        const rawMembers = (activeObj.getObjects() || []).slice();
        if (!rawMembers.length) return false;
        // Label children can temporarily live in an ActiveSelection while the
        // priceGroup remains their logical parent. Do not normalize them into
        // product-image targets.
        if (rawMembers.some((member: any) => resolvePriceGroupAncestor(member))) return false;
        const normalized = collectNormalizedSelectionMembers(activeObj);
        const changed =
            normalized.length !== rawMembers.length ||
            normalized.some((member: any, idx: number) => member !== rawMembers[idx]);
        if (!changed) return false;

        isNormalizingShiftSelection = true;
        try {
            canvas.value.discardActiveObject();
            if (normalized.length === 1) {
                canvas.value.setActiveObject(normalized[0]);
            } else if (normalized.length > 1 && fabric?.ActiveSelection) {
                const nextSelection = new fabric.ActiveSelection(normalized, { canvas: canvas.value });
                canvas.value.setActiveObject(nextSelection);
            }
            safeRequestRenderAll();
        } finally {
            isNormalizingShiftSelection = false;
        }
        return true;
    };

    // Corner handles behavior (no crop):
    // apply pure scale and keep current crop window untouched.
    const normalizeImageScaleAndCrop = (img: any, opts: { save?: boolean } = {}) => {
        if (!canvas.value || !img) return;
        const t = String(img.type || '').toLowerCase();
        if (t !== 'image') return;

        const shouldSave = opts.save !== false;
        const center = getObjectCenterInParentPlane(img);
        const scaleX = Math.abs(Number(img.scaleX ?? 1)) || 1;
        const scaleY = Math.abs(Number(img.scaleY ?? 1)) || 1;

        img.set({
            originX: 'center',
            originY: 'center',
            left: center.x,
            top: center.y,
            // Keep image crop rectangle untouched on corner scale.
            scaleX: scaleX,
            scaleY: scaleY,
            flipX: false,
            flipY: false,
            lockScalingFlip: true,
            lockSkewingX: true,
            lockSkewingY: true
        });

        sanitizeProductCardImageTransform(img, { clampWithinCard: true });
        safeAddWithUpdate(img);
        img.setCoords?.();
        safeRequestRenderAll();
        if (shouldSave) ctx.getSaveCurrentState()();
    };

    // Canva/Figma-like behavior for side handles on images:
    // - Dragging side handles crops/hides only the side you reduced.
    // - Dragging back reveals the hidden area (no stretching).
    // - Corner handles keep normal scale behavior (handled elsewhere).
    const normalizeImageCropBySideHandle = (img: any, transform: any, opts: { save?: boolean } = {}) => {
        if (!canvas.value || !img) return;
        const t = String(img.type || '').toLowerCase();
        if (t !== 'image') return;
        const prevCenter = getObjectCenterInParentPlane(img);

        const cornerRaw = String(transform?.corner || '').toLowerCase();
        if (!cornerRaw) return;

        const original = transform?.original || {};
        const abs = (n: any) => Math.abs(Number(n ?? 0) || 0);

        // Consider flips: a flipped image swaps left/right or top/bottom behavior.
        const flipX = !!img.flipX;
        const flipY = !!img.flipY;
        let corner = cornerRaw;
        if (flipX) {
            if (corner === 'ml') corner = 'mr';
            else if (corner === 'mr') corner = 'ml';
        }
        if (flipY) {
            if (corner === 'mt') corner = 'mb';
            else if (corner === 'mb') corner = 'mt';
        }

        const isSideHandle = corner === 'ml' || corner === 'mr' || corner === 'mt' || corner === 'mb';
        if (!isSideHandle) return;

        const shouldSave = opts.save !== false;

        // Base scale BEFORE the gesture started.
        // Usar __baseScaleX persistente para evitar acumulação quando original não existe.
        const baseScaleX = abs(original.scaleX) || abs((img as any).__baseScaleX) || 1;
        const baseScaleY = abs(original.scaleY) || abs((img as any).__baseScaleY) || 1;
        // Armazenar para futuras operações (captura apenas na primeira vez)
        if (!Number.isFinite((img as any).__baseScaleX) || !(img as any).__baseScaleX) {
            (img as any).__baseScaleX = baseScaleX;
            (img as any).__baseScaleY = baseScaleY;
        }

        // Anchor point (keep the opposite side fixed, like Canva)
        let anchorOriginX: any = 'center';
        let anchorOriginY: any = 'center';
        if (corner === 'mr') { anchorOriginX = 'left'; anchorOriginY = 'center'; }
        if (corner === 'ml') { anchorOriginX = 'right'; anchorOriginY = 'center'; }
        if (corner === 'mb') { anchorOriginX = 'center'; anchorOriginY = 'top'; }
        if (corner === 'mt') { anchorOriginX = 'center'; anchorOriginY = 'bottom'; }
        const anchorPoint = (typeof img.getPointByOrigin === 'function')
            ? img.getPointByOrigin(anchorOriginX, anchorOriginY)
            : null;

        const curW = Math.max(1, Number(img.width ?? 1) || 1);
        const curH = Math.max(1, Number(img.height ?? 1) || 1);
        const desiredDisplayW = Math.max(1, curW * (abs(img.scaleX) || 1));
        const desiredDisplayH = Math.max(1, curH * (abs(img.scaleY) || 1));

        // Source (natural) dimensions in pixels
        const el: any = (img as any)._originalElement || (img as any)._element || null;
        const srcW = Math.max(1, Number((img as any).__sourceWidth ?? el?.naturalWidth ?? el?.width ?? curW) || 1);
        const srcH = Math.max(1, Number((img as any).__sourceHeight ?? el?.naturalHeight ?? el?.height ?? curH) || 1);
        (img as any).__sourceWidth = srcW;
        (img as any).__sourceHeight = srcH;

        const prevCropX = Math.max(0, Number(img.cropX ?? 0) || 0);
        const prevCropY = Math.max(0, Number(img.cropY ?? 0) || 0);
        const prevCropW = clamp(curW, 1, srcW);
        const prevCropH = clamp(curH, 1, srcH);

        // Convert the user's handle drag (display size) into crop size at the BASE scale.
        const nextCropW = clamp(desiredDisplayW / baseScaleX, 1, srcW);
        const nextCropH = clamp(desiredDisplayH / baseScaleY, 1, srcH);

        // Only move crop origin for the axis being resized, keeping the opposite edge fixed.
        let nextCropX = prevCropX;
        let nextCropY = prevCropY;

        if (corner === 'ml') {
            nextCropX = prevCropX + (prevCropW - nextCropW);
        } else if (corner === 'mr') {
            nextCropX = prevCropX;
        }

        if (corner === 'mt') {
            nextCropY = prevCropY + (prevCropH - nextCropH);
        } else if (corner === 'mb') {
            nextCropY = prevCropY;
        }

        nextCropX = clamp(nextCropX, 0, srcW - nextCropW);
        nextCropY = clamp(nextCropY, 0, srcH - nextCropH);

        img.set({
            // Reset the scaling caused by Fabric's resize gesture back to the pre-gesture scale
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            width: nextCropW,
            height: nextCropH,
            cropX: nextCropX,
            cropY: nextCropY,
            flipX: false,
            flipY: false,
            lockScalingFlip: true,
            lockSkewingX: true,
            lockSkewingY: true
        });

        if (anchorPoint && typeof img.setPositionByOrigin === 'function') {
            img.setPositionByOrigin(anchorPoint, anchorOriginX, anchorOriginY);
        }

        // Keep the orthogonal axis stable for side handles to avoid visual "jump":
        // ml/mr should preserve Y center; mt/mb should preserve X center.
        const nextCenter = getObjectCenterInParentPlane(img);
        if (corner === 'ml' || corner === 'mr') {
            if (Math.abs(Number(nextCenter.y || 0) - Number(prevCenter.y || 0)) > 0.001) {
                setObjectCenterInParentPlane(img, Number(nextCenter.x || 0), Number(prevCenter.y || 0));
            }
        } else if (corner === 'mt' || corner === 'mb') {
            if (Math.abs(Number(nextCenter.x || 0) - Number(prevCenter.x || 0)) > 0.001) {
                setObjectCenterInParentPlane(img, Number(prevCenter.x || 0), Number(nextCenter.y || 0));
            }
        }

        sanitizeProductCardImageTransform(img, { clampWithinCard: true });
        safeAddWithUpdate(img);
        img.setCoords?.();
        safeRequestRenderAll();
        if (shouldSave) ctx.getSaveCurrentState()();
    };

    let lastUpdateObjectsSanitizeAt = 0;
    const updateObjects = () => {
        const canvasInstance = canvas.value;
        if (!canvasInstance || isCanvasDestroyed.value) return;
        const now = Date.now();
        if ((now - lastUpdateObjectsSanitizeAt) > 1200) {
            sanitizeCanvasObjectStack(canvasInstance as any, 'updateObjects:throttled');
            lastUpdateObjectsSanitizeAt = now;
        }

        // CRITICAL: Preserve exact order from canvas.getObjects()
        // Don't reorder or sort - maintain order as saved
        const objs = canvasInstance.getObjects();
        const toRemove: any[] = [];
        let hasInvalid = false;

        const isGuideOverlay = (o: any): boolean => {
            const id = String(o?.id || '');
            if (id === 'guide-vertical' || id === 'guide-horizontal') return true; // snap overlays
            if (id.startsWith('guide-user-') || o?.isUserGuide === true) return true; // persistent user guides
            return false;
        };

        objs.forEach((o: any) => {
            if (!isValidFabricCanvasObject(o)) {
                hasInvalid = true;
                console.error('❌ [updateObjects] Objeto inválido detectado no canvas (será ignorado/purgado):', o);
                return;
            }
            ensurePersistentContentFlags(o);
            const name = o.name || '';

            // Clean up orphaned control objects that shouldn't be visible
            if ((name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') && !isNodeEditing.value) {
                toRemove.push(o);
                return;
            }

            // Clean up preview objects if not in pen mode
            if (isTransientCanvasObject(o) && !isPenMode.value && !isNodeEditing.value) {
                // Keep guide overlays; setupSnapping + rulers own their lifecycle.
                if (isGuideOverlay(o)) return;
                toRemove.push(o);
                return;
            }

            // Clean up small circles that are likely orphaned control points
            if (o.type === 'circle' && o.radius && o.radius <= 7 && !o._customId) {
                toRemove.push(o);
                return;
            }

            // Clean up lines without _customId (handle lines)
            if (o.type === 'line' && !o._customId && !isNodeEditing.value) {
                // Keep guide overlays (snap + user guides)
                if (isGuideOverlay(o)) return;
                toRemove.push(o);
                return;
            }

            // Only assign _customId to real objects (not control points or preview objects)
            const isControlObject = name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line';
            const isSmallControlCircle = o.type === 'circle' && o.radius && o.radius <= 7;
            const hasControlData = o.data && (o.data.parentPath || o.data.parentObj);

            if (!o._customId && !isTransientCanvasObject(o) && !isControlObject && !isSmallControlCircle && !hasControlData) {
                o._customId = makeCanvasObjectId();
            }
        });

        // If something corrupted the internal stack (e.g., number inserted into _objects), purge it to prevent render crashes.
        if (hasInvalid) {
            const internal = (canvasInstance as any)._objects;
            if (Array.isArray(internal)) {
                const next = internal.filter((o: any) => isValidFabricCanvasObject(o));
                if (next.length !== internal.length) {
                    internal.length = 0;
                    next.forEach((o: any) => internal.push(o));
                    if (typeof (canvasInstance as any)._onStackOrderChanged === 'function') (canvasInstance as any)._onStackOrderChanged();
                }
            }
        }

        // Remove orphaned objects (from end to preserve order)
        if (toRemove.length > 0) {
            toRemove.forEach((obj: any) => {
                try {
                    canvasInstance.remove(obj);
                } catch (e) {
                    // Ignore errors
                }
            });
        }

        // CRITICAL: Preserve exact order - don't reorder or sort
        refreshCanvasObjects({ source: canvasInstance.getObjects(), immediate: true });
    };

    let updateObjectsRafId: number | null = null;
    const scheduleUpdateObjects = () => {
        if (updateObjectsRafId !== null) return;
        updateObjectsRafId = requestAnimationFrame(() => {
            updateObjectsRafId = null;
            if (!canvas.value || isCanvasDestroyed.value) return;
            updateObjects();
            scheduleViewportCulling('objects-sync');
        });
    };

    trackOn('object:added', scheduleUpdateObjects);
    trackOn('object:removed', scheduleUpdateObjects);
    trackOn('object:modified', scheduleUpdateObjects);

    // Frames: auto-parent new objects when created inside a frame + keep clipPaths in sync
    trackOn('object:added', (e: any) => {
        const obj = e?.target;
        if (!obj || typeof obj !== 'object' || isTransientCanvasObject(obj)) return;
        ensurePersistentContentFlags(obj);

        // Don't assign _customId to control objects
        const name = obj.name || '';
        const isControlObject = name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line';
        const isSmallControlCircle = obj.type === 'circle' && obj.radius && obj.radius <= 7;
        const hasControlData = obj.data && (obj.data.parentPath || obj.data.parentObj);

        if (!obj._customId && !isControlObject && !isSmallControlCircle && !hasControlData) {
            obj._customId = makeCanvasObjectId();
        }

        // Skip auto-parenting for product cards — they are managed by simulateSmartGrid
        // and should NOT be clipped by the Frame (they sit on top of it).
        if (obj.isSmartObject || obj.isProductCard) return;

        if (!obj.parentFrameId) {
            const frame = findFrameUnderObject(obj);
            if (frame && frame._customId) obj.parentFrameId = frame._customId;
        }
        syncObjectFrameClip(obj);
    });

    trackOn('object:modified', (e: any) => {
        const obj = e?.target;
        if (!obj || isTransientCanvasObject(obj)) return;
        if (isQuickModeLockedObject(obj)) {
            // A zona é somente estrutura no modo rápido; cards/produtos
            // continuam editáveis, mas a própria zona não pode ser alterada.
            return;
        }
        ensurePersistentContentFlags(obj);
        const action = e?.transform?.action || '';
        const didScale = typeof action === 'string' && action.includes('scale');
        const transformTarget = e?.transform?.target;
        const isChildImageTransformOnCard = !!(
            obj &&
            isLikelyProductCard(obj) &&
            transformTarget &&
            transformTarget !== obj &&
            transformTarget.group === obj &&
            String(transformTarget.type || '').toLowerCase() === 'image'
        );

        if (isActiveSelectionObject(obj) && typeof obj.getObjects === 'function') {
            const members = (obj.getObjects() || []).slice();
            members.forEach((member: any) => {
                if (!member || isTransientCanvasObject(member)) return;
                ensurePersistentContentFlags(member);
                try { maybeReparentToFrameOnDrop(member); } catch {}
                try {
                    if (isLikelyProductCard(member) && (member as any).parentZoneId && canvas.value) {
                        const zoneId = String((member as any).parentZoneId || '').trim();
                        const zone = canvas.value.getObjects().find((o: any) => (
                            isLikelyProductZone(o) && String((o as any)._customId || '') === zoneId
                        ));
                        if (zone) applyCardFrameBinding(member, getResolvedZoneFrameId(zone));
                    }
                } catch {}
                try { syncObjectFrameClip(member); } catch {}
                if (didScale && String(member.type || '').toLowerCase() === 'image' && ((member.scaleX ?? 1) !== 1 || (member.scaleY ?? 1) !== 1)) {
                    const corner = String(e?.transform?.corner || '').toLowerCase();
                    const isSide = corner === 'ml' || corner === 'mr' || corner === 'mt' || corner === 'mb';
                    if (isSide) {
                        normalizeImageCropBySideHandle(member, e?.transform, { save: false });
                    } else {
                        normalizeImageScaleAndCrop(member, { save: false });
                    }
                }
                sanitizeProductCardImageTransform(member, { clampWithinCard: true });
                if (shouldApplyContainmentConstraints(member)) {
                    applyContainmentConstraints(member);
                }
            });
            return;
        }

        // If a product card was resized (scaled), convert scale into width/height and reflow internals (image/title/limit/label).
        // This keeps layout crisp and responsive instead of just stretching the whole group.
        if (!isChildImageTransformOnCard && didScale && isLikelyProductCard(obj) && ((obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1)) {
            normalizeCardScaleAndRelayout(obj, { save: false });
        }
        // Images:
        // - Corner handles: normal scale behavior (no crop conversion).
        // - Side handles (ml/mr/mt/mb): crop/hide only the reduced side (Canva-like).
        if (didScale && String(obj.type || '').toLowerCase() === 'image' && ((obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1)) {
            const corner = String(e?.transform?.corner || '').toLowerCase();
            const isSide = corner === 'ml' || corner === 'mr' || corner === 'mt' || corner === 'mb';
            if (isSide) {
                normalizeImageCropBySideHandle(obj, e?.transform, { save: false });
            } else {
                normalizeImageScaleAndCrop(obj, { save: false });
            }
        }
        sanitizeProductCardImageTransform(obj, { clampWithinCard: true });

        // Mark dirty after modification to ensure clean render
        obj.set('dirty', true);

        maybeReparentToFrameOnDrop(obj);
        if (isLikelyProductZone(obj)) {
            syncZoneCardFrameBindings(obj);
        } else if (isLikelyProductCard(obj) && (obj as any).parentZoneId && canvas.value) {
            const zoneId = String((obj as any).parentZoneId || '').trim();
            const zone = findProductZoneById(zoneId);
            if (zone) {
                const zoneFrameId = getResolvedZoneFrameId(zone);
                applyCardFrameBinding(obj, zoneFrameId);
            }
        }
        syncObjectFrameClip(obj);

        if (obj.isFrame) {
            markFrameLabelsDirty();
            getOrCreateFrameClipRect(obj);
            syncFrameClips(obj);
        }
        // Keep frame stacking stable only when a frame itself changed.
        // Reordering on every child drop can cause visual "stomp" on clipped backgrounds.
        if (obj.isFrame) {
            ensureFramesBelowContents();
        }
    });

    trackOn('object:modified', () => {
        // CRITICAL: Create a fresh snapshot instead of just triggering the old one.
        // After modifications (drag, scale, etc.) the Fabric object's properties may have changed
        // (e.g. ensureZoneSanity, normalizeZoneScale). A stale snapshot causes PropertiesPanel
        // to show outdated values or lose zone detection entirely for legacy arts.
        refreshSelectedRef();
        invalidateScrollbarBounds();
        updateScrollbars(); // Update scrollbars
        updateFloatingUI();
    });

    // Auto-Layout: When a product card is added, find its parent zone and trigger layout
    let layoutDebounceTimer: any = null;
    let pendingZones: Set<any> = new Set();

    trackOn('object:added', (e: any) => {
        if (ctx.getIsBulkProductMutation() || isHistoryProcessing.value || isDesignLoading.value) return;
        // Não disparar relayout durante cooldown pós-undo/redo (loadFromJSON recria objetos)
        if (Date.now() < ctx.getHistoryRestoreCooldownUntil()) return;
        const obj = e.target;
        if (!obj) return;
        const isCard = !!(obj.isProductCard || obj.isSmartObject || isLikelyProductCard(obj));
        if (!isCard) return;
        // Restore is guarded above. A live insertion with a binding still
        // changes the zone count and must refresh its responsive layout.
        const boundZoneId = String((obj as any).parentZoneId || '').trim();
        if (boundZoneId) {
            const boundZone = canvas.value.getObjects().find((zone: any) => zone._customId === boundZoneId);
            if (boundZone) pendingZones.add(boundZone);
        }

        // Find intersecting zone
        const zones = canvas.value.getObjects().filter((o: any) => o.isGridZone || o.isProductZone);
        for (const zone of zones) {
            if (!boundZoneId && zone.intersectsWithObject(obj)) {
                // Bind to zone
                obj.parentZoneId = zone._customId;
                const zoneFrameId = getResolvedZoneFrameId(zone);
                applyCardFrameBinding(obj, zoneFrameId);
                pendingZones.add(zone);
                break;
            }
        }

        // Debounced layout - waits for all objects in batch to be added
        clearTimeout(layoutDebounceTimer);
        layoutDebounceTimer = setTimeout(() => {
            relayoutProductZonesAfterCardRemoval(pendingZones);
            pendingZones.clear();
            safeRequestRenderAll();
        }, 16); // Coalesce a batch into the next visual frame.
    });

    trackOn('object:removed', (event: any) => {
        if (ctx.getIsBulkProductMutation() || isHistoryProcessing.value || isDesignLoading.value || ctx.getIsCanvasJsonLoadInProgress()) return;
        const object = event?.target;
        if (!object || !(object.isProductCard || object.isSmartObject || isLikelyProductCard(object))) return;
        const zoneId = String(object.parentZoneId || object._zoneSlot?.zoneId || '');
        const zone = zoneId && canvas.value?.getObjects().find((item: any) => item._customId === zoneId);
        if (zone) relayoutProductZonesAfterCardRemoval([zone]);
    });

    // Realtime updates during interaction
    // === PERFORMANCE CACHE ===
    let frameChildrenCache: any[] = [];
    let lastFrameState = { left: 0, top: 0 };
    let gridGroupSiblingCache: any[] = [];
    let gridGroupSiblingCacheId: string | null = null;
    let zoneChildrenCache: any[] = [];
    let lastZoneState = { left: 0, top: 0 };

    let previousShiftSelectionAtMousedown: any[] | null = null;
    trackOn('mouse:down:before', (e: any) => {
        if (isQuickModeLockedObject(e?.target)) {
            getQuickModeLockedZones(e.target).forEach((zone: any) => rememberQuickModeZoneTransform(zone));
            return;
        }
        if (e?.e?.shiftKey) {
            refreshShiftSelectionBaseline(canvas.value.getActiveObject?.());
            previousShiftSelectionAtMousedown = shiftSelectionBaselineMembers.slice();
            return;
        }
        shiftSelectionBaselineMembers = [];
        previousShiftSelectionAtMousedown = null;
    });

    trackOn('mouse:down', (e: any) => {
         const evt: MouseEvent | undefined = e?.e;
         const isContextClick = !!evt && (evt.button === 2 || (evt.button === 0 && (evt as any).ctrlKey && !(evt as any).metaKey));
         if (isContextClick) {
             evt?.preventDefault?.();
             evt?.stopPropagation?.();
             if (layersContextMenu.value.show) layersContextMenu.value.show = false;

             // Figma-like: right-click selects the target under cursor (if any).
             const current = canvas.value.getActiveObject?.();
             const keepActiveSelection =
                 current &&
                 current.type === 'activeSelection' &&
                 e.target &&
                 typeof current.getObjects === 'function' &&
                 current.getObjects().includes(e.target);

             if (e.target && !keepActiveSelection && !isQuickModeLockedObject(e.target)) {
                 canvas.value.setActiveObject(e.target);
                 updateSelection();
             }

             canvasContextMenu.value.x = (evt as any).clientX ?? 0;
             canvasContextMenu.value.y = (evt as any).clientY ?? 0;
             canvasContextMenu.value.show = true;
             return;
         }

          if (canvasContextMenu.value.show) canvasContextMenu.value.show = false;
          if (layersContextMenu.value.show) layersContextMenu.value.show = false;
          const target = e.target;
          if (discardQuickModeLockedSelection(target)) {
              updateSelection();
              return;
          }
          updateProductImageSelectionIntent(e);
          updatePriceGroupSelectionIntent(e);

         // Global Shift+click additive multi-selection:
        // keep existing selection and append target in all editor contexts.
        if (evt?.shiftKey && !isNormalizingShiftSelection) {
            evt.preventDefault?.();
            evt.stopPropagation?.();

            let rawTarget = target;
            if (e?.subTargets && e.subTargets.length > 0) {
                // Get most precise sub-target if hitting a group/activeSelection
                rawTarget = e.subTargets[e.subTargets.length - 1];
            }
            if (rawTarget && isActiveSelectionObject(rawTarget)) {
                rawTarget = null;
            }
            // Trust exactly what the user clicked. If null, fallback to the smart picker.
            const shiftTarget = rawTarget || pickShiftSelectionTarget(e);
            let normalizedTarget = resolveShiftSelectionRootObject(shiftTarget);

            if (discardQuickModeLockedSelection(normalizedTarget)) {
                updateSelection();
                return;
            }

            if (normalizedTarget) {
                const currentMembersRaw = previousShiftSelectionAtMousedown || shiftSelectionBaselineMembers;

                const currentMembers = currentMembersRaw
                    .map((member: any) => resolveShiftSelectionRootObject(member))
                    .filter((member: any) => !!member)
                    .filter((member: any) => !isQuickModeLockedObject(member))
                    .filter((member: any, idx: number, arr: any[]) => arr.indexOf(member) === idx);

                const finalTarget = normalizedTarget;
                const isAlreadySelected = currentMembers.includes(finalTarget);
                let nextMembers = [...currentMembers];

                if (isAlreadySelected) {
                    // TOGGLE OFF: User clicked an already selected item
                    nextMembers = nextMembers.filter((m: any) => m !== finalTarget);
                } else {
                    // TOGGLE ON: User clicked a new item
                    nextMembers.push(finalTarget);
                }

                // Enforce safe objects
                nextMembers.forEach((member: any) => {
                    if (!member) return;
                    try {
                        member.set?.({ selectable: true, evented: true, hasControls: true, hasBorders: true });
                        member.setCoords?.();
                    } catch { /* ignore */ }
                });

                // Apply new selection gracefully
                isNormalizingShiftSelection = true;
                try {
                    canvas.value.discardActiveObject();
                    if (nextMembers.length === 1) {
                        canvas.value.setActiveObject(nextMembers[0]);
                    } else if (nextMembers.length > 1 && fabric?.ActiveSelection) {
                        const sel = new fabric.ActiveSelection(nextMembers, { canvas: canvas.value });
                        canvas.value.setActiveObject(sel);
                    }
                } finally {
                    isNormalizingShiftSelection = false;
                }

                updateSelection();
                safeRequestRenderAll();
                refreshShiftSelectionBaseline(canvas.value.getActiveObject?.());
                return;
            }
        }

        if (target && target.isFrame) {
            frameChildrenCache = getFrameDescendants(target);
            lastFrameState = { left: target.left, top: target.top };
            getOrCreateFrameClipRect(target);
            if (target.gridGroupId && target.isGridCell) {
                gridGroupSiblingCacheId = String(target.gridGroupId);
                gridGroupSiblingCache = canvas.value.getObjects().filter(
                    (o: any) => o !== target && o.gridGroupId === target.gridGroupId && o.isGridCell
                );
            } else {
                gridGroupSiblingCache = [];
                gridGroupSiblingCacheId = null;
            }
            // Renderizar canvas para mostrar o label do frame
            markFrameLabelsDirty();
            safeRequestRenderAll();
        } else {
            if (!e.e?.shiftKey) frameChildrenCache = [];
            gridGroupSiblingCache = [];
            gridGroupSiblingCacheId = null;
        }

	        if (target && isLikelyProductZone(target)) {
             ensureZoneSanity(target);
             // Cache children once on start drag
             zoneChildrenCache = getZoneChildren(target);

             lastZoneState = { left: target.left, top: target.top };
         } else {
             // Clear cache if clicking elsewhere
             if (!e.e?.shiftKey) zoneChildrenCache = [];
         }
    });

    // Realtime updates during interaction
    // Throttled floating UI update (avoid expensive getBoundingRect on every move frame)
    let floatingUIRafPending = false;
    let pendingObjectMoveViewportCull = false;
    const flushObjectMoveViewportCull = () => {
        if (!pendingObjectMoveViewportCull) return;
        pendingObjectMoveViewportCull = false;
        scheduleViewportCulling('object-move-end');
    };
    trackOn('object:moving', (e: any) => {
        ctx.setLastTransformMutationAt(Date.now());
        const target = e.target;
        if (isQuickLogoImageObject(target)) syncQuickLogoBackdrop(target);
        const lockedZones = getQuickModeLockedZones(target);
        if (lockedZones.length > 0) {
            lockedZones.forEach((zone: any) => {
                rememberQuickModeZoneTransform(zone);
                restoreQuickModeZoneTransform(zone);
            });
            pendingObjectMoveViewportCull = false;
            safeRequestRenderAll();
            return;
        }
        const isCardImageTarget = !!(
            target &&
            String(target.type || '').toLowerCase() === 'image' &&
            isProductCardImage(target)
        );
        const selectedCardImageContext = isCardImageTarget
            ? resolveSelectedProductImageActionContext(canvas.value.getActiveObject?.())
            : null;
        const isSelectedCardImageTarget = !!(
            selectedCardImageContext?.image && selectedCardImageContext.image === target
        );
        if (!isCardImageTarget) {
            pendingObjectMoveViewportCull = true;
        }

        const activeObj = canvas.value.getActiveObject?.();
        const shouldUpdateFloatingUI = !!(
            (!isCardImageTarget || isSelectedCardImageTarget) &&
            target &&
            activeObj &&
            (
                activeObj === target ||
                (
                    activeObj.type === 'activeSelection' &&
                    typeof (activeObj as any).getObjects === 'function' &&
                    (activeObj as any).getObjects().includes(target)
                )
            )
        );
        if (shouldUpdateFloatingUI && !floatingUIRafPending) {
            floatingUIRafPending = true;
            requestAnimationFrame(() => {
                updateFloatingUI();
                floatingUIRafPending = false;
            });
        }

        // Frame moves its descendants (Figma-like parenting)
        if (target && target.isFrame) {
            // Mark dirty to ensure fresh render (keep caching for performance)
            target.set('dirty', true);
            markFrameLabelsDirty();

            const dx = target.left - lastFrameState.left;
            const dy = target.top - lastFrameState.top;

            if (frameChildrenCache.length === 0) {
                frameChildrenCache = getFrameDescendants(target);
            }
            moveFrameDescendants(target, dx, dy, frameChildrenCache);
            lastFrameState.left = target.left;
            lastFrameState.top = target.top;
            getOrCreateFrameClipRect(target);

            // ─── Grid group: move sibling cells together ────────────────
            if (target.gridGroupId && target.isGridCell && (dx || dy)) {
                const gridId = String(target.gridGroupId);
                let siblings = (gridGroupSiblingCacheId === gridId) ? gridGroupSiblingCache : [];
                if (siblings.length === 0) {
                    siblings = canvas.value.getObjects().filter(
                        (o: any) => o !== target && o.gridGroupId === target.gridGroupId && o.isGridCell
                    );
                    gridGroupSiblingCache = siblings;
                    gridGroupSiblingCacheId = gridId;
                }
                siblings.forEach((sib: any) => {
                    sib.set({ left: (sib.left ?? 0) + dx, top: (sib.top ?? 0) + dy });
                    sib.setCoords?.();
                    // Also move the sibling's frame descendants
                    const sibDescendants = getFrameDescendants(sib);
                    moveFrameDescendants(sib, dx, dy, sibDescendants);
                    if (sib.clipContent) {
                        getOrCreateFrameClipRect(sib);
                        sibDescendants.forEach((child: any) => {
                            syncObjectFrameClip(child);
                        });
                    }
                });
            }

            // Update clipPath para todos os filhos (absolutePositioned: false
            // = relativo ao objeto, mas como o frame moveu e os filhos também,
            // precisamos recalcular o offset relativo)
            if (target.clipContent) {
                const fc = target.getCenterPoint ? target.getCenterPoint() : { x: target.left, y: target.top };
                const DEG2RAD = Math.PI / 180;
                frameChildrenCache.forEach((child: any) => {
                    if (child.clipPath && (child as any)._frameClipOwner === target._customId) {
                        const childCenter = child.getCenterPoint ? child.getCenterPoint() : { x: child.left, y: child.top };
                        const dxW = fc.x - childCenter.x;
                        const dyW = fc.y - childCenter.y;
                        const childAngle = child.angle || 0;
                        const aRad = -childAngle * DEG2RAD;
                        const cosA = Math.cos(aRad);
                        const sinA = Math.sin(aRad);
                        child.clipPath.set({
                            left: (dxW * cosA - dyW * sinA) / (child.scaleX || 1),
                            top: (dxW * sinA + dyW * cosA) / (child.scaleY || 1),
                            scaleX: (target.scaleX || 1) / (child.scaleX || 1),
                            scaleY: (target.scaleY || 1) / (child.scaleY || 1),
                            angle: (target.angle || 0) - childAngle,
                        });
                        if (typeof child.clipPath.setCoords === 'function') child.clipPath.setCoords();
                        child.clipPath.dirty = true;
                        child.set('dirty', true);
                    }
                });
            }

            // Fabric renders after object:moving — no explicit requestRenderAll needed
            return;
        }

        // Para um filho de Frame, o clipPath é relativo ao próprio objeto.
        // Recalcule enquanto ele se move para que a borda do recorte permaneça
        // fixa no Frame, sem revelar conteúdo durante o arraste.
        if (target && !target.isFrame && (target as any).parentFrameId) {
            const parentFrame = getFrameById(String((target as any).parentFrameId || ''));
            if (parentFrame?.clipContent) {
                syncObjectFrameClip(target);
            }
        }

        // Optimized Zone Move
        if (target && isLikelyProductZone(target)) {
            setFabricControlsHiddenDuringTransform(canvas.value, true);
            if (target.hasControls !== false) {
                target.set({ hasControls: false, dirty: true });
            }
            if (zoneChildrenCache.length === 0) {
                zoneChildrenCache = getZoneChildren(target);
            }

            const dx = target.left - lastZoneState.left;
            const dy = target.top - lastZoneState.top;

            // Move all cached children by delta
            zoneChildrenCache.forEach((child: any) => {
                child.set({
                    left: child.left + dx,
                    top: child.top + dy
                });
                child.setCoords();
            });

            // Update last state
            lastZoneState.left = target.left;
            lastZoneState.top = target.top;
        }

        // Containment during drag is handled in setupSnapping/object:moving and
        // finalized in object:modified. Re-running here causes jitter.
    });

    // Campos dinamicos: largura e altura sao atualizadas em tempo real sem
    // retirar as escalas dos cantos. Os controles superior/inferior usam o
    // handler `changeHeight` do Fabric e alteram somente a caixa.
    trackOn('object:resizing', (e: any) => {
        const obj = e?.target
        if (!obj || !isDynamicBusinessFieldObject(obj)) return
        configureDynamicBusinessTextObject(obj, fabric)
        reflowDynamicBusinessTextObject(obj, {
            corner: String(e?.transform?.corner || ''),
            action: String(e?.transform?.action || 'resizing')
        })
        obj.set?.('dirty', true)
        obj.setCoords?.()
        safeRequestRenderAll()
    })

    // Smart Scaling for Textbox Reflow & Product Zone AutoLayout
    trackOn('object:scaling', (e: any) => {
        ctx.setLastTransformMutationAt(Date.now());
        updateFloatingUI();
        const obj = e.target;
        if (isQuickLogoImageObject(obj)) syncQuickLogoBackdrop(obj);
        const lockedZones = getQuickModeLockedZones(obj);
        if (lockedZones.length > 0) {
            lockedZones.forEach((zone: any) => {
                rememberQuickModeZoneTransform(zone);
                restoreQuickModeZoneTransform(zone);
            });
            safeRequestRenderAll();
            return;
        }
        const scalingCorner = String(e?.transform?.corner || '').toLowerCase();
        const isSideScaleHandle = scalingCorner === 'ml' || scalingCorner === 'mr' || scalingCorner === 'mt' || scalingCorner === 'mb';

        // Smooth side-handle crop preview (Canva-like):
        // apply crop conversion on every scaling tick to avoid the "compress first, crop after release" jump.
        if (obj && String(obj.type || '').toLowerCase() === 'image' && isSideScaleHandle) {
            normalizeImageCropBySideHandle(obj, e?.transform, { save: false });
            if ((obj as any).parentFrameId) {
                syncObjectFrameClip(obj);
            }
            return;
        }

        // Campos dinamicos mantem as escalas dos cantos. A altura sem
        // deformacao e feita pelo evento `object:resizing` dos controles
        // superior/inferior; aqui apenas garantimos a configuracao do objeto.
        if (obj && isDynamicBusinessFieldObject(obj)) {
            // Escalas dos cantos continuam sendo escalas reais para que o
            // usuario consiga ajustar o tamanho do texto. A altura sem
            // deformacao e tratada pelos controles `mt`/`mb` como `resizing`.
            configureDynamicBusinessTextObject(obj, fabric)
        }

        // Frames: keep clip rect synced while resizing + update children clips
        if (obj && obj.isFrame) {
            markFrameLabelsDirty();
            getOrCreateFrameClipRect(obj);
            // Atualizar clips dos filhos em tempo real durante redimensionamento do frame
            if (obj.clipContent) {
                syncFrameClips(obj, { includeSpatialChildren: false, requestRender: false });
            }
        }

        // Filhos de frame: recalcular clip durante scaling do objeto
        if (obj && !obj.isFrame && obj.parentFrameId && obj.clipPath) {
            syncObjectFrameClip(obj);
        }

        // 1. Textbox Reflow
        if (obj && obj.type === 'textbox' && obj.lockScalingY && !isDynamicBusinessFieldObject(obj)) {
            const w = obj.width * obj.scaleX;
            obj.set({
                width: w,
                scaleX: 1
            });

            // Keep automatic text centered inside product card groups. Once the
            // user has dragged/resized this child, `useEditorSnapping` marks it
            // with `__manualTransform`; changing `left` back to zero here would
            // silently undo that explicit placement on every scaling tick.
            if (!((obj as any).__manualTransform) && obj.originX === 'center' && obj.group && (obj.group.isSmartObject || obj.group.isProductCard || isLikelyProductCard(obj.group))) {
                obj.set({ left: 0 });
                const cardGroup = obj.group;
                const cardW = Number((cardGroup as any)?._cardWidth ?? cardGroup?.width ?? cardGroup?.getScaledWidth?.() ?? 0);
                const cardH = Number((cardGroup as any)?._cardHeight ?? cardGroup?.height ?? cardGroup?.getScaledHeight?.() ?? 0);
                const maxCardW = Number.isFinite(cardW) && cardW > 0 ? Math.max(20, cardW) : Number.POSITIVE_INFINITY;
                const safeW = Math.min(maxCardW, Math.max(20, Number(w) || 0));
                obj.set({ width: safeW, scaleX: 1 });
                (obj as any).__manualTransform = true;
                (obj as any).__manualTextWidth = safeW;
                if (Number.isFinite(cardW) && cardW > 0) {
                    (obj as any).__manualTextWidthRatio = Math.min(1, Math.max(0.1, safeW / cardW));
                    (obj as any).__manualTransformCardW = cardW;
                }
                if (Number.isFinite(cardH) && cardH > 0) {
                    (obj as any).__manualTransformCardH = cardH;
                }
                syncCardProductDataTitleWidthFromTarget(obj);
            }
        }

        // 2. Rect Border-Radius Preservation (Figma-style)
        // Atualiza o border-radius em tempo real durante o redimensionamento
        if (obj && obj.type === 'rect' && (obj.rx || obj.ry)) {
            const scaledWidth = Math.abs(obj.getScaledWidth?.() ?? (obj.width * obj.scaleX));
            const scaledHeight = Math.abs(obj.getScaledHeight?.() ?? (obj.height * obj.scaleY));
            const maxRadius = Math.min(scaledWidth / 2, scaledHeight / 2);

            // Limita o radius para não exceder metade da menor dimensão
            if (obj.rx > maxRadius) {
                obj.set({ rx: maxRadius, ry: maxRadius });
            }
        }

        // 2b. Group Rect Border-Radius Preservation (Realtime)
        // Para grupos com retângulos internos (smart objects, cards, etc.)
        if (obj && obj.type === 'group' && obj.getObjects) {
            const objects = obj.getObjects();
            if (Array.isArray(objects)) {
                objects.forEach((child: any) => {
                    if (child.type === 'rect' && (child.rx || child.ry)) {
                        const childScaledWidth = Math.abs(child.getScaledWidth?.() ?? (child.width * child.scaleX));
                        const childScaledHeight = Math.abs(child.getScaledHeight?.() ?? (child.height * child.scaleY));
                        const maxChildRadius = Math.min(childScaledWidth / 2, childScaledHeight / 2);

                        if (child.rx > maxChildRadius) {
                            child.set({ rx: maxChildRadius, ry: maxChildRadius });
                        }
                    }
                });
            }
        }

        // 3. Zone Auto-Layout (Realtime Resize)
        if (obj && isLikelyProductZone(obj)) {
            const prevW = obj._zoneWidth ?? 0;
            const prevH = obj._zoneHeight ?? 0;
            obj.set({
                opacity: 1,
                borderOpacityWhenMoving: 1,
                hasControls: true,
                dirty: true,
                objectCaching: false
            });
            const liveRect = getZoneRect(obj);
            if (liveRect) {
                liveRect.set({ opacity: 1, visible: true, dirty: true, objectCaching: false });
            }
            obj.setCoords();
            // Durante scaling (tempo real), calcular dimensões combinando rect + scale do grupo.
            // NÃO chamar normalizeZoneScale aqui — resetar scaleX=1 durante o gesto
            // confunde o Fabric. A normalização é feita no object:modified (fim do gesto).
            const zr = getZoneRect(obj);
            const sx = Math.abs(obj.scaleX ?? 1);
            const sy = Math.abs(obj.scaleY ?? 1);
            if (zr) {
                obj._zoneWidth = Math.abs((zr.width ?? 0) * (zr.scaleX ?? 1)) * sx;
                obj._zoneHeight = Math.abs((zr.height ?? 0) * (zr.scaleY ?? 1)) * sy;
            } else {
                obj._zoneWidth = Math.abs(obj.getScaledWidth?.() ?? obj._zoneWidth ?? 0);
                obj._zoneHeight = Math.abs(obj.getScaledHeight?.() ?? obj._zoneHeight ?? 0);
            }

            const deltaW = Math.abs((obj._zoneWidth || 0) - prevW);
            const deltaH = Math.abs((obj._zoneHeight || 0) - prevH);
            if (deltaW > 2 || deltaH > 2) {
                obj.dirty = true;
            }
        }

        // 🔒 Apply containment after scaling.
        // During active scale of product images, avoid hard clamping each frame because
        // Fabric may use temporary side origins; clamping runs on `object:modified`.
        const isCardImageScaling = !!(
            obj &&
            String(obj.type || '').toLowerCase() === 'image' &&
            isProductCardImage(obj)
        );
        sanitizeProductCardImageTransform(obj, { clampWithinCard: !isCardImageScaling });
        if (!isCardImageScaling && shouldApplyContainmentConstraints(obj)) {
            applyContainmentConstraints(obj);
        }

        // Force live redraw while resizing. In some Fabric/browser combinations the
        // visual of simple shapes (ex: rect) can lag until the next interaction.
        if (obj) {
            obj.set?.('dirty', true);
            obj.setCoords?.();
        }
        safeRequestRenderAll();
    });

    trackOn('object:rotating', (e: any) => {
        ctx.setLastTransformMutationAt(Date.now());
        if (isQuickLogoImageObject(e?.target)) syncQuickLogoBackdrop(e.target);
        const lockedZones = getQuickModeLockedZones(e?.target);
        if (lockedZones.length > 0) {
            lockedZones.forEach((zone: any) => {
                rememberQuickModeZoneTransform(zone);
                restoreQuickModeZoneTransform(zone);
            });
            safeRequestRenderAll();
        }
    });

    // 🔒 Apply containment after modification (drag end)
    trackOn('object:modified', (e: any) => {
        const obj = e.target;
        if (isQuickModeLockedObject(obj)) {
            const lockedZones = getQuickModeLockedZones(obj);
            lockedZones.forEach((zone: any) => {
                rememberQuickModeZoneTransform(zone);
                restoreQuickModeZoneTransform(zone);
            });
            setFabricControlsHiddenDuringTransform(canvas.value, false);
            safeRequestRenderAll();
            return;
        }
        if (obj) {
            if (isQuickLogoImageObject(obj)) syncQuickLogoBackdrop(obj);
            if (isDynamicBusinessFieldObject(obj)) {
                configureDynamicBusinessTextObject(obj, fabric)
                reflowDynamicBusinessTextObject(obj, {
                    corner: String(e?.transform?.corner || ''),
                    action: String(e?.transform?.action || '')
                })
            }
            // Fabric emits object:modified before the canvas mouse:up hook. In
            // a fast drag, the snapping composable's RAF may not have run yet,
            // so establish the manual marker synchronously from the transform
            // action before any legacy centering/relayout code can run.
            const modifiedAction = String(e?.transform?.action || '').trim().toLowerCase();
            const isCardTextbox = ['textbox', 'image'].includes(String(obj?.type || '').toLowerCase()) &&
                obj.group &&
                (obj.group.isSmartObject || obj.group.isProductCard || isLikelyProductCard(obj.group));
            if (isCardTextbox && (modifiedAction.includes('drag') || modifiedAction.includes('move') || modifiedAction.includes('scale'))) {
                (obj as any).__manualTransform = true;
                const cardGroup = obj.group;
                const cardW = Number((cardGroup as any)?._cardWidth ?? cardGroup?.width ?? cardGroup?.getScaledWidth?.() ?? 0);
                const cardH = Number((cardGroup as any)?._cardHeight ?? cardGroup?.height ?? cardGroup?.getScaledHeight?.() ?? 0);
                if (Number.isFinite(cardW) && cardW > 0) (obj as any).__manualTransformCardW = cardW;
                if (Number.isFinite(cardH) && cardH > 0) (obj as any).__manualTransformCardH = cardH;
            }

            if (isProductCardContainer(obj)) {
                syncCardProductDataNameFromTitleTarget(obj, { normalizeDisplayedText: true });
                syncCardProductDataTitleWidthFromTarget(obj);
            }

            // Product card zone-lock should be finalized here to avoid per-frame work.
            if (!isLikelyProductZone(obj) && !obj.isFrame) {
                const isCardLike = !!(
                    obj.isSmartObject ||
                    obj.isProductCard ||
                    String(obj.name || '').startsWith('product-card') ||
                    isLikelyProductCard(obj) ||
                    String((obj as any).parentZoneId || '').trim().length
                );
                if (isCardLike) {
                    ensureCardZoneBinding(obj, { allowNearest: true });
                }
            }

            if (String(obj?.type || '').toLowerCase() === 'group' && String(obj?.name || '') === 'priceGroup') {
                const transformAction = String(e?.transform?.action || '').trim().toLowerCase();
                markPriceGroupTransformAsManual(obj);
                const cardSize = getCardSizeForPriceGroup(obj);
                if (cardSize) {
                    normalizePriceGroupPlacementInCard(
                        obj,
                        cardSize.width,
                        cardSize.height,
                        null,
                        { preserveScale: transformAction === 'drag' || transformAction === 'move' }
                    );
                    // A etiqueta já foi posicionada acima. Reaplicar a receita aqui
                    // encolhia o preço e recalculava o nome após um simples arraste.
                }
            }

            if (shouldApplyContainmentConstraints(obj)) {
                applyContainmentConstraints(obj);
            }

            if (isLikelyProductZone(obj)) {
                obj.set({ hasControls: true, dirty: true });
                ensureZoneSanity(obj);
                obj.setCoords?.();
                setFabricControlsHiddenDuringTransform(canvas.value, false);
                safeRequestRenderAll();
            }

            // Re-center only automatic textboxes inside product cards. Manual
            // child placement must survive object:modified (drag/drop), or the
            // next event would teleport the name back to the card center.
            if (!(obj as any).__manualTransform && obj.type === 'textbox' && obj.originX === 'center' && obj.group && (obj.group.isSmartObject || obj.group.isProductCard || isLikelyProductCard(obj.group))) {
                obj.set({ left: 0 });
                syncCardProductDataNameFromTitleTarget(obj, { normalizeDisplayedText: true });
                syncCardProductDataTitleWidthFromTarget(obj);
                obj.setCoords();
                safeRequestRenderAll();
            }
        }
        flushObjectMoveViewportCull();
    });
    trackOn('mouse:up', () => {
        flushObjectMoveViewportCull();
        setFabricControlsHiddenDuringTransform(canvas.value, false);
        const active = canvas.value?.getActiveObject?.();
        if (isQuickModeLockedObject(active)) {
            discardQuickModeLockedSelection(active);
            updateSelection();
            return;
        }
        if (active && isLikelyProductZone(active) && active.hasControls === false) {
            active.set({ hasControls: true, dirty: true });
            ensureZoneSanity(active);
            active.setCoords?.();
            safeRequestRenderAll();
        }
    });

    const syncTextSelectionSnapshot = (e: any) => {
        if (!canvas.value) return;
        const activeObj = canvas.value.getActiveObject?.();
        const target = e?.target;
        if (!isTextStyleObject(activeObj) && !isTextStyleObject(target)) return;
        refreshSelectedRef();
    };

    const isTextTargetObject = (obj: any) => {
        const t = String(obj?.type || '').toLowerCase();
        return t === 'text' || t === 'i-text' || t === 'textbox';
    };

    const dynamicEditAnchors = new WeakMap<object, { point: any }>();
    const handleTextEditingEntered = (e: any) => {
        const target = e?.target;
        if (isDynamicBusinessFieldObject(target)) {
            dynamicEditAnchors.set(target, { point: target.getPointByOrigin('left', 'top') });
        }
        syncTextSelectionSnapshot(e);
    };
    const restoreDynamicEditAnchor = (target: any) => {
        const anchor = target && dynamicEditAnchors.get(target);
        if (!anchor) return;
        target.setPositionByOrigin(anchor.point, 'left', 'top');
        target.setCoords?.();
        target.dirty = true;
        safeRequestRenderAll();
    };
    const handleTextChanged = (e: any) => {
        syncTextSelectionSnapshot(e);
        const target = e?.target;
        if (isDynamicBusinessFieldObject(target)) {
            // Store direct edits separately from the profile-derived value.
            // Empty text is an intentional override too.
            target.dynamicUserText = String(target.text ?? '')
            target.dynamicUserTextSource = isQuickMode.value ? 'quick-user' : 'designer'
            target.__rawText = target.dynamicUserText
            configureDynamicBusinessTextObject(target, fabric)
            fitDynamicBusinessTextObject(target)
            restoreDynamicEditAnchor(target)
        }
        markPriceGroupAsManuallyCustomized(target, { captureSnapshot: false });
        const didSyncCardName = syncCardProductDataNameFromTitleTarget(target, { normalizeDisplayedText: false });
        const didSyncCardTitleWidth = syncCardProductDataTitleWidthFromTarget(target);
        if (didSyncCardName || didSyncCardTitleWidth || isTextTargetObject(target)) {
            queueTextEditSave('text-edit');
        }
    };

    const handleTextEditingExited = (e: any) => {
        syncTextSelectionSnapshot(e);
        const target = e?.target;
        if (isDynamicBusinessFieldObject(target)) {
            // Store direct edits separately from the profile-derived value.
            // Empty text is an intentional override too.
            target.dynamicUserText = String(target.text ?? '')
            target.dynamicUserTextSource = isQuickMode.value ? 'quick-user' : 'designer'
            target.__rawText = target.dynamicUserText
            configureDynamicBusinessTextObject(target, fabric)
            fitDynamicBusinessTextObject(target)
            restoreDynamicEditAnchor(target)
        }
        markPriceGroupAsManuallyCustomized(target);
        const didSyncCardName = syncCardProductDataNameFromTitleTarget(target, { normalizeDisplayedText: true });
        const didSyncCardTitleWidth = syncCardProductDataTitleWidthFromTarget(target);
        if (didSyncCardName || didSyncCardTitleWidth || isTextTargetObject(target)) {
            flushTextEditSave('text-edit-exit');
        }
    };

    trackOn('text:selection:changed', syncTextSelectionSnapshot);
    trackOn('text:editing:entered', handleTextEditingEntered);
    trackOn('text:editing:exited', handleTextEditingExited);
    trackOn('text:changed', handleTextChanged);

    // 'selection:created', 'selection:updated', 'selection:cleared'
    trackOn('selection:created', (e: any) => {
        const selected = canvas.value?.getActiveObject?.();
        if (discardQuickModeLockedSelection(selected)) {
            updateSelection();
            return;
        }
        updatePriceGroupSelectionIntent(e, { preserveLabelForCard: true });
        if (normalizeActiveSelectionForProductCards()) {
            refreshShiftSelectionBaseline();
            updateSelection();
            return;
        }
        applyVisibleSelectionChrome(selected);
        if (selected && isLikelyProductZone(selected)) ensureZoneSanity(selected);
        // Selecionar a página não pode aparar seu tamanho até os filhos.
        // O formato pertence ao frame; auto trim automático é exclusivo de imagens.
        if (selected && !selected.isFrame && String(selected.type || '').toLowerCase() === 'image') {
            if (trimContainerEmptySpace(selected)) {
                applyVisibleSelectionChrome(selected);
                safeRequestRenderAll();
            }
        }
        refreshShiftSelectionBaseline();
        updateSelection();
    });
    trackOn('selection:updated', (e: any) => {
        const selected = canvas.value?.getActiveObject?.();
        if (discardQuickModeLockedSelection(selected)) {
            updateSelection();
            return;
        }
        updatePriceGroupSelectionIntent(e, { preserveLabelForCard: true });
        // Se a nova selecao NAO e nenhum dos priceGroups com deep-select ativo
        // (nem um filho deles), resetamos todos para evitar deep-select "preso".
        try {
            const active = canvas.value?.getActiveObjects?.() || []
            const stillInside = active.some((o: any) => {
                if (!o) return false
                const pg = resolvePriceGroupAncestor(o)
                return !!pg && priceGroupsWithDeepSelect.has(pg)
            })
            if (!stillInside && priceGroupsWithDeepSelect.size > 0) {
                resetAllDeepSelectPriceGroups()
            }
        } catch { /* ignore */ }
        if (normalizeActiveSelectionForProductCards()) {
            refreshShiftSelectionBaseline();
            updateSelection();
            return;
        }
        applyVisibleSelectionChrome(selected);
        if (selected && isLikelyProductZone(selected)) ensureZoneSanity(selected);
        refreshShiftSelectionBaseline();
        updateSelection();
    });
    trackOn('selection:cleared', (e: any) => {
        shiftSelectionBaselineMembers = [];
        selectedPriceGroupSubTarget.value = null;
        selectedPriceGroupSelectionKind.value = 'none';
        updateSelection();
        // Exit Deep Select Mode on clear
        resetDeepSelection();
    });

    // === DEEP SELECT (Figma-style) ===
    // Product cards always have subTargetCheck=true (single-click deep select).
    // priceGroups precisam ser reescolhidos no fim: quando usuario dblclicka
    // em um priceGroup, habilitamos subTargetCheck/interactive para permitir
    // editar elementos internos. Sem reset, o priceGroup permanecia selecionavel
    // diretamente e sequestrava clicks que deveriam ir para a zona/card pai.
    const resetPriceGroupDeepSelect = (pg: any) => {
        if (!isPriceGroupObject(pg)) return
        try {
            setPriceGroupInteractionMode(pg, 'move')
        } catch {
            // ignore — se o priceGroup ja foi removido do canvas
        }
    }

    const resetAllDeepSelectPriceGroups = () => {
        if (priceGroupsWithDeepSelect.size === 0) return
        priceGroupsWithDeepSelect.forEach((pg: any) => resetPriceGroupDeepSelect(pg))
        priceGroupsWithDeepSelect.clear()
        safeRequestRenderAll()
    }
    // Expor para o handler global de Escape (onMounted)
    ctx.setResetAllDeepSelectPriceGroupsRef(resetAllDeepSelectPriceGroups)

    const resetDeepSelection = () => {
        // Desfaz deep-select em priceGroups. Sem isso, o usuario entra no label,
        // edita, clica fora e o label continuava com subTargetCheck=true, o que
        // quebrava o drag da zona/card-pai.
        resetAllDeepSelectPriceGroups()
    }

    // 2. Enable deep select on Double Click
    trackOn('mouse:dblclick', (opt: any) => {
        if (showProductReviewModal.value) return;

        const c: any = canvas.value as any;
        const evt = opt.e || opt.originalEvent;
        let rawTarget = opt.target;

        if (import.meta.dev) {
            console.log('[DeepSelect] dblclick', {
                hasTarget: !!rawTarget,
                rawType: rawTarget?.type,
                rawName: rawTarget?.name,
                rawLayerName: rawTarget?.layerName,
                rawId: rawTarget?._customId,
                hasEvt: !!evt
            });
        }

        const isProductCardGroup = (o: any) => {
            return !!(o && o.type === 'group' && (o.isSmartObject || o.isProductCard || String(o.name || '').startsWith('product-card') || isLikelyProductCard(o)) && String(o.name || '') !== 'priceGroup');
        };

        const getCandidatePointsFromEvent = (): any[] => {
            if (!evt || !canvas.value) return [];
            const pts: any[] = [];
            try {
                if (typeof c.getScenePoint === 'function') {
                    const p0 = c.getScenePoint(evt);
                    if (p0 && typeof p0.x === 'number' && typeof p0.y === 'number') pts.push(p0);
                }
            } catch (e) {
                // ignore
            }
            try {
                if (typeof canvas.value.getPointer === 'function') {
                    const p1 = canvas.value.getPointer(evt);
                    if (p1 && typeof p1.x === 'number' && typeof p1.y === 'number') pts.push(p1);
                    const vpt = canvas.value.viewportTransform;
                    if (p1 && Array.isArray(vpt) && vpt.length >= 6 && (fabric as any)?.util?.invertTransform) {
                        const inv = (fabric as any).util.invertTransform(vpt);
                        const p2 = (fabric as any).util.transformPoint(p1, inv);
                        if (p2 && typeof p2.x === 'number' && typeof p2.y === 'number') pts.push(p2);
                    }
                }
            } catch (e) {
                // ignore
            }
            return pts;
        };

        const findTopCardAtPointer = (): any | null => {
            if (!evt || !canvas.value) return null;
            const pts = getCandidatePointsFromEvent();
            if (!pts.length) return null;

            const objs = canvas.value.getObjects().slice().reverse();
            for (const o of objs) {
                if (!isProductCardGroup(o)) continue;
                try {
                    for (const p of pts) {
                        if (typeof o.containsPoint === 'function' && o.containsPoint(p, undefined, true)) return o;
                    }
                } catch (e) {
                    // ignore
                }
                try {
                    const br = o.getBoundingRect?.(true) ?? null;
                    if (br) {
                        for (const p of pts) {
                            if (p.x >= br.left && p.x <= (br.left + br.width) && p.y >= br.top && p.y <= (br.top + br.height)) return o;
                        }
                    }
                } catch (e) {
                    // ignore
                }
            }
            return null;
        };

        // Fabric nem sempre fornece opt.target no dblclick após loadFromJSON.
        // Tenta resolver via findTarget/hit-test manual.
        if (!rawTarget && evt && typeof c.findTarget === 'function') {
            try { rawTarget = c.findTarget(evt); } catch (e) { /* ignore */ }
        }
        if (!rawTarget) {
            rawTarget = findTopCardAtPointer();
        }
        if (discardQuickModeLockedSelection(rawTarget)) {
            updateSelection();
            return;
        }
        if (!rawTarget) {
            if (import.meta.dev) console.warn('[DeepSelect] dblclick sem target e sem card no ponteiro');
            return;
        }

        // If user double-clicks an inner element of a product card, use its parent group as the target.
        // This makes deep-select work even when a legacy card was loaded with subTargetCheck=true.
        // Se o dblclick caiu na zone/overlay, tenta forçar o card que está embaixo do ponteiro.
        let target = (rawTarget as any)?.group && isProductCardGroup((rawTarget as any).group)
            ? (rawTarget as any).group
            : rawTarget;
        if (!isProductCardGroup(target)) {
            const cardUnderPointer = findTopCardAtPointer();
            if (cardUnderPointer) target = cardUnderPointer;
        }

        if (import.meta.dev) {
            console.log('[DeepSelect] alvo resolvido', {
                type: target?.type,
                name: target?.name,
                id: target?._customId,
                isCard: isProductCardGroup(target),
                parentZoneId: (target as any)?.parentZoneId
            });
        }

        if (focusProductZoneFromDblClickTarget(target)) {
            return;
        }

        // Nested label editing: double click the priceGroup to edit its inner parts.
        if (isPriceGroupObject(target)) {
            updatePriceGroupSelectionIntent({ target });
            setPriceGroupInteractionMode(target, 'edit');
            if (typeof target.getObjects === 'function') {
                target.getObjects().forEach((child: any) => {
                    const isBgImage = isPriceGroupBackground(child);
                    child.set?.({
                        lockMovementX: false,
                        lockMovementY: false,
                        lockScalingX: false,
                        lockScalingY: false,
                        lockRotation: false
                    });
                    enableCardElementRotationControl(child, !isBgImage);
                });
            }
            target.setCoords?.();
            safeRequestRenderAll();
            return;
        }

            // Product cards already have subTargetCheck=true for single-click deep select.
            // Product import stays on explicit zone actions to avoid accidental modals.
    });

    // 3. Product cards always stay interactive (single-click deep select).
    // No need to reset other cards when selecting a new object.

    // Initial fetch
    updateObjects();
    const teardown = () => {
        tracked.forEach(({ event, handler }) => {
            try {
                canvas.value?.off(event, handler);
            } catch {
                // ignore teardown errors
            }
        });
    };
    ctx.setTeardownReactivity(teardown);
}

    return {
        setupReactivity
    }
}

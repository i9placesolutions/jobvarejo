import { type Ref } from 'vue'

export type EditorAltDragDuplicateDeps = {
  canvasInstance: any
  fabric: any
  makeId: () => string
  isPenMode: Ref<boolean>
  isNodeEditing: Ref<boolean>
  isDrawing: Ref<boolean>
  isLikelyProductZone: (obj: any) => boolean
  isLikelyProductCard: (obj: any) => boolean
  isProductCardContainer: (obj: any) => boolean
  safeRequestRenderAll: () => void
  shouldApplyContainmentConstraints: (obj: any) => boolean
  applyContainmentConstraints: (obj: any) => void
  getFrameDescendants: (frame: any) => any[]
  syncObjectFrameClip: (obj: any) => void
  saveCurrentState: (opts?: any) => boolean | Promise<boolean>
  refreshSelectedRef: () => void
  refreshCanvasObjects: () => void
  flushZoneRelayoutOnDrop: () => void
  getZoneMetrics: (zone: any) => any
  getZoneGlobalStyles: (zone: any) => any
  remapDuplicatedSelectionBindings: (clones: any[], opts?: any) => void
}

export type EditorAltDragDuplicateApi = {
  setup: () => void
  teardown: () => void
}

export function useEditorAltDragDuplicate(deps: EditorAltDragDuplicateDeps): EditorAltDragDuplicateApi {
  let teardownRef: (() => void) | null = null

  const setup = () => {
    if (!deps.canvasInstance || !deps.fabric) return
    if (teardownRef) { teardownRef(); teardownRef = null; }

    const canvasInstance = deps.canvasInstance
    const fabric = deps.fabric

    if (!canvasInstance || !fabric) return;

    const isValidFabricObject = (o: any) => {
        if (!o || typeof o !== 'object') return false;
        return typeof o.set === 'function' && typeof o.render === 'function' && typeof o.setCoords === 'function';
    };

    const assignNewIdsDeep = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj.set !== 'function') return;
        (obj as any).__duplicateSourceCustomId = String((obj as any)._customId || '').trim();
        obj._customId = deps.makeId();
        if (typeof obj.getObjects === 'function') {
            (obj.getObjects() || []).forEach((c: any) => {
                if (c && typeof c.set === 'function') {
                    (c as any).__duplicateSourceCustomId = String((c as any)._customId || '').trim();
                    c._customId = deps.makeId();
                }
            });
        }
    };

    const state = {
        armed: false,
        cloning: false,
        didDuplicate: false,
        cloneRequestSeq: 0,
        activeCloneRequestId: 0,
        original: null as any,
        clone: null as any,
        parentGroup: null as any,
        cloneInGroup: false,
        startLeft: 0,
        startTop: 0,
        origLockX: false,
        origLockY: false,
        // Track current pointer during async clone for smooth positioning
        lastPointerX: 0,
        lastPointerY: 0,
        pointerDownX: 0,
        pointerDownY: 0,
        manualFollowClone: false,
    };

    const restoreOriginalLocks = (obj: any) => {
        if (!obj || typeof obj.set !== 'function') return;
        obj.set({
            lockMovementX: !!state.origLockX,
            lockMovementY: !!state.origLockY,
        });
        obj.setCoords?.();
    };

    const isEligibleTarget = (obj: any) => {
        if (!obj) return false;
        if (obj.excludeFromExport) return false;
        if (deps.isPenMode.value || deps.isNodeEditing.value || deps.isDrawing.value) return false;
        if (deps.isLikelyProductZone(obj)) return false;
        // ActiveSelection is allowed — Alt+drag duplicates all selected objects
        return true;
    };

    const pickAltDragSource = (opt: any) => {
        const candidates: any[] = [];
        const seen = new Set<any>();
        const push = (obj: any) => {
            if (!obj || seen.has(obj)) return;
            seen.add(obj);
            candidates.push(obj);
        };

        if (Array.isArray(opt?.subTargets)) {
            opt.subTargets.forEach((obj: any) => push(obj));
        }
        push(opt?.subTarget);
        push(opt?.target);

        const tr: any = (canvasInstance as any)?._currentTransform;
        push(tr?.target);

        const active = canvasInstance?.getActiveObject?.();
        push((active as any)?._activeObject);
        push(active);

        return candidates.find((obj: any) => isEligibleTarget(obj)) || null;
    };

    const resolveSourceFromTransform = (source: any, transformTarget: any) => {
        if (!isEligibleTarget(transformTarget)) return source;
        if (!source) return transformTarget;
        if (transformTarget === source) return source;

        const sourceType = String(source?.type || '').toLowerCase();
        const sourceIsGroup = sourceType === 'group';
        if (sourceIsGroup && transformTarget.group === source) {
            return transformTarget;
        }

        const sourceParent = source?.group;
        if (sourceParent && transformTarget === sourceParent) {
            // User may be deep-selecting a child while Fabric reports parent group as transform target.
            return source;
        }
        if (sourceParent && transformTarget.group === sourceParent) {
            return transformTarget;
        }

        return source;
    };

    // isTransformRelatedToSource extraido para utils/fabricObjectClassifiers.ts.

    const syncCloneToPointerDelta = () => {
        if (!state.clone || !isValidFabricObject(state.clone)) return;
        if (!Number.isFinite(state.pointerDownX) || !Number.isFinite(state.pointerDownY)) return;

        const worldDx = Number(state.lastPointerX || 0) - Number(state.pointerDownX || 0);
        const worldDy = Number(state.lastPointerY || 0) - Number(state.pointerDownY || 0);

        let localDx = worldDx;
        let localDy = worldDy;
        const parentGroup = (state.clone as any)?.group;
        if (parentGroup) {
            const angle = (Number((parentGroup as any)?.angle) || 0) * (Math.PI / 180);
            const cos = Math.cos(-angle);
            const sin = Math.sin(-angle);
            const rotatedX = worldDx * cos - worldDy * sin;
            const rotatedY = worldDx * sin + worldDy * cos;
            const scaleX = Number((parentGroup as any)?.scaleX) || 1;
            const scaleY = Number((parentGroup as any)?.scaleY) || 1;
            localDx = rotatedX / (scaleX || 1);
            localDy = rotatedY / (scaleY || 1);
        }

        state.clone.set({
            left: Number(state.startLeft || 0) + localDx,
            top: Number(state.startTop || 0) + localDy,
        });
        state.clone.setCoords?.();
        if (deps.shouldApplyContainmentConstraints(state.clone)) {
            deps.applyContainmentConstraints(state.clone);
        }
    };

    const getScenePointerFromEvent = (evt: any): { x: number; y: number } | null => {
        if (!canvasInstance || !evt) return null;
        try {
            // Use scene/world coords first (matches object left/top space).
            const scene = canvasInstance.getScenePoint?.(evt);
            if (scene && Number.isFinite(scene.x) && Number.isFinite(scene.y)) {
                return { x: Number(scene.x), y: Number(scene.y) };
            }
            const viewport = canvasInstance.getViewportPoint?.(evt);
            if (viewport && Number.isFinite(viewport.x) && Number.isFinite(viewport.y)) {
                return { x: Number(viewport.x), y: Number(viewport.y) };
            }
        } catch {
            // ignore
        }
        return null;
    };

    const onMouseDown = (opt: any) => {
        const evt: MouseEvent | undefined = opt?.e;
        if (!evt || evt.button !== 0 || !evt.altKey) {
            state.armed = false;
            state.activeCloneRequestId = 0;
            state.manualFollowClone = false;
            return;
        }
        const source = pickAltDragSource(opt);
        if (!isEligibleTarget(source)) {
            state.armed = false;
            state.activeCloneRequestId = 0;
            state.manualFollowClone = false;
            return;
        }

        // FIGMA BEHAVIOR: When user deep-selects a child inside a product card
        // (e.g., product image, title text), ALT+drag should duplicate JUST that child,
        // NOT the entire card group. The child will be cloned inside the same parent group.
        // If the user wants to duplicate the whole card, they select the card group itself.

        state.armed = true;
        state.cloning = false;
        state.didDuplicate = false;
        state.manualFollowClone = false;
        state.activeCloneRequestId = 0;
        state.original = source;
        state.startLeft = Number(source.left || 0);
        state.startTop = Number(source.top || 0);
        // Initialize pointer tracking at mousedown position
        const ptr = getScenePointerFromEvent(evt);
        if (ptr) {
            state.lastPointerX = ptr.x;
            state.lastPointerY = ptr.y;
            state.pointerDownX = ptr.x;
            state.pointerDownY = ptr.y;
        } else {
            state.lastPointerX = state.startLeft;
            state.lastPointerY = state.startTop;
            state.pointerDownX = state.startLeft;
            state.pointerDownY = state.startTop;
        }
    };
    canvasInstance.on('mouse:down', onMouseDown);

    const onMouseMoveBefore = (opt: any) => {
        if (!state.armed || state.cloning) return;
        if (!canvasInstance) return;

        // Track pointer continuously for smooth clone positioning
        try {
            const evt = opt?.e;
            if (evt) {
                const ptr = getScenePointerFromEvent(evt);
                if (ptr) { state.lastPointerX = ptr.x; state.lastPointerY = ptr.y; }
            }
        } catch { /* ignore */ }

        if (state.didDuplicate) {
            if (state.manualFollowClone && state.clone) {
                syncCloneToPointerDelta();
                deps.safeRequestRenderAll();
            }
            return;
        }

        const tr: any = (canvasInstance as any)._currentTransform;
        const transformTarget = tr?.target;
        const resolvedSource = resolveSourceFromTransform(state.original, transformTarget);
        if (resolvedSource && resolvedSource !== state.original) {
            state.original = resolvedSource;
            state.startLeft = Number(resolvedSource.left || 0);
            state.startTop = Number(resolvedSource.top || 0);
            // Re-anchor drag delta when Fabric swaps parent->child target to avoid jump.
            if (Number.isFinite(state.lastPointerX) && Number.isFinite(state.lastPointerY)) {
                state.pointerDownX = Number(state.lastPointerX);
                state.pointerDownY = Number(state.lastPointerY);
            }
        }

        // For interactive groups (product cards with subTargetCheck=true), Fabric may report
        // transform target as either the child or its parent group depending on hit-test timing.
        // When transform is not yet available or target is null, trust the mousedown source.
        if (tr && transformTarget && !isTransformRelatedToSource(state.original, transformTarget)) {
            const sourceGroup = state.original?.group;
            const inInteractiveGroup = !!(
                sourceGroup &&
                (sourceGroup.interactive || sourceGroup.subTargetCheck)
            );
            if (!inInteractiveGroup) return;
        }

        // Start cloning (runs once)
        state.cloning = true;
        const original = state.original;
        const origLeft = state.startLeft;
        const origTop = state.startTop;

        // Fabric can occasionally keep the transform bound to the parent group even when
        // user is dragging a deep-selected child. Re-bind to child so clone handoff is stable.
        const sourceParentGroup = (original as any)?.group;
        if (tr && sourceParentGroup && tr.target === sourceParentGroup && tr.target !== original) {
            tr.target = original;
            if (tr.original && typeof tr.original === 'object') {
                tr.original.left = origLeft;
                tr.original.top = origTop;
            }
        }

        // Lock original IMMEDIATELY to prevent it from moving while clone is being created.
        // This is critical because doClone() is async (fabric.clone / enlivenObjects return Promises).
        // Without this, the original moves with the mouse for 1-2 frames before the clone takes over.
        state.origLockX = !!original.lockMovementX;
        state.origLockY = !!original.lockMovementY;
        original.set({ lockMovementX: true, lockMovementY: true });
        original.set({ left: origLeft, top: origTop });
        original.setCoords?.();
        const cloneRequestId = ++state.cloneRequestSeq;
        state.activeCloneRequestId = cloneRequestId;

        // Clone via Fabric's native clone
        const CLONE_PROPS = [
            '_customId', 'isFrame', 'layerName', 'clipContent', 'parentFrameId', 'parentZoneId',
            'objectMaskEnabled',
            'isSmartObject', 'isProductCard', 'name', 'smartGridId', 'unitLabel',
            'price', 'pricePack', 'priceUnit', 'priceSpecial', 'priceSpecialUnit', 'specialCondition',
            'priceWholesale', 'wholesaleTrigger', 'wholesaleTriggerUnit', 'packQuantity', 'packUnit', 'packageLabel',
            'unit', 'limit', '_productData', '_cardWidth', '_cardHeight', 'subTargetCheck', 'interactive',
            '__preserveManualLayout', '__isCustomTemplate', '__forceAtacarejoCanonical',
            '__manualTemplateBaseW', '__manualTemplateBaseH', '__manualGapSingle', '__manualGapRetail', '__manualGapWholesale',
            '__atacValueVariants', '__atacVariantGroups'
        ];

        const cloneSingleObject = async (src: any): Promise<any> => {
            let cloned: any = null;
            const srcType = String(src.type || '').toLowerCase();
            const isSrcGroup = srcType === 'group';

            // For groups, prefer serialize+enliven — fabric.clone() on groups sometimes
            // produces children that lose critical methods (getRelativeCenterPoint etc.)
            if (isSrcGroup) {
                try {
                    const json = typeof src.toObject === 'function' ? src.toObject(CLONE_PROPS) : null;
                    if (json && fabric?.util?.enlivenObjects) {
                        const objs = await fabric.util.enlivenObjects([json]);
                        cloned = Array.isArray(objs) && objs.length > 0 ? objs[0] : null;
                    }
                } catch (e) {
                    console.warn('[alt-drag-duplicate] serialize+enliven for group failed', e);
                    cloned = null;
                }
            }

            // For non-groups (or if serialize failed), try native clone
            if (!isValidFabricObject(cloned)) {
                try {
                    if (typeof src.clone === 'function') {
                        const result = src.clone(CLONE_PROPS);
                        if (result && typeof result.then === 'function') {
                            cloned = await result;
                        }
                    }
                } catch { /* ignore */ }
            }

            // Final fallback: serialize + enliven
            if (!isValidFabricObject(cloned) && !isSrcGroup) {
                try {
                    const json = typeof src.toObject === 'function' ? src.toObject(CLONE_PROPS) : null;
                    if (json && fabric?.util?.enlivenObjects) {
                        const objs = await fabric.util.enlivenObjects([json]);
                        cloned = Array.isArray(objs) && objs.length > 0 ? objs[0] : null;
                    }
                } catch { /* ignore */ }
            }

            // Validate group children have proper methods
            if (isValidFabricObject(cloned) && cloned.type === 'group' && typeof cloned.getObjects === 'function') {
                const children = cloned.getObjects();
                const allValid = children.every((c: any) => c && typeof c === 'object' && typeof c.getRelativeCenterPoint === 'function');
                if (!allValid) {
                    cloned = null;
                    try {
                        const json = typeof src.toObject === 'function' ? src.toObject(CLONE_PROPS) : null;
                        if (json && fabric?.util?.enlivenObjects) {
                            const objs = await fabric.util.enlivenObjects([json]);
                            cloned = Array.isArray(objs) && objs.length > 0 ? objs[0] : null;
                        }
                    } catch { /* ignore */ }
                }
            }

            return cloned;
        };

        const doClone = async () => {
            const isActiveSelection = String(original.type || '').toLowerCase() === 'activeselection';

            // ── ActiveSelection: clone each member individually ──
            if (isActiveSelection) {
                const members = typeof original.getObjects === 'function' ? original.getObjects() : [];
                if (members.length === 0) {
                    state.activeCloneRequestId = 0;
                    state.armed = false;
                    restoreOriginalLocks(original);
                    state.cloning = false;
                    return;
                }

                const clones: any[] = [];
                for (const member of members) {
                    const c = await cloneSingleObject(member);
                    if (!isValidFabricObject(c)) continue;
                    assignNewIdsDeep(c);
                    // Compute absolute position from the ActiveSelection's transform matrix
                    const mat = member.calcTransformMatrix?.();
                    if (mat) {
                        const decomposed = fabric.util.qrDecompose?.(mat) || {} as any;
                        c.set({
                            left: decomposed.translateX ?? Number(member.left || 0),
                            top: decomposed.translateY ?? Number(member.top || 0),
                            scaleX: decomposed.scaleX ?? member.scaleX ?? 1,
                            scaleY: decomposed.scaleY ?? member.scaleY ?? 1,
                            angle: decomposed.angle ?? member.angle ?? 0,
                        });
                    }
                    c.set({ selectable: true, evented: true, hasControls: true, hasBorders: true, objectCaching: false, dirty: true });
                    // Copy parentFrameId
                    if ((member as any).parentFrameId != null) (c as any).parentFrameId = (member as any).parentFrameId;
                    c.setCoords?.();
                    canvasInstance.add(c);
                    clones.push(c);
                }
                deps.remapDuplicatedSelectionBindings(clones, { reason: 'alt-drag-selection', relayout: false });

                if (clones.length === 0 || !canvasInstance) {
                    state.activeCloneRequestId = 0;
                    state.armed = false;
                    restoreOriginalLocks(original);
                    state.cloning = false;
                    return;
                }

                // Create new ActiveSelection from clones
                const newAS = new (fabric as any).ActiveSelection(clones, { canvas: canvasInstance });
                canvasInstance.setActiveObject(newAS);

                // Swap Fabric transform to the new ActiveSelection
                const tr: any = (canvasInstance as any)._currentTransform;
                let didSwapTransform = false;
                if (tr && (tr.target === original || isTransformRelatedToSource(original, tr.target))) {
                    tr.target = newAS;
                    if (tr.original && typeof tr.original === 'object') {
                        tr.original.left = newAS.left;
                        tr.original.top = newAS.top;
                    }
                    didSwapTransform = true;
                }

                // Pin originals in place
                original.set({ left: origLeft, top: origTop });
                original.setCoords?.();

                state.clone = newAS;
                state.didDuplicate = true;
                state.manualFollowClone = !didSwapTransform;
                syncCloneToPointerDelta();

                if (didSwapTransform) {
                    const tr2: any = (canvasInstance as any)?._currentTransform;
                    if (tr2?.original && typeof tr2.original === 'object') {
                        tr2.original.left = newAS.left;
                        tr2.original.top = newAS.top;
                    }
                }
                state.cloning = false;
                deps.safeRequestRenderAll();
                return;
            }

            // ── Single object clone ──
            let cloned = await cloneSingleObject(original);

            const cloneWasCancelled = cloneRequestId !== state.activeCloneRequestId || !state.armed;
            if (cloneWasCancelled || !isValidFabricObject(cloned) || !canvasInstance) {
                state.activeCloneRequestId = 0;
                state.armed = false;
                restoreOriginalLocks(original);
                state.cloning = false;
                return;
            }

            assignNewIdsDeep(cloned);

            // Copy metadata — only for top-level objects or card groups.
            // When cloning a CHILD element inside a card (e.g., a product image),
            // do NOT copy card-level meta to the child clone.
            const isCloneACard = cloned.type === 'group' && (cloned.isSmartObject || cloned.isProductCard || deps.isLikelyProductCard(cloned));
            if (isCloneACard) {
                for (const k of ['parentFrameId', 'parentZoneId', 'isSmartObject', 'isProductCard', 'unitLabel', 'smartGridId', '_cardWidth', '_cardHeight']) {
                    if ((original as any)[k] != null) (cloned as any)[k] = (original as any)[k];
                }
            } else if (!original.group || !(original.group.isSmartObject || original.group.isProductCard || deps.isLikelyProductCard(original.group))) {
                // Only copy frame/zone binding for non-card-child objects
                for (const k of ['parentFrameId']) {
                    if ((original as any)[k] != null) (cloned as any)[k] = (original as any)[k];
                }
            }

            // Ensure cloned product card groups have correct child flags
            if ((cloned.isSmartObject || cloned.isProductCard) && cloned.type === 'group' && typeof cloned.getObjects === 'function') {
                cloned.set({ subTargetCheck: true, interactive: true });
                cloned.getObjects().forEach((child: any) => {
                    const isBackground = child.name === 'offerBackground' || child.name === 'price_bg';
                    child.set({
                        selectable: !isBackground,
                        evented: !isBackground,
                        hasControls: !isBackground,
                        hasBorders: !isBackground,
                    });
                });
            }

            // Check if original is inside a group (e.g. product card inside product zone)
            const parentGroup = (original as any).group;
            const isInsideGroup = parentGroup && String(parentGroup.type || '').toLowerCase() !== 'activeselection';
            state.parentGroup = isInsideGroup ? parentGroup : null;
            state.cloneInGroup = false;

            // ── Position & insert the clone ──
            if (isInsideGroup && parentGroup) {
                // INSIDE GROUP: insert clone directly into parent group at same local coords.
                cloned.set({
                    left: origLeft,
                    top: origTop,
                    originX: original.originX || 'left',
                    originY: original.originY || 'top',
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                    objectCaching: false,
                    dirty: true,
                });

                // SILENT insertion: disable LayoutManager to prevent position recalculation
                const lm = (parentGroup as any).layoutManager;
                const origPerformLayout = lm?.performLayout;
                if (lm) lm.performLayout = () => {};

                const groupObjects = typeof parentGroup.getObjects === 'function'
                    ? parentGroup.getObjects()
                    : (Array.isArray((parentGroup as any)._objects) ? (parentGroup as any)._objects : []);
                const originalIndexInGroup = Array.isArray(groupObjects) ? groupObjects.indexOf(original) : -1;
                const insertIndex = originalIndexInGroup >= 0
                    ? Math.min(originalIndexInGroup + 1, groupObjects.length)
                    : -1;

                if (insertIndex >= 0 && typeof (parentGroup as any).insertAt === 'function') {
                    (parentGroup as any).insertAt(insertIndex, cloned);
                } else if (Array.isArray((parentGroup as any)._objects)) {
                    if (insertIndex >= 0) {
                        (parentGroup as any)._objects.splice(insertIndex, 0, cloned);
                    } else {
                        (parentGroup as any)._objects.push(cloned);
                    }
                    (cloned as any).group = parentGroup;
                    cloned.canvas = canvasInstance;
                } else if (typeof parentGroup.add === 'function') {
                    parentGroup.add(cloned);
                }

                if (lm && origPerformLayout) lm.performLayout = origPerformLayout;

                cloned.setCoords?.();
                parentGroup.set('dirty', true);
                if (deps.shouldApplyContainmentConstraints(cloned)) {
                    deps.applyContainmentConstraints(cloned);
                }
                state.cloneInGroup = true;

            } else {
                // CANVAS LEVEL: same left/top/origin
                cloned.set({
                    left: origLeft,
                    top: origTop,
                    originX: original.originX || 'left',
                    originY: original.originY || 'top',
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                    objectCaching: false,
                    dirty: true,
                });
                cloned.setCoords?.();

                canvasInstance.add(cloned);

                // Z-order: place clone right above the original
                const canvasObjs = canvasInstance.getObjects();
                const origIdx = canvasObjs.indexOf(original);
                if (origIdx >= 0 && typeof (canvasInstance as any).moveTo === 'function') {
                    (canvasInstance as any).moveTo(cloned, origIdx + 1);
                }
            }

            // FIGMA/CANVA BEHAVIOR: original stays in place, CLONE follows mouse.
            // Swap Fabric's internal transform target from original → clone.
            const tr: any = (canvasInstance as any)._currentTransform;
            let didSwapTransform = false;
            if (tr) {
                const parentGroup2 = (original as any)?.group;
                const shouldSwap = isTransformRelatedToSource(original, tr.target)
                    || (isInsideGroup && parentGroup2 && tr.target === parentGroup2)
                    || tr.target === original;

                if (shouldSwap) {
                    tr.target = cloned;
                    if (tr.original && typeof tr.original === 'object') {
                        tr.original.left = cloned.left;
                        tr.original.top = cloned.top;
                    }
                    didSwapTransform = true;
                }
            }

            // Ensure original is still pinned (was locked before doClone, reinforce here)
            original.set({ left: origLeft, top: origTop });
            original.setCoords?.();

            // Select the clone (it follows the mouse)
            canvasInstance.setActiveObject(cloned);

            state.clone = cloned;
            state.didDuplicate = true;
            state.manualFollowClone = !didSwapTransform;

            // Always align clone to the current pointer delta on the first frame.
            syncCloneToPointerDelta();

            if (didSwapTransform) {
                const tr2: any = (canvasInstance as any)?._currentTransform;
                if (tr2?.original && typeof tr2.original === 'object') {
                    tr2.original.left = cloned.left;
                    tr2.original.top = cloned.top;
                }
            }
            state.cloning = false;

            deps.safeRequestRenderAll();
        };

        doClone();
    };
    canvasInstance.on('mouse:move:before', onMouseMoveBefore);

    const onMouseUp = () => {
        if (!state.didDuplicate || !canvasInstance) {
            state.activeCloneRequestId = 0;
            restoreOriginalLocks(state.original);
            state.armed = false;
            state.cloning = false;
            state.didDuplicate = false;
            state.manualFollowClone = false;
            state.original = null;
            state.clone = null;
            state.pointerDownX = 0;
            state.pointerDownY = 0;
            return;
        }

        const original = state.original;
        const clone = state.clone;
        const pg = state.parentGroup;

        // Unlock original (restore previous lock state)
        if (original) {
            restoreOriginalLocks(original);
        }

        // Clone is already in the correct parent (group or canvas). Just finalize.
        if (clone && pg) {
            pg.set('dirty', true);
            if (typeof pg.setCoords === 'function') pg.setCoords();
        }

        // Select the clone (the one the user just placed)
        if (clone) {
            clone.setCoords?.();
            if (pg) {
                pg.set({ subTargetCheck: true, interactive: true });
            }
            canvasInstance.setActiveObject(clone);
        }

        deps.safeRequestRenderAll();

        // Update objects list
        deps.refreshCanvasObjects();

        // Reset state
        state.activeCloneRequestId = 0;
        state.armed = false;
        state.cloning = false;
        state.didDuplicate = false;
        state.manualFollowClone = false;
        state.original = null;
        state.clone = null;
        state.parentGroup = null;
        state.cloneInGroup = false;
        state.pointerDownX = 0;
        state.pointerDownY = 0;

        deps.saveCurrentState();
    };
    canvasInstance.on('mouse:up', onMouseUp);

    const teardown = () => {
      try {
        canvasInstance.off('mouse:down', onMouseDown)
        canvasInstance.off('mouse:move:before', onMouseMoveBefore)
        canvasInstance.off('mouse:up', onMouseUp)
      } catch {
        // ignore
      }
    }
    teardownRef = teardown
  }

  const teardown = () => {
    if (teardownRef) { teardownRef(); teardownRef = null; }
  }

  return { setup, teardown }
}

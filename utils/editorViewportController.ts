export type EditorViewportContext = Record<string, any>

export const createEditorViewportController = (ctx: EditorViewportContext) => {
    const { addPenPoint, addPointAtSegment, buildPathStringFromPenData, canvas, canvasEl, currentEditingPath, currentMousePos, enterNodeEditing, enterPathNodeEditing, fabric, finishPenPath, flushViewportStateSave, flushZoneRelayoutOnDrop, focusProductZoneFromDblClickTarget, handleInteraction, isDrawing, isNodeEditing, isPenMode, isVectorPathClosed, penPathPoints, releaseDanglingCanvasTransform, safeRequestRenderAll, scheduleViewportCulling, scheduleViewportStateSave, selectedObjectRef, selectPathNode, throttledUpdateScrollbars, triggerRef, updateFloatingUI, updateHandleLines, updatePenPreview, updateZoomState } = ctx

const setupZoomPan = () => {
    if (!canvas.value) return;
    if ((canvas.value as any).__zoomPanSetupDone) return;
    (canvas.value as any).__zoomPanSetupDone = true;

    // Helper to get pointer position from event (local to setupZoomPan)
    // Uses the same logic as Fabric.js internally - corrected calculation
    const getPointerFromEvent = (e: MouseEvent | any) => {
        if (!canvas.value) return { x: 0, y: 0 };

        // Try to get canvas element from canvas instance
        const canvasElement = canvasEl.value || canvas.value.getElement();
        if (!canvasElement) return { x: 0, y: 0 };

        const rect = canvasElement.getBoundingClientRect();
        const vpt = canvas.value.viewportTransform || [1, 0, 0, 1, 0, 0];
        const zoom = canvas.value.getZoom() || 1;

        // Get mouse position relative to canvas element (in pixels)
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        // Transform to canvas coordinates using Fabric.js transform logic
        // The viewport transform matrix is: [zoom, 0, 0, zoom, translateX, translateY]
        // vpt[4] = translateX (pan X), vpt[5] = translateY (pan Y)
        //
        // IMPORTANT: The viewport transform applies: newX = (oldX * zoom) + translateX
        // So to reverse: oldX = (newX - translateX) / zoom
        // But we need to account for the fact that vpt[4] and vpt[5] are already in screen space
        const canvasX = (pointerX - vpt[4]) / zoom;
        const canvasY = (pointerY - vpt[5]) / zoom;

        return { x: canvasX, y: canvasY };
    };

    // Wheel Zoom & Pan (coalesced in RAF to avoid stutter on trackpads/high-frequency wheels)
    let wheelRafPending = false;
    let wheelAccumZoomDelta = 0;
    let wheelAccumPanX = 0;
    let wheelAccumPanY = 0;
    let wheelZoomPoint = { x: 0, y: 0 };
    let wheelMode: 'none' | 'zoom' | 'pan' = 'none';

    const flushWheel = () => {
        wheelRafPending = false;
        if (!canvas.value) return;

        if (wheelMode === 'zoom') {
            let zoom = canvas.value.getZoom();
            // Apply the accumulated delta only once per frame for smoother zoom.
            zoom *= 0.999 ** wheelAccumZoomDelta;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            canvas.value.zoomToPoint(wheelZoomPoint, zoom);
            updateZoomState();
            safeRequestRenderAll();
            updateFloatingUI();
            scheduleViewportCulling('wheel-zoom');
            scheduleViewportStateSave('wheel-zoom');
        } else if (wheelMode === 'pan') {
            const vpt = canvas.value.viewportTransform;
            if (vpt) {
                vpt[4] += wheelAccumPanX;
                vpt[5] += wheelAccumPanY;
                safeRequestRenderAll();
                updateFloatingUI();
                throttledUpdateScrollbars();
                scheduleViewportCulling('wheel-pan');
                scheduleViewportStateSave('wheel-pan');
            }
        }

        wheelAccumZoomDelta = 0;
        wheelAccumPanX = 0;
        wheelAccumPanY = 0;
        wheelMode = 'none';
    };

    const scheduleWheelFlush = () => {
        if (wheelRafPending) return;
        wheelRafPending = true;
        requestAnimationFrame(flushWheel);
    };

    canvas.value.on('mouse:wheel', (opt: any) => {
        const evt = opt.e;
        if (!evt) return;
        const deltaY = Number(evt.deltaY || 0);
        const deltaX = Number(evt.deltaX || 0);

        // Ctrl/Cmd + Wheel to ZOOM
        if (evt.ctrlKey || evt.metaKey) {
            wheelMode = 'zoom';
            wheelAccumZoomDelta += deltaY;
            wheelZoomPoint = { x: Number(evt.offsetX || 0), y: Number(evt.offsetY || 0) };
        } else {
            wheelMode = 'pan';
            // Vertical pan by default
            wheelAccumPanY -= deltaY;
            // Horizontal pan with shift or native deltaX
            if (evt.shiftKey || deltaX !== 0) {
                wheelAccumPanX -= (deltaX || deltaY);
            }
        }

        scheduleWheelFlush();
        evt.preventDefault();
        evt.stopPropagation();
    });

    // Touch Gesture (tablet): two-finger pinch to zoom + pan viewport.
    // Keep one-finger interaction untouched so object selection/editing keeps working.
    let isTouchGestureActive = false;
    let touchStartDistance = 0;
    let touchStartZoom = 1;
    let touchLastCenter = { x: 0, y: 0 };
    let touchPrevSkipTargetFind: boolean | null = null;
    let touchPrevSelection: boolean | null = null;
    let touchRafPending = false;
    let touchPendingCenter: { x: number; y: number } | null = null;
    let touchPendingDistance = 0;
    let touchTapStartAt = 0;
    let touchTapStartX = 0;
    let touchTapStartY = 0;
    let touchTapMoved = false;
    let lastSingleTapAt = 0;
    let lastSingleTapX = 0;
    let lastSingleTapY = 0;
    const TOUCH_TAP_MAX_MOVEMENT = 16;
    const TOUCH_DBL_TAP_MS = 360;
    const TOUCH_DBL_TAP_MAX_GAP = 36;

    const clampZoom = (value: number) => {
        if (value > 20) return 20;
        if (value < 0.01) return 0.01;
        return value;
    };

    const getTouchCenter = (touches: TouchList) => {
        const t1 = touches[0];
        const t2 = touches[1];
        if (!t1 || !t2) {
            return { x: 0, y: 0 };
        }
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    };

    const getTouchDistance = (touches: TouchList) => {
        const t1 = touches[0];
        const t2 = touches[1];
        if (!t1 || !t2) return 1;
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        return Math.hypot(dx, dy);
    };

    const centerToCanvasPoint = (clientX: number, clientY: number) => {
        const canvasElement = canvasEl.value || canvas.value?.getElement?.();
        if (!canvasElement) return { x: 0, y: 0 };
        const rect = canvasElement.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const beginTouchGesture = (touches: TouchList) => {
        if (!canvas.value || touches.length < 2) return;
        isTouchGestureActive = true;
        touchStartDistance = Math.max(1, getTouchDistance(touches));
        touchStartZoom = canvas.value.getZoom() || 1;
        touchLastCenter = getTouchCenter(touches);
        touchPendingCenter = touchLastCenter;
        touchPendingDistance = touchStartDistance;

        // Performance: while multi-touching, we don't need Fabric hit-tests.
        if (touchPrevSkipTargetFind === null) touchPrevSkipTargetFind = !!canvas.value.skipTargetFind;
        if (touchPrevSelection === null) touchPrevSelection = !!canvas.value.selection;
        canvas.value.skipTargetFind = true;
        canvas.value.selection = false;
    };

    const endTouchGesture = () => {
        isTouchGestureActive = false;
        touchStartDistance = 0;
        touchPendingCenter = null;
        touchPendingDistance = 0;
        // Restore Fabric hit-test flags.
        if (canvas.value) {
            if (touchPrevSkipTargetFind !== null) canvas.value.skipTargetFind = touchPrevSkipTargetFind;
            if (touchPrevSelection !== null) canvas.value.selection = touchPrevSelection;
        }
        touchPrevSkipTargetFind = null;
        touchPrevSelection = null;
    };

    const fireSyntheticDblClickFromTouch = (evt: TouchEvent) => {
        if (!canvas.value) return;
        const now = Date.now();
        if (now - ctx.getLastDomDblClickAt() < 220) return;
        ctx.setLastDomDblClickAt(now);

        const touch = evt.changedTouches?.[0] || evt.touches?.[0];
        if (!touch) return;

        let syntheticMouseEvent: any = null;
        try {
            syntheticMouseEvent = new MouseEvent('dblclick', {
                bubbles: true,
                cancelable: true,
                clientX: touch.clientX,
                clientY: touch.clientY,
                screenX: touch.screenX,
                screenY: touch.screenY,
                ctrlKey: evt.ctrlKey,
                shiftKey: evt.shiftKey,
                altKey: evt.altKey,
                metaKey: evt.metaKey
            });
        } catch {
            syntheticMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                screenX: touch.screenX,
                screenY: touch.screenY,
                ctrlKey: evt.ctrlKey,
                shiftKey: evt.shiftKey,
                altKey: evt.altKey,
                metaKey: evt.metaKey,
                target: evt.target
            };
        }

        const c: any = canvas.value as any;
        let info: any = null;
        try {
            info = (typeof c.findTarget === 'function') ? c.findTarget(syntheticMouseEvent) : null;
        } catch {
            info = null;
        }
        const target = info?.target ?? info ?? null;
        try {
            c.fire?.('mouse:dblclick', { e: syntheticMouseEvent, originalEvent: evt, target });
        } catch {
            // ignore
        }
    };

    if (canvas.value?.upperCanvasEl && !ctx.getDomCanvasTouchStartHandler()) {
        const flushTouchGesture = () => {
            touchRafPending = false;
            if (!canvas.value || !isTouchGestureActive || !touchPendingCenter) return;

            const currentCenter = touchPendingCenter;
            const currentDistance = Math.max(1, touchPendingDistance || 1);
            const scaleFactor = currentDistance / Math.max(1, touchStartDistance);
            const nextZoom = clampZoom(touchStartZoom * scaleFactor);

            const centerPoint = centerToCanvasPoint(currentCenter.x, currentCenter.y);
            canvas.value.zoomToPoint(centerPoint as any, nextZoom);

            const vpt = canvas.value.viewportTransform;
            if (vpt) {
                vpt[4] += currentCenter.x - touchLastCenter.x;
                vpt[5] += currentCenter.y - touchLastCenter.y;
            }

            touchLastCenter = currentCenter;
            updateZoomState();
            safeRequestRenderAll();
            updateFloatingUI();
            throttledUpdateScrollbars();
            scheduleViewportCulling('touch-gesture');
            scheduleViewportStateSave('touch-gesture');
        };

        const scheduleTouchFlush = () => {
            if (touchRafPending) return;
            touchRafPending = true;
            requestAnimationFrame(flushTouchGesture);
        };

        const nextDomCanvasTouchStartHandler = (evt: TouchEvent) => {
            if (!canvas.value) return;
            if (evt.touches.length === 1 && !isTouchGestureActive) {
                const t = evt.touches[0];
                if (t) {
                    touchTapStartAt = Date.now();
                    touchTapStartX = t.clientX;
                    touchTapStartY = t.clientY;
                    touchTapMoved = false;
                }
                return;
            }
            if (evt.touches.length < 2) return;
            touchTapStartAt = 0;
            touchTapMoved = true;
            beginTouchGesture(evt.touches);
            evt.preventDefault();
            evt.stopPropagation();
        };

        const nextDomCanvasTouchMoveHandler = (evt: TouchEvent) => {
            if (!canvas.value) return;
            if (evt.touches.length === 1 && !isTouchGestureActive) {
                const t = evt.touches[0];
                if (t && touchTapStartAt > 0) {
                    const move = Math.hypot(t.clientX - touchTapStartX, t.clientY - touchTapStartY);
                    if (move > TOUCH_TAP_MAX_MOVEMENT) touchTapMoved = true;
                }
                return;
            }
            if (evt.touches.length < 2) return;

            if (!isTouchGestureActive) {
                beginTouchGesture(evt.touches);
            }

            // Coalesce high-frequency touch events into a single RAF update (much smoother on tablets).
            touchPendingCenter = getTouchCenter(evt.touches);
            touchPendingDistance = Math.max(1, getTouchDistance(evt.touches));
            scheduleTouchFlush();

            evt.preventDefault();
            evt.stopPropagation();
        };

        const nextDomCanvasTouchEndHandler = (evt: TouchEvent) => {
            if (evt.touches.length < 2) {
                endTouchGesture();
                flushViewportStateSave('touch-gesture-end');
            }

            // Tablet fallback: convert double-tap into Fabric `mouse:dblclick`.
            if (isTouchGestureActive) return;
            const changed = evt.changedTouches?.[0];
            if (!changed) {
                touchTapStartAt = 0;
                return;
            }

            const now = Date.now();
            const tapDuration = touchTapStartAt > 0 ? (now - touchTapStartAt) : Number.POSITIVE_INFINITY;
            const endMove = touchTapStartAt > 0
                ? Math.hypot(changed.clientX - touchTapStartX, changed.clientY - touchTapStartY)
                : Number.POSITIVE_INFINITY;
            const isQuickTap = tapDuration <= 320 && endMove <= TOUCH_TAP_MAX_MOVEMENT && !touchTapMoved;

            if (isQuickTap) {
                const gap = now - lastSingleTapAt;
                const distanceFromPrevTap = Math.hypot(changed.clientX - lastSingleTapX, changed.clientY - lastSingleTapY);
                if (gap > 0 && gap <= TOUCH_DBL_TAP_MS && distanceFromPrevTap <= TOUCH_DBL_TAP_MAX_GAP) {
                    fireSyntheticDblClickFromTouch(evt);
                    lastSingleTapAt = 0;
                    lastSingleTapX = 0;
                    lastSingleTapY = 0;
                } else {
                    lastSingleTapAt = now;
                    lastSingleTapX = changed.clientX;
                    lastSingleTapY = changed.clientY;
                }
            } else if (tapDuration <= 0 || tapDuration > 1200) {
                lastSingleTapAt = 0;
                lastSingleTapX = 0;
                lastSingleTapY = 0;
            }

            touchTapStartAt = 0;
            touchTapMoved = false;
        };

        const nextDomCanvasTouchCancelHandler = () => {
            endTouchGesture();
        };

        ctx.setDomCanvasTouchStartHandler(nextDomCanvasTouchStartHandler)
        ctx.setDomCanvasTouchMoveHandler(nextDomCanvasTouchMoveHandler)
        ctx.setDomCanvasTouchEndHandler(nextDomCanvasTouchEndHandler)
        ctx.setDomCanvasTouchCancelHandler(nextDomCanvasTouchCancelHandler)
        canvas.value.upperCanvasEl.addEventListener('touchstart', nextDomCanvasTouchStartHandler, { passive: false });
        canvas.value.upperCanvasEl.addEventListener('touchmove', nextDomCanvasTouchMoveHandler as EventListener, { passive: false });
        canvas.value.upperCanvasEl.addEventListener('touchend', nextDomCanvasTouchEndHandler, { passive: true });
        canvas.value.upperCanvasEl.addEventListener('touchcancel', nextDomCanvasTouchCancelHandler, { passive: true });
    }

    // Middle Click Pan / Space Pan logic often handled by keydown space
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;
    let panDxPending = 0;
    let panDyPending = 0;
    let panRafPending = false;
    let panPrevSelection: boolean | null = null;
    let panPrevSkipTargetFind: boolean | null = null;
    const restorePanInteractionFlags = () => {
        if (!canvas.value) {
            panPrevSelection = null;
            panPrevSkipTargetFind = null;
            return;
        }
        if (panPrevSelection !== null) {
            canvas.value.selection = panPrevSelection;
        } else {
            canvas.value.selection = true;
        }
        if (panPrevSkipTargetFind !== null) {
            canvas.value.skipTargetFind = panPrevSkipTargetFind;
        } else {
            canvas.value.skipTargetFind = false;
        }
        panPrevSelection = null;
        panPrevSkipTargetFind = null;
    };
    const flushPan = () => {
        if (!canvas.value || !canvas.value.viewportTransform) return;
        if (panDxPending !== 0 || panDyPending !== 0) {
            // Fabric 7 recalculates the active object's cached control coordinates in this setter.
            const nextViewportTransform = [...canvas.value.viewportTransform];
            nextViewportTransform[4] += panDxPending;
            nextViewportTransform[5] += panDyPending;
            canvas.value.setViewportTransform(nextViewportTransform);
            panDxPending = 0;
            panDyPending = 0;
        }
        safeRequestRenderAll();
        throttledUpdateScrollbars();
        scheduleViewportCulling('pan-drag');
        scheduleViewportStateSave('pan-drag');
    };
    const schedulePanFlush = () => {
        if (panRafPending) return;
        panRafPending = true;
        requestAnimationFrame(() => {
            panRafPending = false;
            flushPan();
        });
    };

    canvas.value.on('mouse:down', (opt: any) => {
        const evt = opt.e;

        // Pan with middle mouse button OR Space + left click.
        if (
            (evt?.button === 1 || (evt?.button === 0 && ctx.getIsSpacePanPressed())) &&
            !isPenMode.value &&
            !isNodeEditing.value &&
            !isDrawing.value
        ) {
            isDragging = true;
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
            if (panPrevSelection === null) panPrevSelection = !!canvas.value.selection;
            if (panPrevSkipTargetFind === null) panPrevSkipTargetFind = !!canvas.value.skipTargetFind;
            canvas.value.selection = false;
            canvas.value.skipTargetFind = true;
            canvas.value.defaultCursor = 'grabbing';
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        // Handle node selection during path editing (before pen tool check)
        if (isNodeEditing.value && opt.target && opt.target.name === 'path_node') {
            const index = opt.target.data.index;
            const pathObj = opt.target.data.parentPath;
            if (pathObj) {
                selectPathNode(index, pathObj);
            }
            return;
        }

        // Handle adding point to segment during path editing
        if (isNodeEditing.value && !opt.target && currentEditingPath.value) {
            // Click on empty space - try to add point to nearest segment
            const pointer = opt.pointer || getPointerFromEvent(evt);
            if (pointer) {
                const pathObj = currentEditingPath.value;
                const pathData = pathObj.penPathData || [];

                // Find nearest segment (supports closed paths too)
                let minDist = Infinity;
                let nearestSegmentIndex = -1;
                const closed = isVectorPathClosed(pathObj);
                const segmentCount = closed ? pathData.length : (pathData.length - 1);

                for (let i = 0; i < segmentCount; i++) {
                    const p1 = pathData[i];
                    const p2 = pathData[(i + 1) % pathData.length];

                    // Calculate distance from point to line segment
                    const A = pointer.x - p1.x;
                    const B = pointer.y - p1.y;
                    const C = p2.x - p1.x;
                    const D = p2.y - p1.y;

                    const dot = A * C + B * D;
                    const lenSq = C * C + D * D;
                    let param = -1;

                    if (lenSq !== 0) param = dot / lenSq;

                    let xx, yy;
                    if (param < 0) {
                        xx = p1.x;
                        yy = p1.y;
                    } else if (param > 1) {
                        xx = p2.x;
                        yy = p2.y;
                    } else {
                        xx = p1.x + param * C;
                        yy = p1.y + param * D;
                    }

                    const dx = pointer.x - xx;
                    const dy = pointer.y - yy;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < minDist && dist < 10) { // 10px threshold
                        minDist = dist;
                        nearestSegmentIndex = i;
                    }
                }

                if (nearestSegmentIndex >= 0) {
                    addPointAtSegment(pathObj, nearestSegmentIndex, pointer);
                    evt.preventDefault();
                    evt.stopPropagation();
                    return;
                }
            }
        }

        // Pen Tool Mode - Add point on click (works on frames and empty areas)
        if (isPenMode.value) {
            // Try multiple methods to get accurate pointer coordinates
            let pointer;

            // Method 1: Use Fabric's opt.pointer if available
            if (opt.pointer && typeof opt.pointer.x === 'number' && typeof opt.pointer.y === 'number') {
                pointer = opt.pointer;
            }
            // Method 2: Try Fabric's internal _getPointer method
            else if (typeof (canvas.value as any)._getPointer === 'function') {
                try {
                    pointer = (canvas.value as any)._getPointer(evt);
                } catch (e) {
                    // Fall through to manual calculation
                }
            }

            // Method 3: Fallback to manual calculation
            if (!pointer || typeof pointer.x !== 'number' || typeof pointer.y !== 'number') {
                const clickEvt = evt || opt.e || opt.originalEvent;
                if (!clickEvt || typeof clickEvt.clientX === 'undefined') return;
                pointer = getPointerFromEvent(clickEvt);
            }

            addPenPoint(pointer, evt.shiftKey); // Shift = bezier handles
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        // Double-click path to enter node editing
        if (opt.target && opt.target.isVectorPath && !isNodeEditing.value) {
            // Will be handled by mouse:dblclick
        }

        // Standard interaction handled by Fabric
    });

    // Pen Tool: Track mouse movement for preview line - REAL-TIME with RAF for smooth updates
    let rafPending = false;
    canvas.value.on('mouse:move', (opt: any) => {
        const evt = opt?.e;
        if (evt?.buttons === 0) {
            releaseDanglingCanvasTransform(evt);
        }

        if (isDragging) {
            if (!evt) return;
            if (evt.buttons === 0) {
                isDragging = false;
                restorePanInteractionFlags();
                canvas.value.defaultCursor = ctx.getIsSpacePanPressed() ? 'grab' : 'default';
                flushPan();
                flushViewportStateSave('pan-drag-end');
                return;
            }
            panDxPending += evt.clientX - lastPosX;
            panDyPending += evt.clientY - lastPosY;
            lastPosX = evt.clientX;
            lastPosY = evt.clientY;
            schedulePanFlush();
            return;
        }

        if (isPenMode.value && penPathPoints.value.length > 0) {
            // Get pointer coordinates - try multiple methods for maximum compatibility
            let pointer: {x: number, y: number} | null = null;

            // Method 1: Use Fabric's opt.pointer if available (most reliable - already transformed)
            if (opt.pointer && typeof opt.pointer.x === 'number' && typeof opt.pointer.y === 'number') {
                pointer = { x: opt.pointer.x, y: opt.pointer.y };
            }
            // Method 2: Try Fabric's internal _getPointer method (if available in this version)
            else if (typeof (canvas.value as any)._getPointer === 'function') {
                const evt = opt.e || opt.originalEvent;
                if (evt) {
                    try {
                        const fabricPointer = (canvas.value as any)._getPointer(evt);
                        if (fabricPointer && typeof fabricPointer.x === 'number' && typeof fabricPointer.y === 'number') {
                            pointer = { x: fabricPointer.x, y: fabricPointer.y };
                        }
                    } catch (e) {
                        // Fall through to manual calculation
                    }
                }
            }

            // Method 3: Fallback to manual calculation
            if (!pointer) {
                const evt = opt.e || opt.originalEvent;
                if (!evt || typeof evt.clientX === 'undefined') return;
                pointer = getPointerFromEvent(evt);
            }

            // Store the pointer coordinates
            if (pointer && typeof pointer.x === 'number' && typeof pointer.y === 'number') {
                currentMousePos.value = pointer;

                // Use requestAnimationFrame for smooth updates without blocking
                if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(() => {
                        updatePenPreview();
                        rafPending = false;
                    });
                }
            }
        }
    });

    // Clear mouse position when mouse leaves canvas in pen mode
    canvas.value.on('mouse:out', () => {
        if (isPenMode.value) {
            currentMousePos.value = null;
            updatePenPreview();
        }
    });

    // Removed manual drag logic for gridZone as it conflicted with default behavior

    canvas.value.on('mouse:dblclick', (opt: any) => {
        if (opt.target) {
            // Product zone double-click is for editing zone settings only.
            // Import is intentionally kept behind explicit buttons to avoid accidental modals.
            if (focusProductZoneFromDblClickTarget(opt.target)) {
                return;
            } else if (opt.target.type === 'polygon' || opt.target.type === 'polyline') {
                enterNodeEditing(opt.target);
            } else if (opt.target.isVectorPath) {
                // Enter node editing for vector paths
                enterPathNodeEditing(opt.target);
            }
        } else if (isPenMode.value && penPathPoints.value.length >= 2) {
            // Double-click empty space in pen mode = finish path
            finishPenPath();
        }
    });


    // Node Moving Logic
    // Real-time path update throttling (scoped to setupZoomPan)
    let pathUpdateRaf: number | null = null;

    canvas.value.on('object:moving', (e: any) => {
        // Handle polygon/polyline control points
        if (isNodeEditing.value && e.target.name === 'control_point') {
             const p = e.target;
             const parent = p.data.parentObj;
             const index = p.data.index;

             // Inverse transform canvas point to polygon local point
             const matrix = parent.calcTransformMatrix();
             const invertMatrix = fabric.util.invertTransform(matrix);
             const localPoint = fabric.util.transformPoint({ x: p.left, y: p.top }, invertMatrix);

             // Update the specific point in the array
             const finalX = localPoint.x + parent.pathOffset.x;
             const finalY = localPoint.y + parent.pathOffset.y;

             parent.points[index] = { x: finalX, y: finalY };

             // Workaround: We wait until 'mouse:up' to commit changes to avoid heavy re-render loop
        }
        // Handle vector path nodes and handles - REAL-TIME UPDATE
        else if (isNodeEditing.value && (e.target.name === 'path_node' || e.target.name === 'bezier_handle')) {
            const target = e.target;
            const parentPath = target.data.parentPath;

            if (parentPath && parentPath.isVectorPath) {
                // Auto-mirror handles if moving a handle (Figma behavior - only if Alt is NOT pressed)
                // Alt key allows independent handle movement
                if (target.name === 'bezier_handle' && target.data.type && !e.e.altKey) {
                    const handleType = target.data.type;
                    const nodeIndex = target.data.index;

                    // Get the node and both handles
                    const vpt = canvas.value.viewportTransform;
                    const zoom = canvas.value.getZoom();

                    // FIX: Single getObjects() call with combined filter instead of two separate calls
                    const allPathObjects = canvas.value.getObjects().filter((o: any) =>
                        (o.name === 'path_node' || o.name === 'bezier_handle') && o.data.parentPath === parentPath && o.data.index === nodeIndex
                    );
                    const nodes = allPathObjects.filter((o: any) => o.name === 'path_node');
                    const handles = allPathObjects.filter((o: any) => o.name === 'bezier_handle');

                    if (nodes.length > 0 && handles.length >= 2) {
                        const node = nodes[0];
                        const handleIn = handles.find((h: any) => h.data.type === 'handle_in');
                        const handleOut = handles.find((h: any) => h.data.type === 'handle_out');

                        if (handleIn && handleOut && node) {
                            const nodeX = (node.left - vpt[4]) / zoom;
                            const nodeY = (node.top - vpt[5]) / zoom;

                            // Calculate distance from node to moved handle
                            const movedHandleX = (target.left - vpt[4]) / zoom;
                            const movedHandleY = (target.top - vpt[5]) / zoom;

                            const dx = movedHandleX - nodeX;
                            const dy = movedHandleY - nodeY;
                            const distance = Math.sqrt(dx * dx + dy * dy);

                            if (distance > 0) {
                                // Mirror the opposite handle (symmetric)
                                if (handleType === 'handle_in') {
                                    // Moving in handle - mirror out handle
                                    handleOut.set({
                                        left: (nodeX - dx) * zoom + vpt[4],
                                        top: (nodeY - dy) * zoom + vpt[5]
                                    });
                                } else {
                                    // Moving out handle - mirror in handle
                                    handleIn.set({
                                        left: (nodeX - dx) * zoom + vpt[4],
                                        top: (nodeY - dy) * zoom + vpt[5]
                                    });
                                }
                            }
                        }
                    }
                }

                // Throttle updates using requestAnimationFrame
                if (pathUpdateRaf !== null) {
                    cancelAnimationFrame(pathUpdateRaf);
                }

                pathUpdateRaf = requestAnimationFrame(() => {
                    // Update path in real-time (skip save during movement)
                    updatePathFromNodes(parentPath, true);
                    // Update handle lines visually
                    updateHandleLines(parentPath);
                    pathUpdateRaf = null;
                });
            }
        } else {
             handleInteraction();
        }
    });

	    canvas.value.on('mouse:up', (opt: any) => {
        if (isDragging) {
            isDragging = false;
            restorePanInteractionFlags();
            canvas.value.defaultCursor = ctx.getIsSpacePanPressed() ? 'grab' : 'default';
            flushPan();
            flushViewportStateSave('pan-drag-end');
            return;
        }

        // Commit Node Changes for polygons/polylines
        if (isNodeEditing.value) {
             const controls = canvas.value.getObjects().filter((o: any) => o.name === 'control_point');
	             if(controls.length > 0) {
	                 const parent = controls[0].data.parentObj;
	                 // Trigger update
	                 parent.set({ points: parent.points });
	                 // Fabric often needs _calcDimensions or similar
	                 parent._calcDimensions();
	                 parent.setCoords();
	                 safeRequestRenderAll();
	             }
	        }

        // Commit Path Node Changes (final save)
        if (isNodeEditing.value) {
            const pathNodes = canvas.value.getObjects().filter((o: any) => o.name === 'path_node' || o.name === 'bezier_handle');
            if (pathNodes.length > 0) {
                const parentPath = pathNodes[0].data.parentPath;
                if (parentPath && parentPath.isVectorPath) {
                    // Rebuild path from updated nodes and save state
                    updatePathFromNodes(parentPath, false);
                }
            }
        }

	        // Remove direct guide access here as they are scoped to setupSnapping
	        // verticalGuide.set({ visible: false });
	        // horizontalGuide.set({ visible: false });

	        flushZoneRelayoutOnDrop();
	        safeRequestRenderAll();

        // Also ensure reactivity properties update on drop
        if (selectedObjectRef.value) {
             triggerRef(selectedObjectRef);
        }
    });

    // Update path from edited nodes
    const updatePathFromNodes = (pathObj: any, skipSave = false) => {
        const vpt = canvas.value.viewportTransform;
        const zoom = canvas.value.getZoom();

        const pathNodes = canvas.value.getObjects()
            .filter((o: any) => o.name === 'path_node' && o.data.parentPath === pathObj)
            .sort((a: any, b: any) => a.data.index - b.data.index);

        const handles = canvas.value.getObjects()
            .filter((o: any) => o.name === 'bezier_handle' && o.data.parentPath === pathObj);

        // Rebuild path data
        const updatedPathData = pathNodes.map((node: any) => {
            const localX = (node.left - vpt[4]) / zoom;
            const localY = (node.top - vpt[5]) / zoom;

            const handleIn = handles.find((h: any) => h.data.index === node.data.index && h.data.type === 'handle_in');
            const handleOut = handles.find((h: any) => h.data.index === node.data.index && h.data.type === 'handle_out');

            const point: any = { x: localX, y: localY };

            if (handleIn || handleOut) {
                point.handles = {};
                if (handleIn) {
                    point.handles.in = {
                        x: (handleIn.left - vpt[4]) / zoom,
                        y: (handleIn.top - vpt[5]) / zoom
                    };
                }
                if (handleOut) {
                    point.handles.out = {
                        x: (handleOut.left - vpt[4]) / zoom,
                        y: (handleOut.top - vpt[5]) / zoom
                    };
                }
            }

            return point;
        });

        const closed = isVectorPathClosed(pathObj) && updatedPathData.length > 2;
        const pathString = buildPathStringFromPenData(updatedPathData, closed);
        if (!pathString) return;

        // Update path
        pathObj.set('path', fabric.util.parsePath(pathString));
        pathObj.penPathData = updatedPathData;
        pathObj.isClosedPath = closed;
        pathObj.setCoords();
        safeRequestRenderAll();

        // Only save state if not skipping (skip during real-time updates)
        if (!skipSave) {
            ctx.getSaveCurrentState()();
        }
    }
}

    return {
        setupZoomPan
    }
}

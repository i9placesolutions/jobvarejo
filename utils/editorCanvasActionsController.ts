type ArrangeMode = any

export type EditorCanvasActionsContext = Record<string, any>

export const createEditorCanvasActionsController = (ctx: EditorCanvasActionsContext) => {
    const { CANVAS_CUSTOM_PROPS, CLIPBOARD_CLONE_PROPS, DUPLICATE_OFFSET, FRAME_SPAWN_GAP, INSPECTOR_TRANSFORM_PROPS, TEXT_OBJECT_STYLE_PROPS, TEXT_SELECTION_STYLE_PROPS, $fetch, addText, aiStudio, alignSelectionHorizontally, alignSelectionVertically, applyCardFrameBinding, applyContainmentConstraints, applyDynamicBusinessTextCase, applyObjectMaskFromSelection, applyObjectMaskFromSingleTarget, applyRectCornerRadiiPatch, applySelectionTextStyle, applyStickerOutlinePatch, applyText3DGoldPreset, applyTextGradientPreset, applyVisibleSelectionChrome, arrangeActiveObjects, autoTrimFabricImageAsync, bindPastedRootsToSelectedFrame, buildRemoveBgRequest, buildZoneSelectionConfig, cancelPendingCoalescedSave, canvas, centerSelectionInContainer, clampCornerRadii, clearObjectMaskFromObject, clearText3DEffect, closePath, collectObjectsDeep, computeCentersBoundingCenter, convertPointToCorner, convertPointToSmooth, convertStaticTextToIText, currentEditingPath, debouncedSaveCurrentState, deleteActiveSelectionFromCanvas, duplicateActiveObjectWithContext, duplicateProductZoneWithCards, editorClipboardSummary, enlivenObjectsAsync, ensureObjectPersistentId, ensureZoneSanity, enterPathNodeEditing, exitNodeEditing, exportSelectedObject, fabric, figmaCrop, finalizeDuplicatedObjects, findImageTargetInSelection, findObjectByCustomId, fitDynamicBusinessTextObject, flushPersistenceNow, flushPropertySave, getActiveProjectPageId, getAllFrames, getApiAuthHeaders, getCenterOfView, getFrameBounds, getObjectAbsoluteCenter, getOrCreateFrameClipRect, getResolvedZoneFrameId, getSelectedClipboardTargetFrame, getZoneChildren, getZoneGlobalStyles, getZoneMetrics, getZoneRect, groupLocalToCanvasPoint, groupSelection, guessAiSizeFromObject, handleProductImageDuplicate, handleZoom100, handleZoomIn, handleZoomOut, hasObjectMaskApplied, imageHasTransparency, insertObjectIntoGroupWithoutRelayout, invalidateContainmentZoneCache, invalidateScrollbarBounds, invalidateStickerOutlineCache, isActiveSelectionObject, isDrawing, isDynamicBusinessFieldObject, isEditorClipboardPasteShortcut, isHistoryProcessing, isLikelyProductCard, isLikelyProductZone, isNodeEditing, isPenMode, isQuickLogoImageObject, isQuickModeLockedObject, isTextLikeObject, isTextStyleObject, isTransientCanvasObject, makeCanvasObjectId, makeId, markInspectorTransformAsManual, markPriceGroupAsManuallyCustomized, markProductImageTrimmed, maybeReparentToFrameOnDrop, mirrorHandles, moveFrameDescendants, moveZoneChildren, normalizeProductCardIdentity, normalizeZoneScale, notifyEditorError, notifyEditorInfo, openLocalProductImagePicker, openProductImageUploadPickerModal, openProductReviewForZone, productZoneState, project, reapplyRuntimeVisualPatchesTree, recalculateZoneLayout, redo, refreshCanvasObjects, refreshSelectedRef, regenerateCustomIdsRecursive, remapOrClearBindingsRecursive, removePathPoint, resetHandles, resizePage, resolveActiveTextObjectForInspectorAction, resolveEditorClipboardPastePlacement, resolveEditorPasteSource, resolveInspectorSnapshotTarget, resolveRelatedImportZones, resolveSelectedProductCardContext, resolveSelectedProductImageActionContext, runEditorClipboardCommand, safeAddWithUpdate, safeRequestRenderAll, saveCurrentState, scheduleViewportStateSave, selectedObjectRef, selectedPathNodeIndex, setTool, simplifyPath, smoothHandles, snapshotForPropertiesPanel, splitPath, stabilizePriceGroupsForPersistence, syncCardProductDataTitleWidthFromTarget, syncFrameClips, syncObjectFrameClip, syncQuickLogoBackdrop, syncTemplatePageMetadataForFormat, syncZoneCardFrameBindings, syncZoneDerivedMetadata, targetGridZone, targetGridZones, throttledUpdateScrollbars, toWasabiProxyUrl, toggleFill, togglePenMode, toggleStroke, trimContainerEmptySpace, undo, ungroupSelection, updatePriceGroupManualScaleOverride, updateSelection, wrapperEl, zoomToFit } = ctx

const duplicateFrameWithContents = async (frame: any, opts: { offset?: number } = {}) => {
    if (!canvas.value || !frame) return null;
    const frameLayerName = String((frame as any)?.layerName || '').trim().toUpperCase();
    const frameName = String((frame as any)?.name || '').trim();
    const isRootFrameLike = !!(frame as any)?.isFrame ||
        frameLayerName === 'FRAMER' ||
        frameLayerName === 'FRAME' ||
        /^FRAME(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(frameName) ||
        /^FRAMER(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(frameName);
    if (!isRootFrameLike) return null;
    if (!(frame as any)._customId) (frame as any)._customId = makeCanvasObjectId();
    const rootId = String((frame as any)._customId || '');
    if (!rootId) return null;
    const sourceTargetZoneId = String((targetGridZone.value as any)?._customId || '').trim();

    const rootBounds = getFrameBounds(frame);
    const fallbackRootWidth = (Number((frame as any).width) || 0) * (Number((frame as any).scaleX) || 1);
    const rootWidth = Number(rootBounds?.width) || fallbackRootWidth || 1080;
    const gap = Number(opts.offset ?? FRAME_SPAWN_GAP) || FRAME_SPAWN_GAP;
    const rootCenter = typeof (frame as any).getCenterPoint === 'function'
        ? (frame as any).getCenterPoint()
        : { x: Number((frame as any).left) || 0, y: Number((frame as any).top) || 0 };
    const spawn = rootBounds
        ? {
            left: rootBounds.left + rootBounds.width + gap + rootWidth / 2,
            top: rootBounds.top + rootBounds.height / 2
        }
        : {
            left: (Number(rootCenter.x) || 0) + rootWidth + gap,
            top: Number(rootCenter.y) || 0
        };
    const offsetX = (Number(spawn.left) || 0) - (Number(rootCenter.x) || 0);
    const offsetY = (Number(spawn.top) || 0) - (Number(rootCenter.y) || 0);

    const all = canvas.value.getObjects();
    // Hard guard: guarantee stable IDs for legacy objects so duplication mapping never drops content.
    all.forEach((o: any) => {
        if (!o || o.excludeFromExport) return;
        if (!o._customId) o._customId = makeCanvasObjectId();
    });
    const indexById = new Map<string, number>();
    all.forEach((o: any, i: number) => {
        if (o?._customId) indexById.set(String(o._customId), i);
    });

    const isFrameContainerCandidate = (obj: any) => {
        if (!obj) return false;
        const layer = String(obj.layerName || '').trim().toUpperCase();
        const name = String(obj.name || '').trim();
        return !!obj.isFrame ||
            layer === 'FRAMER' ||
            layer === 'FRAME' ||
            /^FRAME(?:\s+\d+)?$/i.test(name) ||
            /^FRAMER(?:\s+\d+)?$/i.test(name);
    };

    const getFrameArea = (obj: any) => {
        const b = getFrameBounds(obj);
        if (!b) return Number.POSITIVE_INFINITY;
        return Math.max(1, Number(b.width || 0) * Number(b.height || 0));
    };

    const isObjectInsideOrOverlappingFrame = (candidate: any, container: any) => {
        if (!candidate || !container) return false;
        try {
            if (typeof candidate.getBoundingRect !== 'function' || typeof container.getBoundingRect !== 'function') return false;
            const objBounds = candidate.getBoundingRect(true);
            const frameBounds = container.getBoundingRect(true);
            if (!objBounds || !frameBounds) return false;
            const objArea = Math.max(1, Number(objBounds.width || 0) * Number(objBounds.height || 0));
            const ix = Math.max(0, Math.min(objBounds.left + objBounds.width, frameBounds.left + frameBounds.width) - Math.max(objBounds.left, frameBounds.left));
            const iy = Math.max(0, Math.min(objBounds.top + objBounds.height, frameBounds.top + frameBounds.height) - Math.max(objBounds.top, frameBounds.top));
            const overlapRatio = (ix * iy) / objArea;
            const center = typeof candidate.getCenterPoint === 'function'
                ? candidate.getCenterPoint()
                : { x: objBounds.left + objBounds.width / 2, y: objBounds.top + objBounds.height / 2 };
            const centerInside =
                center.x >= frameBounds.left &&
                center.x <= frameBounds.left + frameBounds.width &&
                center.y >= frameBounds.top &&
                center.y <= frameBounds.top + frameBounds.height;
            return overlapRatio >= 0.85 || (centerInside && overlapRatio >= 0.65);
        } catch {
            return false;
        }
    };

    const resolvedParentByOriginalId = new Map<string, string | undefined>();
    resolvedParentByOriginalId.set(rootId, undefined);
    const toDuplicateIds = new Set<string>([rootId]);
    const queue: string[] = [rootId];
    while (queue.length) {
        const parentId = queue.shift()!;
        all.forEach((o: any) => {
            if (!o || o.excludeFromExport) return;
            if (!o._customId) return;
            if (String((o as any).parentFrameId || '') !== parentId) return;
            const id = String(o._customId);
            if (toDuplicateIds.has(id)) return;
            toDuplicateIds.add(id);
            resolvedParentByOriginalId.set(id, parentId);
            if (isFrameContainerCandidate(o)) queue.push(id);
        });
    }

    // Fallback espacial: inclui objetos visualmente dentro do frame mesmo sem parentFrameId.
    // Isso cobre arquivos legacy onde vínculos não foram persistidos corretamente.
    let safety = 0;
    let changed = true;
    while (changed && safety++ < 20) {
        changed = false;
        const duplicatedFrames = all
            .filter((o: any) => {
                if (!o || !o._customId) return false;
                if (!toDuplicateIds.has(String(o._customId))) return false;
                return isFrameContainerCandidate(o);
            })
            .sort((a: any, b: any) => getFrameArea(a) - getFrameArea(b));

        if (!duplicatedFrames.length) break;

        all.forEach((candidate: any) => {
            if (!candidate || candidate.excludeFromExport || !candidate._customId) return;
            const candidateId = String(candidate._customId);
            if (toDuplicateIds.has(candidateId)) return;
            const existingParent = String((candidate as any).parentFrameId || '').trim();
            if (existingParent && !toDuplicateIds.has(existingParent)) return;

            let container: any = null;
            for (const f of duplicatedFrames) {
                if (f === candidate) continue;
                if (!isObjectInsideOrOverlappingFrame(candidate, f)) continue;
                container = f;
                break; // duplicatedFrames já está ordenado do menor para o maior
            }
            if (!container?._customId) return;

            toDuplicateIds.add(candidateId);
            changed = true;

            const resolvedParent = existingParent && toDuplicateIds.has(existingParent)
                ? existingParent
                : String(container._customId);
            resolvedParentByOriginalId.set(candidateId, resolvedParent || undefined);
        });
    }

    // Inclusao garantida das zonas: product zones precisam usar o retangulo
    // interno da zona, nao o bounding box do grupo. O grupo pode ser inflado por
    // labels/runtime state, fazendo a regra generica de overlap perder a zona.
    {
        const getZoneDuplicationBounds = (zone: any) => {
            try {
                const metrics = getZoneMetrics(zone);
                if (
                    metrics &&
                    Number.isFinite(metrics.left) &&
                    Number.isFinite(metrics.top) &&
                    Number.isFinite(metrics.width) &&
                    Number.isFinite(metrics.height) &&
                    metrics.width > 0 &&
                    metrics.height > 0
                ) {
                    return metrics;
                }
            } catch {
                // fallback below
            }
            try {
                const bounds = typeof zone?.getBoundingRect === 'function' ? zone.getBoundingRect(true) : null;
                if (
                    bounds &&
                    Number.isFinite(bounds.left) &&
                    Number.isFinite(bounds.top) &&
                    Number.isFinite(bounds.width) &&
                    Number.isFinite(bounds.height) &&
                    bounds.width > 0 &&
                    bounds.height > 0
                ) {
                    return {
                        left: bounds.left,
                        top: bounds.top,
                        width: bounds.width,
                        height: bounds.height,
                        centerX: bounds.left + bounds.width / 2,
                        centerY: bounds.top + bounds.height / 2
                    };
                }
            } catch {
                // malformed zone, ignore
            }
            return null;
        };

        const getZoneDuplicationFrameHit = (zone: any, frames: any[]) => {
            const zoneBounds = getZoneDuplicationBounds(zone);
            if (!zoneBounds) return null;
            const zoneArea = Math.max(1, Number(zoneBounds.width || 0) * Number(zoneBounds.height || 0));
            const centerX = Number(zoneBounds.centerX ?? (zoneBounds.left + zoneBounds.width / 2));
            const centerY = Number(zoneBounds.centerY ?? (zoneBounds.top + zoneBounds.height / 2));

            let best: { frame: any; overlapRatio: number } | null = null;
            for (const frame of frames) {
                const fb = getFrameBounds(frame) || (typeof frame?.getBoundingRect === 'function' ? frame.getBoundingRect(true) : null);
                if (!fb) continue;

                const centerInside =
                    centerX >= fb.left &&
                    centerX <= fb.left + fb.width &&
                    centerY >= fb.top &&
                    centerY <= fb.top + fb.height;
                if (centerInside) return frame;

                const ix = Math.max(0, Math.min(zoneBounds.left + zoneBounds.width, fb.left + fb.width) - Math.max(zoneBounds.left, fb.left));
                const iy = Math.max(0, Math.min(zoneBounds.top + zoneBounds.height, fb.top + fb.height) - Math.max(zoneBounds.top, fb.top));
                const overlapRatio = (ix * iy) / zoneArea;
                if (overlapRatio >= 0.2 && (!best || overlapRatio > best.overlapRatio)) {
                    best = { frame, overlapRatio };
                }
            }
            return best?.frame || null;
        };

        const isProductZoneDuplicationCandidate = (candidate: any) => {
            if (isLikelyProductZone(candidate)) return true;
            if (!candidate || String(candidate.type || '').toLowerCase() !== 'group') return false;
            if (typeof candidate.getObjects !== 'function') return false;
            const candidateId = String(candidate?._customId || '').trim();
            if (!candidateId) return false;
            const rect = getZoneRect(candidate);
            if (!rect || !Array.isArray((rect as any).strokeDashArray)) return false;
            return all.some((o: any) => (
                o &&
                o !== candidate &&
                (
                    String((o as any)?.parentZoneId || '').trim() === candidateId ||
                    String((o as any)?._zoneSlot?.zoneId || '').trim() === candidateId
                )
            ));
        };

        const duplicatedFrames = all.filter((o: any) =>
            o?._customId && toDuplicateIds.has(String(o._customId)) && isFrameContainerCandidate(o)
        );
        const duplicatedFrameIdsForZones = new Set(
            duplicatedFrames
                .map((o: any) => String(o._customId || '').trim())
                .filter(Boolean)
        );
        if (duplicatedFrames.length > 0) {
            all.forEach((candidate: any) => {
                if (!candidate || candidate.excludeFromExport || !candidate._customId) return;
                const candidateId = String(candidate._customId);
                if (toDuplicateIds.has(candidateId)) return;
                if (!isProductZoneDuplicationCandidate(candidate)) return;

                const candidateFrameId = String((candidate as any).parentFrameId || '').trim();
                let chosenFrameId: string | undefined;
                if (candidateFrameId && duplicatedFrameIdsForZones.has(candidateFrameId)) {
                    chosenFrameId = candidateFrameId;
                } else {
                    const hitFrame = getZoneDuplicationFrameHit(candidate, duplicatedFrames);
                    chosenFrameId = hitFrame ? String(hitFrame._customId || '').trim() || undefined : undefined;
                }
                if (!chosenFrameId) return;
                candidate.isProductZone = true;
                candidate.isGridZone = true;
                toDuplicateIds.add(candidateId);
                resolvedParentByOriginalId.set(candidateId, chosenFrameId);
                if (import.meta.dev) {
                    console.log('[duplicateFrameWithContents] zona incluida via fallback', {
                        zoneId: candidateId,
                        viaParentFrameId: !!candidateFrameId,
                        chosenFrameId
                    });
                }
            });
        }
    }

    // Product cards are top-level Fabric groups bound to the zone via parentZoneId/_zoneSlot,
    // not children of the zone group. Include every object bound to any duplicated zone even
    // if a legacy save lost parentFrameId or the spatial fallback misses it.
    let zoneBindingSafety = 0;
    let zoneBindingChanged = true;
    while (zoneBindingChanged && zoneBindingSafety++ < 10) {
        zoneBindingChanged = false;
        const duplicatedZoneIds = new Set(
            all
                .filter((o: any) => o?._customId && toDuplicateIds.has(String(o._customId)) && isLikelyProductZone(o))
                .map((o: any) => String(o._customId || '').trim())
                .filter(Boolean)
        );
        if (duplicatedZoneIds.size === 0) break;

        all.forEach((candidate: any) => {
            if (!candidate || candidate.excludeFromExport || !candidate._customId) return;
            const candidateId = String(candidate._customId);
            if (toDuplicateIds.has(candidateId)) return;

            const parentZoneId = String((candidate as any).parentZoneId || '').trim();
            const slotZoneId = String((candidate as any)?._zoneSlot?.zoneId || '').trim();
            const boundZoneId = parentZoneId && duplicatedZoneIds.has(parentZoneId)
                ? parentZoneId
                : (slotZoneId && duplicatedZoneIds.has(slotZoneId) ? slotZoneId : '');
            if (!boundZoneId) return;

            toDuplicateIds.add(candidateId);
            zoneBindingChanged = true;

            const existingParent = String((candidate as any).parentFrameId || '').trim();
            if (existingParent && toDuplicateIds.has(existingParent)) {
                resolvedParentByOriginalId.set(candidateId, existingParent);
                return;
            }

            const zone = all.find((o: any) => String(o?._customId || '').trim() === boundZoneId);
            const zoneFrameId = String((zone as any)?.parentFrameId || '').trim();
            resolvedParentByOriginalId.set(
                candidateId,
                zoneFrameId && toDuplicateIds.has(zoneFrameId) ? zoneFrameId : undefined
            );
        });
    }

    const originals = all
        .filter((o: any) => o?._customId && toDuplicateIds.has(String(o._customId)))
        .filter((o: any) => !!o && !o.excludeFromExport);
    originals.sort((a: any, b: any) => (indexById.get(String(a._customId)) ?? 0) - (indexById.get(String(b._customId)) ?? 0));
    if (import.meta.dev) console.log(`[duplicateFrameWithContents] root=${rootId} totalDuplicated=${originals.length} framesInSet=${originals.filter((o: any) => isFrameContainerCandidate(o)).length}`);

    if (!originals.length) return null;

    const insertBaseIndex = Math.max(...originals.map((o: any) => indexById.get(String(o._customId)) ?? -1)) + 1;
    const extraProps = Array.from(new Set([...CANVAS_CUSTOM_PROPS, 'data', 'opacity', 'flipX', 'flipY', 'filters', 'clipPath', 'src']));

    const oldToNewId = new Map<string, string>();
    const clones: any[] = [];
    let rootClone: any = null;
    const cloneJsonSafe = <T>(value: T): T => {
        if (value === null || value === undefined) return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            if (Array.isArray(value)) return ([...value] as unknown) as T;
            if (typeof value === 'object') return ({ ...(value as any) } as unknown) as T;
            return value;
        }
    };

    const assignNewDescendantIds = (root: any) => {
        if (!root || typeof root !== 'object' || typeof root.getObjects !== 'function') return;
        try {
            (root.getObjects() || []).forEach((child: any) => {
                if (!child || typeof child !== 'object') return;
                child._customId = makeId();
                assignNewDescendantIds(child);
            });
        } catch {
            // ignore malformed group children
        }
    };

    const preserveClonedPriceUnitState = (source: any, target: any) => {
        if (!source || !target) return;

        const collectPriceGroups = (root: any): any[] => {
            const groups: any[] = [];
            const visit = (node: any) => {
                if (!node || typeof node !== 'object') return;
                if (
                    String((node as any).type || '').toLowerCase() === 'group' &&
                    String((node as any).name || '') === 'priceGroup' &&
                    typeof (node as any).getObjects === 'function'
                ) {
                    groups.push(node);
                }
                if (typeof (node as any).getObjects === 'function') {
                    try {
                        ((node as any).getObjects() || []).forEach((child: any) => visit(child));
                    } catch {
                        // ignore malformed clone children
                    }
                }
            };
            visit(root);
            return groups;
        };

        const unitNames = new Set([
            'price_unit_text',
            'priceUnit',
            'price_unit',
            'price_header_unit_text',
            'retail_unit_text',
            'wholesale_unit_text'
        ]);
        const sourceGroups = collectPriceGroups(source);
        const targetGroups = collectPriceGroups(target);
        sourceGroups.forEach((sourceGroup: any, groupIndex: number) => {
            const targetGroup = targetGroups[groupIndex];
            if (!targetGroup) return;
            const sourceUnits = collectObjectsDeep(sourceGroup).filter((o: any) => unitNames.has(String(o?.name || '')));
            const targetUnits = collectObjectsDeep(targetGroup).filter((o: any) => unitNames.has(String(o?.name || '')));
            sourceUnits.forEach((sourceUnit: any, unitIndex: number) => {
                const targetUnit = targetUnits[unitIndex];
                if (!targetUnit || !isTextLikeObject(targetUnit)) return;
                const sourceText = typeof sourceUnit?.text === 'string' ? sourceUnit.text : '';
                targetUnit.set?.({
                    text: sourceText,
                    visible: sourceUnit?.visible !== false
                });
                targetUnit.visible = sourceUnit?.visible !== false;
                targetUnit.initDimensions?.();
                targetUnit.setCoords?.();
            });
            targetGroup.dirty = true;
            targetGroup.setCoords?.();
        });
    };

    // Clone everything first (preserve z-order), then fix parentFrameId references.
    for (let i = 0; i < originals.length; i++) {
        const original = originals[i];
        let cloned: any = null;
        try {
            const res = typeof original.clone === 'function' ? original.clone(extraProps) : null;
            cloned = res && typeof res.then === 'function' ? await res : res;
        } catch (err) {
            console.warn('[duplicateFrameWithContents] clone failed', err);
        }
        // Fallback robusto: o clone() do Fabric falha/retorna null para alguns
        // objetos (imagens com proxy/cross-origin, grupos complexos) e o elemento
        // era SILENCIOSAMENTE descartado -> a copia do frame perdia conteudo e o
        // layout ficava infiel. Serializa+enliven (mais confiavel) para nao perder.
        if (!cloned) {
            try {
                const rawJson = typeof original.toObject === 'function' ? original.toObject(extraProps) : null;
                if (rawJson) {
                    // CAUSA RAIZ: o Fabric v6 falha ao reenlivar o `layoutManager`
                    // serializado de Groups (ex: zona de produtos -> "No class
                    // registered for undefined"), derrubando o clone e fazendo a
                    // copia do frame PERDER a zona inteira (layout quebrado). O app
                    // ja' desativa o layoutManager das zonas/cards.
                    // Normalizamos para objeto puro (JSON round-trip remove instancias
                    // de classe / getters que tambem quebram o enliven) e removemos o
                    // layoutManager (recursivo) antes de reviver.
                    const json = JSON.parse(JSON.stringify(rawJson));
                    const stripLayoutManager = (node: any) => {
                        if (!node || typeof node !== 'object') return;
                        delete node.layoutManager;
                        if (Array.isArray(node.objects)) node.objects.forEach(stripLayoutManager);
                        if (node.clipPath && typeof node.clipPath === 'object') stripLayoutManager(node.clipPath);
                    };
                    stripLayoutManager(json);
                    const enlivened = await enlivenObjectsAsync([json]);
                    cloned = Array.isArray(enlivened) ? enlivened[0] : null;
                }
            } catch (err2) {
                console.warn('[duplicateFrameWithContents] fallback enliven failed', err2);
            }
        }
        if (!cloned) {
            console.warn('[duplicateFrameWithContents] objeto NAO duplicado (clone+enliven falharam):', (original as any)?.name, (original as any)?._customId);
            continue;
        }

        const oldId = String(original._customId || '');
        const newId = makeId();
        oldToNewId.set(oldId, newId);

        cloned._customId = newId;
        assignNewDescendantIds(cloned);
        preserveClonedPriceUnitState(original, cloned);
        cloned.set?.({
            left: (Number(original.left) || 0) + offsetX,
            top: (Number(original.top) || 0) + offsetY,
            evented: true,
            selectable: true,
        });
        // Forca recalculo dos cached bounds. Sem isso, getBoundingRect/oCoords
        // ficam apontando para a posicao antiga, e recalculateZoneLayout
        // posiciona os cards usando a bounding box errada (resultado: cards
        // da zona duplicada sao espalhados no frame original).
        try { cloned.setCoords?.(); } catch {}

        // Avoid stale frame clip refs; keep object masks.
        const isObjectMaskClone = !!(cloned as any)?.objectMaskEnabled;
        if (!isObjectMaskClone) {
            try { cloned.clipPath = null; } catch {}
            try { delete (cloned as any)._frameClipOwner; } catch {}
        }
        try { delete (cloned as any).__clipRect; } catch {}

        // Keep mutable metadata independent from the source frame/card/zone.
        for (const key of [
            '_productData',
            '_zoneSlot',
            '_zoneGlobalStyles',
            '_zoneTemplateSnapshot',
            '_zoneStateSnapshot',
            '__priceLayoutSnapshot',
            '__atacValueVariants',
            '__atacVariantGroups'
        ]) {
            if (typeof (original as any)[key] !== 'undefined') {
                (cloned as any)[key] = cloneJsonSafe((original as any)[key]);
            }
        }

        // Keep the frame flag even if Fabric drops it in clone.
        if (isFrameContainerCandidate(original)) {
            cloned.isFrame = true;
            cloned.clipContent = (original as any).clipContent !== false;
            cloned.stroke = (original as any).stroke || '#0d99ff';
            if ((original as any).layerName) cloned.layerName = (original as any).layerName;
            if ((original as any).name) cloned.name = (original as any).name;
        }

        // Give a friendly copied name to the root frame.
        if (String(original._customId) === rootId) {
            rootClone = cloned;
            const baseName = String((original as any).layerName || (original as any).name || 'Frame').trim();
            const copiedName = baseName ? `${baseName} (cópia)` : 'Frame (cópia)';
            if ((original as any).layerName) cloned.layerName = copiedName;
            cloned.name = copiedName;
        }

        clones.push(cloned);
    }

    if (!rootClone) {
        // Fallback: root may not have cloned for some reason
        rootClone = clones.find((o: any) => !!o?.isFrame) || clones[0] || null;
    }
    if (!rootClone) return null;

    // Fix parentFrameId on all clones now that we have the id map.
    const oldByNew = new Map<string, any>();
    originals.forEach((o: any) => {
        const oldId = String(o._customId || '');
        const newId = oldToNewId.get(oldId);
        if (!newId) return;
        const clone = clones.find((c: any) => String(c._customId) === newId);
        if (clone) oldByNew.set(newId, { original: o, clone });
    });
    clones.forEach((clone: any) => {
        const entry = oldByNew.get(String(clone._customId));
        const original = entry?.original;
        if (!original) return;
        const originalId = String((original as any)._customId || '');
        const resolvedParent = resolvedParentByOriginalId.get(originalId);
        const oldParent = String(resolvedParent || (original as any).parentFrameId || '');
        if (!oldParent) {
            clone.parentFrameId = undefined;
        } else {
            const mappedParent = oldToNewId.get(oldParent);
            clone.parentFrameId = mappedParent || undefined;
        }

        const oldZoneId = String((original as any).parentZoneId || '').trim();
        if (oldZoneId) {
            const mappedZoneId = oldToNewId.get(oldZoneId);
            if (mappedZoneId) clone.parentZoneId = mappedZoneId;
            else delete clone.parentZoneId;
        }

        const oldSlotZoneId = String((original as any)?._zoneSlot?.zoneId || '').trim();
        if (oldSlotZoneId && clone._zoneSlot && typeof clone._zoneSlot === 'object') {
            const mappedSlotZoneId = oldToNewId.get(oldSlotZoneId);
            if (mappedSlotZoneId) clone._zoneSlot = { ...clone._zoneSlot, zoneId: mappedSlotZoneId };
            else clone._zoneSlot = null;
        }

        const oldMaskSource = String((original as any).objectMaskSourceId || '').trim();
        if (!oldMaskSource) {
            delete clone.objectMaskSourceId;
        } else {
            clone.objectMaskSourceId = oldToNewId.get(oldMaskSource) || oldMaskSource;
        }

        if (clone?.isProductCard || clone?.isSmartObject || isLikelyProductCard(clone)) {
            normalizeProductCardIdentity(clone, {
                zoneInstanceId: String((clone as any).parentZoneId || '').trim() || null,
                forceNewInstance: true,
                reason: 'duplicate-frame'
            });
        }
    });

    // Final guard: cloned product cards must bind to cloned zones from the same
    // frame. A stale parentZoneId pointing to the source frame makes any product
    // drag relayout the original zone and pull the duplicated products back.
    {
        const clonedZones = clones.filter((o: any) => isLikelyProductZone(o));
        const clonedCards = clones.filter((o: any) => (
            isLikelyProductCard(o) ||
            o?.isProductCard ||
            o?.isSmartObject ||
            String((o as any)?.parentZoneId || '').trim().length > 0 ||
            String((o as any)?._zoneSlot?.zoneId || '').trim().length > 0
        ));
        const clonedZoneById = new Map<string, any>();
        clonedZones.forEach((zone: any) => {
            const id = String((zone as any)?._customId || '').trim();
            if (id) clonedZoneById.set(id, zone);
        });

        const getCloneZoneFrameId = (zone: any) => String((zone as any)?.parentFrameId || '').trim();
        const getCloneZoneBounds = (zone: any) => {
            try {
                return getZoneMetrics(zone) ?? zone.getBoundingRect?.(true) ?? null;
            } catch {
                try { return zone.getBoundingRect?.(true) ?? null; } catch { return null; }
            }
        };
        const findReplacementZoneForCard = (card: any) => {
            const cardFrameId = String((card as any)?.parentFrameId || '').trim();
            const pool = cardFrameId
                ? clonedZones.filter((zone: any) => getCloneZoneFrameId(zone) === cardFrameId)
                : clonedZones;
            if (pool.length === 0) return null;
            if (pool.length === 1) return pool[0];

            const center = typeof card.getCenterPoint === 'function'
                ? card.getCenterPoint()
                : { x: Number(card.left || 0), y: Number(card.top || 0) };
            let best: any = null;
            let bestDistanceSq = Number.POSITIVE_INFINITY;
            for (const zone of pool) {
                const bounds = getCloneZoneBounds(zone);
                if (!bounds) continue;
                const inside =
                    center.x >= bounds.left &&
                    center.x <= bounds.left + bounds.width &&
                    center.y >= bounds.top &&
                    center.y <= bounds.top + bounds.height;
                if (inside) return zone;
                const zx = Number((bounds.centerX ?? (bounds.left + bounds.width / 2)) || 0);
                const zy = Number((bounds.centerY ?? (bounds.top + bounds.height / 2)) || 0);
                const dx = center.x - zx;
                const dy = center.y - zy;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDistanceSq) {
                    best = zone;
                    bestDistanceSq = d2;
                }
            }
            return best;
        };
        const createFallbackZoneForClonedCards = (frameId: string, frameCards: any[]) => {
            if (!fabric || !frameCards.length) return null;
            let minLeft = Number.POSITIVE_INFINITY;
            let minTop = Number.POSITIVE_INFINITY;
            let maxRight = Number.NEGATIVE_INFINITY;
            let maxBottom = Number.NEGATIVE_INFINITY;

            frameCards.forEach((card: any) => {
                try { card?.setCoords?.(); } catch {}
                const bounds = typeof card?.getBoundingRect === 'function' ? card.getBoundingRect(true) : null;
                if (!bounds) return;
                minLeft = Math.min(minLeft, Number(bounds.left || 0));
                minTop = Math.min(minTop, Number(bounds.top || 0));
                maxRight = Math.max(maxRight, Number(bounds.left || 0) + Number(bounds.width || 0));
                maxBottom = Math.max(maxBottom, Number(bounds.top || 0) + Number(bounds.height || 0));
            });

            if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
                return null;
            }

            const pad = 18;
            const width = Math.max(80, maxRight - minLeft + pad * 2);
            const height = Math.max(80, maxBottom - minTop + pad * 2);
            const centerX = minLeft + (maxRight - minLeft) / 2;
            const centerY = minTop + (maxBottom - minTop) / 2;
            const zoneRect = new fabric.Rect({
                width,
                height,
        fill: 'rgba(109, 40, 217, 0.08)',
        stroke: '#6d28d9',
        strokeWidth: 2,
        strokeDashArray: [10, 10],
                strokeUniform: true,
                rx: 16,
                ry: 16,
                originX: 'center',
                originY: 'center',
                name: 'zoneRect',
                selectable: false,
                evented: false
            });
            const zone = new fabric.Group([zoneRect], {
                left: centerX,
                top: centerY,
                originX: 'center',
                originY: 'center',
                isGridZone: true,
                isProductZone: true,
                name: 'productZoneContainer',
                columns: 0,
                rows: 0,
                gapHorizontal: 20,
                gapVertical: 20,
                cardAspectRatio: 'fill',
                lastRowBehavior: 'fill',
                layoutDirection: 'horizontal',
                verticalAlign: 'stretch',
                subTargetCheck: false,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockScalingFlip: true
            } as any);
            (zone as any)._customId = makeId();
            (zone as any).parentFrameId = frameId || undefined;
            (zone as any)._zoneWidth = width;
            (zone as any)._zoneHeight = height;
            (zone as any)._zonePadding = 20;
            try { zone.setCoords?.(); } catch {}
            return zone;
        };

        const clonedFrameIds = new Set(
            clones
                .filter((o: any) => isFrameContainerCandidate(o))
                .map((o: any) => String((o as any)?._customId || '').trim())
                .filter(Boolean)
        );
        const clonedFrames = clones.filter((o: any) => isFrameContainerCandidate(o));
        const findContainingClonedFrameId = (obj: any) => {
            try { obj?.setCoords?.(); } catch {}
            const bounds = typeof obj?.getBoundingRect === 'function' ? obj.getBoundingRect(true) : null;
            if (!bounds) return '';
            const cx = Number(bounds.left || 0) + Number(bounds.width || 0) / 2;
            const cy = Number(bounds.top || 0) + Number(bounds.height || 0) / 2;
            let bestFrameId = '';
            let bestArea = Number.POSITIVE_INFINITY;
            clonedFrames.forEach((frame: any) => {
                const frameId = String((frame as any)?._customId || '').trim();
                if (!frameId) return;
                const fb = getFrameBounds(frame) || (typeof frame?.getBoundingRect === 'function' ? frame.getBoundingRect(true) : null);
                if (!fb) return;
                const inside = cx >= fb.left && cx <= fb.left + fb.width && cy >= fb.top && cy <= fb.top + fb.height;
                if (!inside) return;
                const area = Math.max(1, Number(fb.width || 0) * Number(fb.height || 0));
                if (area < bestArea) {
                    bestArea = area;
                    bestFrameId = frameId;
                }
            });
            return bestFrameId;
        };
        clonedZones.forEach((zone: any) => {
            const zoneFrameId = String((zone as any)?.parentFrameId || '').trim();
            if (zoneFrameId && clonedFrameIds.has(zoneFrameId)) return;
            const containingFrameId = findContainingClonedFrameId(zone);
            if (containingFrameId) {
                (zone as any).parentFrameId = containingFrameId;
            } else if (zoneFrameId && !clonedFrameIds.has(zoneFrameId)) {
                delete (zone as any).parentFrameId;
            }
        });
        clonedFrameIds.forEach((frameId: string) => {
            const zonesInFrame = clonedZones.filter((zone: any) => getCloneZoneFrameId(zone) === frameId);
            if (zonesInFrame.length > 0) return;
            const cardsInFrame = clonedCards.filter((card: any) => String((card as any)?.parentFrameId || '').trim() === frameId);
            if (!cardsInFrame.length) return;
            const fallbackZone = createFallbackZoneForClonedCards(frameId, cardsInFrame);
            if (!fallbackZone) return;
            clonedZones.push(fallbackZone);
            const zoneId = String((fallbackZone as any)._customId || '').trim();
            if (zoneId) clonedZoneById.set(zoneId, fallbackZone);
            clones.push(fallbackZone);
        });

        clonedCards.forEach((card: any) => {
            let cardFrameId = String((card as any)?.parentFrameId || '').trim();
            if (!cardFrameId || !clonedFrameIds.has(cardFrameId)) {
                const containingFrameId = findContainingClonedFrameId(card);
                if (containingFrameId) {
                    cardFrameId = containingFrameId;
                    (card as any).parentFrameId = containingFrameId;
                } else if (cardFrameId && !clonedFrameIds.has(cardFrameId)) {
                    delete (card as any).parentFrameId;
                    cardFrameId = '';
                }
            }
            const currentZoneId = String((card as any)?.parentZoneId || '').trim();
            const currentZone = currentZoneId ? clonedZoneById.get(currentZoneId) : null;
            const currentZoneFrameId = currentZone ? getCloneZoneFrameId(currentZone) : '';
            if (currentZone && (!cardFrameId || !currentZoneFrameId || currentZoneFrameId === cardFrameId)) return;

            const replacement = findReplacementZoneForCard(card);
            const replacementId = String((replacement as any)?._customId || '').trim();
            if (!replacementId) {
                delete (card as any).parentZoneId;
                (card as any)._zoneSlot = null;
                return;
            }

            (card as any).parentZoneId = replacementId;
            const slot = (card as any)?._zoneSlot;
            if (slot && typeof slot === 'object') {
                (card as any)._zoneSlot = { ...slot, zoneId: replacementId };
            }
            applyCardFrameBinding(card, getCloneZoneFrameId(replacement) || undefined);
            normalizeProductCardIdentity(card, {
                zoneInstanceId: replacementId,
                reason: 'duplicate-frame-rebind'
            });
        });
    }

    // Insert only after all frame/zone bindings are remapped. If card clones
    // briefly enter the canvas with the original parentZoneId, Fabric events
    // and zone relayout can capture them back into the source zone.
    clones.forEach((cloned: any, index: number) => {
        try {
            if (typeof (canvas.value as any).insertAt === 'function') {
                (canvas.value as any).insertAt(insertBaseIndex + index, cloned);
            } else {
                canvas.value.add(cloned);
            }
        } catch {
            canvas.value.add(cloned);
        }
    });
    invalidateContainmentZoneCache();

    try {
        const c: any = canvas.value as any;
        if (typeof c.moveTo === 'function') {
            const clonedZones = clones.filter((o: any) => isLikelyProductZone(o));
            clonedZones.forEach((zone: any) => {
                const list = canvas.value!.getObjects();
                const zoneIndex = list.indexOf(zone);
                if (zoneIndex < 0) return;
                const zoneId = String((zone as any)?._customId || '').trim();
                const zoneFrameId = String((zone as any)?.parentFrameId || '').trim();
                const frameIndex = zoneFrameId
                    ? list.findIndex((o: any) => String((o as any)?._customId || '').trim() === zoneFrameId)
                    : -1;
                const zoneCardIndices: number[] = [];
                for (let i = 0; i < list.length; i++) {
                    const obj = list[i] as any;
                    if (!obj || obj === zone) continue;
                    if (String(obj?.parentZoneId || '').trim() === zoneId) zoneCardIndices.push(i);
                }
                const minCardIndex = zoneCardIndices.length ? Math.min(...zoneCardIndices) : Number.POSITIVE_INFINITY;
                const targetIndex = Math.max(frameIndex >= 0 ? frameIndex + 1 : 0, Number.isFinite(minCardIndex) ? minCardIndex - 1 : zoneIndex);
                if (zoneIndex !== targetIndex) c.moveTo(zone, targetIndex);
            });
        }
    } catch {
        // Stacking is a visual guard only; duplication data is already repaired.
    }

    // Rebuild clipping for the new frame tree.
    try {
        clones.forEach((o: any) => {
            if (o?.isFrame) getOrCreateFrameClipRect(o);
        });
        clones.forEach((o: any) => {
            if (o?.parentFrameId || o?._frameClipOwner) syncObjectFrameClip(o);
        });
        clones.forEach((o: any) => {
            if (o?.isFrame) syncFrameClips(o);
        });
    } catch (err) {
        console.warn('[duplicateFrameWithContents] failed to rebuild frame clips', err);
    }

    try {
        clones.forEach((o: any) => {
            if (o) reapplyRuntimeVisualPatchesTree(o);
        });
        // Garante que todos os clones tenham bounds atualizados antes do
        // recalculateZoneLayout consultar getBoundingRect/getZoneMetrics.
        clones.forEach((o: any) => {
            try { o?.setCoords?.(); } catch {}
        });
        const zones = clones.filter((o: any) => isLikelyProductZone(o));
        const cards = clones.filter((o: any) => isLikelyProductCard(o) || o?.isProductCard || o?.isSmartObject);
        if (import.meta.dev) {
            console.log('[duplicateFrameWithContents] pos-clone', {
                zones: zones.map((z: any) => ({ id: z._customId, parentFrameId: z.parentFrameId, left: Math.round(z.left), top: Math.round(z.top) })),
                cards: cards.map((c: any) => ({ id: c._customId, parentZoneId: c.parentZoneId, parentFrameId: c.parentFrameId, left: Math.round(c.left), top: Math.round(c.top) }))
            });
        }
        zones.forEach((zone: any) => {
            ensureZoneSanity(zone);
            const zoneId = String((zone as any)._customId || '').trim();
            const zoneCards = cards.filter((card: any) => String((card as any)?.parentZoneId || '').trim() === zoneId);
            zoneCards.forEach((card: any) => applyCardFrameBinding(card, getResolvedZoneFrameId(zone)));
            if (zoneCards.length > 0) {
                recalculateZoneLayout(zone, zoneCards, { save: false, preserveStyles: true });
            }
            syncZoneDerivedMetadata(zone, undefined, { updateStateSnapshot: true });
        });
        stabilizePriceGroupsForPersistence(canvas.value, 'duplicate-frame');
    } catch (err) {
        console.warn('[duplicateFrameWithContents] failed to reapply runtime visual patches', err);
    }

    const duplicatedTargetZoneId = sourceTargetZoneId ? oldToNewId.get(sourceTargetZoneId) : '';
    const rootCloneId = String((rootClone as any)?._customId || '').trim();
    const clonedZones = clones.filter((o: any) => isLikelyProductZone(o));
    const nextTargetZone = duplicatedTargetZoneId
        ? clonedZones.find((zone: any) => String((zone as any)?._customId || '').trim() === duplicatedTargetZoneId)
        : clonedZones.find((zone: any) => String((zone as any)?.parentFrameId || '').trim() === rootCloneId) || clonedZones[0];
    if (nextTargetZone && isLikelyProductZone(nextTargetZone)) {
        targetGridZone.value = nextTargetZone;
        targetGridZones.value = resolveRelatedImportZones(nextTargetZone);
        // Sync composable singleton with cloned zone data so edits target the clone, not the original
        productZoneState.updateZone(buildZoneSelectionConfig(nextTargetZone));
        productZoneState.updateGlobalStyles(getZoneGlobalStyles(nextTargetZone));
    } else {
        targetGridZone.value = null;
        targetGridZones.value = [];
    }

    canvas.value.setActiveObject(rootClone);
    safeRequestRenderAll();
    refreshCanvasObjects();
    updateSelection();
    saveCurrentState({ reason: 'duplicate-frame' });
    return rootClone;
}

const updateObjectProperty = (prop: string, value: any) => {
    // Special: Canvas Preset Change
    if (prop === 'canvas-preset') {
        const newW = value.w;
        const newH = value.h;
        const activePage = project.pages[project.activePageIndex];
        const oldW = activePage?.width || 1080;
        const oldH = activePage?.height || 1920;

        // Em um modelo de encarte, o formato faz parte da identidade da
        // composição. Antes, o preset alterava somente width/height; o save
        // continuava registrando a página como Feed e a edição rápida puxava
        // o fundo do blueprint errado (por exemplo, Feed em uma página 1:1).
        syncTemplatePageMetadataForFormat(activePage, newW, newH)

        resizePage(project.activePageIndex, newW, newH);

        if (canvas.value) {
            // 1. Find and resize the frame
            const frames = getAllFrames();
            const frame = frames.length === 1 ? frames[0] : frames.find((f: any) => {
                const fw = Math.round(f.width * (f.scaleX || 1));
                const fh = Math.round(f.height * (f.scaleY || 1));
                return Math.abs(fw - oldW) < 10 && Math.abs(fh - oldH) < 10;
            });

            if (frame) {
                const frameCenterBefore = typeof frame.getCenterPoint === 'function'
                    ? frame.getCenterPoint()
                    : { x: frame.left || 0, y: frame.top || 0 };

                const scaleX = newW / oldW;
                const scaleY = newH / oldH;

                // Resize the frame itself
                frame.set({
                    width: newW,
                    height: newH,
                    scaleX: 1,
                    scaleY: 1
                });
                frame.setCoords();

                // Update frame clipPath if present
                const frameClip = frame.clipPath;
                if (frameClip) {
                    frameClip.set({
                        width: newW,
                        height: newH,
                        scaleX: 1,
                        scaleY: 1
                    });
                }

                // 2. Rescale and reposition all objects inside the frame
                const frameBounds = getFrameBounds(frame);
                if (frameBounds) {
                    const allObjs = canvas.value.getObjects().filter((o: any) => o !== frame);
                    for (const obj of allObjs) {
                        if (!obj || obj.isFrame) continue;

                        try {
                            const objCenter = typeof obj.getCenterPoint === 'function'
                                ? obj.getCenterPoint()
                                : { x: obj.left || 0, y: obj.top || 0 };

                            // Calculate relative position from frame center
                            const relX = objCenter.x - frameCenterBefore.x;
                            const relY = objCenter.y - frameCenterBefore.y;

                            // Scale position and size
                            const newCenterX = frameCenterBefore.x + (relX * scaleX);
                            const newCenterY = frameCenterBefore.y + (relY * scaleY);

                            if (obj.isGridZone || obj.isProductZone) {
                                // For ProductZones: resize the zone and its inner rect
                                const zoneRect = typeof obj.getObjects === 'function'
                                    ? obj.getObjects().find((o: any) => o?.type === 'rect')
                                    : null;
                                if (zoneRect) {
                                    const newRectW = (zoneRect.width || 0) * scaleX;
                                    const newRectH = (zoneRect.height || 0) * scaleY;
                                    zoneRect.set({
                                        width: newRectW,
                                        height: newRectH,
                                        scaleX: 1,
                                        scaleY: 1
                                    });
                                    // FIX: Sync group dimensions to match rect
                                    obj.set({
                                        left: newCenterX,
                                        top: newCenterY,
                                        width: newRectW,
                                        height: newRectH,
                                        scaleX: 1,
                                        scaleY: 1,
                                        originX: 'center',
                                        originY: 'center'
                                    });
                                } else {
                                    obj.set({
                                        left: newCenterX,
                                        top: newCenterY,
                                        scaleX: 1,
                                        scaleY: 1,
                                        originX: 'center',
                                        originY: 'center'
                                    });
                                }
                                obj._zoneWidth = undefined;
                                obj._zoneHeight = undefined;
                                safeAddWithUpdate(obj);
                                ensureZoneSanity(obj);
                            } else if (obj.isProductCard || obj.isSmartObject) {
                                // Product cards: will be re-laid out by zone relayout
                                obj.set({
                                    left: newCenterX,
                                    top: newCenterY,
                                    scaleX: (obj.scaleX || 1) * scaleX,
                                    scaleY: (obj.scaleY || 1) * scaleY
                                });
                            } else {
                                // General objects: scale position and size
                                obj.set({
                                    left: newCenterX,
                                    top: newCenterY,
                                    scaleX: (obj.scaleX || 1) * scaleX,
                                    scaleY: (obj.scaleY || 1) * scaleY
                                });
                            }
                            obj.setCoords();
                        } catch (e) {
                            console.warn('[canvas-preset] Failed to rescale object:', e);
                        }
                    }

                    // 3. Re-layout product zones after resize
                    const zones = allObjs.filter((o: any) => o.isGridZone || o.isProductZone);
                    for (const zone of zones) {
                        try {
                            const zoneCards = getZoneChildren(zone);
                            if (zoneCards.length > 0) {
                                recalculateZoneLayout(zone, zoneCards, { save: false });
                            }
                        } catch (e) {
                            console.warn('[canvas-preset] Failed to relayout zone:', e);
                        }
                    }
                }
            }

            canvas.value.setDimensions({
                width: wrapperEl.value?.clientWidth || newW,
                height: wrapperEl.value?.clientHeight || newH
            });
            setTimeout(() => { zoomToFit(); saveCurrentState(); }, 80);
        }
        return;
    }

    // --- HANDLE BRUSH SETTINGS ---
    if (isDrawing.value && selectedObjectRef.value?.type === 'brush-proxy') {
        if (!canvas.value.freeDrawingBrush) return;

        const brush = canvas.value.freeDrawingBrush as any;

        if (prop === 'stroke' || prop === 'fill') {
            brush.color = value;
            selectedObjectRef.value.stroke = value;
            selectedObjectRef.value.fill = value;
        }
        else if (prop === 'strokeWidth') {
            const val = parseInt(value);
            brush.width = val;
            selectedObjectRef.value.strokeWidth = val;
        }
        else if (prop === 'strokeLineCap') {
            brush.strokeLineCap = value;
            selectedObjectRef.value.strokeLineCap = value;
        }
        else if (prop === 'strokeLineJoin') {
            brush.strokeLineJoin = value;
            selectedObjectRef.value.strokeLineJoin = value;
        }
        else if (prop === 'strokeDashArray') {
            brush.strokeDashArray = value;
            selectedObjectRef.value.strokeDashArray = value;
        }

        refreshSelectedRef();
        return;
    }

    if (!canvas.value) return;
    let active = canvas.value.getActiveObject();

    if (active) {
        if (INSPECTOR_TRANSFORM_PROPS.has(prop)) {
            active = resolveInspectorSnapshotTarget(active);
        }

        let snapshotExtra: Record<string, any> | undefined = { [prop]: value };

        // If locked, ignore position/size/rotate changes from the inspector.
        // Lock should only block transformations, not styling/effects.
        if (active.type !== 'activeSelection') {
            if ((prop === 'left' && active.lockMovementX) || (prop === 'top' && active.lockMovementY)) return;
            if (
                (prop === 'width' && active.lockScalingX) ||
                (prop === 'height' && active.lockScalingY) ||
                (prop === 'scaleX' && active.lockScalingX) ||
                (prop === 'scaleY' && active.lockScalingY)
            ) return;
            if (prop === 'angle' && active.lockRotation) return;
        }

        // Keep text-style edits bound to the object shown in the inspector snapshot.
        // This avoids styling the card background when Fabric activeObject drifts to the parent group.
        if (TEXT_OBJECT_STYLE_PROPS.has(prop)) {
            const snapshot = selectedObjectRef.value as any;
            const snapshotId = String(snapshot?._customId || '').trim();
            const snapshotType = String(snapshot?.type || '').toLowerCase();
            const snapshotIsText = snapshotType === 'i-text' || snapshotType === 'textbox' || snapshotType === 'text';
            const activeId = String((active as any)?._customId || '').trim();

            if (snapshotIsText && snapshotId && activeId !== snapshotId) {
                const found = findObjectByCustomId(snapshotId)?.obj;
                if (found && isTextStyleObject(found)) {
                    active = found;
                }
            } else if (snapshotIsText && !snapshotId && String((active as any)?.type || '').toLowerCase() === 'group' && typeof (active as any)?.getObjects === 'function') {
                const snapName = String(snapshot?.name || '').trim();
                const snapText = String(snapshot?.text ?? '');
                const walkForText = (node: any): any => {
                    if (!node) return null;
                    if (isTextStyleObject(node)) {
                        const sameName = snapName && String(node?.name || '').trim() === snapName;
                        const sameText = snapText && String(node?.text ?? '') === snapText;
                        if (sameName || sameText) return node;
                    }
                    const t = String(node?.type || '').toLowerCase();
                    if ((t === 'group' || t === 'activeselection') && typeof node.getObjects === 'function') {
                        const children = node.getObjects() || [];
                        for (const child of children) {
                            const nested = walkForText(child);
                            if (nested) return nested;
                        }
                    }
                    return null;
                };
                const fallbackText = walkForText(active);
                if (fallbackText) active = fallbackText;
            } else if (!isTextStyleObject(active)) {
                const deepActive = (active as any)?._activeObject;
                if (deepActive && isTextStyleObject(deepActive)) {
                    active = deepActive;
                }
            }
        }

        // Rich text: apply style to selected text range when available.
        if (TEXT_SELECTION_STYLE_PROPS.has(prop) && active.type !== 'activeSelection' && isTextStyleObject(active)) {
            if (String(active.type || '').toLowerCase() === 'text') {
                active = convertStaticTextToIText({
                    canvas: canvas.value,
                    fabric,
                    obj: active,
                    canvasCustomProps: [...CANVAS_CUSTOM_PROPS],
                    safeAddWithUpdate,
                    syncObjectFrameClip,
                    refreshCanvasObjects: () => refreshCanvasObjects()
                });
            }
            if (applySelectionTextStyle({
                obj: active,
                prop,
                value,
                getTextSelectionRange,
                safeAddWithUpdate,
                applyWholeTextWhenNoSelection: true
            })) {
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }
        }

        // Resolve "style target" for groups/zones (Fabric groups don't have fill/stroke/radius).
        const resolveStyleTarget = (obj: any) => {
            if (!obj) return obj;
            if (isLikelyProductZone(obj)) return getZoneRect(obj) || obj;
            if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard) && typeof obj.getObjects === 'function') {
                return obj.getObjects().find((o: any) => o.name === 'offerBackground') || obj;
            }
            return obj;
        };
        const styleTarget = resolveStyleTarget(active);
        const applyToActiveOrSelection = (fn: (o: any) => void) => {
            if (active.type === 'activeSelection' && typeof active.getObjects === 'function') {
                active.getObjects().forEach((o: any) => fn(resolveStyleTarget(o)));
                safeAddWithUpdate(active);
                active.setCoords?.();
                return;
            }
            fn(styleTarget);
        };

        markPriceGroupAsManuallyCustomized(active, { captureSnapshot: false });

        // --- Lock (Cadeado) ---
        // Blocks movement/scale/rotate but keeps the object selectable so the user can unlock.
        if (prop === 'lockMovement') {
            const locked = !!value;
            const applyLock = (o: any) => {
                if (!o || typeof o.set !== 'function') return;
                o.set({
                    lockMovementX: locked,
                    lockMovementY: locked,
                    lockScalingX: locked,
                    lockScalingY: locked,
                    lockRotation: locked
                });
                o.setCoords?.();
            };

            if (active.type === 'activeSelection' && typeof (active as any).getObjects === 'function') {
                (active as any).getObjects().forEach((o: any) => applyLock(o));
                safeAddWithUpdate(active);
                active.setCoords?.();
            } else {
                applyLock(active);
            }

            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }

        // --- Align (Inspector) ---
        if (prop === 'alignment') {
            if (value === 'left' || value === 'center' || value === 'right') {
                alignSelectionHorizontally(value);
            }
            return;
        }

        // --- Shape controls (Fill/Stroke/Corner radii) ---
        if (prop === 'fillEnabled') {
            applyToActiveOrSelection((o) => toggleFill(o, !!value));
            (active as any).__fillEnabled = !!value;
            if (active.isFrame) getOrCreateFrameClipRect(active);
            if (active.isFrame) syncFrameClips(active);
            safeAddWithUpdate(active);
            active.setCoords?.();
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef({ __fillEnabled: !!value });
            return;
        }
        if (prop === 'strokeEnabled') {
            applyToActiveOrSelection((o) => toggleStroke(o, !!value));
            (active as any).__strokeEnabled = !!value;
            if (active.isFrame) getOrCreateFrameClipRect(active);
            if (active.isFrame) syncFrameClips(active);
            safeAddWithUpdate(active);
            active.setCoords?.();
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef({ __strokeEnabled: !!value });
            return;
        }

        // --- Sticker Outline (alpha-based contour) ---
	        if (prop === 'stickerOutlineEnabled') {
	            const isImage = String(active.type || '').toLowerCase() === 'image';
	            if (!isImage) return;
	            const el = active._element || active.getElement?.();
	            (active as any).__stickerOutlineEnabled = !!value;
	            // Set defaults if first time enabling
	            if (value) {
	                if ((active as any).__stickerOutlineWidth == null) (active as any).__stickerOutlineWidth = 4;
	                if ((active as any).__stickerOutlineColor == null) (active as any).__stickerOutlineColor = '#FFFFFF';
	                if ((active as any).__stickerOutlineOpacity == null) (active as any).__stickerOutlineOpacity = 1;
	                if (!(active as any).__stickerOutlineMode) (active as any).__stickerOutlineMode = 'outside';
	            }
            // Detect transparency
            if (value && el) {
                const hasTrans = imageHasTransparency(el);
                (active as any).__stickerNoTransparency = !hasTrans;
            }
            applyStickerOutlinePatch(active);
            active.setCoords?.();
            active.dirty = true;
            // FIX: Use safeRequestRenderAll instead of direct renderAll() to go through
            // the safety patch (context validation, RAF coalescing, error recovery).
            // The second render is scheduled via RAF to guarantee visibility after patch
            // without bypassing safety mechanisms.
            safeRequestRenderAll();
            setTimeout(() => { safeRequestRenderAll(); }, 60);
            debouncedSaveCurrentState();
	            refreshSelectedRef({
	                __stickerOutlineEnabled: !!(active as any).__stickerOutlineEnabled,
	                __stickerOutlineMode: (active as any).__stickerOutlineMode || 'outside',
	                __stickerOutlineWidth: (active as any).__stickerOutlineWidth ?? 4,
	                __stickerOutlineColor: (active as any).__stickerOutlineColor ?? '#FFFFFF',
	                __stickerOutlineOpacity: (active as any).__stickerOutlineOpacity ?? 1,
	                __stickerNoTransparency: !!(active as any).__stickerNoTransparency
	            });
	            return;
	        }
	        if (prop === 'stickerOutlineMode') {
	            const isImage = String(active.type || '').toLowerCase() === 'image';
	            if (!isImage) return;
	            const next: 'outside' | 'inside' = value === 'inside' ? 'inside' : 'outside';
	            (active as any).__stickerOutlineMode = next;
	            invalidateStickerOutlineCache(active);
	            applyStickerOutlinePatch(active);
	            active.setCoords?.();
	            active.dirty = true;
	            safeRequestRenderAll();
	            setTimeout(() => { safeRequestRenderAll(); }, 60);
	            debouncedSaveCurrentState();
	            refreshSelectedRef({
	                __stickerOutlineEnabled: !!(active as any).__stickerOutlineEnabled,
	                __stickerOutlineMode: (active as any).__stickerOutlineMode || 'outside',
	                __stickerOutlineWidth: (active as any).__stickerOutlineWidth,
	                __stickerOutlineColor: (active as any).__stickerOutlineColor,
	                __stickerOutlineOpacity: (active as any).__stickerOutlineOpacity,
	                __stickerNoTransparency: !!(active as any).__stickerNoTransparency
	            });
	            return;
	        }
	        if (prop === 'stickerOutlineWidth' || prop === 'stickerOutlineColor' || prop === 'stickerOutlineOpacity') {
	            const propMap = {
	                stickerOutlineWidth: '__stickerOutlineWidth',
	                stickerOutlineColor: '__stickerOutlineColor',
                stickerOutlineOpacity: '__stickerOutlineOpacity'
            } as const;
            const key: string = propMap[prop as keyof typeof propMap];
            (active as any)[key] = value;
            invalidateStickerOutlineCache(active);
            applyStickerOutlinePatch(active);
            active.setCoords?.();
            active.dirty = true;
            safeRequestRenderAll();
            setTimeout(() => { safeRequestRenderAll(); }, 60);
            debouncedSaveCurrentState();
	            refreshSelectedRef({
	                __stickerOutlineEnabled: !!(active as any).__stickerOutlineEnabled,
	                __stickerOutlineMode: (active as any).__stickerOutlineMode || 'outside',
	                __stickerOutlineWidth: (active as any).__stickerOutlineWidth,
	                __stickerOutlineColor: (active as any).__stickerOutlineColor,
	                __stickerOutlineOpacity: (active as any).__stickerOutlineOpacity,
	                __stickerNoTransparency: !!(active as any).__stickerNoTransparency
	            });
	            return;
	        }

        if (prop === 'cornerRadius') {
            const r = Math.max(0, Number(value || 0));
            applyToActiveOrSelection((o) => {
                if (o && (o as any).cornerRadii) delete (o as any).cornerRadii;
                // Remove any custom render patch to ensure Fabric.js native rendering is used
                if ((o as any).__origRender) {
                    o._render = (o as any).__origRender;
                    delete (o as any).__origRender;
                }
                // Set rx, ry with additional properties to ensure proper rendering
                o?.set?.({
                    rx: r,
                    ry: r,
                    strokeUniform: true,  // Ensures stroke scales properly
                    objectCaching: false, // Disable caching for rounded corners
                    dirty: true
                });
                // Force clear any clipPath that might interfere with native rx/ry rendering
                if (o && !o.isFrame) {
                    o.set('clipPath', undefined);
                }
                applyRectCornerRadiiPatch(o);
            });
            if (active.isFrame) {
                getOrCreateFrameClipRect(active);
                syncFrameClips(active);
            }
            safeAddWithUpdate(active);
            active.setCoords?.();
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }
        if (prop === 'cornerRadii') {
            applyToActiveOrSelection((o) => {
                if (!o) return;
                if (!value) {
                    if ((o as any).cornerRadii) delete (o as any).cornerRadii;
                    applyRectCornerRadiiPatch(o);
                    return;
                }
                const w = Number(o?.width || 0);
                const h = Number(o?.height || 0);
                (o as any).cornerRadii = clampCornerRadii(value, w || 1, h || 1);
                applyRectCornerRadiiPatch(o);
            });
            if (active.isFrame) {
                getOrCreateFrameClipRect(active);
                syncFrameClips(active);
            }
            safeAddWithUpdate(active);
            active.setCoords?.();
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }

        // Frames (Figma-like): moving the frame moves its descendants; clip toggle updates children.
        if (active.isFrame) {
            if (prop === 'left' || prop === 'top') {
                const prevLeft = active.left;
                const prevTop = active.top;
                active.set(prop, value);
                active.setCoords();

                const dx = active.left - prevLeft;
                const dy = active.top - prevTop;
                moveFrameDescendants(active, dx, dy);
                getOrCreateFrameClipRect(active);
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }

            if (prop === 'width' || prop === 'height') {
                if (prop === 'width') active.set({ width: Number(value), scaleX: 1 });
                if (prop === 'height') active.set({ height: Number(value), scaleY: 1 });
                active.setCoords();
                getOrCreateFrameClipRect(active);
                syncFrameClips(active);
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }

            if (prop === 'clipContent') {
                const newVal = !!value;
                active.set('clipContent', newVal);
                active.clipContent = newVal;
                refreshSelectedRef({ clipContent: newVal });

                syncFrameClips(active);
                safeRequestRenderAll();

                // FIX: Consolidate the two setTimeout calls into a single one that
                // renders first and then saves, ensuring correct execution order.
                // Previously, save (setTimeout 0ms) could execute before render (setTimeout 10ms),
                // causing stale state to be serialized.
                setTimeout(() => {
                    if (canvas.value) safeRequestRenderAll();
                    try { saveCurrentState(); } catch (err) {
                        console.warn('[clipContent] saveCurrentState falhou:', err)
                    }
                }, 10);
                return;
            }
        }

        if (isLikelyProductZone(active)) {
            ensureZoneSanity(active);
            if (prop === 'left' || prop === 'top') {
                const prevLeft = active.left;
                const prevTop = active.top;
                active.set(prop, value);
                active.setCoords();

                const dx = active.left - prevLeft;
                const dy = active.top - prevTop;
                moveZoneChildren(active, dx, dy);
                maybeReparentToFrameOnDrop(active);
                syncZoneCardFrameBindings(active);

                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }

            if (prop === 'width' || prop === 'height') {
                const zoneRect = getZoneRect(active);
                if (zoneRect) {
                    const nextWidth = prop === 'width' ? value : zoneRect.width;
                    const nextHeight = prop === 'height' ? value : zoneRect.height;

                    zoneRect.set({
                        width: nextWidth,
                        height: nextHeight,
                        scaleX: 1,
                        scaleY: 1
                    });

                    active.set({
                        scaleX: 1,
                        scaleY: 1
                    });

                    safeAddWithUpdate(active);
                    active.setCoords();
                    active._zoneWidth = nextWidth;
                    active._zoneHeight = nextHeight;

                    // Cache children before layout to avoid losing them
                    const cachedChildren = getZoneChildren(active);
                    recalculateZoneLayout(active, cachedChildren, { save: false, preserveStyles: true });
                    safeRequestRenderAll();
                    debouncedSaveCurrentState();
                    refreshSelectedRef();
                    return;
                }
            }

            if (prop === 'scaleX' || prop === 'scaleY') {
                // Cache children before layout
                const cachedChildren = getZoneChildren(active);
                active.set(prop, value);
                normalizeZoneScale(active);
                recalculateZoneLayout(active, cachedChildren, { save: false, preserveStyles: true });
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }
        }

        if (
            (prop === 'width' || prop === 'height') &&
            active.type !== 'activeSelection' &&
            !active.isFrame &&
            !isLikelyProductZone(active) &&
            (
                String(active.type || '').toLowerCase() === 'group' ||
                String(active.name || '') === 'priceGroup'
            )
        ) {
            const rawSize = Math.abs(Number(
                prop === 'width'
                    ? (active.getScaledWidth?.() ?? ((active.width || 0) * (active.scaleX || 1)))
                    : (active.getScaledHeight?.() ?? ((active.height || 0) * (active.scaleY || 1)))
            ) || 0);
            const desiredDisplaySize = Math.max(1, Number(value) || 0);
            if (rawSize > 0 && Number.isFinite(desiredDisplaySize)) {
                const scaleKey = prop === 'width' ? 'scaleX' : 'scaleY';
                const axis = prop === 'width' ? 'x' : 'y';
                const nextScaleRaw = (Math.abs(Number(active?.[scaleKey] ?? 1)) || 1) * (desiredDisplaySize / rawSize);
                const nextScale = updatePriceGroupManualScaleOverride(active, axis, nextScaleRaw) ?? Math.max(0.01, nextScaleRaw);
                active.set(scaleKey, nextScale);
                markInspectorTransformAsManual(active, scaleKey);
                markPriceGroupAsManuallyCustomized(active, { captureSnapshot: false });
                if (active.group) safeAddWithUpdate(active.group);
                active.setCoords?.();
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                snapshotExtra = undefined;
                selectedObjectRef.value = snapshotForPropertiesPanel(active);
                return;
            }
        }

        if (
            (prop === 'width' || prop === 'height') &&
            active.type !== 'activeSelection' &&
            !active.isFrame &&
            !isLikelyProductZone(active)
        ) {
            const type = String(active.type || '').toLowerCase();
            const desired = Math.max(1, Number(value) || 0);
            const bakeShapeSize = () => {
                active.set({ objectCaching: false, dirty: true, noScaleCache: true });
                try {
                    (active as any)._cacheCanvas = null;
                    (active as any)._cacheContext = null;
                    if (active.clipPath) {
                        active.clipPath.dirty = true;
                        active.clipPath._cacheCanvas = null;
                    }
                } catch {
                    // ignore
                }
                if (type === 'rect') applyRectCornerRadiiPatch(active);
                if ((active as any).parentFrameId) syncObjectFrameClip(active);
                if (active.group) safeAddWithUpdate(active.group);
                active.setCoords?.();
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                selectedObjectRef.value = snapshotForPropertiesPanel(active, snapshotExtra);
            };

            if (type === 'rect' || type === 'triangle') {
                if (prop === 'width') active.set({ width: desired, scaleX: 1 });
                else active.set({ height: desired, scaleY: 1 });
                if (type === 'rect') {
                    const nextW = Math.abs(Number(active.width || desired) || 1);
                    const nextH = Math.abs(Number(active.height || 1) || 1);
                    const maxRadius = Math.min(nextW / 2, nextH / 2);
                    const rx = Number(active.rx || 0);
                    if (rx > maxRadius) active.set({ rx: maxRadius, ry: maxRadius });
                }
                bakeShapeSize();
                return;
            }

            if (type === 'circle') {
                active.set({ radius: desired / 2, scaleX: 1, scaleY: 1 });
                bakeShapeSize();
                return;
            }

            if (type === 'ellipse') {
                if (prop === 'width') active.set({ rx: desired / 2, scaleX: 1 });
                else active.set({ ry: desired / 2, scaleY: 1 });
                bakeShapeSize();
                return;
            }
        }

        if (
            (prop === 'scaleX' || prop === 'scaleY') &&
            active.type !== 'activeSelection' &&
            String(active?.type || '').toLowerCase() === 'group' &&
            String(active?.name || '').trim() === 'priceGroup'
        ) {
            const axis = prop === 'scaleX' ? 'x' : 'y';
            const nextScale = updatePriceGroupManualScaleOverride(active, axis, value) ?? Math.max(0.01, Math.abs(Number(value)) || 1);
            active.set(prop, nextScale);
            markInspectorTransformAsManual(active, prop);
            markPriceGroupAsManuallyCustomized(active, { captureSnapshot: false });
            if (active.group) safeAddWithUpdate(active.group);
            active.setCoords?.();
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            snapshotExtra = { [prop]: nextScale };
            selectedObjectRef.value = snapshotForPropertiesPanel(active, snapshotExtra);
            return;
        }

        // Map common styling props to the correct child object when the selection is a group.
        // Fabric groups don't support fill/stroke/radius directly.
        if (isLikelyProductZone(active)) {
            const zoneRect = getZoneRect(active);
            if (zoneRect && ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'rx', 'ry'].includes(prop)) {
                if (prop === 'fill') zoneRect.set('fill', (value === null || value === undefined || value === '') ? 'transparent' : value);
                if (prop === 'stroke') zoneRect.set('stroke', value);
                if (prop === 'strokeWidth') zoneRect.set('strokeWidth', Number(value));
                if (prop === 'strokeDashArray') zoneRect.set('strokeDashArray', value);
                if (prop === 'rx') zoneRect.set({ rx: Number(value), ry: Number(value) });
                if (prop === 'ry') zoneRect.set('ry', Number(value));

                safeAddWithUpdate(active);
                active.setCoords();
                safeRequestRenderAll();
                flushPropertySave();
                refreshSelectedRef();
                return;
            }
        }

        if (active.type === 'group' && (active.isSmartObject || active.isProductCard)) {
            const bg = typeof active.getObjects === 'function'
                ? active.getObjects().find((o: any) => o.name === 'offerBackground')
                : null;
            if (bg && ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'rx', 'ry'].includes(prop)) {
                if (prop === 'fill') bg.set('fill', (value === null || value === undefined || value === '') ? 'transparent' : value);
                if (prop === 'stroke') bg.set('stroke', value);
                if (prop === 'strokeWidth') bg.set('strokeWidth', Number(value));
                if (prop === 'strokeDashArray') bg.set('strokeDashArray', value);
                if (prop === 'rx') bg.set({ rx: Number(value), ry: Number(value) });
                if (prop === 'ry') bg.set('ry', Number(value));

                safeAddWithUpdate(active);
                active.setCoords();
                safeRequestRenderAll();
                flushPropertySave();
                refreshSelectedRef();
                return;
            }
        }

        // --- Shadow Logic ---
        if (prop === 'shadow') {
            if (value === null) {
                active.set('shadow', null);
            } else {
                // Fabric Shadow Object
                active.set('shadow', new fabric.Shadow({
                    color: value.color || 'rgba(0,0,0,0.5)',
                    blur: value.blur || 10,
                    offsetX: value.x || 0,
                    offsetY: value.y || 4
                }));
            }
        }
        // Shadow sub-properties
        else if (prop.startsWith('shadow-')) {
            const currentShadow = active.shadow || new fabric.Shadow({ color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 0, offsetY: 0 });
            if (prop === 'shadow-x') currentShadow.offsetX = value;
            if (prop === 'shadow-y') currentShadow.offsetY = value;
            if (prop === 'shadow-blur') currentShadow.blur = value;
            if (prop === 'shadow-color') currentShadow.color = String(value || 'rgba(0,0,0,0.5)');
            if (prop === 'shadow-opacity') {
                const clamp01 = (n: any) => Math.min(1, Math.max(0, Number(n ?? 0)));
                const a = clamp01(value);
                const c = String(currentShadow.color || 'rgba(0,0,0,0.5)');
                const m = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+)\s*)?\)/i.exec(c);
                if (m) {
                    const r = Math.round(Number(m[1] || 0));
                    const g = Math.round(Number(m[2] || 0));
                    const b = Math.round(Number(m[3] || 0));
                    currentShadow.color = `rgba(${r},${g},${b},${a})`;
                } else if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
                    const hex = c.length === 4
                        ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
                        : c;
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    currentShadow.color = `rgba(${r},${g},${b},${a})`;
                } else {
                    currentShadow.color = `rgba(0,0,0,${a})`;
                }
            }
            active.set('shadow', currentShadow);
        }
        // Reset all supported effects on the selected object.
        else if (prop === 'effects-reset') {
            active.set('shadow', null);
            if (active.type === 'image' && typeof active.applyFilters === 'function') {
                active.filters = [];
                active.applyFilters();
            }
            active.dirty = true;
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }
        // --- Blur Filter ---
        else if (prop === 'blur') {
            // Only images support filters in Fabric; avoid crashing when blur is used on groups/shapes.
            active.blur = value; // Store value for UI
            if (active.type === 'image' && typeof active.applyFilters === 'function') {
                active.filters = Array.isArray(active.filters) ? active.filters : [];
                if (value === null) {
                    active.filters = active.filters.filter((f: any) => f.type !== 'Blur');
                } else {
                    active.filters = active.filters.filter((f: any) => f.type !== 'Blur');
                    active.filters.push(new fabric.filters.Blur({
                        blur: Number(value) / 20 // Normalize radius
                    }));
                }
                active.applyFilters();
            }
        }
        // --- Image Filters (Brightness/Contrast/Saturation) ---
        else if (prop.startsWith('filter-')) {
            const type = prop.replace('filter-', '');
            let filterName = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize

            if (active.type === 'image' && typeof active.applyFilters === 'function') {
                active.filters = Array.isArray(active.filters) ? active.filters : [];
                // Remove existing filter of same type
                // Special cases:
                // - `hue` is HueRotation (rotation: -1..1)
                // - `blur` is Blur (blur: 0..1) but UI uses px-like 0..20
                // - `grayscale|sepia|invert` are boolean toggles
                let shouldAdd = value !== 0;
                let options: any = {};
                if (type === 'hue') {
                    filterName = 'HueRotation';
                    options = { rotation: Number(value) || 0 };
                    shouldAdd = Number(value) !== 0;
                } else if (type === 'blur') {
                    filterName = 'Blur';
                    const px = Math.max(0, Number(value) || 0);
                    const normalized = Math.min(1, px / 20);
                    options = { blur: normalized };
                    shouldAdd = normalized !== 0;
                } else if (type === 'grayscale' || type === 'sepia' || type === 'invert') {
                    shouldAdd = !!value;
                    options = {};
                } else {
                    options[type] = value;
                    shouldAdd = value !== 0;
                }

                active.filters = active.filters.filter((f: any) => f?.type !== filterName);

                // Add new filter if value is not 0 (or neutral)
                if (shouldAdd) {
                    // Fabric.js 7: filters are in fabric.filters, not fabric.Image.filters
                    active.filters.push(new (fabric.filters as any)[filterName](options));
                }

                active.applyFilters();
                active.dirty = true;
            }
        }
        else if (prop === 'filters-reset') {
            if (active.type === 'image' && typeof active.applyFilters === 'function') {
                active.filters = [];
                active.applyFilters();
                active.dirty = true;
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
            }
            return;
        }
        // --- Gradient Logic (Simple Linear) ---
        else if (prop === 'fill-gradient') {
             // Basic Gradient Mock
             const grad = new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: active.width, y2: active.height },
                colorStops: [
                    { offset: 0, color: 'red' },
                    { offset: 1, color: '#8b5cf6' }
                ]
             });
             active.set('fill', grad);
        }
        // --- Text Advanced ---
        else if (prop === 'lineHeight' || prop === 'charSpacing') {
             active.set(prop, value);
             // Fabric requires initDimensions for text layout changes sometimes
             if(active.initDimensions) active.initDimensions();
             if (isDynamicBusinessFieldObject(active)) fitDynamicBusinessTextObject(active);
        }
        // --- Stroke Properties (for regular objects, not just brush) ---
        else if (prop === 'strokeLineCap' || prop === 'strokeLineJoin') {
            applyToActiveOrSelection((o) => {
                o?.set?.(prop, value);
            });
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }
        else if (prop === 'strokePosition' || prop === 'strokeMiterLimit') {
            // Vector path specific properties
            if (active.isVectorPath) {
                active.set(prop, value);
                safeRequestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
            }
            return;
        }
        // --- Opacity & Blend Mode ---
        else if (prop === 'opacity' || prop === 'globalCompositeOperation') {
            applyToActiveOrSelection((o) => {
                o?.set?.(prop, value);
            });
            safeRequestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }
        // --- Standard Props ---
        else {
             // If switching back to uniform rx/ry, clear per-corner state.
             if ((prop === 'rx' || prop === 'ry') && styleTarget && (styleTarget as any).cornerRadii) {
                 delete (styleTarget as any).cornerRadii;
                 applyRectCornerRadiiPatch(styleTarget);
                 if (active.isFrame) {
                    getOrCreateFrameClipRect(active);
                    syncFrameClips(active);
                 }
             }
            const dynamicActive = isDynamicBusinessFieldObject(active);
            const dynamicLayoutProp = dynamicActive && [
                'width', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
                'lineHeight', 'charSpacing', 'textAlign', 'strokeWidth'
            ].includes(prop);
            if (dynamicActive && prop === 'fontSize') {
                const requestedFontSize = Number(value);
                if (Number.isFinite(requestedFontSize) && requestedFontSize > 0) {
                    // Uma alteracao feita pelo usuario vira o novo limite-base;
                    // o auto-fit nao deve desfazer essa escolha na proxima
                    // troca de endereco, slogan ou validade.
                    active.set({
                        dynamicFieldBaseFontSize: requestedFontSize,
                        dynamicFieldAutoFitFontSize: requestedFontSize
                    });
                }
            }
            active.set(prop, value);
            if (dynamicActive && prop === 'height') {
                // A altura do campo e independente da tipografia. Nao chamar
                // initDimensions depois deste ajuste, pois o Textbox voltaria
                // a substituir a altura manual pela altura natural do texto.
                const requestedHeight = Number(value);
                if (Number.isFinite(requestedHeight) && requestedHeight > 0) {
                    active.set({ height: requestedHeight, dynamicFieldHeight: requestedHeight });
                }
            } else if (isTextStyleObject(active) && typeof active.initDimensions === 'function') {
                active.initDimensions();
                active.dirty = true;
            }
            if (
                prop === 'width' &&
                String(active.type || '').toLowerCase() === 'textbox' &&
                active.group &&
                (active.group.isSmartObject || active.group.isProductCard || isLikelyProductCard(active.group))
             ) {
                const cardGroup = active.group;
                const cardW = Number((cardGroup as any)?._cardWidth ?? cardGroup?.width ?? cardGroup?.getScaledWidth?.() ?? 0);
                const cardH = Number((cardGroup as any)?._cardHeight ?? cardGroup?.height ?? cardGroup?.getScaledHeight?.() ?? 0);
                const maxCardW = Number.isFinite(cardW) && cardW > 0 ? Math.max(20, cardW) : Number.POSITIVE_INFINITY;
                const safeW = Math.min(maxCardW, Math.max(20, Number(active.width || value) || 0));
                active.set({ width: safeW, scaleX: 1 });
                (active as any).__manualTransform = true;
                (active as any).__manualTextWidth = safeW;
                if (Number.isFinite(cardW) && cardW > 0) {
                    (active as any).__manualTextWidthRatio = Math.min(1, Math.max(0.1, safeW / cardW));
                    (active as any).__manualTransformCardW = cardW;
                }
                if (Number.isFinite(cardH) && cardH > 0) {
                    (active as any).__manualTransformCardH = cardH;
                }
                syncCardProductDataTitleWidthFromTarget(active);
             }
            if (
                String(active.type || '').toLowerCase() === 'image' &&
                active.group &&
                (active.group.isSmartObject || active.group.isProductCard || isLikelyProductCard(active.group)) &&
                (prop === 'scaleX' || prop === 'scaleY' || prop === 'flipX' || prop === 'flipY')
             ) {
                active.set({
                    scaleX: Math.abs(Number(active.scaleX ?? 1)) || 1,
                    scaleY: Math.abs(Number(active.scaleY ?? 1)) || 1,
                    flipX: false,
                    flipY: false,
                    lockScalingFlip: true,
                    lockSkewingX: true,
                    lockSkewingY: true
                });
                applyContainmentConstraints(active);
            }
            if (dynamicLayoutProp || (dynamicActive && prop === 'height')) {
                fitDynamicBusinessTextObject(active);
            }
            if (isQuickLogoImageObject(active)) syncQuickLogoBackdrop(active);
        }

        markInspectorTransformAsManual(active, prop);
        markPriceGroupAsManuallyCustomized(active);

        // If it's a group, we might want to dirty it
        if (active.group) safeAddWithUpdate(active.group);

        // REALTIME: Render immediately for instant visual feedback
        active.setCoords?.();
        safeRequestRenderAll();

        // PERSIST: Debounced save to avoid lag during rapid input
        debouncedSaveCurrentState();

        // Force update ref for UI sync — create fresh snapshot so Vue detects prop change
        selectedObjectRef.value = snapshotForPropertiesPanel(active, snapshotExtra);
    }
}

const handleAction = async (action: string) => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();

    if (action === 'copy' || action === 'paste-editor-copy') {
        await runEditorClipboardCommand(action === 'copy' ? 'copy' : 'paste');
        return;
    }

    // Delete (button/menu, important for touch/tablet where keyboard delete is unavailable)
    if (action === 'delete') {
        deleteActiveSelectionFromCanvas();
        return;
    }

    // Duplicate (button/menu)
    if (action === 'duplicate') {
        if (!active) return;
        const activeLayerName = String((active as any)?.layerName || '').trim().toUpperCase();
        const activeName = String((active as any)?.name || '').trim();
        const looksLikeFrame = !!(active as any)?.isFrame ||
            activeLayerName === 'FRAMER' ||
            activeLayerName === 'FRAME' ||
            /^FRAME(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(activeName) ||
            /^FRAMER(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(activeName);
        if (looksLikeFrame) {
            const duplicatedFrame = await duplicateFrameWithContents(active);
            if (duplicatedFrame) return;
        }
        if (isLikelyProductZone(active)) {
            const clones = await duplicateProductZoneWithCards(active, { offsetX: DUPLICATE_OFFSET, offsetY: DUPLICATE_OFFSET });
            if (clones.length) {
                saveCurrentState({ reason: 'duplicate-zone-action' });
                return;
            }
        }
        // Keep every duplicate entry point consistent for product images:
        // same transform and immediately above the source, with no generic
        // canvas offset or card relayout.
        if (resolveSelectedProductImageActionContext(active)) {
            await handleProductImageDuplicate();
            return;
        }
        try {
            const clones = await duplicateActiveObjectWithContext(active, { offsetX: DUPLICATE_OFFSET, offsetY: DUPLICATE_OFFSET });
            if (!clones.length) return;
            finalizeDuplicatedObjects(clones);
            saveCurrentState({ reason: 'duplicate-action' });
        } catch (err) {
            console.warn('[duplicate] Falha ao duplicar (action)', err);
        }
        return;
    }

    // AI edit current image (mask workflow) - replaces the selected image in the design.
    if (action === 'ai-edit-image') {
        const found = findImageTargetInSelection(active);
        if (!found?.img) {
            notifyEditorError('Selecione uma imagem primeiro');
            return;
        }
        const img = found.img;
        const imageUrl = (img as any).src || (img as any)._element?.src || (typeof (img as any).getSrc === 'function' ? (img as any).getSrc() : null);
        if (!imageUrl) {
            notifyEditorError('Não foi possível obter a URL da imagem. Tente usar uma imagem do storage.');
            return;
        }
        if (!(img as any)._customId) (img as any)._customId = makeId();

        aiStudio.openStudio({
            initial: {
                mode: 'edit',
                baseImageUrl: String(imageUrl),
                size: guessAiSizeFromObject(img),
                filenameBase: 'ai-edit',
                transparent: false,
                removeBg: false
            },
            applyMode: 'replace',
            replaceTargetId: String((img as any)._customId)
        });
        return;
    }

    if (action === 'auto-trim-image') {
        const frameTarget = active?.isFrame ? active : null;
        const found = findImageTargetInSelection(active);
        const activeType = String(active?.type || '').toLowerCase();
        const containerTarget = active && (
            frameTarget ||
            activeType === 'group' ||
            activeType === 'activeselection' ||
            isLikelyProductZone(active)
        ) ? active : null;
        const target = containerTarget || found?.img;
        if (!target) {
            notifyEditorError('Selecione uma imagem, grupo ou frame primeiro.');
            return;
        }

        const trimmed = trimContainerEmptySpace(target);
        if (!trimmed) {
            notifyEditorInfo('O conteúdo já está rente ou não há espaço transparente para aparar.');
            return;
        }

        found?.parent?.setCoords?.();
        if (found?.parent) safeAddWithUpdate(found.parent);
        target.setCoords?.();
        canvas.value.setActiveObject(containerTarget || found?.img || target);
        applyVisibleSelectionChrome(canvas.value.getActiveObject?.());
        safeRequestRenderAll();
        refreshCanvasObjects();
        updateSelection();
        saveCurrentState({ reason: 'auto-trim-image' });
        notifyEditorInfo('Espaço transparente aparado.');
        return;
    }

    // Product card image flows:
    // - replace from local file
    // - replace from uploads
    // - add local file without replacing current image
    // - add from uploads without replacing current image
    if (
        action === 'replace-product-image' ||
        action === 'replace-product-image-upload' ||
        action === 'add-product-image-local' ||
        action === 'add-product-image-upload'
    ) {
        const ctx = resolveSelectedProductCardContext(active);
        const card = ctx.card;
        const image = ctx.image;

        if (!card) {
            notifyEditorError('Selecione um card de produto primeiro.');
            return;
        }
        if (!(card as any)._customId) (card as any)._customId = makeCanvasObjectId();

        if (action === 'replace-product-image') {
            if (image && !(image as any)._customId) (image as any)._customId = makeCanvasObjectId();
            if (image?._customId) {
                openLocalProductImagePicker('replace', { imageId: String(image._customId) });
            } else {
                openLocalProductImagePicker('add', { cardId: String((card as any)._customId) });
            }
            return;
        }

        if (action === 'replace-product-image-upload') {
            if (image && !(image as any)._customId) (image as any)._customId = makeCanvasObjectId();
            if (image?._customId) {
                await openProductImageUploadPickerModal('replace', { imageId: String(image._customId) });
            } else {
                await openProductImageUploadPickerModal('add', { cardId: String((card as any)._customId) });
            }
            return;
        }

        if (action === 'add-product-image-local') {
            openLocalProductImagePicker('add', { cardId: String((card as any)._customId) });
            return;
        }

        if (action === 'add-product-image-upload') {
            await openProductImageUploadPickerModal('add', { cardId: String((card as any)._customId) });
            return;
        }
    }

    // Remove Image Background
    if (action === 'remove-image-bg') {
        if (!active) {
            console.warn('⚠️ [Remove BG] Nenhum objeto selecionado');
            notifyEditorError('Selecione uma imagem primeiro');
            return;
        }

        // Check if it's an image (direct) or a group/selection containing an image
        let targetImage = active;
        let imageUrl = null;

        if (active.type === 'image') {
            imageUrl = active.src || (active as any)._element?.src || (active as any).getSrc();
        } else if (active.type === 'group' || active.type === 'activeSelection') {
            const objects = typeof active.getObjects === 'function' ? active.getObjects() : [];
            const foundImage = objects.find((o: any) => o.type === 'image');
            if (foundImage) {
                targetImage = foundImage;
                imageUrl = foundImage.src || (foundImage as any)._element?.src || foundImage.getSrc();
            }
        } else {
            console.warn('⚠️ [Remove BG] Tipo de objeto não suportado:', active.type);
            notifyEditorError('Selecione uma imagem válida');
            return;
        }

        if (!imageUrl) {
            console.warn('⚠️ [Remove BG] Imagem não tem URL');
            notifyEditorError('Não foi possível obter a URL da imagem. Tente usar uma imagem do storage.');
            return;
        }

        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'fixed top-4 right-4 bg-zinc-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 border border-white/10';
        loadingIndicator.innerHTML = '<span class="animate-spin mr-2">⟳</span> Removendo fundo...';
        document.body.appendChild(loadingIndicator);

        try {
            const request = await buildRemoveBgRequest(imageUrl);
            const headers = await getApiAuthHeaders();
            const result = await $fetch('/api/remove-image-bg', {
                method: 'POST',
                headers,
                ...(request as any)
            }) as any;

            if (result?.url) {
                const proxiedBgUrl = toWasabiProxyUrl(result.url) || result.url;
                const cacheBustedBgUrl = (() => {
                    try {
                        const u = new URL(proxiedBgUrl, window.location.origin);
                        if (!u.searchParams.get('v')) u.searchParams.set('v', String(Date.now()));
                        return u.toString();
                    } catch {
                        const sep = proxiedBgUrl.includes('?') ? '&' : '?';
                        return `${proxiedBgUrl}${sep}v=${Date.now()}`;
                    }
                })();

                const newImg: any = await fabric.Image.fromURL(cacheBustedBgUrl, { crossOrigin: 'anonymous' });
                if (!newImg || !canvas.value) {
                    throw new Error('Falha ao carregar imagem processada');
                }

                await autoTrimFabricImageAsync(newImg, { preserveVisualPosition: true });
                markProductImageTrimmed(newImg);

                const oldDisplayWidth = (targetImage.width || 1) * (targetImage.scaleX || 1);
                const oldDisplayHeight = (targetImage.height || 1) * (targetImage.scaleY || 1);
                const newWidth = newImg.width || 1;
                const newHeight = newImg.height || 1;
                const newScaleX = oldDisplayWidth / newWidth;
                const newScaleY = oldDisplayHeight / newHeight;

                // For groups/selections, replace the image inside
                if (active.type === 'group' || active.type === 'activeSelection') {
                    const objects = typeof active.getObjects === 'function' ? active.getObjects() : [];
                    const imgIndex = objects.findIndex((o: any) => o.type === 'image');
                    if (imgIndex >= 0) {
                        const oldImg = objects[imgIndex];
                        active.remove(oldImg);
                        // FIX: Dispose old image to free memory (canvas element + bitmap)
                        try { oldImg.dispose?.(); } catch {}
                        (newImg as any).src = cacheBustedBgUrl;
                        newImg.set({
                            left: oldImg.left,
                            top: oldImg.top,
                            scaleX: newScaleX,
                            scaleY: newScaleY,
                            angle: oldImg.angle || 0,
                            originX: oldImg.originX || 'center',
                            originY: oldImg.originY || 'center',
                            name: (oldImg as any).name,
                            _customId: (oldImg as any)._customId,
                            opacity: (oldImg as any).opacity,
                            flipX: (oldImg as any).flipX,
                            flipY: (oldImg as any).flipY,
                            clipPath: (oldImg as any).clipPath,
                            filters: (oldImg as any).filters
                        });
                        if (typeof (active as any).insertAt === 'function') {
                            (active as any).insertAt(imgIndex, newImg);
                        } else {
                            active.add(newImg);
                        }
                        safeAddWithUpdate(active);
                        active.setCoords();
                    }
                } else {
                    // Preserve ALL properties from current image
                    const propsToPreserve = {
                        left: active.left,
                        top: active.top,
                        scaleX: newScaleX,
                        scaleY: newScaleY,
                        angle: active.angle,
                        originX: active.originX,
                        originY: active.originY,
                        selectable: active.selectable,
                        evented: active.evented,
                        hasControls: active.hasControls,
                        hasBorders: active.hasBorders,
                        _customId: (active as any)._customId,
                        name: (active as any).name,
                        opacity: (active as any).opacity,
                        flipX: (active as any).flipX,
                        flipY: (active as any).flipY,
                        clipPath: (active as any).clipPath,
                        filters: (active as any).filters,
                        src: cacheBustedBgUrl
                    };

                    newImg.set(propsToPreserve);
                    (newImg as any).src = cacheBustedBgUrl;

                    // Remove old image and add new one
                    const oldIndex = canvas.value.getObjects().indexOf(active);
                    canvas.value.remove(active);
                    if (oldIndex >= 0 && typeof (canvas.value as any).insertAt === 'function') {
                        (canvas.value as any).insertAt(oldIndex, newImg);
                    } else {
                        canvas.value.add(newImg);
                    }
                }

                canvas.value.setActiveObject(active.type === 'group' ? active : newImg);
                safeRequestRenderAll();
                saveCurrentState();
            } else {
                throw new Error('API não retornou URL válida');
            }
        } catch (err: any) {
            console.error('❌ [Remove BG] Erro ao remover fundo:', err);
            const serverMessage = String(
                err?.data?.statusMessage ||
                err?.data?.message ||
                err?.statusMessage ||
                err?.message ||
                'Erro desconhecido'
            );
            notifyEditorError('Erro ao remover fundo: ' + serverMessage);
        } finally {
            loadingIndicator?.remove();
        }
        return;
    }

    // Export actions
    if (action === 'export-selected' || action === 'export-png' || action === 'export-svg' || action === 'export-jpg') {
        if (!active) {
            notifyEditorInfo('Selecione um objeto para exportar.');
        } else {
            await exportSelectedObject(action.replace('export-', '') as 'png' | 'svg' | 'jpg', active)
        }
        return
    }

    // Group / Ungroup
    if (action === 'group') {
        if (!active || active.type !== 'activeSelection') return;

        // CRITICAL: Check if all objects are in the same frame
        const objects = active.getObjects();
        const parentFrames = new Set(objects.map((o: any) => o.parentFrameId).filter(Boolean));

        if (parentFrames.size > 1) {
            // Objects are in different frames - prevent grouping
            notifyEditorError('Não é possível agrupar objetos de frames diferentes. Mova os objetos para o mesmo frame primeiro.');
            return;
        }

        active.toGroup();
        safeRequestRenderAll();
        saveCurrentState();

        // Update selection to the new group and preserve parentFrameId
	        const newGroup = canvas.value.getActiveObject();
	        if (newGroup) {
	            if (!newGroup._customId) newGroup._customId = makeId();
	            // Preserve parentFrameId from the objects (they all have the same one at this point)
	            if (parentFrames.size === 1) {
	                newGroup.parentFrameId = [...parentFrames][0];
	            }
	            selectedObjectRef.value = snapshotForPropertiesPanel(newGroup);
	        }
	        return;
	    }
    if (action === 'ungroup') {
        if (!active || active.type !== 'group') return;

        // Preserve parentFrameId before ungrouping
        const parentFrameId = (active as any).parentFrameId;
        const objects = active.getObjects();
        const customIds = objects.map((o: any) => o._customId);

        active.toActiveSelection();
        safeRequestRenderAll();
        saveCurrentState();

        // Restore parentFrameId to all children after ungrouping
        const newSelection = canvas.value.getActiveObject();
        if (newSelection && parentFrameId) {
            newSelection.getObjects().forEach((o: any) => {
                o.parentFrameId = parentFrameId;
            });
	        }

	        // Update selection
	        selectedObjectRef.value = snapshotForPropertiesPanel(canvas.value.getActiveObject());
	        return;
	    }

    // Flip
    if (action === 'flip-h') {
        if (!active) return;
        if (
            String(active.type || '').toLowerCase() === 'image' &&
            active.group &&
            (active.group.isSmartObject || active.group.isProductCard || isLikelyProductCard(active.group))
        ) {
            active.set({ flipX: false, flipY: false, lockScalingFlip: true });
            safeRequestRenderAll();
            saveCurrentState();
            return;
        }
        active.set('flipX', !active.flipX);
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }
    if (action === 'flip-v') {
        if (!active) return;
        if (
            String(active.type || '').toLowerCase() === 'image' &&
            active.group &&
            (active.group.isSmartObject || active.group.isProductCard || isLikelyProductCard(active.group))
        ) {
            active.set({ flipX: false, flipY: false, lockScalingFlip: true });
            safeRequestRenderAll();
            saveCurrentState();
            return;
        }
        active.set('flipY', !active.flipY);
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    // Masking (Framer/Figma-like)
    if (action === 'toggle-mask') {
        if (!active) return;
        const checkpointMaskUndo = async () => {
            if (cancelPendingCoalescedSave) cancelPendingCoalescedSave();
            await Promise.resolve(saveCurrentState({ reason: 'mask-checkpoint', skipCoalesce: true }));
        };

        if (String(active.type || '').toLowerCase() === 'activeselection') {
            const members = typeof active.getObjects === 'function' ? (active.getObjects() || []) : [];
            const clearable = members.filter((obj: any) => hasObjectMaskApplied(obj));

            if (clearable.length > 0 && clearable.length === members.length) {
                await checkpointMaskUndo();
                clearable.forEach((obj: any) => clearObjectMaskFromObject(obj));
                safeRequestRenderAll();
                refreshCanvasObjects();
                updateSelection();
                if (cancelPendingCoalescedSave) cancelPendingCoalescedSave();
                await Promise.resolve(saveCurrentState({ reason: 'remove-object-mask-selection', skipCoalesce: true }));
                return;
            }

            await checkpointMaskUndo();
            const appliedCount = await applyObjectMaskFromSelection(active);
            if (appliedCount <= 0) {
                notifyEditorInfo('Selecione ao menos 2 objetos no mesmo frame (ou fora). O de baixo vira a máscara.');
                return;
            }

            safeRequestRenderAll();
            refreshCanvasObjects();
            updateSelection();
            if (cancelPendingCoalescedSave) cancelPendingCoalescedSave();
            await Promise.resolve(saveCurrentState({ reason: 'apply-object-mask', skipCoalesce: true }));
            return;
        }

        if (hasObjectMaskApplied(active)) {
            await checkpointMaskUndo();
            clearObjectMaskFromObject(active);
            safeRequestRenderAll();
            refreshCanvasObjects();
            updateSelection();
            if (cancelPendingCoalescedSave) cancelPendingCoalescedSave();
            await Promise.resolve(saveCurrentState({ reason: 'remove-object-mask', skipCoalesce: true }));
            return;
        }

        await checkpointMaskUndo();
        const appliedSingle = await applyObjectMaskFromSingleTarget(active);
        if (appliedSingle) {
            safeRequestRenderAll();
            refreshCanvasObjects();
            updateSelection();
            if (cancelPendingCoalescedSave) cancelPendingCoalescedSave();
            await Promise.resolve(saveCurrentState({ reason: 'apply-object-mask-single', skipCoalesce: true }));
            return;
        }

        notifyEditorInfo('Selecione um objeto com outro logo abaixo na pilha para usar como máscara.');
        return;
    }

    // === Figma-style Crop ===
    if (action === 'activate-crop') {
        if (!active) return;
        figmaCrop.activateCrop(active);
        return;
    }

    if (action === 'apply-crop') {
        if (!figmaCrop.cropTargetObject.value) return;
        figmaCrop.applyCrop(figmaCrop.cropFrameRect.value);
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    if (action === 'cancel-crop') {
        figmaCrop.cancelCrop();
        safeRequestRenderAll();
        return;
    }

    // --- Align / Center (Inspector actions) ---
    if (action === 'align-top') { alignSelectionVertically('top'); return; }
    if (action === 'align-middle') { alignSelectionVertically('middle'); return; }
    if (action === 'align-bottom') { alignSelectionVertically('bottom'); return; }
    if (action === 'center-h') { centerSelectionInContainer('h'); return; }
    if (action === 'center-v') { centerSelectionInContainer('v'); return; }
    if (action === 'center-both') { centerSelectionInContainer('both'); return; }

    // Gap / Spacing Update
    if (action.startsWith('update-gap:') || action.startsWith('update-padding-')) {
        const isGap = action.startsWith('update-gap:');
        const isPadX = action.startsWith('update-padding-x:');
        const isPadY = action.startsWith('update-padding-y:');
        const val = parseInt(action.split(':')[1] || '0') || 0;

        if (!active || (active.type !== 'activeSelection' && active.type !== 'group')) return;

        if (isGap) active.gap = val;
        if (isPadX) active.paddingX = val;
        if (isPadY) active.paddingY = val;

        const gap = active.gap || 0;
        const padX = active.paddingX || 0;
        const padY = active.paddingY || 0;

        const objects = active.getObjects();
        if (objects.length < 1) return;

        // Sort by left (assuming horizontal auto-layout for now)
        objects.sort((a: any, b: any) => a.left - b.left);

        // Calculate new positions based on gap
        let currentPos = objects[0].left; // Start at first object's original left?
        // Better: Start at group left + padX if it's a group
        if (active.type === 'group') {
             // Fabric group coords are relative to group center usually, but here lets simplify
             // We'll re-layout items relative to each other
             let totalWidth = 0;
             objects.forEach((obj: any, i: number) => {
                 obj.set('left', totalWidth); // Local coord inside group?
                 totalWidth += (obj.width * obj.scaleX) + gap;
             });
             // Remove last gap
             totalWidth -= gap;

             // Update Group Width (Hug Contents Logic)
             active.set('width', totalWidth + (padX * 2));
             active.set('height', active.height + (padY * 2)); // Simplistic height hug

             // Center items
             const startX = -active.width / 2 + padX;
             const startY = -active.height / 2 + padY;

             let x = startX;
             objects.forEach((obj: any) => {
                 obj.set('left', x + (obj.width * obj.scaleX) / 2); // Origin center correction
                 obj.set('top', startY + (obj.height * obj.scaleY) / 2);
                 x += (obj.width * obj.scaleX) + gap;
             });

             safeAddWithUpdate(active);
        } else {
            // Active Selection (Temporary layout)
            let currentX = objects[0].left;
            objects.forEach((obj: any, i: number) => {
                if (i > 0) {
                    const prevObj = objects[i-1];
                    currentX = prevObj.left + (prevObj.width * prevObj.scaleX) + gap;
                    obj.set('left', currentX);
                }
            });
            safeAddWithUpdate(active);
        }

        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    // Layout Modes
    if (action === 'layout-hug') {
        if (!active || active.type !== 'group') return;
        // Hug Logic: Resize group to fit children + padding
        // Already handled in gap update mostly, but let's force a re-calc
        const objects = active.getObjects();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        objects.forEach((obj: any) => {
            if(obj.left < minX) minX = obj.left;
            if(obj.top < minY) minY = obj.top;
            if(obj.left + obj.width * obj.scaleX > maxX) maxX = obj.left + obj.width * obj.scaleX;
            if(obj.top + obj.height * obj.scaleY > maxY) maxY = obj.top + obj.height * obj.scaleY;
        });

        const padX = active.paddingX || 0;
        const padY = active.paddingY || 0;

        active.set({
            width: (maxX - minX) + (padX * 2),
            height: (maxY - minY) + (padY * 2)
        });
        safeAddWithUpdate(active);
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    if (action === 'layout-fill') {
        if (!active || active.type !== 'group') return;
        // Fill Logic: Resize children to fill group width
        const padX = active.paddingX || 0;
        const availableWidth = active.width - (padX * 2);
        const objects = active.getObjects();

        objects.forEach((obj: any) => {
            // Simple Fill: Stretch all items to match container width
            // This is "Vertical Auto Layout" behavior usually
            const scaleX = availableWidth / obj.width;
            obj.set('scaleX', scaleX);
        });
        safeAddWithUpdate(active);
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    // Components (Make Component)
    if (action === 'create-component') {
        if (!active) return;

        // Convert to group if selection
        let target = active;
        if (active.type === 'activeSelection') {
            active.toGroup();
            target = canvas.value.getActiveObject();
        }

        if (target) {
            target.isComponent = true;
            // Visual indicator: Purple Border
            target.set({
                borderColor: '#8b5cf6', // Violet-500
                cornerColor: '#8b5cf6',
                cornerStrokeColor: '#fff',
                borderDashArray: [0, 0], // Solid
                padding: 5
            });

            // Add label? Fabric doesn't support easy labels outside,
            // but we could group with text or just use properties panel.

            safeRequestRenderAll();
            saveCurrentState();
            // Force Update UI
            selectedObjectRef.value = snapshotForPropertiesPanel(target);
        }
        return;
    }

    // Path Operations (Vector Paths)
    if (action === 'close-path') {
        closePath();
        return;
    }

    if (action === 'simplify-path') {
        simplifyPath();
        return;
    }

    if (action === 'split-path') {
        splitPath();
        return;
    }

    if (action === 'add-path-point') {
        // Add point to path at midpoint of selected segment
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (!isNodeEditing.value) {
            enterPathNodeEditing(active);
        }
        // Note: Point will be added on click on segment (handled in mouse:down)
        return;
    }

    if (action === 'delete-path-point') {
        // Delete selected point from path
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            removePathPoint(active, selectedPathNodeIndex.value);
        }
        return;
    }

    if (action === 'toggle-handles') {
        // Toggle bezier handles visibility/editing
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (isNodeEditing.value) {
            exitNodeEditing();
        } else {
            enterPathNodeEditing(active);
        }
        return;
    }

    // Curve conversion functions
    if (action === 'convert-to-smooth') {
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            convertPointToSmooth(active, selectedPathNodeIndex.value);
        }
        return;
    }

    if (action === 'convert-to-corner') {
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            convertPointToCorner(active, selectedPathNodeIndex.value);
        }
        return;
    }

    if (action === 'mirror-handles') {
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            mirrorHandles(active, selectedPathNodeIndex.value);
        }
        return;
    }

    if (action === 'reset-handles') {
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            resetHandles(active, selectedPathNodeIndex.value);
        }
        return;
    }

    if (action === 'smooth-handles') {
        const active = canvas.value.getActiveObject();
        if (!active || !active.isVectorPath) return;
        if (selectedPathNodeIndex.value !== null) {
            smoothHandles(active, selectedPathNodeIndex.value);
        }
        return;
    }

    // Boolean Operations (Simplified via globalCompositeOperation or Grouping)
    if (action === 'union' || action === 'subtract') {
        if (!active || active.type !== 'activeSelection') return;

        // In Figma, Boolean Ops are live groups.
        // Here we'll simulate it by creating a special group or flattening.
        // For 'subtract', the top objects will cut the bottom one.
        const objects = active.getObjects();
        const topObj = objects[objects.length - 1];
        const bottomObj = objects[0];

        if (action === 'subtract') {
            // Fabric can use clipPath for this
            bottomObj.set('clipPath', topObj);
            // topObj.visible = false; // Usually the cutter is hidden or used as mask
            // This is a simplified mock of Boolean.
        }

        active.toGroup();
        safeRequestRenderAll();
        saveCurrentState();
        return;
    }

    if (action === 'text-3d-gold' || action === 'text-gradient-gold' || action === 'text-gradient-sunset' || action === 'text-3d-clear') {
        const textTarget = resolveActiveTextObjectForInspectorAction(active);
        if (!textTarget) {
            notifyEditorInfo('Selecione um texto para aplicar o efeito.');
            return;
        }

        if (action === 'text-3d-gold') {
            applyText3DGoldPreset(textTarget);
        } else if (action === 'text-gradient-gold') {
            applyTextGradientPreset(textTarget, 'gold');
        } else if (action === 'text-gradient-sunset') {
            applyTextGradientPreset(textTarget, 'sunset');
        } else {
            clearText3DEffect(textTarget);
        }

        if (textTarget.group) safeAddWithUpdate(textTarget.group);
        textTarget.setCoords?.();
        selectedObjectRef.value = snapshotForPropertiesPanel(textTarget);
        safeRequestRenderAll();
        saveCurrentState({ reason: action });
        return;
    }

    // Text Case
    if (action === 'text-upper') {
        const target = resolveActiveTextObjectForInspectorAction(active);
        if (!target) return;
        applyDynamicBusinessTextCase(target, 'upper');
        if (isDynamicBusinessFieldObject(target)) fitDynamicBusinessTextObject(target);
        target.dirty = true;
        target.group?.set?.('dirty', true);
        target.group?.setCoords?.();
        target.setCoords?.();
        selectedObjectRef.value = snapshotForPropertiesPanel(target);
        safeRequestRenderAll();
        await Promise.resolve(saveCurrentState({
            reason: 'text-case:upper',
            source: 'user',
            skipCoalesce: true,
            skipIfUnchanged: false
        }));
        await flushPersistenceNow('text-case:upper', { force: true });
        return;
    }
    if (action === 'text-lower') {
        const target = resolveActiveTextObjectForInspectorAction(active);
        if (!target) return;
        applyDynamicBusinessTextCase(target, 'lower');
        if (isDynamicBusinessFieldObject(target)) fitDynamicBusinessTextObject(target);
        target.dirty = true;
        target.group?.set?.('dirty', true);
        target.group?.setCoords?.();
        target.setCoords?.();
        selectedObjectRef.value = snapshotForPropertiesPanel(target);
        safeRequestRenderAll();
        await Promise.resolve(saveCurrentState({
            reason: 'text-case:lower',
            source: 'user',
            skipCoalesce: true,
            skipIfUnchanged: false
        }));
        await flushPersistenceNow('text-case:lower', { force: true });
        return;
    }

    // Distribute (Requires Active Selection)
    if (action.startsWith('distribute-') && active && active.type === 'activeSelection') {
        if (!fabric?.Point) return;
        const objects = (typeof active.getObjects === 'function') ? (active.getObjects() || []) : [];
        if (objects.length < 3) return; // Need 3+ for meaningful distribution

        if (action === 'distribute-h') {
            const items = objects.map((obj: any) => {
                const br = obj.getBoundingRect?.(true) || { left: obj.left || 0, top: obj.top || 0, width: 0, height: 0 };
                return {
                    obj,
                    left: Number(br.left || 0),
                    right: Number(br.left || 0) + Number(br.width || 0),
                    width: Number(br.width || 0)
                };
            }).sort((a: any, b: any) => a.left - b.left);

            const minLeft = items[0].left;
            const maxRight = items[items.length - 1].right;
            const totalWidth = items.reduce((sum: number, it: any) => sum + it.width, 0);
            const gap = Math.max(0, (maxRight - minLeft - totalWidth) / (items.length - 1));

            let cursor = minLeft;
            for (const it of items) {
                const center = it.obj.getCenterPoint ? it.obj.getCenterPoint() : { x: it.obj.left, y: it.obj.top };
                const nextCx = cursor + (it.width / 2);
                it.obj.setPositionByOrigin(new fabric.Point(nextCx, center.y), 'center', 'center');
                it.obj.setCoords?.();
                cursor += it.width + gap;
            }
        }

        if (action === 'distribute-v') {
            const items = objects.map((obj: any) => {
                const br = obj.getBoundingRect?.(true) || { left: obj.left || 0, top: obj.top || 0, width: 0, height: 0 };
                return {
                    obj,
                    top: Number(br.top || 0),
                    bottom: Number(br.top || 0) + Number(br.height || 0),
                    height: Number(br.height || 0)
                };
            }).sort((a: any, b: any) => a.top - b.top);

            const minTop = items[0].top;
            const maxBottom = items[items.length - 1].bottom;
            const totalHeight = items.reduce((sum: number, it: any) => sum + it.height, 0);
            const gap = Math.max(0, (maxBottom - minTop - totalHeight) / (items.length - 1));

            let cursor = minTop;
            for (const it of items) {
                const center = it.obj.getCenterPoint ? it.obj.getCenterPoint() : { x: it.obj.left, y: it.obj.top };
                const nextCy = cursor + (it.height / 2);
                it.obj.setPositionByOrigin(new fabric.Point(center.x, nextCy), 'center', 'center');
                it.obj.setCoords?.();
                cursor += it.height + gap;
            }
        }

        // Re-layout selection box
        safeAddWithUpdate(active);
        safeRequestRenderAll();
        saveCurrentState({ reason: action });
        return;
    }
}

const handleKeyDown = async (
    e: KeyboardEvent,
    options: { explicitEditorPaste?: boolean } = {}
) => {
    if (!canvas.value) return;

    // If editing a Fabric IText, let Fabric/browser handle undo/redo (text-level), not canvas-history.
    try {
        const active: any = canvas.value.getActiveObject?.();
        if (active?.isEditing) return;
    } catch {}

    // Ignore input fields so we don't trigger shortcuts while typing
    const target = (e.target as HTMLElement | null) || document.body;
    if (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]')) {
        return;
    }

    if (e.code === 'Space') {
        ctx.setIsSpacePanPressed(true);
        if (!isPenMode.value && !isNodeEditing.value && !isDrawing.value) {
            canvas.value.defaultCursor = 'grab';
        }
        e.preventDefault();
        return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Enter') {
        const active = canvas.value.getActiveObject?.();
        if (isQuickModeLockedObject(active)) {
            e.preventDefault();
            canvas.value.discardActiveObject?.();
            return;
        }
        if (active && isLikelyProductZone(active)) {
            e.preventDefault();
            openProductReviewForZone(active, {
                mode: 'replace'
            });
            return;
        }
    }

    // --- Undo/Redo Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Shift+Z / Cmd+Shift+Z) ---
    // Verificar primeiro para garantir prioridade
    if (isCtrl && (e.key === 'z' || e.key === 'Z')) {
        // Não processar undo/redo se já estiver processando histórico
        if (isHistoryProcessing.value) return;

        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
            redo();
        } else {
            undo();
        }
        return;
    }

    // --- Zoom Shortcuts ---
    if (isCtrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault(); // Prevent browser zoom
        handleZoomIn();
        return;
    }
    if (isCtrl && e.key === '-') {
        e.preventDefault(); // Prevent browser zoom
        handleZoomOut();
        return;
    }
    if (isCtrl && e.key === '0') {
        e.preventDefault();
        handleZoom100();
        return;
    }
    // Fit to screen (enquadrar área de design inteira na viewport)
    // Use `code` because on many layouts Shift+1 yields `!` (not `1`).
    if (e.shiftKey && (e.code === 'Digit1' || e.key === '1' || e.key === '!')) {
        e.preventDefault();
        zoomToFit({ persist: true });
        return;
    }
    // Extra shortcut: `F` (when not using Ctrl/Cmd) for quick fit-to-screen.
    if (!isCtrl && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        zoomToFit({ persist: true });
        return;
    }

    // Layer order (Figma): Cmd/Ctrl+[ ] and Option+Cmd/Ctrl+[ ]
    if (isCtrl && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        const mode: ArrangeMode =
            e.key === ']'
                ? (e.altKey ? 'bring-to-front' : 'bring-forward')
                : (e.altKey ? 'send-to-back' : 'send-backward');
        arrangeActiveObjects(mode);
        return;
    }

    // Object mask (Ctrl/Cmd+Shift+M)
    if (isCtrl && e.shiftKey && String(e.key || '').toLowerCase() === 'm') {
        e.preventDefault();
        await handleAction('toggle-mask');
        return;
    }

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isQuickModeLockedObject(canvas.value.getActiveObject?.())) {
            e.preventDefault();
            canvas.value.discardActiveObject?.();
            return;
        }
        const deleted = deleteActiveSelectionFromCanvas();
        if (deleted) e.preventDefault();
    }

    // Curve function shortcuts (only when editing path nodes)
    if (isNodeEditing.value && selectedPathNodeIndex.value !== null && currentEditingPath.value) {
        if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            smoothHandles(currentEditingPath.value, selectedPathNodeIndex.value);
            return;
        }
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            convertPointToCorner(currentEditingPath.value, selectedPathNodeIndex.value);
            return;
        }
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            mirrorHandles(currentEditingPath.value, selectedPathNodeIndex.value);
            return;
        }
    }

    // Arrows Movement (Nudge) + Alt+Arrows para resize frames
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const active = canvas.value.getActiveObject();

        if (isQuickModeLockedObject(active)) {
            e.preventDefault();
            canvas.value.discardActiveObject?.();
            return;
        }

        // Alt+Setas = Redimensionar frame de 1 pixel
        if (active && active.isFrame && e.altKey) {
            if (active.lockScalingX || active.lockScalingY) { e.preventDefault(); return; }
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1; // Shift = 10px

            if (e.key === 'ArrowUp') active.height -= step;
            if (e.key === 'ArrowDown') active.height += step;
            if (e.key === 'ArrowLeft') active.width -= step;
            if (e.key === 'ArrowRight') active.width += step;

            active.setCoords();
            getOrCreateFrameClipRect(active);
            invalidateScrollbarBounds();
            safeRequestRenderAll();
            ctx.setKeyboardNudgeDirty(true);
            return;
        }

        // Setas normais = Mover objeto
        if (active) {
            if (active.lockMovementX || active.lockMovementY) { e.preventDefault(); return; }
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const prevLeft = active.left;
            const prevTop = active.top;
            if (e.key === 'ArrowUp') active.top -= step;
            if (e.key === 'ArrowDown') active.top += step;
            if (e.key === 'ArrowLeft') active.left -= step;
            if (e.key === 'ArrowRight') active.left += step;
            active.setCoords();

            if (isLikelyProductZone(active)) {
                ensureZoneSanity(active);
                const dx = active.left - prevLeft;
                const dy = active.top - prevTop;
                moveZoneChildren(active, dx, dy);
                maybeReparentToFrameOnDrop(active);
                syncZoneCardFrameBindings(active);
            }
            if (active.isFrame) {
                const dx = active.left - prevLeft;
                const dy = active.top - prevTop;
                moveFrameDescendants(active, dx, dy);
                getOrCreateFrameClipRect(active);
            }
            invalidateScrollbarBounds();
            safeRequestRenderAll();
            throttledUpdateScrollbars();
            ctx.setKeyboardNudgeDirty(true);
        } else {
            // If no object selected, arrows pan the canvas
            e.preventDefault();
            const step = 20;
            const vpt = canvas.value.viewportTransform;
            if (e.key === 'ArrowUp') vpt[5] += step;
            if (e.key === 'ArrowDown') vpt[5] -= step;
            if (e.key === 'ArrowLeft') vpt[4] += step;
            if (e.key === 'ArrowRight') vpt[4] -= step;
            safeRequestRenderAll();
            throttledUpdateScrollbars();
            scheduleViewportStateSave('keyboard-pan');
            ctx.setKeyboardNudgeDirty(true);
        }
    }

    // Copy / Paste (Simple Clone)
    // Fabric v7 clone() returns a Promise; the legacy callback signature throws ("t2 is not iterable").
    if (isCtrl && String(e.key || '').toLowerCase() === 'c') {
        const actives = (canvas.value.getActiveObjects?.() || []).slice();
        if (actives.length > 0) {
            e.preventDefault();
            try {
                const items: any[] = [];
                const centers: Array<{ x: number; y: number }> = [];
                for (const active of actives) {
                    if (!active) continue;
                    // Skip non-user content.
                    if (isTransientCanvasObject(active) || String((active as any).id || '') === 'artboard-bg') continue;
                    try { ensureObjectPersistentId(active); } catch {}

                    const center = getObjectAbsoluteCenter(active);
                    centers.push(center);

                    const cloned = await (active as any).clone(CLIPBOARD_CLONE_PROPS);

                    // Store absolute center so we can paste on another page keeping relative layout.
                    (cloned as any)._clipboardCenterX = center.x;
                    (cloned as any)._clipboardCenterY = center.y;

                    // Store the original id so we can rebuild parentFrameId/parentZoneId mappings on paste.
                    (cloned as any)._clipboardSourceCustomId = String((active as any)._customId || '').trim() || null;

                    // Store the parent group reference for paste operation (single inner-image convenience).
                    const parentGroup = (active as any).group;
                    (cloned as any)._sourceGroupRef = parentGroup;
                    (cloned as any)._sourceGroupId = parentGroup?._customId || null;
                    (cloned as any)._sourceLeft = Number((active as any).left) || 0;
                    (cloned as any)._sourceTop = Number((active as any).top) || 0;

                    // Fallback: detect product card parent for deep-selected images.
                    if (!parentGroup && String((active as any).type || '').toLowerCase() === 'image') {
                        const allObjects = canvas.value.getObjects();
                        for (const obj of allObjects) {
                            if (obj.type === 'group' && ((obj as any).isSmartObject || (obj as any).isProductCard || isLikelyProductCard(obj))) {
                                if (typeof (obj as any).getObjects === 'function') {
                                    const children = (obj as any).getObjects();
                                    const containsImage = (children || []).some((child: any) =>
                                        child === active || child?._customId === (active as any)?._customId
                                    );
                                    if (containsImage) {
                                        (cloned as any)._sourceGroupRef = obj;
                                        (cloned as any)._sourceGroupId = (obj as any)._customId;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    items.push(cloned);
                }

                if (items.length > 0) {
                    const selectionCenter = computeCentersBoundingCenter(centers);
                    const copiedAt = Date.now();
                    const runtimeClipboard = {
                        kind: 'fabric-items-v2',
                        items,
                        selectionCenter,
                        sourcePageId: getActiveProjectPageId(),
                        copiedAt
                    };
                    (window as any)._clipboard = runtimeClipboard;
                    editorClipboardSummary.value = {
                        itemCount: items.length,
                        sourcePageId: runtimeClipboard.sourcePageId,
                        copiedAt
                    };
                    notifyEditorInfo(
                        `${items.length === 1 ? 'Elemento copiado' : `${items.length} elementos copiados`}. ` +
                        'Na página de destino, clique no Frame e use “Colar nesta página” ou Ctrl/Cmd+Shift+V.'
                    );
                }
            } catch (err) {
                console.warn('[clipboard] Falha ao copiar (clone)', err);
            }
        }
    }

    if (isCtrl && String(e.key || '').toLowerCase() === 'v') {
        // Ctrl/Cmd+V vem sempre do clipboard atual do sistema. Menus, botões e
        // Ctrl/Cmd+Shift+V solicitam explicitamente o clone em memória do editor.
        const explicitEditorPaste = options.explicitEditorPaste || isEditorClipboardPasteShortcut(e);
        if (resolveEditorPasteSource(explicitEditorPaste) !== 'editor') return;

        const clipAny = (window as any)._clipboard;
        if (!clipAny) {
            e.preventDefault();
            notifyEditorInfo('Copie um ou mais elementos antes de colar nesta página.');
            return;
        }

        if (clipAny) {
            e.preventDefault();

            // CRITICAL: Get active object BEFORE discarding to check parent group
            const activeBeforePaste = canvas.value.getActiveObject();

            try {
                // Clipboard v2 (multi-items) format
                const isV2 = !!clipAny?.kind && clipAny.kind === 'fabric-items-v2' && Array.isArray(clipAny.items);
                if (isV2) {
                    const clipData = clipAny as any;
                    const items: any[] = (clipData.items || []).slice();
                    if (!items.length) return;

                    const viewCenter = getCenterOfView();
                    const selectionCenter = clipData.selectionCenter || { x: viewCenter.x, y: viewCenter.y };
                    const sourcePageId = String(clipData.sourcePageId || '');
                    const selectedTargetFrame = getSelectedClipboardTargetFrame(activeBeforePaste);
                    const pastePlacement = resolveEditorClipboardPastePlacement({
                        sourcePageId,
                        destinationPageId: getActiveProjectPageId(),
                        selectionCenter,
                        viewCenter,
                        selectedFrameCenter: selectedTargetFrame?.center
                    });
                    const isCrossPagePaste = pastePlacement.isCrossPagePaste;
                    const pasteCenter = pastePlacement.pasteCenter;
                    const pasteOffset = pastePlacement.offset;
                    const targetFrameId = pastePlacement.usesSelectedFrame ? selectedTargetFrame?.id || '' : '';
                    const pasted: any[] = [];
                    const idMap = new Map<string, string>();
                    const existingIds = new Set<string>((canvas.value.getObjects?.() || [])
                        .map((o: any) => String(o?._customId || '').trim())
                        .filter(Boolean));

                    // Dentro da mesma página, uma imagem deep-selected pode voltar ao cartão.
                    // Entre páginas ela deve virar um novo objeto independente, sem alterar um
                    // cartão que por acaso use o mesmo id no destino.
                    if (items.length === 1 && !isCrossPagePaste) {
                        const clipItem = items[0];
                        const cloned: any = await (clipItem as any).clone(CLIPBOARD_CLONE_PROPS);

                        let originalParentGroup: any = null;
                        const sourceGroupId = (clipItem as any)._sourceGroupId;
                        const sourceGroupRef = (clipItem as any)._sourceGroupRef;
                        if (sourceGroupId || sourceGroupRef) {
                            const allObjects = canvas.value.getObjects();
                            if (sourceGroupId) {
                                originalParentGroup = allObjects.find((obj: any) =>
                                    obj._customId === sourceGroupId &&
                                    obj.type === 'group' &&
                                    (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                                ) || null;
                            }
                            if (!originalParentGroup && sourceGroupRef) {
                                originalParentGroup = allObjects.find((obj: any) =>
                                    obj === sourceGroupRef &&
                                    (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                                ) || null;
                            }
                        }
                        if (!originalParentGroup && activeBeforePaste && String(activeBeforePaste.type || '').toLowerCase() === 'image') {
                            const allObjects = canvas.value.getObjects();
                            for (const obj of allObjects) {
                                if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
                                    if (typeof obj.getObjects === 'function') {
                                        const children = obj.getObjects();
                                        const containsActiveImage = children.some((child: any) =>
                                            child === activeBeforePaste ||
                                            child._customId === (activeBeforePaste as any)._customId
                                        );
                                        if (containsActiveImage) {
                                            originalParentGroup = obj;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        if (!originalParentGroup && activeBeforePaste) {
                            if (activeBeforePaste.type === 'group' && (activeBeforePaste.isSmartObject || activeBeforePaste.isProductCard || isLikelyProductCard(activeBeforePaste))) {
                                originalParentGroup = activeBeforePaste;
                            } else if ((activeBeforePaste as any).group) {
                                const parentGroup = (activeBeforePaste as any).group;
                                if (parentGroup.isSmartObject || parentGroup.isProductCard || isLikelyProductCard(parentGroup)) {
                                    originalParentGroup = parentGroup;
                                }
                            }
                        }

                        const isProductCardGroup =
                            originalParentGroup &&
                            String(originalParentGroup.type || '').toLowerCase() === 'group' &&
                            (originalParentGroup.isSmartObject || originalParentGroup.isProductCard || String(originalParentGroup.name || '').startsWith('product-card') || isLikelyProductCard(originalParentGroup));
                        const isInnerImage = String((clipItem as any).type || '').toLowerCase() === 'image';

                        canvas.value.discardActiveObject();

                        if (isProductCardGroup && isInnerImage && originalParentGroup) {
                            // Paste inside the existing card group.
                            regenerateCustomIdsRecursive(cloned, idMap);
                            remapOrClearBindingsRecursive(cloned, idMap, existingIds);

                            let targetLeft = Number((clipItem as any)._sourceLeft) || 0;
                            let targetTop = Number((clipItem as any)._sourceTop) || 0;
                            targetLeft += 20;
                            targetTop += 20;
                            const insertAfter = activeBeforePaste && (activeBeforePaste as any).group === originalParentGroup
                                ? activeBeforePaste
                                : null;
                            cloned.set({
                                left: targetLeft,
                                top: targetTop,
                                originX: 'center',
                                originY: 'center',
                                angle: (clipItem as any).angle || 0,
                                scaleX: (clipItem as any).scaleX || 1,
                                scaleY: (clipItem as any).scaleY || 1,
                                flipX: !!(clipItem as any).flipX,
                                flipY: !!(clipItem as any).flipY,
                                opacity: (clipItem as any).opacity ?? 1,
                                selectable: true,
                                evented: true,
                                hasControls: true,
                                hasBorders: true,
                            });

                            const inserted = insertObjectIntoGroupWithoutRelayout(originalParentGroup, cloned, {
                                insertAfter,
                                localLeft: targetLeft,
                                localTop: targetTop
                            });
                            if (!inserted) {
                                const targetCanvas = groupLocalToCanvasPoint(originalParentGroup, targetLeft, targetTop);
                                cloned.set({ left: targetCanvas.x, top: targetCanvas.y });
                                safeAddWithUpdate(originalParentGroup, cloned);
                                originalParentGroup.set({ subTargetCheck: true, interactive: true });
                                originalParentGroup.setCoords?.();
                            }
                            canvas.value.setActiveObject(cloned);
                            safeRequestRenderAll();
                            refreshCanvasObjects();
                            saveCurrentState({ reason: 'paste' });
                            return;
                        }

                        // Fall through to regular multi-paste path by treating it as a 1-item list.
                        items.length = 0;
                        items.push(clipItem);
                    }

                    canvas.value.discardActiveObject();

                    for (const clipItem of items) {
                        if (!clipItem) continue;
                        const cloned: any = await (clipItem as any).clone(CLIPBOARD_CLONE_PROPS);
                        const cx = Number((clipItem as any)._clipboardCenterX);
                        const cy = Number((clipItem as any)._clipboardCenterY);
                        const dx = (Number.isFinite(cx) ? cx : Number(cloned.left || 0)) - Number(selectionCenter.x || 0);
                        const dy = (Number.isFinite(cy) ? cy : Number(cloned.top || 0)) - Number(selectionCenter.y || 0);

                        cloned.set({
                            left: Number(pasteCenter.x || 0) + dx + pasteOffset,
                            top: Number(pasteCenter.y || 0) + dy + pasteOffset,
                            originX: 'center',
                            originY: 'center',
                            evented: true,
                            selectable: true,
                        });

                        regenerateCustomIdsRecursive(cloned, idMap);
                        pasted.push(cloned);
                    }

                    // Rebind children to the newly pasted frame/zone ids (and clear dangling refs).
                    pasted.forEach((obj) => remapOrClearBindingsRecursive(obj, idMap, existingIds));
                    if (targetFrameId) {
                        bindPastedRootsToSelectedFrame(pasted, targetFrameId);
                    }

                    // Add all objects to canvas, then run the same finalization used by duplicate.
                    pasted.forEach((obj) => {
                        try {
                            if (obj) canvas.value.add(obj);
                        } catch (addErr) {
                            console.warn('[clipboard] Falha ao adicionar objeto colado:', addErr);
                        }
                    });

                    finalizeDuplicatedObjects(pasted);
                    saveCurrentState({ reason: 'paste' });
                    return;
                }

                // Clipboard v1 (single fabric clone) format (backward compatible)
                const clip = clipAny;
                const cloned: any = await (clip as any).clone(CLIPBOARD_CLONE_PROPS);

                // Find product card group context (same logic as before)
                let originalParentGroup = null;
                const sourceGroupId = (clip as any)._sourceGroupId;
                const sourceGroupRef = (clip as any)._sourceGroupRef;
                if (sourceGroupId || sourceGroupRef) {
                    const allObjects = canvas.value.getObjects();
                    if (sourceGroupId) {
                        originalParentGroup = allObjects.find((obj: any) =>
                            obj._customId === sourceGroupId &&
                            obj.type === 'group' &&
                            (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                        ) || null;
                    }
                    if (!originalParentGroup && sourceGroupRef) {
                        originalParentGroup = allObjects.find((obj: any) =>
                            obj === sourceGroupRef &&
                            (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                        ) || null;
                    }
                }
                if (!originalParentGroup && activeBeforePaste && String(activeBeforePaste.type || '').toLowerCase() === 'image') {
                    const allObjects = canvas.value.getObjects();
                    for (const obj of allObjects) {
                        if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
                            if (typeof obj.getObjects === 'function') {
                                const children = obj.getObjects();
                                const containsActiveImage = children.some((child: any) =>
                                    child === activeBeforePaste ||
                                    child._customId === activeBeforePaste._customId
                                );
                                if (containsActiveImage) {
                                    originalParentGroup = obj;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (!originalParentGroup && activeBeforePaste) {
                    if (activeBeforePaste.type === 'group' && (activeBeforePaste.isSmartObject || activeBeforePaste.isProductCard || isLikelyProductCard(activeBeforePaste))) {
                        originalParentGroup = activeBeforePaste;
                    } else if ((activeBeforePaste as any).group) {
                        const parentGroup = (activeBeforePaste as any).group;
                        if (parentGroup.isSmartObject || parentGroup.isProductCard || isLikelyProductCard(parentGroup)) {
                            originalParentGroup = parentGroup;
                        }
                    }
                }

                const isProductCardGroup =
                    originalParentGroup &&
                    String(originalParentGroup.type || '').toLowerCase() === 'group' &&
                    (originalParentGroup.isSmartObject || originalParentGroup.isProductCard || String(originalParentGroup.name || '').startsWith('product-card') || isLikelyProductCard(originalParentGroup));
                const isInnerImage = String((clip as any).type || '').toLowerCase() === 'image';

                canvas.value.discardActiveObject();

                // If pasting an image that was inside a product card, paste it back into the same group
                if (isProductCardGroup && isInnerImage && originalParentGroup) {
                    const idMap = new Map<string, string>();
                    const existingIds = new Set<string>((canvas.value.getObjects?.() || [])
                        .map((o: any) => String(o?._customId || '').trim())
                        .filter(Boolean));
                    regenerateCustomIdsRecursive(cloned, idMap);
                    remapOrClearBindingsRecursive(cloned, idMap, existingIds);

                    let targetLeft = Number((clip as any)._sourceLeft) || 0;
                    let targetTop = Number((clip as any)._sourceTop) || 0;
                    targetLeft += 20;
                    targetTop += 20;
                    const insertAfter = activeBeforePaste && (activeBeforePaste as any).group === originalParentGroup
                        ? activeBeforePaste
                        : null;

                    cloned.set({
                        left: targetLeft,
                        top: targetTop,
                        originX: 'center',
                        originY: 'center',
                        angle: (clip as any).angle || 0,
                        scaleX: (clip as any).scaleX || 1,
                        scaleY: (clip as any).scaleY || 1,
                        flipX: !!(clip as any).flipX,
                        flipY: !!(clip as any).flipY,
                        opacity: (clip as any).opacity ?? 1,
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true,
                    });

                    const inserted = insertObjectIntoGroupWithoutRelayout(originalParentGroup, cloned, {
                        insertAfter,
                        localLeft: targetLeft,
                        localTop: targetTop
                    });
                    if (!inserted) {
                        const targetCanvas = groupLocalToCanvasPoint(originalParentGroup, targetLeft, targetTop);
                        cloned.set({ left: targetCanvas.x, top: targetCanvas.y });
                        safeAddWithUpdate(originalParentGroup, cloned);
                        originalParentGroup.set({ subTargetCheck: true, interactive: true });
                        originalParentGroup.setCoords?.();
                    }

                    canvas.value.setActiveObject(cloned);
                    safeRequestRenderAll();
                    refreshCanvasObjects();
                    saveCurrentState({ reason: 'paste' });
                } else {
                    // Regular paste behavior for non-product-card objects
                    const idMap = new Map<string, string>();
                    const existingIds = new Set<string>((canvas.value.getObjects?.() || [])
                        .map((o: any) => String(o?._customId || '').trim())
                        .filter(Boolean));
                    regenerateCustomIdsRecursive(cloned, idMap);
                    remapOrClearBindingsRecursive(cloned, idMap, existingIds);

                    const center = getCenterOfView();
                    cloned.set({
                        left: (Number(center.x) || 0) + 20,
                        top: (Number(center.y) || 0) + 20,
                        originX: 'center',
                        originY: 'center',
                        evented: true,
                        selectable: true,
                    });

                    canvas.value.add(cloned);
                    finalizeDuplicatedObjects([cloned]);
                    saveCurrentState({ reason: 'paste' });
                }
            } catch (err) {
                console.warn('[clipboard] Falha ao colar (clone)', err);
            }
        }
    }

    // Tool Shortcuts
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePenMode();
        return;
    }

    if (e.key === 'v' || e.key === 'V') {
        if (!isCtrl) {
            e.preventDefault();
            setTool('select');
            return;
        }
    }

    if (e.key === 't' || e.key === 'T') {
        if (!isCtrl) {
            e.preventDefault();
            addText();
            return;
        }
    }

    // Duplicate (Ctrl+D / Cmd+D)
    // - Normal objects: duplicate on canvas (like Figma).
    // - If a product card inner image is selected (deep select), duplicate inside the same card.
    if (isCtrl && String(e.key || '').toLowerCase() === 'd') {
        e.preventDefault();
        const active = canvas.value.getActiveObject();
        if (!active) return;

        // Frames: duplicate frame + everything inside it.
        // Fallback robusto: alguns frames legacy podem perder `isFrame` em runtime.
        const activeLayerName = String((active as any)?.layerName || '').trim().toUpperCase();
        const activeName = String((active as any)?.name || '').trim();
        const looksLikeFrame = !!(active as any)?.isFrame ||
            activeLayerName === 'FRAMER' ||
            activeLayerName === 'FRAME' ||
            /^FRAME(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(activeName) ||
            /^FRAMER(?:\s+\d+)?(?:\s*\(.+\))?$/i.test(activeName);
        if (looksLikeFrame) {
            const duplicatedFrame = await duplicateFrameWithContents(active);
            if (duplicatedFrame) return;
        }
        if (isLikelyProductZone(active)) {
            const clones = await duplicateProductZoneWithCards(active, { offsetX: DUPLICATE_OFFSET, offsetY: DUPLICATE_OFFSET });
            if (clones.length) {
                saveCurrentState({ reason: 'duplicate-zone' });
                return;
            }
        }

        // Ctrl/Cmd+D on a product image must use the same literal-copy path
        // as the contextual image toolbar.  The generic duplicate path uses
        // the canvas offset (20px), which would make the copy appear shifted
        // instead of directly over the original.
        if (resolveSelectedProductImageActionContext(active)) {
            await handleProductImageDuplicate();
            return;
        }

        try {
            const clones = await duplicateActiveObjectWithContext(active, { offsetX: DUPLICATE_OFFSET, offsetY: DUPLICATE_OFFSET });
            if (!clones.length) return;
            finalizeDuplicatedObjects(clones);
            const reason = isActiveSelectionObject(active) ? 'duplicate-selection-multi' : 'duplicate-selection';
            saveCurrentState({ reason });
        } catch (err) {
            console.warn('[duplicate] Falha ao duplicar seleção', err);
        }
        return;
    }

    // Group / Ungroup (Ctrl+G, Ctrl+Shift+G)
    if (isCtrl && e.key === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
            ungroupSelection();
        } else {
            groupSelection();
        }
        return;
    }
}

    return {
        duplicateFrameWithContents,
        updateObjectProperty,
        handleAction,
        handleKeyDown
    }
}

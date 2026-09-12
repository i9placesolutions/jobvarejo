import { createEditorThumbnailQueue } from './editorThumbnailQueue'
import { getThumbnailMinIntervalMs, shouldSkipThumbnailForReason } from './editorSavePolicy'
type SaveStateOptions = {
    allowEmptyOverwrite?: boolean;
    forceEmptyOverwrite?: boolean;
    reason?: string;
    source?: 'user' | 'system';
    markUnsaved?: boolean;
    skipIfUnchanged?: boolean;
    expectedPageId?: string;
    skipCoalesce?: boolean;
};

export type EditorHistoryContext = Record<string, any>

export const createEditorHistoryController = (ctx: EditorHistoryContext) => {
    const { CANVAS_CUSTOM_PROPS, activePage, appendHistoryEntry, applyViewportCulling, canAllowEmptyOverwrite, canGenerateThumbnailNow, canvas, clearInvalidClipPath, computeCanvasFingerprint, convertPresignedToPermanentUrl, deferredFrameChildren, ensureObjectPersistentId, ensurePersistentContentFlags, fabric, finalizeSerializedCanvasJson, findPageIndexById, generateThumbnailFromCanvasJson, getActiveProjectPageId, getAdaptiveCoalesceDelayMs, handleObjectModified, hasUnsavedChanges, historyIndex, historyStack, invalidateContainmentZoneCache, invalidateScrollbarBounds, isCanvasDestroyed, isControlLikeObject, isDesignLoading, isHistoryProcessing, isLikelyProductCard, isLikelyProductZone, isMobile, isProjectLoaded, isTablet, isTransientCanvasObject, isValidFabricCanvasObject, LABEL_TEMPLATES_JSON_KEY, persistSerializedPageState, prepareCanvasForSerialization, project, registerHistorySaveListeners, restoreMissingManualTemplateFlagsInCanvas, restoreViewportCulledObjects, sanitizeCanvasObjectStack, saveLastError, saveStatus, serializeLabelTemplatesForProject, setSavedViewportTransform, shouldRunHeavySanitizeForReason, shouldSkipAutoSave, shouldSkipByFingerprint, shouldSkipLifecycleSave, stabilizePriceGroupsForPersistence, storageDegraded, storageDegradedHint, syncAllZoneStateSnapshots, TRANSIENT_CONTROL_NAMES, triggerAutoSave, updatePageData, updatePageThumbnail, updateScrollbars } = ctx

const setupHistory = () => {
	    if (!canvas.value) return;
        const existingTeardownHistoryListeners = ctx.getTeardownHistoryListeners()
        if (existingTeardownHistoryListeners) {
            existingTeardownHistoryListeners()
            ctx.setTeardownHistoryListeners(null)
        }
        const existingCancelPendingCoalescedSave = ctx.getCancelPendingCoalescedSave()
        if (existingCancelPendingCoalescedSave) {
            existingCancelPendingCoalescedSave()
            ctx.setCancelPendingCoalescedSave(null)
        }
	    const thumbnailQueue = createEditorThumbnailQueue<any>(async (pageId, json) => {
        const page = project.pages.find((item: any) => item.id === pageId)
        if (!page || isCanvasDestroyed.value) return ''
        return generateThumbnailFromCanvasJson({ sourceJson: json, staticCanvasCtor: fabric?.StaticCanvas,
            pageWidth: page.width, pageHeight: page.height })
    }, (pageId, dataURL, json) => {
        const index = project.pages.findIndex((item: any) => item.id === pageId)
        if (index < 0 || isCanvasDestroyed.value) return
        if (computeCanvasFingerprint(project.pages[index]?.canvasData) !== computeCanvasFingerprint(json)) return
        updatePageThumbnail(index, dataURL)
        triggerAutoSave()
    });
    let lastHotSaveSanitizeAt = 0;
    let pendingCoalescedSaveTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingCoalescedSaveOpts: SaveStateOptions | null = null;
    let pendingCoalescedSavePageId = '';
    let invokeSaveStateSafely: (opts?: SaveStateOptions) => Promise<boolean> = async () => false;
    // Saves no editor precisam ser single-flight para proteger o historyStack.
    // Chamadas recebidas durante um save em andamento ficam em fila "latest wins",
    // em vez de serem descartadas.
    let _isSaveInProgress = false;
    let queuedSaveStateOpts: SaveStateOptions | null = null;
    const queuedSaveStateWaiters: Array<(didSave: boolean) => void> = [];

    const queueSaveStateWhileInProgress = (opts: SaveStateOptions): Promise<boolean> => {
        queuedSaveStateOpts = {
            ...(queuedSaveStateOpts || {}),
            ...opts,
            allowEmptyOverwrite: !!queuedSaveStateOpts?.allowEmptyOverwrite || !!opts.allowEmptyOverwrite,
            forceEmptyOverwrite: !!queuedSaveStateOpts?.forceEmptyOverwrite || !!opts.forceEmptyOverwrite,
            markUnsaved: typeof opts.markUnsaved === 'boolean'
                ? opts.markUnsaved
                : queuedSaveStateOpts?.markUnsaved,
            skipCoalesce: true
        };
        return new Promise<boolean>((resolve) => {
            queuedSaveStateWaiters.push(resolve);
        });
    };

    const resolveQueuedSaveStateWaiters = (didSave: boolean) => {
        const waiters = queuedSaveStateWaiters.splice(0);
        waiters.forEach((resolve) => {
            try { resolve(didSave); } catch { /* ignore */ }
        });
    };

    const clearPendingCoalescedSave = () => {
        if (pendingCoalescedSaveTimer) {
            clearTimeout(pendingCoalescedSaveTimer)
            pendingCoalescedSaveTimer = null
        }
        ctx.setHasPendingCoalescedSave(false)
        pendingCoalescedSaveOpts = null
        pendingCoalescedSavePageId = ''
    }
    ctx.setCancelPendingCoalescedSave(clearPendingCoalescedSave);

    const resolvePageIndexById = (pageId: string): number => {
        return findPageIndexById(project.pages, pageId, Number(project.activePageIndex || 0))
    }

	    const saveState = async (opts: SaveStateOptions = {}) => {
	        if (isHistoryProcessing.value) return; // Prevent loop
            // Um canvas carregado com falhas não representa o documento salvo.
            // Impede que ações posteriores persistam a versão sem as imagens.
            if (storageDegraded.value) {
                storageDegradedHint.value = 'Salvamento pausado: recupere as imagens antes de salvar para não perder conteúdo.'
                return
            }
	        const canvasInstance = canvas.value as any;
	        if (!canvasInstance || isCanvasDestroyed.value) return;
	        // Prevent cross-page contamination: while the editor is switching/loading pages,
	        // ignore all saves, including delayed system jobs, until the canvas belongs
	        // to the active page and its load has completed.
	        const src = (opts.source || 'user') as any;
	        if (isDesignLoading.value) {
	            return;
	        }
	        const saveReason = String(opts.reason || 'unknown');
	        const expectedPageId = String(opts.expectedPageId || '').trim();
	        const targetPageId = expectedPageId || getActiveProjectPageId();
	        if (!targetPageId) return;
        const isTargetPageActive = () => getActiveProjectPageId() === targetPageId && (ctx.isCanvasPageCurrent?.() ?? true);
        if (!isTargetPageActive()) return;
        if (expectedPageId && !isTargetPageActive()) {
            return;
        }
        const targetPageIndexStart = resolvePageIndexById(targetPageId);
        if (targetPageIndexStart < 0) {
            return;
        }
        if (expectedPageId) {
            const activeNowId = getActiveProjectPageId();
            if (!activeNowId || activeNowId !== expectedPageId) {
                return
            }
        }
        const liveObjectCount = Number(canvasInstance?.getObjects?.()?.length || 0)
        const coalesceDelayMs = opts.skipCoalesce
            ? 0
            : getAdaptiveCoalesceDelayMs(saveReason, liveObjectCount)
        if (coalesceDelayMs > 0) {
            ctx.setHasPendingCoalescedSave(true)
            pendingCoalescedSaveOpts = { ...opts }
            pendingCoalescedSavePageId = getActiveProjectPageId()
            if (!pendingCoalescedSaveTimer) {
                pendingCoalescedSaveTimer = setTimeout(async () => {
                    pendingCoalescedSaveTimer = null
                    ctx.setHasPendingCoalescedSave(false)
                    const nextOpts = pendingCoalescedSaveOpts
                        ? { ...pendingCoalescedSaveOpts, skipCoalesce: true }
                        : { reason: saveReason, source: opts.source, skipCoalesce: true }
                    pendingCoalescedSaveOpts = null
                    if (pendingCoalescedSavePageId && !nextOpts.expectedPageId) {
                        nextOpts.expectedPageId = pendingCoalescedSavePageId
                    }
                    pendingCoalescedSavePageId = ''
                    try {
                        // FIX: await the save to prevent concurrent saves when the timer fires
                        // again before the previous save completes.
                        await invokeSaveStateSafely(nextOpts)
                    } catch (err) {
                        console.error('[saveState] Erro no save coalescido:', err)
                    }
                }, coalesceDelayMs)
            }
            return
        }

        // Don't persist transient geometry while the user is still in a brusque transform.
        // Keeping the previous stable snapshot is safer than saving an in-flight state.
        if (!opts.skipCoalesce && shouldSkipLifecycleSave(saveReason, ctx.getLastTransformMutationAt())) {
            console.warn(`[saveState] Pulando flush de lifecycle durante transformação ativa (${saveReason})`);
            return;
        }

        const shouldRunHeavySanitize = shouldRunHeavySanitizeForReason(saveReason);
        restoreMissingManualTemplateFlagsInCanvas(canvasInstance, `saveState:${saveReason}`);
        // Price-group stabilization must run on EVERY save path.
        // The splash image can lose `name` / `__originalSrc` immediately after
        // product insertion, before a later "heavy sanitize" chance occurs.
        stabilizePriceGroupsForPersistence(canvasInstance, `saveState:${saveReason}`);
        if (shouldRunHeavySanitize) {
            sanitizeCanvasObjectStack(canvasInstance, `saveState:${saveReason}`);
            lastHotSaveSanitizeAt = Date.now();
        } else if ((Date.now() - lastHotSaveSanitizeAt) > 3000) {
            sanitizeCanvasObjectStack(canvasInstance, `saveState:${saveReason}:throttled`);
            lastHotSaveSanitizeAt = Date.now();
        }

        // CRITICAL: Don't push/save empty canvas if the page already has data.
        // This can happen during transient clears (page switch/load) and it pollutes undo history
        // (Ctrl/Cmd+Z appears to "black screen" by undoing to an empty state).
        if (targetPageIndexStart >= 0 && project.pages.length > targetPageIndexStart && project.pages[targetPageIndexStart]) {
            const currentPage = project.pages[targetPageIndexStart];
            const existingObjectCount = currentPage?.canvasData?.objects?.length || 0;
            const liveObjectCount = canvasInstance?.getObjects?.()?.length || 0;
            // `allowEmptyOverwrite` is used by user-driven Fabric events; `forceEmptyOverwrite` is a hard override.
            // We intentionally do NOT allow system saves to bypass this guard (prevents page-switch wipe).
            const allowEmptyOverwrite = canAllowEmptyOverwrite({
                forceEmptyOverwrite: opts.forceEmptyOverwrite,
                allowEmptyOverwrite: opts.allowEmptyOverwrite,
                source: opts.source
            });
            // Data-loss guard:
            // never overwrite a non-empty saved page with an empty runtime snapshot
            // unless this was an explicit forced empty-save operation.
            if (liveObjectCount === 0 && existingObjectCount > 0 && !allowEmptyOverwrite) {
                console.warn(
                    `⚠️ Pulando salvamento vazio para evitar perda de dados: canvas está vazio (${liveObjectCount}) mas página já tinha ${existingObjectCount} objetos`,
                    { pageIndex: targetPageIndexStart, reason: opts.reason || 'unspecified', pageId: targetPageId }
                );
                return;
            }
        }
        if (!isTargetPageActive()) {
            return;
        }

        // FIX CRITICAL: restore viewport-culled objects BEFORE serialization.
        // Viewport culling sets `visible = false` on objects outside the viewport for
        // rendering performance. Without restoring them first, off-screen objects are
        // persisted with visible:false, making them permanently invisible on reload.
        // The __viewportCulled flag is a transient runtime property NOT in
        // CANVAS_CUSTOM_PROPS, so there is no way to know on reload that the
        // visible:false was due to culling rather than intentional hiding.
        const allObjectsForCullRestore = canvasInstance.getObjects?.() || []
        const culledCount = restoreViewportCulledObjects(allObjectsForCullRestore)
        if (culledCount > 0 && import.meta.dev) {
            console.log(`[saveState] Restored ${culledCount} viewport-culled object(s) before serialization`)
        }
        syncAllZoneStateSnapshots(canvasInstance, `saveState:${saveReason}`)

        const { canvasFrames, restoreZoneClipPaths } = prepareCanvasForSerialization({
            canvasInstance,
            isValidFabricCanvasObject,
            ensurePersistentContentFlags,
            ensureObjectPersistentId
        })
        // FIX: Removed safeRequestRenderAll() here. Triggering a render mid-serialization
        // can mutate canvas state (dirty flags, coords, clipPaths) between preparation and
        // toJSON(), causing inconsistent saved data or serialization failures. The render
        // will happen naturally after the save completes.


        // Serialize with custom props
        let json: any
        const preSerializeObjectCount = canvasInstance?.getObjects?.()?.length || 0
        try {
            json = canvasInstance.toJSON([...CANVAS_CUSTOM_PROPS]);
            // FIX: toJSON() can return empty objects even when canvas has objects.
            // This may happen due to all objects having excludeFromExport=true or
            // a transient Fabric internal state. Retry once after clearing the flag.
            if (
                preSerializeObjectCount > 0 &&
                (!json?.objects || json.objects.length === 0)
            ) {
                console.warn(`[saveState] toJSON() retornou 0 objetos mas canvas tem ${preSerializeObjectCount}. Corrigindo excludeFromExport e re-serializando...`)
                const liveObjs = canvasInstance.getObjects?.() || []
                let fixedExclude = 0
                const objectDiagnostics = liveObjs.map((obj: any) => {
                    const hasCustomId = typeof obj?._customId === 'string' && obj._customId.trim().length > 0;
                    const objName = String(obj?.name || '');
                    const objId = String(obj?.id || '');
                    const isControlLike = isControlLikeObject(obj);
                    const isCircleSmall = obj?.type === 'circle' && obj?.radius && obj?.radius <= 10 && !hasCustomId && !!obj?.excludeFromExport;
                    const isLineTransient = obj?.type === 'line' && !hasCustomId && !!obj?.excludeFromExport;
                    const isPathTransient = obj?.type === 'path' && !hasCustomId && !obj?.isVectorPath && !!obj?.excludeFromExport;
                    const isExcludePersistent = obj?.excludeFromExport === true && (
                        !!obj?.isFrame || !!obj?.isSmartObject || !!obj?.isProductCard ||
                        !!obj?.isGridZone || !!obj?.isProductZone || !!obj?.parentZoneId ||
                        objName === 'gridZone' || objName === 'productZoneContainer' ||
                        objName === 'priceGroup' || objName.startsWith('product-card') ||
                        objId === 'artboard-bg'
                    );
                    return {
                        type: obj?.type,
                        id: objId,
                        _customId: obj?._customId,
                        name: objName,
                        excludeFromExport: obj?.excludeFromExport,
                        hasCustomId,
                        isTransient: isTransientCanvasObject(obj),
                        isControlLike,
                        isCircleSmall,
                        isLineTransient,
                        isPathTransient,
                        isExcludePersistent,
                        isFrame: obj?.isFrame,
                        isProductCard: obj?.isProductCard,
                        isSmartObject: obj?.isSmartObject,
                        radius: obj?.radius,
                        data: obj?.data
                    };
                });
                console.warn(`[saveState] Diagnóstico DETALHADO de ${liveObjs.length} objetos:`, objectDiagnostics);
                liveObjs.forEach((obj: any) => {
                    if (obj?.excludeFromExport === true && !isTransientCanvasObject(obj)) {
                        obj.excludeFromExport = false
                        fixedExclude++
                    }
                })
                if (fixedExclude > 0) {
                    console.warn(`[saveState] Corrigido excludeFromExport em ${fixedExclude} objeto(s).`)
                } else {
                    console.warn(`[saveState] Nenhum objeto corrigido - todos são transientes ou não têm excludeFromExport=true`)
                }
                json = canvasInstance.toJSON([...CANVAS_CUSTOM_PROPS]);
                console.warn(`[saveState] Re-serialização: ${json?.objects?.length || 0} objetos (antes: 0, canvas: ${preSerializeObjectCount})`)
            }
        } catch (serializeErr: any) {
            const serializeMsg = String(serializeErr?.message || serializeErr || '').toLowerCase()
            const isRecoverableSerializationError = serializeMsg.includes('toobject is not a function')
            if (!isRecoverableSerializationError) {
                restoreZoneClipPaths?.()
                throw serializeErr
            }

            console.warn(`[saveState] Falha na serialização (${saveReason}). Tentando recuperação...`, serializeErr)
            const removed = sanitizeCanvasObjectStack(canvasInstance, `saveState:${saveReason}:serialize-retry`)
            try {
                const liveObjects = canvasInstance?.getObjects?.() || []
                liveObjects.forEach((obj: any) => clearInvalidClipPath(obj, true))
            } catch {
                // ignore cleanup failures
            }

            try {
                json = canvasInstance.toJSON([...CANVAS_CUSTOM_PROPS]);
            } catch (retryErr: any) {
                const retryMsg = String(retryErr?.message || retryErr || '').toLowerCase()
                const isRetryRecoverable = retryMsg.includes('toobject is not a function')
                if (!isRetryRecoverable) {
                    restoreZoneClipPaths?.()
                    throw retryErr
                }

                console.warn(`[saveState] Segunda tentativa de serialização falhou (${saveReason}). Aplicando limpeza forte...`, retryErr)
                const removedSecondPass = sanitizeCanvasObjectStack(canvasInstance, `saveState:${saveReason}:serialize-retry-2`)
                try {
                    const topLevelObjects = canvasInstance?.getObjects?.() || []
                    topLevelObjects.forEach((obj: any) => {
                        if (!isValidFabricCanvasObject(obj)) {
                            try { canvasInstance.remove(obj) } catch { /* ignore */ }
                        }
                    })
                } catch {
                    // ignore hard cleanup failures
                }

                try {
                    json = canvasInstance.toJSON([...CANVAS_CUSTOM_PROPS]);
                    console.warn(`[saveState] Serialização recuperada após limpeza forte (${removed + removedSecondPass} item(ns) saneados).`)
                } catch (finalErr: any) {
                    // FIX: Previously this silently returned without notifying the user,
                    // causing silent data loss. Now we set saveStatus to error and provide
                    // an actionable message so the user knows their work may not be saved.
                    console.error(`[saveState] Não foi possível serializar estado após recuperação (${saveReason}). Mantendo último estado válido.`, finalErr)
                    restoreZoneClipPaths?.()
                    saveLastError.value = 'Falha ao serializar canvas. Salve manualmente ou recarregue a página.'
                    saveStatus.value = 'error'
                    // Garantir que a página permanece marcada como dirty para que o usuário saiba que os dados não foram salvos
                    hasUnsavedChanges.value = true
                    const failedPage = targetPageIndexStart >= 0 ? project.pages?.[targetPageIndexStart] : null
                    if (failedPage) failedPage.dirty = true
                    return
                }
            }
            if (removed > 0) {
                console.warn(`[saveState] Serialização recuperada após remover ${removed} item(ns) inválido(s).`)
            }
        }
        // Restore zone clipPaths on live canvas objects now that serialization is complete
        restoreZoneClipPaths?.()

        // Re-apply viewport culling now that serialization is done — we restored
        // culled objects before toJSON() to ensure they serialize with correct
        // visibility, but we need to re-hide off-screen objects for render perf.
        if (culledCount > 0) {
            applyViewportCulling('post-save-restore')
        }

        const postToJsonObjectCount = Number(json?.objects?.length || 0)

        finalizeSerializedCanvasJson({
            json,
            canvasInstance,
            canvasCustomProps: [...CANVAS_CUSTOM_PROPS],
            isValidFabricCanvasObject,
            transientControlNames: TRANSIENT_CONTROL_NAMES,
            convertPresignedToPermanentUrl,
            canvasFramesForDebug: canvasFrames
        });

        const postFinalizeObjectCount = Number(json?.objects?.length || 0)

        // Injetar filhos de frames invisíveis (diferidos) no JSON antes de salvar.
        // Eles não estão no canvas mas precisam ser persistidos para não perder dados.
        if (deferredFrameChildren.size > 0 && Array.isArray(json?.objects)) {
            const allDeferred: any[] = []
            for (const children of deferredFrameChildren.values()) allDeferred.push(...children)
            if (allDeferred.length > 0) json.objects = [...json.objects, ...allDeferred]
        }

        const currentPageAfterSerialize = targetPageIndexStart >= 0 ? project.pages?.[targetPageIndexStart] : null;
        const serializedObjectCount = Number(json?.objects?.length || 0);
        const existingPersistedObjectCount = Number(currentPageAfterSerialize?.canvasData?.objects?.length || 0);
        const allowEmptyOverwriteAfterSerialize = canAllowEmptyOverwrite({
            forceEmptyOverwrite: opts.forceEmptyOverwrite,
            allowEmptyOverwrite: opts.allowEmptyOverwrite,
            source: opts.source
        });
        if (
            serializedObjectCount === 0 &&
            existingPersistedObjectCount > 0 &&
            !allowEmptyOverwriteAfterSerialize
        ) {
            console.warn(
                `⚠️ Pulando salvamento de JSON vazio após serialização: página já tinha ${existingPersistedObjectCount} objetos persistidos`,
                {
                    pageIndex: targetPageIndexStart,
                    reason: opts.reason || 'unspecified',
                    pageId: targetPageId,
                    preSerializeObjectCount,
                    postToJsonObjectCount,
                    postFinalizeObjectCount,
                    jsonVersion: json?.version,
                    jsonHasObjects: Array.isArray(json?.objects),
                }
            );
            return;
        }

        // Persist app-level metadata alongside Fabric JSON.
        (json as any)[LABEL_TEMPLATES_JSON_KEY] = serializeLabelTemplatesForProject();
        // Persist viewport (pan/zoom) so reload restores the exact view.
        const vpt = canvasInstance?.viewportTransform;
        setSavedViewportTransform(
            json as Record<string, unknown>,
            vpt,
            canvasInstance?.getZoom?.() || (Array.isArray(vpt) ? vpt[0] : 1)
        )
        const saveStamp = Date.now()
        if (json && typeof json === 'object') {
            (json as any).__savedAt = saveStamp
        }
        let jsonStr: string;
        try {
            jsonStr = JSON.stringify(json);
        } catch (stringifyErr: any) {
            // Referências circulares ou objetos não serializáveis podem causar falha aqui
            console.error('[saveState] JSON.stringify falhou — possível referência circular:', stringifyErr);
            saveLastError.value = 'Falha ao converter canvas para JSON. Verifique objetos com referências circulares.';
            saveStatus.value = 'error';
            hasUnsavedChanges.value = true;
            const errorPage = targetPageIndexStart >= 0 ? project.pages?.[targetPageIndexStart] : null;
            if (errorPage) errorPage.dirty = true;
            return;
        }
        const serializedBytes = typeof TextEncoder !== 'undefined'
            ? new TextEncoder().encode(jsonStr).length
            : jsonStr.length
        const currentFingerprint = computeCanvasFingerprint(json);
        const source = opts.source || 'user';
        const currentPage = targetPageIndexStart >= 0 ? project.pages?.[targetPageIndexStart] : null;
        if (currentPage) {
            currentPage.lastSerializedCanvasJson = jsonStr
            currentPage.lastSerializedCanvasBytes = serializedBytes
            currentPage.lastSerializedCanvasSavedAt = saveStamp
        }
        // Nunca pular save se o count de objetos mudou (indica mudança estrutural real)
        const prevObjectCount = currentPage?.canvasData?.objects?.length ?? -1
        const currObjectCount = json?.objects?.length ?? 0
        const objectCountChanged = prevObjectCount >= 0 && prevObjectCount !== currObjectCount
        if (!objectCountChanged && shouldSkipByFingerprint({
            skipIfUnchanged: opts.skipIfUnchanged,
            lastSavedFingerprint: currentPage?.lastSavedFingerprint,
            currentFingerprint
        })) {
            return;
        }
        const historyAppend = appendHistoryEntry({
            historyStack: historyStack.value,
            historyIndex: historyIndex.value,
            entry: jsonStr,
            maxEntries: 50
        })
        if (!historyAppend.didAppend) {
            return;
        }
        historyStack.value = historyAppend.historyStack
        historyIndex.value = historyAppend.historyIndex

        if (saveReason === 'initial-history-capture') {
            return true
        }

        const reason = String(opts.reason || '')
        const persistence = persistSerializedPageState({
            targetPageId,
            json,
            serializedJson: jsonStr,
            serializedBytes,
            source,
            reason,
            currentFingerprint,
            markUnsaved: typeof opts.markUnsaved === 'boolean'
                ? !!opts.markUnsaved
                : source !== 'system',
            pages: project.pages,
            resolvePageIndexById,
            updatePageData,
            shouldSkipAutoSave,
            triggerAutoSave
        })
        if (!persistence.didUpdate || persistence.targetPageIndex < 0) return false

        if (!shouldSkipThumbnailForReason(source, reason)) {
            thumbnailQueue.schedule(targetPageId, json, getThumbnailMinIntervalMs(reason))
        }
        return true
    }

    invokeSaveStateSafely = async (opts: SaveStateOptions = {}) => {
        // FIX: Skip saves during the cooldown window after undo/redo.
        // After history restore, deferred canvas events (object:added, object:modified)
        // fire because loadFromJSON re-creates objects.  Without this guard those
        // events would persist the restored (potentially intermediate) state, marking
        // the page dirty and triggering auto-save of a state the user is undoing.
        const reason = String(opts.reason || '')
        // Permitir saves explícitos do usuário (global-style, properties-panel, layers-drag)
        // mesmo durante cooldown pós-undo/redo. Apenas suprimir eventos automáticos do canvas.
        const isUserInitiated = reason.startsWith('global-style:')
            || reason.startsWith('properties-panel')
            || reason.startsWith('layers-drag')
            || opts.skipIfUnchanged === false
        if (!isUserInitiated && Date.now() < ctx.getHistoryRestoreCooldownUntil() && reason !== 'initial-history-capture') {
            return false
        }

        const nextOpts: SaveStateOptions = { ...(opts || {}) };
        if (!nextOpts.expectedPageId) {
            const pageId = getActiveProjectPageId();
            if (pageId) nextOpts.expectedPageId = pageId;
        }
        if (_isSaveInProgress) {
            return await queueSaveStateWhileInProgress(nextOpts);
        }

        _isSaveInProgress = true;
        let didAnySave = false;
        try {
            let currentOpts: SaveStateOptions | null = nextOpts;
            while (currentOpts) {
                const didSave = await saveState(currentOpts);
                didAnySave = didSave === true || didAnySave;
                currentOpts = queuedSaveStateOpts;
                queuedSaveStateOpts = null;
            }
            resolveQueuedSaveStateWaiters(didAnySave);
            return didAnySave;
        } catch (err: any) {
            console.error('❌ [saveState] Falha ao salvar estado:', err);
            if (canvas.value) sanitizeCanvasObjectStack(canvas.value as any, 'saveState-catch');
            resolveQueuedSaveStateWaiters(false);
            return false;
        } finally {
            _isSaveInProgress = false;
        }
    };

    // Export for external use
    ctx.setSaveCurrentState(invokeSaveStateSafely);

    // Capture initial state - only if canvas has REAL (non-transient) objects OR page is new/empty
    const allObjects = canvas.value.getObjects();
    const currentObjectCount = allObjects.length;
    // Count only non-transient objects (excluding artboard-bg)
    const realObjectCount = allObjects.filter((o: any) => !isTransientCanvasObject(o) && o?.id !== 'artboard-bg').length;
    const currentPage = project.pages[project.activePageIndex];
    const pageHasData = currentPage?.canvasData?.objects?.length > 0;
    const expectedObjectCount = currentPage?.canvasData?.objects?.length || 0;

    console.log('[setupHistory] 📊 Verificando estado inicial:', {
        totalObjects: currentObjectCount,
        realObjects: realObjectCount,
        pageHasData,
        expectedObjectCount,
        pageId: currentPage?.id,
        isProjectLoaded: isProjectLoaded.value
    });

    // Only save initial state if canvas has REAL objects, or if page is completely new (no existing data)
    if (realObjectCount > 0) {
        console.log('[setupHistory] ✅ Salvando estado inicial: canvas tem objetos reais');
        invokeSaveStateSafely({ reason: 'initial-history-capture', source: 'system', skipIfUnchanged: true });
    } else if (!pageHasData) {
        console.log('[setupHistory] ✅ Salvando estado inicial: página nova sem dados');
        invokeSaveStateSafely({ reason: 'initial-history-capture', source: 'system', skipIfUnchanged: true });
    } else {
        console.log('[setupHistory] ⏭️ Pulando saveState inicial: canvas vazio (apenas transientes) mas página espera ' + expectedObjectCount + ' objetos');
    }

    const canvasInstanceForHistory = canvas.value
    if (!canvasInstanceForHistory) return

    const nextTeardownHistoryListeners = registerHistorySaveListeners({
        canvas: canvasInstanceForHistory,
        getCanvas: () => canvas.value,
        invalidateScrollbarBounds,
        invalidateContainmentZoneCache,
        updateScrollbars,
        isBulkProductMutation: () => !!ctx.getIsBulkProductMutation(),
        isHistoryProcessing: () => !!isHistoryProcessing.value,
        isApplyingZoneUpdate: () => ctx.getApplyingZoneUpdateCount() > 0,
        getIsZoneCascadeDelete: () => !!ctx.getIsZoneCascadeDelete(),
        setIsZoneCascadeDelete: (value: boolean) => {
            ctx.setIsZoneCascadeDelete(!!value)
        },
        invokeSaveStateSafely,
        shouldAutoSaveCanvasObjectChange: () => !!(isMobile.value || isTablet.value),
        triggerAutoSaveAfterCanvasObjectChange: triggerAutoSave,
        handleObjectModified,
        isLikelyProductZone,
        isLikelyProductCard
    })
    ctx.setTeardownHistoryListeners(() => { thumbnailQueue.dispose(); nextTeardownHistoryListeners?.() })
}

    return {
        setupHistory
    }
}

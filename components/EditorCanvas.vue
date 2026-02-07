<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch, watchEffect, triggerRef, computed, nextTick } from 'vue'
import { useRuntimeConfig } from '#imports'
import Button from './ui/Button.vue'
import LayersPanel from './LayersPanel.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import ProjectManager from './ProjectManager.vue'
import SidebarLeft from './SidebarLeft.vue'
import ProductReviewModal from './ProductReviewModal.vue'
import LabelTemplateManager from './LabelTemplateManager.vue'
import AiImageStudioModal from './AiImageStudioModal.vue'
import ContextMenu from './ui/ContextMenu.vue'
import FigmaCropOverlay from './FigmaCropOverlay.vue'
import { useFigmaCrop } from '~/composables/useFigmaCrop'
import { useProductZone } from '~/composables/useProductZone'
import { useAiImageStudio } from '~/composables/useAiImageStudio'
import { toWasabiProxyUrl } from '~/utils/storageProxy'
import type { LabelTemplate } from '~/types/label-template'
import {
  Undo,
  Redo,
  FolderOpen,
  Save,
  Upload,
  Plus,
  Type,
  Square,
  Circle,
  Triangle,
  Star,
  Pentagon, // New
  Trash2,
  Sparkles,
  Scissors,
  Download,
  LayoutGrid,
  MousePointer2,
  StickyNote,
  Wand2,
  RectangleHorizontal,
  Minus,
  Maximize,
  Search,
  X,
  Hand,
  Share2,
  Play,
  PenTool,
  ArrowRightFromLine, // Fixed missing import
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Frame, // New Icon
  Group, // Group icon
  Ungroup, // Ungroup icon
  Menu,
  ChevronDown,
  Eye,
  Code,
  Zap,
  MinusCircle,
  PlusCircle,
  Move3D,
  Combine
} from 'lucide-vue-next'

const isDrawing = ref(false)
const isNodeEditing = ref(false)
const isPenMode = ref(false) // Pen Tool mode (vector path creation)
const penPathPoints = ref<Array<{x: number, y: number, handles?: {in: {x: number, y: number}, out: {x: number, y: number}}}>>([])
const currentPenPath = ref<any>(null) // Current path being created
const currentPenPoint = ref<any>(null) // Current point circle
const currentMousePos = ref<{x: number, y: number} | null>(null) // Current mouse position in pen mode
const showPenContextualToolbar = ref(false)
const selectedPathNodeIndex = ref<number | null>(null) // Selected node index during editing
const currentEditingPath = ref<any>(null) // Path object currently being edited
const activeMode = ref<'design' | 'prototype'>('design')
const showZoomMenu = ref(false)
let globalMouseUpHandler: ((e: MouseEvent) => void) | null = null
let domCanvasDblClickHandler: ((e: MouseEvent) => void) | null = null
let lastDomDblClickAt = 0
let wrapperResizeObserver: ResizeObserver | null = null

// Flag to track if canvas is destroyed (prevents errors after unmount)
const isCanvasDestroyed = ref(false)

// === AI Image Studio (global modal) ===
const aiStudio = useAiImageStudio()
const aiStudioOpen = aiStudio.open
const aiStudioOptions = aiStudio.options
const aiStudioUploads = ref<Array<{ id: string; name: string; url: string }>>([])

// === Figma-style Crop Overlay ===
const figmaCrop = useFigmaCrop()

// Handlers para eventos do crop overlay
const handleCropRectUpdate = (rect: { x: number; y: number; width: number; height: number }) => {
    figmaCrop.updateCropRect(rect)
}

const handleCropComplete = (rect: { x: number; y: number; width: number; height: number }) => {
    figmaCrop.applyCrop(rect)
    canvas.value?.requestRenderAll()
    saveCurrentState?.()
}

// Offset do canvas para posicionar o overlay corretamente
const cropCanvasOffset = computed(() => {
    if (!wrapperEl.value) return { x: 0, y: 0 }
    const rect = wrapperEl.value.getBoundingClientRect()
    return {
        x: rect.left,
        y: rect.top
    }
})

// Zoom level para o overlay
const zoom = ref(1)

const refreshAiStudioUploads = async () => {
    try {
        const data: any = await $fetch('/api/assets').catch(() => [])
        if (Array.isArray(data)) {
            aiStudioUploads.value = data.map((a: any) => ({ id: a.id, name: a.name, url: a.url }))
        }
    } catch (e) {
        console.warn('[ai-studio] Falha ao carregar uploads:', e)
    }
}

const guessAiSizeFromObject = (obj: any): '1024x1024' | '1024x1536' | '1536x1024' => {
    const w = Math.max(1, Number(obj?.getScaledWidth?.() ?? ((obj?.width || 1) * (obj?.scaleX || 1))) || 1)
    const h = Math.max(1, Number(obj?.getScaledHeight?.() ?? ((obj?.height || 1) * (obj?.scaleY || 1))) || 1)
    const ar = w / h
    if (ar > 1.15) return '1536x1024'
    if (ar < 0.87) return '1024x1536'
    return '1024x1024'
}

const findImageTargetInSelection = (obj: any): { img: any; parent: any | null } | null => {
    if (!obj) return null
    const t = String(obj.type || '').toLowerCase()
    if (t === 'image') return { img: obj, parent: null }
    if (t === 'group' || t === 'activeselection') {
        const list = typeof obj.getObjects === 'function' ? obj.getObjects() : []
        const img = (list || []).find((o: any) => String(o?.type || '').toLowerCase() === 'image')
        return img ? { img, parent: obj } : null
    }
    return null
}

/**
 * Safe wrapper for requestRenderAll that checks if canvas is valid before rendering.
 * Prevents "Cannot read properties of undefined" errors when canvas is disposed.
 */
const safeRequestRenderAll = (canvasInstance?: any): void => {
    const c = canvasInstance || canvas.value;
    if (!c || isCanvasDestroyed.value) return;
    if (typeof c.requestRenderAll !== 'function') return;

    const ensureFabricContexts = (fc: any): boolean => {
        try {
            // In some edge cases (fast drag / mouseup outside / resize), Fabric can lose its cached contexts.
            // If we just skip render, the lower canvas stays cleared (appears black). Rehydrate from DOM elements.
            if (fc.upperCanvasEl && (!fc.contextTop || typeof fc.contextTop.clearRect !== 'function')) {
                const ctxTop = fc.upperCanvasEl.getContext?.('2d');
                if (ctxTop) fc.contextTop = ctxTop;
            }
            if (fc.lowerCanvasEl && (!fc.contextContainer || typeof fc.contextContainer.clearRect !== 'function')) {
                const ctx = fc.lowerCanvasEl.getContext?.('2d');
                if (ctx) fc.contextContainer = ctx;
            }
            // Some Fabric builds also keep a direct `context` alias.
            if (!fc.context && fc.contextContainer) fc.context = fc.contextContainer;
            return !!(fc.contextContainer && typeof fc.contextContainer.clearRect === 'function');
        } catch {
            return false;
        }
    };

    try {
        if (!ensureFabricContexts(c)) return;
        c.requestRenderAll();
    } catch {
        // As a last resort, attempt a synchronous render.
        try {
            if (typeof c.renderAll === 'function') c.renderAll();
        } catch {
            // Ignore
        }
    }
};

// Hardens Fabric render calls to avoid the editor going black when something
// unexpected sneaks into internal `_objects` arrays (canvas/group/clipPath).
const patchCanvasRenderSafety = (c: any): void => {
    if (!c || (c as any).__patchedSafeRender) return;

    const isValidRenderable = (o: any) => {
        return !!(o && typeof o === 'object' && typeof o.render === 'function' && typeof o.setCoords === 'function');
    };

    const ensureFabricContexts = (fc: any): boolean => {
        try {
            if (fc.upperCanvasEl && (!fc.contextTop || typeof fc.contextTop.clearRect !== 'function')) {
                const ctxTop = fc.upperCanvasEl.getContext?.('2d');
                if (ctxTop) fc.contextTop = ctxTop;
            }
            if (fc.lowerCanvasEl && (!fc.contextContainer || typeof fc.contextContainer.clearRect !== 'function')) {
                const ctx = fc.lowerCanvasEl.getContext?.('2d');
                if (ctx) fc.contextContainer = ctx;
            }
            if (!fc.context && fc.contextContainer) fc.context = fc.contextContainer;
            return !!(fc.contextContainer && typeof fc.contextContainer.clearRect === 'function');
        } catch {
            return false;
        }
    };

    const purgeInvalidRecursive = (container: any): number => {
        if (!container) return 0;
        const internal = (container as any)._objects;
        let removed = 0;
        if (Array.isArray(internal)) {
            const before = internal.length;
            const valid = internal.filter(isValidRenderable);
            if (valid.length !== before) {
                internal.length = 0;
                valid.forEach((o: any) => internal.push(o));
                removed += (before - valid.length);
                if (typeof (container as any)._onStackOrderChanged === 'function') (container as any)._onStackOrderChanged();
                if (typeof (container as any).triggerLayout === 'function') (container as any).triggerLayout();
                if (typeof (container as any).setCoords === 'function') (container as any).setCoords();
                (container as any).dirty = true;
            }
            for (const child of internal) {
                // Clean invalid clipPaths (common crash source)
                try {
                    if (child?.clipPath) clearInvalidClipPath(child, true);
                } catch {
                    // ignore
                }
                if (child && Array.isArray((child as any)._objects)) {
                    removed += purgeInvalidRecursive(child);
                }
                // Some clipPaths are groups internally
                try {
                    const cp = child?.clipPath;
                    if (cp && Array.isArray((cp as any)._objects)) {
                        removed += purgeInvalidRecursive(cp);
                    }
                } catch {
                    // ignore
                }
            }
        }
        return removed;
    };

    const origRequest = typeof c.requestRenderAll === 'function' ? c.requestRenderAll.bind(c) : null;
    const origRender = typeof c.renderAll === 'function' ? c.renderAll.bind(c) : null;

    // FIX FLICKERING: Não rodar purgeInvalidRecursive em CADA render.
    // purgeInvalidRecursive varre todos os objetos recursivamente (incluindo clipPaths),
    // o que é pesado e causa flickering visível. Agora só roda como fallback após erro.
    // PERFORMANCE: Cache context validity — only re-check every 500ms or after error.
    let contextsValid = true;
    let lastContextCheck = 0;
    const CONTEXT_CHECK_INTERVAL = 500; // ms

    const checkContextsIfNeeded = (): boolean => {
        const now = performance.now();
        if (contextsValid && (now - lastContextCheck) < CONTEXT_CHECK_INTERVAL) return true;
        contextsValid = ensureFabricContexts(c);
        lastContextCheck = now;
        return contextsValid;
    };

    if (origRequest) {
        (c as any).__origRequestRenderAll = origRequest;
        c.requestRenderAll = () => {
            if (!checkContextsIfNeeded()) return;
            try {
                return origRequest();
            } catch (e) {
                // Render falhou — invalidar cache, purgar objetos inválidos e tentar novamente
                contextsValid = false;
                try {
                    purgeInvalidRecursive(c);
                } catch {
                    // ignore
                }
                try {
                    return origRender ? origRender() : undefined;
                } catch {
                    // ignore
                }
            }
        };
    }

    if (origRender) {
        (c as any).__origRenderAll = origRender;
        c.renderAll = () => {
            if (!checkContextsIfNeeded()) return;
            try {
                return origRender();
            } catch {
                // Render falhou — invalidar cache, purgar e tentar novamente
                contextsValid = false;
                try {
                    purgeInvalidRecursive(c);
                } catch {
                    // ignore
                }
                try {
                    return origRender();
                } catch {
                    // ignore
                }
            }
        };
    }

    (c as any).__patchedSafeRender = true;
};

/**
 * Validates if a clipPath is a valid Fabric.js object
 * A valid clipPath must have required Fabric methods and properties
 */
const isValidClipPath = (clipPath: any): boolean => {
    if (!clipPath) return false;

    // Must be an object
    if (typeof clipPath !== 'object' || Array.isArray(clipPath)) return false;

    // Must have Fabric-specific properties
    if (!clipPath.type) return false;

    // CRITICAL: _objects must ALWAYS be an array if it exists
    // fabric.js createClipPathLayer calls forEach on _objects
    if (clipPath._objects !== undefined && !Array.isArray(clipPath._objects)) {
        console.warn('[clipPath] _objects não é um array:', clipPath._objects);
        return false;
    }

    // Ensure _objects is initialized as empty array for group-like objects
    // This prevents "forEach of undefined" errors in fabric.js
    if (clipPath._objects === undefined &&
        (clipPath.type === 'group' || clipPath.type === 'activeSelection')) {
        console.warn('[clipPath] Group sem _objects array:', clipPath.type);
        return false;
    }

    // Must have render method
    if (typeof clipPath.render !== 'function') return false;

    // RECURSIVELY validate nested clipPaths
    if (clipPath.clipPath && !isValidClipPath(clipPath.clipPath)) {
        console.warn('[clipPath] clipPath aninhado inválido');
        return false;
    }

    // Validate all child objects have proper _objects arrays
    if (Array.isArray(clipPath._objects)) {
        for (const child of clipPath._objects) {
            if (child && child._objects !== undefined && !Array.isArray(child._objects)) {
                console.warn('[clipPath] Child com _objects inválido:', child.type);
                return false;
            }
            // Check nested clipPath on child
            if (child && child.clipPath && !isValidClipPath(child.clipPath)) {
                console.warn('[clipPath] Child com clipPath aninhado inválido');
                return false;
            }
        }
    }

    return true;
};

/**
 * Clears invalid clipPath from an object
 * @param obj - Fabric object to check
 * @param recursive - Whether to check children in groups
 */
const clearInvalidClipPath = (obj: any, recursive: boolean = false): void => {
    if (!obj) return;

    try {
        // First, fix any clipPath that has malformed _objects
        if (obj.clipPath) {
            const clip = obj.clipPath;
            // CRITICAL FIX: Ensure _objects is ALWAYS an array for clipPaths
            // fabric.js createClipPathLayer calls forEach on _objects without checking
            if (clip._objects === undefined || clip._objects === null) {
                clip._objects = [];
            } else if (!Array.isArray(clip._objects)) {
                console.warn('[clipPath] _objects não é um array em:', obj.type || 'unknown', '- removendo clipPath');
                obj.set('clipPath', null);
                if (obj._frameClipOwner) {
                    delete obj._frameClipOwner;
                }
                return;
            }
            // Also fix nested clipPath
            if (clip.clipPath) {
                if (clip.clipPath._objects === undefined || clip.clipPath._objects === null) {
                    clip.clipPath._objects = [];
                } else if (!Array.isArray(clip.clipPath._objects)) {
                    obj.set('clipPath', null);
                    if (obj._frameClipOwner) {
                        delete obj._frameClipOwner;
                    }
                    return;
                }
            }
        }

        // Check if object has an invalid clipPath (after fixing attempt)
        if (obj.clipPath && !isValidClipPath(obj.clipPath)) {
            console.warn('[clipPath] Removendo clipPath inválido de objeto:', obj.type || 'unknown', obj.id || 'no-id');
            obj.set('clipPath', null);

            // Also clear the frame owner reference if it exists
            if (obj._frameClipOwner) {
                delete obj._frameClipOwner;
            }
        }

        // Also check and fix malformed _objects arrays on the object itself
        // This happens when fabric.js objects are deserialized incorrectly
        if (obj._objects !== undefined && !Array.isArray(obj._objects)) {
            console.warn('[clipPath] Fixing _objects não-array em:', obj.type || 'unknown');
            obj._objects = [];
        }

        // Recursively check children in groups
        if (recursive && obj._objects && Array.isArray(obj._objects)) {
            obj._objects.forEach((child: any) => {
                clearInvalidClipPath(child, true);
            });
        }

        // Also check objects in groups via getObjects if available
        if (recursive && typeof obj.getObjects === 'function') {
            const children = obj.getObjects();
            if (Array.isArray(children)) {
                children.forEach((child: any) => {
                    clearInvalidClipPath(child, true);
                });
            }
        }
    } catch (e) {
        // Silently handle errors during clipPath clearing
        console.warn('[clipPath] Erro ao limpar clipPath:', e);
    }
};

/**
 * Validates and sanitizes all clipPaths in the canvas.
 * Should be called after loadFromJSON and before any render operations.
 */
const sanitizeAllClipPaths = (): void => {
    if (!canvas.value || isCanvasDestroyed.value) return;

    try {
        const objects = canvas.value.getObjects();
        objects.forEach((obj: any) => {
            clearInvalidClipPath(obj, true);
        });
    } catch (e) {
        console.warn('⚠️ Erro ao sanitizar clipPaths:', e);
    }
};

/**
 * Nuclear option: Removes ALL clipPaths from the canvas.
 * Use this as a last resort when sanitization fails and rendering still crashes.
 */
const removeAllClipPaths = (): void => {
    if (!canvas.value || isCanvasDestroyed.value) return;

    try {
        const objects = canvas.value.getObjects();
        let clearedCount = 0;
        objects.forEach((obj: any) => {
            if (obj.clipPath) {
                obj.set('clipPath', null);
                delete obj._frameClipOwner;
                clearedCount++;
            }
            // Also check nested objects in groups
            if (obj._objects && Array.isArray(obj._objects)) {
                obj._objects.forEach((child: any) => {
                    if (child.clipPath) {
                        child.set('clipPath', null);
                        delete child._frameClipOwner;
                        clearedCount++;
                    }
                });
            }
        });
        console.log(`[clipPath] Nuclear option: removidos ${clearedCount} clipPaths`);
    } catch (e) {
        console.warn('⚠️ Erro ao remover clipPaths:', e);
    }
};

// Product Zone State
const productZoneState = useProductZone()

// Label templates (price splash models)
const showLabelTemplatesModal = ref(false)
const labelTemplates = ref<LabelTemplate[]>([])
const hasLoadedLabelTemplatesFromDb = ref(false)

const LABEL_TEMPLATES_JSON_KEY = '__labelTemplates'
const BUILTIN_DEFAULT_LABEL_TEMPLATE_ID = 'tpl_default'
const BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID = 'tpl_atacarejo_10fd'
const BUILTIN_BLACK_YELLOW_LABEL_TEMPLATE_ID = 'tpl_black_yellow'
const LABEL_TEMPLATE_EXTRA_PROPS = ['name', 'fontFamily', '__fontScale', '__yOffsetRatio', '__strokeWidth', '__roundness', '__originalWidth', '__originalHeight', '__originalFontSize', '__originalLeft', '__originalTop', '__originalOriginX', '__originalOriginY', '__originalScaleX', '__originalScaleY', '__originalRadius', '__originalRx', '__originalRy', '__originalStrokeWidth', '__shadowBlur']

const serializeLabelTemplatesForProject = () => {
    // Keep project JSON lean: previews can be regenerated client-side.
    // Avoid embedding DB/library templates into every project (keeps canvas_data smaller).
    return (labelTemplates.value || [])
        .filter((t: any) => !(t as any)?.__fromDb)
        .map((t: any) => ({ ...t, previewDataUrl: undefined }))
}

const hydrateLabelTemplatesFromProjectJson = (json: any) => {
    const raw = json?.[LABEL_TEMPLATES_JSON_KEY]
    if (!Array.isArray(raw)) return;

    const existing = (labelTemplates.value || []) as any[];
    const byId = new Map<string, any>(existing.map(t => [String(t?.id), t]));
    for (const t of raw as any[]) {
        if (!t?.id) continue;
        const prev = byId.get(String(t.id));
        byId.set(String(t.id), {
            ...(prev || {}),
            ...t,
            previewDataUrl: (t as any).previewDataUrl ?? prev?.previewDataUrl
        });
    }
    labelTemplates.value = Array.from(byId.values()) as any;
}

const normalizeDbLabelTemplate = (row: any): LabelTemplate | null => {
    if (!row?.id || !row?.group) return null;
    return {
        id: String(row.id),
        name: String(row.name || 'Etiqueta'),
        kind: (row.kind || 'priceGroup-v1') as any,
        group: row.group ?? (row as any)['group'],
        previewDataUrl: row.preview_data_url ?? undefined,
        createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
        updatedAt: row.updated_at ? String(row.updated_at) : (row.created_at ? String(row.created_at) : new Date().toISOString())
    };
}

const loadLabelTemplatesFromDb = async () => {
    if (hasLoadedLabelTemplatesFromDb.value) return;
    hasLoadedLabelTemplatesFromDb.value = true;

    try {
        const userId = currentUser.value?.id || undefined;
        const resp: any = await $fetch('/api/label-templates', { method: 'GET', query: userId ? { userId } : {} });
        const rows = Array.isArray(resp?.templates) ? resp.templates : [];
        const incoming = rows.map(normalizeDbLabelTemplate).filter(Boolean) as LabelTemplate[];
        if (!incoming.length) return;

        const existing = (labelTemplates.value || []) as any[];
        const byId = new Map<string, any>(existing.map(t => [String(t?.id), t]));

        for (const t of incoming) {
            const prev = byId.get(String(t.id));
            if (prev) {
                // Keep local templates local; just merge DB updates on top.
                byId.set(String(t.id), {
                    ...prev,
                    ...t,
                    previewDataUrl: t.previewDataUrl ?? prev.previewDataUrl
                });
            } else {
                byId.set(String(t.id), { ...t, __fromDb: true });
            }
        }
        labelTemplates.value = Array.from(byId.values()) as any;
    } catch (err) {
        console.warn('[labelTemplates] Falha ao carregar modelos do banco', err);
    }
}

const ensureLabelTemplatesReady = async () => {
    await loadLabelTemplatesFromDb();
    await ensureBuiltInDefaultLabelTemplate();
    await ensureBuiltInBlackYellowLabelTemplate();
    await ensureBuiltInAtacarejoLabelTemplate();

    // Generate missing previews lazily (not persisted in the project JSON).
    const list = [...(labelTemplates.value || [])];
    let changed = false;
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t || (t as any).previewDataUrl) continue;
        const url = await renderLabelTemplatePreview(t);
        if (url) {
            (list[i] as any) = { ...(t as any), previewDataUrl: url };
            changed = true;
        }
    }
    if (changed) labelTemplates.value = list as any;
}

const upsertLabelTemplateToDb = async (tpl: LabelTemplate) => {
    if (!tpl || (tpl as any).isBuiltIn) return;
    try {
        await $fetch('/api/label-templates', {
            method: 'POST',
            body: {
                id: tpl.id,
                userId: currentUser.value?.id ?? null,
                name: tpl.name,
                kind: tpl.kind,
                group: tpl.group,
                previewDataUrl: tpl.previewDataUrl ?? null
            }
        });
    } catch (err) {
        console.warn('[labelTemplates] Falha ao salvar modelo no banco', err);
    }
}

const deleteLabelTemplateFromDb = async (templateId: string) => {
    if (!templateId) return;
    try {
        await $fetch('/api/label-templates', { method: 'DELETE', query: { id: templateId } });
    } catch (err) {
        console.warn('[labelTemplates] Falha ao excluir modelo do banco', err);
    }
}

const activeZoneTemplateId = () => {
    const z = canvas.value?.getActiveObject?.();
    if (z && isLikelyProductZone(z)) return (z as any)._zoneGlobalStyles?.splashTemplateId as (string | undefined);
    return undefined;
}

// Note: computed must depend on a reactive value; selectedObjectRef updates on selection events.
let canSaveLabelTemplateFromSelectionComputed: any = null;

// Canvas context menu (right click) - used for Arrange / Layer order like Figma
const canvasContextMenu = ref({
    show: false,
    x: 0,
    y: 0
});

const canvasContextMenuItems = computed(() => ([
    { label: 'Trazer para frente', action: 'arrange-bring-to-front', icon: ChevronsUp },
    { label: 'Avancar (uma camada)', action: 'arrange-bring-forward', icon: ArrowUp },
    { label: 'Recuar (uma camada)', action: 'arrange-send-backward', icon: ArrowDown },
    { label: 'Enviar para tras', action: 'arrange-send-to-back', icon: ChevronsDown },
    { divider: true },
    { label: 'Agrupar (Ctrl+G)', action: 'group-selection', icon: Group },
    { label: 'Desagrupar (Ctrl+Shift+G)', action: 'ungroup-selection', icon: Ungroup }
]));

const handleCanvasContextMenuSelect = (action: string) => {
    if (action === 'arrange-bring-to-front') arrangeActiveObjects('bring-to-front');
    if (action === 'arrange-bring-forward') arrangeActiveObjects('bring-forward');
    if (action === 'arrange-send-backward') arrangeActiveObjects('send-backward');
    if (action === 'arrange-send-to-back') arrangeActiveObjects('send-to-back');
    if (action === 'group-selection') groupSelection();
    if (action === 'ungroup-selection') ungroupSelection();
};

const groupSelection = () => {
    if (!canvas.value) return;
    const activeObject = canvas.value.getActiveObject();
    
    if (!activeObject) return;
    
    if (activeObject.type === 'activeSelection' && fabric.Group) {
        const group = new fabric.Group(activeObject.getObjects(), {
            originX: 'center',
            originY: 'center',
            selectable: true,
            evented: true
        });
        
        canvas.value.remove(activeObject);
        canvas.value.add(group);
        canvas.value.setActiveObject(group);
        canvas.value.requestRenderAll();
        canvasObjects.value = [...canvas.value.getObjects()];
        saveCurrentState();
    }
};

const ungroupSelection = () => {
    if (!canvas.value) return;
    const activeObject = canvas.value.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'group') return;
    
    const group = activeObject as any;
    const objects = group.getObjects();
    group.ungroupOnCanvas();
    
    canvas.value.setActiveObject(objects[0]);
    canvas.value.requestRenderAll();
    canvasObjects.value = [...canvas.value.getObjects()];
    saveCurrentState();
};

watch(showLabelTemplatesModal, async (open) => {
    if (!open) return;
    await ensureLabelTemplatesReady();
});

const addFrame = () => {
    if (!canvas.value) return;

    const frameWidth = 1080;
    const frameHeight = 1350;

    const getNextFrameName = () => {
        if (!canvas.value) return 'Frame 1';
        const frames = canvas.value.getObjects().filter((o: any) => !!o?.isFrame);
        let maxN = 0;
        frames.forEach((f: any) => {
            const n = (f?.layerName || f?.name || '').toString();
            const m = /^Frame\s+(\d+)\s*$/i.exec(n);
            if (m) maxN = Math.max(maxN, Number(m[1] || 0));
        });
        return `Frame ${maxN + 1}`;
    };

    // Calculate zoom to fit frame in viewport with padding
    const canvasWidth = canvas.value.getWidth() || 800;
    const canvasHeight = canvas.value.getHeight() || 600;
    const padding = 80; // Padding around frame
    const zoomX = (canvasWidth - padding * 2) / frameWidth;
    const zoomY = (canvasHeight - padding * 2) / frameHeight;
    const fitZoom = Math.min(zoomX, zoomY, 1); // Don't zoom more than 100%
    
    // Center position for the frame
    const centerX = frameWidth / 2;
    const centerY = frameHeight / 2;

    // Create Frame Rect - CENTRALIZADO
    const frame = new fabric.Rect({
        left: centerX,
        top: centerY,
        originX: 'center',
        originY: 'center',
        width: frameWidth,
        height: frameHeight,
        fill: '#ffffff',
        stroke: 'transparent',
        strokeWidth: 2,
        strokeUniform: true, // Stroke não afeta dimensões (1080 fica 1080, não 1082)
        isFrame: true, // Custom Flag used by after:render
        clipContent: true,
        name: getNextFrameName(),
        objectCaching: false, // Disabled to prevent trails during movement
        statefullCache: false,
        noScaleCache: true,
        hasBorders: true,
        transparentCorners: false,
        cornerColor: '#0d99ff',
        cornerSize: 8,
        padding: 0,
        // Controle preciso de resize (1 pixel por vez)
        lockScalingX: false,
        lockScalingY: false,
        // Usa controles de escala suave mas precisos
        cornerStrokeColor: '#0d99ff',
        borderScaleFactor: 1
    });

    (frame as any)._customId = Math.random().toString(36).substr(2, 9);
    (frame as any).__strokeEnabled = false;
    
    // CRITICAL: Set layerName to ensure it persists and shows as "FRAMER" in LayersPanel
    // The name "Frame N" is for canvas display, layerName "FRAMER" is for layers panel
    frame.layerName = 'FRAMER';

    canvas.value.add(frame);
    // Frames devem ficar atrás do conteúdo (evita bloquear drag/seleção de imagens)
    ensureFramesBelowContents();
    canvas.value.setActiveObject(frame);
    
    // Adjust zoom and center viewport to fit the frame
    canvas.value.setZoom(fitZoom);
    const vpt = canvas.value.viewportTransform || [1, 0, 0, 1, 0, 0];
    // Center the frame in viewport
    vpt[4] = (canvasWidth - frameWidth * fitZoom) / 2;
    vpt[5] = (canvasHeight - frameHeight * fitZoom) / 2;
    canvas.value.setViewportTransform(vpt);
    
    canvas.value.requestRenderAll();
    
    // Force update canvasObjects immediately so LayersPanel shows the new frame
    canvasObjects.value = [...canvas.value.getObjects()];
    
    saveCurrentState();
}

// === FRAMES (Figma-like) ===
// Basic parenting via `parentFrameId` + optional clipping via `clipContent`.
const ensureFramesBelowContents = () => {
    if (!canvas.value) return;
    const all = canvas.value.getObjects();
    // Keep non-export/system overlays (guides, etc.) pinned on top.
    const pinnedTop = all.filter((o: any) => !!o?.excludeFromExport);
    const list = all.filter((o: any) => !o?.excludeFromExport);
    // Put frames behind everything else (Figma-like: frame is a container/background).
    const frames = list.filter((o: any) => !!o?.isFrame);
    const rest = list.filter((o: any) => !o?.isFrame);
    console.log(`[ensureFramesBelowContents] frames=${frames.length}, rest=${rest.length}, pinnedTop=${pinnedTop.length}, total=${all.length}`);
    applyArrangedOrder(canvas.value, [...frames, ...rest, ...pinnedTop]);
};

const getFrameById = (id: string) => {
    if (!canvas.value || !id) return null;
    return canvas.value.getObjects().find((o: any) => o?.isFrame && o._customId === id) || null;
};

const getAllFrames = () => {
    if (!canvas.value) return [];
    return canvas.value.getObjects().filter((o: any) => !!o?.isFrame);
};

const getOrCreateFrameClipRect = (frame: any) => {
    if (!frame || !fabric) return null;
    const kRectLocal = 1 - 0.5522847498;
    const clampR = (n: any, w: number, h: number) => {
        const v = Math.max(0, Number(n || 0));
        return Math.min(v, w / 2, h / 2);
    };

    const buildCornerPath = (w: number, h: number, radii: any) => {
        const x = -w / 2;
        const y = -h / 2;
        const tl = clampR(radii?.tl, w, h);
        const tr = clampR(radii?.tr, w, h);
        const br = clampR(radii?.br, w, h);
        const bl = clampR(radii?.bl, w, h);

        const parts = [
            `M ${x + tl} ${y}`,
            `L ${x + w - tr} ${y}`,
            tr ? `C ${x + w - kRectLocal * tr} ${y} ${x + w} ${y + kRectLocal * tr} ${x + w} ${y + tr}` : '',
            `L ${x + w} ${y + h - br}`,
            br ? `C ${x + w} ${y + h - kRectLocal * br} ${x + w - kRectLocal * br} ${y + h} ${x + w - br} ${y + h}` : '',
            `L ${x + bl} ${y + h}`,
            bl ? `C ${x + kRectLocal * bl} ${y + h} ${x} ${y + h - kRectLocal * bl} ${x} ${y + h - bl}` : '',
            `L ${x} ${y + tl}`,
            tl ? `C ${x} ${y + kRectLocal * tl} ${x + kRectLocal * tl} ${y} ${x + tl} ${y}` : '',
            'Z'
        ].filter(Boolean);
        return parts.join(' ');
    };

    const hasCornerRadii = !!(frame.cornerRadii && typeof frame.cornerRadii === 'object');
    const wantPathClip = hasCornerRadii;

    // CRITICAL FIX: The clipPath needs to be created with proper offset calculation
    // When using absolutePositioned: false, the clipPath is relative to the object's origin
    // We need to calculate the offset from the object to the frame

    const clip = wantPathClip
        ? new fabric.Path(buildCornerPath(frame.width, frame.height, frame.cornerRadii), {
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            absolutePositioned: false,
            selectable: false,
            evented: false,
            objectCaching: false
        })
        : new fabric.Rect({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0,
            width: frame.width,
            height: frame.height,
            rx: frame.rx ?? 0,
            ry: frame.ry ?? 0,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            absolutePositioned: false,
            selectable: false,
            evented: false,
            objectCaching: false
        });

    clip._objects = [];
    (frame as any).__clipRect = clip;

    if (typeof clip.setCoords === 'function') clip.setCoords();
    clip.dirty = true;

    return clip;
};

const findFrameUnderObject = (obj: any) => {
    if (!canvas.value || !obj) return null;
    // Frames NUNCA podem ser filhos de outros frames
    if (obj.isFrame) return null;

    // First try using center point (faster)
    const center = typeof obj.getCenterPoint === 'function' ? obj.getCenterPoint() : null;
    const frames = getAllFrames().filter((f: any) => f !== obj);

    // Check intersection using bounding box for more reliable detection
    const objBounds = obj.getBoundingRect ? obj.getBoundingRect() : null;
    if (!objBounds) {
        // Fallback to center point method
        if (!center) return null;
        const hits = frames.filter((f: any) => typeof f.containsPoint === 'function' && f.containsPoint(center));
        if (!hits.length) return null;
        hits.sort((a: any, b: any) => (a.getScaledWidth() * a.getScaledHeight()) - (b.getScaledWidth() * b.getScaledHeight()));
        return hits[0];
    }

    // Use intersection for more accurate frame detection
    const hits = frames.filter((f: any) => {
        if (typeof f.intersectsWithObject !== 'function') return false;
        return f.intersectsWithObject(obj);
    });

    if (!hits.length) return null;

    // Prefer the smallest frame (innermost) when nested.
    hits.sort((a: any, b: any) => (a.getScaledWidth() * a.getScaledHeight()) - (b.getScaledWidth() * b.getScaledHeight()));
    return hits[0];
};

const syncObjectFrameClip = (obj: any) => {
    if (!canvas.value || !obj) return;
    if ((obj as any).excludeFromExport) return;

    // Product cards should NEVER be clipped by frames — they sit on top of frames
    if ((obj as any).isSmartObject || (obj as any).isProductCard) {
        if (obj.clipPath) {
            obj.set('clipPath', null);
            delete (obj as any)._frameClipOwner;
            obj.set('dirty', true);
            obj.setCoords();
        }
        return;
    }

    const frameId = (obj as any).parentFrameId as (string | undefined);
    const frame = frameId ? getFrameById(frameId) : null;

    // Se não tem frame pai ou clipContent desativado, remove clipPath
    if (!frame || !frame.clipContent) {
        if (obj.clipPath) {
            obj.set('clipPath', null);
            delete (obj as any)._frameClipOwner;
            obj.set('dirty', true);
            obj.setCoords();
        }
        return;
    }

    // ESTRATÉGIA: absolutePositioned: false (relativo ao objeto)
    // No Fabric.js v7, o cache do objeto tem tamanho limitado.
    // Com absolutePositioned: true, o clipPath layer canvas pode ser pequeno demais
    // para conter o clip em coordenadas globais, fazendo o clip falhar.
    // Com absolutePositioned: false, o clipPath fica relativo ao centro do objeto,
    // garantindo que esteja sempre dentro dos limites do layer canvas.

    const frameCenter = frame.getCenterPoint ? frame.getCenterPoint() : { x: frame.left, y: frame.top };
    const objCenter = obj.getCenterPoint ? obj.getCenterPoint() : { x: obj.left, y: obj.top };

    // Converter offset mundo → coordenadas locais do objeto (desrotacionar e desescalar)
    const dxWorld = frameCenter.x - objCenter.x;
    const dyWorld = frameCenter.y - objCenter.y;
    const objAngle = obj.angle || 0;
    const angleRad = -objAngle * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const dxLocal = (dxWorld * cos - dyWorld * sin) / (obj.scaleX || 1);
    const dyLocal = (dxWorld * sin + dyWorld * cos) / (obj.scaleY || 1);

    // Escala do clip: frame visual size / object scale
    const clipScaleX = (frame.scaleX || 1) / (obj.scaleX || 1);
    const clipScaleY = (frame.scaleY || 1) / (obj.scaleY || 1);
    const clipAngle = (frame.angle || 0) - objAngle;

    const hasCornerRadii = !!(frame.cornerRadii && typeof frame.cornerRadii === 'object');
    const wantPathClip = hasCornerRadii;

    // FIX FLICKERING: Reutilizar o clipPath existente quando possível em vez de criar um novo.
    // Criar um novo clipPath a cada chamada causa um "flash" porque o Fabric descarta o antigo
    // e o objeto fica momentaneamente sem clipping durante o re-render.
    const existingClip = obj.clipPath;
    const existingOwner = (obj as any)._frameClipOwner;
    const canReuseClip = existingClip && existingOwner === frame._customId &&
        ((wantPathClip && existingClip.type === 'path') || (!wantPathClip && existingClip.type === 'rect'));

    if (canReuseClip) {
        // Apenas atualizar posição/escala/ângulo do clipPath existente (sem recriar)
        const clipProps: any = {
            left: dxLocal,
            top: dyLocal,
            scaleX: clipScaleX,
            scaleY: clipScaleY,
            angle: clipAngle,
        };
        if (!wantPathClip) {
            clipProps.width = frame.width;
            clipProps.height = frame.height;
            clipProps.rx = frame.rx ?? 0;
            clipProps.ry = frame.ry ?? 0;
        }
        existingClip.set(clipProps);
        if (typeof existingClip.setCoords === 'function') existingClip.setCoords();
        existingClip.dirty = true;
        obj.set('dirty', true);
        obj.setCoords();
        return;
    }

    // Criar novo clipPath apenas quando necessário (primeiro clip ou troca de frame/tipo)
    const kRectLocal = 1 - 0.5522847498;
    const clampR = (n: any, w: number, h: number) => {
        const v = Math.max(0, Number(n || 0));
        return Math.min(v, w / 2, h / 2);
    };

    const buildCornerPath = (w: number, h: number, radii: any) => {
        const x = -w / 2;
        const y = -h / 2;
        const tl = clampR(radii?.tl, w, h);
        const tr = clampR(radii?.tr, w, h);
        const br = clampR(radii?.br, w, h);
        const bl = clampR(radii?.bl, w, h);

        const parts = [
            `M ${x + tl} ${y}`,
            `L ${x + w - tr} ${y}`,
            tr ? `C ${x + w - kRectLocal * tr} ${y} ${x + w} ${y + kRectLocal * tr} ${x + w} ${y + tr}` : '',
            `L ${x + w} ${y + h - br}`,
            br ? `C ${x + w} ${y + h - kRectLocal * br} ${x + w - kRectLocal * br} ${y + h} ${x + w - br} ${y + h}` : '',
            `L ${x + bl} ${y + h}`,
            bl ? `C ${x + kRectLocal * bl} ${y + h} ${x} ${y + h - kRectLocal * bl} ${x} ${y + h - bl}` : '',
            `L ${x} ${y + tl}`,
            tl ? `C ${x} ${y + kRectLocal * tl} ${x + kRectLocal * tl} ${y} ${x + tl} ${y}` : '',
            'Z'
        ].filter(Boolean);
        return parts.join(' ');
    };

    const clip = wantPathClip
        ? new fabric.Path(buildCornerPath(frame.width, frame.height, frame.cornerRadii), {
            originX: 'center',
            originY: 'center',
            left: dxLocal,
            top: dyLocal,
            scaleX: clipScaleX,
            scaleY: clipScaleY,
            angle: clipAngle,
            absolutePositioned: false,
            selectable: false,
            evented: false,
            objectCaching: false
        })
        : new fabric.Rect({
            originX: 'center',
            originY: 'center',
            left: dxLocal,
            top: dyLocal,
            width: frame.width,
            height: frame.height,
            rx: frame.rx ?? 0,
            ry: frame.ry ?? 0,
            scaleX: clipScaleX,
            scaleY: clipScaleY,
            angle: clipAngle,
            absolutePositioned: false,
            selectable: false,
            evented: false,
            objectCaching: false
        });

    clip._objects = [];
    (frame as any).__clipRect = clip;

    if (typeof clip.setCoords === 'function') clip.setCoords();
    clip.dirty = true;

    // Aplicar clipPath
    obj.set('clipPath', clip);
    (obj as any)._frameClipOwner = frame._customId;
    obj.set('dirty', true);
    obj.setCoords();
};

const syncFrameClips = (frame: any) => {
    if (!canvas.value || !frame?._customId) return;
    getOrCreateFrameClipRect(frame);

    // Get ALL children that are inside the frame bounds, not just those with parentFrameId set
    const allObjects = canvas.value.getObjects().filter((o: any) => o !== frame && !o.isFrame);
    const frameBounds = frame.getBoundingRect ? frame.getBoundingRect() : null;

    const children = allObjects.filter((o: any) => {
        // First check explicit parentFrameId
        if (o.parentFrameId === frame._customId) return true;

        // ISOLAMENTO: Se o objeto já pertence a OUTRO frame, NÃO roubar
        if (o.parentFrameId && o.parentFrameId !== frame._customId) return false;

        // Then check if object is physically inside the frame
        if (frameBounds && typeof o.getBoundingRect === 'function') {
            const objBounds = o.getBoundingRect();
            // Check if object center is within frame bounds
            const objCenterX = objBounds.left + objBounds.width / 2;
            const objCenterY = objBounds.top + objBounds.height / 2;
            const insideX = objCenterX >= frameBounds.left && objCenterX <= frameBounds.left + frameBounds.width;
            const insideY = objCenterY >= frameBounds.top && objCenterY <= frameBounds.top + frameBounds.height;

            if (insideX && insideY) {
                // Auto-assign parentFrameId if not set
                if (!o.parentFrameId) {
                    o.parentFrameId = frame._customId;
                }
                return true;
            }
        }

        return false;
    });

    let hasChanges = false;
    children.forEach((child: any) => {
        const beforeClip = child.clipPath;
        syncObjectFrameClip(child);
        if (child.clipPath !== beforeClip) hasChanges = true;
    });

    // CRITICAL: Force re-render after clipPath changes
    if (hasChanges) {
        canvas.value.requestRenderAll();
    }
};

const maybeReparentToFrameOnDrop = (obj: any) => {
    if (!canvas.value || !obj || (obj as any).excludeFromExport) return;
    // Product cards should NOT be parented to frames
    if ((obj as any).isSmartObject || (obj as any).isProductCard) return;
    const frame = findFrameUnderObject(obj);
    // If dropped outside of any frame, clear parenting so clipPath is removed.
    if (!frame || !frame._customId) {
        if ((obj as any).parentFrameId) {
            (obj as any).parentFrameId = undefined;
        }
        return;
    }
    if ((obj as any).parentFrameId !== frame._customId) {
        (obj as any).parentFrameId = frame._customId;
    }
};

const getFrameDescendants = (frame: any) => {
    if (!canvas.value || !frame?._customId) return [];
    const frameId = frame._customId;
    const objs = canvas.value.getObjects();

    const frameById = new Map<string, any>();
    objs.forEach((o: any) => {
        if (o?.isFrame && o._customId) frameById.set(o._customId, o);
    });

    const isDescendant = (obj: any) => {
        let id = obj?.parentFrameId as (string | undefined);
        let guard = 0;
        while (id && guard++ < 20) {
            if (id === frameId) return true;
            const parent = frameById.get(id);
            id = parent?.parentFrameId;
        }
        return false;
    };

    return objs.filter((o: any) => o !== frame && isDescendant(o));
};

const moveFrameDescendants = (frame: any, dx: number, dy: number, descendants?: any[]) => {
    if (!canvas.value) return;
    if (!dx && !dy) return;
    const list = Array.isArray(descendants) ? descendants : getFrameDescendants(frame);
    list.forEach((child: any) => {
        if (!child || child.excludeFromExport) return;
        child.set?.({
            left: (child.left ?? 0) + dx,
            top: (child.top ?? 0) + dy
        });
        child.setCoords?.();
    });
};

// --- Shape Utilities (Figma-ish) ---
const isRectObject = (obj: any) => String(obj?.type || '').toLowerCase() === 'rect';

const clampCornerRadii = (radii: any, w: number, h: number) => {
    const clamp = (n: any) => {
        const v = Math.max(0, Number(n || 0));
        return Math.min(v, w / 2, h / 2);
    };
    return {
        tl: clamp(radii?.tl),
        tr: clamp(radii?.tr),
        br: clamp(radii?.br),
        bl: clamp(radii?.bl)
    };
};

// Per-corner rounding by patching Fabric's Rect `_render` (keeps Rect behavior + resizing).
const applyRectCornerRadiiPatch = (rect: any) => {
    if (!rect || !isRectObject(rect) || typeof rect._renderPaintInOrder !== 'function') return;
    const radii = rect.cornerRadii;
    const has = !!(radii && typeof radii === 'object');

    if (!has) {
        // No custom corner radii - restore original render method
        // This allows Fabric.js's native rx/ry to work correctly
        if ((rect as any).__origRender) {
            rect._render = (rect as any).__origRender;
            delete (rect as any).__origRender;
            rect.dirty = true;
        }
        return;
    }

    if (!(rect as any).__origRender) (rect as any).__origRender = rect._render;

    rect._render = function (ctx: CanvasRenderingContext2D) {
        const w = this.width;
        const h = this.height;
        const x = -w / 2;
        const y = -h / 2;
        const k = 1 - 0.5522847498;
        const r = clampCornerRadii(this.cornerRadii, w, h);

        ctx.beginPath();
        ctx.moveTo(x + r.tl, y);
        ctx.lineTo(x + w - r.tr, y);
        r.tr && ctx.bezierCurveTo(x + w - k * r.tr, y, x + w, y + k * r.tr, x + w, y + r.tr);
        ctx.lineTo(x + w, y + h - r.br);
        r.br && ctx.bezierCurveTo(x + w, y + h - k * r.br, x + w - k * r.br, y + h, x + w - r.br, y + h);
        ctx.lineTo(x + r.bl, y + h);
        r.bl && ctx.bezierCurveTo(x + k * r.bl, y + h, x, y + h - k * r.bl, x, y + h - r.bl);
        ctx.lineTo(x, y + r.tl);
        r.tl && ctx.bezierCurveTo(x, y + k * r.tl, x + k * r.tl, y, x + r.tl, y);
        ctx.closePath();
        this._renderPaintInOrder(ctx);
    };
    // Avoid double rounding via rx/ry - ONLY when using custom cornerRadii
    // This ensures Fabric.js's native rx/ry works when not using custom radii
    rect.set?.({ rx: 0, ry: 0 });
    rect.dirty = true;
};

const isTransparentPaint = (v: any) => {
    if (v == null) return true;
    if (v === '' || v === 'transparent') return true;
    if (typeof v !== 'string') return false;
    return v.startsWith('rgba') && v.replace(/\s/g, '').endsWith(',0)');
};

const toggleFill = (obj: any, enabled: boolean) => {
    if (!obj) return;
    (obj as any).__fillEnabled = !!enabled;
    if (enabled) {
        const prev = (obj as any).__fillBackup;
        const next = !isTransparentPaint(prev) ? prev : (!isTransparentPaint(obj.fill) ? obj.fill : '#ffffff');
        obj.set?.('fill', next);
    } else {
        (obj as any).__fillBackup = obj.fill;
        obj.set?.('fill', 'rgba(0,0,0,0)');
    }
};

const toggleStroke = (obj: any, enabled: boolean) => {
    if (!obj) return;
    (obj as any).__strokeEnabled = !!enabled;
    if (enabled) {
        const strokePrev = (obj as any).__strokeBackup;
        const widthPrev = (obj as any).__strokeWidthBackup;
        const dashPrev = (obj as any).__strokeDashBackup;
        if (strokePrev) obj.set?.('stroke', strokePrev);
        if (widthPrev != null) obj.set?.('strokeWidth', Number(widthPrev) || 1);
        if (dashPrev != null) obj.set?.('strokeDashArray', dashPrev);
        if (!obj.stroke) obj.set?.('stroke', '#000000');
        if (!obj.strokeWidth || obj.strokeWidth <= 0) obj.set?.('strokeWidth', 1);
    } else {
        (obj as any).__strokeBackup = obj.stroke;
        (obj as any).__strokeWidthBackup = obj.strokeWidth;
        (obj as any).__strokeDashBackup = obj.strokeDashArray;
        obj.set?.({ stroke: 'rgba(0,0,0,0)', strokeWidth: 0, strokeDashArray: null });
    }
};

// ─── Sticker Outline (alpha-based contour) ───────────────────────────────
// Generates an outline that follows the alpha channel of PNGs (not a bounding-box border).
// Uses offscreen canvas + alpha dilation + color fill, cached for performance.

/** Detect whether an image has any transparent pixel (alpha < 255). */
const imageHasTransparency = (img: HTMLImageElement | HTMLCanvasElement): boolean => {
    try {
        const oc = document.createElement('canvas');
        const w = (img as any).naturalWidth || img.width;
        const h = (img as any).naturalHeight || img.height;
        if (!w || !h) return false;
        // Sample at reduced size for speed
        const maxDim = 256;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        oc.width = Math.ceil(w * scale);
        oc.height = Math.ceil(h * scale);
        const octx = oc.getContext('2d', { willReadFrequently: true });
        if (!octx) return false;
        octx.drawImage(img, 0, 0, oc.width, oc.height);
        const data = octx.getImageData(0, 0, oc.width, oc.height).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i]! < 250) return true;
        }
        return false;
    } catch { return false; }
};

/**
 * Generate a professional sticker outline canvas from source alpha.
 *
 * KEY TECHNIQUES for smooth, jagged-free outlines:
 *   1. Supersampling 2x — compute distance field at double resolution, then
 *      downsample with bilinear filtering for natural anti-aliasing.
 *   2. Alpha-weighted initial distances — instead of a binary inside/outside mask,
 *      use the actual alpha values (0-1) as sub-pixel offsets in the EDT.
 *      This preserves the anti-aliasing of the source image edges.
 *   3. Quintic smoothstep (6t⁵ − 15t⁴ + 10t³) — smoother C² transition
 *      vs the cubic hermite (3t² − 2t³) used before.
 *   4. Wider soft edge — the fade-out zone is proportional to the outline
 *      width, giving thick outlines a softer, more natural look.
 */
const generateStickerOutlineCanvas = (
    img: HTMLImageElement | HTMLCanvasElement,
    outlineWidth: number,
    outlineColor: string,
    outlineOpacity: number,
    outlineMode: 'outside' | 'inside' = 'outside'
): HTMLCanvasElement | null => {
    try {
        // If the image element isn't ready yet, return null and let the caller retry.
        if (img && (img as any).tagName === 'IMG') {
            const im = img as HTMLImageElement;
            if (!im.complete || (im.naturalWidth || 0) <= 0 || (im.naturalHeight || 0) <= 0) {
                return null;
            }
        }

        const srcW = (img as any).naturalWidth || img.width;
        const srcH = (img as any).naturalHeight || img.height;
        if (!srcW || !srcH || outlineWidth <= 0) return null;

        // ── Supersampling factor ──────────────────────────────────────────
        // 2x removes visible stair-stepping; fall back to 1x for very large
        // images to keep memory under control (< 16 M pixels in the grid).
        let ssScale = 2;
        const ssW = srcW * ssScale;
        const ssH = srcH * ssScale;
        const wSs = outlineWidth * ssScale;
        const softSs = Math.max(1.5 * ssScale, wSs * 0.35);
        let padSs = Math.ceil(wSs + softSs + ssScale * 3);
        let gridW = ssW + padSs * 2;
        let gridH = ssH + padSs * 2;
        if (gridW * gridH > 16_000_000) {
            // Image too large for 2x — fall back to 1x supersampling
            ssScale = 1;
        }

        // Recalculate dimensions with final ssScale
        const finalSsW = srcW * ssScale;
        const finalSsH = srcH * ssScale;
        const wScaled = outlineWidth * ssScale;
        const softScaled = Math.max(1.5 * ssScale, wScaled * 0.35);
        padSs = Math.ceil(wScaled + softScaled + ssScale * 3);
        const cw = finalSsW + padSs * 2;
        const ch = finalSsH + padSs * 2;
        const size = cw * ch;

        // ── 1) Draw source at supersampled resolution ─────────────────────
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = finalSsW;
        srcCanvas.height = finalSsH;
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        if (!srcCtx) return null;
        srcCtx.imageSmoothingEnabled = true;
        srcCtx.imageSmoothingQuality = 'high';
        srcCtx.drawImage(img, 0, 0, finalSsW, finalSsH);
        const srcData = srcCtx.getImageData(0, 0, finalSsW, finalSsH).data;

        // ── 2) Build alpha map (float 0–1) preserving AA edge data ────────
        const alphaMap = new Float32Array(size);
        for (let y = 0; y < finalSsH; y++) {
            const srcRow = y * finalSsW;
            const dstRow = (y + padSs) * cw;
            for (let x = 0; x < finalSsW; x++) {
                alphaMap[dstRow + (x + padSs)] = (srcData[(srcRow + x) * 4 + 3] as number) / 255;
            }
        }

	        // `inside`: any non-zero alpha counts as "inside" so the outline never bleeds
	        // through anti-aliased edges (alpha=1 is 1/255 ≈ 0.00392).
	        const inside = new Uint8Array(size);
	        for (let i = 0; i < size; i++) {
	            if (alphaMap[i]! > 0) inside[i] = 1;
	        }

	        // `barrier`: a stronger mask for flood-fill so the "outside" region can't leak
	        // into internal holes through tiny AA gaps. We dilate by 1px to seal.
	        const barrier = new Uint8Array(size);
	        const barrierThreshold = 16 / 255; // ~0.0627
	        for (let i = 0; i < size; i++) {
	            if (alphaMap[i]! >= barrierThreshold) barrier[i] = 1;
	        }
	        // 1px dilation (8-neighborhood)
	        const barrierDilated = new Uint8Array(size);
	        for (let i = 0; i < size; i++) {
	            if (!barrier[i]) continue;
	            barrierDilated[i] = 1;
	            const x = i % cw;
	            const y = (i / cw) | 0;
	            for (let dy = -1; dy <= 1; dy++) {
	                const yy = y + dy;
	                if (yy < 0 || yy >= ch) continue;
	                const row = yy * cw;
	                for (let dx = -1; dx <= 1; dx++) {
	                    const xx = x + dx;
	                    if (xx < 0 || xx >= cw) continue;
	                    barrierDilated[row + xx] = 1;
	                }
	            }
	        }

        // ── 3) Flood-fill external background ─────────────────────────────
        // Prevents outline from appearing inside internal "holes" (professional sticker style).
	        const outside = new Uint8Array(size);
	        const queue = new Int32Array(size);
	        let qh = 0;
	        let qt = 0;
	        const tryEnqueue = (idx: number) => {
	            if (idx < 0 || idx >= size || outside[idx] || barrierDilated[idx]) return;
	            outside[idx] = 1;
	            queue[qt++] = idx;
	        };
        for (let x = 0; x < cw; x++) { tryEnqueue(x); tryEnqueue((ch - 1) * cw + x); }
        for (let y = 1; y < ch - 1; y++) { tryEnqueue(y * cw); tryEnqueue(y * cw + cw - 1); }
        while (qh < qt) {
            const idx = queue[qh++]!;
            const x = idx % cw;
            const y = (idx / cw) | 0;
            if (x > 0) tryEnqueue(idx - 1);
            if (x < cw - 1) tryEnqueue(idx + 1);
            if (y > 0) tryEnqueue(idx - cw);
            if (y < ch - 1) tryEnqueue(idx + cw);
        }

        // ── 4) Euclidean Distance Transform (EDT) ─────────────────────────
        // Alpha-weighted initial distances: fully opaque → 0, semi-transparent
        // edge → small sub-pixel offset, fully transparent → INF.
        const INF = 1e20;
        const maxN = Math.max(cw, ch);
        const f = new Float64Array(maxN);
        const d = new Float64Array(maxN);
        const v = new Int32Array(maxN);
        const z = new Float64Array(maxN + 1);

        const edt1d = (n: number) => {
            let k = 0;
            v[0] = 0;
            z[0] = -INF;
            z[1] = INF;
            for (let q = 1; q < n; q++) {
                let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * (q - v[k]!));
                while (k > 0 && s <= z[k]!) {
                    k--;
                    s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * (q - v[k]!));
                }
                k++;
                v[k] = q;
                z[k] = s;
                z[k + 1] = INF;
            }
            k = 0;
            for (let q = 0; q < n; q++) {
                while (z[k + 1]! < q) k++;
                const dx = q - v[k]!;
                d[q] = dx * dx + f[v[k]!]!;
            }
        };

        const computeDistSq = (initFn: (idx: number) => number) => {
            // Row pass
            const rowDT = new Float32Array(size);
            for (let y = 0; y < ch; y++) {
                const row = y * cw;
                for (let x = 0; x < cw; x++) f[x] = initFn(row + x);
                edt1d(cw);
                for (let x = 0; x < cw; x++) rowDT[row + x] = d[x] as number;
            }
            // Column pass
            const distSq = new Float32Array(size);
            for (let x = 0; x < cw; x++) {
                for (let y = 0; y < ch; y++) f[y] = rowDT[y * cw + x] as number;
                edt1d(ch);
                for (let y = 0; y < ch; y++) distSq[y * cw + x] = d[y] as number;
            }
            return distSq;
        };

        // Distance to nearest "inside" — alpha-weighted for sub-pixel accuracy.
        const distSqToInside = computeDistSq((idx) => {
            const a = alphaMap[idx]!;
            if (a >= 0.99) return 0;
            if (a > 0.01) return (1 - a) * (1 - a); // sub-pixel offset proportional to transparency
            return INF;
        });

        // Distance to nearest "outside-connected" pixel (for inside-mode outline).
        const distSqToOutside = outlineMode === 'inside'
            ? computeDistSq((idx) => outside[idx] ? 0 : INF)
            : null;

        // ── 5) Render outline at supersampled resolution ──────────────────
        const ssOutCanvas = document.createElement('canvas');
        ssOutCanvas.width = cw;
        ssOutCanvas.height = ch;
        const ssOutCtx = ssOutCanvas.getContext('2d');
        if (!ssOutCtx) return null;

        const outImgData = ssOutCtx.createImageData(cw, ch);

        // Parse outline color via a 1×1 canvas (supports any CSS color string).
        const tmpC = document.createElement('canvas');
        tmpC.width = 1;
        tmpC.height = 1;
        const tmpCtx = tmpC.getContext('2d')!;
        tmpCtx.fillStyle = outlineColor || '#000000';
        tmpCtx.fillRect(0, 0, 1, 1);
        const cd = tmpCtx.getImageData(0, 0, 1, 1).data;
        const cr = cd[0] as number;
        const cg = cd[1] as number;
        const cb = cd[2] as number;
        const baseAlpha = Math.min(1, Math.max(0, outlineOpacity));

        const maxDist = wScaled + softScaled;
        const maxDistSq = maxDist * maxDist;

        for (let i = 0; i < size; i++) {
            const isIn = !!inside[i];

            if (outlineMode === 'outside') {
                // Preenche TUDO que não é "inside" (inclui buracos internos de letras
                // como R, O, D, G etc.) — efeito sticker sólido sem vazios.
                if (isIn) continue;
            } else {
                if (!isIn) continue;
            }

            const dsq = outlineMode === 'inside'
                ? (distSqToOutside ? distSqToOutside[i]! : INF)
                : distSqToInside[i]!;
            if (dsq > maxDistSq) continue;

            const dist = Math.sqrt(dsq);
            // Quintic smoothstep: 6t⁵ − 15t⁴ + 10t³ — C² continuous, much smoother.
            const raw = (maxDist - dist) / softScaled;
            const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
            const smoothT = t * t * t * (t * (t * 6 - 15) + 10);
            const a = Math.round(baseAlpha * smoothT * 255);
            if (a <= 0) continue;

            const o = i * 4;
            outImgData.data[o] = cr;
            outImgData.data[o + 1] = cg;
            outImgData.data[o + 2] = cb;
            outImgData.data[o + 3] = a;
        }

        ssOutCtx.putImageData(outImgData, 0, 0);

        // ── 6) Downsample to native resolution ────────────────────────────
        // The bilinear/bicubic downsampling acts as a free anti-aliasing pass.
        // CRITICAL: finalPad MUST equal padSs/ssScale so that the image-to-padding
        // ratio is identical in both the supersampled and final canvases.
        // Using an independent formula causes the outline to be displaced.
        const finalPad = Math.ceil(padSs / ssScale);
        const finalW = srcW + finalPad * 2;
        const finalH = srcH + finalPad * 2;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = finalW;
        outCanvas.height = finalH;
        const outCtx = outCanvas.getContext('2d')!;
        if (!outCtx) return null;
        outCtx.imageSmoothingEnabled = true;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(ssOutCanvas, 0, 0, cw, ch, 0, 0, finalW, finalH);

        // Store effective padding + source dimensions so the render patch
        // can align the outline pixel-perfectly even if obj.width differs.
        (outCanvas as any).__outlinePad = finalPad;
        (outCanvas as any).__outlineSrcW = srcW;
        (outCanvas as any).__outlineSrcH = srcH;

        return outCanvas;
    } catch (e) {
        console.error('[StickerOutline] Erro ao gerar outline:', e);
        return null;
    }
};

/** Apply or remove the sticker outline render patch on a fabric.Image object. */
	const applyStickerOutlinePatch = (obj: any) => {
	    if (!obj || String(obj.type || '').toLowerCase() !== 'image') return;

	    const enabled = !!(obj as any).__stickerOutlineEnabled;
	    const width = Number((obj as any).__stickerOutlineWidth) || 4;
	    const color = (obj as any).__stickerOutlineColor || '#FFFFFF';
	    const opacity = (obj as any).__stickerOutlineOpacity ?? 1;
	    const mode: 'outside' | 'inside' = ((obj as any).__stickerOutlineMode === 'inside') ? 'inside' : 'outside';
	    if (!(obj as any).__stickerOutlineMode) (obj as any).__stickerOutlineMode = mode;

	    // Clear cache when params change
	    const cacheKey = `${enabled}|${mode}|${width}|${color}|${opacity}|${obj.width}|${obj.height}`;
	    if ((obj as any).__stickerCacheKey !== cacheKey) {
	        (obj as any).__stickerOutlineCache = null;
	        (obj as any).__stickerCacheKey = cacheKey;
	    }

	    if (!enabled) {
	        // Restore caching behavior (outline draws outside bounds; we disable caching while enabled to avoid clipping).
	        if ((obj as any).__stickerOrigObjectCaching !== undefined) {
	            obj.objectCaching = (obj as any).__stickerOrigObjectCaching;
	            delete (obj as any).__stickerOrigObjectCaching;
	        }
	        // Clear any stale cache canvas that may have been created while caching was enabled.
	        try {
	            (obj as any)._cacheCanvas = null;
	            (obj as any)._cacheContext = null;
	        } catch {
	            // ignore
	        }
	        // Remove patch, restore original drawObject
	        if ((obj as any).__origDrawObjectSticker) {
	            obj.drawObject = (obj as any).__origDrawObjectSticker;
	            delete (obj as any).__origDrawObjectSticker;
	        }
	        // Remove render patch, restore original render
	        if ((obj as any).__origRenderSticker) {
	            obj.render = (obj as any).__origRenderSticker;
	            delete (obj as any).__origRenderSticker;
	        }
	        (obj as any).__stickerOutlineCache = null;
	        obj.dirty = true;
	        return;
	    }

	    // CRITICAL: Fabric caches objects into a bounded offscreen canvas.
	    // Our sticker outline deliberately draws outside the image bounds and would get clipped.
	    // Disable caching while enabled for correctness.
	    if ((obj as any).__stickerOrigObjectCaching === undefined) {
	        (obj as any).__stickerOrigObjectCaching = obj.objectCaching;
	    }
	    obj.objectCaching = false;
	    // Ensure any previously computed cache gets dropped immediately.
	    try {
	        (obj as any)._cacheCanvas = null;
	        (obj as any)._cacheContext = null;
	    } catch {
	        // ignore
	    }

    // Patch drawObject — called by render() AFTER ctx transform is applied
    // Pipeline: render() → ctx.save() → transform(ctx) → drawObject(ctx) → ctx.restore()
    // So inside drawObject, we're in the object's local coordinate space.
    if (!(obj as any).__origDrawObjectSticker) {
        (obj as any).__origDrawObjectSticker = obj.drawObject;
    }

	    obj.drawObject = function (ctx: CanvasRenderingContext2D, forClipping: boolean, context: any) {
	        const drawOutline = () => {
	            if (forClipping || !this.__stickerOutlineEnabled || !this.__stickerOutlineCache) return;
	            try {
	                const cache = this.__stickerOutlineCache;
	                const pad = (cache as any).__outlinePad || (Math.ceil(Number(this.__stickerOutlineWidth) || 4) + 2);
	                const cacheW = cache.width;
	                const cacheH = cache.height;
	                const srcW = (cache as any).__outlineSrcW || (cacheW - pad * 2);
	                const srcH = (cache as any).__outlineSrcH || (cacheH - pad * 2);
	                const w = this.width;
	                const h = this.height;
	                const sx = w / srcW;
	                const sy = h / srcH;
	                const drawW = cacheW * sx;
	                const drawH = cacheH * sy;
	                ctx.drawImage(
	                    cache,
	                    -drawW / 2,
	                    -drawH / 2,
	                    drawW,
	                    drawH
	                );
	            } catch {
	                // Silent — never break image rendering
	            }
	        };

	        // INSIDE mode: draw outline on top of image (dentro do clip context).
	        // OUTSIDE mode: NÃO desenha aqui — é desenhado no render() fora do clipPath.
	        const res = (this as any).__origDrawObjectSticker.call(this, ctx, forClipping, context);

	        const mode: 'outside' | 'inside' = (this as any).__stickerOutlineMode === 'inside' ? 'inside' : 'outside';
	        if (mode === 'inside') drawOutline();
	        return res;
	    };

    // Patch render — para outside mode, desenha o contorno FORA do clipPath context.
    // Isso garante que o contorno se estenda além dos limites do frame/artboard.
    if (!(obj as any).__origRenderSticker) {
        (obj as any).__origRenderSticker = obj.render;
    }

    obj.render = function (ctx: CanvasRenderingContext2D) {
        // Render normal (com clipPath/frame clipping aplicado)
        (this as any).__origRenderSticker.call(this, ctx);

        // OUTSIDE mode: desenha o contorno APÓS o render completo,
        // em seu próprio save/restore — sem herdar o clipPath.
        // O outline cache só contém pixels onde a imagem é transparente,
        // então desenhar por cima não cobre o conteúdo da imagem.
        const mode: 'outside' | 'inside' = (this as any).__stickerOutlineMode === 'inside' ? 'inside' : 'outside';
        if (mode === 'outside' && this.__stickerOutlineEnabled && this.__stickerOutlineCache) {
            try {
                const cache = this.__stickerOutlineCache;
                const cacheW = cache.width;
                const cacheH = cache.height;
                const pad = (cache as any).__outlinePad || 0;
                const srcW = (cache as any).__outlineSrcW || (cacheW - pad * 2);
                const srcH = (cache as any).__outlineSrcH || (cacheH - pad * 2);
                const w = this.width;
                const h = this.height;
                const sx = w / srcW;
                const sy = h / srcH;
                const drawW = cacheW * sx;
                const drawH = cacheH * sy;

                ctx.save();
                // Aplica a mesma transformação do objeto (posição, escala, rotação)
                const m = this.calcTransformMatrix();
                ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
                // Respeitar opacidade do objeto
                ctx.globalAlpha *= (this.opacity || 1);
                ctx.drawImage(
                    cache,
                    -drawW / 2,
                    -drawH / 2,
                    drawW,
                    drawH
                );
                ctx.restore();
            } catch {
                // Silent — never break image rendering
            }
        }
    };

    obj.dirty = true;

    // Generate outline canvas — with retry mechanism for images not yet loaded
    const tryGenerate = (attempt: number) => {
        const el = obj._element || obj.getElement?.();
        const maxAttempts = 6;
        const delays = [80, 180, 350, 700, 1500, 3000];

        const isImgEl = el && (el as any).tagName === 'IMG';
        const ready =
            !!el &&
            (!isImgEl ||
                (((el as HTMLImageElement).complete) &&
                    (((el as HTMLImageElement).naturalWidth || 0) > 0) &&
                    (((el as HTMLImageElement).naturalHeight || 0) > 0)));

        if (!ready) {
            if (attempt < maxAttempts) {
                setTimeout(() => {
                    if ((obj as any).__stickerOutlineEnabled) tryGenerate(attempt + 1);
                }, delays[attempt] ?? 1000);
            }
            return;
        }

	        try {
	            const outCanvas = generateStickerOutlineCanvas(el, width, color, opacity, mode);
	            if (outCanvas) {
	                (obj as any).__stickerOutlineCache = outCanvas;
	                obj.dirty = true;
	                canvas.value?.renderAll?.();
                return;
            }
        } catch (e) {
            console.warn('[StickerOutline] Erro ao gerar outline:', e);
        }

        // Generation can fail while the image is still decoding; retry a few times.
        if (attempt < maxAttempts) {
            setTimeout(() => {
                if ((obj as any).__stickerOutlineEnabled) tryGenerate(attempt + 1);
            }, delays[attempt] ?? 1000);
        }
    };

    if (!(obj as any).__stickerOutlineCache) {
        setTimeout(() => tryGenerate(0), 30);
    }
};

/** Invalidate sticker outline cache and regenerate asynchronously. */
const invalidateStickerOutlineCache = (obj: any) => {
    if (!obj) return;
    (obj as any).__stickerOutlineCache = null;
    (obj as any).__stickerCacheKey = null;
    obj.dirty = true;

    // Regenerate async if enabled
    if ((obj as any).__stickerOutlineEnabled) {
        const el = obj._element || obj.getElement?.();
        // Let `applyStickerOutlinePatch` handle retry/backoff reliably.
        setTimeout(() => {
            try {
                applyStickerOutlinePatch(obj);
            } catch {
                // ignore
            }
        }, el ? 50 : 120);
    }
};

const setTool = (tool: 'select' | 'draw' | 'pen') => {
    if (!canvas.value) return;

    // Reset States
    isNodeEditing.value = false;
    exitNodeEditing();
    isPenMode.value = false;
    penPathPoints.value = [];
    currentPenPath.value = null;
    
    if (tool === 'draw') {
        isDrawing.value = true;
        canvas.value.isDrawingMode = true;
        canvas.value.discardActiveObject();
        canvas.value.requestRenderAll();

        // Setup Brush
        if (!canvas.value.freeDrawingBrush) {
            canvas.value.freeDrawingBrush = new fabric.PencilBrush(canvas.value);
        }
        // Ensure defaults or keep previous
        if(!canvas.value.freeDrawingBrush.width) canvas.value.freeDrawingBrush.width = 5;
        if(!canvas.value.freeDrawingBrush.color) canvas.value.freeDrawingBrush.color = "#ffffff";

        // Create a Proxy Object for Properties Panel
        // This allows the user to edit the Brush using the existing sidebar
        const brushProxy = {
            _customId: 'brush-settings',
            type: 'brush-proxy', // Custom type for logic
            name: 'Configurações do Pincel',
            stroke: canvas.value.freeDrawingBrush.color,
            strokeWidth: canvas.value.freeDrawingBrush.width,
            strokeLineCap: (canvas.value.freeDrawingBrush as any).strokeLineCap || 'round',
            strokeLineJoin: (canvas.value.freeDrawingBrush as any).strokeLineJoin || 'round',
            strokeDashArray: (canvas.value.freeDrawingBrush as any).strokeDashArray || null,
            fill: canvas.value.freeDrawingBrush.color, // Mirror color to fill for UI convenience
            opacity: 1,
            visible: true,
            lockMovementX: false,
            // Mock methods to prevent UI errors
            getBoundingRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
            getScaledWidth: () => 0,
            getScaledHeight: () => 0,
            set: (key: string, val: any) => { /* handled in updateObjectProperty */ }
        };
        
        selectedObjectRef.value = brushProxy;
        triggerRef(selectedObjectRef);
        
    } else if (tool === 'pen') {
        // Pen Tool Mode (Vector Path Creation)
        isPenMode.value = true;
        isDrawing.value = false;
        canvas.value.isDrawingMode = false;
        canvas.value.discardActiveObject();
        canvas.value.defaultCursor = 'crosshair';
        canvas.value.selection = false; // Disable rubber-band selection in pen mode
        // Make all objects non-selectable during pen mode
        canvas.value.getObjects().forEach((o: any) => {
            o._prevEvented = o.evented;
            o.evented = false;
        });
        canvas.value.requestRenderAll();
        
    } else {
        // Select Mode
        isDrawing.value = false;
        canvas.value.isDrawingMode = false;
        canvas.value.defaultCursor = 'default';
        canvas.value.selection = true; // Re-enable rubber-band selection
        // Restore evented state for all objects
        canvas.value.getObjects().forEach((o: any) => {
            if (o._prevEvented !== undefined) {
                o.evented = o._prevEvented;
                delete o._prevEvented;
            } else {
                o.evented = true;
            }
        });
        selectedObjectRef.value = null;
        triggerRef(selectedObjectRef);
    }
}

const toggleDrawing = () => {
    if (isDrawing.value) setTool('select');
    else setTool('draw');
}

const togglePenMode = () => {
    if (isPenMode.value) {
        // Finish current path if exists
        finishPenPath();
        currentMousePos.value = null;
        setTool('select');
    } else {
        setTool('pen');
    }
}

// ============================================================================
// PEN TOOL - Vector Path Creation & Editing (Figma Style)
// ============================================================================

// Finish current pen path
const finishPenPath = () => {
    if (!canvas.value || penPathPoints.value.length < 2) {
        // Remove preview path if exists
        if (currentPenPath.value) {
            canvas.value.remove(currentPenPath.value);
            currentPenPath.value = null;
        }
        penPathPoints.value = [];
        return;
    }
    
    // Remove preview path before creating final path
    if (currentPenPath.value) {
        canvas.value.remove(currentPenPath.value);
        currentPenPath.value = null;
    }
    
    // Create SVG path string from points
    let pathString = '';
    penPathPoints.value.forEach((point, index) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`;
        } else {
            const prevPoint = penPathPoints.value[index - 1];
            if (prevPoint && point.handles && point.handles.in) {
                // Bezier curve
                const cp1x = prevPoint.handles?.out?.x ?? prevPoint.x;
                const cp1y = prevPoint.handles?.out?.y ?? prevPoint.y;
                const cp2x = point.handles.in.x;
                const cp2y = point.handles.in.y;
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
            } else {
                // Straight line
                pathString += ` L ${point.x} ${point.y}`;
            }
        }
    });
    
    // Create Fabric Path object
    const path = new fabric.Path(pathString, {
        fill: 'transparent',
        stroke: '#0d99ff', // Azul Figma - mais visível em fundos escuros
        strokeWidth: 3, // Aumentado para melhor visibilidade
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: true,
        evented: true,
        _customId: Math.random().toString(36).substr(2, 9),
        name: 'Vector Path',
        isVectorPath: true, // Custom flag
        penPathData: JSON.parse(JSON.stringify(penPathPoints.value)) // Store original points for editing
    });
    
    canvas.value.add(path);
    canvas.value.setActiveObject(path);
    selectedObjectRef.value = path;
    triggerRef(selectedObjectRef);
    
    // Reset
    penPathPoints.value = [];
    if (currentPenPath.value) {
        canvas.value.remove(currentPenPath.value);
        currentPenPath.value = null;
    }
    if (currentPenPoint.value) {
        canvas.value.remove(currentPenPoint.value);
        currentPenPoint.value = null;
    }
    currentMousePos.value = null;
    canvas.value.requestRenderAll();
    saveCurrentState();
}

// Add point to current pen path
const addPenPoint = (point: {x: number, y: number}, withHandles = false) => {
    if (!isPenMode.value) return;
    
    // Check if clicking near the first point to close the path
    if (penPathPoints.value.length >= 2) {
        const firstPoint = penPathPoints.value[0];
        if (!firstPoint) return;
        const distance = Math.sqrt(
            Math.pow(point.x - firstPoint.x, 2) +
            Math.pow(point.y - firstPoint.y, 2)
        );
        const threshold = 15; // pixels - adjust as needed
        
        if (distance < threshold) {
            // Close the path and finish
            closePath();
            // Reset pen mode to stop creating new lines
            penPathPoints.value = [];
            currentPenPath.value = null;
            currentMousePos.value = null;
            if (canvas.value) {
                canvas.value.requestRenderAll();
            }
            return;
        }
    }
    
    penPathPoints.value.push({
        ...point,
        handles: withHandles ? {
            in: { x: point.x - 20, y: point.y },
            out: { x: point.x + 20, y: point.y }
        } : undefined
    });
    
    // Update preview path
    updatePenPreview();
}

// Update preview path while drawing - REAL-TIME without rastros
const updatePenPreview = () => {
    if (!canvas.value || penPathPoints.value.length < 1) return;
    
    if (penPathPoints.value.length < 2) {
        // Show first point + preview line to mouse position
        const firstPoint = penPathPoints.value[0];
        if (!firstPoint) return;

        // Create/update point circle (only once)
        if (!currentPenPoint.value) {
            currentPenPoint.value = new fabric.Circle({
                left: firstPoint.x,
                top: firstPoint.y,
                radius: 4,
                fill: '#0d99ff',
                stroke: '#ffffff',
                strokeWidth: 1,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                excludeFromExport: true
            });
            canvas.value.add(currentPenPoint.value);
        }
        
        // Only show preview line if mouse position is available
        if (currentMousePos.value) {
            // Ensure coordinates are valid numbers
            const endX = typeof currentMousePos.value.x === 'number' ? currentMousePos.value.x : 0;
            const endY = typeof currentMousePos.value.y === 'number' ? currentMousePos.value.y : 0;
            
            // Update existing preview line OR create new one
            if (currentPenPath.value) {
                // UPDATE existing line path (no create/remove = no rastro!)
                const newPathString = `M ${firstPoint.x} ${firstPoint.y} L ${endX} ${endY}`;
                try {
                    currentPenPath.value.set('path', fabric.util.parsePath(newPathString));
                    currentPenPath.value.setCoords();
                    // Ensure no clipping
                    currentPenPath.value.set('clipTo', undefined);
                    // Force immediate render for smooth preview
                    safeRequestRenderAll();
                } catch (e) {
                    // If update fails, recreate the path
                    canvas.value.remove(currentPenPath.value);
                    currentPenPath.value = new fabric.Path(newPathString, {
                        fill: 'transparent',
                        stroke: '#0d99ff',
                        strokeWidth: 2,
                        selectable: false,
                        evented: false,
                        excludeFromExport: true,
                        // IMPORTANT: Allow path to render outside viewport bounds
                        clipTo: undefined,
                        objectCaching: false, // Disable caching for real-time updates
                    });
                    canvas.value.add(currentPenPath.value);
                    safeRequestRenderAll();
                }
            } else {
                // CREATE new preview line (only once)
                const newPathString = `M ${firstPoint.x} ${firstPoint.y} L ${endX} ${endY}`;
                currentPenPath.value = new fabric.Path(newPathString, {
                    fill: 'transparent',
                    stroke: '#0d99ff',
                    strokeWidth: 2,
                    selectable: false,
                    evented: false,
                    excludeFromExport: true,
                    // IMPORTANT: Allow path to render outside viewport bounds
                    clipTo: undefined,
                    objectCaching: false, // Disable caching for real-time updates
                });
                canvas.value.add(currentPenPath.value);
                safeRequestRenderAll();
            }
        } else {
            // Remove preview line if no mouse position
            if (currentPenPath.value) {
                canvas.value.remove(currentPenPath.value);
                currentPenPath.value = null;
                safeRequestRenderAll();
            }
        }
        return;
    }
    
    // Create preview path for multiple points + live line to cursor
    let pathString = '';
    penPathPoints.value.forEach((point, index) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`;
        } else {
            const prevPoint = penPathPoints.value[index - 1];
            if (prevPoint && point.handles && point.handles.in) {
                const cp1x = prevPoint.handles?.out?.x ?? prevPoint.x;
                const cp1y = prevPoint.handles?.out?.y ?? prevPoint.y;
                const cp2x = point.handles.in.x;
                const cp2y = point.handles.in.y;
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
            } else {
                pathString += ` L ${point.x} ${point.y}`;
            }
        }
    });
    
    // Add live preview line from last point to cursor (Figma-style)
    if (currentMousePos.value) {
        const endX = typeof currentMousePos.value.x === 'number' ? currentMousePos.value.x : 0;
        const endY = typeof currentMousePos.value.y === 'number' ? currentMousePos.value.y : 0;
        pathString += ` L ${endX} ${endY}`;
    }
    
    // Update existing preview OR create new one
    if (currentPenPath.value) {
        try {
            currentPenPath.value.set('path', fabric.util.parsePath(pathString));
            currentPenPath.value.setCoords();
            safeRequestRenderAll();
        } catch (e) {
            canvas.value.remove(currentPenPath.value);
            currentPenPath.value = new fabric.Path(pathString, {
                fill: 'transparent',
                stroke: '#0d99ff',
                strokeWidth: 2,
                strokeDashArray: null,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                objectCaching: false,
            });
            canvas.value.add(currentPenPath.value);
            safeRequestRenderAll();
        }
    } else {
        currentPenPath.value = new fabric.Path(pathString, {
            fill: 'transparent',
            stroke: '#0d99ff',
            strokeWidth: 2,
            strokeDashArray: null,
            selectable: false,
            evented: false,
            excludeFromExport: true,
            objectCaching: false,
        });
        canvas.value.add(currentPenPath.value);
        safeRequestRenderAll();
    }
}

// Clear preview when exiting pen mode
watch(isPenMode, (newVal) => {
    if (!newVal && canvas.value) {
        currentMousePos.value = null;
        penPathPoints.value = [];
        
        // Remove preview path
        if (currentPenPath.value) {
            try {
                canvas.value.remove(currentPenPath.value);
            } catch (e) {
                // Ignore if already removed
            }
            currentPenPath.value = null;
        }
        
        // Remove preview point
        if (currentPenPoint.value) {
            try {
                canvas.value.remove(currentPenPoint.value);
            } catch (e) {
                // Ignore if already removed
            }
            currentPenPoint.value = null;
        }
        
        // AGGRESSIVE cleanup: Remove ALL temporary/preview/control objects
        const toRemove = canvas.value.getObjects().filter((o: any) => {
            // Remove if excludeFromExport
            if (o.excludeFromExport) return true;
            // Remove if it's a control object by name
            const name = o.name || '';
            if (name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') return true;
            // Remove if it has control data
            if (o.data && (o.data.parentPath || o.data.parentObj)) return true;
            // Remove small circles without _customId (control points)
            if (o.type === 'circle' && o.radius && o.radius <= 10 && !o._customId) return true;
            // Remove lines without _customId
            if (o.type === 'line' && !o._customId) return true;
            return false;
        });
        
        if (toRemove.length > 0) {
            console.log(`🧹 Limpando ${toRemove.length} objeto(s) de preview/controle ao sair do pen mode`);
            toRemove.forEach((obj: any) => {
                try {
                    canvas.value.remove(obj);
                } catch (e) {
                    // Ignore errors
                }
            });
        }
        
        // Force update canvasObjects to refresh LayersPanel
        canvasObjects.value = [...canvas.value.getObjects()];
        canvas.value.requestRenderAll();
    }
});

// Enter node editing mode for vector paths
const enterPathNodeEditing = (pathObj: any) => {
    if (!pathObj || !pathObj.isVectorPath) return;
    
    isNodeEditing.value = true;
    currentEditingPath.value = pathObj;
    selectedPathNodeIndex.value = null;
    canvas.value.discardActiveObject();
    
    // Restore pen path data if available
    const pathData = pathObj.penPathData || [];
    
    // Create control points for each node
    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    
    pathData.forEach((point: any, index: number) => {
        const canvasX = point.x * zoom + vpt[4];
        const canvasY = point.y * zoom + vpt[5];
        
        // Node point - make it clickable for selection
        const nodeControl = new fabric.Circle({
            left: canvasX,
            top: canvasY,
            radius: 5,
            fill: '#ffffff',
            stroke: '#0d99ff',
            strokeWidth: 2,
            hasControls: false,
            hasBorders: false,
            originX: 'center',
            originY: 'center',
            name: 'path_node',
            data: { index, parentPath: pathObj, type: 'node' },
            selectable: true,
            evented: true,
            excludeFromExport: true // CRITICAL: Don't show in LayersPanel
        });
        
        canvas.value.add(nodeControl);
        
        // Bezier handles if they exist
        if (point.handles) {
            // In handle
            if (point.handles.in) {
                const handleIn = new fabric.Circle({
                    left: point.handles.in.x * zoom + vpt[4],
                    top: point.handles.in.y * zoom + vpt[5],
                    radius: 3,
                    fill: '#ff6b6b',
                    stroke: '#ffffff',
                    strokeWidth: 1,
                    hasControls: false,
                    hasBorders: false,
                    originX: 'center',
                    originY: 'center',
                    name: 'bezier_handle',
                    data: { index, parentPath: pathObj, type: 'handle_in' },
                    excludeFromExport: true // CRITICAL: Don't show in LayersPanel
                });
                canvas.value.add(handleIn);
                
                // Line from node to handle
                const handleLine = new fabric.Line(
                    [canvasX, canvasY, point.handles.in.x * zoom + vpt[4], point.handles.in.y * zoom + vpt[5]],
                    {
                        stroke: '#666666',
                        strokeWidth: 1,
                        strokeDashArray: [3, 3],
                        selectable: false,
                        evented: false,
                        name: 'handle_line',
                        data: { index, parentPath: pathObj },
                        excludeFromExport: true
                    }
                );
                canvas.value.add(handleLine);
            }
            
            // Out handle
            if (point.handles.out) {
                const handleOut = new fabric.Circle({
                    left: point.handles.out.x * zoom + vpt[4],
                    top: point.handles.out.y * zoom + vpt[5],
                    radius: 3,
                    fill: '#4ecdc4',
                    stroke: '#ffffff',
                    strokeWidth: 1,
                    hasControls: false,
                    hasBorders: false,
                    originX: 'center',
                    originY: 'center',
                    name: 'bezier_handle',
                    data: { index, parentPath: pathObj, type: 'handle_out' },
                    excludeFromExport: true // CRITICAL: Don't show in LayersPanel
                });
                canvas.value.add(handleOut);
                
                // Line from node to handle
                const handleLine = new fabric.Line(
                    [canvasX, canvasY, point.handles.out.x * zoom + vpt[4], point.handles.out.y * zoom + vpt[5]],
                    {
                        stroke: '#666666',
                        strokeWidth: 1,
                        strokeDashArray: [3, 3],
                        selectable: false,
                        evented: false,
                        name: 'handle_line',
                        data: { index, parentPath: pathObj },
                        excludeFromExport: true
                    }
                );
                canvas.value.add(handleLine);
            }
        }
    });
    
    pathObj.selectable = false;
    pathObj.evented = false;
    canvas.value.requestRenderAll();
}

// Select a path node
const selectPathNode = (index: number, pathObj: any) => {
    selectedPathNodeIndex.value = index;
    
    // Update visual feedback for selected node
    const nodes = canvas.value.getObjects().filter((o: any) => 
        o.name === 'path_node' && o.data.parentPath === pathObj
    );
    
    nodes.forEach((node: any) => {
        if (node.data.index === index) {
            // Selected node - larger and different color
            node.set({
                radius: 7,
                fill: '#0d99ff',
                stroke: '#ffffff',
                strokeWidth: 3
            });
        } else {
            // Unselected nodes
            node.set({
                radius: 5,
                fill: '#ffffff',
                stroke: '#0d99ff',
                strokeWidth: 2
            });
        }
    });
    
    canvas.value.requestRenderAll();
}

// Clear path node selection
const clearPathNodeSelection = () => {
    selectedPathNodeIndex.value = null;
    if (currentEditingPath.value) {
        const nodes = canvas.value.getObjects().filter((o: any) => 
            o.name === 'path_node' && o.data.parentPath === currentEditingPath.value
        );
        nodes.forEach((node: any) => {
            node.set({
                radius: 5,
                fill: '#ffffff',
                stroke: '#0d99ff',
                strokeWidth: 2
            });
        });
        canvas.value.requestRenderAll();
    }
}

// Update handle lines visually during editing
const updateHandleLines = (pathObj: any) => {
    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    
    // Remove old handle lines
    const oldLines = canvas.value.getObjects().filter((o: any) => 
        o.name === 'handle_line' && o.data.parentPath === pathObj
    );
    oldLines.forEach((line: any) => canvas.value.remove(line));
    
    // Get current nodes and handles
    const nodes = canvas.value.getObjects()
        .filter((o: any) => o.name === 'path_node' && o.data.parentPath === pathObj)
        .sort((a: any, b: any) => a.data.index - b.data.index);
    
    const handles = canvas.value.getObjects()
        .filter((o: any) => o.name === 'bezier_handle' && o.data.parentPath === pathObj);
    
    // Recreate handle lines
    nodes.forEach((node: any) => {
        const handleIn = handles.find((h: any) => 
            h.data.index === node.data.index && h.data.type === 'handle_in'
        );
        const handleOut = handles.find((h: any) => 
            h.data.index === node.data.index && h.data.type === 'handle_out'
        );
        
        if (handleIn) {
            const line = new fabric.Line(
                [node.left, node.top, handleIn.left, handleIn.top],
                {
                    stroke: '#666666',
                    strokeWidth: 1,
                    strokeDashArray: [3, 3],
                    selectable: false,
                    evented: false,
                    name: 'handle_line',
                    data: { index: node.data.index, parentPath: pathObj },
                    excludeFromExport: true
                }
            );
            canvas.value.add(line);
        }
        
        if (handleOut) {
            const line = new fabric.Line(
                [node.left, node.top, handleOut.left, handleOut.top],
                {
                    stroke: '#666666',
                    strokeWidth: 1,
                    strokeDashArray: [3, 3],
                    selectable: false,
                    evented: false,
                    name: 'handle_line',
                    data: { index: node.data.index, parentPath: pathObj },
                    excludeFromExport: true
                }
            );
            canvas.value.add(line);
        }
    });
}

// Path operations
const closePath = () => {
    // If we're currently drawing a path (penPathPoints has points), close it
    if (penPathPoints.value.length >= 2) {
        // Create path string
        let pathString = '';
        penPathPoints.value.forEach((point, index) => {
            if (index === 0) {
                pathString += `M ${point.x} ${point.y}`;
            } else {
                const prevPoint = penPathPoints.value[index - 1];
                if (prevPoint && point.handles && point.handles.in) {
                    const cp1x = prevPoint.handles?.out?.x ?? prevPoint.x;
                    const cp1y = prevPoint.handles?.out?.y ?? prevPoint.y;
                    const cp2x = point.handles.in.x;
                    const cp2y = point.handles.in.y;
                    pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
                } else {
                    pathString += ` L ${point.x} ${point.y}`;
                }
            }
        });
        
        // Close path
        pathString += ' Z';
        
        // Remove preview
        if (currentPenPath.value) {
            if (Array.isArray(currentPenPath.value)) {
                currentPenPath.value.forEach((obj: any) => {
                    if (canvas.value) canvas.value.remove(obj);
                });
            } else {
                if (canvas.value) canvas.value.remove(currentPenPath.value);
            }
            currentPenPath.value = null;
        }
        
        // Create Fabric Path object
        const path = new fabric.Path(pathString, {
            fill: 'transparent',
            stroke: '#0d99ff',
            strokeWidth: 3,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            selectable: true,
            evented: true,
            _customId: Math.random().toString(36).substr(2, 9),
            name: 'Vector Path',
            isVectorPath: true,
            penPathData: JSON.parse(JSON.stringify(penPathPoints.value))
        });
        
        canvas.value.add(path);
        canvas.value.setActiveObject(path);
        selectedObjectRef.value = path;
        triggerRef(selectedObjectRef);
        
        // Reset - this stops creating new lines
        penPathPoints.value = [];
        currentPenPath.value = null;
        currentMousePos.value = null;
        canvas.value.requestRenderAll();
        saveCurrentState();
        updateSelection();
        return;
    }
    
    // Otherwise, close an existing selected path
    const active = canvas.value.getActiveObject();
    if (!active || !active.isVectorPath) return;
    
    const pathData = active.penPathData || [];
    if (pathData.length < 2) return;
    
    // Update path string to close
    let pathString = '';
    pathData.forEach((point: any, index: number) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`;
        } else {
            const prevPoint = pathData[index - 1];
            if (point.handles && point.handles.in) {
                const cp1x = prevPoint.handles?.out?.x || prevPoint.x;
                const cp1y = prevPoint.handles?.out?.y || prevPoint.y;
                const cp2x = point.handles.in.x;
                const cp2y = point.handles.in.y;
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
            } else {
                pathString += ` L ${point.x} ${point.y}`;
            }
        }
    });
    
    // Close path
    pathString += ' Z';
    
    // Update path
    active.set('path', fabric.util.parsePath(pathString));
    active.setCoords();
    canvas.value.requestRenderAll();
    saveCurrentState();
    updateSelection();
}

const simplifyPath = () => {
    const active = canvas.value.getActiveObject();
    if (!active || !active.isVectorPath) return;
    
    // Simplify path by reducing points (basic implementation)
    const pathData = active.penPathData || [];
    if (pathData.length <= 2) return;
    
    // Remove intermediate points that are too close
    const simplified: any[] = [pathData[0]];
    const threshold = 10; // pixels
    
    for (let i = 1; i < pathData.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = pathData[i];
        const next = pathData[i + 1];
        
        const dist1 = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
        const dist2 = Math.sqrt(Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2));
        
        if (dist1 > threshold || dist2 > threshold) {
            simplified.push(curr);
        }
    }
    
    simplified.push(pathData[pathData.length - 1]);
    
    // Rebuild path string from simplified points
    let pathString = '';
    simplified.forEach((point, index) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`;
        } else {
            const prevPoint = simplified[index - 1];
            if (point.handles && point.handles.in) {
                const cp1x = prevPoint.handles?.out?.x || prevPoint.x;
                const cp1y = prevPoint.handles?.out?.y || prevPoint.y;
                const cp2x = point.handles.in.x;
                const cp2y = point.handles.in.y;
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
            } else {
                pathString += ` L ${point.x} ${point.y}`;
            }
        }
    });
    
    // Update existing path instead of creating new one
    active.set('path', fabric.util.parsePath(pathString));
    active.penPathData = simplified;
    active.setCoords();
    canvas.value.requestRenderAll();
    saveCurrentState();
    updateSelection();
}

const splitPath = () => {
    // Split path at selected point
    const active = canvas.value.getActiveObject();
    if (!active || !active.isVectorPath) return;
    
    // For now, just show a message - full implementation requires selecting a specific point
    // This would require node editing mode to be active and a point selected
    if (!isNodeEditing.value) {
        // Enter node editing mode first
        enterPathNodeEditing(active);
    }
    // TODO: Implement full split logic when a node is selected
    console.log('Split path - select a node in editing mode to split');
}

// --- Node Editing Logic ---
const enterNodeEditing = (obj: any) => {
    if (!obj || (obj.type !== 'polygon' && obj.type !== 'polyline')) return;
    
    isNodeEditing.value = true;
    canvas.value.discardActiveObject(); // Deselect main object to focus on points
    
    const matrix = obj.calcTransformMatrix();
    const points = obj.points;
    
    points.forEach((point: any, index: number) => {
        // Transform point coordinates to canvas coordinates
        const p = fabric.util.transformPoint({ x: point.x - obj.pathOffset.x, y: point.y - obj.pathOffset.y }, matrix);
        
        const control = new fabric.Circle({
            left: p.x,
            top: p.y,
            radius: 4,
            fill: '#ffffff',
            stroke: '#0d99ff',
            strokeWidth: 1,
            hasControls: false,
            hasBorders: false,
            originX: 'center',
            originY: 'center',
            name: 'control_point',
            data: { index: index, parentObj: obj }, // Link to parent
            excludeFromExport: true // CRITICAL: Don't show in LayersPanel
        });
        
        canvas.value.add(control);
    });
    
    obj.selectable = false; // Lock parent while editing
    obj.evented = false;
    canvas.value.requestRenderAll();
}



const createPriceLayout = (product: any, width: number, top: number) => {
    // Basic Stub for Price Layout - usa preço principal dinâmico
    const group = new fabric.Group([], { left: 0, top: top });
    const availablePrices = getAvailablePrices(product);
    const priceText = new fabric.Text(availablePrices.mainPrice || '0,00', { fontSize: 40, fill: 'red' });
    safeAddWithUpdate(group, priceText);
    return group;
}

const exitNodeEditing = () => {
    if (!canvas.value) return;
    
    isNodeEditing.value = false;
    selectedPathNodeIndex.value = null;
    currentEditingPath.value = null;
    
    // Remove ALL control points, handles, and orphaned objects
    const toRemove = canvas.value.getObjects().filter((o: any) => {
        const name = o.name || '';
        
        // Control objects by name
        if (name === 'control_point' || name === 'path_node' || name === 'bezier_handle' || name === 'handle_line') {
            return true;
        }
        
        // Objects marked as excludeFromExport
        if (o.excludeFromExport) {
            return true;
        }
        
        // Small circles without _customId (likely orphaned control points)
        if (o.type === 'circle' && o.radius && o.radius <= 10 && !o._customId) {
            return true;
        }
        
        // Lines without _customId (handle lines)
        if (o.type === 'line' && !o._customId) {
            return true;
        }
        
        // Circles with data.parentPath or data.parentObj (control circles)
        if (o.type === 'circle' && o.data && (o.data.parentPath || o.data.parentObj)) {
            return true;
        }
        
        return false;
    });
    
    toRemove.forEach((ctrl: any) => {
        try {
            canvas.value.remove(ctrl);
        } catch (e) {
            // Ignore errors if object was already removed
        }
    });
    
    // Re-enable parent objects
    canvas.value.getObjects().forEach((obj: any) => {
        if (obj.selectable === false && (obj.type === 'polygon' || obj.type === 'polyline' || obj.isVectorPath)) {
            obj.selectable = true;
            obj.evented = true;
        }
    });
    
    // Force update canvasObjects to refresh LayersPanel
    canvasObjects.value = [...canvas.value.getObjects()];
    canvas.value.requestRenderAll();
}

// Update polygon when control point moves
const handleInteraction = () => {
    // Reduced work during interaction to avoid lag
    // Scrollbars and Properties panel will update on 'mouse:up' or 'object:modified'
};

const safeAddWithUpdate = (group: any, object?: any) => {
    if (!group) return;
    
    // CRITICAL: Validate object is a proper Fabric object before adding
    if (object) {
        const isValid = object && typeof object === 'object' && typeof object.setCoords === 'function';
        if (!isValid) {
            console.error('❌ [safeAddWithUpdate] Tentativa de adicionar objeto inválido ao grupo!', {
                objectType: typeof object,
                objectValue: object,
                hasSetCoords: typeof object?.setCoords === 'function',
                groupId: group._customId || group.id
            });
            return; // BLOCK invalid objects
        }
    }
    
    if (typeof group.addWithUpdate === 'function') {
        if (object) group.addWithUpdate(object);
        else group.addWithUpdate();
        return;
    }
    if (object && typeof group.add === 'function') {
        group.add(object);
    }
    // Fabric v7+: groups use LayoutManager; `triggerLayout()` replaces `addWithUpdate/_calcBounds`.
    if (typeof group.triggerLayout === 'function') {
        group.triggerLayout();
    } else {
        if (typeof group._calcBounds === 'function') group._calcBounds();
        if (typeof group._updateObjectsCoords === 'function') group._updateObjectsCoords();
    }
    if (typeof group.setCoords === 'function') group.setCoords();
    group.dirty = true;
};

const groupLocalToCanvasPoint = (group: any, x: number, y: number): { x: number; y: number } => {
    try {
        if (!group || !fabric) return { x, y };
        const hasMatrix = typeof group.calcTransformMatrix === 'function';
        if (!hasMatrix || !fabric?.util?.transformPoint || !fabric?.Point) return { x, y };
        const m = group.calcTransformMatrix();
        const p = new fabric.Point(Number(x) || 0, Number(y) || 0);
        const out = fabric.util.transformPoint(p, m);
        return { x: Number(out?.x) || 0, y: Number(out?.y) || 0 };
    } catch {
        return { x, y };
    }
};

// === GLOBAL HELPER: Find parent group for an object (used by delete and other operations) ===
const findParentGroupForObjectGlobal = (obj: any): any => {
    if (!obj || !canvas.value) return null;
    
    // First check if object has direct group reference
    if (obj.group) return obj.group;
    
    const allObjects = canvas.value.getObjects();
    
    // Search function that finds the IMMEDIATE parent group containing the object
    const searchInGroup = (group: any, depth: number = 0): { group: any, depth: number } | null => {
        if (!group || typeof group.getObjects !== 'function') return null;
        
        const children = group.getObjects() || [];
        
        for (const child of children) {
            // Direct match
            if (child === obj || (obj._customId && child._customId === obj._customId)) {
                return { group, depth };
            }
            
            // If child is also a group, search deeper
            if (child.type === 'group' || child.type === 'Group') {
                const deeper = searchInGroup(child, depth + 1);
                if (deeper) {
                    return deeper; // Return the deepest match (immediate parent)
                }
            }
        }
        
        return null;
    };
    
    // Look for groups that are in ACTIVE edit mode first
    for (const canvasObj of allObjects) {
        if (canvasObj.type === 'group' || canvasObj.type === 'Group') {
            const isInteractive = canvasObj.interactive === true || canvasObj.subTargetCheck === true;
            
            if (isInteractive) {
                const result = searchInGroup(canvasObj, 0);
                if (result) return result.group;
            }
        }
    }
    
    // Fallback: search all groups
    for (const canvasObj of allObjects) {
        if (canvasObj.type === 'group' || canvasObj.type === 'Group') {
            const result = searchInGroup(canvasObj, 0);
            if (result) return result.group;
        }
    }
    
    return null;
};

// === ALT/OPTION + DRAG DUPLICATE (Figma/Canva-like) ===
// When user Alt-drags an object, we keep the original in place and drag a clone.
const setupAltDragDuplicate = () => {
    if (!canvas.value || !fabric) return;

    const isValidFabricObject = (o: any) => {
        if (!o || typeof o !== 'object') return false;
        return typeof o.set === 'function' && typeof o.render === 'function' && typeof o.setCoords === 'function';
    };

    const assignNewIdsDeep = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (typeof obj.set !== 'function') return;
        obj._customId = Math.random().toString(36).substr(2, 9);
        if (typeof obj.getObjects === 'function') {
            (obj.getObjects() || []).forEach((c: any) => {
                if (c && typeof c.set === 'function') {
                    c._customId = Math.random().toString(36).substr(2, 9);
                }
            });
        }
    };

    const state = {
        armed: false,
        cloning: false,
        didDuplicate: false,
        original: null as any,
        clone: null as any,
        parentGroup: null as any,
        cloneInGroup: false,
        startLeft: 0,
        startTop: 0,
        origLockX: false,
        origLockY: false,
    };

    const isEligibleTarget = (obj: any) => {
        if (!obj) return false;
        if (obj.excludeFromExport) return false;
        if (isPenMode.value || isNodeEditing.value || isDrawing.value) return false;
        if (isLikelyProductZone(obj)) return false;
        if (String(obj.type || '').toLowerCase() === 'activeselection') return false;
        return true;
    };

    canvas.value.on('mouse:down', (opt: any) => {
        const evt: MouseEvent | undefined = opt?.e;
        if (!evt || evt.button !== 0 || !evt.altKey) {
            state.armed = false;
            return;
        }
        let active = canvas.value?.getActiveObject?.();
        if (!isEligibleTarget(active)) return;

        // FIGMA BEHAVIOR: When user deep-selects a child inside a product card
        // (e.g., product image, title text), ALT+drag should duplicate JUST that child,
        // NOT the entire card group. The child will be cloned inside the same parent group.
        // If the user wants to duplicate the whole card, they select the card group itself.

        state.armed = true;
        state.cloning = false;
        state.didDuplicate = false;
        state.original = active;
        state.startLeft = Number(active.left || 0);
        state.startTop = Number(active.top || 0);
    });

    canvas.value.on('mouse:move:before', (opt: any) => {
        if (!state.armed || state.cloning || state.didDuplicate) return;
        if (!canvas.value) return;

        const tr: any = (canvas.value as any)._currentTransform;
        // For interactive groups (product cards with subTargetCheck=true), the _currentTransform
        // targets the child (deep-selected element), not necessarily state.original.
        // Accept the transform if the target IS the original or IS a child of the original's group.
        const isChildInGroup = state.original && state.original.group && tr?.target === state.original;
        const isDirectMatch = tr && tr.target === state.original;
        const isGroupChildMatch = state.original && state.original.type === 'group' && tr?.target?.group === state.original;
        
        if (!isDirectMatch && !isChildInGroup && !isGroupChildMatch) {
            // No valid transform found. For objects inside interactive groups, the transform
            // may target the child. Allow if we have any active transform at all and user is 
            // in a group context.
            const inInteractiveGroup = state.original && state.original.group && 
                (state.original.group.interactive || state.original.group.subTargetCheck);
            if (!inInteractiveGroup || !tr) return;
        }

        // Start cloning (runs once)
        state.cloning = true;
        const original = state.original;
        const origLeft = state.startLeft;
        const origTop = state.startTop;

        // Clone via Fabric's native clone
        const doClone = async () => {
            let cloned: any = null;
            try {
                if (typeof original.clone === 'function') {
                    const result = original.clone(['_customId', 'isFrame', 'layerName', 'clipContent', 'parentFrameId', 'parentZoneId', 'isSmartObject', 'isProductCard', 'name', 'smartGridId', 'unitLabel', 'price', 'pricePack', 'priceUnit', 'priceSpecial', 'priceSpecialUnit', 'specialCondition', 'priceWholesale', 'wholesaleTrigger', 'wholesaleTriggerUnit', 'packQuantity', 'packUnit', 'packageLabel', 'unit', 'limit', '_productData', '_cardWidth', '_cardHeight', 'subTargetCheck', 'interactive']);
                    if (result && typeof result.then === 'function') {
                        cloned = await result;
                    }
                }
            } catch { /* ignore */ }

            // Fallback: serialize + enliven
            if (!isValidFabricObject(cloned)) {
                try {
                    const json = typeof original.toObject === 'function' ? original.toObject(['_customId', 'isSmartObject', 'isProductCard', 'name', 'parentZoneId', 'smartGridId', 'unitLabel']) : null;
                    if (json && fabric?.util?.enlivenObjects) {
                        const objs = await fabric.util.enlivenObjects([json]);
                        cloned = Array.isArray(objs) && objs.length > 0 ? objs[0] : null;
                    }
                } catch { /* ignore */ }
            }

            if (!isValidFabricObject(cloned) || !canvas.value) {
                state.cloning = false;
                return;
            }

            assignNewIdsDeep(cloned);

            // Copy metadata — only for top-level objects or card groups.
            // When cloning a CHILD element inside a card (e.g., a product image),
            // do NOT copy card-level meta to the child clone.
            const isCloneACard = cloned.type === 'group' && (cloned.isSmartObject || cloned.isProductCard || isLikelyProductCard(cloned));
            if (isCloneACard) {
                for (const k of ['parentFrameId', 'parentZoneId', 'isSmartObject', 'isProductCard', 'unitLabel', 'smartGridId', '_cardWidth', '_cardHeight']) {
                    if ((original as any)[k] != null) (cloned as any)[k] = (original as any)[k];
                }
            } else if (!original.group || !(original.group.isSmartObject || original.group.isProductCard || isLikelyProductCard(original.group))) {
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

            // If duplicating an object INSIDE a group (deep-select), create the clone in the SAME group
            // so it is born in the exact same local position as the original.
            if (isInsideGroup && parentGroup && typeof parentGroup.add === 'function') {
                try {
                    const origOX = original.originX || 'center';
                    const origOY = original.originY || 'center';

                    cloned.set({
                        left: Number(original.left || 0),
                        top: Number(original.top || 0),
                        originX: origOX,
                        originY: origOY,
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true,
                        objectCaching: false,
                        dirty: true,
                    });
                    cloned.setCoords?.();

                    // Keep the group interactive so the clone can be dragged/selected.
                    parentGroup.set({ subTargetCheck: true, interactive: true });

                    // Insert right after the original when possible (keeps z-order intuitive).
                    try {
                        const list = typeof parentGroup.getObjects === 'function' ? parentGroup.getObjects() : [];
                        const idx = Array.isArray(list) ? list.indexOf(original) : -1;
                        if (typeof (parentGroup as any).insertAt === 'function' && idx >= 0) {
                            (parentGroup as any).insertAt(cloned, idx + 1);
                        } else {
                            parentGroup.add(cloned);
                        }
                    } catch {
                        parentGroup.add(cloned);
                    }

                    parentGroup.set('dirty', true);
                    parentGroup.setCoords?.();
                    safeAddWithUpdate(parentGroup);

                    // FIGMA/CANVA BEHAVIOR: original stays in place, CLONE follows mouse.
                    // Swap Fabric's internal transform target from original → clone.
                    const tr: any = (canvas.value as any)._currentTransform;
                    if (tr && tr.target === original) {
                        tr.target = cloned;
                        if (tr.original && typeof tr.original === 'object') {
                            tr.original.left = cloned.left;
                            tr.original.top = cloned.top;
                        }
                    }

                    // Lock original so it doesn't move during the rest of the drag
                    state.origLockX = !!original.lockMovementX;
                    state.origLockY = !!original.lockMovementY;
                    original.set({ lockMovementX: true, lockMovementY: true });
                    original.set({ left: origLeft, top: origTop }); // ensure it stays at start position
                    original.setCoords?.();

                    canvas.value.setActiveObject(cloned);
                    state.clone = cloned;
                    state.didDuplicate = true;
                    state.cloneInGroup = true;
                    state.cloning = false;
                    canvas.value.requestRenderAll();
                    return;
                } catch (e) {
                    console.warn('[alt-drag-duplicate] Falha ao duplicar dentro do grupo, usando fallback canvas-level', e);
                    // Fall through to the old behavior (canvas-level, then move into group on mouse:up)
                }
            }

            // Clone starts at the SAME canvas-level position as the original.
            // Use calcTransformMatrix() which gives the absolute position
            // including all parent group transforms. m[4],m[5] = center point.
            let canvasLeft = origLeft;
            let canvasTop = origTop;
            let useCenter = false;
            try {
                if (typeof original.calcTransformMatrix === 'function') {
                    const m = original.calcTransformMatrix();
                    canvasLeft = m[4];
                    canvasTop = m[5];
                    useCenter = true;
                }
            } catch { /* keep origLeft/origTop */ }

            cloned.set({
                left: canvasLeft,
                top: canvasTop,
                originX: useCenter ? 'center' : (original.originX || 'left'),
                originY: useCenter ? 'center' : (original.originY || 'top'),
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                objectCaching: false,
                dirty: true,
            });
            cloned.setCoords?.();

            // Always add clone at canvas level for free dragging (will be moved into group on mouse:up)
            canvas.value.add(cloned);

            // Z-order: place clone right above the group (or original)
            const canvasObjs = canvas.value.getObjects();
            if (isInsideGroup) {
                const groupIdx = canvasObjs.indexOf(parentGroup);
                if (groupIdx >= 0 && typeof (canvas.value as any).moveTo === 'function') {
                    (canvas.value as any).moveTo(cloned, groupIdx + 1);
                }
            } else {
                const origIdx = canvasObjs.indexOf(original);
                if (origIdx >= 0 && typeof (canvas.value as any).moveTo === 'function') {
                    (canvas.value as any).moveTo(cloned, origIdx + 1);
                }
            }

            // FIGMA/CANVA BEHAVIOR: original stays in place, CLONE follows mouse.
            // Swap Fabric's internal transform target from original → clone.
            const tr: any = (canvas.value as any)._currentTransform;
            const isCardClone = !!(original.isSmartObject || original.isProductCard);
            if (tr) {
                // For product card groups: tr.target is the child inside the group (not the group itself).
                // Swap the transform target to the cloned group so it follows the mouse.
                if (isCardClone && tr.target !== original && tr.target?.group === original) {
                    tr.target = cloned;
                    if (tr.original && typeof tr.original === 'object') {
                        tr.original.left = cloned.left;
                        tr.original.top = cloned.top;
                    }
                } else if (tr.target === original) {
                    tr.target = cloned;
                    if (tr.original && typeof tr.original === 'object') {
                        tr.original.left = cloned.left;
                        tr.original.top = cloned.top;
                    }
                }
            }

            // Lock original so it doesn't move during the rest of the drag
            state.origLockX = !!original.lockMovementX;
            state.origLockY = !!original.lockMovementY;
            original.set({ lockMovementX: true, lockMovementY: true });
            original.set({ left: origLeft, top: origTop }); // ensure it stays at start position
            original.setCoords?.();

            // Select the clone (it follows the mouse)
            canvas.value.setActiveObject(cloned);
            
            state.clone = cloned;
            state.didDuplicate = true;
            state.cloning = false;

            canvas.value.requestRenderAll();
        };

        doClone();
    });

    canvas.value.on('mouse:up', () => {
        if (!state.didDuplicate || !canvas.value) {
            state.armed = false;
            state.cloning = false;
            state.didDuplicate = false;
            state.original = null;
            state.clone = null;
            return;
        }

        const original = state.original;
        const clone = state.clone;
        const pg = state.parentGroup;

        // Unlock original (restore previous lock state)
        if (original) {
            original.set({
                lockMovementX: !!state.origLockX,
                lockMovementY: !!state.origLockY,
            });
            original.setCoords?.();
        }

        // If the original was inside a group and the clone was created at canvas-level, move it INTO that group.
        if (clone && pg && typeof pg.add === 'function' && !state.cloneInGroup) {
            const cloneIsOnCanvas = canvas.value.getObjects().includes(clone);
            if (!cloneIsOnCanvas) {
                // Nothing to reparent (already inside group or not tracked by canvas list)
                pg.set('dirty', true);
                pg.setCoords?.();
                safeAddWithUpdate(pg);
            } else {
            // Get clone's center in canvas coords (works regardless of originX/Y)
            let cx = clone.left;
            let cy = clone.top;
            try {
                const cm = clone.calcTransformMatrix();
                cx = cm[4];
                cy = cm[5];
            } catch { /* fallback to left/top */ }

            // Convert canvas-level center to group-local center
            let localLeft = cx;
            let localTop = cy;
            try {
                if (typeof pg.calcTransformMatrix === 'function') {
                    const inv = fabric.util.invertTransform(pg.calcTransformMatrix());
                    const pt = fabric.util.transformPoint({ x: cx, y: cy }, inv);
                    localLeft = pt.x;
                    localTop = pt.y;
                }
            } catch { /* keep canvas coords as fallback */ }

            // Remove from canvas, add to group with local coords and matching origin
            canvas.value.remove(clone);
            clone.set({
                left: localLeft,
                top: localTop,
                originX: original?.originX || 'center',
                originY: original?.originY || 'center',
            });
            pg.add(clone);
            clone.setCoords?.();
            pg.set('dirty', true);
            if (typeof pg.setCoords === 'function') pg.setCoords();
            safeAddWithUpdate(pg);
            }
        }

        // Select the clone (the one the user just placed)
        if (clone) {
            clone.setCoords?.();
            // For objects inside a group, need interactive mode to select child
            if (pg) {
                pg.set({ subTargetCheck: true, interactive: true });
                canvas.value.setActiveObject(clone);
            } else {
                canvas.value.setActiveObject(clone);
            }
        }

        canvas.value.requestRenderAll();

        // Update objects list
        canvasObjects.value = [...canvas.value.getObjects()];

        // Reset state
        state.armed = false;
        state.cloning = false;
        state.didDuplicate = false;
        state.original = null;
        state.clone = null;
        state.parentGroup = null;
        state.cloneInGroup = false;

        saveCurrentState();
        triggerAutoSave();
    });
};

type ArrangeMode = 'bring-to-front' | 'bring-forward' | 'send-backward' | 'send-to-back';

const computeArrangedOrder = (list: any[], selected: Set<any>, mode: ArrangeMode) => {
    const arr = list.slice();
    if (arr.length < 2) return arr;

    if (mode === 'bring-to-front') {
        const nonSel = arr.filter(o => !selected.has(o));
        const sel = arr.filter(o => selected.has(o));
        return [...nonSel, ...sel];
    }
    if (mode === 'send-to-back') {
        const nonSel = arr.filter(o => !selected.has(o));
        const sel = arr.filter(o => selected.has(o));
        return [...sel, ...nonSel];
    }
    if (mode === 'bring-forward') {
        const out = arr.slice();
        for (let i = out.length - 2; i >= 0; i--) {
            if (selected.has(out[i]) && !selected.has(out[i + 1])) {
                const tmp = out[i];
                out[i] = out[i + 1];
                out[i + 1] = tmp;
            }
        }
        return out;
    }
    // send-backward
    const out = arr.slice();
    for (let i = 1; i < out.length; i++) {
        if (selected.has(out[i]) && !selected.has(out[i - 1])) {
            const tmp = out[i];
            out[i] = out[i - 1];
            out[i - 1] = tmp;
        }
    }
    return out;
};

const applyArrangedOrder = (container: any, newOrder: any[]) => {
    if (!container || !Array.isArray(newOrder)) return;
    
    // CRITICAL: Filter out invalid objects before applying order
    const validObjects = newOrder.filter((o: any) => {
        const isValid = o && typeof o === 'object' && typeof o.setCoords === 'function';
        if (!isValid) {
            console.error('❌ [applyArrangedOrder] Objeto inválido detectado e removido!', {
                objectType: typeof o,
                objectValue: o,
                containerId: container._customId || container.id
            });
        }
        return isValid;
    });
    
    if (validObjects.length !== newOrder.length) {
        console.warn(`⚠️ [applyArrangedOrder] Removidos ${newOrder.length - validObjects.length} objetos inválidos`);
    }
    
    // Fabric keeps render order in the internal `_objects` array for both Canvas and Group.
    const internal = (container as any)._objects;
    if (Array.isArray(internal)) {
        internal.length = 0;
        validObjects.forEach(o => internal.push(o));
        if (typeof container._onStackOrderChanged === 'function') container._onStackOrderChanged();
    } else if (typeof container.getObjects === 'function' && typeof container.remove === 'function' && typeof container.add === 'function') {
        // Fallback: rebuild by remove/add (can be slower, but safe).
        const cur = container.getObjects().slice();
        cur.forEach((o: any) => container.remove(o));
        validObjects.forEach((o: any) => container.add(o));
    }

    if (container === canvas.value) {
        canvas.value.requestRenderAll();
    } else {
        safeAddWithUpdate(container);
        canvas.value?.requestRenderAll?.();
    }
};

function arrangeActiveObjects(mode: ArrangeMode) {
    if (!canvas.value) return;
    const selected = (canvas.value.getActiveObjects?.() || []).filter((o: any) => !!o);
    if (selected.length === 0) return;

    // Group selection by parent container (canvas or group) to preserve Figma-like behavior.
    const byContainer = new Map<any, any[]>();
    selected.forEach((o: any) => {
        const grp = o.group;
        const container = grp && grp.type === 'group' ? grp : canvas.value;
        const list = byContainer.get(container) || [];
        list.push(o);
        byContainer.set(container, list);
    });

    byContainer.forEach((objs: any[], container: any) => {
        const all = typeof container.getObjects === 'function' ? container.getObjects() : [];

        // Keep non-export/system overlays (guides, etc.) pinned on top.
        const pinnedTop = container === canvas.value ? all.filter((o: any) => !!o?.excludeFromExport) : [];
        const list = container === canvas.value ? all.filter((o: any) => !o?.excludeFromExport) : all;

        const set = new Set(objs.filter((o: any) => !o?.excludeFromExport));
        const next = computeArrangedOrder(list, set, mode);
        applyArrangedOrder(container, container === canvas.value ? [...next, ...pinnedTop] : next);
    });

    // Keep selection intact after reordering.
    try {
        canvas.value.discardActiveObject();
        if (selected.length === 1) {
            canvas.value.setActiveObject(selected[0]);
        } else if (fabric?.ActiveSelection) {
            const sel = new fabric.ActiveSelection(selected, { canvas: canvas.value });
            canvas.value.setActiveObject(sel);
        }
    } catch (_) {}

    canvas.value.requestRenderAll();
    canvasObjects.value = [...canvas.value.getObjects()];
    saveCurrentState();
}

const updateNodePosition = (e: any) => {
    const target = e.target;
    if (target.name === 'control_point') {
        const parent = target.data.parentObj;
        const index = target.data.index;
        
        // We need to inverse transform the point back to object local space
        // This is complex math, simplifying by assuming object hasn't rotated significantly during edit
        // Or better: Re-calculate all points based on current canvas positions of controls?
        
        // Strategy: Get all controls, map to new points array, update object.
        const controls = canvas.value.getObjects().filter((o: any) => o.name === 'control_point' && o.data.parentObj === parent);
        controls.sort((a: any, b: any) => a.data.index - b.data.index); // Ensure order
        
        // This is a simplified approach. Ideally we use fabric.util.invertTransform
        // But for a "Lite" version, let's try to update just visual for now or full rebuild?
        
        // Limitations: Updating 'points' directly on Polygon doesn't always re-render correctly in Fabric without reset.
        // Let's defer full implementation to complex math block if needed.
        // For now, let's just allow moving the dots to show "Proof of Concept".
    }
}

// ... (existing code)
import { parseProductList } from '~/lib/utils'
import { calculateGridLayout } from '~/utils/product-zone-helpers'
import type { ProductZone, GlobalStyles } from '~/types/product-zone'
import { useProject } from '~/composables/useProject'
import { useUpload } from '~/composables/useUpload'
import { useAuth } from '~/composables/useAuth'
import { useSupabase } from '~/composables/useSupabase'

import { GOOGLE_WEBFONT_FAMILIES } from '~/utils/font-catalog'

// Import fabric type for TS (optional if we had types, using any for now to be fast)
// import { fabric } from 'fabric'

const { project, activePage, initProject, updatePageData, updatePageThumbnail, deletePage, resizePage, saveProjectDB, triggerAutoSave, isProjectLoaded, hasUnsavedChanges } = useProject()
const auth = useAuth()
const supabase = useSupabase()

// Users state
const currentUser = computed(() => auth.user.value)
const collaborators = ref<any[]>([])

// Generate color from string (consistent color for same name/email)
const getColorFromString = (str: string): string => {
  const colors: string[] = [
    'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-pink-500',
    'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500',
    'bg-orange-500', 'bg-cyan-500'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (!isNaN(code)) {
      hash = code + ((hash << 5) - hash)
    }
  }
  return colors[Math.abs(hash) % colors.length] ?? 'bg-gray-500'
}

// Get initial from name
const getInitial = (name: string | null | undefined): string => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  const firstPart = parts[0]
  const lastPart = parts[parts.length - 1]
  if (parts.length >= 2 && firstPart && lastPart) {
    const first = firstPart[0]
    const last = lastPart[0]
    if (first && last) {
      return (first + last).toUpperCase()
    }
  }
  return name[0]?.toUpperCase() ?? '?'
}

// Load collaborators (users who have access to this project)
const loadCollaborators = async () => {
  try {
    const usersToShow: any[] = []
    
    // Always include current user
    if (currentUser.value) {
      usersToShow.push(currentUser.value)
    }
    
    // Load other users from profiles table (for now, limit to 2 more)
    // In the future, you can add a project_collaborators table for real collaboration
    try {
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .limit(3)

      if (allUsers && allUsers.length > 0) {
        // Filter out current user and add others
        const otherUsers = allUsers.filter((u: any) => u.id !== currentUser.value?.id)
        usersToShow.push(...otherUsers.slice(0, 2))
      }
    } catch (err) {
      console.warn('Could not load other users:', err)
    }
    
    collaborators.value = usersToShow.slice(0, 3) // Max 3 avatares
  } catch (error) {
    console.error('Error loading collaborators:', error)
    // Fallback to just current user
    if (currentUser.value) {
      collaborators.value = [currentUser.value]
    }
  }
}

// Watch for project changes to reload collaborators
watch(() => project.id, () => {
  if (project.id) {
    loadCollaborators()
  }
})

// Watch for current user to load collaborators
watch(() => currentUser.value, () => {
  if (currentUser.value) {
    loadCollaborators()
  }
}, { immediate: true })

const canvas = shallowRef<any>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const wrapperEl = ref<HTMLDivElement | null>(null)
const isProcessing = ref(false)
const currentZoom = ref(100) // Zoom state

const pageSettings = ref({
    backgroundColor: '#1e1e1e' // Match default dark workspace
})

// === Frame Label Overlays (clickable HTML labels for all frames) ===
const frameLabels = ref<Array<{ id: string; name: string; x: number; y: number; dimX: number; dimY: number; dims: string; isSelected: boolean; frameRef: any }>>([]);

let frameLabelUpdatePending = false;
const throttledUpdateFrameLabels = () => {
    if (frameLabelUpdatePending) return;
    frameLabelUpdatePending = true;
    requestAnimationFrame(() => {
        updateFrameLabels();
        frameLabelUpdatePending = false;
    });
};

const updateFrameLabels = () => {
    if (!canvas.value || !wrapperEl.value || isCanvasDestroyed.value) {
        frameLabels.value = [];
        return;
    }
    const frames = getAllFrames();
    if (!frames.length) {
        frameLabels.value = [];
        return;
    }
    const vpt = canvas.value.viewportTransform;
    if (!vpt) { frameLabels.value = []; return; }
    const activeObj = canvas.value.getActiveObject();
    const fmt = (n: number) => {
        if (!Number.isFinite(n)) return '0';
        const rounded = Math.round(n);
        if (Math.abs(n - rounded) < 0.01) return String(rounded);
        return n.toFixed(2);
    };
    const labels: typeof frameLabels.value = [];
    for (const frame of frames) {
        try {
            const bounds = typeof frame.getBoundingRect === 'function'
                ? frame.getBoundingRect(true, true)
                : frame.getBoundingRect();
            const p_tl = fabric.util.transformPoint({ x: bounds.left, y: bounds.top }, vpt);
            // Dimensões reais do frame
            const w = frame.width * (frame.scaleX || 1);
            const h = frame.height * (frame.scaleY || 1);
            // Posição do badge de dimensões (center-bottom do frame)
            const center = frame.getCenterPoint();
            const p_bc_raw = { x: center.x, y: center.y + (h / 2) };
            const p_bc = fabric.util.transformPoint(p_bc_raw, vpt);
            labels.push({
                id: frame._customId || '',
                name: (frame.layerName || frame.name || 'Frame').toString(),
                x: Math.max(4, p_tl.x),
                y: Math.max(4, p_tl.y - 22),
                dimX: p_bc.x,
                dimY: p_bc.y + 8,
                dims: `${fmt(w)} × ${fmt(h)}`,
                isSelected: activeObj === frame,
                frameRef: frame,
            });
        } catch { /* skip invalid frame */ }
    }
    frameLabels.value = labels;
};

const handleFrameLabelClick = (label: typeof frameLabels.value[0], e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvas.value || !label.frameRef) return;
    canvas.value.setActiveObject(label.frameRef);
    canvas.value.requestRenderAll();
    updateSelection();
    canvasObjects.value = [...canvas.value.getObjects()];
};

const handleFrameLabelMouseDown = (label: typeof frameLabels.value[0], e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvas.value || !label.frameRef) return;
    const frame = label.frameRef;

    // Select frame first
    canvas.value.setActiveObject(frame);
    canvas.value.requestRenderAll();
    updateSelection();

    // Start drag tracking
    const startX = e.clientX;
    const startY = e.clientY;
    const zoom = canvas.value.getZoom() || 1;
    const startLeft = frame.left;
    const startTop = frame.top;
    let moved = false;

    // Get descendants once
    const descendants = getFrameDescendants(frame);

    let frameLabelDragRaf = 0;
    const onMouseMove = (moveEvt: MouseEvent) => {
        const dx = (moveEvt.clientX - startX) / zoom;
        const dy = (moveEvt.clientY - startY) / zoom;
        if (!moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
        moved = true;
        
        if (frameLabelDragRaf) cancelAnimationFrame(frameLabelDragRaf);
        frameLabelDragRaf = requestAnimationFrame(() => {
            frame.set({ left: startLeft + dx, top: startTop + dy });
            frame.setCoords();
            // Reset to absolute positions for descendants
            descendants.forEach((d: any) => {
                if ((d as any).__dragStart) {
                    d.set({ left: (d as any).__dragStart.left + dx, top: (d as any).__dragStart.top + dy });
                    d.setCoords();
                }
            });
            canvas.value.requestRenderAll();
            throttledUpdateFrameLabels();
        });
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        descendants.forEach((d: any) => { delete (d as any).__dragStart; });
        if (moved) {
            // Sync clips after move
            if (frame.clipContent) {
                syncFrameClips(frame);
            }
            canvas.value.requestRenderAll();
            canvasObjects.value = [...canvas.value.getObjects()];
            saveCurrentState();
        }
    };

    // Store initial positions
    descendants.forEach((d: any) => { (d as any).__dragStart = { left: d.left, top: d.top }; });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// Virtual Scrollbars State
const scrollV = ref({ top: 0, height: 0, visible: false })
const scrollH = ref({ left: 0, width: 0, visible: false })

// Throttle for scrollbar updates
let scrollbarUpdatePending = false
const throttledUpdateScrollbars = () => {
    if (scrollbarUpdatePending) return
    scrollbarUpdatePending = true
    requestAnimationFrame(() => {
        updateScrollbars()
        scrollbarUpdatePending = false
    })
}

const updateScrollbars = () => {
    if (!canvas.value || !wrapperEl.value) return;

    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    const width = canvas.value.getWidth();
    const height = canvas.value.getHeight();

    // Calculate logical boundaries (all objects - infinite canvas)
    const objects = canvas.value.getObjects();
    // Start with very large bounds to allow infinite canvas
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // If no objects, use page dimensions as base
    if (objects.length === 0 || objects.filter((o: any) => !o.excludeFromExport && o.id !== 'artboard-bg' && o.id !== 'guide-vertical' && o.id !== 'guide-horizontal').length === 0) {
        minX = 0;
        minY = 0;
        maxX = activePage.value?.width || 1080;
        maxY = activePage.value?.height || 1920;
    } else {
        objects.forEach((obj: any) => {
            // Skip non-visible objects and guides
            if (obj.excludeFromExport || obj.id === 'artboard-bg' || obj.id === 'guide-vertical' || obj.id === 'guide-horizontal') return;

            // Use world/absolute bounds to avoid viewport-dependent math.
            const bounds = typeof obj.getBoundingRect === 'function'
                ? obj.getBoundingRect(true, true)
                : obj.getBoundingRect();
            const oMinX = bounds.left;
            const oMinY = bounds.top;
            const oMaxX = bounds.left + bounds.width;
            const oMaxY = bounds.top + bounds.height;

            minX = Math.min(minX, oMinX);
            minY = Math.min(minY, oMinY);
            maxX = Math.max(maxX, oMaxX);
            maxY = Math.max(maxY, oMaxY);
        });
    }

    // Padding for the "Infinite" feel
    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    
    // Viewport dimensions in canvas coordinates
    const viewportWidth = width / zoom;
    const viewportHeight = height / zoom;
    const viewportLeft = -vpt[4] / zoom;
    const viewportTop = -vpt[5] / zoom;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;

    // Content boundaries with padding
    const contentLeft = minX - padding;
    const contentRight = maxX + padding;
    const contentTop = minY - padding;
    const contentBottom = maxY + padding;

    // VERTICAL SCROLLBAR - Show if content is taller than viewport OR viewport is panned (infinite canvas)
    const needsVerticalScroll = contentHeight > viewportHeight;
    const hasContentAbove = contentTop < viewportTop;
    const hasContentBelow = contentBottom > viewportBottom;
    const isPannedVertically = Math.abs(vpt[5]) > 5; // Viewport is panned (lower threshold)
    
    // Always show vertical scrollbar when content is taller or when panned
    scrollV.value.visible = needsVerticalScroll || isPannedVertically;
    
    if (scrollV.value.visible) {
        // For infinite canvas, use a larger virtual content area when panned
        const effectiveContentHeight = isPannedVertically && !needsVerticalScroll 
            ? Math.max(contentHeight, viewportHeight * 2) 
            : contentHeight;
        
        // Calculate scrollbar thumb height and position
        const scrollbarHeight = Math.max(40, (viewportHeight / effectiveContentHeight) * height);
        const scrollableHeight = effectiveContentHeight - viewportHeight;
        // Anchor the virtual space to the content bounds (stable) so the thumb moves while panning.
        const effectiveContentTop = isPannedVertically && !needsVerticalScroll
            ? contentTop - (effectiveContentHeight - contentHeight) / 2
            : contentTop;
        const scrollProgress = scrollableHeight > 0 ? Math.max(0, Math.min(1, (viewportTop - effectiveContentTop) / scrollableHeight)) : 0;
        scrollV.value.height = scrollbarHeight;
        scrollV.value.top = scrollProgress * (height - scrollbarHeight);
    }

    // HORIZONTAL SCROLLBAR - Show if content is wider than viewport OR viewport is panned (infinite canvas)
    const needsHorizontalScroll = contentWidth > viewportWidth;
    const hasContentLeft = contentLeft < viewportLeft;
    const hasContentRight = contentRight > viewportRight;
    const isPannedHorizontally = Math.abs(vpt[4]) > 5; // Viewport is panned (lower threshold)
    
    // Always show horizontal scrollbar when content is wider or when panned
    scrollH.value.visible = needsHorizontalScroll || isPannedHorizontally;
    
    if (scrollH.value.visible) {
        // For infinite canvas, use a larger virtual content area when panned
        const effectiveContentWidth = isPannedHorizontally && !needsHorizontalScroll 
            ? Math.max(contentWidth, viewportWidth * 2) 
            : contentWidth;
        
        // Calculate scrollbar thumb width and position
        const scrollbarWidth = Math.max(40, (viewportWidth / effectiveContentWidth) * width);
        const scrollableWidth = effectiveContentWidth - viewportWidth;
        // Anchor the virtual space to the content bounds (stable) so the thumb moves while panning.
        const effectiveContentLeft = isPannedHorizontally && !needsHorizontalScroll
            ? contentLeft - (effectiveContentWidth - contentWidth) / 2
            : contentLeft;
        const scrollProgress = scrollableWidth > 0 ? Math.max(0, Math.min(1, (viewportLeft - effectiveContentLeft) / scrollableWidth)) : 0;
        scrollH.value.width = scrollbarWidth;
        scrollH.value.left = scrollProgress * (width - scrollbarWidth);
    }
}

// Scrollbar drag handlers
const handleVerticalScrollbarDrag = (e: MouseEvent) => {
    if (!canvas.value || !wrapperEl.value) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startY = e.clientY;
    const startTop = scrollV.value.top;
    const height = wrapperEl.value.clientHeight;
    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    
    // Calculate content bounds (infinite canvas)
    const objects = canvas.value.getObjects();
    let minY = Infinity, maxY = -Infinity;
    if (objects.length === 0 || objects.filter((o: any) => !o.excludeFromExport && o.id !== 'artboard-bg' && o.id !== 'guide-vertical' && o.id !== 'guide-horizontal').length === 0) {
        minY = 0;
        maxY = activePage.value?.height || 1920;
    } else {
        objects.forEach((obj: any) => {
            if (obj.excludeFromExport || obj.id === 'artboard-bg' || obj.id === 'guide-vertical' || obj.id === 'guide-horizontal') return;
            const bounds = typeof obj.getBoundingRect === 'function'
                ? obj.getBoundingRect(true, true)
                : obj.getBoundingRect();
            const oMinY = bounds.top;
            const oMaxY = bounds.top + bounds.height;
            minY = Math.min(minY, oMinY);
            maxY = Math.max(maxY, oMaxY);
        });
    }
    
    const padding = 100;
    const contentHeight = maxY - minY + padding * 2;
    const viewportHeight = height / zoom;
    const viewportTop = -vpt[5] / zoom;
    const isPannedVertically = Math.abs(vpt[5]) > 10;
    const needsVerticalScroll = contentHeight > viewportHeight;
    
    // For infinite canvas, use a larger virtual content area when panned
    const effectiveContentHeight = isPannedVertically && !needsVerticalScroll 
        ? Math.max(contentHeight, viewportHeight * 2) 
        : contentHeight;
    const contentTop = minY - padding;
    const effectiveContentTop = isPannedVertically && !needsVerticalScroll
        ? contentTop - (effectiveContentHeight - contentHeight) / 2
        : contentTop;
    const scrollableHeight = effectiveContentHeight - viewportHeight;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startY;
        const newTop = Math.max(0, Math.min(height - scrollV.value.height, startTop + deltaY));
        scrollV.value.top = newTop;
        
        // Calculate new viewport position
        const scrollProgress = scrollableHeight > 0 ? newTop / (height - scrollV.value.height) : 0;
        const newViewportTop = effectiveContentTop + (scrollProgress * scrollableHeight);
        vpt[5] = -newViewportTop * zoom;
        
        canvas.value.requestRenderAll();
        updateScrollbars();
    };
    
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

const handleHorizontalScrollbarDrag = (e: MouseEvent) => {
    if (!canvas.value || !wrapperEl.value) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startLeft = scrollH.value.left;
    const width = wrapperEl.value.clientWidth;
    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    
    // Calculate content bounds (infinite canvas)
    const objects = canvas.value.getObjects();
    let minX = Infinity, maxX = -Infinity;
    if (objects.length === 0 || objects.filter((o: any) => !o.excludeFromExport && o.id !== 'artboard-bg' && o.id !== 'guide-vertical' && o.id !== 'guide-horizontal').length === 0) {
        minX = 0;
        maxX = activePage.value?.width || 1080;
    } else {
        objects.forEach((obj: any) => {
            if (obj.excludeFromExport || obj.id === 'artboard-bg' || obj.id === 'guide-vertical' || obj.id === 'guide-horizontal') return;
            const bounds = typeof obj.getBoundingRect === 'function'
                ? obj.getBoundingRect(true, true)
                : obj.getBoundingRect();
            const oMinX = bounds.left;
            const oMaxX = bounds.left + bounds.width;
            minX = Math.min(minX, oMinX);
            maxX = Math.max(maxX, oMaxX);
        });
    }
    
    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const viewportWidth = width / zoom;
    const viewportLeft = -vpt[4] / zoom;
    const isPannedHorizontally = Math.abs(vpt[4]) > 10;
    const needsHorizontalScroll = contentWidth > viewportWidth;
    
    // For infinite canvas, use a larger virtual content area when panned
    const effectiveContentWidth = isPannedHorizontally && !needsHorizontalScroll 
        ? Math.max(contentWidth, viewportWidth * 2) 
        : contentWidth;
    const contentLeft = minX - padding;
    const effectiveContentLeft = isPannedHorizontally && !needsHorizontalScroll
        ? contentLeft - (effectiveContentWidth - contentWidth) / 2
        : contentLeft;
    const scrollableWidth = effectiveContentWidth - viewportWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newLeft = Math.max(0, Math.min(width - scrollH.value.width, startLeft + deltaX));
        scrollH.value.left = newLeft;
        
        // Calculate new viewport position
        const scrollProgress = scrollableWidth > 0 ? newLeft / (width - scrollH.value.width) : 0;
        const newViewportLeft = effectiveContentLeft + (scrollProgress * scrollableWidth);
        vpt[4] = -newViewportLeft * zoom;
        
        canvas.value.requestRenderAll();
        updateScrollbars();
    };
    
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};

// View Controls
const updateZoomState = () => {
    if (!canvas.value) return;
    currentZoom.value = Math.round(canvas.value.getZoom() * 100);
    updateScrollbars();
}

// Close zoom menu when clicking outside
onMounted(() => {
    document.addEventListener('click', (e) => {
        if (showZoomMenu.value && !(e.target as HTMLElement).closest('.group')) {
            showZoomMenu.value = false
        }
    })
})

const handleZoomIn = () => {
    if (!canvas.value) return;
    let zoom = canvas.value.getZoom();
    zoom *= 1.2;
    if (zoom > 20) zoom = 20;
    
    let point = { x: canvas.value.getWidth() / 2, y: canvas.value.getHeight() / 2 };
    
    const activeObject = canvas.value.getActiveObject();
    if (activeObject) {
         const center = activeObject.getCenterPoint();
         const vpt = canvas.value.viewportTransform;
         point = {
             x: center.x * vpt[0] + vpt[4],
             y: center.y * vpt[3] + vpt[5]
         };
    }

    canvas.value.zoomToPoint(point, zoom);
    updateZoomState();
}

const handleZoomOut = () => {
    if (!canvas.value) return;
    let zoom = canvas.value.getZoom();
    zoom *= 0.8;
    if (zoom < 0.01) zoom = 0.01;
    
    let point = { x: canvas.value.getWidth() / 2, y: canvas.value.getHeight() / 2 };
    
    const activeObject = canvas.value.getActiveObject();
    if (activeObject) {
         const center = activeObject.getCenterPoint();
         const vpt = canvas.value.viewportTransform;
         point = {
             x: center.x * vpt[0] + vpt[4],
             y: center.y * vpt[3] + vpt[5]
         };
    }

    canvas.value.zoomToPoint(point, zoom);
    updateZoomState();
}

const handleZoom100 = () => {
    if (!canvas.value) return;
    // Reset viewport transform to 1, but keep center?
    // Usually 100% means 1 pixel = 1 pixel.
    canvas.value.setZoom(1);

    // Center logic (optional)
    const vpw = canvas.value.getWidth();
    const vph = canvas.value.getHeight();
    // Assuming A4 or standard size, we center the viewport
    // canvas.value.viewportTransform[4] = (vpw - (activePage.value.width))/2; // simplified
    // canvas.value.viewportTransform[5] = (vph - (activePage.value.height))/2;

    canvas.value.requestRenderAll();
    updateZoomState();
}

const handleZoom50 = () => {
    if (!canvas.value) return;
    canvas.value.setZoom(0.5);
    canvas.value.requestRenderAll();
    updateZoomState();
}

const handleZoom200 = () => {
    if (!canvas.value) return;
    canvas.value.setZoom(2);
    canvas.value.requestRenderAll();
    updateZoomState();
}

const handleZoom400 = () => {
    if (!canvas.value) return;
    canvas.value.setZoom(4);
    canvas.value.requestRenderAll();
    updateZoomState();
}

const handleZoomToSelection = () => {
    if (!canvas.value || !selectedObjectRef.value) return;
    const obj = selectedObjectRef.value;
    // Zoom to fit the selected object
    const padding = 20;
    const vpw = canvas.value.getWidth();
    const vph = canvas.value.getHeight();
    const objWidth = (obj.width || 1) * (obj.scaleX || 1);
    const objHeight = (obj.height || 1) * (obj.scaleY || 1);
    const scaleX = (vpw - padding * 2) / objWidth;
    const scaleY = (vph - padding * 2) / objHeight;
    const zoom = Math.min(scaleX, scaleY, 2); // Cap at 200%

    canvas.value.setZoom(zoom);
    canvas.value.requestRenderAll();
    updateZoomState();
}

const canvasObjects = shallowRef<any[]>([]) // Reactive list (shallow for performance)
const selectedObjectId = ref<string | null>(null)
const selectedObjectRef = shallowRef<any>(null) // Direct reference for properties panel (shallow for performance)

/** Create a stable snapshot for the PropertiesPanel (keeps non-enumerable fields like `type`). */
const snapshotForPropertiesPanel = (obj: any, extra?: Record<string, any>) => {
    if (!obj) return obj;
    const snap: any = { ...obj };
    // Some Fabric fields may live on the prototype and get lost with spread.
    snap.type = obj.type;
    snap.name = obj.name;
    snap.layerName = obj.layerName;
    snap._customId = obj._customId;
    snap.id = obj.id;

    // CRITICAL: Preserve zone-specific properties that may be non-enumerable or on prototype.
    // Without these, PropertiesPanel's isLikelyProductZone() fails after interactions.
    if (obj.isGridZone != null) snap.isGridZone = obj.isGridZone;
    if (obj.isProductZone != null) snap.isProductZone = obj.isProductZone;
    if (obj._zoneGlobalStyles != null) snap._zoneGlobalStyles = obj._zoneGlobalStyles;
    if (obj._zonePadding != null) snap._zonePadding = obj._zonePadding;
    if (obj._zoneWidth != null) snap._zoneWidth = obj._zoneWidth;
    if (obj._zoneHeight != null) snap._zoneHeight = obj._zoneHeight;
    if (obj.columns != null) snap.columns = obj.columns;
    if (obj.rows != null) snap.rows = obj.rows;
    if (obj.gapHorizontal != null) snap.gapHorizontal = obj.gapHorizontal;
    if (obj.gapVertical != null) snap.gapVertical = obj.gapVertical;
    if (obj.layoutDirection != null) snap.layoutDirection = obj.layoutDirection;
    if (obj.cardAspectRatio != null) snap.cardAspectRatio = obj.cardAspectRatio;
    if (obj.lastRowBehavior != null) snap.lastRowBehavior = obj.lastRowBehavior;
    if (obj.verticalAlign != null) snap.verticalAlign = obj.verticalAlign;
    if (obj.highlightCount != null) snap.highlightCount = obj.highlightCount;
    if (obj.highlightPos != null) snap.highlightPos = obj.highlightPos;
    if (obj.highlightHeight != null) snap.highlightHeight = obj.highlightHeight;
    if (obj.backgroundColor != null) snap.backgroundColor = obj.backgroundColor;
    // Preserve product card properties
    if (obj.isSmartObject != null) snap.isSmartObject = obj.isSmartObject;
    if (obj.isProductCard != null) snap.isProductCard = obj.isProductCard;
    if (obj.parentZoneId != null) snap.parentZoneId = obj.parentZoneId;
    // Preserve lock state
    if (obj.lockMovementX != null) snap.lockMovementX = obj.lockMovementX;
    if (obj.lockMovementY != null) snap.lockMovementY = obj.lockMovementY;
    if (obj.lockScalingX != null) snap.lockScalingX = obj.lockScalingX;
    if (obj.lockScalingY != null) snap.lockScalingY = obj.lockScalingY;
    // Preserve _objects reference for group detection in PropertiesPanel
    if (obj._objects != null) snap._objects = obj._objects;
    // Preserve getObjects method reference for PropertiesPanel zone detection
    if (typeof obj.getObjects === 'function') snap.getObjects = () => obj.getObjects();

    // CRITICAL: If the real Fabric object is a product zone (detected by ANY method including
    // strokeDashArray fallback), ALWAYS ensure zone flags are set on the snapshot.
    // This guarantees PropertiesPanel detection even for legacy arts where flags were not
    // originally serialized — the rehydration sets them on the real object, and we propagate here.
    if (!snap.isGridZone && !snap.isProductZone) {
        // Use a lightweight zone check: flags, name, or zone-specific custom properties
        const looksLikeZone = obj.name === 'gridZone' || obj.name === 'productZoneContainer'
            || (typeof obj._zonePadding === 'number')
            || (typeof obj._zoneWidth === 'number' && typeof obj._zoneHeight === 'number')
            || (obj.type === 'group' && typeof obj.getObjects === 'function' && (() => {
                try {
                    const rect = (obj.getObjects() || []).find((o: any) =>
                        o?.type === 'rect' && Array.isArray(o.strokeDashArray)
                    );
                    return !!rect;
                } catch { return false; }
            })());
        if (looksLikeZone) {
            snap.isGridZone = true;
            // Also set the flag on the real object so future interactions don't need fallback
            obj.isGridZone = true;
        }
    }

    return extra ? { ...snap, ...extra } : snap;
};

/** Refresh selectedObjectRef with a fresh snapshot so Vue detects changes in PropertiesPanel props */
const refreshSelectedRef = (extra?: Record<string, any>) => {
    const active = canvas.value?.getActiveObject?.()
    if (active) {
        selectedObjectRef.value = snapshotForPropertiesPanel(active, extra)
    } else {
        triggerRef(selectedObjectRef)
    }
}

const selectedObjectPos = ref<{top: number, left: number, width: number, visible: boolean}>({ top: 0, left: 0, width: 0, visible: false })

// Debounced save for properties panel (prevents lag during rapid input changes)
let propertySaveTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedSaveCurrentState = () => {
    if (propertySaveTimer) clearTimeout(propertySaveTimer);
    propertySaveTimer = setTimeout(() => {
        saveCurrentState({ reason: 'properties-panel' });
        // Property changes do not always emit Fabric `object:modified` events, so ensure DB auto-save runs too.
        triggerAutoSave();
    }, 150); // 150ms debounce for snappy feel but coalesces rapid changes
};

// Enable/disable "Salvar da Selecao" in the label templates modal.
canSaveLabelTemplateFromSelectionComputed = computed(() => {
    return !!getPriceGroupFromAny(selectedObjectRef.value);
});

const showProjectManager = ref(false)
const showGrid = ref(false)
const showRulers = ref(false)

const toggleGrid = () => {
    if (!canvas.value) {
        console.warn('Canvas não está inicializado ainda')
        return
    }
    
    showGrid.value = !showGrid.value;
    
    if (showGrid.value) {
        canvas.value.setBackgroundColor({
            source: createGridPattern(),
            repeat: 'repeat'
        }, canvas.value.renderAll.bind(canvas.value));
    } else {
        canvas.value.setBackgroundColor('#1e1e1e', canvas.value.renderAll.bind(canvas.value));
    }
    
    canvas.value.requestRenderAll()
}

const createGridPattern = () => {
    const gridSize = 20;
    const canvasGrid = document.createElement('canvas');
    canvasGrid.width = gridSize;
    canvasGrid.height = gridSize;
    const ctx = canvasGrid.getContext('2d');
    if (ctx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(gridSize, 0);
        ctx.lineTo(gridSize, gridSize);
        ctx.moveTo(0, gridSize);
        ctx.lineTo(gridSize, gridSize);
        ctx.stroke();
    }
    return canvasGrid.toDataURL();
}

const isFullscreen = ref(false)

const toggleRulers = () => {
    showRulers.value = !showRulers.value;
    // Rulers are often handled by a separate SVG or Canvas overlay
    // For now, we'll toggle the state
}

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            isFullscreen.value = true
        }).catch(err => {
            console.error('Erro ao entrar em tela cheia:', err)
        })
    } else {
        document.exitFullscreen().then(() => {
            isFullscreen.value = false
        }).catch(err => {
            console.error('Erro ao sair de tela cheia:', err)
        })
    }
}

// Listen to fullscreen changes
const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange)
})

// Modals State
const showSaveModal = ref(false)
const saveProjectName = ref('')

const showPasteListModal = ref(false)
const pasteListText = ref('')
const activePasteTab = ref('text') // 'text' | 'image'
const pastedImage = ref<string | null>(null)
const isAnalyzingImage = ref(false)
const listImageInput = ref<HTMLInputElement | null>(null)

// Product Review State (after processing)
const showProductReviewModal = ref(false)
const reviewProducts = ref<any[]>([])
const productImportExistingCount = ref(0)
const targetGridZone = ref<any>(null) // Reference to the Grid Zone that was double-clicked

const importZoneLabelTemplateId = computed(() => {
    const z = targetGridZone.value;
    if (z && isLikelyProductZone(z)) return String((z as any)._zoneGlobalStyles?.splashTemplateId || '');
    return '';
})

watch(showProductReviewModal, async (open) => {
    if (!open) return;
    await ensureLabelTemplatesReady();
})

const showManualProductModal = ref(false)
const manualProduct = ref({
    title: '',
    priceInt: '',
    priceDec: ''
})

const showAIModal = ref(false)
const aiPrompt = ref('')

const showClearConfirmModal = ref(false)
const showExportModal = ref(false)
const showShareModal = ref(false)
const shareUrl = ref('')
const shareCanEdit = ref(false)
const shareCanView = ref(true)

const generateShareLink = () => {
    const baseUrl = window.location.origin;
    shareUrl.value = `${baseUrl}/editor/${project.id}`;
}

const copyShareUrl = async () => {
    if (!shareUrl.value) {
        generateShareLink();
    }
    try {
        await navigator.clipboard.writeText(shareUrl.value);
        // Optionally show a success notification
    } catch (err) {
        console.error('Failed to copy URL:', err);
    }
}

const showPresentationModal = ref(false)
const presentationImage = ref('')
const presentationHotspots = ref<any[]>([])

const startPresentation = async (pageIndex = -1) => {
    if (!canvas.value) return;
    
    // Determine page to show (default to current active)
    const targetIndex = pageIndex >= 0 ? pageIndex : project.activePageIndex;
    
    // If target is different, we need to load it temporarily to render?
    // Optimization: We assume the user starts from CURRENT page for now. 
    // If navigating, we might need to load JSON data in background or switch context.
    
    // For this "Lite" prototype, we will handle navigation by ACTUALLY switching the active page in the background
    // but keeping the modal open.
    
    if (targetIndex !== project.activePageIndex) {
        // Switch page logic (re-using useProject)
        // This triggers the watcher, which re-renders canvas.
        // We need to wait for render, then grab image.
        project.activePageIndex = targetIndex;
        // Wait for Vue watch and Canvas render
        await new Promise(r => setTimeout(r, 200)); 
    }

    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();

    // 1. Sanitize clipPaths before generating image
    sanitizeAllClipPaths();

    // 2. Generate Image
    try {
        presentationImage.value = canvas.value.toDataURL({
            format: 'png',
            multiplier: 2
        });
    } catch (err) {
        console.error('[Prototype] Erro ao gerar imagem:', err);
        // Nuclear option: clear all clipPaths
        removeAllClipPaths();
        try {
            canvas.value.requestRenderAll();
            await new Promise(resolve => setTimeout(resolve, 10));
            presentationImage.value = canvas.value.toDataURL({
                format: 'png',
                multiplier: 2
            });
        } catch (err2) {
            console.error('[Prototype] Falha definitiva ao gerar imagem:', err2);
            presentationImage.value = '';
        }
    }
    
    // 2. Generate Hotspots
    // We need to map object coordinates to the image percentages to be responsive in modal
    const vWidth = canvas.value.getWidth();
    const vHeight = canvas.value.getHeight();
    const objects = canvas.value.getObjects();
    
    presentationHotspots.value = objects
        .filter((o: any) => o.interactionDestination !== undefined && o.interactionDestination !== '')
        .map((o: any) => {
            const boundingRect = o.getBoundingRect();
            return {
                top: (boundingRect.top / vHeight) * 100 + '%',
                left: (boundingRect.left / vWidth) * 100 + '%',
                width: (boundingRect.width / vWidth) * 100 + '%',
                height: (boundingRect.height / vHeight) * 100 + '%',
                target: o.interactionDestination
            };
        });
    
    showPresentationModal.value = true;
}

const handleHotspotClick = (targetIndex: any) => {
    // Navigate to target page
    startPresentation(Number(targetIndex));
}

const exportSettings = ref({
    format: 'png',
    scale: 1,
    quality: 0.9,
    exportScope: 'canvas', // 'canvas' | 'selected-frame' | 'all-frames'
    selectedFrameId: '' // ID of the frame to export
})

const availableFramesForExport = computed(() => {
    if (!canvas.value) return []
    return getAllFrames().map((f: any) => ({
        id: f._customId || f.id || '',
        name: f.layerName || f.name || 'Sem nome'
    }))
})

const selectedFrameForExport = computed(() => {
    if (!exportSettings.value.selectedFrameId || !canvas.value) return null
    return getFrameById(exportSettings.value.selectedFrameId)
})

// Design System State
const colorStyles = ref<{id: string, name: string, value: string}[]>([
    { id: 'primary', name: 'Primary Red', value: '#FF0000' },
    { id: 'secondary', name: 'Dark Gray', value: '#333333' },
    { id: 'accent', name: 'Blue Accent', value: '#3B82F6' }
])

const addColorStyle = (color: string) => {
    colorStyles.value.push({
        id: Math.random().toString(36).substr(2, 9),
        name: 'New Color',
        value: color
    });
}

const applyColorStyle = (styleId: string) => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    const style = colorStyles.value.find(s => s.id === styleId);
    if (active && style) {
        active.set('fill', style.value);
        active.set('styleId', styleId); // Save ref for future updates
        canvas.value.requestRenderAll();
        saveCurrentState();
        // Update selection Ref
        selectedObjectRef.value = snapshotForPropertiesPanel(active);
    }
}

// History System
const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);
const isHistoryProcessing = ref(false); // Flag to prevent loop
let isZoneCascadeDelete = false;
let isApplyingZoneUpdate = false; // Flag to prevent double state save when updating product zones

const showDeletePageModal = ref(false)

const handleDeleteCurrentPage = () => {
    if (project.pages.length <= 1) return;
    showDeletePageModal.value = true;
}

const confirmDeletePage = () => {
    deletePage(project.activePageIndex);
    showDeletePageModal.value = false;
}

let fabric: any = null;

// Mock Data for Smart Grid (Fallback) - Empty, real data comes from API
const MOCK_PRODUCTS: any[] = [];



// --- Smart Grid Implementation ---

const initProductZone = () => {
    if (!canvas.value) return;

    // watch for zone changes
    watch(() => productZoneState.productZone.value, (newZone) => {
        renderProductZone(newZone);
    }, { deep: true });

    // watch for products changes
    watch(() => productZoneState.products.value, (newProducts) => {
        renderProducts(newProducts);
    }, { deep: true });
}

// Map to track rendered product objects to avoid full re-renders
const productObjectMap = new Map<string | number, any>();
const zoneObjectRef = shallowRef<any>(null);

const renderProductZone = (zone: any) => {
    if (!canvas.value) return;

    let zoneRect = zoneObjectRef.value;

    // Only create zone if user explicitly enabled it
    if (!zone.enabled) {
        // Remove existing zone if disabled
        if (zoneRect) {
            canvas.value.remove(zoneRect);
            zoneObjectRef.value = null;
        }
        return;
    }

    if (!zoneRect) {
        // Create Zone Container (only when enabled)
        zoneRect = new fabric.Rect({
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height,
            fill: 'rgba(13, 153, 255, 0.05)',
            stroke: '#0d99ff',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            selectable: true,
            hasControls: true,
            lockRotation: true,
            id: 'product_zone_container',
            isZone: true, // Custom flag
            isProductZone: true // Flag to identify as product zone
        });

        // Add Event Listeners for "Smart" behavior
        zoneRect.on('moving', (e: any) => {
            const dx = e.transform.target.left - zone.x;
            const dy = e.transform.target.top - zone.y;
            
            // Move internal logic (update state)
            productZoneState.updateZone({ x: e.transform.target.left, y: e.transform.target.top });
            
            // Move all products visually to stay in sync during drag
            // (Re-render will fix exact positions, but this mimics realtime)
            productZoneState.products.value.forEach(p => {
                const pObj = productObjectMap.get(p.id);
                if (pObj) {
                    pObj.set({
                        left: pObj.left + dx,
                        top: pObj.top + dy
                    });
                    pObj.setCoords();
                }
            });
            // Also update product state coordinates
            productZoneState.products.value.forEach(p => {
                 productZoneState.updateProduct(p.id, {
                     x: p.x + dx, 
                     y: p.y + dy
                 });
            });
        });

        zoneRect.on('scaling', (e: any) => {
             // "Smart Container" resizing
             const newWidth = zoneRect.getScaledWidth();
             const newHeight = zoneRect.getScaledHeight();

             // Reset Scale to 1 to avoid distortion
             zoneRect.set({
                 width: newWidth,
                 height: newHeight,
                 scaleX: 1,
                 scaleY: 1
             });

             // Update State -> Triggers Recalculate
             productZoneState.updateZone({ width: newWidth, height: newHeight });
             productZoneState.recalculateLayout();
        });

        canvas.value.add(zoneRect);
        // Move to back by manipulating _objects array (Fabric.js v7 compatible)
        const objects = canvas.value._objects;
        if (Array.isArray(objects)) {
            const index = objects.indexOf(zoneRect);
            if (index > -1) {
                objects.splice(index, 1);
                objects.unshift(zoneRect);
            }
        }
        zoneObjectRef.value = zoneRect;
    } else {
        // Update existing zone visual
        zoneRect.set({
            left: zone.x,
            top: zone.y,
            width: zone.width,
            height: zone.height
        });
        zoneRect.setCoords();
    }
    
    canvas.value.requestRenderAll();
}

const renderProducts = (products: any[]) => {
    if (!canvas.value) return;

    // 1. Identify removed products
    const currentIds = new Set(products.map(p => p.id));
    for (const [id, obj] of productObjectMap.entries()) {
        if (!currentIds.has(id)) {
            canvas.value.remove(obj);
            productObjectMap.delete(id);
        }
    }

    // 2. Add/Update products
    products.forEach(product => {
        let pObj = productObjectMap.get(product.id);

        if (!pObj) {
            // CREATE NEW PRODUCT GROUP
            // Calculate optimal image size
            const optimalSize = productZoneState.getOptimalImageSize(product);

            const bg = new fabric.Rect({
                width: product.width,
                height: product.height,
                fill: product.backgroundColor || '#ffffff',
                rx: product.borderRadius || 8,
                ry: product.borderRadius || 8,
                originX: 'center',
                originY: 'center',
                shadow: { color: 'rgba(0,0,0,0.1)', blur: 4, offsetX: 0, offsetY: 2 }
            });

            const text = new fabric.Textbox(product.name || 'Nome', {
                fontSize: Math.min(18, product.width * 0.1),
                fontFamily: 'Inter',
                fontWeight: 600,
                fill: '#333333',
                originX: 'center',
                originY: 'top',
                top: -product.height/2 + 10,
                width: product.width - 20,
                textAlign: 'center',
                splitByGrapheme: true
            });

            // Image Area (Placeholder)
            const imgPlaceholder = new fabric.Rect({
                width: optimalSize.maxWidth,
                height: optimalSize.maxHeight,
                fill: '#f5f5f5',
                stroke: '#e5e5e5',
                strokeWidth: 1,
                originX: 'center',
                originY: 'center',
                top: -10 
            });

            // Usar getAvailablePrices para determinar o preço principal
            const availablePrices = getAvailablePrices(product);
            const priceVal = availablePrices.mainPrice !== undefined ? availablePrices.mainPrice : 0;
            const priceStr = typeof priceVal === 'number'
                ? priceVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : priceVal.toString();

            const price = new fabric.Text(`R$ ${priceStr}`, {
                fontSize: Math.min(28, product.width * 0.15),
                fontWeight: '800',
                fill: '#dc2626',
                originX: 'center',
                originY: 'bottom',
                top: product.height/2 - 15
            });

            pObj = new fabric.Group([bg, text, imgPlaceholder, price], {
                left: product.x,
                top: product.y,
                width: product.width,
                height: product.height,
                selectable: true,
                id: product.id,
                isProduct: true,
                // Default behavior: move/select the whole group.
                subTargetCheck: false,
                interactive: false
            });

            pObj.on('moving', (e: any) => {
                 // Update product position in state
                 // Note: If restricted to grid, we arguably shouldn't allow moving individual items freely unless 'freeMode'
                 // For now, let's sync state
                 productZoneState.updateProduct(product.id, {
                     x: pObj.left,
                     y: pObj.top
                 });
            });

            canvas.value.add(pObj);
            productObjectMap.set(product.id, pObj);
        } else {
            // UPDATE EXISTING
            // We animate the move for smoothness if desired, or set directly
            pObj.set({
                left: product.x,
                top: product.y,
                width: product.width,
                height: product.height
            });
            
            // Deep update of internals
            const items = pObj.getObjects();
            const optimalSize = productZoneState.getOptimalImageSize(product);
            
            if(items[0]) { // BG
                items[0].set({ width: product.width, height: product.height, fill: product.backgroundColor || '#ffffff' });
            }
            if(items[1]) { // Textbox
                items[1].set({ 
                    text: product.name, 
                    top: -product.height/2 + 10,
                    width: product.width - 20,
                    fontSize: Math.min(18, product.width * 0.1)
                });
            }
            if(items[2]) { // Image Placeholder
                items[2].set({
                    width: optimalSize.maxWidth,
                    height: optimalSize.maxHeight,
                    top: -10
                });
            }
            if(items[3]) { // Price
                // Usar getAvailablePrices para determinar o preço principal
                const availablePrices = getAvailablePrices(product);
                const priceVal = availablePrices.mainPrice !== undefined ? availablePrices.mainPrice : 0;
                const priceStr = typeof priceVal === 'number'
                   ? priceVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                   : priceVal.toString();
                items[3].set({
                    text: `R$ ${priceStr}`,
                    fontSize: Math.min(28, product.width * 0.15),
                    top: product.height/2 - 15
                });
            }

            pObj.setCoords();
        }
    });

    canvas.value.requestRenderAll();
}

// --- Watch for Page Switching ---
watch(activePage, async (newPage, oldPage) => {
    if (!canvas.value || !fabric) return;
    if (!newPage) return;

    const savedVpt = newPage.canvasData ? getSavedViewportTransform(newPage.canvasData) : null;

    // 1. Snapshot logic...
    
    // 2. Clear & Resize Canvas
    isHistoryProcessing.value = true;
    
    // CRITICAL: Only clear if canvas is fully initialized (has context)
    if (canvas.value) {
        try {
            const ctx = canvas.value.getContext();
            if (ctx && typeof ctx.clearRect === 'function') {
                canvas.value.clear();
            } else {
                console.warn('⚠️ Contexto do canvas não está disponível para clear(), pulando...');
            }
        } catch (err) {
            console.warn('⚠️ Erro ao limpar canvas (pode não estar inicializado):', err);
            // Continue anyway - loadFromJSON will handle it
        }
    }
    // THE WORKSPACE BACKGROUND IS DYNAMIC
    if (canvas.value) {
        canvas.value.backgroundColor = pageSettings.value.backgroundColor;
    } 
    
    // Infinite canvas: the Fabric canvas must match the visible wrapper size,
    // NOT the page/frame dimensions (those are represented by Frame objects).
    const ww = wrapperEl.value?.clientWidth || canvas.value.getWidth?.() || 0;
    const wh = wrapperEl.value?.clientHeight || canvas.value.getHeight?.() || 0;
    if (ww && wh) {
        canvas.value.setDimensions({ width: ww, height: wh });
    }

	    // 3. Load Data
	    try {
	        if (newPage.canvasData) {
	            // CRITICAL: Ensure canvas is fully initialized before loading
	            if (!canvas.value || !canvas.value.getContext) {
	                console.warn('⚠️ Canvas não inicializado, aguardando...');
	                await new Promise(resolve => setTimeout(resolve, 100));
	                if (!canvas.value || !canvas.value.getContext) {
	                    console.error('❌ Canvas ainda não inicializado após espera');
	                    isHistoryProcessing.value = false;
	                    return;
	                }
	            }
	            
	            // Restore label templates stored alongside the Fabric JSON (persisted per page).
	            hydrateLabelTemplatesFromProjectJson(newPage.canvasData);

                    // Pre-process images to use local proxy for Contabo images
                    // This avoids presigned URL issues with encoding and expiration
                    let canvasDataToLoad = JSON.parse(JSON.stringify(newPage.canvasData));
                    // Blob URLs do not survive reload; replace early to avoid loadFromJSON errors.
                    canvasDataToLoad = replaceBlobImagesWithPlaceholder(canvasDataToLoad);
                    // Convert Contabo URLs to use local proxy (bypasses presigned URL issues)
                    canvasDataToLoad = convertContaboToProxyUrls(canvasDataToLoad);

	            // Track whether we loaded successfully and whether we had to degrade (missing images)
	            let didLoadNewPage = false;
	            let degradedNewPage = false;
	            try {
	                try {
	                    await canvas.value.loadFromJSON(canvasDataToLoad);
	                    didLoadNewPage = true;
	                } catch (imageLoadErr: any) {
	                    const errorStr = imageLoadErr?.message || imageLoadErr?.toString?.() || '';
	                    const isImageError =
	                        errorStr.includes('fabric: Error loading') ||
	                        errorStr.includes('Error loading') ||
	                        errorStr.includes('contabostorage') ||
	                        errorStr.includes('500');

	                    if (!isImageError) throw imageLoadErr;

	                    console.warn('⚠️ Erro ao carregar imagem durante loadFromJSON:', imageLoadErr);
	                    console.warn('   Tentando gerar novas URLs presignadas para imagens da Contabo...');

	                    // IMPORTANT: Use the pre-processed canvasDataToLoad instead of newPage.canvasData
	                    const safeCanvasData = JSON.parse(JSON.stringify(canvasDataToLoad));
	                    if (safeCanvasData?.objects && Array.isArray(safeCanvasData.objects)) {
	                        const imagesToUpdate: any[] = [];
	                        
	                        // Find all Contabo images and generate new presigned URLs
	                        for (const obj of safeCanvasData.objects) {
	                            const src = obj?.src;
	                            const objType = (obj?.type || '').toLowerCase();
	                            const isImage = objType === 'image' && typeof src === 'string' && src.length > 0;
	                            if (!isImage) continue;
	                            
	                            const isContabo = src.includes('contabostorage.com') || src.includes('usc1.contabostorage.com');
	                            if (isContabo) {
	                                imagesToUpdate.push(obj);
	                            }
	                        }

	                        console.log(`🔄 Gerando novas URLs presignadas para ${imagesToUpdate.length} imagem(ns)...`);

	                        const imagesToRemove: any[] = [];
	                        // Generate new presigned URLs for each image
	                        for (const imgObj of imagesToUpdate) {
	                            try {
	                                // Extract key from URL (works with both presigned and permanent URLs)
	                                const result = extractContaboBucketAndKey(imgObj.src);
	                                const key = result?.key;
	                                if (!key) {
	                                    console.warn(`⚠️ Não foi possível extrair chave da URL: ${imgObj.src?.substring(0, 80)}...`);
	                                    imagesToRemove.push(imgObj);
	                                    continue;
	                                }

	                                // Generate new presigned URL from key
	                                const newUrl = await generatePresignedUrl(key);
	                                if (newUrl) {
	                                    console.log(`✅ Nova URL presignada gerada para imagem: ${key.substring(0, 50)}...`);
	                                    imgObj.src = newUrl;
	                                } else {
	                                    console.error(`❌ Falha ao gerar URL presignada para: ${key.substring(0, 50)}...`);
	                                    imagesToRemove.push(imgObj);
	                                }
	                            } catch (err) {
	                                console.error(`❌ Erro ao gerar URL presignada:`, err);
	                                console.error(`   URL original: ${imgObj.src?.substring(0, 100)}`);
	                                imagesToRemove.push(imgObj);
	                            }
	                        }

	                        // Remove images that failed to generate new presigned URLs
	                        if (imagesToRemove.length > 0) {
	                            console.warn(`⚠️ Removendo ${imagesToRemove.length} imagem(ns) que falharam ao gerar novas URLs...`);
	                            safeCanvasData.objects = safeCanvasData.objects.filter((obj: any) => !imagesToRemove.includes(obj));
	                        }

	                        // Try loading again with updated URLs
	                        await canvas.value.loadFromJSON(safeCanvasData);
	                        didLoadNewPage = true;
	                        // Only mark as degraded if we couldn't generate URLs for some images
	                        degradedNewPage = imagesToUpdate.some((img, idx) => {
	                            const updatedObj = safeCanvasData.objects.find((o: any) => o === img);
	                            return updatedObj && updatedObj.src === img.src; // URL didn't change
	                        });
	                    } else {
	                        // No objects array, use pre-processed data
	                        await canvas.value.loadFromJSON(canvasDataToLoad);
	                        didLoadNewPage = true;
	                    }
	                }
	            } catch (loadErr) {
	                console.error('❌ Erro ao carregar JSON no canvas:', loadErr);
	                // Try to clear and retry once - but only if canvas is fully ready
	                if (canvas.value) {
	                    try {
	                        // Verificar se o contexto ainda existe antes de tentar clear
	                        const ctx = canvas.value.getContext();
	                        if (ctx && typeof ctx.clearRect === 'function') {
	                            canvas.value.clear();
	                            await new Promise(resolve => setTimeout(resolve, 50));
	                            await canvas.value.loadFromJSON(canvasDataToLoad);
	                        } else {
	                            console.warn('⚠️ Contexto do canvas não está disponível, pulando clear()');
	                            // Tentar carregar diretamente sem clear
	                            await canvas.value.loadFromJSON(canvasDataToLoad);
	                        }
                    } catch (retryErr) {
                        console.error('❌ Erro ao recarregar após clear:', retryErr);
                        // Penúltima tentativa: substituir imagens Contabo por placeholder (mantém layout)
                        try {
                            const dataWithPlaceholders = replaceContaboImagesWithPlaceholder(canvasDataToLoad);
                            await canvas.value.loadFromJSON(dataWithPlaceholders);
                            didLoadNewPage = true;
                            degradedNewPage = true;
                            console.log('✅ loadFromJSON concluído com placeholder para imagens que falharam');
                        } catch (placeholderErr) {
                            // Last attempt: load without ANY images (never throw due to broken image)
                            try {
                                const safeData = JSON.parse(JSON.stringify(canvasDataToLoad));
                                if (safeData?.objects && Array.isArray(safeData.objects)) {
                                    safeData.objects = safeData.objects.filter((obj: any) => obj?.type !== 'image');
                                }
                                await canvas.value.loadFromJSON(safeData);
                                didLoadNewPage = true;
                                degradedNewPage = true;
                                console.log('✅ loadFromJSON concluído sem imagens (fallback final)');
                            } catch (finalErr) {
                                console.error('❌ Erro final ao carregar:', finalErr);
                                throw finalErr;
                            }
                        }
                    }
                } else {
                    throw loadErr;
                }
            }
            // If we couldn't load, do NOT continue (prevents wiping saved data with empty state).
            if (!didLoadNewPage) {
	                isHistoryProcessing.value = false;
	                return;
	            }
	            
	            // Remove old frame label text objects (if any were saved)
	            const objects = canvas.value.getObjects();
	            objects.forEach((obj: any) => {
	                if (obj.isFrameLabel || (obj.type === 'text' && obj.text && obj.text.includes('@') && obj.text.includes('dpi'))) {
	                    canvas.value.remove(obj);
	                }
	            });
	            
            // CRITICAL: Remove any duplicate objects BEFORE rehydration
            const allObjsBefore = canvas.value.getObjects();
            const seenIds = new Set<string>();
            const duplicates: any[] = [];
            allObjsBefore.forEach((obj: any) => {
                const id = obj._customId || obj.id;
                if (id && seenIds.has(id)) {
                    duplicates.push(obj);
                } else if (id) {
                    seenIds.add(id);
                }
            });
            // CRITICAL: Remove duplicates preserving order
            // Remove from end to preserve order of remaining objects
            if (duplicates.length > 0) {
                console.warn(`⚠️ Removendo ${duplicates.length} objeto(s) duplicado(s) após loadFromJSON`);
                // Remove duplicates without affecting order
                duplicates.forEach(dup => {
                    try {
                        canvas.value.remove(dup);
                    } catch (e) {
                        // Ignore errors
                    }
                });
            }
            
            // CRITICAL: Remove any non-frame rectangles that might have been incorrectly created
            // IMPORTANT: Preserve order by removing from end
            const allObjsAfterDedup = canvas.value.getObjects();
            const rectsToRemove: any[] = [];
            // Iterate in reverse to mark for removal from end
            for (let i = allObjsAfterDedup.length - 1; i >= 0; i--) {
                const obj = allObjsAfterDedup[i];
                // If it's a rect but NOT a frame, and doesn't have a specific purpose (like artboard-bg), remove it
                if (obj.type === 'rect' && 
                    !obj.isFrame && 
                    !obj.clipContent && 
                    obj.id !== 'artboard-bg' &&
                    obj.selectable !== false && // artboard is not selectable
                    !obj.excludeFromExport) {
                    // Check if this looks like a duplicate frame (has similar properties but missing isFrame)
                    const hasFrameLikeProps = obj.stroke && String(obj.stroke).toLowerCase() === '#0d99ff';
                    if (hasFrameLikeProps) {
                        // Mark for removal (remove from end to preserve order)
                        rectsToRemove.push(obj);
                    }
                }
            }
            // Remove from end to preserve order
            rectsToRemove.forEach((obj: any) => {
                try {
                    canvas.value.remove(obj);
                } catch (e) {
                    // Ignore errors
                }
            });
            
            // CRITICAL: Clear all deserialized clipPaths before rehydrate
            const objsBeforeRehydrateNew = canvas.value.getObjects();
            objsBeforeRehydrateNew.forEach((obj: any) => {
                if (obj.clipPath && !obj.isFrame) {
                    obj.clipPath = null;
                    delete obj._frameClipOwner;
                }
            });
            
            // CRITICAL: Rehydrate zones AND frames to restore isFrame flags and normalize names
            rehydrateCanvasZones();
            
            // Ensure all frames have layerName set to "FRAMER" if missing (for LayersPanel display)
            const allObjs = canvas.value.getObjects();
            allObjs.forEach((obj: any) => {
                if (obj?.isFrame && !obj.layerName) {
                    obj.layerName = 'FRAMER';
                    console.log(`🔄 Frame sem layerName, definido como "FRAMER":`, obj.name);
                }
            });
            
            // CRITICAL: Remove any artboard-bg that might have been incorrectly created
            let artboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
            if (artboard && (artboard.isFrame || artboard.clipContent || artboard.selectable)) {
                console.warn('⚠️ Removendo artboard-bg incorreto (era um Frame)');
                canvas.value.remove(artboard);
                artboard = null; // Clear reference after removal
            }
            
            // Force update canvasObjects to reflect restored state
            canvasObjects.value = [...canvas.value.getObjects()];
            
            // Try to sync settings from loaded artboard (re-find after potential removal)
            if (!artboard) {
                artboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
            }
            if (artboard && artboard.fill) {
                pageSettings.value.backgroundColor = artboard.fill as string;
            }
            
            // Restore IDs if lost - BUT exclude frames and selectable objects
            canvas.value.getObjects().forEach((o: any) => {
                // CRITICAL: Don't mark frames as artboard! Frames are selectable and have isFrame flag
                if (o.type === 'rect' && !o.selectable && !o.id && !o.isFrame && !o.clipContent) {
                    o.set('id', 'artboard-bg');
                }
            });

            // CRITICAL: Clear Fabric's char-width cache and recalculate text
            // dimensions after loadFromJSON. The JSON may carry stale width/height
            // that was measured with a fallback font. Even if fonts loaded later,
            // Fabric caches per-char widths keyed by font name — those stale entries
            // persist until explicitly cleared.
            try {
                const fabricCache = (fabric as any)?.cache;
                if (fabricCache && typeof fabricCache.clearFontCache === 'function') {
                    fabricCache.clearFontCache();
                }
            } catch (_e) { /* ignore */ }

            const recalcAllText = (obj: any) => {
                if (!obj) return;
                const t = String(obj.type || '').toLowerCase();
                if (t === 'i-text' || t === 'textbox' || t === 'text') {
                    if (typeof obj.initDimensions === 'function') obj.initDimensions();
                    obj.set('dirty', true);
                    if (typeof obj.setCoords === 'function') obj.setCoords();
                }
                if (typeof obj.getObjects === 'function') {
                    obj.getObjects().forEach(recalcAllText);
                    obj.set('dirty', true);
                }
            };
            canvas.value.getObjects().forEach(recalcAllText);

            safeRequestRenderAll();
        } else {
            // New Blank Page starts with default settings
            // canvas.value.backgroundColor = '#ffffff'; // NO! Workspace is dark. Artboard is white.
            // Explicitly do nothing here, let updateArtboard() create the white rect.
        }
    } catch (err) {
        console.error("Error loading page data:", err);
    } finally {
        isHistoryProcessing.value = false;
    }
    
    // 4. Reset History for this page context
    historyStack.value = [];
    historyIndex.value = -1;

    // 5. Restore viewport (last pan/zoom) or fallback to zoom-to-fit.
    if (savedVpt) {
        applyViewportTransform(savedVpt);
        // Persist immediately so a reload doesn't overwrite viewport with defaults.
        saveCurrentState();
    } else {
        setTimeout(() => {
            zoomToFit();
            saveCurrentState();
        }, 50);
    }

    // 6. Refresh Reactivity and ensure no duplicates
    const objs = canvas.value.getObjects();
    const seenCustomIds = new Set<string>();
    const seenIds = new Set<string>();
    const finalObjs: any[] = [];
    
    // CRITICAL: Preserve order - iterate in original order and only remove control objects
    // Don't reorder or sort - maintain exact order from canvas
    const objsInOrder = [...objs]; // Preserve original order
    const toRemove: any[] = [];
    
    objsInOrder.forEach((o: any) => {
        // Skip control objects - don't assign _customId
        const name = o.name || '';
        const isControlObject = name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line';
        const isSmallControlCircle = o.type === 'circle' && o.radius && o.radius <= 7;
        const hasControlData = o.data && (o.data.parentPath || o.data.parentObj);
        
        if (isControlObject || o.excludeFromExport || isSmallControlCircle || hasControlData) {
            // Mark for removal (remove later to preserve order)
            toRemove.push(o);
            return;
        }
        
        // Ensure _customId exists for real objects
        if (!o._customId) o._customId = Math.random().toString(36).substr(2, 9);
        
        // Check for duplicates by _customId or id
        const customId = o._customId;
        const id = o.id;
        
        if (customId && seenCustomIds.has(customId)) {
            console.warn(`⚠️ Removendo objeto duplicado por _customId: ${customId}`, o);
            toRemove.push(o);
            return;
        }
        if (id && id !== 'artboard-bg' && seenIds.has(id)) {
            console.warn(`⚠️ Removendo objeto duplicado por id: ${id}`, o);
            toRemove.push(o);
            return;
        }
        
        if (customId) seenCustomIds.add(customId);
        if (id) seenIds.add(id);
        finalObjs.push(o);
    });
    
    // Remove marked objects (from end to preserve order)
    toRemove.forEach((obj: any) => {
        try {
            canvas.value.remove(obj);
        } catch (e) {
            // Ignore errors
        }
    });
    
    // CRITICAL: Update canvasObjects with deduplicated list (order preserved from original)
    // Don't reorder - maintain exact order from canvas.getObjects()
    canvasObjects.value = [...finalObjs];
}, { deep: false }); // Watch the object reference change

const zoomToFit = () => {
    if (!canvas.value || !wrapperEl.value) return;

    // Refresh Canvas Size
    canvas.value.setDimensions({
        width: wrapperEl.value.clientWidth,
        height: wrapperEl.value.clientHeight
    });

    const vWidth = canvas.value.getWidth();
    const vHeight = canvas.value.getHeight();
    // Infinite Canvas Logic: Fit to ALL Objects
    const objects = canvas.value.getObjects().filter((o: any) => o.id !== 'artboard-bg' && !o.excludeFromExport);

    console.log('🔍 zoomToFit: objects count:', objects.length, 'viewport:', vWidth, 'x', vHeight);

    if (objects.length === 0) {
        // Empty Canvas? Center at (0,0) with zoom 1 or default zoom
        canvas.value.setViewportTransform([1, 0, 0, 1, vWidth / 2, vHeight / 2]);
        updateZoomState();
        showZoomMenu.value = false
        return;
    }

    // Calculate Bounding Box of all content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objects.forEach((obj: any) => {
        // `getBoundingRect(true, true)` returns absolute/world coords (no viewport),
        // which is what we want for a stable zoom-to-fit.
        const br = typeof obj.getBoundingRect === 'function'
            ? obj.getBoundingRect(true, true)
            : obj.getBoundingRect();
        if (br.left < minX) minX = br.left;
        if (br.top < minY) minY = br.top;
        if (br.left + br.width > maxX) maxX = br.left + br.width;
        if (br.top + br.height > maxY) maxY = br.top + br.height;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    console.log('🔍 zoomToFit: bounding box:', { minX, minY, maxX, maxY, contentWidth, contentHeight });

    // Safety check
    if (contentWidth <= 0 || contentHeight <= 0) {
         canvas.value.setViewportTransform([1, 0, 0, 1, vWidth / 2, vHeight / 2]);
         updateZoomState();
         showZoomMenu.value = false
         return;
    }

    // Add padding (10%)
    const padding = 100;

    const scaleX = (vWidth - padding * 2) / contentWidth;
    const scaleY = (vHeight - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Max zoom 1 to avoid too close

    console.log('🔍 zoomToFit: scale calculations:', { scaleX, scaleY, finalScale: scale });

    // Center Logic
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    const viewportX = (vWidth / 2) - (contentCenterX * scale);
    const viewportY = (vHeight / 2) - (contentCenterY * scale);

    console.log('🔍 zoomToFit: viewport transform:', { scale, viewportX, viewportY });

    canvas.value.setViewportTransform([scale, 0, 0, scale, viewportX, viewportY]);
    updateZoomState();
    showZoomMenu.value = false

    // Infinite Canvas Mode: No Artboard update needed
    // updateArtboard();
}

const updateArtboard = () => {
    // INFINITE CANVAS MODE:
    // We explicitly DISABLE the creation of the fixed "artboard-bg" rectangle.
    // The canvas is now an infinite space where users can drop Frames.
    if (!canvas.value) return;

    // Check if there's a legacy artboard left and remove it if found
    const legacyArtboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
    if (legacyArtboard) {
        canvas.value.remove(legacyArtboard);
        canvas.value.requestRenderAll();
    }
}

const resizeCanvas = () => {
    if (!canvas.value || !wrapperEl.value) return;

    const oldW = canvas.value.getWidth?.() || 0;
    const oldH = canvas.value.getHeight?.() || 0;
    const newW = wrapperEl.value.clientWidth || oldW;
    const newH = wrapperEl.value.clientHeight || oldH;
    if (!newW || !newH) return;

    // Preserve the scene point currently at the center of the viewport.
    // This avoids drifting to corners when panels expand/collapse.
    const vpt = Array.isArray(canvas.value.viewportTransform) ? [...canvas.value.viewportTransform] : [1, 0, 0, 1, 0, 0];
    const scale = Number(vpt[0] || 1);
    let sceneCenter: any = null;
    try {
        if (oldW > 0 && oldH > 0 && (fabric as any)?.util?.invertTransform && (fabric as any)?.util?.transformPoint) {
            const inv = (fabric as any).util.invertTransform(vpt);
            sceneCenter = (fabric as any).util.transformPoint({ x: oldW / 2, y: oldH / 2 }, inv);
        }
    } catch {
        sceneCenter = null;
    }

    canvas.value.setDimensions({ width: newW, height: newH });
    canvas.value.calcOffset?.();

    if (sceneCenter && typeof sceneCenter.x === 'number' && typeof sceneCenter.y === 'number') {
        const next = [scale, 0, 0, scale, (newW / 2) - (sceneCenter.x * scale), (newH / 2) - (sceneCenter.y * scale)];
        canvas.value.setViewportTransform(next);
    } else {
        // Fallback: keep scale and center the origin
        canvas.value.setViewportTransform([scale, 0, 0, scale, newW / 2, newH / 2]);
    }

    updateScrollbars();
    safeRequestRenderAll();
}

// 🔒 === CONTAINMENT SYSTEM (Product Cards & Zones) ===
// Ensures:
// 1. Product cards stay INSIDE product zones
// 2. Product images stay INSIDE product cards
// 3. Works on load, move, and scale
// MUST be declared at component scope to be accessible in all event handlers
const applyContainmentConstraints = (obj: any) => {
    if (!obj || !canvas.value) return;

    const getCardBaseSize = (card: any): { w: number; h: number } | null => {
        if (!card) return null;
        const w0 = Number((card as any)._cardWidth);
        const h0 = Number((card as any)._cardHeight);
        if (Number.isFinite(w0) && w0 > 0 && Number.isFinite(h0) && h0 > 0) {
            return { w: w0, h: h0 };
        }
        try {
            if (card.type === 'group' && typeof card.getObjects === 'function') {
                const bg = card.getObjects().find((c: any) => c?.name === 'offerBackground' && (c?.type === 'rect' || c?.type === 'Rect'));
                const bw = Number(bg?.width);
                const bh = Number(bg?.height);
                if (Number.isFinite(bw) && bw > 0 && Number.isFinite(bh) && bh > 0) {
                    return { w: bw, h: bh };
                }
            }
        } catch (e) {
            // ignore
        }

        const w1 = Number(card?.width);
        const h1 = Number(card?.height);
        if (Number.isFinite(w1) && w1 > 0 && Number.isFinite(h1) && h1 > 0) {
            return { w: w1, h: h1 };
        }
        return null;
    };
    
    // CONSTRAINT 1: Product Card must stay inside Product Zone
    if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
        const parentZoneId = obj.parentZoneId;
        if (!parentZoneId) return;
        
        // Find parent zone
        const zone = canvas.value.getObjects().find((o: any) => 
            o._customId === parentZoneId && 
            (o.isProductZone || o.name === 'productZoneContainer')
        );
        
        if (!zone) return;
        
        // Get zone boundaries (robust to origin/viewport)
        const zm = (typeof getZoneMetrics === 'function') ? (getZoneMetrics(zone) ?? zone.getBoundingRect(true)) : zone.getBoundingRect(true);
        const zoneLeft = zm.left;
        const zoneTop = zm.top;
        const zoneRight = zm.left + zm.width;
        const zoneBottom = zm.top + zm.height;
        
        // Get card boundaries (prefer the real card container size, not the group bounding box)
        const base = getCardBaseSize(obj);
        const baseW = base?.w ?? (Number(obj.width) || 0);
        const baseH = base?.h ?? (Number(obj.height) || 0);
        const cardWidth = Math.abs(baseW * Number(obj.scaleX || 1));
        const cardHeight = Math.abs(baseH * Number(obj.scaleY || 1));
        const center = (typeof obj.getCenterPoint === 'function')
            ? obj.getCenterPoint()
            : { x: (obj.left ?? 0), y: (obj.top ?? 0) };

        const cardLeft = center.x - cardWidth / 2;
        const cardTop = center.y - cardHeight / 2;
        const cardRight = cardLeft + cardWidth;
        const cardBottom = cardTop + cardHeight;
        
        // Calculate constraints
        let constrainedCx = center.x;
        let constrainedCy = center.y;
        
        // Constrain horizontally
        if (cardLeft < zoneLeft) {
            constrainedCx = zoneLeft + cardWidth / 2;
        } else if (cardRight > zoneRight) {
            constrainedCx = zoneRight - cardWidth / 2;
        }
        
        // Constrain vertically
        if (cardTop < zoneTop) {
            constrainedCy = zoneTop + cardHeight / 2;
        } else if (cardBottom > zoneBottom) {
            constrainedCy = zoneBottom - cardHeight / 2;
        }
        
        // Apply constraints if needed
        if (constrainedCx !== center.x || constrainedCy !== center.y) {
            // Keep card positioned by its center, regardless of its current origin.
            if (fabric?.Point && typeof obj.setPositionByOrigin === 'function') {
                obj.setPositionByOrigin(new fabric.Point(constrainedCx, constrainedCy), 'center', 'center');
            } else {
                obj.set({ left: constrainedCx, top: constrainedCy, originX: 'center', originY: 'center' });
            }
            obj.setCoords();
        }
    }
    
    // CONSTRAINT 2: Product Images must stay inside Product Card (when in deep-select mode)
    if (obj.type === 'image' && obj.group) {
        const parentCard = obj.group;
        
        // Only constrain if parent is a product card
        if (!parentCard.isSmartObject && !parentCard.isProductCard && !isLikelyProductCard(parentCard)) {
            return;
        }
        
        // Get card boundaries in GROUP-LOCAL coordinates (do not use scaled group bounds)
        const base = getCardBaseSize(parentCard);
        const cardW = Number(base?.w ?? parentCard.width ?? 0);
        const cardH = Number(base?.h ?? parentCard.height ?? 0);
        if (!Number.isFinite(cardW) || cardW <= 0 || !Number.isFinite(cardH) || cardH <= 0) return;
        const cardLeft = -cardW / 2;
        const cardTop = -cardH / 2;
        const cardRight = cardW / 2;
        const cardBottom = cardH / 2;
        
        // Get image boundaries in GROUP-LOCAL coordinates
        const imgWidth = Math.abs(Number(obj.width || 0) * Number(obj.scaleX || 1));
        const imgHeight = Math.abs(Number(obj.height || 0) * Number(obj.scaleY || 1));
        if (!Number.isFinite(imgWidth) || imgWidth <= 0 || !Number.isFinite(imgHeight) || imgHeight <= 0) return;
        const imgLeft = obj.left - imgWidth / 2;
        const imgTop = obj.top - imgHeight / 2;
        const imgRight = imgLeft + imgWidth;
        const imgBottom = imgTop + imgHeight;
        
        // Calculate constraints
        let constrainedLeft = obj.left;
        let constrainedTop = obj.top;
        
        // Constrain horizontally
        if (imgLeft < cardLeft) {
            constrainedLeft = cardLeft + imgWidth / 2;
        } else if (imgRight > cardRight) {
            constrainedLeft = cardRight - imgWidth / 2;
        }
        
        // Constrain vertically
        if (imgTop < cardTop) {
            constrainedTop = cardTop + imgHeight / 2;
        } else if (imgBottom > cardBottom) {
            constrainedTop = cardBottom - imgHeight / 2;
        }
        
        // Apply constraints if needed
        if (constrainedLeft !== obj.left || constrainedTop !== obj.top) {
            obj.set({
                left: constrainedLeft,
                top: constrainedTop
            });
            obj.setCoords();
            parentCard.dirty = true;
        }
    }
};

onMounted(async () => {
  // Load collaborators
  await auth.getSession()
  await loadLabelTemplatesFromDb()
  await refreshAiStudioUploads()
  loadCollaborators()
  
  // Initialize Project Store ONLY if it's a new project (default ID)
  // If loading existing project, editor/[id].vue will call loadProjectDB first
  if (!project.id || project.id.startsWith('proj_')) {
    // Don't init yet - wait for loadProjectDB from parent or create new page later
    // initProject() will be called if project remains empty after load attempt
  }

  // Dynamic import to avoid SSR issues
	  try {
	    const fabricModule = await import('fabric');
	    fabric = fabricModule; 

		    // Ensure our custom properties are always serialized/deserialized by Fabric (even if a save path forgets to pass propsToInclude).
		    try {
		        const stickerProps = [
		            '__stickerOutlineEnabled',
		            '__stickerOutlineMode',
		            '__stickerOutlineWidth',
		            '__stickerOutlineColor',
		            '__stickerOutlineOpacity',
		            '__stickerNoTransparency',
		            'crossOrigin'
	        ];
	        const addCustomProps = (Ctor: any, props: string[]) => {
	            if (!Ctor) return;
	            const cur = Array.isArray(Ctor.customProperties) ? Ctor.customProperties : [];
	            Ctor.customProperties = Array.from(new Set([...cur, ...props]));
	        };
	        addCustomProps((fabric as any).FabricObject, stickerProps);
	        addCustomProps((fabric as any).Object, stickerProps);
	        addCustomProps((fabric as any).Image, stickerProps);
	        addCustomProps((fabric as any).FabricImage, stickerProps);
	    } catch (e) {
	        console.warn('⚠️ Falha ao registrar customProperties do Fabric (StickerOutline):', e);
	    }

	    // PATCH: Fabric v7 can call `drawObject(ctx, false, {})` (no cache path),
	    // but `_drawClipPath` assumes a DrawContext with `parentClipPaths` and will crash.
	    // We harden `_drawClipPath` to fill missing context fields.
    try {
        const Base = (fabric as any)?.BaseFabricObject;
        if (Base?.prototype && !(Base.prototype as any).__patchedClipPathContext) {
            const originalDrawClipPath = Base.prototype._drawClipPath;
            Base.prototype._drawClipPath = function (ctx: any, clipPath: any, context: any) {
                const safeCtx = (context && typeof context === 'object') ? context : {};
                if (!Array.isArray(safeCtx.parentClipPaths)) safeCtx.parentClipPaths = [];
                if (typeof safeCtx.cacheTranslationX !== 'number') safeCtx.cacheTranslationX = 0;
                if (typeof safeCtx.cacheTranslationY !== 'number') safeCtx.cacheTranslationY = 0;
                if (typeof safeCtx.zoomX !== 'number') safeCtx.zoomX = 1;
                if (typeof safeCtx.zoomY !== 'number') safeCtx.zoomY = 1;
                // Ensure layer canvas has non-zero dimensions.
                if (typeof safeCtx.width !== 'number' || safeCtx.width <= 0) {
                    const w = (typeof this.getScaledWidth === 'function')
                        ? this.getScaledWidth()
                        : (Number(this.width || 0) * Number(this.scaleX || 1));
                    safeCtx.width = Math.max(1, Math.ceil(Number(w) || 1));
                }
                if (typeof safeCtx.height !== 'number' || safeCtx.height <= 0) {
                    const h = (typeof this.getScaledHeight === 'function')
                        ? this.getScaledHeight()
                        : (Number(this.height || 0) * Number(this.scaleY || 1));
                    safeCtx.height = Math.max(1, Math.ceil(Number(h) || 1));
                }
                return originalDrawClipPath.call(this, ctx, clipPath, safeCtx);
            };
            (Base.prototype as any).__patchedClipPathContext = true;
            console.log('🩹 Fabric patch aplicado: _drawClipPath context hardening');
        }
    } catch (e) {
        console.warn('⚠️ Falha ao aplicar patch do Fabric (_drawClipPath):', e);
    }
    
    if (canvasEl.value && wrapperEl.value) {
      try {
        // Init Infinite Canvas (Full Wrapper Size)
        canvas.value = new fabric.Canvas(canvasEl.value, {
          width: wrapperEl.value.clientWidth,
          height: wrapperEl.value.clientHeight,
          backgroundColor: '#1e1e1e', // Dark Workspace
          preserveObjectStacking: true, 
          renderOnAddRemove: true,
          selection: true,
          // Required for deep-select (sub-target selection inside Fabric groups).
          subTargetCheck: true,
          // CRITICAL: Enable renderOnAddRemove and skipTargetFind to prevent trails
          skipTargetFind: false,
          // Force full render to clear previous positions
          enableRetinaScaling: true,
          // IMPORTANT: Disable clipTo to allow preview lines to extend beyond viewport
          clipTo: undefined,
        });

        // Prevent black-screen render failures by guarding Fabric rendering.
        patchCanvasRenderSafety(canvas.value);

        // PATCH: Improve hit-testing for product cards inside zones.
        // Some interactions (deep select, non-evented children, transparent areas) can make Fabric miss the card and start a group selection rectangle.
        // We wrap `findTarget` to prefer the top-most product card under pointer when Fabric returns null or the zone itself.
        try {
            const c: any = canvas.value as any;
            if (c && !c.__patchedFindTargetProductCards) {
                const originalFindTarget = c.findTarget?.bind(c);
                if (typeof originalFindTarget === 'function') {
                    const isProductCardGroup = (o: any) => {
                        if (!o) return false;
                        if (o.excludeFromExport) return false;
                        if (String(o.type || '').toLowerCase() !== 'group') return false;
                        return !!(o.isSmartObject || o.isProductCard || String(o.name || '').startsWith('product-card') || isLikelyProductCard(o));
                    };
                    c.findTarget = function (evt: any, skipGroup?: boolean) {
                        const info = originalFindTarget(evt, skipGroup) || {};
                        const target = info?.target;
                        const shouldOverride = !target || isLikelyProductZone(target);
                        if (!shouldOverride) return info;

                        const pts: any[] = [];
                        try {
                            if (typeof this.getScenePoint === 'function') {
                                const p0 = this.getScenePoint(evt);
                                if (p0 && typeof p0.x === 'number' && typeof p0.y === 'number') pts.push(p0);
                            }
                        } catch {
                            // ignore
                        }
                        try {
                            if (typeof this.getPointer === 'function') {
                                const p1 = this.getPointer(evt);
                                if (p1 && typeof p1.x === 'number' && typeof p1.y === 'number') pts.push(p1);
                                const vpt = this.viewportTransform;
                                if (p1 && Array.isArray(vpt) && vpt.length >= 6 && (fabric as any)?.util?.invertTransform) {
                                    const inv = (fabric as any).util.invertTransform(vpt);
                                    const p2 = (fabric as any).util.transformPoint(p1, inv);
                                    if (p2 && typeof p2.x === 'number' && typeof p2.y === 'number') pts.push(p2);
                                }
                            }
                        } catch {
                            // ignore
                        }
                        if (!pts.length) return info;

                        const list = (typeof this.getObjects === 'function' ? this.getObjects() : (this._objects || [])).slice().reverse();
                        for (const o of list) {
                            if (!isProductCardGroup(o)) continue;
                            try {
                                const r = o.getBoundingRect(true, true);
                                for (const pt of pts) {
                                    if (pt.x >= r.left && pt.x <= (r.left + r.width) && pt.y >= r.top && pt.y <= (r.top + r.height)) {
                                        return { ...info, target: o };
                                    }
                                }
                            } catch {
                                // ignore
                            }
                        }

                        return info;
                    };
                    c.__patchedFindTargetProductCards = true;
                }
            }
        } catch (e) {
            console.warn('⚠️ Falha ao aplicar patch do Fabric (findTarget product cards):', e);
        }
        
        // Set initial viewport to center
        zoomToFit();
      } catch (error) {
        console.error('Error initializing canvas:', error);
      }

      // Fallback: alguns estados pós-load podem não emitir `mouse:dblclick` do Fabric.
      // Escutamos dblclick no DOM e disparamos manualmente o evento do Fabric.
      try {
          if (!domCanvasDblClickHandler && canvas.value?.upperCanvasEl) {
              domCanvasDblClickHandler = (evt: MouseEvent) => {
                  if (!canvas.value) return;
                  const now = Date.now();
                  if (now - lastDomDblClickAt < 250) return;
                  lastDomDblClickAt = now;

                  const c: any = canvas.value as any;
                  let info: any = null;
                  try {
                      info = (typeof c.findTarget === 'function') ? c.findTarget(evt) : null;
                  } catch (e) {
                      info = null;
                  }
                  const target = info?.target ?? info ?? null;
                  try {
                      c.fire?.('mouse:dblclick', { e: evt, originalEvent: evt, target });
                  } catch (e) {
                      // ignore
                  }
              };
              canvas.value.upperCanvasEl.addEventListener('dblclick', domCanvasDblClickHandler, { passive: true });
          }
      } catch (e) {
          // ignore
      }

      // Initialize Smart Grid
      initProductZone();
      
      // Force workspace to dark
      wrapperEl.value.style.backgroundColor = '#121212';
      
      // --- Frame Labels: update HTML overlay positions on every render ---
      canvas.value.on('after:render', () => {
          throttledUpdateFrameLabels();
      });

      // Update scrollbars on render
      canvas.value.on('after:render', throttledUpdateScrollbars);

      // Resize Window Event - Resize Canvas & Re-center
      window.addEventListener('resize', resizeCanvas);

      // CRITICAL: wrapper size changes (sidebars/panels) do NOT trigger window resize.
      // Observe wrapper and resize Fabric canvas accordingly to avoid large black areas.
      try {
          if (!wrapperResizeObserver && typeof window !== 'undefined' && 'ResizeObserver' in window && wrapperEl.value) {
              let raf = 0;
              wrapperResizeObserver = new ResizeObserver(() => {
                  if (raf) cancelAnimationFrame(raf);
                  raf = requestAnimationFrame(() => {
                      resizeCanvas();
                  });
              });
              wrapperResizeObserver.observe(wrapperEl.value);
          }
      } catch (e) {
          // ignore
      }
      
      // Initial scrollbar update
      updateScrollbars();
      
      // Zoom & Pan
      setupZoomPan();
      
      // Snapping
      setupSnapping();

      // Load Fonts
      loadFonts();

      // Clean up any orphaned control/preview objects on initialization
      cleanupOrphanedObjects();

      // Hook events for Reactivity
      setupReactivity();

      // Hook History
      setupHistory();

      // Alt/Option + Drag duplicate
      setupAltDragDuplicate();
      
      // Global Key Listener
      window.addEventListener('keydown', handleKeyDown);
      
      // ESC key handler for Pen Tool and Node Editing
      const handleEsc = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              if (isPenMode.value) {
                  finishPenPath();
                  setTool('select');
              }
              if (isNodeEditing.value) {
                  exitNodeEditing();
              }
          }
      };
      window.addEventListener('keydown', handleEsc);
      if (!globalMouseUpHandler) {
          globalMouseUpHandler = (evt: MouseEvent) => {
              if (!canvas.value) return;
              const currentTransform = (canvas.value as any)._currentTransform;
              if (!currentTransform) return;
              
              const upEvent = {
                  clientX: evt.clientX,
                  clientY: evt.clientY,
                  type: 'mouseup',
                  target: canvas.value.upperCanvasEl,
                  button: evt.button,
                  buttons: evt.buttons,
                  altKey: evt.altKey,
                  ctrlKey: evt.ctrlKey,
                  metaKey: evt.metaKey,
                  shiftKey: evt.shiftKey
              } as any;
              
              (canvas.value as any)._onMouseUp(upEvent);

              if ((canvas.value as any)._currentTransform) {
                  (canvas.value as any)._currentTransform = null;
                  safeRequestRenderAll();
              }
          };
          window.addEventListener('mouseup', globalMouseUpHandler);
      }

      // Watch for project loaded state before loading canvas data
      // Use watchEffect to automatically re-evaluate when dependencies change
      let stopWatchFn: (() => void) | null = null;
      stopWatchFn = watchEffect(async () => {
          if (!canvas.value) return;

          const loaded = isProjectLoaded.value;
          const pagesLen = project.pages.length;
          const projectId = project.id;
          const page = activePage.value;

          console.log('🔍 WatchEffect trigger:', { loaded, pagesLen, projectId, hasPage: !!page, hasCanvasData: !!page?.canvasData });

          // Only load when project is loaded AND we have a page
          if (loaded && page && pagesLen > 0) {
              // Check if canvas is already loaded to avoid reloading
              const objects = canvas.value.getObjects();
              const alreadyLoaded = objects.length > 0;

              if (alreadyLoaded && page.canvasData) {
                  console.log('⏭️ Canvas já carregado, parando watch');
                  if (stopWatchFn) stopWatchFn();
                  return;
              }

              isHistoryProcessing.value = true;

              try {
                  // Declarar degradedPage no escopo do try para estar disponível em todo o bloco
                  let degradedPage = false;
                  
                  if (page.canvasData) {
                      // Validar que canvasData não está vazio ou inválido
                      const isValidCanvasData = page.canvasData && 
                          typeof page.canvasData === 'object' && 
                          (page.canvasData.objects || page.canvasData.version);
                      
                      if (!isValidCanvasData) {
                          console.error('❌ CanvasData inválido ou vazio para página:', page.id);
                          console.error('   CanvasData:', page.canvasData);
                          isHistoryProcessing.value = false;
                          return;
                      }
                      
                      const objectCount = page.canvasData?.objects?.length || 0;
                      console.log(`📥 Carregando canvasData da página ${page.id}: ${objectCount} objeto(s)`);
                      
                      if (objectCount === 0) {
                          // Página nova/vazia — canvas válido sem objetos, continua normalmente
                      }
                      
                      // CRITICAL: Ensure canvas is fully initialized before loading
                      if (!canvas.value) {
                          console.warn('⚠️ Canvas não inicializado, aguardando...');
                          await new Promise(resolve => setTimeout(resolve, 100));
                      }
                      
                      // Double-check canvas has context before loading
                      if (!canvas.value || !canvas.value.getContext) {
                          console.error('❌ Canvas não está inicializado com contexto');
                          isHistoryProcessing.value = false;
                          return;
                      }
                      
                      const savedVpt = getSavedViewportTransform(page.canvasData);
                      // Restore label templates stored alongside the Fabric JSON
                      hydrateLabelTemplatesFromProjectJson(page.canvasData);
                      
                      // Log antes de carregar
                      const expectedObjects = page.canvasData?.objects?.length || 0;
                      console.log(`📥 Preparando para carregar ${expectedObjects} objeto(s) do canvasData`);
                      
                      // Pre-process images to use local proxy for Contabo images
                      // This avoids presigned URL issues with encoding and expiration
                      let canvasDataToLoad = JSON.parse(JSON.stringify(page.canvasData));
                      // Blob URLs do not survive reload; replace early to avoid loadFromJSON errors.
                      canvasDataToLoad = replaceBlobImagesWithPlaceholder(canvasDataToLoad);
                      // Convert Contabo URLs to use local proxy (bypasses presigned URL issues)
                      canvasDataToLoad = convertContaboToProxyUrls(canvasDataToLoad);
                      
                      // DEBUG: Log all objects being loaded with order
                      console.log(`📦 CanvasData carregado - ${canvasDataToLoad?.objects?.length || 0} objeto(s):`);
                      console.log(`📋 Ordem dos objetos NO JSON ao carregar:`, canvasDataToLoad.objects?.map((o: any, i: number) => `[${i}] ${o.type} - ${o.name || o.layerName || o._customId} (isFrame=${o.isFrame})`));
                      
                      let didLoadPage = false;
                      try {
                          // CRITICAL: Wrap loadFromJSON in a try-catch that handles image errors gracefully
                          // If an image fails to load, we'll catch the error and continue with other objects
                          try {
                              await canvas.value.loadFromJSON(canvasDataToLoad);
                              didLoadPage = true;
                          } catch (imageLoadErr: any) {
                              // Image load error - since we're using proxy, this shouldn't happen often
                              // but if it does, log it and try to continue
                              console.warn('⚠️ Erro ao carregar canvas:', imageLoadErr);
                              
                              // Try again with failed images replaced by placeholders
                              const safeCanvasData = replaceContaboImagesWithPlaceholder(canvasDataToLoad);
                              await canvas.value.loadFromJSON(safeCanvasData);
                              didLoadPage = true;
                              degradedPage = true;
                          }
                          
                          // Verificar quantos objetos foram carregados
                          const loadedObjects = canvas.value.getObjects();
                          const loadedCount = loadedObjects.length;
                          const imageCount = loadedObjects.filter((o: any) => (o.type || '').toLowerCase() === 'image').length;
                          console.log(`✅ loadFromJSON concluído: ${loadedCount} objeto(s) carregado(s) (esperado: ${expectedObjects}), ${imageCount} imagem(ns)`);
                          
                          // CRITICAL: Sanitize groups to remove invalid objects
                          let removedInvalidObjects = 0;
                          loadedObjects.forEach((obj: any) => {
                              if (obj.type === 'group' && typeof obj.getObjects === 'function') {
                                  const children = obj.getObjects();
                                  const validChildren = children.filter((child: any) => {
                                      const isValid = child && typeof child === 'object' && typeof child.setCoords === 'function';
                                      if (!isValid) {
                                          console.error('❌ Objeto inválido removido do grupo:', {
                                              groupId: obj._customId || obj.name,
                                              childType: typeof child,
                                              childValue: child
                                          });
                                          removedInvalidObjects++;
                                      }
                                      return isValid;
                                  });
                                  
                                  if (validChildren.length !== children.length) {
                                      // Rebuild group with valid children only
                                      const internal = (obj as any)._objects;
                                      if (Array.isArray(internal)) {
                                          internal.length = 0;
                                          validChildren.forEach((c: any) => internal.push(c));
                                      }
                                  }
                              }
                          });
                          
                          if (removedInvalidObjects > 0) {
                              console.warn(`⚠️ Removidos ${removedInvalidObjects} objetos inválidos de grupos durante sanitização`);
                          }
                          // Log image loading status
                          const expectedImages = (canvasDataToLoad.objects || []).filter((o: any) => (o.type || '').toLowerCase() === 'image').length;
                          if (expectedImages > 0) {
                              console.log(`✅ ${imageCount}/${expectedImages} imagem(ns) carregada(s)`);
                          }
                          
                          if (loadedCount === 0 && expectedObjects > 0) {
                              console.error(`❌ PROBLEMA CRÍTICO: CanvasData tinha ${expectedObjects} objetos mas nenhum foi carregado!`);
                              console.error('   CanvasData preview:', JSON.stringify(page.canvasData).substring(0, 500));
                          } else if (loadedCount !== expectedObjects) {
                              console.warn(`⚠️ Discrepância: esperado ${expectedObjects} objetos, mas ${loadedCount} foram carregados`);
                          }
                      } catch (loadErr) {
                          console.error('❌ Erro ao carregar JSON no canvas:', loadErr);
                          // Try with placeholders as fallback
                          if (canvas.value) {
                              try {
                                  const dataWithPlaceholders = replaceContaboImagesWithPlaceholder(canvasDataToLoad);
                                  await canvas.value.loadFromJSON(dataWithPlaceholders);
                                  didLoadPage = true;
                                  degradedPage = true;
                                  console.log('✅ loadFromJSON concluído com placeholders');
                              } catch (placeholderErr) {
                                  console.error('❌ Erro final ao carregar:', placeholderErr);
                                  throw placeholderErr;
                              }
                          } else {
                              throw loadErr;
                          }
                      }
                      // If we couldn't load, bail out BEFORE saving anything (prevents wiping server JSON).
                      if (!didLoadPage) {
                          isHistoryProcessing.value = false;
                          return;
                      }
                      
                      // Remove old frame label text objects (if any were saved)
                      // IMPORTANT: Preserve order by removing from end
                      const objects = canvas.value.getObjects();
                      const labelsToRemove: any[] = [];
                      // Iterate in reverse to mark for removal from end
                      for (let i = objects.length - 1; i >= 0; i--) {
                          const obj = objects[i];
                          if (obj.isFrameLabel || (obj.type === 'text' && obj.text && obj.text.includes('@') && obj.text.includes('dpi'))) {
                              labelsToRemove.push(obj);
                          }
                      }
                      // Remove from end to preserve order
                      labelsToRemove.forEach((obj: any) => {
                          try {
                              canvas.value.remove(obj);
                          } catch (e) {
                              // Ignore errors
                          }
                      });
                      
                      // CRITICAL: Remove any duplicate objects BEFORE rehydration
                      // IMPORTANT: Preserve order by removing duplicates from the END of the array
                      // This ensures the first occurrence (correct order) is kept
                      const allObjsBefore = canvas.value.getObjects();
                      const seenIds = new Set<string>();
                      const duplicates: any[] = [];
                      // Iterate in reverse to remove duplicates from the end, preserving order
                      for (let i = allObjsBefore.length - 1; i >= 0; i--) {
                          const obj = allObjsBefore[i];
                          const id = obj._customId || obj.id;
                          if (id && seenIds.has(id)) {
                              duplicates.push(obj);
                          } else if (id) {
                              seenIds.add(id);
                          }
                      }
                      if (duplicates.length > 0) {
                          console.warn(`⚠️ Removendo ${duplicates.length} objeto(s) duplicado(s) após loadFromJSON`);
                          // Remove duplicates without affecting order of remaining objects
                          duplicates.forEach(dup => canvas.value.remove(dup));
                      }
                      
                      // NOTE: Removed problematic code that was deleting frames with blue stroke
                      // before rehydrateCanvasZones could restore their isFrame flag.
                      // This was causing frames to be removed and re-added at the end, changing layer order.
                      // The rehydrateCanvasZones function below will properly restore isFrame flags.
                      
                      // CRITICAL: Clear all deserialized clipPaths before rehydrate
                      // This prevents stale/incorrect clips from persisting
                      const objsBeforeRehydrate = canvas.value.getObjects();
                      objsBeforeRehydrate.forEach((obj: any) => {
                          // Clear any clipPath that was deserialized from JSON
                          // rehydrateCanvasZones will recreate them correctly based on parentFrameId
                          if (obj.clipPath && !obj.isFrame) {
                              obj.clipPath = null;
                              delete obj._frameClipOwner;
                          }
                      });
                      
                       // CRITICAL: Rehydrate zones AND frames to restore isFrame flags and normalize names
                      rehydrateCanvasZones();
                      
                      // CRITICAL FIX: Restore lost object names in product cards after JSON load
                      // When canvas is loaded from JSON, nested object names inside groups are lost
                      const restoreProductCardNames = () => {
                          if (!canvas.value) return;
                          
                          canvas.value.getObjects().forEach((obj: any) => {
                              // Check if this is a product card
                              if (obj.type === 'group' && (obj.isProductCard || obj.isSmartObject || isLikelyProductCard(obj))) {
                                  if (typeof obj.getObjects !== 'function') return;
                                  
                                  const children = obj.getObjects();
                                  
                                  // Find price group inside the card
                                  const priceGroup = children.find((child: any) => 
                                      child.type === 'group' && (
                                          child.name === 'priceGroup' || 
                                          child.name === 'smart_price' ||
                                          child.name === 'smart_splash'
                                      )
                                  );
                                  
                                  if (priceGroup && typeof priceGroup.getObjects === 'function') {
                                      const priceChildren = priceGroup.getObjects();
                                      
                                      // Heuristic: identify elements by type and assign names
                                      priceChildren.forEach((child: any) => {
                                          if (child.name) return; // Already has a name
                                          
                                          // Try to identify by type and properties
                                          if (child.type === 'rect') {
                                              // The largest rect is likely price_bg
                                              const isLargest = !priceChildren.some((other: any) => 
                                                  other !== child && 
                                                  other.type === 'rect' && 
                                                  (other.width * other.height) > (child.width * child.height)
                                              );
                                              if (isLargest) {
                                                  child.set('name', 'price_bg');
                                                  console.log('[restoreProductCardNames] Assigned name: price_bg');
                                              }
                                          } else if (child.type === 'circle') {
                                              child.set('name', 'price_currency_bg');
                                              console.log('[restoreProductCardNames] Assigned name: price_currency_bg');
                                          } else if (child.type && child.type.includes('text')) {
                                              const text = String(child.text || '').trim();
                                              if (text === 'R$' || text.includes('R$')) {
                                                  child.set('name', 'price_currency_text');
                                                  console.log('[restoreProductCardNames] Assigned name: price_currency_text');
                                              } else if (/^\d+$/.test(text.replace(',', ''))) {
                                                  // Integer part of price
                                                  const hasInteger = priceChildren.some((other: any) => 
                                                      other !== child && other.name === 'price_integer_text'
                                                  );
                                                  if (!hasInteger) {
                                                      child.set('name', 'price_integer_text');
                                                      console.log('[restoreProductCardNames] Assigned name: price_integer_text');
                                                  } else {
                                                      child.set('name', 'price_decimal_text');
                                                      console.log('[restoreProductCardNames] Assigned name: price_decimal_text');
                                                  }
                                              } else {
                                                  child.set('name', 'price_unit_text');
                                                  console.log('[restoreProductCardNames] Assigned name: price_unit_text');
                                              }
                                          }
                                      });
                                      
                                      // Also fix other card children
                                      children.forEach((child: any) => {
                                          if (child.name) return;
                                          
                                          if (child.type === 'rect' && child.width > child.height * 0.8) {
                                              // Likely offer background
                                              child.set('name', 'offerBackground');
                                              console.log('[restoreProductCardNames] Assigned name: offerBackground');
                                          } else if (child.type && child.type.includes('text')) {
                                              const text = String(child.text || '').trim().toLowerCase();
                                              if (text.includes('kg') || text.includes('ml') || text.includes('un')) {
                                                  child.set('name', 'smart_limit');
                                                  console.log('[restoreProductCardNames] Assigned name: smart_limit');
                                              } else {
                                                  child.set('name', 'smart_title');
                                                  console.log('[restoreProductCardNames] Assigned name: smart_title');
                                              }
                                          } else if (child.type === 'image') {
                                              child.set('name', 'smart_image');
                                              console.log('[restoreProductCardNames] Assigned name: smart_image');
                                          }
                                      });
                                  }
                              }
                          });
                      };
                      
                      restoreProductCardNames();
                      
                      // DEBUG: Log objects after rehydrate
                      const objsAfterRehydrate = canvas.value.getObjects();
                      console.log('📦 Objetos APÓS rehydrateCanvasZones:', objsAfterRehydrate.map((o: any, i: number) => `[${i}] ${o.type} - ${o.name || o.layerName || o._customId} (isFrame=${o.isFrame})`));
                      
                      // CRITICAL: After rehydrate, ensure all frames have layerName and isFrame
                      const allObjs = canvas.value.getObjects();
                      let framesFixed = 0;
                      allObjs.forEach((obj: any) => {
                          // Detect frame-like objects that might have lost isFrame flag
                          const isFrameLike = obj?.isFrame || 
                              (obj?.type === 'rect' && 
                               (obj?.clipContent === true || obj?.clipContent === 1) && 
                               String(obj?.stroke || '').toLowerCase() === '#0d99ff');
                          
                          if (isFrameLike) {
                              obj.isFrame = true;
                              if (!obj.layerName) {
                                  obj.layerName = 'FRAMER';
                                  framesFixed++;
                                  console.log(`🔄 Frame restaurado após loadFromJSON:`, {
                                      name: obj.name,
                                      hadIsFrame: !!obj.isFrame,
                                      hadLayerName: false,
                                      fixed: true
                                  });
                              } else {
                                  console.log(`✅ Frame já tinha layerName:`, {
                                      name: obj.name,
                                      layerName: obj.layerName
                                  });
                              }
                              // Ensure stroke is correct
                              if (!obj.stroke || String(obj.stroke).toLowerCase() !== '#0d99ff') {
                                  obj.stroke = '#0d99ff';
                              }
                          }
                      });
                      
                      if (framesFixed > 0 && !degradedPage) {
                          console.log(`✅ ${framesFixed} frame(s) corrigido(s) após carregar`);
                          // Re-save immediately to persist the fixes
                          saveCurrentState();
                      }
                      
                      // CRITICAL: Remove any artboard-bg that might have been incorrectly created from a Frame
                      // IMPORTANT: Find and remove without affecting order of other objects
                      const artboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
                      if (artboard && (artboard.isFrame || artboard.clipContent || artboard.selectable)) {
                          console.warn('⚠️ Removendo artboard-bg incorreto (era um Frame)');
                          // Remove without affecting order (artboard is usually at the end)
                          try {
                              canvas.value.remove(artboard);
                          } catch (e) {
                              // Ignore errors
                          }
                      }
                      
                      // CRITICAL: Clean up any orphaned control objects that might have been saved
                      // Cleanup is done inline here since cleanupOrphanedObjects may not be defined yet
                      // IMPORTANT: Remove from end to preserve order of valid objects
                      const allObjsForCleanup = canvas.value.getObjects();
                      const orphanedToRemove: any[] = [];
                      // Iterate in reverse to remove from end, preserving order
                      for (let i = allObjsForCleanup.length - 1; i >= 0; i--) {
                          const o = allObjsForCleanup[i];
                          const name = o.name || '';
                          if (name === 'control_point' || name === 'path_node' || name === 'bezier_handle' || name === 'handle_line') {
                              orphanedToRemove.push(o);
                          } else if (o.excludeFromExport) {
                              orphanedToRemove.push(o);
                          } else if (o.type === 'circle' && o.radius && o.radius <= 7 && !o._customId) {
                              orphanedToRemove.push(o);
                          } else if (o.type === 'circle' && o.data && (o.data.parentPath || o.data.parentObj)) {
                              orphanedToRemove.push(o);
                          } else if (o.type === 'line' && !o._customId) {
                              orphanedToRemove.push(o);
                          }
                      }
                      if (orphanedToRemove.length > 0) {
                          console.log(`🧹 Limpando ${orphanedToRemove.length} objeto(s) órfão(ões) após carregar`);
                          // Remove from end to preserve order
                          orphanedToRemove.forEach((obj: any) => {
                              try { canvas.value.remove(obj); } catch (e) {}
                          });
                      }
                      
                      // 🔒 APPLY CONTAINMENT CONSTRAINTS ON LOAD
                      // Ensure product cards stay in zones and images stay in cards
                      console.log('🔒 Aplicando constraints de contenção...');
                      const allLoadedObjects = canvas.value.getObjects();
                      allLoadedObjects.forEach((obj: any) => {
                          applyContainmentConstraints(obj);
                      });
                      
                      // CRITICAL: Preserve exact order from JSON - don't reorder objects
                      // Force update canvasObjects to reflect restored state (order preserved from loadFromJSON)
                      // IMPORTANT: Get objects in exact order they were loaded (Fabric preserves order in _objects array)
                      const loadedObjs = canvas.value.getObjects();
                      canvasObjects.value = [...loadedObjs];
                      
                      // Ensure objects have IDs restored if missing - BUT exclude frames
                      const objs = canvas.value.getObjects();
                      console.log('📦 Objetos APÓS loadFromJSON:', objs.map((o: any, i: number) => `[${i}] ${o.type} - ${o.name || o.layerName || o._customId} (isFrame=${o.isFrame})`));
                      objs.forEach((o: any) => {
                          // CRITICAL: Don't mark frames as artboard! Only mark non-selectable, non-frame rects
                          if (o.type === 'rect' && !o.selectable && !o.id && !o.isFrame && !o.clipContent) {
                              o.set('id', 'artboard-bg');
                              console.log('✅ Artboard ID restaurado para retângulo não-Frame');
                          }
                      });

                      safeRequestRenderAll();

                      // Restore last viewport (pan/zoom) if present; otherwise fit.
                      if (savedVpt) {
                          applyViewportTransform(savedVpt);
                      } else {
                          zoomToFit();
                      }
                  } else {
                      console.log('⚠️ Página sem canvasData, criando canvas vazio');
                  }

                  // Ensure Artboard is there
                  updateArtboard();
                  canvasObjects.value = [...canvas.value.getObjects()];
                  isHistoryProcessing.value = false;
                  historyStack.value = [];
                  historyIndex.value = -1;
                  // Important: DO NOT auto-save after a degraded load (missing images),
                  // otherwise we overwrite the stored JSON with placeholders/empty state.
                  if (!degradedPage) {
                      // Allow overwriting to persist migrations/cleanups (e.g. removing legacy artboard-bg),
                      // even if the resulting canvas ends up empty.
                      saveCurrentState({ allowEmptyOverwrite: true, reason: 'post-load-cleanup' });
                  } else {
                      console.warn('⚠️ Carregamento degradado (imagens com erro). Pulando auto-save para não sobrescrever o projeto.');
                  }

                      // Stop watching after successful load
                      console.log('✅ Carregamento concluído, parando watch');
                  if (stopWatchFn) stopWatchFn();
              } catch (err) {
                  console.error('❌ Error loading canvas data:', err);
                  isHistoryProcessing.value = false;
              }
          } else {
              console.log('⏳ Aguardando projeto carregar...', { loaded, pagesLen, hasPage: !!page });
          }
      });

    }
  } catch (e) {
    console.error("Failed to load fabric.js", e);
  }
})
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleKeyDown);
    if (wrapperResizeObserver) {
        try {
            wrapperResizeObserver.disconnect();
        } catch (e) {
            // ignore
        }
        wrapperResizeObserver = null;
    }
  // ESC handler cleanup is handled by Vue's cleanup
    if (domCanvasDblClickHandler && canvas.value?.upperCanvasEl) {
        try {
            canvas.value.upperCanvasEl.removeEventListener('dblclick', domCanvasDblClickHandler as any);
        } catch (e) {
            // ignore
        }
        domCanvasDblClickHandler = null;
    }
  if (globalMouseUpHandler) {
    window.removeEventListener('mouseup', globalMouseUpHandler);
    globalMouseUpHandler = null;
  }
  if (canvas.value) {
    canvas.value.dispose();
  }
})

// --- History & Keyboard ---
// Ensure function is hoisted or accessible for updateObjectProperty
type SaveStateOptions = {
    allowEmptyOverwrite?: boolean;
    reason?: string;
};

let saveCurrentState: (opts?: SaveStateOptions) => void | Promise<void> = () => {}; 

// Persist/restore Fabric viewport (pan/zoom) inside the stored canvas JSON.
// Fabric's `toJSON()` does NOT include viewportTransform by default.
const CANVAS_VIEWPORT_JSON_KEY = '__canvasViewport';
const getSavedViewportTransform = (data: any): number[] | null => {
    const viewportData = data?.[CANVAS_VIEWPORT_JSON_KEY];

    const vpt = viewportData?.vpt;
    if (!Array.isArray(vpt) || vpt.length < 6) return null;
    // Ensure all are finite numbers
    for (let i = 0; i < 6; i++) {
        const n = Number(vpt[i]);
        if (!Number.isFinite(n)) return null;
    }
    return vpt.slice(0, 6).map((n: any) => Number(n));
};
const applyViewportTransform = (vpt: number[]) => {
    if (!canvas.value) return;
    canvas.value.setViewportTransform([...vpt]);
    updateZoomState();
    updateScrollbars();
    canvas.value.requestRenderAll();
};

const CANVAS_CUSTOM_PROPS = [
    // Identity / selection
    'id',
    '_customId',
    'name',
    'layerName',
    'excludeFromExport',

    // Frames
    'isFrame',
    'clipContent',
    'parentFrameId',
    '_frameClipOwner',

    // Grid cells (Canva-style grids = multiple frames linked by gridGroupId)
    'isGridCell',
    'gridGroupId',
    'gridCol',
    'gridRow',

    // Smart objects / cards
    'isSmartObject',
    'isProductCard',
    'smartGridId',
    'parentZoneId',
    '_zoneOrder',
    '_cardWidth',
    '_cardHeight',
    'subTargetCheck',
    'interactive',
    // When true on a child object, prevents auto-layout from overriding user placement (persisted).
    '__manualTransform',
    '__manualTransformCardW',
    '__manualTransformCardH',

    // Product zone metadata
    'isGridZone',
    'isProductZone',
    '_zoneWidth',
    '_zoneHeight',
    '_zonePadding',
    '_zoneGlobalStyles',
    'backgroundColor', // Zone background color
    'gapHorizontal',
    'gapVertical',
    'columns',
    'rows',
    'cardAspectRatio',
    'lastRowBehavior',
    'layoutDirection',
    'verticalAlign',
    'highlightCount',
    'highlightPos',
    'highlightHeight',

    // Price mode engine
    'priceMode',
    'priceFrom',
    'priceClub',
    'priceWholesale',
    'wholesaleTrigger',
    'wholesaleTriggerUnit',
    'packQuantity',
    'packUnit',
    'packageLabel',

    // Shape utilities (Figma-like)
    '__fillEnabled',
    '__fillBackup',
    '__strokeEnabled',
    '__strokeBackup',
    '__strokeWidthBackup',
    '__strokeDashBackup',
    'cornerRadii',
    
    // Vector Path properties
    'isVectorPath',
    'penPathData',
    'strokePosition',
    'strokeMiterLimit',

		// Sticker Outline (alpha-based contour)
		'__stickerOutlineEnabled',
		'__stickerOutlineMode',
		'__stickerOutlineWidth',
		'__stickerOutlineColor',
		'__stickerOutlineOpacity',
		'__stickerNoTransparency',

	// Images: ensure CORS behavior survives reload (needed for pixel-based effects like Sticker Outline)
	'crossOrigin',

    // Locks (persist cadeado state across reload)
    'lockMovementX',
    'lockMovementY',
    'lockScalingX',
    'lockScalingY',
    'lockRotation',
    'lockScalingFlip'
] as const;

// Helper function to extract key/path from Wasabi URL (presigned or permanent)
const extractWasabiKey = (url: string): string | null => {
    try {
        // CRITICAL: Decode URL first to handle encoded characters
        const decodedUrl = decodeURIComponent(url);
        const urlObj = new URL(decodedUrl);

        // Formatos Wasabi:
        // - Path-style: https://s3.wasabisys.com/bucket/key...
        //
        // OBS: a "key" é SEMPRE o caminho completo do objeto no bucket (ex.: projects/{userId}/...)

        // Decode pathname as well to handle any encoded characters
        const decodedPathname = decodeURIComponent(urlObj.pathname);
        const pathParts = decodedPathname.split('/').filter(p => p);
        console.log(`🔍 extractWasabiKey - URL: ${url.substring(0, 100)}...`);
        console.log(`   decodedUrl: ${decodedUrl.substring(0, 100)}...`);
        console.log(`   pathname: ${decodedPathname}`);
        console.log(`   pathParts: [${pathParts.join(', ')}]`);

        if (pathParts.length === 0) {
            console.warn(`⚠️ Não foi possível extrair chave da URL (path vazio): ${url.substring(0, 100)}`);
            return null;
        }

        const cfg = useRuntimeConfig()?.public?.wasabi || {};
        const configuredBucket = (cfg.bucket || 'jobvarejo').toString();

        console.log(`   configuredBucket: ${configuredBucket}`);

        const hostname = (urlObj.hostname || '').toLowerCase();
        const first = pathParts[0] ?? '';
        // Check if first part is bucket
        const firstLooksLikeBucket = first === configuredBucket || first.includes(':');
        const hostLooksLikeVirtualHost = hostname.includes(`${configuredBucket.toLowerCase()}.`);

        console.log(`   first: ${first}`);
        console.log(`   firstLooksLikeBucket: ${firstLooksLikeBucket}`);
        console.log(`   hostLooksLikeVirtualHost: ${hostLooksLikeVirtualHost}`);

        // Path-style: primeira parte do path é bucket → remover
        // Virtual-host: host já contém bucket → NÃO remover nada do path
        const keyParts = (firstLooksLikeBucket && !hostLooksLikeVirtualHost) ? pathParts.slice(1) : pathParts;
        const key = keyParts.join('/');

        console.log(`   keyParts: [${keyParts.join(', ')}]`);
        console.log(`   key extraída: ${key}`);

        if (!key || key.length === 0) {
            console.warn(`⚠️ Chave extraída está vazia da URL: ${url.substring(0, 100)}`);
            return null;
        }
        return key;
    } catch (err) {
        console.error(`❌ Erro ao extrair chave da URL: ${url.substring(0, 100)}`, err);
        return null;
    }
};

// Helper function to convert presigned URL to permanent URL (Wasabi)
const convertPresignedToPermanentUrl = (url: string): string => {
    // If it's not a Wasabi URL, return as-is
    if (!url.includes('wasabisys.com')) {
        return url;
    }

    // If it's already a permanent URL (no query params), return as-is
    try {
        const urlObj = new URL(url);
        if (!urlObj.search) {
            console.log(`🔗 URL já é permanente (sem query params): ${url.substring(0, 80)}...`);
            return url;
        }

        // Extract key from presigned URL
        const key = extractWasabiKey(url);
        if (!key) {
            console.warn(`⚠️ Não foi possível extrair key da URL presignada: ${url.substring(0, 100)}`);
            return url; // Can't extract key, return original
        }

        // Build permanent URL for Wasabi
        const config = useRuntimeConfig().public?.wasabi || {};
        const endpoint = config.endpoint || 's3.wasabisys.com';
        const bucket = config.bucket || 'jobvarejo';
        const permanentUrl = `https://${endpoint}/${bucket}/${key}`;
        console.log(`🔄 Convertendo presigned → permanent (Wasabi):`);
        console.log(`   De: ${url.substring(0, 100)}...`);
        console.log(`   Para: ${permanentUrl.substring(0, 100)}...`);
        console.log(`   Key extraída: ${key}`);
        return permanentUrl;
    } catch (err) {
        console.error(`❌ Erro ao converter URL presignada para permanente:`, err);
        return url; // Error parsing, return original
    }
};

// Helper function to generate new presigned URL from permanent URL or key
const generatePresignedUrl = async (urlOrKey: string): Promise<string | null> => {
    try {
        // If it's already a presigned URL, extract key and generate new one
        let key: string | null = null;
        
        console.log(`🔑 generatePresignedUrl chamada com: ${urlOrKey.substring(0, 100)}...`);

        if (urlOrKey.includes('wasabisys.com')) {
            key = extractWasabiKey(urlOrKey);
            console.log(`   Key extraída da URL Wasabi: ${key || '(null)'}`);
        } else {
            // Assume it's already a key
            key = urlOrKey;
            console.log(`   Usando como key diretamente: ${key}`);
        }
        
        if (!key) {
            console.error(`❌ Não foi possível obter key para gerar URL presignada`);
            return null;
        }
        
        // Request new presigned URL from backend
        console.log(`📤 Requisitando presigned URL do backend para key: ${key}`);
        const data = await $fetch<{ url?: string }>('/api/storage/presigned', {
            method: 'POST',
            body: { key, contentType: 'image/*', operation: 'get' }
        });
        
        if (data?.url) {
            console.log(`✅ Presigned URL gerada com sucesso: ${data.url.substring(0, 100)}...`);
        } else {
            console.error(`❌ Backend retornou resposta sem URL:`, data);
        }
        
        return data?.url || null;
    } catch (error) {
        console.error('❌ Erro ao gerar URL presignada:', error);
        return null;
    }
};

// 1x1 transparent PNG data URL - usado quando imagem falha para permitir carregar o resto do canvas
const PLACEHOLDER_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Decodifica URLs da Contabo que têm %3A (colon codificado) no bucket name.
 * A Contabo retorna erro 500 quando o bucket name tem %3A em vez de :.
 * Formato: https://endpoint/tenant%3Abucket/key -> https://endpoint/tenant:bucket/key
 */
const decodeContaboUrls = (canvasData: any): any => {
    const cloned = JSON.parse(JSON.stringify(canvasData));
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned;

    let count = 0;
    const processObject = (obj: any): void => {
        if (!obj) return;
        const objType = (obj.type || '').toLowerCase();
        if (objType === 'image' && typeof obj.src === 'string' && obj.src.includes('contabostorage.com')) {
            // Check if URL has encoded colon in bucket name
            if (obj.src.includes('%3A')) {
                try {
                    const urlObj = new URL(obj.src);
                    // Decode only the pathname (bucket/key), not query params
                    urlObj.pathname = decodeURIComponent(urlObj.pathname);
                    obj.src = urlObj.toString();
                    count++;
                } catch (e) {
                    // Fallback: simple replace for the bucket portion only
                    // Match pattern: /tenant%3Abucket/ and decode it
                    obj.src = obj.src.replace(/\/([^\/]+)%3A([^\/]+)\//, (match: string, tenant: string, bucket: string) => {
                        return `/${tenant}:${bucket}/`;
                    });
                    count++;
                }
            }
        }
        if (obj.objects && Array.isArray(obj.objects)) {
            obj.objects.forEach((child: any) => processObject(child));
        }
    };

    cloned.objects.forEach((obj: any) => processObject(obj));
    if (count > 0) console.log(`🔧 Decodificado ${count} URL(s) da Contabo (%3A -> :)`);
    return cloned;
};

/**
 * Extrai bucket e key de uma URL da Contabo.
 */
const extractContaboBucketAndKey = (url: string): { bucket: string | null; key: string | null } => {
    try {
        const decodedUrl = decodeURIComponent(url);
        const urlObj = new URL(decodedUrl);
        const decodedPathname = decodeURIComponent(urlObj.pathname);
        const pathParts = decodedPathname.split('/').filter(p => p);

        if (pathParts.length === 0) {
            return { bucket: null, key: null };
        }

        const cfg = (useRuntimeConfig()?.public?.contabo as any) || {};
        const configuredBucket = (cfg.bucket || '475a29e42e55430abff00915da2fa4bc:jobupload').toString();
        const candidates = new Set<string>();
        if (configuredBucket) candidates.add(configuredBucket);

        const first = pathParts[0] ?? '';
        // Check if first part is bucket (may have : or match configured buckets)
        const firstLooksLikeBucket = first.includes(':') || candidates.has(first);
        const hostLooksLikeVirtualHost = [...candidates].some(b => b && urlObj.hostname.startsWith(`${b.toLowerCase()}.`));

        // Path-style: primeira parte do path é bucket/tenant:bucket → extrair bucket
        // Virtual-host: host já contém bucket → usar bucket configurado
        let bucket: string | null = null;
        let keyParts: string[];

        if (firstLooksLikeBucket && !hostLooksLikeVirtualHost) {
            bucket = first;
            keyParts = pathParts.slice(1);
        } else if (hostLooksLikeVirtualHost) {
            // Extrair bucket do hostname (virtual-host style)
            const hostParts = urlObj.hostname.split('.');
            bucket = hostParts[0] || null;
            keyParts = pathParts;
        } else {
            // Usar bucket padrão
            bucket = null; // Deixa o proxy usar o padrão
            keyParts = pathParts;
        }

        const key = keyParts.join('/');

        if (!key || key.length === 0) {
            return { bucket: null, key: null };
        }

        return { bucket, key };
    } catch (err) {
        console.error(`❌ Erro ao extrair bucket e key da URL: ${url.substring(0, 100)}`, err);
        return { bucket: null, key: null };
    }
};

/**
 * Extrai bucket e key de uma URL do Wasabi S3.
 * Formato esperado: https://s3.wasabisys.com/bucket/key...
 */
const extractWasabiBucketAndKey = (url: string): { bucket: string | null; key: string | null } => {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);

        if (pathParts.length === 0) {
            return { bucket: null, key: null };
        }

        // Wasabi path-style: /bucket/key...
        const bucket = pathParts[0] || null;
        const key = pathParts.slice(1).join('/');

        if (!key || key.length === 0) {
            return { bucket: null, key: null };
        }

        return { bucket, key };
    } catch (err) {
        console.error(`❌ Erro ao extrair bucket e key da URL Wasabi: ${url.substring(0, 100)}`, err);
        return { bucket: null, key: null };
    }
};

/**
 * Converte URLs da Contabo/Wasabi para usar o proxy local.
 * Isso evita problemas com URLs presignadas, encoding de caracteres especiais e CORS.
 * O proxy busca a imagem diretamente do S3 no backend, sem problemas de assinatura.
 */
const convertContaboToProxyUrls = (canvasData: any): any => {
    const cloned = JSON.parse(JSON.stringify(canvasData));
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned;

    let contaboCount = 0;
    let wasabiCount = 0;
    const processObject = (obj: any): void => {
        if (!obj) return;
        const objType = (obj.type || '').toLowerCase();
        if (objType === 'image' && typeof obj.src === 'string') {
            // Default crossOrigin for reliable pixel operations (Sticker Outline uses getImageData).
            // Even when using same-origin proxy URLs, keeping this consistent avoids edge cases.
            if (!obj.crossOrigin) obj.crossOrigin = 'anonymous';
            const src = obj.src;

            // Converter URLs do Wasabi (bucket privado)
            const cfg = useRuntimeConfig()?.public?.wasabi || {};
            const endpoint = (cfg.endpoint || 's3.wasabisys.com').toString();
            const isWasabi = src.includes('wasabisys.com') || (endpoint && src.includes(endpoint));
            if (isWasabi) {
                // Use robust key extraction that supports both path-style and virtual-host style URLs.
                const key = extractWasabiKey(src);
                if (key) {
                    obj.src = `/api/storage/proxy?key=${encodeURIComponent(key)}`;
                    wasabiCount++;
                }
            }
            // Converter URLs da Contabo
            else if (src.includes('contabostorage.com')) {
                const { bucket, key } = extractContaboBucketAndKey(src);
                if (key) {
                    // Convert to proxy URL with bucket parameter
                    if (bucket) {
                        obj.src = `/api/storage/proxy?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`;
                    } else {
                        obj.src = `/api/storage/proxy?key=${encodeURIComponent(key)}`;
                    }
                    contaboCount++;
                }
            }
        }
        if (obj.objects && Array.isArray(obj.objects)) {
            obj.objects.forEach((child: any) => processObject(child));
        }
    };

    cloned.objects.forEach((obj: any) => processObject(obj));
    if (contaboCount > 0) console.log(`🔄 Convertido ${contaboCount} URL(s) da Contabo para proxy local`);
    if (wasabiCount > 0) console.log(`🔄 Convertido ${wasabiCount} URL(s) do Wasabi para proxy local`);
    return cloned;
};

/**
 * Substitui src de imagens blob: (sessão/local) por placeholder.
 * Blob URLs não sobrevivem ao reload, então quebram o loadFromJSON.
 */
const replaceBlobImagesWithPlaceholder = (canvasData: any): any => {
    const cloned = JSON.parse(JSON.stringify(canvasData));
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned;

    let count = 0;
    const processObject = (obj: any): void => {
        if (!obj) return;
        const objType = (obj.type || '').toLowerCase();
        if (objType === 'image' && typeof obj.src === 'string' && obj.src.startsWith('blob:')) {
            obj.src = PLACEHOLDER_IMAGE_DATA_URL;
            count++;
        }
        if (obj.objects && Array.isArray(obj.objects)) {
            obj.objects.forEach((child: any) => processObject(child));
        }
    };

    cloned.objects.forEach((obj: any) => processObject(obj));
    if (count > 0) console.warn(`⚠️ Substituindo ${count} imagem(ns) blob por placeholder (URL temporária)`);
    return cloned;
};

/**
 * Substitui src de imagens Contabo por placeholder para permitir loadFromJSON quando a URL retorna 500.
 * Preserva layout; imagens quebradas aparecem como quadrado transparente.
 * Processa recursivamente grupos aninhados.
 */
const replaceContaboImagesWithPlaceholder = (canvasData: any): any => {
    const cloned = JSON.parse(JSON.stringify(canvasData));
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned;
    
    let count = 0;
    
    // Função recursiva para processar objetos e grupos aninhados
    const processObject = (obj: any): void => {
        if (!obj) return;
        
        const objType = (obj.type || '').toLowerCase();
        
        // Se é uma imagem Contabo ou blob, substituir pelo placeholder
        if (
            objType === 'image' &&
            typeof obj.src === 'string' &&
            (obj.src.includes('contabostorage.com') || obj.src.startsWith('blob:'))
        ) {
            obj.src = PLACEHOLDER_IMAGE_DATA_URL;
            count++;
        }
        
        // Se é um grupo, processar seus objetos internos recursivamente
        if (obj.objects && Array.isArray(obj.objects)) {
            obj.objects.forEach((child: any) => processObject(child));
        }
    };
    
    cloned.objects.forEach((obj: any) => processObject(obj));
    
    if (count > 0) console.warn(`⚠️ Substituindo ${count} imagem(ns) inválida(s) por placeholder (Contabo/blob)`);
    return cloned;
};

// Flag global para evitar logs repetidos de frames faltando
const missingFramesLogged = new Set<string>();

const setupHistory = () => {
    if (!canvas.value) return;

    const saveState = async (opts: SaveStateOptions = {}) => {
        if (isHistoryProcessing.value) return; // Prevent loop

        // CRITICAL: Don't push/save empty canvas if the page already has data.
        // This can happen during transient clears (page switch/load) and it pollutes undo history
        // (Ctrl/Cmd+Z appears to "black screen" by undoing to an empty state).
        if (project.activePageIndex >= 0 && project.pages.length > 0 && project.pages[project.activePageIndex]) {
            const currentPage = project.pages[project.activePageIndex];
            const existingObjectCount = currentPage?.canvasData?.objects?.length || 0;
            const liveObjectCount = canvas.value?.getObjects?.()?.length || 0;
            if (!opts.allowEmptyOverwrite && liveObjectCount === 0 && existingObjectCount > 0) {
                console.warn(
                    `⚠️ Pulando salvamento: canvas está vazio (${liveObjectCount} objetos) mas página já tem ${existingObjectCount} objetos salvos`,
                    { pageIndex: project.activePageIndex, reason: opts.reason || 'unspecified' }
                );
                return;
            }
        }
        
        // Remove redo stack if new action happens (standard history behavior)
        if (historyIndex.value < historyStack.value.length - 1) {
            historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
        }

        // CRITICAL: Before saving, ensure all frames have layerName and isFrame set
        const allObjs = canvas.value.getObjects();
        allObjs.forEach((obj: any) => {
            if (obj?.isFrame) {
                // Ensure isFrame is explicitly set
                obj.isFrame = true;
                // Ensure layerName is set for LayersPanel
                if (!obj.layerName) {
                    obj.layerName = 'FRAMER';
                    console.log(`💾 Frame sem layerName antes de salvar, definido como "FRAMER":`, obj.name);
                }
                // Ensure stroke is Figma blue
                if (!obj.stroke || String(obj.stroke).toLowerCase() !== '#0d99ff') {
                    obj.stroke = '#0d99ff';
                }
            }
        });

        // CRITICAL: Get all objects from canvas BEFORE serialization to cross-reference
        const allCanvasObjects = canvas.value.getObjects();
        const canvasFrames = allCanvasObjects.filter((o: any) => o?.isFrame);
        
        // CRITICAL: Force all frames to be included in toJSON by ensuring they're "selectable" and have proper state
        // Fabric.js may exclude objects that are not properly initialized
        canvasFrames.forEach((frame: any) => {
            // Ensure frame is in a serializable state
            if (frame.selectable === false) frame.selectable = true;
            // Ensure frame is evented (can receive events)
            if (frame.evented === false) frame.evented = true;
            // Ensure frame has visible property set
            if (frame.visible === false) frame.visible = true;
            // Force update object state to ensure it's included
            frame.set('isFrame', true);
            frame.set('layerName', frame.layerName || 'FRAMER');
            // Ensure _customId exists
            if (!frame._customId) {
                frame._customId = Math.random().toString(36).substr(2, 9);
            }
            // Trigger internal state update
            if (typeof frame.setCoords === 'function') frame.setCoords();
            // Force canvas to recognize the object
            if (typeof frame.set === 'function') {
                frame.set('dirty', true);
            }
        });
        
        // CRITICAL: Force canvas to update its internal object list
        // Clear any problematic clipPaths from zones before rendering
        allObjs.forEach((obj: any) => {
            if (obj.clipPath && (obj.isGridZone || obj.isProductZone || obj.name === 'gridZone' || obj.name === 'productZoneContainer')) {
                obj.clipPath = null;
            }
        });
        safeRequestRenderAll();
        
        // CRITICAL: Pre-serialize all frames to ensure they're included
        // Sometimes toJSON() misses objects, so we'll manually add them if needed
        const preSerializedFrames = new Map<string, any>();
        canvasFrames.forEach((frame: any) => {
            try {
                if (!frame._customId) {
                    frame._customId = Math.random().toString(36).substr(2, 9);
                }
                // Pre-serialize the frame
                const frameObj = frame.toObject([...CANVAS_CUSTOM_PROPS]);
                frameObj.isFrame = true;
                frameObj.layerName = frameObj.layerName || 'FRAMER';
                frameObj.stroke = frameObj.stroke || '#0d99ff';
                frameObj.clipContent = frameObj.clipContent !== false;
                frameObj.selectable = frameObj.selectable !== false;
                frameObj.evented = frameObj.evented !== false;
                frameObj.visible = frameObj.visible !== false;
                preSerializedFrames.set(String(frame._customId), frameObj);
            } catch (err) {
                console.error('❌ Erro ao pré-serializar frame:', err, frame);
            }
        });
        
        // Serialize with custom props
        const json = canvas.value.toJSON([...CANVAS_CUSTOM_PROPS]);

        // CRITICAL: Remove clipPath from all product zones in JSON to prevent rendering errors
        if (json.objects && Array.isArray(json.objects)) {
            json.objects.forEach((obj: any) => {
                if (obj.clipPath && (obj.isGridZone || obj.isProductZone || obj.name === 'gridZone' || obj.name === 'productZoneContainer')) {
                    obj.clipPath = undefined;
                }
            });
        }

        // DEBUG: Log object order being saved
        console.log(`📋 Ordem dos objetos ao salvar (ANTES de verificar missingFrames):`, json.objects?.map((o: any, i: number) => `[${i}] ${o.type} - ${o.name || o.layerName || o._customId} (isFrame=${o.isFrame})`));
        
        // CRITICAL FIX: Restore frame properties in JSON objects
        // The problem is that Fabric's toJSON() serializes frames but loses custom properties
        // We need to match canvas frames with JSON objects and restore the properties
        if (json.objects && Array.isArray(json.objects)) {
            // Build a mapping of canvas objects by index (order is preserved by Fabric)
            const canvasObjs = canvas.value.getObjects();
            
            // Match JSON objects with canvas objects by position (same index = same object)
            // This is the most reliable way since Fabric preserves order
            json.objects.forEach((jsonObj: any, index: number) => {
                const canvasObj = canvasObjs[index];
                if (!canvasObj) return;
                
                // Copy custom properties from canvas object to JSON
                if (canvasObj._customId) jsonObj._customId = canvasObj._customId;
                if (canvasObj.layerName) jsonObj.layerName = canvasObj.layerName;
                if (canvasObj.isFrame) jsonObj.isFrame = true;
                if (canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent !== false;
                if (canvasObj.clipContent && !canvasObj.isFrame) jsonObj.clipContent = canvasObj.clipContent;
                if (canvasObj.parentFrameId) jsonObj.parentFrameId = canvasObj.parentFrameId;
                
                // Also copy name if missing
                if (!jsonObj.name && canvasObj.name) jsonObj.name = canvasObj.name;
            });
            
            // Double-check: ensure all frames have correct properties
            json.objects.forEach((obj: any) => {
                if (obj?.isFrame) {
                    obj.isFrame = true;
                    if (!obj.layerName) obj.layerName = 'FRAMER';
                    if (!obj.stroke || String(obj.stroke).toLowerCase() !== '#0d99ff') {
                        obj.stroke = '#0d99ff';
                    }
                    // Preserve user's clipContent choice (default to true only if undefined)
                    if (obj.clipContent === undefined || obj.clipContent === null) {
                        obj.clipContent = true;
                    }
                }
            });
            
            // CRITICAL: Remove invalid objects that shouldn't be saved
            // (objects without _customId that are not special objects like artboard-bg)
            const validObjects = json.objects.filter((obj: any) => {
                // Keep objects with _customId
                if (obj?._customId) return true;
                // Keep images (they have src)
                if ((obj?.type || '').toLowerCase() === 'image' && obj?.src) return true;
                // Keep frames (they have isFrame)
                if (obj?.isFrame) return true;
                // Keep objects with explicit id (artboard-bg, guides)
                if (obj?.id === 'artboard-bg' || obj?.id?.startsWith('guide-')) return true;
                // Filter out orphaned rects without any identifier
                if ((obj?.type || '').toLowerCase() === 'rect' && !obj?.name && !obj?.layerName && !obj?.isFrame) {
                    console.log(`🗑️ Removendo Rect órfão do JSON (sem _customId, name, ou isFrame):`, obj);
                    return false;
                }
                // Keep everything else by default
                return true;
            });
            
            if (validObjects.length !== json.objects.length) {
                console.log(`🧹 Filtrados ${json.objects.length - validObjects.length} objeto(s) inválido(s) do JSON`);
                json.objects = validObjects;
            }
            
            // DEBUG: Log final order after all processing
            console.log(`📋 Ordem FINAL dos objetos ao salvar:`, json.objects?.map((o: any, i: number) => `[${i}] ${o.type} - ${o.name || o.layerName || o._customId} (isFrame=${o.isFrame})`));
            
            // Debug: verify frames are being saved correctly
            const framesInJson = json.objects.filter((o: any) => o?.isFrame);
            if (framesInJson.length > 0) {
                console.log(`✅ Salvando ${framesInJson.length} frame(s)`);
            } else {
                // Final check: if still no frames, something is very wrong
                if (canvasFrames.length > 0) {
                    console.error(`❌ CRÍTICO: ${canvasFrames.length} frame(s) no canvas mas 0 no JSON após correção!`);
                    console.error('   Frames no canvas:', canvasFrames.map((f: any) => ({
                        name: f.name,
                        _customId: f._customId,
                        isFrame: f.isFrame,
                        layerName: f.layerName
                    })));
                }
            }
        }
        
        // CRITICAL: Convert presigned URLs to permanent URLs before saving
        // This ensures images persist after reload
        if (json.objects && Array.isArray(json.objects)) {
            // DEBUG: Log images being saved
            // IMPORTANT: Fabric.js may serialize type as 'Image' (uppercase) or 'image' (lowercase)
            const imagesToSave = json.objects.filter((o: any) => (o.type || '').toLowerCase() === 'image');
            if (imagesToSave.length > 0) {
                console.log(`💾 Salvando ${imagesToSave.length} imagem(ns):`);
                imagesToSave.forEach((img: any, idx: number) => {
                    console.log(`   [${idx}] src ANTES: ${img.src?.substring(0, 100) || 'N/A'}`);
                });
            }
            
            json.objects.forEach((obj: any) => {
                const objType = (obj.type || '').toLowerCase();
                if (objType === 'image' && obj.src) {
                    const permanentUrl = convertPresignedToPermanentUrl(obj.src);
                    if (permanentUrl !== obj.src) {
                        console.log(`🔄 Convertendo URL presignada para permanente:`);
                        console.log(`   De: ${obj.src.substring(0, 100)}...`);
                        console.log(`   Para: ${permanentUrl.substring(0, 100)}...`);
                        obj.src = permanentUrl;
                    } else {
                        console.log(`🔗 URL já é permanente (mantendo): ${obj.src.substring(0, 100)}...`);
                    }
                }
            });
            
            // DEBUG: Log images after conversion
            if (imagesToSave.length > 0) {
                console.log(`💾 Imagens APÓS conversão:`);
                json.objects.filter((o: any) => (o.type || '').toLowerCase() === 'image').forEach((img: any, idx: number) => {
                    console.log(`   [${idx}] src DEPOIS: ${img.src?.substring(0, 100) || 'N/A'}`);
                });
            }
        }
        
        // Persist app-level metadata alongside Fabric JSON.
        (json as any)[LABEL_TEMPLATES_JSON_KEY] = serializeLabelTemplatesForProject();
        // Persist viewport (pan/zoom) so reload restores the exact view.
        const vpt = canvas.value?.viewportTransform;
        if (Array.isArray(vpt) && vpt.length >= 6) {
            (json as any)[CANVAS_VIEWPORT_JSON_KEY] = {
                vpt: vpt.slice(0, 6).map((n: any) => Number(n)),
                zoom: Number(canvas.value?.getZoom?.() || vpt[0] || 1),
            };
        }
        const jsonStr = JSON.stringify(json);
        // CRITICAL: Avoid pushing duplicate states (prevents "weird" undo that feels like it skips or needs many presses)
        const last = historyStack.value[historyStack.value.length - 1];
        if (last === jsonStr) {
            return;
        }

        historyStack.value.push(jsonStr);
        historyIndex.value = historyStack.value.length - 1;
        
        // Limit Stack
        if (historyStack.value.length > 50) {
            historyStack.value.shift();
            historyIndex.value--;
        }

        // --- SYNC WITH STORE ---
        // CRITICAL: Não salvar se as páginas ainda não foram carregadas
        if (project.activePageIndex >= 0 && project.pages.length > 0 && project.pages[project.activePageIndex]) {
             const objectCount = json.objects?.length || 0;
             const currentPage = project.pages[project.activePageIndex];

             console.log(`💾 Salvando estado: ${objectCount} objeto(s) para página ${project.activePageIndex}`);

             updatePageData(project.activePageIndex, json);

             // Verificar se os dados foram salvos corretamente
             const savedPage = project.pages[project.activePageIndex];
             if (savedPage?.canvasData) {
                 const savedObjectCount = savedPage.canvasData?.objects?.length || 0;
                 console.log(`✅ Estado salvo: página tem ${savedObjectCount} objeto(s) no canvasData`);
                 if (savedObjectCount !== objectCount) {
                     console.warn(`⚠️ Discrepância: salvamos ${objectCount} objetos mas página tem ${savedObjectCount}`);
                 }
             } else {
                 console.error(`❌ PROBLEMA: Estado não foi salvo! Página ${project.activePageIndex} não tem canvasData`);
             }
             
              // Generate Thumbnail (Debounced ideally, but simplistic here)
              // We use a small multiplier to keep it light

              // CRITICAL: Aggressively clear ALL clipPaths before thumbnail generation
              // This prevents "Cannot read properties of undefined (reading 'forEach')" errors in fabric.js
              const clearAllClipPathsAggressively = () => {
                  if (!canvas.value) return;
                  try {
                      const objects = canvas.value.getObjects();
                      let cleared = 0;
                      objects.forEach((obj: any) => {
                          // Clear direct clipPath - use multiple methods to ensure it's removed
                          if (obj.clipPath) {
                              try {
                                  obj.set('clipPath', null);
                              } catch (e) {}
                              try {
                                  delete obj.clipPath;
                              } catch (e) {}
                              delete obj._frameClipOwner;
                              cleared++;
                          }
                          // Clear nested clipPaths in groups
                          if (obj._objects && Array.isArray(obj._objects)) {
                              obj._objects.forEach((child: any) => {
                                  if (child.clipPath) {
                                      try { child.set('clipPath', null); } catch (e) {}
                                      try { delete child.clipPath; } catch (e) {}
                                      delete child._frameClipOwner;
                                      cleared++;
                                  }
                              });
                          }
                          // Also check via getObjects() for groups
                          if (typeof obj.getObjects === 'function') {
                              const children = obj.getObjects();
                              if (Array.isArray(children)) {
                                  children.forEach((child: any) => {
                                      if (child.clipPath) {
                                          try { child.set('clipPath', null); } catch (e) {}
                                          try { delete child.clipPath; } catch (e) {}
                                          delete child._frameClipOwner;
                                          cleared++;
                                      }
                                  });
                              }
                          }
                      });
                      console.log(`[Thumbnail] Cleared ${cleared} clipPaths before generation`);
                  } catch (e) {
                      console.warn('[Thumbnail] Error clearing clipPaths:', e);
                  }
              };

              // Clear all clipPaths aggressively
              clearAllClipPathsAggressively();

              // SANITIZE: Ensure any remaining clipPaths have valid _objects arrays
              // This prevents "Cannot read properties of undefined (reading 'forEach')" in fabric.js
              const sanitizeClipPaths = () => {
                  if (!canvas.value) return;
                  try {
                      const objects = canvas.value.getObjects();
                      let sanitized = 0;

                      const sanitizeClipPath = (clipPath: any) => {
                          if (!clipPath) return;
                          // Ensure _objects is always an array, never undefined
                          if (clipPath._objects === undefined || clipPath._objects === null) {
                              clipPath._objects = [];
                              sanitized++;
                          }
                          // Recursively sanitize nested clipPaths
                          if (clipPath.clipPath) {
                              sanitizeClipPath(clipPath.clipPath);
                          }
                      };

                      objects.forEach((obj: any) => {
                          // Sanitize direct clipPath
                          if (obj.clipPath) {
                              sanitizeClipPath(obj.clipPath);
                          }
                          // Sanitize nested clipPaths
                          if (obj._objects && Array.isArray(obj._objects)) {
                              obj._objects.forEach((child: any) => {
                                  if (child.clipPath) {
                                      sanitizeClipPath(child.clipPath);
                                  }
                              });
                          }
                          if (typeof obj.getObjects === 'function') {
                              const children = obj.getObjects();
                              if (Array.isArray(children)) {
                                  children.forEach((child: any) => {
                                      if (child.clipPath) {
                                          sanitizeClipPath(child.clipPath);
                                      }
                                  });
                              }
                          }
                      });

                      if (sanitized > 0) {
                          console.log(`[Thumbnail] Sanitized ${sanitized} clipPath _objects arrays`);
                      }
                  } catch (e) {
                      console.warn('[Thumbnail] Error sanitizing clipPaths:', e);
                  }
              };

              // Sanitize any remaining clipPaths
              sanitizeClipPaths();

              // Force canvas to update its internal state before thumbnail generation
              if (canvas.value && canvas.value.renderAll) {
                  canvas.value.renderAll();
              }

              // Wait for fabric.js to complete internal updates
              await new Promise(resolve => setTimeout(resolve, 10));

              let dataURL = '';
              try {
                  // Check if canvas is valid before generating thumbnail
                  if (!canvas.value || !canvas.value.getElement()) {
                      console.warn('[Thumbnail] Canvas not available, skipping thumbnail');
                      dataURL = '';
                  } else {
                      dataURL = canvas.value.toDataURL({
                          format: 'jpeg',
                          quality: 0.5,
                          multiplier: 0.1 // 10% size
                      });
                  }
              } catch (thumbErr) {
                  console.warn('[Thumbnail] Erro ao gerar thumbnail:', thumbErr);
                  // Try one more time with complete clipPath removal and sanitization
                  try {
                      clearAllClipPathsAggressively();
                      sanitizeClipPaths();
                      // Force canvas to update
                      if (canvas.value && canvas.value.renderAll) {
                          canvas.value.renderAll();
                      }
                      // Wait for fabric.js to complete internal updates
                      await new Promise(resolve => setTimeout(resolve, 10));
                      dataURL = canvas.value.toDataURL({
                          format: 'jpeg',
                          quality: 0.5,
                          multiplier: 0.1
                      });
                  } catch (fallbackErr) {
                      console.error('[Thumbnail] Falha definitiva ao gerar thumbnail:', fallbackErr);
                      dataURL = '';
                  }
              }
              if (dataURL) {
                  updatePageThumbnail(project.activePageIndex, dataURL);
              }

              // CRITICAL: Restaurar clipPaths dos frames após geração do thumbnail
              // clearAllClipPathsAggressively() removeu todos os clips - precisamos recriá-los
              try {
                  const allObjs = canvas.value.getObjects();
                  const frames = allObjs.filter((o: any) => o?.isFrame);
                  allObjs.forEach((o: any) => {
                      // Skip product cards — they should NOT be clipped by frames
                      if (o?.isSmartObject || o?.isProductCard) return;
                      if (o?.parentFrameId || o?._frameClipOwner) syncObjectFrameClip(o);
                  });
                  frames.forEach((f: any) => syncFrameClips(f));
                  canvas.value.requestRenderAll();
              } catch (restoreErr) {
                  console.warn('[Thumbnail] Erro ao restaurar clipPaths:', restoreErr);
              }
        }
    }
    
    // Export for external use
    saveCurrentState = saveState;

    // Capture initial state - only if canvas has objects OR page is new/empty
    const currentObjectCount = canvas.value.getObjects().length;
    const currentPage = project.pages[project.activePageIndex];
    const pageHasData = currentPage?.canvasData?.objects?.length > 0;

    // Only save initial state if canvas has objects, or if page is completely new (no existing data)
    if (currentObjectCount > 0 || !pageHasData) {
        saveState({ reason: 'initial-history-capture' });
    } else {
        console.log('ℹ️ Pullando saveState inicial: canvas vazio mas página já tem dados');
    }

    // Fabric Events to trigger Save
    canvas.value.on('object:added', (e: any) => {
        if (!isHistoryProcessing.value) {
            saveState({ allowEmptyOverwrite: true, reason: 'object:added' });
            triggerAutoSave(); // Auto-save to Contabo
        }
        updateScrollbars();
    });
    canvas.value.on('object:modified', (e: any) => {
        if (isHistoryProcessing.value) return;
        // Prevent double state save when applyZoneUpdates already saved (prevents duplicate history entries)
        if (isApplyingZoneUpdate) return;

        const obj = e?.target;
        // For zones, run our normalization/layout first and save only once (prevents unstable undo states).
        if (obj && isLikelyProductZone(obj)) {
            handleObjectModified(e);
            saveState({ allowEmptyOverwrite: true, reason: 'object:modified(zone)' });
            triggerAutoSave(); // Auto-save to Contabo
            return;
        }

        handleObjectModified(e);
        // Save AFTER any normalization so each Ctrl+Z reverts one user action.
        saveState({ allowEmptyOverwrite: true, reason: 'object:modified' });
        triggerAutoSave(); // Auto-save to Contabo
    });
    canvas.value.on('object:removed', (e: any) => {
        if (isHistoryProcessing.value) {
            updateScrollbars();
            return;
        }

        const obj = e?.target;
        // Cascading delete: removing a zone must remove all its bound cards in a single undo step.
        if (obj && isLikelyProductZone(obj) && !isZoneCascadeDelete) {
            const zoneId = obj._customId;
            if (zoneId) {
                isZoneCascadeDelete = true;
                try {
                    const toRemove = canvas.value.getObjects().filter((o: any) => {
                        if (!o || o.excludeFromExport) return false;
                        const isCard = !!(o.isSmartObject || o.isProductCard || String(o.name || '').startsWith('product-card') || isLikelyProductCard(o));
                        return isCard && o.parentZoneId === zoneId;
                    });
                    toRemove.forEach((child: any) => {
                        try { canvas.value.remove(child); } catch (_) { /* ignore */ }
                    });
                } finally {
                    isZoneCascadeDelete = false;
                }
            }

            saveState({ allowEmptyOverwrite: true, reason: 'object:removed(zone+cascade)' });
            triggerAutoSave(); // Auto-save to Contabo
            updateScrollbars();
            return;
        }

        // When cascading, skip intermediate saves for each child removal.
        if (!isZoneCascadeDelete) {
            saveState({ allowEmptyOverwrite: true, reason: 'object:removed' });
            triggerAutoSave(); // Auto-save to Contabo
        }
        updateScrollbars();
    });
}

// --- Sync Logic (Herd Effect) ---
const handleObjectModified = (e: any) => {
    const obj = e.target;
    if (!obj) return;

    // 🔹 Normalizar scale de retângulos (Figma-style)
    // Converte scaleX/scaleY em width/height reais para evitar distorção de border-radius
    if (obj.type === 'rect') {
        normalizeRectScale(obj);
    }

    // 🔹 Normalizar scale de grupos que contêm retângulos
    // Smart objects, product cards, etc. são grupos com retângulos internos
    if (obj.type === 'group') {
        normalizeGroupRects(obj);
    }

    if (isLikelyProductZone(obj)) {
        // Cache children BEFORE any zone changes to prevent losing cards
        const cachedChildren = getZoneChildren(obj);
        ensureZoneSanity(obj);
        normalizeZoneScale(obj);
        recalculateZoneLayout(obj, cachedChildren, { save: false });
        return;
    }

    // Product zone: dragging a card reorders the grid (snap back into slots on drop).
    if ((obj.isSmartObject || obj.isProductCard || String(obj.name || '').startsWith('product-card') || isLikelyProductCard(obj)) && (obj as any).parentZoneId && canvas.value) {
        const zoneId = (obj as any).parentZoneId as string;
        const zone = canvas.value.getObjects().find((o: any) => isLikelyProductZone(o) && o?._customId === zoneId);
        if (zone) {
            ensureZoneSanity(zone);
            const cards = getZoneChildren(zone);
            if (cards.length > 0) {
                // Ensure a stable order index exists.
                const hasAllOrders = cards.every((c: any) => Number.isFinite((c as any)._zoneOrder));
                if (!hasAllOrders) {
                    cards
                        .slice()
                        .sort((a: any, b: any) => {
                            const rowDiff = (a.top ?? 0) - (b.top ?? 0);
                            if (Math.abs(rowDiff) > 50) return rowDiff;
                            return (a.left ?? 0) - (b.left ?? 0);
                        })
                        .forEach((c: any, i: number) => ((c as any)._zoneOrder = i));
                }

                const ordered = cards.slice().sort((a: any, b: any) => ((a as any)._zoneOrder ?? 0) - ((b as any)._zoneOrder ?? 0));
                const fromIndex = ordered.indexOf(obj);

                // Find nearest slot index for the drop position.
                const zoneRect = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
                const padding = typeof zone._zonePadding === 'number' ? zone._zonePadding : (zone.padding ?? 20);
                const gapX = zone.gapHorizontal ?? padding;
                const gapY = zone.gapVertical ?? padding;
                const layoutDirection = zone.layoutDirection || 'horizontal';
                const verticalAlign = zone.verticalAlign || 'top';
                const lastRowBehavior = zone.lastRowBehavior || 'fill';
                const zoneConfig: ProductZone = {
                    x: zoneRect.left,
                    y: zoneRect.top,
                    width: zoneRect.width,
                    height: zoneRect.height,
                    padding,
                    gapHorizontal: gapX,
                    gapVertical: gapY,
                    columns: typeof zone.columns === 'number' ? zone.columns : 0,
                    rows: typeof zone.rows === 'number' ? zone.rows : 0,
                    cardAspectRatio: zone.cardAspectRatio ?? 'auto',
                    lastRowBehavior
                };

                const { cols, rows, itemWidth, itemHeight } = calculateGridLayout(zoneConfig, ordered.length);
                const usableW = Math.max(0, zoneRect.width - (padding * 2));
                const usableH = Math.max(0, zoneRect.height - (padding * 2));
                let itemW = Math.max(50, itemWidth);
                let itemH = Math.max(50, itemHeight);

                let startX = zoneRect.left + padding;
                let startY = zoneRect.top + padding;

                // Keep slot math consistent with `recalculateZoneLayout` (including highlights).
                const safeRows = Math.max(1, rows);
                const hl = getZoneHighlightPredicate(zone, ordered);
                const rowHasHighlight = new Array<boolean>(rows).fill(false);
                if (hl.count > 0 && hl.mult > 1) {
                    for (let i = 0; i < ordered.length; i++) {
                        if (!hl.isHighlighted(ordered[i], i)) continue;
                        const r = layoutDirection === 'vertical' ? (i % safeRows) : Math.floor(i / cols);
                        if (r >= 0 && r < rows) rowHasHighlight[r] = true;
                    }
                }
                const highlightRowCount = rowHasHighlight.filter(Boolean).length;

                const gapTotalH = (rows - 1) * gapY;
                const denom = rows + (highlightRowCount * (hl.mult - 1));
                const maxBaseH = (rows > 0 && denom > 0) ? ((usableH - gapTotalH) / denom) : itemH;

                let baseH = itemH;
                if (verticalAlign === 'stretch') baseH = maxBaseH;
                else baseH = Math.min(baseH, maxBaseH);
                baseH = Math.max(50, baseH);

                const rowHeights = new Array<number>(rows).fill(baseH);
                for (let r = 0; r < rows; r++) {
                    if (rowHasHighlight[r]) rowHeights[r] = baseH * hl.mult;
                }

                const usedGridH = rowHeights.reduce((sum, h) => sum + h, 0) + gapTotalH;
                if (verticalAlign === 'center') startY += Math.max(0, (usableH - usedGridH) / 2);
                else if (verticalAlign === 'bottom') startY += Math.max(0, usableH - usedGridH);

                const rowTops: number[] = [startY];
                for (let r = 1; r < rows; r++) {
                    rowTops[r] = rowTops[r - 1]! + (rowHeights[r - 1] ?? baseH) + gapY;
                }

                const centers: Array<{ x: number; y: number }> = [];
                for (let i = 0; i < ordered.length; i++) {
                    const col = layoutDirection === 'vertical' ? Math.floor(i / safeRows) : (i % cols);
                    const row = layoutDirection === 'vertical' ? (i % safeRows) : Math.floor(i / cols);
                    const isHighlighted = hl.isHighlighted(ordered[i], i);
                    const cardH = isHighlighted ? (baseH * hl.mult) : baseH;
                    const rowTop = rowTops[row] ?? startY;

                    const isLastRow = layoutDirection !== 'vertical' && row === rows - 1;
                    const itemsInRow = isLastRow ? (ordered.length % cols || cols) : cols;
                    const shouldFillRow = isLastRow && (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') && itemsInRow < cols;
                    const rowItemW = shouldFillRow
                        ? Math.max(50, (usableW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow))
                        : itemW;
                    const slotW = (layoutDirection === 'vertical' ? itemW : rowItemW);

                    let x = startX + (col * (slotW + gapX));
                    if (isLastRow && lastRowBehavior === 'center' && itemsInRow < cols) {
                        const rowWidth = (itemsInRow * itemW) + ((itemsInRow - 1) * gapX);
                        const remainingSpace = usableW - rowWidth;
                        x += remainingSpace / 2;
                    }
                    const cx = x + (slotW / 2);
                    const cy = rowTop + (cardH / 2);
                    centers.push({ x: cx, y: cy });
                }

                let toIndex = fromIndex;
                const center = typeof obj.getCenterPoint === 'function' ? obj.getCenterPoint() : null;
                if (center && centers.length) {
                    let best = 0;
                    let bestD = Number.POSITIVE_INFINITY;
                    for (let i = 0; i < centers.length; i++) {
                        const dx = centers[i]!.x - center.x;
                        const dy = centers[i]!.y - center.y;
                        const d = (dx * dx) + (dy * dy);
                        if (d < bestD) {
                            bestD = d;
                            best = i;
                        }
                    }
                    toIndex = best;
                }

                if (fromIndex !== -1 && toIndex !== -1 && toIndex !== fromIndex) {
                    // Swap apenas os dois cards - troca completa de posição
                    [ordered[fromIndex], ordered[toIndex]] = [ordered[toIndex], ordered[fromIndex]];
                    ordered.forEach((c: any, i: number) => ((c as any)._zoneOrder = i));
                }

                // Snap everything back into the grid after drop.
                recalculateZoneLayout(zone, ordered, { save: false });
            }
        }
        return;
    }
    
    // Check if it's a Smart Object (Group) or part of one?
    // Fabric v6: if we modify a child inside a group via interactive selection, 
    // the event might fire for the group or the child depending on subTargetCheck settings.
    
    // However, usually we deal with manual property updates from PropertiesPanel.
    // The canvas 'object:modified' is mostly for mouse interactions (drag, scale).
    // Dragging one card doesn't need to drag all others (layout is looser).
    // Scaling one card... theoretically should scale all? 
    // For now, let's limit "Herd Effect" to styles applied via PropertiesPanel.
}

// --- Sync Function invoked by Properties Panel ---
const syncSmartGridStyles = (sourceObj: any, property: string, value: any) => {
    if (!sourceObj.smartGridId) return;

    const gridId = sourceObj.smartGridId;
    const targetRole = sourceObj.name; // e.g. 'priceInteger' or 'productImage'

    // Iterate all objects
    const allObjects = canvasObjects.value; // reactive list or canvas.getObjects() 
    
    // We need to traverse. 
    // Since SmartObjects are Groups, we need to find the peer Groups, then find the matching child.
    
    canvas.value.getObjects().forEach((group: any) => {
        if (group.smartGridId === gridId && group !== sourceObj.group && group !== sourceObj) { // allow group itself or parent group
             // If sourceObj is inside a group, sourceObj is the child. 
             // group is the Container (Master Group). 
             // But wait, if we selected a text inside the group, sourceObj is the Text.
             // sourceObj.group is the MasterGroup.
             
             // Case 1: sourceObj is the MasterGroup (e.g. changing background color of the card)
             if (sourceObj.type === 'group' && sourceObj.smartGridId === gridId) {
                // peer is 'group'
                // Apply property to peer
                // Access private _objects or getObjects()
                 const peerBg = group.getObjects().find((o: any) => o.name === 'offerBackground');
                 if(sourceObj.name === 'offerBackground') { // Actually source is likely the group wrapper, but changes applied to bg?
                    // If formatting background color on the group directly?
                    // Usually properties panel applies format to the active object. 
                 }
             }

             // Case 2: sourceObj is a child (Text/Image) inside the MasterGroup
             // We need to find the "Cousin" inside the peer group.
             // sourceObj.group SHOULD be the MasterGroup.
        }
    });
}


const undo = async () => {
    if (historyIndex.value > 0 && !isHistoryProcessing.value) {
        isHistoryProcessing.value = true;
        historyIndex.value--;

        // CRITICAL: Validate state before processing
        const stateStr = historyStack.value[historyIndex.value];
        if (!stateStr) {
            console.error('❌ Estado vazio no histórico');
            isHistoryProcessing.value = false;
            return;
        }

        let state = JSON.parse(stateStr);

        // CRITICAL: Check if state has objects, try to find a valid one if empty
        if (!state.objects || state.objects.length === 0) {
            console.warn('⚠️ Estado sem objetos - buscando próximo válido...');
            // Try to find next valid state
            while (historyIndex.value > 0) {
                historyIndex.value--;
                const nextStateStr = historyStack.value[historyIndex.value];
                if (nextStateStr) {
                    const nextState = JSON.parse(nextStateStr);
                    if (nextState.objects && nextState.objects.length > 0) {
                        // Update state to the valid one found
                        state = nextState;
                        console.log(`✅ Estado válido encontrado no índice ${historyIndex.value}`);
                        break;
                    }
                }
            }
        }

        hydrateLabelTemplatesFromProjectJson(state);

        // CRITICAL: Extract viewport BEFORE loadFromJSON (it will be reset)
        const savedViewport = getSavedViewportTransform(state);

        const prevRenderOnAddRemove = canvas.value.renderOnAddRemove;
        canvas.value.renderOnAddRemove = false;

        try {
            await canvas.value.loadFromJSON(state);
            // CRITICAL: sanitize clipPaths BEFORE any render to avoid fabric crash (forEach of undefined)
            sanitizeAllClipPaths();
            rehydrateCanvasZones();
            sanitizeAllClipPaths();

            // CRITICAL: Verify objects were actually loaded
            const loadedObjectCount = canvas.value.getObjects().length;
            const expectedObjectCount = state.objects?.length || 0;

            if (loadedObjectCount === 0 && expectedObjectCount > 0) {
                console.error(`❌ loadFromJSON falhou: esperado ${expectedObjectCount} objetos, carregados ${loadedObjectCount}`);
                // Try to recover by loading from page data
                const currentPage = project.pages[project.activePageIndex];
                if (currentPage && currentPage.canvasData && currentPage.canvasData.objects && currentPage.canvasData.objects.length > 0) {
                    console.log('🔄 Recarregando canvasData da página...');
                    await canvas.value.loadFromJSON(currentPage.canvasData);
                    sanitizeAllClipPaths();
                    rehydrateCanvasZones();
                }
            }

            // CRITICAL: Restore viewport (zoom/pan) to prevent black screen/lost position
            if (savedViewport) {
                canvas.value.setViewportTransform(savedViewport);
                updateZoomState();
                updateScrollbars();
            } else {
                // Back-compat with older history entries that didn't persist viewport.
                zoomToFit();
                updateScrollbars();
            }

            // CRITICAL: Ensure background color is correct (loadFromJSON may reset it)
            if (!canvas.value.backgroundColor ||
                canvas.value.backgroundColor === 'transparent' ||
                String(canvas.value.backgroundColor) === 'rgba(0,0,0,0)') {
                canvas.value.backgroundColor = '#1e1e1e';
            }

            // Recalculate text dimensions after undo (font cache may be stale)
            try {
                const fc = (fabric as any)?.cache;
                if (fc && typeof fc.clearFontCache === 'function') fc.clearFontCache();
            } catch (_e) { /* ignore */ }
            const recalcUndoText = (obj: any) => {
                if (!obj) return;
                const tt = String(obj.type || '').toLowerCase();
                if (tt === 'i-text' || tt === 'textbox' || tt === 'text') {
                    if (typeof obj.initDimensions === 'function') obj.initDimensions();
                    obj.set('dirty', true);
                    if (typeof obj.setCoords === 'function') obj.setCoords();
                }
                if (typeof obj.getObjects === 'function') {
                    obj.getObjects().forEach(recalcUndoText);
                    obj.set('dirty', true);
                }
            };
            canvas.value.getObjects().forEach(recalcUndoText);

            // Limpar seleção após undo
            canvas.value.discardActiveObject();
            safeRequestRenderAll();

            // Refresh Reactivity
            const objs = canvas.value.getObjects();
            canvasObjects.value = [...objs];
            updateSelection();
        } catch (err) {
            console.error('❌ Undo failed:', err);
            // Nuclear fallback: remove clipPaths and try one more render
            try {
                removeAllClipPaths();
                safeRequestRenderAll();
            } catch {}
        } finally {
            canvas.value.renderOnAddRemove = prevRenderOnAddRemove;
            isHistoryProcessing.value = false;
        }
    }
}

const redo = async () => {
    if (historyIndex.value < historyStack.value.length - 1 && !isHistoryProcessing.value) {
        isHistoryProcessing.value = true;
        historyIndex.value++;

        // CRITICAL: Validate state before processing
        const stateStr = historyStack.value[historyIndex.value];
        if (!stateStr) {
            console.error('❌ Estado vazio no histórico');
            isHistoryProcessing.value = false;
            return;
        }

        let state = JSON.parse(stateStr);

        // CRITICAL: Check if state has objects, try to find a valid one if empty
        if (!state.objects || state.objects.length === 0) {
            console.warn('⚠️ Estado sem objetos - buscando próximo válido...');
            // Try to find next valid state
            while (historyIndex.value < historyStack.value.length - 1) {
                historyIndex.value++;
                const nextStateStr = historyStack.value[historyIndex.value];
                if (nextStateStr) {
                    const nextState = JSON.parse(nextStateStr);
                    if (nextState.objects && nextState.objects.length > 0) {
                        // Update state to the valid one found
                        state = nextState;
                        console.log(`✅ Estado válido encontrado no índice ${historyIndex.value}`);
                        break;
                    }
                }
            }
        }

        hydrateLabelTemplatesFromProjectJson(state);

        // CRITICAL: Extract viewport BEFORE loadFromJSON (it will be reset)
        const savedViewport = getSavedViewportTransform(state);

        const prevRenderOnAddRemove = canvas.value.renderOnAddRemove;
        canvas.value.renderOnAddRemove = false;

        try {
            await canvas.value.loadFromJSON(state);
            // CRITICAL: sanitize clipPaths BEFORE any render to avoid fabric crash (forEach of undefined)
            sanitizeAllClipPaths();
            rehydrateCanvasZones();
            sanitizeAllClipPaths();

            // CRITICAL: Verify objects were actually loaded
            const loadedObjectCount = canvas.value.getObjects().length;
            const expectedObjectCount = state.objects?.length || 0;

            if (loadedObjectCount === 0 && expectedObjectCount > 0) {
                console.error(`❌ loadFromJSON falhou no redo: esperado ${expectedObjectCount} objetos, carregados ${loadedObjectCount}`);
                // Try to recover by loading from page data
                const currentPage = project.pages[project.activePageIndex];
                if (currentPage && currentPage.canvasData && currentPage.canvasData.objects && currentPage.canvasData.objects.length > 0) {
                    console.log('🔄 Recarregando canvasData da página...');
                    await canvas.value.loadFromJSON(currentPage.canvasData);
                    sanitizeAllClipPaths();
                    rehydrateCanvasZones();
                }
            }

            // CRITICAL: Restore viewport (zoom/pan) to prevent black screen/lost position
            if (savedViewport) {
                canvas.value.setViewportTransform(savedViewport);
                updateZoomState();
                updateScrollbars();
            } else {
                // Back-compat with older history entries that didn't persist viewport.
                zoomToFit();
                updateScrollbars();
            }

            // CRITICAL: Ensure background color is correct (loadFromJSON may reset it)
            if (!canvas.value.backgroundColor ||
                canvas.value.backgroundColor === 'transparent' ||
                String(canvas.value.backgroundColor) === 'rgba(0,0,0,0)') {
                canvas.value.backgroundColor = '#1e1e1e';
            }

            // Recalculate text dimensions after redo (font cache may be stale)
            try {
                const fc = (fabric as any)?.cache;
                if (fc && typeof fc.clearFontCache === 'function') fc.clearFontCache();
            } catch (_e) { /* ignore */ }
            const recalcRedoText = (obj: any) => {
                if (!obj) return;
                const tt = String(obj.type || '').toLowerCase();
                if (tt === 'i-text' || tt === 'textbox' || tt === 'text') {
                    if (typeof obj.initDimensions === 'function') obj.initDimensions();
                    obj.set('dirty', true);
                    if (typeof obj.setCoords === 'function') obj.setCoords();
                }
                if (typeof obj.getObjects === 'function') {
                    obj.getObjects().forEach(recalcRedoText);
                    obj.set('dirty', true);
                }
            };
            canvas.value.getObjects().forEach(recalcRedoText);

            // Limpar seleção após redo
            canvas.value.discardActiveObject();
            safeRequestRenderAll();

            // Refresh Reactivity
            const objs = canvas.value.getObjects();
            canvasObjects.value = [...objs];
            updateSelection();
        } catch (err) {
            console.error('❌ Redo failed:', err);
            // Nuclear fallback: remove clipPaths and try one more render
            try {
                removeAllClipPaths();
                safeRequestRenderAll();
            } catch {}
        } finally {
            canvas.value.renderOnAddRemove = prevRenderOnAddRemove;
            isHistoryProcessing.value = false;
        }
    }
}

const duplicateFrameWithContents = async (frame: any, opts: { offset?: number } = {}) => {
    if (!canvas.value || !frame) return null;
    if (!frame.isFrame) return null;
    const rootId = String(frame._customId || '');
    if (!rootId) return null;

    const offset = Number(opts.offset ?? 20) || 0;

    const all = canvas.value.getObjects();
    const indexById = new Map<string, number>();
    all.forEach((o: any, i: number) => {
        if (o?._customId) indexById.set(String(o._customId), i);
    });

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
            if ((o as any).isFrame) queue.push(id);
        });
    }

    const originals = all.filter((o: any) => o?._customId && toDuplicateIds.has(String(o._customId)));
    originals.sort((a: any, b: any) => (indexById.get(String(a._customId)) ?? 0) - (indexById.get(String(b._customId)) ?? 0));

    if (!originals.length) return null;

    const insertBaseIndex = Math.max(...originals.map((o: any) => indexById.get(String(o._customId)) ?? -1)) + 1;
    const extraProps = Array.from(new Set([...CANVAS_CUSTOM_PROPS, 'data', 'opacity', 'flipX', 'flipY', 'filters', 'clipPath', 'src']));

    const oldToNewId = new Map<string, string>();
    const clones: any[] = [];
    let rootClone: any = null;

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
        if (!cloned) continue;

        const oldId = String(original._customId || '');
        const newId = Math.random().toString(36).substr(2, 9);
        oldToNewId.set(oldId, newId);

        cloned._customId = newId;
        cloned.set?.({
            left: (Number(original.left) || 0) + offset,
            top: (Number(original.top) || 0) + offset,
            evented: true,
            selectable: true,
        });

        // Avoid stale clip refs; we'll rebuild them from the new frame IDs.
        try { cloned.clipPath = null; } catch {}
        try { delete (cloned as any)._frameClipOwner; } catch {}
        try { delete (cloned as any).__clipRect; } catch {}

        // Keep the frame flag even if Fabric drops it in clone.
        if (original.isFrame) {
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

        // Insert right above the duplicated block to keep stacking predictable.
        try {
            if (typeof (canvas.value as any).insertAt === 'function') {
                (canvas.value as any).insertAt(cloned, insertBaseIndex + clones.length, false);
            } else {
                canvas.value.add(cloned);
            }
        } catch {
            canvas.value.add(cloned);
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
        const oldParent = String((original as any).parentFrameId || '');
        if (!oldParent) {
            clone.parentFrameId = undefined;
            return;
        }
        const mappedParent = oldToNewId.get(oldParent);
        clone.parentFrameId = mappedParent || undefined;
    });

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

    canvas.value.setActiveObject(rootClone);
    canvas.value.requestRenderAll();
    canvasObjects.value = [...canvas.value.getObjects()];
    updateSelection();
    saveCurrentState({ reason: 'duplicate-frame' });
    triggerAutoSave();
    return rootClone;
};

const handleKeyDown = async (e: KeyboardEvent) => {
    if (!canvas.value) return;

    // If editing a Fabric IText, let Fabric/browser handle undo/redo (text-level), not canvas-history.
    try {
        const active: any = canvas.value.getActiveObject?.();
        if (active?.isEditing) return;
    } catch {}
    
    // Ignore input fields so we don't trigger shortcuts while typing
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]')) {
        return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

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
    if (e.shiftKey && e.key === '1') {
        e.preventDefault();
        zoomToFit();
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

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // If in node editing mode and a path node is selected, remove the point
        if (isNodeEditing.value && selectedPathNodeIndex.value !== null && currentEditingPath.value) {
            e.preventDefault();
            removePathPoint(currentEditingPath.value, selectedPathNodeIndex.value);
            return;
        }
        
        const active = canvas.value.getActiveObjects();
        if (active.length) {
            e.preventDefault();
            
            // Collect objects to delete - separate those in real groups vs canvas root
            const toDeleteFromCanvas: any[] = [];
            const toDeleteFromGroup: { obj: any, group: any }[] = [];
            
            for (const obj of active) {
                // Get the group reference, but IGNORE ActiveSelection
                let parentGroup = (obj as any).group;
                
                // CRITICAL: ActiveSelection is NOT a real parent group - skip it
                if (parentGroup && (
                    parentGroup.type === 'activeSelection' || 
                    parentGroup.type === 'ActiveSelection' ||
                    String(parentGroup.type || '').toLowerCase() === 'activeselection'
                )) {
                    parentGroup = null;
                }
                
                // Try global search if no direct parent found
                if (!parentGroup) {
                    parentGroup = findParentGroupForObjectGlobal(obj);
                }
                
                // Double-check it's not an ActiveSelection
                if (parentGroup && (
                    parentGroup.type === 'activeSelection' || 
                    parentGroup.type === 'ActiveSelection' ||
                    String(parentGroup.type || '').toLowerCase() === 'activeselection'
                )) {
                    parentGroup = null;
                }
                
                if (parentGroup && typeof parentGroup.remove === 'function') {
                    toDeleteFromGroup.push({ obj, group: parentGroup });
                } else {
                    toDeleteFromCanvas.push(obj);
                }
            }
            
            // First discard active selection to release objects
            canvas.value.discardActiveObject();
            
            // Delete from groups first
            for (const { obj, group } of toDeleteFromGroup) {
                try {
                    group.remove(obj);
                    group.set('dirty', true);
                    if (typeof group.setCoords === 'function') group.setCoords();
                    console.log('🗑️ [Delete] Objeto removido do grupo:', {
                        objectName: obj.name || obj._customId,
                        parentGroupName: group.name || group._customId
                    });
                } catch (err) {
                    console.warn('[Delete] Erro ao remover do grupo, tentando canvas:', err);
                    try { canvas.value.remove(obj); } catch {}
                }
            }
            
            // Delete from canvas
            for (const obj of toDeleteFromCanvas) {
                try {
                    // Grid cell: also delete all sibling cells and their children
                    if ((obj as any).isGridCell && (obj as any).gridGroupId) {
                        const gid = (obj as any).gridGroupId;
                        const siblings = canvas.value.getObjects().filter(
                            (o: any) => o !== obj && o.gridGroupId === gid && o.isGridCell
                        );
                        for (const sib of siblings) {
                            // Remove children parented to this cell
                            const children = canvas.value.getObjects().filter(
                                (ch: any) => ch.parentFrameId === sib._customId
                            );
                            children.forEach((ch: any) => { try { canvas.value!.remove(ch); } catch {} });
                            try { canvas.value.remove(sib); } catch {}
                        }
                        // Remove children of the deleted cell itself
                        const ownChildren = canvas.value.getObjects().filter(
                            (ch: any) => ch.parentFrameId === (obj as any)._customId
                        );
                        ownChildren.forEach((ch: any) => { try { canvas.value!.remove(ch); } catch {} });
                    }
                    canvas.value.remove(obj);
                    console.log('🗑️ [Delete] Objeto removido do canvas:', obj.name || obj._customId);
                } catch (err) {
                    console.warn('[Delete] Erro ao remover do canvas:', err);
                }
            }
            
            canvas.value.requestRenderAll();
            saveCurrentState();
        }
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
            canvas.value.requestRenderAll();
            saveCurrentState();
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
            }
            if (active.isFrame) {
                const dx = active.left - prevLeft;
                const dy = active.top - prevTop;
                moveFrameDescendants(active, dx, dy);
                getOrCreateFrameClipRect(active);
            }
            canvas.value.requestRenderAll();
            updateScrollbars(); // Update bars when moving via keys
        } else {
            // If no object selected, arrows pan the canvas
            e.preventDefault();
            const step = 20;
            const vpt = canvas.value.viewportTransform;
            if (e.key === 'ArrowUp') vpt[5] += step;
            if (e.key === 'ArrowDown') vpt[5] -= step;
            if (e.key === 'ArrowLeft') vpt[4] += step;
            if (e.key === 'ArrowRight') vpt[4] -= step;
            canvas.value.requestRenderAll();
            updateScrollbars();
        }
    }

    // Copy / Paste (Simple Clone)
    // Fabric v7 clone() returns a Promise; the legacy callback signature throws ("t2 is not iterable").
    if (isCtrl && String(e.key || '').toLowerCase() === 'c') {
        const active = canvas.value.getActiveObject();
        if (active) {
            e.preventDefault();
            try {
                const cloned = await (active as any).clone([
                    '_customId',
                    'name',
                    'layerName',
                    'parentFrameId',
                    'parentZoneId',
                    'isSmartObject',
                    'isProductCard',
                    'opacity',
                    'flipX',
                    'flipY',
                    'clipPath',
                    'filters',
                    'originX',
                    'originY',
                    'angle',
                    'scaleX',
                    'scaleY'
                ]);
                
                // Store the parent group reference for paste operation
                // CRITICAL: Store both the reference AND the _customId for reliable lookup
                const parentGroup = (active as any).group;
                (cloned as any)._sourceGroupRef = parentGroup;
                (cloned as any)._sourceGroupId = parentGroup?._customId || null;
                
                // CRITICAL: Store the ORIGINAL group-local coordinates from the active object
                // These are the coordinates relative to the group center (where 0,0 is center)
                (cloned as any)._sourceLeft = Number(active.left) || 0;
                (cloned as any)._sourceTop = Number(active.top) || 0;
                
                // Also search for the parent group in canvas if not found via .group property
                // This handles cases where deep-select doesn't set .group correctly
                if (!parentGroup && String(active.type || '').toLowerCase() === 'image') {
                    const allObjects = canvas.value.getObjects();
                    for (const obj of allObjects) {
                        if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
                            if (typeof obj.getObjects === 'function') {
                                const children = obj.getObjects();
                                const containsImage = children.some((child: any) => 
                                    child === active || child._customId === active._customId
                                );
                                if (containsImage) {
                                    (cloned as any)._sourceGroupRef = obj;
                                    (cloned as any)._sourceGroupId = obj._customId;
                                    console.log('📋 [copy] Found parent group via canvas search:', obj._customId || obj.name);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                (window as any)._clipboard = cloned;
                console.log('📋 [copy] Stored clipboard:', {
                    sourceGroupId: (cloned as any)._sourceGroupId,
                    sourceLeft: (cloned as any)._sourceLeft,
                    sourceTop: (cloned as any)._sourceTop
                });
            } catch (err) {
                console.warn('[clipboard] Falha ao copiar (clone)', err);
            }
        }
    }

    if (isCtrl && String(e.key || '').toLowerCase() === 'v') {
        const clip = (window as any)._clipboard;
        if (clip) {
            e.preventDefault();
            
            // CRITICAL: Get active object BEFORE discarding to check parent group
            const activeBeforePaste = canvas.value.getActiveObject();
            
            try {
                const cloned: any = await (clip as any).clone([
                    '_customId',
                    'name',
                    'layerName',
                    'parentFrameId',
                    'parentZoneId',
                    'isSmartObject',
                    'isProductCard',
                    'opacity',
                    'flipX',
                    'flipY',
                    'clipPath',
                    'filters',
                    'originX',
                    'originY',
                    'angle',
                    'scaleX',
                    'scaleY'
                ]);

                // CRITICAL: Find the parent group - PRIORITY is the clipboard's stored group
                // This ensures images pasted back go to the same container they were copied from
                let originalParentGroup = null;
                
                // FIRST PRIORITY: Use the stored group from clipboard (where the image was copied from)
                const sourceGroupId = (clip as any)._sourceGroupId;
                const sourceGroupRef = (clip as any)._sourceGroupRef;
                
                if (sourceGroupId || sourceGroupRef) {
                    const allObjects = canvas.value.getObjects();
                    // Try to find the group by ID first (most reliable)
                    if (sourceGroupId) {
                        originalParentGroup = allObjects.find((obj: any) => 
                            obj._customId === sourceGroupId && 
                            obj.type === 'group' &&
                            (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                        ) || null;
                    }
                    // Fallback to reference check
                    if (!originalParentGroup && sourceGroupRef) {
                        originalParentGroup = allObjects.find((obj: any) => 
                            obj === sourceGroupRef && 
                            (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))
                        ) || null;
                    }
                    
                    if (originalParentGroup) {
                        console.log('📦 [paste] Found source group from clipboard:', originalParentGroup._customId || originalParentGroup.name);
                    }
                }
                
                // SECOND PRIORITY: Check if activeBeforePaste is an image inside a product card
                if (!originalParentGroup && activeBeforePaste && String(activeBeforePaste.type || '').toLowerCase() === 'image') {
                    // Search all groups in the canvas to find which one contains this image
                    const allObjects = canvas.value.getObjects();
                    for (const obj of allObjects) {
                        if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
                            // Check if this group contains the active image
                            if (typeof obj.getObjects === 'function') {
                                const children = obj.getObjects();
                                const containsActiveImage = children.some((child: any) => 
                                    child === activeBeforePaste || 
                                    child._customId === activeBeforePaste._customId
                                );
                                if (containsActiveImage) {
                                    originalParentGroup = obj;
                                    console.log('📦 [paste] Found group via active image:', obj._customId || obj.name);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // THIRD PRIORITY: Check if activeBeforePaste is a product card group itself
                if (!originalParentGroup && activeBeforePaste) {
                    if (activeBeforePaste.type === 'group' && (activeBeforePaste.isSmartObject || activeBeforePaste.isProductCard || isLikelyProductCard(activeBeforePaste))) {
                        originalParentGroup = activeBeforePaste;
                        console.log('📦 [paste] Active object is a product card group:', activeBeforePaste._customId || activeBeforePaste.name);
                    } else if ((activeBeforePaste as any).group) {
                        const parentGroup = (activeBeforePaste as any).group;
                        if (parentGroup.isSmartObject || parentGroup.isProductCard || isLikelyProductCard(parentGroup)) {
                            originalParentGroup = parentGroup;
                            console.log('📦 [paste] Found via activeBeforePaste.group:', parentGroup._customId || parentGroup.name);
                        }
                    }
                }

                const isProductCardGroup =
                    originalParentGroup &&
                    String(originalParentGroup.type || '').toLowerCase() === 'group' &&
                    (originalParentGroup.isSmartObject || originalParentGroup.isProductCard || String(originalParentGroup.name || '').startsWith('product-card') || isLikelyProductCard(originalParentGroup));
                const isInnerImage = String((clip as any).type || '').toLowerCase() === 'image';
                
                // Check if the cloned object itself is a product card (to prevent duplicating containers)
                const isPastingProductCard = 
                    String(cloned.type || '').toLowerCase() === 'group' &&
                    (cloned.isSmartObject || cloned.isProductCard || String(cloned.name || '').startsWith('product-card') || isLikelyProductCard(cloned));

                console.log('🔍 Paste check:', {
                    hasParentGroup: !!originalParentGroup,
                    isProductCardGroup,
                    isInnerImage,
                    isPastingProductCard,
                    clipType: clip.type,
                    activeObjType: activeBeforePaste?.type,
                    parentGroupName: originalParentGroup?.name || originalParentGroup?._customId,
                    groupChildrenCount: originalParentGroup ? (typeof originalParentGroup.getObjects === 'function' ? originalParentGroup.getObjects().length : 0) : 0
                });

                canvas.value.discardActiveObject();

                // PREVENT: If copying a product card itself, DO NOT paste it (would create duplicate container)
                if (isPastingProductCard) {
                    console.warn('⚠️ Não é possível colar um container de produto inteiro. Cole apenas as imagens dentro do container.');
                    return;
                }

                // If pasting an image that was inside a product card, paste it back into the same group
                if (isProductCardGroup && isInnerImage && originalParentGroup) {
                    cloned._customId = Math.random().toString(36).substr(2, 9);
                    
                    // CRITICAL FIX: Use the ORIGINAL coordinates from when the image was copied
                    // These are stored in the clipboard and are relative to the group center
                    let targetLeft = Number((clip as any)._sourceLeft) || 0;
                    let targetTop = Number((clip as any)._sourceTop) || 0;
                    
                    // Apply small offset so the pasted image is visible (like Ctrl+D does)
                    targetLeft += 20;
                    targetTop += 20;
                    
                    console.log('📍 Paste coordinates (from clipboard source):', {
                        sourceLeft: (clip as any)._sourceLeft,
                        sourceTop: (clip as any)._sourceTop,
                        targetLeft,
                        targetTop,
                        groupWidth: originalParentGroup.width,
                        groupHeight: originalParentGroup.height
                    });
                    
                    // IMPORTANT: When adding an object into an existing group, Fabric expects object coords in CANVAS space.
                    // It will convert them into group-local space when entering the group.
                    const targetCanvas = groupLocalToCanvasPoint(originalParentGroup, targetLeft, targetTop);

                    cloned.set({
                        left: targetCanvas.x,
                        top: targetCanvas.y,
                        originX: 'center',
                        originY: 'center',
                        angle: clip.angle || 0,
                        scaleX: clip.scaleX || 1,
                        scaleY: clip.scaleY || 1,
                        flipX: !!clip.flipX,
                        flipY: !!clip.flipY,
                        opacity: clip.opacity ?? 1,
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true,
                    });

                    console.log('📦 Adicionando imagem ao grupo:', {
                        groupName: originalParentGroup.name || originalParentGroup._customId,
                        childrenBefore: originalParentGroup.getObjects().length,
                        clonedCoords: { left: cloned.left, top: cloned.top }
                    });
                    
                    // CRITICAL: Add via safeAddWithUpdate(group, obj) so Fabric enters group coordinate system correctly.
                    // This prevents the object from rendering using canvas coords ("nasce fora").
                    safeAddWithUpdate(originalParentGroup, cloned);

                    // Ensure parent stays in deep-select mode (same as duplicate)
                    originalParentGroup.set({ subTargetCheck: true, interactive: true });
                    originalParentGroup.setCoords?.();
                    
                    console.log('✅ Imagem adicionada ao grupo:', {
                        groupName: originalParentGroup.name || originalParentGroup._customId,
                        childrenAfter: originalParentGroup.getObjects().length,
                        clonedId: cloned._customId,
                        clonedFinalCoords: { left: cloned.left, top: cloned.top }
                    });

                    // Select the cloned image (important: select within the group context)
                    canvas.value.setActiveObject(cloned);
                    canvas.value.requestRenderAll();
                    canvasObjects.value = [...canvas.value.getObjects()];
                    saveCurrentState();
                } else {
                    // Regular paste behavior for non-product-card objects
                    cloned.set({
                        left: (Number(cloned.left) || 0) + 20,
                        top: (Number(cloned.top) || 0) + 20,
                        evented: true,
                        selectable: true,
                    });

                    // Assign new IDs
                    if (cloned.type === 'activeSelection') {
                        cloned.canvas = canvas.value;
                        cloned.forEachObject((obj: any) => {
                            obj._customId = Math.random().toString(36).substr(2, 9);
                            canvas.value.add(obj);
                        });
                        cloned.setCoords?.();
                    } else {
                        cloned._customId = Math.random().toString(36).substr(2, 9);
                        canvas.value.add(cloned);
                    }

                    canvas.value.setActiveObject(cloned);
                    canvas.value.requestRenderAll();
                    saveCurrentState();
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
        if ((active as any).isFrame) {
            await duplicateFrameWithContents(active);
            return;
        }

        // Special case: duplicating the product image inside a product card (group).
        // When an inner image is selected (deep select), cloning it to the canvas would use group-local coords and look "broken".
        // We duplicate inside the same group so it behaves predictably.
        const parentGroup = (active as any).group;
        const isProductCardGroup =
            parentGroup &&
            String(parentGroup.type || '').toLowerCase() === 'group' &&
            (parentGroup.isSmartObject || parentGroup.isProductCard || String(parentGroup.name || '').startsWith('product-card') || isLikelyProductCard(parentGroup));
        const isInnerImage = String((active as any).type || '').toLowerCase() === 'image' && !!parentGroup;

        if (isProductCardGroup && isInnerImage) {
            try {
                const cloned: any = await (active as any).clone(['_customId', 'name', 'opacity', 'flipX', 'flipY', 'clipPath', 'filters']);
                if (!cloned) return;
                cloned._customId = Math.random().toString(36).substr(2, 9);
                cloned.set({
                    left: (Number(active.left) || 0) + 20,
                    top: (Number(active.top) || 0) + 20,
                    originX: active.originX || 'center',
                    originY: active.originY || 'center',
                    angle: active.angle || 0,
                    scaleX: active.scaleX || 1,
                    scaleY: active.scaleY || 1,
                    flipX: !!active.flipX,
                    flipY: !!active.flipY,
                    opacity: active.opacity ?? 1,
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                });

                // Insert right after the original when possible
                try {
                    const list = typeof parentGroup.getObjects === 'function' ? parentGroup.getObjects() : [];
                    const idx = Array.isArray(list) ? list.indexOf(active) : -1;
                    if (typeof parentGroup.insertAt === 'function' && idx >= 0) parentGroup.insertAt(cloned, idx + 1);
                    else parentGroup.add(cloned);
                } catch {
                    parentGroup.add(cloned);
                }

                // Ensure parent stays in deep-select mode so the new image can be selected/moved.
                parentGroup.set({ subTargetCheck: true, interactive: true });
                safeAddWithUpdate(parentGroup);
                parentGroup.setCoords?.();

                // Select the clone
                canvas.value.setActiveObject(cloned);
                canvas.value.requestRenderAll();
                canvasObjects.value = [...canvas.value.getObjects()];
                saveCurrentState({ reason: 'duplicate-inside-card' });
                triggerAutoSave();
            } catch (err) {
                console.warn('[duplicate] Falha ao duplicar imagem interna', err);
            }
            return;
        }

        // Clone o objeto ativo
        try {
            const cloned: any = await (active as any).clone(['_customId', 'isFrame', 'layerName', 'clipContent', 'parentFrameId', 'parentZoneId', 'isSmartObject', 'isProductCard', 'name', 'isGridCell', 'gridGroupId', 'gridCol', 'gridRow']);
            // Offset para posicionar o clone ao lado do original
            const offset = 20;
            cloned.set({
                left: (cloned.left || active.left) + offset,
                top: (cloned.top || active.top) + offset,
                evented: true,
                selectable: true,
            });

            // Se for uma seleção múltipla (activeSelection)
            if (cloned.type === 'activeSelection') {
                cloned.canvas = canvas.value;
                // Adiciona cada objeto do grupo e atribui novos IDs
                cloned.forEachObject((obj: any) => {
                    obj._customId = Math.random().toString(36).substr(2, 9);
                    // Se o objeto tinha parentFrameId, mantém a referência
                    if (active.parentFrameId && !obj.parentFrameId) {
                        obj.parentFrameId = active.parentFrameId;
                    }
                    canvas.value.add(obj);
                });
                cloned.setCoords();
            } else {
                // Objeto único - atribui novo ID
                cloned._customId = Math.random().toString(36).substr(2, 9);
                
                // Preserva propriedades customizadas importantes
                if (active.isFrame) {
                    cloned.isFrame = true;
                    cloned.layerName = active.layerName || 'FRAMER';
                    cloned.clipContent = active.clipContent !== false;
                    cloned.stroke = active.stroke || '#0d99ff';
                }
                
                // Se tinha parentFrameId, mantém a referência
                if (active.parentFrameId) {
                    cloned.parentFrameId = active.parentFrameId;
                }
                
                // Se tinha parentZoneId (para cards de produtos), mantém
                if (active.parentZoneId) {
                    cloned.parentZoneId = active.parentZoneId;
                }
                
                canvas.value.add(cloned);
            }

            // Seleciona o clone e atualiza o canvas
            canvas.value.setActiveObject(cloned);
            canvas.value.requestRenderAll();
            
            // Atualiza a lista de objetos para o LayersPanel
            canvasObjects.value = [...canvas.value.getObjects()];
            
            // Salva o estado para histórico e persistência
            saveCurrentState({ reason: 'duplicate-selection' });
            triggerAutoSave();
        } catch (err) {
            console.warn('[duplicate] Falha ao duplicar seleção', err);
        }
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

const setupZoomPan = () => {
    if (!canvas.value) return; 

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

    // Wheel Zoom & Pan
    canvas.value.on('mouse:wheel', (opt: any) => {
        const delta = opt.e.deltaY;
        const evt = opt.e;
        
        // Ctrl/Cmd + Wheel to ZOOM
        if (evt.ctrlKey || evt.metaKey) {
            let zoom = canvas.value.getZoom();
            zoom *= 0.999 ** delta;
            if (zoom > 20) zoom = 20;
            if (zoom < 0.01) zoom = 0.01;
            canvas.value.zoomToPoint({ x: evt.offsetX, y: evt.offsetY }, zoom);
            canvas.value.requestRenderAll();
            updateZoomState();
        } else {
            // Standard Wheel = PAN by changing ViewportTransform
            const vpt = canvas.value.viewportTransform;
            if (vpt) {
                 // Pan vertical by default
                 vpt[5] -= delta; 
                 
                 // Pan horizontal when shift key is pressed OR for horizontal scrolling
                 if (evt.shiftKey || evt.deltaX !== 0) {
                     vpt[4] -= (evt.deltaX || delta); // Use deltaX if available, otherwise use delta
                 }
                 
                 canvas.value.requestRenderAll();
                 updateScrollbars();
            }
        }
        
        evt.preventDefault();
        evt.stopPropagation();
    });

    // Middle Click Pan / Space Pan logic often handled by keydown space
    let isDragging = false;
    let lastPosX = 0;
    let lastPosY = 0;

    canvas.value.on('mouse:down', (opt: any) => {
        const evt = opt.e;
        
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
                
                // Find nearest segment
                let minDist = Infinity;
                let nearestSegmentIndex = -1;
                
                for (let i = 0; i < pathData.length - 1; i++) {
                    const p1 = pathData[i];
                    const p2 = pathData[i + 1];
                    
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
            // Check for product zone using isLikelyProductZone to handle both isGridZone and isProductZone
            if (isLikelyProductZone(opt.target)) {
                // Save reference to the zone for later use during import
                targetGridZone.value = opt.target;
                try {
                    productImportExistingCount.value = getZoneChildren(opt.target).length;
                } catch {
                    productImportExistingCount.value = 0;
                }
                // Open the Product Review Modal directly (same as Assets panel)
                showProductReviewModal.value = true;
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
                    
                    const nodes = canvas.value.getObjects().filter((o: any) => 
                        o.name === 'path_node' && o.data.parentPath === parentPath && o.data.index === nodeIndex
                    );
                    const handles = canvas.value.getObjects().filter((o: any) => 
                        o.name === 'bezier_handle' && o.data.parentPath === parentPath && o.data.index === nodeIndex
                    );
                    
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
        isDragging = false;
        
        if (isDragging) {
             canvas.value.setViewportTransform(canvas.value.viewportTransform);
             isDragging = false;
             canvas.value.selection = true;
             canvas.value.defaultCursor = 'default';
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
                 canvas.value.requestRenderAll();
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
        
        canvas.value.requestRenderAll();
        
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
        
        // Rebuild path string
        let pathString = '';
        updatedPathData.forEach((point: any, index: number) => {
            if (index === 0) {
                pathString += `M ${point.x} ${point.y}`;
            } else {
                const prevPoint = updatedPathData[index - 1];
                if (point.handles && point.handles.in) {
                    const cp1x = prevPoint.handles?.out?.x || prevPoint.x;
                    const cp1y = prevPoint.handles?.out?.y || prevPoint.y;
                    const cp2x = point.handles.in.x;
                    const cp2y = point.handles.in.y;
                    pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
                } else {
                    pathString += ` L ${point.x} ${point.y}`;
                }
            }
        });
        
        // Update path
        pathObj.set('path', fabric.util.parsePath(pathString));
        pathObj.penPathData = updatedPathData;
        pathObj.setCoords();
        canvas.value.requestRenderAll();
        
        // Only save state if not skipping (skip during real-time updates)
        if (!skipSave) {
            saveCurrentState();
        }
    }
}

// ============================================================================
// FIGMA CURVE FUNCTIONS - Convert, Mirror, Reset, Smooth
// ============================================================================

// Convert point to smooth (with handles)
const convertPointToSmooth = (pathObj: any, index: number) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (index < 0 || index >= pathData.length) return;
    
    const point = pathData[index];
    
    // If point already has handles, make them symmetric
    if (point.handles) {
        smoothHandles(pathObj, index);
        return;
    }
    
    // Calculate direction from adjacent segments
    const prevPoint = index > 0 ? pathData[index - 1] : null;
    const nextPoint = index < pathData.length - 1 ? pathData[index + 1] : null;
    
    let handleLength = 30; // Default handle length
    
    if (prevPoint && nextPoint) {
        // Calculate average direction
        const dx1 = point.x - prevPoint.x;
        const dy1 = point.y - prevPoint.y;
        const dx2 = nextPoint.x - point.x;
        const dy2 = nextPoint.y - point.y;
        
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        if (len1 > 0 && len2 > 0) {
            const avgDx = (dx1 / len1 + dx2 / len2) / 2;
            const avgDy = (dy1 / len1 + dy2 / len2) / 2;
            const avgLen = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
            
            if (avgLen > 0) {
                handleLength = Math.min(len1, len2) * 0.3;
                const normalizedDx = avgDx / avgLen;
                const normalizedDy = avgDy / avgLen;
                
                point.handles = {
                    in: {
                        x: point.x - normalizedDx * handleLength,
                        y: point.y - normalizedDy * handleLength
                    },
                    out: {
                        x: point.x + normalizedDx * handleLength,
                        y: point.y + normalizedDy * handleLength
                    }
                };
            }
        }
    } else if (prevPoint) {
        // Only previous point - use its direction
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            point.handles = {
                in: {
                    x: point.x - (dx / len) * handleLength,
                    y: point.y - (dy / len) * handleLength
                },
                out: {
                    x: point.x + (dx / len) * handleLength,
                    y: point.y + (dy / len) * handleLength
                }
            };
        }
    } else if (nextPoint) {
        // Only next point - use its direction
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            point.handles = {
                in: {
                    x: point.x - (dx / len) * handleLength,
                    y: point.y - (dy / len) * handleLength
                },
                out: {
                    x: point.x + (dx / len) * handleLength,
                    y: point.y + (dy / len) * handleLength
                }
            };
        }
    }
    
    // Rebuild path
    rebuildPathFromData(pathObj);
    // Refresh editing mode if active
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        exitNodeEditing();
        enterPathNodeEditing(pathObj);
    }
}

// Convert point to corner (remove handles)
const convertPointToCorner = (pathObj: any, index: number) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (index < 0 || index >= pathData.length) return;
    
    const point = pathData[index];
    delete point.handles;
    
    // Rebuild path
    rebuildPathFromData(pathObj);
    // Refresh editing mode if active
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        exitNodeEditing();
        enterPathNodeEditing(pathObj);
    }
}

// Mirror handles (make symmetric)
const mirrorHandles = (pathObj: any, index: number) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (index < 0 || index >= pathData.length) return;
    
    const point = pathData[index];
    if (!point.handles) return;
    
    // Get current handle positions from canvas if in editing mode
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        const vpt = canvas.value.viewportTransform;
        const zoom = canvas.value.getZoom();
        
        const handles = canvas.value.getObjects().filter((o: any) => 
            o.name === 'bezier_handle' && 
            o.data.parentPath === pathObj && 
            o.data.index === index
        );
        
        const handleIn = handles.find((h: any) => h.data.type === 'handle_in');
        const handleOut = handles.find((h: any) => h.data.type === 'handle_out');
        
        if (handleIn && handleOut) {
            // Calculate node position
            const nodes = canvas.value.getObjects().filter((o: any) => 
                o.name === 'path_node' && o.data.parentPath === pathObj && o.data.index === index
            );
            if (nodes.length > 0) {
                const node = nodes[0];
                const nodeX = (node.left - vpt[4]) / zoom;
                const nodeY = (node.top - vpt[5]) / zoom;
                
                const handleInX = (handleIn.left - vpt[4]) / zoom;
                const handleInY = (handleIn.top - vpt[5]) / zoom;
                
                // Calculate distance and angle
                const dx = handleInX - nodeX;
                const dy = handleInY - nodeY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // Mirror: out handle should be opposite direction
                    point.handles.out = {
                        x: nodeX - dx,
                        y: nodeY - dy
                    };
                    
                    // Update handle position in canvas
                    handleOut.set({
                        left: point.handles.out.x * zoom + vpt[4],
                        top: point.handles.out.y * zoom + vpt[5]
                    });
                }
            }
        }
    } else {
        // Mirror based on stored data
        if (point.handles.in && point.handles.out) {
            const dx = point.handles.in.x - point.x;
            const dy = point.handles.in.y - point.y;
            point.handles.out = {
                x: point.x - dx,
                y: point.y - dy
            };
        }
    }
    
    rebuildPathFromData(pathObj);
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        updateHandleLines(pathObj);
        canvas.value.requestRenderAll();
    }
}

// Reset handles (remove them)
const resetHandles = (pathObj: any, index: number) => {
    convertPointToCorner(pathObj, index);
}

// Smooth handles (make symmetric and colinear)
const smoothHandles = (pathObj: any, index: number) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (index < 0 || index >= pathData.length) return;
    
    const point = pathData[index];
    const prevPoint = index > 0 ? pathData[index - 1] : null;
    const nextPoint = index < pathData.length - 1 ? pathData[index + 1] : null;
    
    if (!prevPoint && !nextPoint) return;
    
    // Calculate average direction
    let avgDx = 0;
    let avgDy = 0;
    let totalWeight = 0;
    
    if (prevPoint) {
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            avgDx += dx / len;
            avgDy += dy / len;
            totalWeight += len;
        }
    }
    
    if (nextPoint) {
        const dx = nextPoint.x - point.x;
        const dy = nextPoint.y - point.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            avgDx += dx / len;
            avgDy += dy / len;
            totalWeight += len;
        }
    }
    
    if (totalWeight > 0) {
        avgDx /= 2;
        avgDy /= 2;
        const avgLen = Math.sqrt(avgDx * avgDx + avgDy * avgDy);
        
        if (avgLen > 0) {
            const normalizedDx = avgDx / avgLen;
            const normalizedDy = avgDy / avgLen;
            
            // Use average segment length for handle length
            let handleLength = 30;
            if (prevPoint && nextPoint) {
                const len1 = Math.sqrt(
                    Math.pow(point.x - prevPoint.x, 2) + 
                    Math.pow(point.y - prevPoint.y, 2)
                );
                const len2 = Math.sqrt(
                    Math.pow(nextPoint.x - point.x, 2) + 
                    Math.pow(nextPoint.y - point.y, 2)
                );
                handleLength = Math.min(len1, len2) * 0.3;
            }
            
            point.handles = {
                in: {
                    x: point.x - normalizedDx * handleLength,
                    y: point.y - normalizedDy * handleLength
                },
                out: {
                    x: point.x + normalizedDx * handleLength,
                    y: point.y + normalizedDy * handleLength
                }
            };
        }
    }
    
    // Rebuild path
    rebuildPathFromData(pathObj);
    // Refresh editing mode if active
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        exitNodeEditing();
        enterPathNodeEditing(pathObj);
    }
}

// Helper: Rebuild path from penPathData
const rebuildPathFromData = (pathObj: any) => {
    const pathData = pathObj.penPathData || [];
    if (pathData.length < 2) return;
    
    let pathString = '';
    pathData.forEach((point: any, index: number) => {
        if (index === 0) {
            pathString += `M ${point.x} ${point.y}`;
        } else {
            const prevPoint = pathData[index - 1];
            if (point.handles && point.handles.in) {
                const cp1x = prevPoint.handles?.out?.x || prevPoint.x;
                const cp1y = prevPoint.handles?.out?.y || prevPoint.y;
                const cp2x = point.handles.in.x;
                const cp2y = point.handles.in.y;
                pathString += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`;
            } else {
                pathString += ` L ${point.x} ${point.y}`;
            }
        }
    });
    
    pathObj.set('path', fabric.util.parsePath(pathString));
    pathObj.setCoords();
    canvas.value.requestRenderAll();
    saveCurrentState();
}

// Add point at segment midpoint
const addPointAtSegment = (pathObj: any, segmentIndex: number, position?: {x: number, y: number}) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (segmentIndex < 0 || segmentIndex >= pathData.length - 1) return;
    
    const point1 = pathData[segmentIndex];
    const point2 = pathData[segmentIndex + 1];
    
    // Calculate midpoint or use provided position
    const newPoint: any = position || {
        x: (point1.x + point2.x) / 2,
        y: (point1.y + point2.y) / 2
    };
    
    // Insert new point
    pathData.splice(segmentIndex + 1, 0, newPoint);
    
    // Update indices in editing mode
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        exitNodeEditing();
        enterPathNodeEditing(pathObj);
    } else {
        rebuildPathFromData(pathObj);
    }
}

// Remove point from path
const removePathPoint = (pathObj: any, index: number) => {
    if (!pathObj || !pathObj.isVectorPath || !pathObj.penPathData) return;
    
    const pathData = pathObj.penPathData;
    if (index < 0 || index >= pathData.length || pathData.length <= 2) return;
    
    // Remove point
    pathData.splice(index, 1);
    
    // Clear selection
    selectedPathNodeIndex.value = null;
    
    // Rebuild path
    rebuildPathFromData(pathObj);
    
    // Refresh editing mode if active
    if (isNodeEditing.value && currentEditingPath.value === pathObj) {
        exitNodeEditing();
        enterPathNodeEditing(pathObj);
    }
}

let didLoadFonts = false
const loadFonts = () => {
    if (didLoadFonts) return
    didLoadFonts = true

    // Only load WebFont on client-side (not during SSR)
    if (import.meta.client) {
        import('webfontloader').then((WebFontModule) => {
            const WebFont = WebFontModule.default || WebFontModule
            WebFont.load({
                google: {
                    families: GOOGLE_WEBFONT_FAMILIES
                },
                active: () => {
                    console.log("Fonts loaded!");
                    // CRITICAL: Clear Fabric's character-width cache so initDimensions()
                    // re-measures every glyph with the REAL font instead of reusing stale
                    // widths that were measured with the browser's fallback font.
                    try {
                        const fabricCache = (fabric as any)?.cache;
                        if (fabricCache && typeof fabricCache.clearFontCache === 'function') {
                            fabricCache.clearFontCache(); // wipe ALL font families
                        }
                    } catch (_e) { /* ignore */ }

                    if (canvas.value) {
                        const recalcText = (obj: any) => {
                            if (!obj) return;
                            const t = String(obj.type || '').toLowerCase();
                            if (t === 'i-text' || t === 'textbox' || t === 'text') {
                                if (typeof obj.initDimensions === 'function') obj.initDimensions();
                                obj.set('dirty', true);
                                if (typeof obj.setCoords === 'function') obj.setCoords();
                            }
                            // Recurse into groups (product cards, etc.)
                            if (typeof obj.getObjects === 'function') {
                                obj.getObjects().forEach(recalcText);
                                obj.set('dirty', true);
                            }
                        };
                        canvas.value.getObjects().forEach(recalcText);
                        canvas.value.requestRenderAll();
                    }
                }
            });
        })
    }
}

// --- Guias Inteligentes (Smart Guides) ---
const GUIDE_COLOR = '#ec4899';
const SNAP_RANGE = 10;

const setupSnapping = () => {
    if (!canvas.value) return;

    const verticalGuide = new fabric.Line([0, 0, 0, 10000], {
        stroke: GUIDE_COLOR,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        opacity: 0.9,
        strokeDashArray: [4, 4],
        id: 'guide-vertical',
        excludeFromExport: true
    });
    const horizontalGuide = new fabric.Line([0, 0, 10000, 0], {
        stroke: GUIDE_COLOR,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        opacity: 0.9,
        strokeDashArray: [4, 4],
        id: 'guide-horizontal',
        excludeFromExport: true
    });

    canvas.value.add(verticalGuide);
    canvas.value.add(horizontalGuide);

    // FIXED: Use local coordinates to avoid jump/snap issues
    // getBoundingRect(true, true) returns world coordinates which conflict with local positioning
    const getBounds = (o: any) => {
        // For objects inside groups, we need to calculate bounds relative to the canvas
        // Use origin-aware calculations to get consistent bounds
        const width = (o.width || 0) * (o.scaleX || 1);
        const height = (o.height || 0) * (o.scaleY || 1);

        // Calculate actual left/top based on originX/originY
        let actualLeft = o.left || 0;
        let actualTop = o.top || 0;

        if (o.originX === 'center') {
            actualLeft = (o.left || 0) - width / 2;
        } else if (o.originX === 'right') {
            actualLeft = (o.left || 0) - width;
        }

        if (o.originY === 'center') {
            actualTop = (o.top || 0) - height / 2;
        } else if (o.originY === 'bottom') {
            actualTop = (o.top || 0) - height;
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
        };
    };

    const w = (o: any) => (o.width || 0) * (o.scaleX || 1);
    const h = (o: any) => (o.height || 0) * (o.scaleY || 1);

    // FIXED: Use Fabric.js native methods for reliable positioning
    const setObjLeft = (obj: any, x: number) => {
        // Set the left edge to x, considering originX
        const width = w(obj);
        if (obj.originX === 'center') {
            obj.set('left', x + width / 2);
        } else if (obj.originX === 'right') {
            obj.set('left', x + width);
        } else {
            obj.set('left', x);
        }
    };
    const setObjRight = (obj: any, x: number) => {
        // Set the right edge to x, considering originX
        const width = w(obj);
        if (obj.originX === 'center') {
            obj.set('left', x - width / 2);
        } else if (obj.originX === 'right') {
            obj.set('left', x);
        } else {
            obj.set('left', x - width);
        }
    };
    const setObjTop = (obj: any, y: number) => {
        // Set the top edge to y, considering originY
        const height = h(obj);
        if (obj.originY === 'center') {
            obj.set('top', y + height / 2);
        } else if (obj.originY === 'bottom') {
            obj.set('top', y + height);
        } else {
            obj.set('top', y);
        }
    };
    const setObjBottom = (obj: any, y: number) => {
        // Set the bottom edge to y, considering originY
        const height = h(obj);
        if (obj.originY === 'center') {
            obj.set('top', y - height / 2);
        } else if (obj.originY === 'bottom') {
            obj.set('top', y);
        } else {
            obj.set('top', y - height);
        }
    };
    const setObjCenterX = (obj: any, x: number) => {
        // FIXED: Position center at x
        // When originX='left', center is at left + width/2, so left = x - width/2
        // When originX='center', center is at left, so left = x
        // When originX='right', center is at left - width/2, so left = x + width/2
        const width = w(obj);
        if (obj.originX === 'left') {
            obj.set('left', x - width / 2);
        } else if (obj.originX === 'right') {
            obj.set('left', x + width / 2);
        } else {
            obj.set('left', x);
        }
    };
    const setObjCenterY = (obj: any, y: number) => {
        // FIXED: Position center at y
        // When originY='top', center is at top + height/2, so top = y - height/2
        // When originY='center', center is at top, so top = y
        // When originY='bottom', center is at top - height/2, so top = y + height/2
        const height = h(obj);
        if (obj.originY === 'top') {
            obj.set('top', y - height / 2);
        } else if (obj.originY === 'bottom') {
            obj.set('top', y + height / 2);
        } else {
            obj.set('top', y);
        }
    };

    const isControl = (o: any) => {
        const n = (o?.name || '').toString();
        return n === 'path_node' || n === 'bezier_handle' || n === 'control_point' || n === 'handle_line';
    };

    // === SNAP TARGET CACHING: avoid recalculating on every mouse move ===
    let cachedSnapTargets: any[] | null = null;
    let cachedSnapExclude: any = null;

    const getSnapTargets = (exclude: any) => {
        // Return cached targets if same object being dragged
        if (cachedSnapTargets && cachedSnapExclude === exclude) return cachedSnapTargets;

        const all = canvas.value!.getObjects();
        // Get the parent frame ID of the object being moved (if any)
        const parentFrameId = (exclude as any)?.parentFrameId as string | undefined;
        
        cachedSnapTargets = all.filter((o: any) => {
            if (!o || o === exclude) return false;
            if (o.excludeFromExport || isControl(o)) return false;
            if (o.id === 'artboard-bg' || o.id === 'guide-vertical' || o.id === 'guide-horizontal') return false;
            // CRITICAL: Exclude the parent frame from snap targets to prevent the object
            // from being "stuck" snapping to its own container
            if (parentFrameId && o.isFrame && o._customId === parentFrameId) return false;
            return true;
        });
        cachedSnapExclude = exclude;
        return cachedSnapTargets;
    };

    let lastPointer = { x: 0, y: 0 };
    let constrainAxis: 'x' | 'y' | null = null;
    let constrainRef = { left: 0, top: 0 };

    const getPointer = (evt: MouseEvent) => {
        const el = canvasEl.value || canvas.value?.getElement?.();
        if (!el || !canvas.value) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        const vpt = canvas.value.viewportTransform || [1, 0, 0, 1, 0, 0];
        const z = canvas.value.getZoom() || 1;
        return {
            x: (evt.clientX - rect.left - vpt[4]) / z,
            y: (evt.clientY - rect.top - vpt[5]) / z
        };
    };

    canvas.value.on('object:moving', (e: any) => {
        const obj = e.target;
        const evt = e.e as MouseEvent | undefined;
        
        // Hide guides by default
        verticalGuide.set({ visible: false });
        horizontalGuide.set({ visible: false });
        
        // Skip for frames and controls
        if (!obj || obj.isFrame || isControl(obj)) {
            return;
        }

        // If moving a child inside a legacy product card, upgrade the parent group so containment works.
        if (obj.group && !obj.group.isSmartObject && !obj.group.isProductCard && isLikelyProductCard(obj.group)) {
            obj.group.isSmartObject = true;
            obj.group.isProductCard = true;
        }

        // Mark object dirty to ensure fresh render (keep caching enabled for performance)
        obj.set('dirty', true);

        // CRITICAL: Update clipPath for objects inside frames with clipping enabled
        // This ensures the image stays clipped within the frame bounds while moving
        if ((obj as any).parentFrameId) {
            const frame = getFrameById((obj as any).parentFrameId);
            if (frame && frame.clipContent && obj.clipPath) {
                // Update the clipPath position/angle to match the new object position
                const objCenter = obj.getCenterPoint ? obj.getCenterPoint() : { x: obj.left, y: obj.top };
                const frameCenter = frame.getCenterPoint ? frame.getCenterPoint() : { x: frame.left, y: frame.top };

                obj.clipPath.set({
                    left: frameCenter.x - objCenter.x,
                    top: frameCenter.y - objCenter.y,
                    angle: (frame.angle || 0) - (obj.angle || 0)
                });
                obj.clipPath.setCoords();
                obj.clipPath.dirty = true;
            }
        }

        // SmartObject containment
        if (obj.group && (obj.group as any).isSmartObject) {
            const parentGroup = obj.group;
            const cardW = (parentGroup as any)._cardWidth || parentGroup.width;
            const cardH = (parentGroup as any)._cardHeight || parentGroup.height;

            // Mark as user-customized so future relayouts (zone recalculation / reload) don't override placement.
            // Persisted via `CANVAS_CUSTOM_PROPS`.
            (obj as any).__manualTransform = true;
            (obj as any).__manualTransformCardW = Number(cardW) || (obj as any).__manualTransformCardW;
            (obj as any).__manualTransformCardH = Number(cardH) || (obj as any).__manualTransformCardH;

            const halfW = cardW / 2, halfH = cardH / 2;
            const objW = obj.getScaledWidth(), objH = obj.getScaledHeight();
            let minX = -halfW, maxX = halfW, minY = -halfH, maxY = halfH;
            if (obj.originX === 'center') { minX = -halfW + objW / 2; maxX = halfW - objW / 2; } else if (obj.originX === 'left') { maxX = halfW - objW; }
            if (obj.originY === 'center') { minY = -halfH + objH / 2; maxY = halfH - objH / 2; } else if (obj.originY === 'top') { maxY = halfH - objH; }
            // If the inner object is larger than the card, the computed range is inverted.
            // Swap so clamping does not "teleport" the object to the opposite side.
            if (minX > maxX) { const t = minX; minX = maxX; maxX = t; }
            if (minY > maxY) { const t = minY; minY = maxY; maxY = t; }
            if (obj.left < minX) obj.set('left', minX); if (obj.left > maxX) obj.set('left', maxX);
            if (obj.top < minY) obj.set('top', minY); if (obj.top > maxY) obj.set('top', maxY);
            obj.setCoords?.();
            return;
        }

        // Card-in-zone containment (cards are NOT children of the zone group; they are bound via parentZoneId)
        // Include legacy cards detected by heuristic. If parentZoneId is missing/invalid, try to rebind to the zone under it.
        const isCardLike = !!(
            obj.isSmartObject ||
            obj.isProductCard ||
            String(obj.name || '').startsWith('product-card') ||
            isLikelyProductCard(obj) ||
            String((obj as any).parentZoneId || '').trim().length
        );
        if (isCardLike) {
            // Upgrade legacy cards so downstream logic is consistent.
            if (!obj.isProductCard && !obj.isSmartObject && isLikelyProductCard(obj)) {
                obj.isProductCard = true;
                obj.isSmartObject = true;
            }

            let zone: any = null;
            const zoneId = String((obj as any).parentZoneId || '');
            if (zoneId) {
                zone = canvas.value!.getObjects().find((o: any) => isLikelyProductZone(o) && o?._customId === zoneId);
            }

            // If zone is missing, try to find one by intersection/nearest.
            if (!zone) {
                const zones = canvas.value!.getObjects().filter((o: any) => isLikelyProductZone(o));
                const center = typeof obj.getCenterPoint === 'function'
                    ? obj.getCenterPoint()
                    : { x: Number(obj.left || 0), y: Number(obj.top || 0) };

                let bestZone: any = null;
                let bestD2 = Infinity;
                for (const z of zones) {
                    try {
                        if (typeof z.intersectsWithObject === 'function' && z.intersectsWithObject(obj)) {
                            bestZone = z;
                            bestD2 = 0;
                            break;
                        }
                    } catch {
                        // ignore
                    }
                    const zm = getZoneMetrics(z) ?? z.getBoundingRect(true);
                    const zx = (zm.centerX ?? (zm.left + zm.width / 2));
                    const zy = (zm.centerY ?? (zm.top + zm.height / 2));
                    const dx = center.x - zx;
                    const dy = center.y - zy;
                    const d2 = (dx * dx) + (dy * dy);
                    if (d2 < bestD2) {
                        bestD2 = d2;
                        bestZone = z;
                    }
                }

                if (bestZone) {
                    // Only bind if reasonably close; avoids snapping random groups into a zone.
                    const zm = getZoneMetrics(bestZone) ?? bestZone.getBoundingRect(true);
                    const maxDim = Math.max(zm.width || 0, zm.height || 0);
                    const maxD = Math.max(120, maxDim * 1.75);
                    if (bestD2 <= (maxD * maxD)) {
                        (obj as any).parentZoneId = bestZone._customId;
                        zone = bestZone;
                    }
                }
            }

            if (zone) {
                const center = typeof obj.getCenterPoint === 'function' ? obj.getCenterPoint() : null;
                const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
                const objW = obj.getScaledWidth?.() ?? 0;
                const objH = obj.getScaledHeight?.() ?? 0;

                // Zone bounds constraint while dragging (reorder happens on drop).
                if (center) {
                    const zr = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
                    const pad = typeof (zone as any)._zonePadding === 'number' ? (zone as any)._zonePadding : 20;
                    const minCx = zr.left + pad + (objW / 2);
                    const maxCx = (zr.left + zr.width) - pad - (objW / 2);
                    const minCy = zr.top + pad + (objH / 2);
                    const maxCy = (zr.top + zr.height) - pad - (objH / 2);
                    const cx = clamp(center.x, minCx, maxCx);
                    const cy = clamp(center.y, minCy, maxCy);
                    setObjCenterX(obj, cx);
                    setObjCenterY(obj, cy);
                    obj.setCoords();
                }
            }
        }

        // ProductZone containment
        if (obj.group && (obj.group as any).isProductZone) {
            const zone = obj.group;
            const zoneW = (zone as any)._zoneWidth || zone.width;
            const zoneH = (zone as any)._zoneHeight || zone.height;
            const halfW = zoneW / 2, halfH = zoneH / 2;
            const cardW = obj.getScaledWidth(), cardH = obj.getScaledHeight();
            let minX = -halfW, maxX = halfW - cardW, minY = -halfH, maxY = halfH - cardH;
            if (obj.originX === 'center') { minX = -halfW + cardW / 2; maxX = halfW - cardW / 2; }
            if (obj.originY === 'center') { minY = -halfH + cardH / 2; maxY = halfH - cardH / 2; }
            if (obj.left < minX) obj.set('left', minX); if (obj.left > maxX) obj.set('left', maxX);
            if (obj.top < minY) obj.set('top', minY); if (obj.top > maxY) obj.set('top', maxY);
            return;
        }

        // SHIFT: constrain to axis
        if (evt?.shiftKey) {
            const ptr = getPointer(evt);
            const dx = Math.abs(ptr.x - lastPointer.x);
            const dy = Math.abs(ptr.y - lastPointer.y);
            if (constrainAxis === null && (dx > 2 || dy > 2)) {
                constrainAxis = dx >= dy ? 'y' : 'x';
                constrainRef = { left: obj.left, top: obj.top };
            }
            if (constrainAxis === 'x') obj.set('top', constrainRef.top);
            if (constrainAxis === 'y') obj.set('left', constrainRef.left);
            lastPointer = ptr;
            return;
        }
        constrainAxis = null;
        if (evt) lastPointer = getPointer(evt);

        // === SMART GUIDES - Calculate on-the-fly ===
        const targets = getSnapTargets(obj) || [];
        const b = getBounds(obj);
        
        // Get parent frame for snap targets (if object is inside a frame)
        const parentFrameId = (obj as any).parentFrameId as string | undefined;
        const parentFrame = parentFrameId ? canvas.value!.getObjects().find((o: any) => o.isFrame && o._customId === parentFrameId) : null;
        
        // Page/frame dimensions for center snap
        let pageCX: number, pageCY: number;
        if (parentFrame) {
            // Snap to parent frame center
            const fb = getBounds(parentFrame);
            pageCX = fb.centerX;
            pageCY = fb.centerY;
        } else {
            // Snap to page center
            const pageW = activePage.value?.width ?? 1080;
            const pageH = activePage.value?.height ?? 1920;
            pageCX = pageW / 2;
            pageCY = pageH / 2;
        }

        let vVisible = false, hVisible = false;
        let vX = 0, hY = 0;
        let bestVDist = SNAP_RANGE + 1;
        let bestHDist = SNAP_RANGE + 1;
        let snapVType: 'left' | 'right' | 'center' = 'center';
        let snapHType: 'top' | 'bottom' | 'center' = 'center';

        // Check snap against page/frame center
        const dcx = Math.abs(b.centerX - pageCX);
        const dcy = Math.abs(b.centerY - pageCY);
        if (dcx < bestVDist) { bestVDist = dcx; vX = pageCX; snapVType = 'center'; }
        if (dcy < bestHDist) { bestHDist = dcy; hY = pageCY; snapHType = 'center'; }

        // Check snap against other objects
        for (const t of targets) {
            const tb = getBounds(t);
            
            // Vertical snaps (left-left, right-right, left-right, right-left, center-center)
            const dl = Math.abs(b.left - tb.left);
            const dr = Math.abs(b.right - tb.right);
            const dlr = Math.abs(b.left - tb.right);
            const drl = Math.abs(b.right - tb.left);
            const dc = Math.abs(b.centerX - tb.centerX);
            
            if (dl < bestVDist) { bestVDist = dl; vX = tb.left; snapVType = 'left'; }
            if (dr < bestVDist) { bestVDist = dr; vX = tb.right; snapVType = 'right'; }
            if (dlr < bestVDist) { bestVDist = dlr; vX = tb.right; snapVType = 'left'; }
            if (drl < bestVDist) { bestVDist = drl; vX = tb.left; snapVType = 'right'; }
            if (dc < bestVDist) { bestVDist = dc; vX = tb.centerX; snapVType = 'center'; }
            
            // Horizontal snaps (top-top, bottom-bottom, top-bottom, bottom-top, center-center)
            const dt = Math.abs(b.top - tb.top);
            const dbo = Math.abs(b.bottom - tb.bottom);
            const dtb = Math.abs(b.top - tb.bottom);
            const dbt = Math.abs(b.bottom - tb.top);
            const dcy2 = Math.abs(b.centerY - tb.centerY);
            
            if (dt < bestHDist) { bestHDist = dt; hY = tb.top; snapHType = 'top'; }
            if (dbo < bestHDist) { bestHDist = dbo; hY = tb.bottom; snapHType = 'bottom'; }
            if (dtb < bestHDist) { bestHDist = dtb; hY = tb.bottom; snapHType = 'top'; }
            if (dbt < bestHDist) { bestHDist = dbt; hY = tb.top; snapHType = 'bottom'; }
            if (dcy2 < bestHDist) { bestHDist = dcy2; hY = tb.centerY; snapHType = 'center'; }
        }

        // Apply snap ONLY if within range
        if (bestVDist <= SNAP_RANGE) {
            if (snapVType === 'left') setObjLeft(obj, vX);
            else if (snapVType === 'right') setObjRight(obj, vX);
            else setObjCenterX(obj, vX);
            vVisible = true;
        }

        if (bestHDist <= SNAP_RANGE) {
            if (snapHType === 'top') setObjTop(obj, hY);
            else if (snapHType === 'bottom') setObjBottom(obj, hY);
            else setObjCenterY(obj, hY);
            hVisible = true;
        }

        // CRITICAL: Update object coordinates after snap to prevent jumping
        if (vVisible || hVisible) {
            obj.setCoords();
        }

        // Show guides with proper viewport-aware coordinates
        // Use canvas viewport bounds to draw guides across visible area
        const vpt = canvas.value.viewportTransform;
        const zoom = vpt ? vpt[0] : 1;
        const canvasWidth = (canvas.value.width || 1080) / zoom;
        const canvasHeight = (canvas.value.height || 1920) / zoom;

        if (vVisible) verticalGuide.set({ x1: vX, y1: -canvasHeight * 2, x2: vX, y2: canvasHeight * 3, visible: true });
        if (hVisible) horizontalGuide.set({ x1: -canvasWidth * 2, y1: hY, x2: canvasWidth * 3, y2: hY, visible: true });

        // Fabric already renders after object:moving — only force render when guide visibility actually changed
        if (vVisible || hVisible) {
            canvas.value.requestRenderAll();
        }
    });

    canvas.value.on('mouse:up', () => {
        verticalGuide.set({ visible: false });
        horizontalGuide.set({ visible: false });
        constrainAxis = null;
        // Invalidate snap target cache on mouse up
        cachedSnapTargets = null;
        cachedSnapExclude = null;
        canvas.value!.requestRenderAll();
        // CRITICAL: Create fresh snapshot (not just triggerRef) so PropertiesPanel
        // sees updated position/dimension/zone values after drag/resize.
        refreshSelectedRef();
    });
}

// Global updateFloatingUI function
const updateFloatingUI = () => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    if (active && isLikelyProductZone(active)) {
        const boundingRect = active.getBoundingRect(); 
        selectedObjectPos.value = {
            top: boundingRect.top,
            left: boundingRect.left,
            width: boundingRect.width,
            visible: true
        };
    } else {
        selectedObjectPos.value.visible = false;
    }
}

// Global updateSelection function (used by undo/redo and event handlers)
const updateSelection = () => {
    if (!canvas.value) return;

    // NOTA: sanitizeAllClipPaths removido daqui para evitar flickering.
    // Era chamado a cada clique/seleção, tocando dirty flags de todos os objetos
    // e causando re-renders desnecessários. A sanitização agora ocorre apenas
    // em momentos críticos (loadFromJSON, thumbnail, etc).

    const active = canvas.value.getActiveObject();
    // Safety: make sure Fabric has fresh control coordinates for hover/cursor logic.
    // Some legacy states can end up with missing `oCoords`, causing errors in `findControl()` on mouse move.
    try {
        active?.setCoords?.();
        (active as any)?.group?.setCoords?.();
    } catch {
        // ignore
    }

    // CRITICAL: Set zone flags BEFORE creating the snapshot so PropertiesPanel detects them.
    // Previously, flags were set after the snapshot, causing isLikelyProductZone() to fail.
    if (active && isLikelyProductZone(active)) {
        if (!active.isGridZone && !active.isProductZone) {
            if (active.name === 'gridZone') {
                active.isGridZone = true;
            } else if (active.name === 'productZoneContainer') {
                active.isProductZone = true;
            } else {
                // Default to isGridZone for zones detected by strokeDashArray
                active.isGridZone = true;
            }
        }
        ensureZoneSanity(active);
    }

	    // Ensure selectedId is never undefined - always null if no active object
	    selectedObjectId.value = active ? (active._customId ?? null) : null;
	    // Always use a stable snapshot so the PropertiesPanel never "loses" sections (e.g. `type` can be non-enumerable on Fabric objects).
	    selectedObjectRef.value = active ? snapshotForPropertiesPanel(active) : null;
	    updateFloatingUI();
	    
	    // Show contextual toolbar for vector paths
	    showPenContextualToolbar.value = !!(active && active.isVectorPath);
    
    // Render canvas to show frame label when frame is selected
    // NOTA: Removido requestRenderAll extra aqui — o Fabric já re-renderiza
    // automaticamente ao mudar seleção. O throttledUpdateFrameLabels (via after:render)
    // cuidará de atualizar os labels HTML dos frames.
    
    // Sync Product Zone State
    if (active && isLikelyProductZone(active)) {
        // Initialize state from object data
        const pad = typeof active._zonePadding === 'number' ? active._zonePadding : (active.padding || 20);
        const zoneConfig = {
            columns: active.columns || 0,
            rows: active.rows || 0,
            padding: pad,
            gapHorizontal: typeof active.gapHorizontal === 'number' ? active.gapHorizontal : pad,
            gapVertical: typeof active.gapVertical === 'number' ? active.gapVertical : pad,
            layoutDirection: active.layoutDirection || 'horizontal',
            cardAspectRatio: active.cardAspectRatio || 'auto',
            lastRowBehavior: active.lastRowBehavior || 'fill',
            verticalAlign: active.verticalAlign || 'top',
            highlightCount: active.highlightCount || 0,
            highlightPos: active.highlightPos || 'first',
            highlightHeight: active.highlightHeight || 1.5,
            isLocked: !!(active.lockMovementX || active.lockMovementY || active.lockScalingX || active.lockScalingY),
        };
        productZoneState.updateZone(zoneConfig);
        const zoneStyles = (active as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value ?? {};
        productZoneState.updateGlobalStyles(zoneStyles);
    }
    // Se um card de produto for selecionado, carregar os estilos da zona pai
    else if (active && isLikelyProductCard(active)) {
        const parentZoneId = active.parentZoneId;
        if (parentZoneId && canvas.value) {
            const parentZone = canvas.value.getObjects().find((o: any) => 
                isLikelyProductZone(o) && o._customId === parentZoneId
            );
            if (parentZone) {
                const zoneStyles = (parentZone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value ?? {};
                productZoneState.updateGlobalStyles(zoneStyles);
            }
        }
    }
}

// Clean up orphaned control/preview objects - AGGRESSIVE cleanup
const cleanupOrphanedObjects = () => {
    if (!canvas.value) return;
    
    const objs = canvas.value.getObjects();
    const toRemove: any[] = [];
    
    objs.forEach((o: any) => {
        const name = o.name || '';
        
        // Remove control objects that shouldn't exist outside editing mode
        if (name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') {
            toRemove.push(o);
            return;
        }
        
        // Remove preview objects
        if (o.excludeFromExport) {
            toRemove.push(o);
            return;
        }
        
        // Remove ALL small circles (radius <= 7) without _customId - these are control points
        if (o.type === 'circle' && o.radius && o.radius <= 7 && !o._customId) {
            toRemove.push(o);
            return;
        }
        
        // Remove circles without _customId that have data (parentPath, parentObj) - control circles
        if (o.type === 'circle' && !o._customId && o.data) {
            toRemove.push(o);
            return;
        }
        
        // Remove lines without _customId (handle lines)
        if (o.type === 'line' && !o._customId) {
            toRemove.push(o);
            return;
        }
        
        // Remove paths without _customId and marked as preview
        if (o.type === 'path' && !o._customId && !o.isVectorPath) {
            toRemove.push(o);
            return;
        }
    });
    
    if (toRemove.length > 0) {
        console.log(`🧹 Limpando ${toRemove.length} objeto(s) órfão(ões) do canvas`);
        toRemove.forEach((obj: any) => {
            try {
                canvas.value.remove(obj);
            } catch (e) {
                // Ignore errors
            }
        });
        canvas.value.requestRenderAll();
        canvasObjects.value = [...canvas.value.getObjects()];
    }
}

// --- Reactivity & Layers Sync ---
const setupReactivity = () => {
    if (!canvas.value) return; 

    const isLikelyProductCard = (obj: any) => {
        if (!obj) return false;
        if (obj.type !== 'group') return false;
        if (!obj.isSmartObject && !obj.isProductCard) return false;
        if (typeof obj.getObjects !== 'function') return false;
        const objs = obj.getObjects() || [];
        return objs.some((o: any) => o?.name === 'offerBackground');
    };

    const getStylesForCard = (card: any): Partial<GlobalStyles> => {
        if (!canvas.value) return productZoneState.globalStyles.value;
        const zoneId = card?.parentZoneId;
        if (zoneId) {
            const zone = canvas.value.getObjects().find((o: any) => isLikelyProductZone(o) && (o as any)._customId === zoneId);
            if (zone && (zone as any)._zoneGlobalStyles) return (zone as any)._zoneGlobalStyles as any;
        }
        return productZoneState.globalStyles.value;
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

        card.set({
            originX: 'center',
            originY: 'center',
            left: center.x,
            top: center.y,
            scaleX: 1,
            scaleY: 1,
            flipX: false,
            flipY: false,
            width: nextW,
            height: nextH
        });

        const styles = getStylesForCard(card);
        resizeSmartObject(card, nextW, nextH, styles);
        card.setCoords();
        canvas.value.requestRenderAll();
        if (shouldSave) saveCurrentState();
    };

    const normalizeImageScaleAndCrop = (img: any, opts: { save?: boolean } = {}) => {
        if (!canvas.value || !img) return;
        const t = String(img.type || '').toLowerCase();
        if (t !== 'image') return;

        const shouldSave = opts.save !== false;
        const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

        const center = typeof img.getCenterPoint === 'function' ? img.getCenterPoint() : { x: img.left ?? 0, y: img.top ?? 0 };

        const scaleX = Math.abs(Number(img.scaleX ?? 1)) || 1;
        const scaleY = Math.abs(Number(img.scaleY ?? 1)) || 1;
        const curW = Math.max(1, Number(img.width ?? 1) || 1);
        const curH = Math.max(1, Number(img.height ?? 1) || 1);

        // What the user "wants" in canvas units after the resize gesture
        const desiredW = Math.max(1, curW * scaleX);
        const desiredH = Math.max(1, curH * scaleY);

        // Source (natural) dimensions in pixels
        const el: any = (img as any)._originalElement || (img as any)._element || null;
        const srcW = Math.max(1, Number((img as any).__sourceWidth ?? el?.naturalWidth ?? el?.width ?? curW) || 1);
        const srcH = Math.max(1, Number((img as any).__sourceHeight ?? el?.naturalHeight ?? el?.height ?? curH) || 1);
        (img as any).__sourceWidth = srcW;
        (img as any).__sourceHeight = srcH;

        // Preserve the current focal point (center of the current crop)
        const prevCropX = Math.max(0, Number(img.cropX ?? 0) || 0);
        const prevCropY = Math.max(0, Number(img.cropY ?? 0) || 0);
        const prevCropW = clamp(curW, 1, srcW);
        const prevCropH = clamp(curH, 1, srcH);
        const cxRatio = clamp((prevCropX + (prevCropW / 2)) / srcW, 0, 1);
        const cyRatio = clamp((prevCropY + (prevCropH / 2)) / srcH, 0, 1);

        // Behavior:
        // - If user shrinks the box: crop (cut the extra area).
        // - If user enlarges beyond source: scale uniformly (no distortion) + crop if needed.
        const scale = Math.max(desiredW / srcW, desiredH / srcH, 1);
        const cropW = clamp(desiredW / scale, 1, srcW);
        const cropH = clamp(desiredH / scale, 1, srcH);

        const nextCropX = clamp((cxRatio * srcW) - (cropW / 2), 0, srcW - cropW);
        const nextCropY = clamp((cyRatio * srcH) - (cropH / 2), 0, srcH - cropH);

        img.set({
            originX: 'center',
            originY: 'center',
            left: center.x,
            top: center.y,
            // enforce uniform scaling for predictable crop behavior (avoid stretching)
            scaleX: scale,
            scaleY: scale,
            width: cropW,
            height: cropH,
            cropX: nextCropX,
            cropY: nextCropY
        });

        safeAddWithUpdate(img);
        img.setCoords?.();
        canvas.value.requestRenderAll();
        if (shouldSave) saveCurrentState();
    };

    // Canva/Figma-like behavior for side handles on images:
    // - Dragging side handles crops/hides only the side you reduced.
    // - Dragging back reveals the hidden area (no stretching).
    // - Corner handles keep normal scale behavior (handled elsewhere).
    const normalizeImageCropBySideHandle = (img: any, transform: any, opts: { save?: boolean } = {}) => {
        if (!canvas.value || !img) return;
        const t = String(img.type || '').toLowerCase();
        if (t !== 'image') return;

        const cornerRaw = String(transform?.corner || '').toLowerCase();
        if (!cornerRaw) return;

        const original = transform?.original || {};
        const abs = (n: any) => Math.abs(Number(n ?? 0) || 0);
        const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

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

        // Base scale BEFORE the gesture started (critical: do NOT force >=1)
        const baseScaleX = abs(original.scaleX) || abs(img.scaleX) || 1;
        const baseScaleY = abs(original.scaleY) || abs(img.scaleY) || 1;

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
            cropY: nextCropY
        });

        if (anchorPoint && typeof img.setPositionByOrigin === 'function') {
            img.setPositionByOrigin(anchorPoint, anchorOriginX, anchorOriginY);
        }

        safeAddWithUpdate(img);
        img.setCoords?.();
        canvas.value.requestRenderAll();
        if (shouldSave) saveCurrentState();
    };

    const updateObjects = () => {
        // CRITICAL: Preserve exact order from canvas.getObjects()
        // Don't reorder or sort - maintain order as saved
        const isValidFabricObject = (o: any) => {
            // Fabric.js v7 compatible validation
            if (!o || typeof o !== 'object') return false;
            const hasRender = typeof o.render === 'function';
            const hasSetCoords = typeof o.setCoords === 'function';
            const hasSet = typeof o.set === 'function';
            const hasToObject = typeof o.toObject === 'function';
            // Additional check: must not be a primitive or plain number
            const isNotPrimitive = typeof o !== 'number' && typeof o !== 'string' && typeof o !== 'boolean';
            return isNotPrimitive && hasRender && hasSetCoords && hasSet && hasToObject;
        };

        const objs = canvas.value.getObjects();
        const toRemove: any[] = [];
        let hasInvalid = false;
        
        objs.forEach((o: any) => {
            if (!isValidFabricObject(o)) {
                hasInvalid = true;
                console.error('❌ [updateObjects] Objeto inválido detectado no canvas (será ignorado/purgado):', o);
                return;
            }
            const name = o.name || '';
            
            // Clean up orphaned control objects that shouldn't be visible
            if ((name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') && !isNodeEditing.value) {
                toRemove.push(o);
                return;
            }
            
            // Clean up preview objects if not in pen mode
            if (o.excludeFromExport && !isPenMode.value && !isNodeEditing.value) {
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
                toRemove.push(o);
                return;
            }
            
            // Only assign _customId to real objects (not control points or preview objects)
            const isControlObject = name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line';
            const isSmallControlCircle = o.type === 'circle' && o.radius && o.radius <= 7;
            const hasControlData = o.data && (o.data.parentPath || o.data.parentObj);
            
            if (!o._customId && !o.excludeFromExport && !isControlObject && !isSmallControlCircle && !hasControlData) {
                o._customId = Math.random().toString(36).substr(2, 9);
            }
        });

        // If something corrupted the internal stack (e.g., number inserted into _objects), purge it to prevent render crashes.
        if (hasInvalid) {
            const internal = (canvas.value as any)._objects;
            if (Array.isArray(internal)) {
                const next = internal.filter((o: any) => isValidFabricObject(o));
                if (next.length !== internal.length) {
                    internal.length = 0;
                    next.forEach((o: any) => internal.push(o));
                    if (typeof (canvas.value as any)._onStackOrderChanged === 'function') (canvas.value as any)._onStackOrderChanged();
                }
            }
        }
        
        // Remove orphaned objects (from end to preserve order)
        if (toRemove.length > 0) {
            toRemove.forEach((obj: any) => {
                try {
                    canvas.value.remove(obj);
                } catch (e) {
                    // Ignore errors
                }
            });
        }
        
        // CRITICAL: Preserve exact order - don't reorder or sort
        canvasObjects.value = [...canvas.value.getObjects()];
    };

    canvas.value.on('object:added', updateObjects);
    canvas.value.on('object:removed', updateObjects);
    canvas.value.on('object:modified', updateObjects); 

    // Frames: auto-parent new objects when created inside a frame + keep clipPaths in sync
    canvas.value.on('object:added', (e: any) => {
        const obj = e?.target;
        if (!obj || typeof obj !== 'object' || obj.excludeFromExport) return;
        
        // Don't assign _customId to control objects
        const name = obj.name || '';
        const isControlObject = name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line';
        const isSmallControlCircle = obj.type === 'circle' && obj.radius && obj.radius <= 7;
        const hasControlData = obj.data && (obj.data.parentPath || obj.data.parentObj);
        
        if (!obj._customId && !isControlObject && !isSmallControlCircle && !hasControlData) {
            obj._customId = Math.random().toString(36).substr(2, 9);
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

    canvas.value.on('object:modified', (e: any) => {
        const obj = e?.target;
        if (!obj || obj.excludeFromExport) return;

        // If a product card was resized (scaled), convert scale into width/height and reflow internals (image/title/limit/label).
        // This keeps layout crisp and responsive instead of just stretching the whole group.
        const action = e?.transform?.action || '';
        const didScale = typeof action === 'string' && action.includes('scale');
        if (didScale && isLikelyProductCard(obj) && ((obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1)) {
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
            }
        }

        // Mark dirty after modification to ensure clean render
        obj.set('dirty', true);

        maybeReparentToFrameOnDrop(obj);
        syncObjectFrameClip(obj);

        if (obj.isFrame) {
            getOrCreateFrameClipRect(obj);
            syncFrameClips(obj);
        }
        // Sempre manter frames atrás do conteúdo (especialmente após reparent/clip)
        if (obj.isFrame || (obj as any).parentFrameId || (obj as any)._frameClipOwner) {
            ensureFramesBelowContents();
        }
    });

    canvas.value.on('object:modified', () => { 
        // CRITICAL: Create a fresh snapshot instead of just triggering the old one.
        // After modifications (drag, scale, etc.) the Fabric object's properties may have changed
        // (e.g. ensureZoneSanity, normalizeZoneScale). A stale snapshot causes PropertiesPanel
        // to show outdated values or lose zone detection entirely for legacy arts.
        refreshSelectedRef();
        updateScrollbars(); // Update scrollbars
        updateFloatingUI();
    });
    
    // Auto-Layout: When a product card is added, find its parent zone and trigger layout
    let layoutDebounceTimer: any = null;
    let pendingZones: Set<any> = new Set();
    
    canvas.value.on('object:added', (e: any) => {
        const obj = e.target;
        if (!obj) return;
        const isCard = !!(obj.isProductCard || obj.isSmartObject || isLikelyProductCard(obj));
        if (!isCard) return;
        
        // Find intersecting zone
        const zones = canvas.value.getObjects().filter((o: any) => o.isGridZone || o.isProductZone);
        for (const zone of zones) {
            if (zone.intersectsWithObject(obj)) {
                // Bind to zone
                obj.parentZoneId = zone._customId;
                pendingZones.add(zone);
                break;
            }
        }
        
        // Debounced layout - waits for all objects in batch to be added
        clearTimeout(layoutDebounceTimer);
        layoutDebounceTimer = setTimeout(() => {
            pendingZones.forEach(zone => {
                recalculateZoneLayout(zone);
            });
            pendingZones.clear();
        }, 100); // 100ms debounce
    });

    // Realtime updates during interaction
    // === PERFORMANCE CACHE ===
    let frameChildrenCache: any[] = [];
    let lastFrameState = { left: 0, top: 0 };
    let zoneChildrenCache: any[] = [];
    let lastZoneState = { left: 0, top: 0 };

    canvas.value.on('mouse:down', (e: any) => {
         const evt: MouseEvent | undefined = e?.e;
         const isContextClick = !!evt && (evt.button === 2 || (evt.button === 0 && (evt as any).ctrlKey && !(evt as any).metaKey));
         if (isContextClick) {
             evt?.preventDefault?.();
             evt?.stopPropagation?.();

             // Figma-like: right-click selects the target under cursor (if any).
             const current = canvas.value.getActiveObject?.();
             const keepActiveSelection =
                 current &&
                 current.type === 'activeSelection' &&
                 e.target &&
                 typeof current.getObjects === 'function' &&
                 current.getObjects().includes(e.target);

             if (e.target && !keepActiveSelection) {
                 canvas.value.setActiveObject(e.target);
                 updateSelection();
             }

             canvasContextMenu.value.x = (evt as any).clientX ?? 0;
             canvasContextMenu.value.y = (evt as any).clientY ?? 0;
             canvasContextMenu.value.show = true;
             return;
         }

        if (canvasContextMenu.value.show) canvasContextMenu.value.show = false;
        const target = e.target;

        if (target && target.isFrame) {
            frameChildrenCache = getFrameDescendants(target);
            lastFrameState = { left: target.left, top: target.top };
            getOrCreateFrameClipRect(target);
            // Renderizar canvas para mostrar o label do frame
            canvas.value.requestRenderAll();
        } else {
            if (!e.e?.shiftKey) frameChildrenCache = [];
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
    canvas.value.on('object:moving', (e: any) => {
        if (!floatingUIRafPending) {
            floatingUIRafPending = true;
            requestAnimationFrame(() => {
                updateFloatingUI();
                floatingUIRafPending = false;
            });
        }
        
        const target = e.target;
        // Frame moves its descendants (Figma-like parenting)
        if (target && target.isFrame) {
             // Mark dirty to ensure fresh render (keep caching for performance)
             target.set('dirty', true);
             
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
                 const siblings = canvas.value.getObjects().filter(
                     (o: any) => o !== target && o.gridGroupId === target.gridGroupId && o.isGridCell
                 );
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
                         child.clipPath.setCoords();
                         child.clipPath.dirty = true;
                         child.set('dirty', true);
                     }
                 });
             }
             
             // Fabric renders after object:moving — no explicit requestRenderAll needed
             return;
        }

        // Frame clipping: update parentFrameId when object enters/leaves a frame
        if (target && !target.isFrame && !target.excludeFromExport) {
            const currentParentId = (target as any).parentFrameId as (string | undefined);
            const frameUnder = findFrameUnderObject(target);
            const nextParentId = frameUnder?._customId as (string | undefined);

            // Reparent quando muda de frame
            if (nextParentId !== currentParentId) {
                (target as any).parentFrameId = nextParentId;
                syncObjectFrameClip(target);
            }

            // Com absolutePositioned: false, o clipPath é relativo ao objeto.
            // Precisamos recalcular o offset a cada movimento para manter o clip correto.
            const frameId = (target as any).parentFrameId as (string | undefined);
            if (frameId && target.clipPath) {
                const frame = getFrameById(frameId);
                if (frame) {
                    const fc = frame.getCenterPoint ? frame.getCenterPoint() : { x: frame.left, y: frame.top };
                    const tc = target.getCenterPoint ? target.getCenterPoint() : { x: target.left, y: target.top };
                    const dxW = fc.x - tc.x;
                    const dyW = fc.y - tc.y;
                    const tAngle = target.angle || 0;
                    const aRad = -tAngle * Math.PI / 180;
                    const cosA = Math.cos(aRad);
                    const sinA = Math.sin(aRad);
                    target.clipPath.set({
                        left: (dxW * cosA - dyW * sinA) / (target.scaleX || 1),
                        top: (dxW * sinA + dyW * cosA) / (target.scaleY || 1),
                    });
                    target.clipPath.setCoords();
                    target.clipPath.dirty = true;
                    target.set('dirty', true);
                }
            }
        }
        // Optimized Zone Move
        if (target && isLikelyProductZone(target)) {
             ensureZoneSanity(target);
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
        
        // 🔒 CONTAINMENT CONSTRAINTS: Keep objects inside their parents
        applyContainmentConstraints(target);
    });

    // Smart Scaling for Textbox Reflow & Product Zone AutoLayout
    canvas.value.on('object:scaling', (e: any) => {
        updateFloatingUI();
        const obj = e.target;

        // Frames: keep clip rect synced while resizing + update children clips
        if (obj && obj.isFrame) {
            getOrCreateFrameClipRect(obj);
            // Atualizar clips dos filhos em tempo real durante redimensionamento do frame
            if (obj.clipContent) {
                syncFrameClips(obj);
            }
        }

        // Filhos de frame: recalcular clip durante scaling do objeto
        if (obj && !obj.isFrame && obj.parentFrameId && obj.clipPath) {
            syncObjectFrameClip(obj);
        }

        // 1. Textbox Reflow
        if (obj && obj.type === 'textbox' && obj.lockScalingY) {
            const w = obj.width * obj.scaleX;
            obj.set({
                width: w,
                scaleX: 1
            });

            // Keep centered text inside product card groups
            if (obj.originX === 'center' && obj.group && (obj.group.isSmartObject || obj.group.isProductCard || isLikelyProductCard(obj.group))) {
                obj.set({ left: 0 });
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
            // CRITICAL: Cache children BEFORE updating zone dimensions
            // This prevents losing cards that may fall outside new bounds during resize
            const cachedChildren = getZoneChildren(obj);

            ensureZoneSanity(obj);
            obj.setCoords();
            obj._zoneWidth = Math.abs(obj.getScaledWidth?.() ?? obj._zoneWidth ?? 0);
            obj._zoneHeight = Math.abs(obj.getScaledHeight?.() ?? obj._zoneHeight ?? 0);

            // Use cached children to ensure they stay bound to zone during resize
            recalculateZoneLayout(obj, cachedChildren, { save: false });
        }

        // 🔒 Apply containment after scaling
        applyContainmentConstraints(obj);
    });
    
    // 🔒 Apply containment after modification (drag end)
    canvas.value.on('object:modified', (e: any) => {
        const obj = e.target;
        if (obj) {
            applyContainmentConstraints(obj);

            // Re-center textboxes inside product cards after resize
            if (obj.type === 'textbox' && obj.originX === 'center' && obj.group && (obj.group.isSmartObject || obj.group.isProductCard || isLikelyProductCard(obj.group))) {
                obj.set({ left: 0 });
                obj.setCoords();
                canvas.value.requestRenderAll();
            }
        }
    });
    
    canvas.value.on('mouse:wheel', updateFloatingUI);

    // 'selection:created', 'selection:updated', 'selection:cleared'
    canvas.value.on('selection:created', updateSelection);
    canvas.value.on('selection:updated', updateSelection);
    canvas.value.on('selection:cleared', (e: any) => {
        updateSelection();
        // Exit Deep Select Mode on clear
        resetDeepSelection();
    });

    // === DEEP SELECT (Figma-style) ===
    // Product cards always have subTargetCheck=true (single-click deep select).
    // resetDeepSelection is now a no-op for product cards.
    const resetDeepSelection = () => {
        // No-op: product cards stay interactive at all times.
        // Only non-product groups would be reset here if needed.
    }

    // 2. Enable deep select on Double Click
    canvas.value.on('mouse:dblclick', (opt: any) => {
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
        
	        // Nested label editing: double click the priceGroup to edit its inner parts.
	        if (target.type === 'group' && target.name === 'priceGroup') {
	             target.set({ subTargetCheck: true, interactive: true });
	             if (typeof target.getObjects === 'function') {
	                 target.getObjects().forEach((child: any) => {
	                     const isBgImage = child?.name === 'price_bg_image' || child?.name === 'splash_image';
	                     child.set({
	                         selectable: !isBgImage,
	                         evented: !isBgImage,
	                         hasControls: !isBgImage,
	                         hasBorders: !isBgImage,
	                         lockMovementX: false,
	                         lockMovementY: false,
	                         lockScalingX: false,
	                         lockScalingY: false,
	                         lockRotation: false
	                     });
	                     child.setCoords?.();
	                 });
	             }
	             target.setCoords?.();
	             canvas.value.requestRenderAll();
	             return;
	        }

            // Product cards already have subTargetCheck=true, so single click selects inner elements.
            // Double-click on a product card is now a no-op (no extra mode needed).
    });

    // 3. Product cards always stay interactive (single-click deep select).
    // No need to reset other cards when selecting a new object.
    
    // Initial fetch
    updateObjects();
}

// Properties Updates
const updatePageSettings = (prop: string, value: any) => {
    if (prop === 'backgroundColor') {
        pageSettings.value.backgroundColor = value;
        if (canvas.value) {
            // Convert rgba to hex if needed for canvas background
            let bgColor = value;
            if (value.startsWith('rgba')) {
                // Extract RGB values (ignore alpha for canvas background)
                const rgba = value.match(/rgba?\(([^)]+)\)/);
                if (rgba) {
                    const parts = rgba[1].split(',').map((s: string) => s.trim());
                    const r = parseInt(parts[0]);
                    const g = parseInt(parts[1]);
                    const b = parseInt(parts[2]);
                    bgColor = `rgb(${r}, ${g}, ${b})`;
                }
            }
            canvas.value.backgroundColor = bgColor;
            canvas.value.requestRenderAll();
            saveCurrentState();
        }
        // Also update activePage background
        if (activePage.value) {
            (activePage.value as any).backgroundColor = value;
            updatePageData(project.activePageIndex, { backgroundColor: value });
        }
    }
}

const getViewportBounds = () => {
    if (!canvas.value || !fabric?.util) return null;
    const vpt = canvas.value.viewportTransform;
    if (!vpt) return null;
    const inv = fabric.util.invertTransform(vpt);
    const tl = fabric.util.transformPoint({ x: 0, y: 0 }, inv);
    const br = fabric.util.transformPoint({ x: canvas.value.getWidth(), y: canvas.value.getHeight() }, inv);
    const left = Math.min(tl.x, br.x);
    const top = Math.min(tl.y, br.y);
    const right = Math.max(tl.x, br.x);
    const bottom = Math.max(tl.y, br.y);
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: left + ((right - left) / 2),
        centerY: top + ((bottom - top) / 2)
    };
};

const alignSelectionHorizontally = (mode: 'left' | 'center' | 'right') => {
    if (!canvas.value || !fabric?.Point) return;
    const active = canvas.value.getActiveObject();
    if (!active) return;

    const alignOne = (obj: any, ref: { left: number; right: number; centerX: number }) => {
        if (obj?.lockMovementX || obj?.lockMovementY) return;
        const br = obj.getBoundingRect(true);
        const currentCenter = obj.getCenterPoint ? obj.getCenterPoint() : { x: obj.left, y: obj.top };
        let nextCenterX = currentCenter.x;
        if (mode === 'left') nextCenterX = ref.left + (br.width / 2);
        if (mode === 'center') nextCenterX = ref.centerX;
        if (mode === 'right') nextCenterX = ref.right - (br.width / 2);

        obj.setPositionByOrigin(new fabric.Point(nextCenterX, currentCenter.y), 'center', 'center');
        obj.setCoords();
    };

    if (active.type === 'activeSelection' && typeof active.getObjects === 'function') {
        const sel = active.getBoundingRect(true);
        const ref = { left: sel.left, right: sel.left + sel.width, centerX: sel.left + (sel.width / 2) };
        active.getObjects().forEach((obj: any) => alignOne(obj, ref));
        safeAddWithUpdate(active);
        active.setCoords();
    } else {
        const vp = getViewportBounds();
        const ref = vp ? { left: vp.left, right: vp.right, centerX: vp.centerX } : (() => {
            const br = active.getBoundingRect(true);
            return { left: br.left, right: br.left + br.width, centerX: br.left + (br.width / 2) };
        })();
        alignOne(active, ref);
    }

    canvas.value.requestRenderAll();
    saveCurrentState();
    triggerRef(selectedObjectRef);
};

const updateObjectProperty = (prop: string, value: any) => {
    // Special: Canvas Preset Change
    if (prop === 'canvas-preset') {
        resizePage(project.activePageIndex, value.w, value.h);
        if(canvas.value) {
            canvas.value.setDimensions({ width: value.w, height: value.h });
            setTimeout(() => { zoomToFit(); saveCurrentState(); }, 50);
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
    const active = canvas.value.getActiveObject();
    
    if (active) {
        // If locked, ignore position/size/rotate changes from the inspector.
        // Lock should only block transformations, not styling/effects.
        if (active.type !== 'activeSelection') {
            if ((prop === 'left' || prop === 'top') && (active.lockMovementX || active.lockMovementY)) return;
            if ((prop === 'width' || prop === 'height' || prop === 'scaleX' || prop === 'scaleY') && (active.lockScalingX || active.lockScalingY)) return;
            if (prop === 'angle' && active.lockRotation) return;
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

            canvas.value.requestRenderAll();
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
            canvas.value.requestRenderAll();
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
            canvas.value.requestRenderAll();
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
            canvas.value.renderAll();
            // Second render to guarantee visibility after patch
            setTimeout(() => { canvas.value?.renderAll?.(); }, 60);
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
	            canvas.value.renderAll();
	            setTimeout(() => { canvas.value?.renderAll?.(); }, 60);
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
            canvas.value.renderAll();
            setTimeout(() => { canvas.value?.renderAll?.(); }, 60);
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
            canvas.value.requestRenderAll();
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
            canvas.value.requestRenderAll();
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
                canvas.value.requestRenderAll();
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
                canvas.value.requestRenderAll();
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
                canvas.value.requestRenderAll();

                setTimeout(() => {
                    if (canvas.value) canvas.value.requestRenderAll();
                }, 10);

                setTimeout(() => {
                    try { saveCurrentState(); } catch {} 
                }, 0);
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
                
                canvas.value.requestRenderAll();
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
                    recalculateZoneLayout(active, cachedChildren, { save: false });
                    canvas.value.requestRenderAll();
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
                recalculateZoneLayout(active, cachedChildren, { save: false });
                canvas.value.requestRenderAll();
                debouncedSaveCurrentState();
                refreshSelectedRef();
                return;
            }
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
                canvas.value.requestRenderAll();
                debouncedSaveCurrentState();
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
                canvas.value.requestRenderAll();
                debouncedSaveCurrentState();
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
            canvas.value.requestRenderAll();
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
                canvas.value.requestRenderAll();
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
        }
        // --- Stroke Properties (for regular objects, not just brush) ---
        else if (prop === 'strokeLineCap' || prop === 'strokeLineJoin') {
            applyToActiveOrSelection((o) => {
                o?.set?.(prop, value);
            });
            canvas.value.requestRenderAll();
            debouncedSaveCurrentState();
            refreshSelectedRef();
            return;
        }
        else if (prop === 'strokePosition' || prop === 'strokeMiterLimit') {
            // Vector path specific properties
            if (active.isVectorPath) {
                active.set(prop, value);
                canvas.value.requestRenderAll();
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
            canvas.value.requestRenderAll();
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
             active.set(prop, value);
        }
        
        // If it's a group, we might want to dirty it
        if (active.group) safeAddWithUpdate(active.group);
        
        // REALTIME: Render immediately for instant visual feedback
        active.setCoords?.();
        canvas.value.requestRenderAll();
        
        // PERSIST: Debounced save to avoid lag during rapid input
        debouncedSaveCurrentState();
        
        // Force update ref for UI sync — create fresh snapshot so Vue detects prop change
        selectedObjectRef.value = snapshotForPropertiesPanel(active, { [prop]: value });
    }
}

const applySmartStyle = (group: any, key: string, value: any) => {
    // Traverse group to find specific sub-elements
    const objects = group.getObjects();
    
    // 1. Price Components
    if (key.startsWith('price')) {
         const priceGroup = objects.find((o: any) => o.name === 'priceGroup');
         if (priceGroup) {
             const priceParts = priceGroup.getObjects();
             priceParts.forEach((p: any) => {
                 if (key === 'priceFill') p.set('fill', value);
                 if (key === 'priceFont') p.set('fontFamily', value);
             });
         }
    }
    
    // 2. Splash/Background
    if (key === 'splashFill') {
        const bg = objects.find((o: any) => o.name === 'offerBackground');
        if (bg && !(value === null || value === undefined || value === '')) bg.set('fill', value);
    }
    
    safeAddWithUpdate(group);
}

const updateSmartGroup = (keyOrUpdates: any, value?: any) => {
    if (!canvas.value) return; 

    // Handle Global Sync (Object payload)
    if (typeof keyOrUpdates === 'object' && keyOrUpdates.targetType) {
        const { targetType, property, value } = keyOrUpdates;
        
        // Find all groups in the same zone (if applicable, or all smart groups)
        // For now, let's target ALL smartGroups on canvas for maximum effect as requested ("Alterar um, alterar todos")
        const allSmartGroups = canvas.value.getObjects().filter((o: any) => o.subTargetCheck && o.data?.isProductCard);
        
        allSmartGroups.forEach((group: any) => {
             const objects = group.getObjects();
             
             // Recursively find matching child
             const findAndUpdate = (objs: any[]) => {
                 objs.forEach(obj => {
                     if (obj.data?.smartType === targetType) {
                         obj.set(property, value);
                         // Special case for font, might need re-positioning? 
                         // Fabric usually handles it, but group might need recalc
                     }
                     
                     if (obj.type === 'group') {
                         findAndUpdate(obj.getObjects());
                     }
                 })
             }
             
             findAndUpdate(objects);
             safeAddWithUpdate(group); 
        });
        
        canvas.value.requestRenderAll();
        saveCurrentState();
        return;
    }

    // Existing Logic (Price Mode etc)
    let updates: any = {};
    if (typeof keyOrUpdates === 'string') {
        updates[keyOrUpdates] = value;
    } else {
        updates = keyOrUpdates;
    }

    // Filter Smart Objects - Prefer ones in the currently selected Grid if any
    const active = canvas.value.getActiveObject();
    let targetGridId: string | null = null;
    
    if (active) {
        if ((active as any).smartGridId) targetGridId = (active as any).smartGridId;
        else if (active.group && (active.group as any).smartGridId) targetGridId = (active.group as any).smartGridId;
    }

    const groups = canvas.value.getObjects().filter((o: any) => (o as any).isSmartObject && (!targetGridId || (o as any).smartGridId === targetGridId));

    groups.forEach((group: any) => {
        // Find Helper
        const findChild = (parent: any, name: string): any => {
            if (!parent.getObjects) return null;
            const children = parent.getObjects();
            for (const child of children) {
                if (child.name === name) return child;
                if (child.type === 'group') {
                    const found = findChild(child, name);
                    if (found) return found;
                }
            }
            return null;
        }

        // --- Style Updates ---
        if (updates.priceColor) {
             const intTxt = findChild(group, 'priceInteger');
             if (intTxt) intTxt.set('fill', updates.priceColor);
             const decTxt = findChild(group, 'priceDecimal');
             if (decTxt) decTxt.set('fill', updates.priceColor);
             const symTxt = findChild(group, 'priceSymbol');
             if (symTxt) symTxt.set('fill', updates.priceColor);
        }
        
        if (updates.priceFont) {
             const intTxt = findChild(group, 'priceInteger');
             if (intTxt) intTxt.set('fontFamily', updates.priceFont);
             const decTxt = findChild(group, 'priceDecimal');
             if (decTxt) decTxt.set('fontFamily', updates.priceFont);
             const symTxt = findChild(group, 'priceSymbol');
             if (symTxt) symTxt.set('fontFamily', updates.priceFont);
        }

        if(updates.bgColor) {
             const bg = findChild(group, 'offerBackground');
             if (bg) bg.set('fill', updates.bgColor);
        }

        // --- Structural Updates (Price Mode Engine) ---
        if (updates.priceMode !== undefined || updates.priceFrom !== undefined || updates.priceClub !== undefined) {
             // 1. Update Metadata on Group
             if (updates.priceMode) group.priceMode = updates.priceMode;
             if (updates.priceFrom !== undefined) group.priceFrom = updates.priceFrom;
             if (updates.priceClub !== undefined) group.priceClub = updates.priceClub;
             // Atacarejo Fields
             if (updates.priceWholesale !== undefined) group.priceWholesale = updates.priceWholesale;
             if (updates.wholesaleTrigger !== undefined) group.wholesaleTrigger = updates.wholesaleTrigger;
             if (updates.wholesaleTriggerUnit !== undefined) group.wholesaleTriggerUnit = updates.wholesaleTriggerUnit;
             if (updates.packQuantity !== undefined) group.packQuantity = updates.packQuantity;
             if (updates.packUnit !== undefined) group.packUnit = updates.packUnit;
             
             // 2. Extract Data to reconstruct Component
             const intTxt = findChild(group, 'priceInteger');
             const decTxt = findChild(group, 'priceDecimal');
             const currentPrice = (intTxt && decTxt) 
                ? (intTxt.text + decTxt.text).replace(',', '.') 
                : "0.00";
             
             const unitObj = findChild(group, 'priceUnit');
             
             const mockProduct = {
                 price: currentPrice,
                 priceMode: group.priceMode, // Use updated mode
                 priceFrom: group.priceFrom,
                 priceClub: group.priceClub,
                 priceColor: intTxt ? intTxt.fill : 'red', // Preserve color
                 unit: unitObj ? unitObj.text : 'UN',
                 // Atacarejo props
                 priceWholesale: group.priceWholesale,
                 wholesaleTrigger: group.wholesaleTrigger,
                 wholesaleTriggerUnit: group.wholesaleTriggerUnit,
                 packQuantity: group.packQuantity,
                 packUnit: group.packUnit
             };

             // 3. Locate old Price Group Container
             const objects = group.getObjects();
             const oldPg = objects.find((o: any) => o.name === 'priceGroup');
             const bg = objects.find((o: any) => o.name === 'offerBackground');
             const internalWidth = bg ? bg.width : 200;

             if (oldPg) {
                 const oldTop = oldPg.top;
                 
                 // 4. Generate New Layout
                 const newPriceGroup = createPriceLayout(mockProduct, internalWidth, oldTop);
                 
                 // 5. Swap
                 group.remove(oldPg);
                 group.add(newPriceGroup);
             }
        }

        safeAddWithUpdate(group);
    });

    canvas.value.requestRenderAll();
    saveCurrentState();
}

const buildRemoveBgRequest = async (imageUrl: string) => {
    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
        const blob = await (await fetch(imageUrl)).blob();
        const formData = new FormData();
        const mime = String(blob.type || '').toLowerCase();
        const ext = mime.includes('jpeg') || mime.includes('jpg')
            ? 'jpg'
            : mime.includes('png')
                ? 'png'
                : mime.includes('webp')
                    ? 'webp'
                    : 'png';
        formData.append('file', blob, `image.${ext}`);
        formData.append('overwrite', '1');
        return { body: formData as any };
    }
    return { body: { imageUrl, overwrite: true } as any };
};

const handleAction = async (action: string) => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();

    // Duplicate (button/menu)
    if (action === 'duplicate') {
        if (!active) return;
        if ((active as any).isFrame) {
            await duplicateFrameWithContents(active);
            return;
        }
        // Reuse Ctrl+D behavior by synthesizing a key action would be messy; just clone directly.
        try {
            const extra = Array.from(new Set(['_customId', ...CANVAS_CUSTOM_PROPS]));
            const cloned: any = await (active as any).clone(extra);
            if (!cloned) return;

            // Multiple selection
            if (String(cloned.type || '').toLowerCase() === 'activeselection') {
                cloned.canvas = canvas.value;
                (cloned as any).forEachObject?.((obj: any) => {
                    if (!obj) return;
                    obj._customId = Math.random().toString(36).substr(2, 9);
                    obj.set?.({
                        left: (Number(obj.left) || 0) + 20,
                        top: (Number(obj.top) || 0) + 20,
                        selectable: true,
                        evented: true,
                    });
                    canvas.value.add(obj);
                });
                cloned.setCoords?.();
                canvas.value.discardActiveObject();
            } else {
                cloned._customId = Math.random().toString(36).substr(2, 9);
                cloned.set({
                    left: (Number(active.left) || 0) + 20,
                    top: (Number(active.top) || 0) + 20,
                    selectable: true,
                    evented: true,
                });
                canvas.value.add(cloned);
                canvas.value.setActiveObject(cloned);
            }

            canvas.value.requestRenderAll();
            canvasObjects.value = [...canvas.value.getObjects()];
            updateSelection();
            saveCurrentState({ reason: 'duplicate-action' });
            triggerAutoSave();
        } catch (err) {
            console.warn('[duplicate] Falha ao duplicar (action)', err);
        }
        return;
    }

    // AI edit current image (mask workflow) - replaces the selected image in the design.
    if (action === 'ai-edit-image') {
        const found = findImageTargetInSelection(active);
        if (!found?.img) {
            alert('Selecione uma imagem primeiro');
            return;
        }
        const img = found.img;
        const imageUrl = (img as any).src || (img as any)._element?.src || (typeof (img as any).getSrc === 'function' ? (img as any).getSrc() : null);
        if (!imageUrl) {
            alert('Não foi possível obter a URL da imagem. Tente usar uma imagem do storage.');
            return;
        }
        if (!(img as any)._customId) (img as any)._customId = Math.random().toString(36).substr(2, 9);

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

    // Remove Image Background
    if (action === 'remove-image-bg') {
        if (!active) {
            console.warn('⚠️ [Remove BG] Nenhum objeto selecionado');
            alert('Selecione uma imagem primeiro');
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
            alert('Selecione uma imagem válida');
            return;
        }

        if (!imageUrl) {
            console.warn('⚠️ [Remove BG] Imagem não tem URL');
            alert('Não foi possível obter a URL da imagem. Tente usar uma imagem do storage.');
            return;
        }

        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'fixed top-4 right-4 bg-zinc-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 border border-white/10';
        loadingIndicator.innerHTML = '<span class="animate-spin mr-2">⟳</span> Removendo fundo...';
        document.body.appendChild(loadingIndicator);

        try {
            const request = await buildRemoveBgRequest(imageUrl);
            const result = await $fetch('/api/remove-image-bg', {
                method: 'POST',
                ...(request as any)
            }) as any;

            if (result?.url) {
                // Load new image with callback to ensure it's loaded
                const proxiedBgUrl = toWasabiProxyUrl(result.url) || result.url;
                fabric.Image.fromURL(proxiedBgUrl, (newImg: any) => {
                    if (!newImg || !canvas.value) return;

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
                            (newImg as any).src = result.url;
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
                                (active as any).insertAt(newImg, imgIndex);
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
                            src: result.url
                        };

                        newImg.set(propsToPreserve);
                        (newImg as any).src = result.url;

                        // Remove old image and add new one
                        const oldIndex = canvas.value.getObjects().indexOf(active);
                        canvas.value.remove(active);
                        if (oldIndex >= 0 && typeof (canvas.value as any).insertAt === 'function') {
                            (canvas.value as any).insertAt(newImg, oldIndex);
                        } else {
                            canvas.value.add(newImg);
                        }
                    }

                    canvas.value.setActiveObject(active.type === 'group' ? active : newImg);
                    canvas.value.requestRenderAll();
                    saveCurrentState();
                }, {
                    crossOrigin: 'anonymous'
                });
            } else {
                throw new Error('API não retornou URL válida');
            }
        } catch (err: any) {
            console.error('❌ [Remove BG] Erro ao remover fundo:', err);
            alert('Erro ao remover fundo: ' + (err.message || 'Erro desconhecido'));
        } finally {
            loadingIndicator?.remove();
        }
        return;
    }

    // Export actions
    if (action === 'export-selected' || action === 'export-png' || action === 'export-svg' || action === 'export-jpg') {
        if (!active) {
            // Export entire canvas
            exportCanvas(action.replace('export-', '') as 'png' | 'svg' | 'jpg')
        } else {
            // Export selected object
            exportSelectedObject(action.replace('export-', '') as 'png' | 'svg' | 'jpg')
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
            alert('Não é possível agrupar objetos de frames diferentes. Mova os objetos para o mesmo frame primeiro.');
            return;
        }

        active.toGroup();
        canvas.value.requestRenderAll();
        saveCurrentState();

        // Update selection to the new group and preserve parentFrameId
	        const newGroup = canvas.value.getActiveObject();
	        if (newGroup) {
	            if (!newGroup._customId) newGroup._customId = Math.random().toString(36).substr(2, 9);
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
        canvas.value.requestRenderAll();
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
        active.set('flipX', !active.flipX);
        canvas.value.requestRenderAll();
        saveCurrentState();
        return;
    }
    if (action === 'flip-v') {
        if (!active) return;
        active.set('flipY', !active.flipY);
        canvas.value.requestRenderAll();
        saveCurrentState();
        return;
    }

    // Masking (Toggle)
    if (action === 'toggle-mask') {
        if (!active) return;
        active.isMask = !active.isMask;
        
        // In Fabric, we can use an object as a mask for the whole canvas 
        // or for other objects via clipPath. 
        // If it's a mask, we'll use it to clip the NEXT object added or all objects above it.
        if (active.isMask) {
            active.opacity = 0.3; // Visual feedback
            active.stroke = '#3b82f6';
            active.strokeDashArray = [4, 4];
        } else {
            active.opacity = 1;
            active.stroke = null;
            active.strokeDashArray = null;
        }
        
        canvas.value.requestRenderAll();
        saveCurrentState();
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
        canvas.value?.requestRenderAll();
        saveCurrentState();
        return;
    }

    if (action === 'cancel-crop') {
        figmaCrop.cancelCrop();
        canvas.value?.requestRenderAll();
        return;
    }

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

        canvas.value.requestRenderAll();
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
        canvas.value.requestRenderAll();
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
        canvas.value.requestRenderAll();
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
            
            canvas.value.requestRenderAll();
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
        canvas.value.requestRenderAll();
        saveCurrentState();
        return;
    }

    // Text Case
    if (action === 'text-upper') {
        if (active && (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox')) {
            active.set('text', active.text.toUpperCase());
            canvas.value.requestRenderAll();
            saveCurrentState();
        }
        return;
    }
    if (action === 'text-lower') {
        if (active && (active.type === 'i-text' || active.type === 'text' || active.type === 'textbox')) {
            active.set('text', active.text.toLowerCase());
            canvas.value.requestRenderAll();
            saveCurrentState();
        }
        return;
    }

    // Distribute (Requires Active Selection)
    if (action.startsWith('distribute-') && active && active.type === 'activeSelection') {
        const objects = active.getObjects();
        if (objects.length < 3) return; // Need 3+ for meaningful distribution

        if (action === 'distribute-h') {
            // Sort by left position
            objects.sort((a: any, b: any) => a.left - b.left);
            const totalW = objects[objects.length - 1].left - objects[0].left;
            const step = totalW / (objects.length - 1);
            const start = objects[0].left;
            
            objects.forEach((obj: any, i: number) => {
                obj.set('left', start + (step * i));
            });
        }
        
        if (action === 'distribute-v') {
            // Sort by top position
            objects.sort((a: any, b: any) => a.top - b.top);
            const totalH = objects[objects.length - 1].top - objects[0].top;
            const step = totalH / (objects.length - 1);
            const start = objects[0].top;
            
            objects.forEach((obj: any, i: number) => {
                obj.set('top', start + (step * i));
            });
        }
        
        // Re-layout selection box
        safeAddWithUpdate(active); 
        canvas.value.requestRenderAll();
        saveCurrentState();
    }
}



// Layers Panel Actions
const selectObject = (id: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        canvas.value.setActiveObject(obj);
        canvas.value.requestRenderAll();
    }
}

const toggleVisible = (id: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        const next = !(obj.visible !== false);
        obj.set?.('visible', next);
        obj.visible = next;
        // Deselect if hidden
        if (!next) canvas.value.discardActiveObject();
        canvas.value.requestRenderAll();
        // Trigger update to refresh UI icons
        // (Fabric doesn't emit 'modified' on property set via code usually, need to force or rely on array ref update might not catch deep prop)
        // Since canvasObjects is shallow array, deep prop change might not trigger watcher if we had one. 
        // But our LayersPanel reads directly from the object prop. We might need to force update the array reference to trigger re-render of panel items.
        canvasObjects.value = [...canvas.value.getObjects()];
        updateSelection();
        saveCurrentState({ reason: 'layers-toggle-visible' });
        triggerAutoSave();
    }
}

const toggleLock = (id: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        // Lock movement and scaling
        const isLocked = !obj.lockMovementX;
        obj.set({
            lockMovementX: isLocked,
            lockMovementY: isLocked,
            lockScalingX: isLocked,
            lockScalingY: isLocked,
            lockRotation: isLocked
        });
        canvas.value.requestRenderAll();
        canvasObjects.value = [...canvas.value.getObjects()];
        // Persist lock so reload keeps it
        saveCurrentState();
        triggerAutoSave();
        if (selectedObjectId.value === id) refreshSelectedRef();
    }
}

const deleteObject = (id: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        const active = canvas.value.getActiveObject?.();
        if (active && active === obj) canvas.value.discardActiveObject();
        canvas.value.remove(obj);
        canvas.value.requestRenderAll();
        canvasObjects.value = [...canvas.value.getObjects()];
        updateSelection();
    }
}

const moveLayer = (id: string, dir: 'up' | 'down') => {
    if (!canvas.value) return;
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        // Verificar se o método existe antes de chamar
        if (dir === 'up') {
            if (typeof obj.bringForward === 'function') {
                obj.bringForward();
            } else if (typeof obj.bringToFront === 'function') {
                obj.bringToFront();
            } else {
                // Alternativa: mover objeto manualmente no array
                const objects = canvas.value.getObjects();
                const index = objects.indexOf(obj);
                if (index >= 0 && index < objects.length - 1) {
                    canvas.value.remove(obj);
                    canvas.value.insertAt(obj, index + 2);
                }
            }
        } else {
            if (typeof obj.sendBackwards === 'function') {
                obj.sendBackwards();
            } else if (typeof obj.sendToBack === 'function') {
                obj.sendToBack();
            } else {
                // Alternativa: mover objeto manualmente no array
                const objects = canvas.value.getObjects();
                const index = objects.indexOf(obj);
                if (index > 1) {
                    canvas.value.remove(obj);
                    canvas.value.insertAt(obj, index - 1);
                }
            }
        }

        canvas.value.requestRenderAll();
        // Update list order
        canvasObjects.value = [...canvas.value.getObjects()];
    }
}

const renameLayer = (id: string, newName: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        obj.layerName = newName; // Custom property for our UI
        // Also update fabric name if standard
        // obj.name = newName; 
        
        canvasObjects.value = [...canvas.value.getObjects()]; // Trigger reactivity
        saveCurrentState();
    }
}

// --- Export Feature ---
const exportDesign = () => {
    showExportModal.value = true;
}

const exportCanvas = async (format: 'png' | 'svg' | 'jpg' = 'png') => {
    if (!canvas.value) return;
    
    // Deselect for clean export
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();

    const fileName = `design-export-${Date.now()}`;
    
    if (format === 'svg') {
        const svgContent = canvas.value.toSVG();
        const blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        downloadFile(url, `${fileName}.svg`);
    } else {
        // PNG or JPG
        // Sanitize clipPaths before export
        sanitizeAllClipPaths();

        let dataURL = '';
        try {
            dataURL = canvas.value.toDataURL({
                format: format,
                quality: 1,
                multiplier: 1
            });
        } catch (exportErr) {
            console.warn('[Export] Erro ao exportar, tentando sem clipPaths:', exportErr);
            // Nuclear option: clear all clipPaths
            removeAllClipPaths();
            try {
                canvas.value.requestRenderAll();
                await new Promise(resolve => setTimeout(resolve, 10));
                dataURL = canvas.value.toDataURL({
                    format: format,
                    quality: 1,
                    multiplier: 1
                });
            } catch (fallbackErr) {
                console.error('[Export] Falha definitiva ao exportar:', fallbackErr);
                alert('Erro ao exportar imagem. Tente novamente.');
                return;
            }
        }
        downloadFile(dataURL, `${fileName}.${format}`);
    }
}

const exportSelectedObject = (format: 'png' | 'svg' | 'jpg' = 'png') => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    if (!active) return;
    
    const fileName = `object-export-${Date.now()}`;
    
    if (format === 'svg') {
        const svgContent = active.toSVG();
        const blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        downloadFile(url, `${fileName}.svg`);
    } else {
        // PNG or JPG - create a temporary canvas for the selected object
        // Sanitize clipPath on the active object before export
        if (active.clipPath) {
            if (!isValidClipPath(active.clipPath)) {
                console.warn('[Export Selected] Limpando clipPath inválido do objeto selecionado');
                active.set('clipPath', null);
            }
        }
        
        let dataURL = '';
        try {
            dataURL = active.toDataURL({
                format: format,
                quality: 1,
                multiplier: 1
            });
        } catch (exportErr) {
            console.error('[Export Selected] Erro ao exportar objeto:', exportErr);
            // Try without clipPath
            try {
                active.set('clipPath', null);
                dataURL = active.toDataURL({
                    format: format,
                    quality: 1,
                    multiplier: 1
                });
            } catch (fallbackErr) {
                console.error('[Export Selected] Falha definitiva:', fallbackErr);
                alert('Erro ao exportar objeto. Tente novamente.');
                return;
            }
        }
        downloadFile(dataURL, `${fileName}.${format}`);
    }
}

const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Frame Export Functions ---

// Export a single frame as an image
const exportSingleFrame = async (frame: any, format: 'png' | 'jpg' = 'png', scale: number = 1, quality: number = 0.9) => {
    if (!canvas.value || !frame) return null;

    const frameName = (frame.layerName || frame.name || 'frame').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const fileName = `frame-${frameName}-${Date.now()}`;

    // Get frame bounds
    const bounds = {
        left: frame.left || 0,
        top: frame.top || 0,
        width: (frame.getScaledWidth?.() || frame.width * (frame.scaleX || 1)),
        height: (frame.getScaledHeight?.() || frame.height * (frame.scaleY || 1))
    };

    // Create a data URL for the frame area
    let dataURL = '';
    try {
        dataURL = canvas.value.toDataURL({
            format: format,
            quality: quality,
            multiplier: scale,
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height
        });
    } catch (err) {
        console.error('[Export Frame] Error:', err);
        return null;
    }

    return { dataURL, fileName };
}

// Export all frames as separate files
const exportAllFrames = async (format: 'png' | 'jpg' = 'png', scale: number = 1, quality: number = 0.9) => {
    const frames = getAllFrames();
    if (!frames.length) {
        alert('Nenhum frame encontrado para exportar.');
        return [];
    }

    const exports: { dataURL: string; fileName: string }[] = [];

    for (const frame of frames) {
        const result = await exportSingleFrame(frame, format, scale, quality);
        if (result) {
            exports.push(result);
        }
    }

    return exports;
}

// Share using Web Share API (native apps)
const shareFile = async (dataURL: string, fileName: string, title: string = 'Design export') => {
    // Convert data URL to blob
    const response = await fetch(dataURL);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });

    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: title,
                files: [file]
            });
            return true;
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('[Share] Error sharing:', err);
            }
            return false;
        }
    } else {
        console.warn('[Share] Web Share API not supported or file not shareable');
        return false;
    }
}

// Download multiple files (with delay to avoid browser blocking)
const downloadMultipleFiles = async (files: { dataURL: string; fileName: string; format: string }[]) => {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        downloadFile(file.dataURL, `${file.fileName}.${file.format}`);
        // Add delay to avoid browser blocking multiple downloads
        if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
}

// Updated performExport with frame selection and sharing
const performExport = async () => {
    if (!canvas.value) return;

    // Deselect for clean export
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();

    const { format, scale, quality, exportScope, selectedFrameId } = exportSettings.value;
    const imgFormat = format === 'jpeg' ? 'jpg' : format;

    // Export selected frame
    if (exportScope === 'selected-frame' && selectedFrameId) {
        const frame = getFrameById(selectedFrameId);
        if (frame) {
            const result = await exportSingleFrame(frame, imgFormat as 'png' | 'jpg', scale, quality);
            if (result) {
                downloadFile(result.dataURL, `${result.fileName}.${imgFormat}`);
            }
        }
    }
    // Export all frames
    else if (exportScope === 'all-frames') {
        const frames = getAllFrames();
        if (frames.length > 0) {
            const frameExports = await exportAllFrames(imgFormat as 'png' | 'jpg', scale, quality);
            const filesToDownload = frameExports.map(e => ({
                dataURL: e.dataURL,
                fileName: e.fileName,
                format: imgFormat
            }));
            await downloadMultipleFiles(filesToDownload);
        } else {
            alert('Nenhum frame encontrado no canvas.');
        }
    }
    // Export entire canvas (default behavior)
    else {
        let dataURL = '';

        if (format === 'svg') {
            const svgContent = canvas.value.toSVG();
            const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            downloadFile(url, `design-export-${Date.now()}.svg`);
        } else {
            dataURL = canvas.value.toDataURL({
                format: format,
                quality: quality,
                multiplier: scale
            });
            downloadFile(dataURL, `design-export-${Date.now()}.${imgFormat}`);
        }
    }

    showExportModal.value = false;
}

// --- Share Modal Functions ---

const shareDesign = () => {
    showShareModal.value = true;
}

const shareSettings = ref({
    format: 'png',
    scale: 1,
    quality: 0.9,
    shareScope: 'canvas', // 'canvas' | 'selected-frame' | 'all-frames'
    selectedFrameId: '',
    selectedFrameIds: [] as string[],
    shareAsFiles: true // Share as files or use link sharing
})

const toggleFrameSelection = (frameId: string) => {
    const idx = shareSettings.value.selectedFrameIds.indexOf(frameId)
    if (idx >= 0) {
        shareSettings.value.selectedFrameIds.splice(idx, 1)
    } else {
        shareSettings.value.selectedFrameIds.push(frameId)
    }
    // Keep legacy field in sync (first selected)
    shareSettings.value.selectedFrameId = shareSettings.value.selectedFrameIds[0] || ''
}

const selectAllFrames = () => {
    const all = availableFramesForExport.value.map((f: any) => f.id)
    if (shareSettings.value.selectedFrameIds.length === all.length) {
        shareSettings.value.selectedFrameIds = []
        shareSettings.value.selectedFrameId = ''
    } else {
        shareSettings.value.selectedFrameIds = [...all]
        shareSettings.value.selectedFrameId = all[0] || ''
    }
}

const performShare = async () => {
    if (!canvas.value) return;

    // Deselect for clean export
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();

    const { format, scale, quality, shareScope, selectedFrameId } = shareSettings.value;
    const imgFormat = format === 'jpeg' ? 'jpg' : format;

    // Share selected frame(s)
    if (shareScope === 'selected-frame' && shareSettings.value.selectedFrameIds.length > 0) {
        const frameIds = shareSettings.value.selectedFrameIds;
        if (frameIds.length === 1) {
            const frame = getFrameById(frameIds[0] as string);
            if (frame) {
                const result = await exportSingleFrame(frame, imgFormat as 'png' | 'jpg', scale, quality);
                if (result) {
                    const shared = await shareFile(result.dataURL, `${result.fileName}.${imgFormat}`, (frame.layerName || frame.name || 'Frame'));
                    if (!shared) {
                        downloadFile(result.dataURL, `${result.fileName}.${imgFormat}`);
                    }
                }
            }
        } else {
            // Multiple frames selected - download all
            const results = [];
            for (const fid of frameIds) {
                const frame = getFrameById(fid);
                if (frame) {
                    const result = await exportSingleFrame(frame, imgFormat as 'png' | 'jpg', scale, quality);
                    if (result) results.push({ dataURL: result.dataURL, fileName: result.fileName, format: imgFormat });
                }
            }
            if (results.length > 0) {
                await downloadMultipleFiles(results);
            }
        }
    }
    // Share all frames
    else if (shareScope === 'all-frames') {
        const frames = getAllFrames();
        if (frames.length > 0) {
            if (frames.length === 1) {
                const result = await exportSingleFrame(frames[0], imgFormat as 'png' | 'jpg', scale, quality);
                if (result) {
                    const shared = await shareFile(result.dataURL, `${result.fileName}.${imgFormat}`, 'All Frames');
                    if (!shared) {
                        downloadFile(result.dataURL, `${result.fileName}.${imgFormat}`);
                    }
                }
            } else {
                // For multiple files, we need to download them (Web Share API only supports single file)
                alert('Compartilhamento nativo suporta apenas um arquivo por vez. Os arquivos serão baixados.');
                const frameExports = await exportAllFrames(imgFormat as 'png' | 'jpg', scale, quality);
                const filesToDownload = frameExports.map(e => ({
                    dataURL: e.dataURL,
                    fileName: e.fileName,
                    format: imgFormat
                }));
                await downloadMultipleFiles(filesToDownload);
            }
        } else {
            alert('Nenhum frame encontrado no canvas.');
        }
    }
    // Share entire canvas
    else {
        let dataURL = canvas.value.toDataURL({
            format: format,
            quality: quality,
            multiplier: scale
        });
        const fileName = `design-${project.name || 'export'}-${Date.now()}.${imgFormat}`;
        const shared = await shareFile(dataURL, fileName, project.name || 'Design');
        if (!shared) {
            downloadFile(dataURL, fileName);
        }
    }

    showShareModal.value = false;
}

// --- Project Manager Helpers ---
const saveProject = async () => {
    if (!canvas.value) return;
    const json = canvas.value.toJSON([...CANVAS_CUSTOM_PROPS, 'data']);
    (json as any)[LABEL_TEMPLATES_JSON_KEY] = serializeLabelTemplatesForProject();
    updatePageData(project.activePageIndex, json);
    
    // Persist to DB
    await saveProjectDB();
    
    showSaveModal.value = false;
    console.log('Project saved to database');
}

const loadCanvasData = async (data: any) => {
    if (!canvas.value) return;
    
    // Handle full project object (from DB) or just JSON (dnd/legacy)
    let json = data;
    if (data.id && data.canvas_data) {
        // It's a Project Object from DB
        project.id = data.id;
        project.name = data.name;
        // project.pages = data.canvas_data; // If we support multi-page later
        json = Array.isArray(data.canvas_data) ? data.canvas_data[0].canvasData : data.canvas_data; 
        
        // Handle Legacy/Single Page JSON vs new MultiPage structure
        if (Array.isArray(data.canvas_data)) {
             project.pages = data.canvas_data;
             // Load active page?
             // For now assume we load the first page info
             json = project.pages[0]?.canvasData;
        }
    }

    if (!json) return;
    
    // CRITICAL: Ensure canvas is fully initialized before loading
    if (!canvas.value || !canvas.value.getContext) {
        console.warn('⚠️ Canvas não inicializado em loadCanvasData, aguardando...');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!canvas.value || !canvas.value.getContext) {
            console.error('❌ Canvas não está inicializado com contexto');
            return;
        }
    }
    
    // Blob URLs do not survive reload; replace early to avoid loadFromJSON errors.
    try {
        json = replaceBlobImagesWithPlaceholder(json);
    } catch (e) {
        // ignore
    }
    
    // Convert Contabo URLs to use local proxy (bypasses presigned URL issues)
    try {
        json = convertContaboToProxyUrls(json);
    } catch (e) {
        // ignore
    }

    isHistoryProcessing.value = true;
    hydrateLabelTemplatesFromProjectJson(json);
    
    try {
        await canvas.value.loadFromJSON(json);
    } catch (loadErr) {
        console.error('❌ Erro ao carregar JSON no canvas:', loadErr);
        // Try to clear and retry once - but only if canvas is fully ready
        if (canvas.value) {
            try {
                // Verificar se o contexto ainda existe antes de tentar clear
                const ctx = canvas.value.getContext();
                if (ctx && typeof ctx.clearRect === 'function') {
                    canvas.value.clear();
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await canvas.value.loadFromJSON(json);
                } else {
                    console.warn('⚠️ Contexto do canvas não está disponível, pulando clear()');
                    // Tentar carregar diretamente sem clear
                    await canvas.value.loadFromJSON(json);
                }
            } catch (retryErr) {
                console.error('❌ Erro ao recarregar após clear:', retryErr);
                // Se ainda falhar, tentar apenas loadFromJSON sem clear
                try {
                    await canvas.value.loadFromJSON(json);
                    console.log('✅ loadFromJSON bem-sucedido após erro no clear');
                } catch (finalErr) {
                    console.error('❌ Erro final ao carregar:', finalErr);
                    isHistoryProcessing.value = false;
                    throw finalErr;
                }
            }
        } else {
            isHistoryProcessing.value = false;
            throw loadErr;
        }
    }
    
    // Remove old frame label text objects (if any were saved)
    // IMPORTANT: Preserve order by removing from end
    const objects = canvas.value.getObjects();
    const labelsToRemove: any[] = [];
    // Iterate in reverse to mark for removal from end
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.isFrameLabel || (obj.type === 'text' && obj.text && obj.text.includes('@') && obj.text.includes('dpi'))) {
            labelsToRemove.push(obj);
        }
    }
    // Remove from end to preserve order
    labelsToRemove.forEach((obj: any) => {
        try {
            canvas.value.remove(obj);
        } catch (e) {
            // Ignore errors
        }
    });
    
    // CRITICAL: Remove any duplicate objects BEFORE rehydration
    const allObjsBefore = canvas.value.getObjects();
    const seenIds = new Set<string>();
    const duplicates: any[] = [];
    allObjsBefore.forEach((obj: any) => {
        const id = obj._customId || obj.id;
        if (id && seenIds.has(id)) {
            duplicates.push(obj);
        } else if (id) {
            seenIds.add(id);
        }
    });
    if (duplicates.length > 0) {
        console.warn(`⚠️ Removendo ${duplicates.length} objeto(s) duplicado(s) após loadFromJSON`);
        duplicates.forEach(dup => canvas.value.remove(dup));
    }
    
    // NOTE: Removed problematic code that was deleting frames with blue stroke
    // before rehydrateCanvasZones could restore their isFrame flag.
    // This was causing frames to be removed and re-added at the end, changing layer order.
    
    rehydrateCanvasZones();
    
    // CRITICAL: Remove any artboard-bg that might have been incorrectly created from a Frame
    const artboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
    if (artboard && (artboard.isFrame || artboard.clipContent || artboard.selectable)) {
        console.warn('⚠️ Removendo artboard-bg incorreto (era um Frame)');
        canvas.value.remove(artboard);
    }
    
    // NOTE: Legacy repair for product cards is handled inside `rehydrateCanvasZones()`.
    // Do not disable child interactivity here, otherwise deep-select (dblclick) stops working.
    
    canvas.value.requestRenderAll();
    // Update CanvasObjects
    const objs = canvas.value.getObjects();
    canvasObjects.value = [...objs]; 
    isHistoryProcessing.value = false;
    historyStack.value = [];
    historyIndex.value = -1;
    saveCurrentState();
}

const generateFlyerWithAI = async () => {
    // Stub for AI Generation
    console.log('Generating flyer with prompt:', aiPrompt.value);
    isProcessing.value = true;
    setTimeout(() => {
        isProcessing.value = false;
        showAIModal.value = false;
        alert('Simulação: Design gerado com sucesso! (Implementar integração real)');
    }, 2000);
}

// Helper: Get Center of current Viewport
const getCenterOfView = () => {
    if (!canvas.value) return { x: 0, y: 0 };
    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom?.() || 1;
    const width = canvas.value.getWidth?.() || 0;
    const height = canvas.value.getHeight?.() || 0;
    if (!vpt || !Array.isArray(vpt) || vpt.length < 6 || !width || !height) {
        // Fallback: treat origin as the center for empty/initial canvas.
        return { x: 0, y: 0 };
    }

    // Convert screen center to world (canvas) coordinates.
    // screen = world * zoom + translate  =>  world = (screen - translate) / zoom
    return {
        x: (width / 2 - vpt[4]) / zoom,
        y: (height / 2 - vpt[5]) / zoom
    };
}

const { uploadFile } = useUpload()

const insertAssetToCanvas = async (asset: any) => {
    if (!canvas.value || !fabric) return;
    if (!asset?.url) return;

    try {
        const center = getCenterOfView();
        const proxiedUrl = toWasabiProxyUrl(asset.url) || asset.url;
        const img: any = await fabric.Image.fromURL(proxiedUrl, { crossOrigin: 'anonymous' });

        const pageW = activePage.value?.width || 1080;
        const pageH = activePage.value?.height || 1920;
        const maxW = pageW * 0.55;
        const maxH = pageH * 0.55;
        const iw = img.width || 1;
        const ih = img.height || 1;
        const scale = Math.min(maxW / iw, maxH / ih, 1);

        img.set({
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            scaleX: scale,
            scaleY: scale,
            name: (asset.name || 'Imagem').toString(),
            selectable: true,
            evented: true
        });
        (img as any)._customId = Math.random().toString(36).substr(2, 9);

        canvas.value.add(img);
        // Keep the new asset visible above the page/frame.
        const c: any = canvas.value as any;
        if (typeof c.bringObjectToFront === 'function') c.bringObjectToFront(img);
        else if (typeof c.bringToFront === 'function') c.bringToFront(img);

        canvas.value.setActiveObject(img);
        canvas.value.requestRenderAll();
        saveCurrentState();
    } catch (e) {
        console.warn('[assets] Failed to insert asset to canvas', e);
    }
};

// ─── Insert Element from ElementsPanel ────────────────────────────────────
const insertElementToCanvas = (element: { type: string; data: any }) => {
    if (!canvas.value || !fabric) return;
    const { type, data } = element;

    if (type === 'shape') {
        // Reutiliza addShape existente, passando options customizadas
        addShape(data.shape, data.options || {});
    } else if (type === 'path') {
        // Cria fabric.Path a partir de pathData SVG
        try {
            const center = getCenterOfView();
            const pathObj: any = new fabric.Path(data.path, {
                fill: data.fill ?? '#cccccc',
                stroke: data.stroke ?? '#cccccc',
                strokeWidth: data.strokeWidth ?? 0,
                strokeUniform: true,
                strokeLineCap: data.strokeLineCap || 'butt',
                strokeLineJoin: data.strokeLineJoin || 'miter',
                fillRule: data.fillRule || 'nonzero',
                objectCaching: false,
                noScaleCache: true,
                statefullCache: false,
            });
            // Escalar para ~100px de largura mantendo proporção
            const bw = pathObj.width || 100;
            const bh = pathObj.height || 100;
            const targetSize = 120;
            const scale = targetSize / Math.max(bw, bh);
            pathObj.set({
                scaleX: scale,
                scaleY: scale,
                left: center.x,
                top: center.y,
                originX: 'center',
                originY: 'center',
            });
            pathObj._customId = Math.random().toString(36).substr(2, 9);
            canvas.value.add(pathObj);
            canvas.value.setActiveObject(pathObj);
            canvas.value.requestRenderAll();
            saveCurrentState();
        } catch (err) {
            console.warn('[elements] Failed to create path element', err);
        }
    } else if (type === 'frame') {
        // Cria frame com dimensões customizadas
        addFrame();
    } else if (type === 'grid') {
        // Cria grade de frames estilo Canva (cada célula é um Frame com clipPath)
        const cols = data.columns || 2;
        const rows = data.rows || 2;
        const gap = data.gap ?? 8;
        addGridFrames(cols, rows, gap);
    }
};

const findObjectByCustomId = (id: string): { obj: any; parent: any | null } | null => {
    if (!canvas.value || !id) return null;
    const walk = (node: any, parent: any | null): { obj: any; parent: any | null } | null => {
        if (!node) return null;
        if ((node as any)._customId === id) return { obj: node, parent };
        const t = String(node.type || '').toLowerCase();
        if (t === 'group' || t === 'activeselection') {
            const list = typeof node.getObjects === 'function' ? node.getObjects() : [];
            for (const child of (list || [])) {
                const found = walk(child, node);
                if (found) return found;
            }
        }
        return null;
    };
    for (const top of canvas.value.getObjects()) {
        const found = walk(top, null);
        if (found) return found;
    }
    return null;
};

const replaceImageByCustomId = async (targetId: string, newUrl: string) => {
    if (!canvas.value || !fabric || !targetId || !newUrl) return;

    const found = findObjectByCustomId(targetId);
    if (!found) return;

    const target = found.obj;
    if (String(target?.type || '').toLowerCase() !== 'image') return;

    try {
        const oldDisplayW = Math.abs((target.width || 1) * (target.scaleX || 1));
        const oldDisplayH = Math.abs((target.height || 1) * (target.scaleY || 1));
        const proxiedNewUrl = toWasabiProxyUrl(newUrl) || newUrl;
        const newImg: any = await fabric.Image.fromURL(proxiedNewUrl, { crossOrigin: 'anonymous' });
        if (!newImg) return;

        const newW = newImg.width || 1;
        const newH = newImg.height || 1;
        const newScaleX = oldDisplayW / newW;
        const newScaleY = oldDisplayH / newH;

        newImg.set({
            left: target.left,
            top: target.top,
            scaleX: newScaleX,
            scaleY: newScaleY,
            angle: target.angle || 0,
            originX: target.originX || 'center',
            originY: target.originY || 'center',
            name: (target as any).name,
            _customId: (target as any)._customId,
            opacity: (target as any).opacity,
            flipX: (target as any).flipX,
            flipY: (target as any).flipY,
            clipPath: (target as any).clipPath,
            filters: (target as any).filters
        });
        (newImg as any).src = newUrl;

        if (found.parent) {
            const parent = found.parent;
            const list = typeof parent.getObjects === 'function' ? parent.getObjects() : [];
            const idx = list.indexOf(target);
            parent.remove(target);
            if (typeof (parent as any).insertAt === 'function' && idx >= 0) (parent as any).insertAt(newImg, idx);
            else parent.add(newImg);
            safeAddWithUpdate(parent);
            parent.setCoords?.();
            canvas.value.setActiveObject(parent);
        } else {
            const oldIndex = canvas.value.getObjects().indexOf(target);
            canvas.value.remove(target);
            if (oldIndex >= 0 && typeof (canvas.value as any).insertAt === 'function') {
                (canvas.value as any).insertAt(newImg, oldIndex);
            } else {
                canvas.value.add(newImg);
            }
            canvas.value.setActiveObject(newImg);
        }

        canvas.value.requestRenderAll();
        saveCurrentState();
    } catch (e) {
        console.warn('[ai-studio] Falha ao substituir imagem:', e);
    }
};

const handleAiStudioCreated = async (asset: { id: string; name: string; url: string }) => {
    if (!asset?.url) return;
    await refreshAiStudioUploads();

    const opts = aiStudio.options.value || {};
    if (opts.applyMode === 'replace' && opts.replaceTargetId) {
        await replaceImageByCustomId(String(opts.replaceTargetId), asset.url);
    } else {
        await insertAssetToCanvas(asset);
    }

    aiStudio.handleCreated(asset);
    aiStudio.open.value = false;
};

const handlePaste = async (e: ClipboardEvent) => {
    if (!e.clipboardData || !canvas.value) return;
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item) continue;
        
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); 
            const file = item.getAsFile();
            if (file) {
                 try {
                     const result = await uploadFile(file);
                     if (result.success) {
                         const pasteProxyUrl = toWasabiProxyUrl(result.url) || result.url;
                         const img = await fabric.Image.fromURL(pasteProxyUrl, { crossOrigin: 'anonymous' });
                         if (img) {
                             // Scale down if huge
                             if (img.width > 500) {
                                 img.scaleToWidth(500);
                             }
                             
                             (img as any)._customId = Math.random().toString(36).substr(2, 9);
                             
                             // Check if there's a product card group selected to paste INTO
                             const activeObj = canvas.value.getActiveObject();
                             let targetProductCard = null;
                             
                             // Check if active object is a product card
                             if (activeObj && activeObj.type === 'group' && 
                                 (activeObj.isSmartObject || activeObj.isProductCard || isLikelyProductCard(activeObj))) {
                                 targetProductCard = activeObj;
                             }
                             // Check if active object is an image inside a product card
                             else if (activeObj && String(activeObj.type || '').toLowerCase() === 'image') {
                                 const allObjects = canvas.value.getObjects();
                                 for (const obj of allObjects) {
                                     if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard || isLikelyProductCard(obj))) {
                                         if (typeof obj.getObjects === 'function') {
                                             const children = obj.getObjects();
                                             const containsImage = children.some((child: any) => 
                                                 child === activeObj || child._customId === activeObj._customId
                                             );
                                             if (containsImage) {
                                                 targetProductCard = obj;
                                                 break;
                                             }
                                         }
                                     }
                                 }
                             }
                             // Check via .group property
                             else if (activeObj && (activeObj as any).group) {
                                 const parentGroup = (activeObj as any).group;
                                 if (parentGroup.isSmartObject || parentGroup.isProductCard || isLikelyProductCard(parentGroup)) {
                                     targetProductCard = parentGroup;
                                 }
                             }
                             
                             if (targetProductCard) {
                                 // Paste inside the product card
                                 console.log('📦 [handlePaste] Pasting image into product card:', targetProductCard._customId || targetProductCard.name);
                                 
                                 // Find existing product image to position relative to it
                                 const groupChildren = typeof targetProductCard.getObjects === 'function' 
                                     ? targetProductCard.getObjects() 
                                     : [];
                                 
                                 const existingProductImage = groupChildren.find((child: any) => 
                                     String(child.type || '').toLowerCase() === 'image' &&
                                     (child.name === 'smart_image' || child.name === 'product_image' || child.name === 'productImage')
                                 ) || groupChildren.find((child: any) => String(child.type || '').toLowerCase() === 'image');
                                 
                                 // Position at same place as existing image (with small offset)
                                 let targetLeft = existingProductImage ? (Number(existingProductImage.left) || 0) + 10 : 0;
                                 let targetTop = existingProductImage ? (Number(existingProductImage.top) || 0) + 10 : 0;
                                 
                                 const targetCanvas = groupLocalToCanvasPoint(targetProductCard, targetLeft, targetTop);
                                 img.set({
                                     left: targetCanvas.x,
                                     top: targetCanvas.y,
                                     originX: 'center',
                                     originY: 'center',
                                     selectable: true,
                                     evented: true,
                                     hasControls: true,
                                     hasBorders: true,
                                 });

                                 // CRITICAL: Add via safeAddWithUpdate so the image enters the group coordinate system.
                                 safeAddWithUpdate(targetProductCard, img);
                                 
                                 // Ensure deep-select mode is active
                                 targetProductCard.set({ subTargetCheck: true, interactive: true });
                                 targetProductCard.setCoords?.();
                                 targetProductCard.dirty = true;
                                 
                                 canvas.value.setActiveObject(img);
                                 canvas.value.requestRenderAll();
                                 canvasObjects.value = [...canvas.value.getObjects()];
                                 saveCurrentState();
                             } else {
                                 // Regular paste to canvas center
                                 const center = getCenterOfView();
                                 img.set({
                                     left: center.x,
                                     top: center.y,
                                     originX: 'center',
                                     originY: 'center'
                                 });
                                 
                                 canvas.value.add(img);
                                 canvas.value.setActiveObject(img);
                                 canvas.value.requestRenderAll();
                                 saveCurrentState();
                             }
                         }
                     }
                 } catch (err) {
                     console.error("Paste upload failed", err);
                 }
            }
        }
    }
}

onMounted(() => {
    window.addEventListener('paste', handlePaste);
})

onUnmounted(() => {
    window.removeEventListener('paste', handlePaste);
})

const addShape = (type: 'rect' | 'circle' | 'triangle' | 'star' | 'polygon' | 'line' | 'arrow' | 'ellipse', options: any = {}) => {
    if (!canvas.value) return;
    let shape;
    const center = getCenterOfView();
    const opts = { left: center.x - 50, top: center.y - 50, fill: '#cccccc', stroke: '#cccccc', strokeWidth: 2, objectCaching: false, noScaleCache: true, statefullCache: false, strokeUniform: true, ...options };

    if (type === 'rect') {
        shape = new fabric.Rect({ ...opts, width: 100, height: 100 });
    } else if (type === 'circle') {
        shape = new fabric.Circle({ ...opts, radius: 50 });
    } else if (type === 'ellipse') {
        shape = new fabric.Ellipse({ ...opts, rx: 75, ry: 50 });
    } else if (type === 'triangle') {
        shape = new fabric.Triangle({ ...opts, width: 100, height: 100 });
    } else if (type === 'polygon') {
        const points = opts.points || [
            { x: 50, y: 0 }, { x: 100, y: 38 }, { x: 82, y: 100 }, 
            { x: 18, y: 100 }, { x: 0, y: 38 }
        ];
        const { points: _pts, ...polygonOpts } = opts;
        shape = new fabric.Polygon(points, polygonOpts);
    } else if (type === 'star') {
        const points = opts.points || [
            {x: 50, y: 0}, {x: 61, y: 35}, {x: 98, y: 35}, {x: 68, y: 57}, 
            {x: 79, y: 91}, {x: 50, y: 70}, {x: 21, y: 91}, {x: 32, y: 57}, 
            {x: 2, y: 35}, {x: 39, y: 35}
        ];
        const { points: _pts, ...starOpts } = opts;
        shape = new fabric.Polygon(points, starOpts);
    } else if (type === 'line') {
        const coords = opts.coords || [0, 0, 200, 0];
        const { coords: _c, ...lineOpts } = opts;
        shape = new fabric.Line(coords, { ...lineOpts, left: center.x - 100, top: center.y });
    } else if (type === 'arrow') {
        // Simple arrow using Path
        const path = 'M 0 0 L 200 0 M 200 0 L 180 -10 M 200 0 L 180 10';
        shape = new fabric.Path(path, { ...opts, fill: 'transparent', stroke: '#cccccc', strokeWidth: 4, left: center.x - 100, top: center.y });
    }
    
    if (shape) {
        (shape as any)._customId = Math.random().toString(36).substr(2, 9);
        canvas.value.add(shape);
        canvas.value.setActiveObject(shape);
        canvas.value.requestRenderAll();
        saveCurrentState();
    }
}

const addHighlight = () => {
    if (!canvas.value) return; 
    const center = getCenterOfView();

    const circle = new fabric.Circle({
        radius: 40,
        fill: '#ff0000',
        stroke: '#ffffff',
        strokeWidth: 4,
        originX: 'center',
        originY: 'center',
    });

    const text = new fabric.IText('OFERTA', {
        fontSize: 14,
        fontWeight: 900,
        fill: '#ffffff',
        fontFamily: 'Inter',
        originX: 'center',
        originY: 'center',
    });

    const group = new fabric.Group([circle, text], {
        left: center.x - 40,
        top: center.y - 40,
        name: 'Selo de Oferta'
    });

    (group as any)._customId = Math.random().toString(36).substr(2, 9);
    canvas.value.add(group);
    canvas.value.setActiveObject(group);
    canvas.value.requestRenderAll();
    saveCurrentState();
}

const setPenWidth = (width: number) => {
    if (!canvas.value) return
    if (canvas.value.freeDrawingBrush) {
        canvas.value.freeDrawingBrush.width = width
    }
    setTool('draw')
}

const addText = (variant: 'default' | 'heading' | 'body' = 'default') => {
    if (!canvas.value) return; 
    setTool('select'); // Ensure we exit drawing mode
    const center = getCenterOfView();
    
    const defaults = {
        default: { fontSize: 40, fontWeight: 'normal', text: 'Seu Texto' },
        heading: { fontSize: 60, fontWeight: 'bold', text: 'Heading' },
        body: { fontSize: 24, fontWeight: 'normal', text: 'Body text' }
    }

    const config = defaults[variant] || defaults.default
    
    const text = new fabric.IText(config.text, {
        left: center.x - 60, top: center.y - 20, // Approx centered text
        originX: 'center',
        originY: 'center',
        fontFamily: 'Arial',
        fill: '#333333',
        fontSize: config.fontSize,
        fontWeight: config.fontWeight,
        editable: true
    });
    
    (text as any)._customId = Math.random().toString(36).substr(2, 9);
    canvas.value.add(text);
    canvas.value.setActiveObject(text);
    canvas.value.requestRenderAll();
    canvasObjects.value = [...canvas.value.getObjects()];
    saveCurrentState();
}

const clearCanvas = () => {
    if (!canvas.value) return;
    
    // Clear all objects but keep configuration
    canvas.value.clear();
    
    // ENSURE WORKSPACE IS DARK
    canvas.value.backgroundColor = '#1e1e1e';
    
    // Reset Data
    canvasObjects.value = [];
    selectedObjectId.value = null;
    selectedObjectRef.value = null;
    
    // Restore Environment
    updateArtboard(); // Redraw white page
    setupSnapping();
    setupReactivity();
    
    showClearConfirmModal.value = false;
    saveCurrentState();
}

const extractLimitFromName = (rawName: any): { cleanedName: string; extractedLimit: string | null } => {
    const name = String(rawName ?? '').trim();
    if (!name) return { cleanedName: '', extractedLimit: null };

    const idx = name.toUpperCase().search(/\bLIMITE\b/);
    if (idx === -1) return { cleanedName: name, extractedLimit: null };

    const extractedLimit = name.slice(idx).trim();
    const cleanedName = name
        .slice(0, idx)
        .replace(/[-–—|:]+$/g, '')
        .trim();
    return { cleanedName: cleanedName || name, extractedLimit: extractedLimit || null };
};

const normalizeLimitText = (raw: any): string | null => {
    const s0 = String(raw ?? '').trim();
    if (!s0) return null;
    let s = s0.toUpperCase().replace(/\s+/g, ' ').trim();
    if (s === 'LIMITE') return null;
    if (!s.startsWith('LIMITE')) s = `LIMITE ${s}`.trim();
    // "3UN" -> "3 UN"
    s = s.replace(/(\d)(UN|KG)\b/g, '$1 $2');
    return s;
};

/**
 * Converte valor de preço para string no formato brasileiro (vírgula decimal)
 */
const formatPriceValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        // Converter número para formato brasileiro (20.99 -> "20,99")
        return value.toFixed(2).replace('.', ',');
    }
    const str = String(value).trim();
    if (!str) return '';
    // Se já tem vírgula como separador decimal, usar como está
    if (str.includes(',')) return str;
    // Se tem ponto como separador decimal, converter para vírgula
    if (str.includes('.')) {
        const parts = str.split('.');
        if (parts.length === 2 && parts[1] && parts[1].length <= 2) {
            return str.replace('.', ',');
        }
    }
    return str;
};

/**
 * Retorna TODOS os preços disponíveis para o produto, ordenados por prioridade de exibição.
 * Retorna um objeto com informações dinâmicas baseadas no que realmente existe.
 */
const getAvailablePrices = (product: any) => {
    const prices: Array<{ label: string; value: string; type: 'main' | 'special' | 'pack' }> = [];
    const condition = product.specialCondition && String(product.specialCondition).trim() ? String(product.specialCondition).trim() : null;

    // Helper para verificar e formatar preço
    const addPrice = (value: any, label: string, type: 'main' | 'special' | 'pack') => {
        const formatted = formatPriceValue(value);
        if (formatted) {
            prices.push({ label, value: formatted, type });
            return true;
        }
        return false;
    };

    // PRIORIDADE: preços unitários são preferidos para exibição na etiqueta
    // O atacarejo geralmente mostra: preço unitário avulso (varejo) vs preço especial unitário (atacado)

    // Preço especial unitário (maior prioridade para atacado)
    const hasSpecialUnit = addPrice(product.priceSpecialUnit, '', 'special');

    // Preço especial de embalagem (só se não tem especial unitário)
    if (!hasSpecialUnit) {
        addPrice(product.priceSpecial, product.packageLabel || 'CX', 'special');
    }

    // Preço unitário avulso (preço principal varejo)
    // Se já tem um preço especial (atacado), o priceUnit é o preço de varejo (main).
    // Se NÃO tem preço especial, o priceUnit é o preço principal (main) — NUNCA classificar como 'special'
    // pois isso faria um produto simples aparecer com etiqueta atacarejo.
    const hasSpecial = prices.some(p => p.type === 'special');
    const hasUnitPrice = addPrice(product.priceUnit, '', 'main');

    // Preço de embalagem avulsa (só como complemento, não substitui unitário)
    if (!hasUnitPrice) {
        addPrice(product.pricePack, product.packageLabel || 'CX', hasSpecial ? 'main' : 'pack');
    } else {
        // Adicionar pricePack como info extra se diferente do priceUnit
        const packFormatted = formatPriceValue(product.pricePack);
        const unitFormatted = formatPriceValue(product.priceUnit);
        if (packFormatted && packFormatted !== unitFormatted) {
            addPrice(product.pricePack, product.packageLabel || 'CX', 'pack');
        }
    }

    // Fallback para preço legado
    if (prices.length === 0) {
        addPrice(product.price, '', 'main');
    }

    return {
        prices,
        condition,
        hasSpecial: prices.some(p => p.type === 'special'),
        mainPrice: prices[0]?.value || '0,00'
    };
};

// Smart Object Generator (Product Card)
const createSmartObject = async (product: any, x: number, y: number, width: number, height: number, gridId: string, labelTpl?: LabelTemplate) => {
    // DEBUG: Log product data
    console.log('[createSmartObject] Product data:', {
        name: product.name,
        price: product.price,
        weight: product.weight,
        packUnit: product.packUnit,
        priceWholesale: product.priceWholesale
    });

    // Layout Constants
    const cardHeight = height || width * 1.4; // Aspect ratio 1:1.4 (fallback)
    const halfW = width / 2;
    const halfH = cardHeight / 2;
    const baseSize = Math.min(width, cardHeight);
    const { cleanedName, extractedLimit } = extractLimitFromName(product?.name);
    const limitTextValue = normalizeLimitText(product?.limit ?? extractedLimit);
    
    // All coordinates are RELATIVE to group center (0,0 = center of card)
    
    // 1. Background (Card container)
    const bg = new fabric.Rect({
        width: width, 
        height: cardHeight, 
        fill: 'transparent',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'offerBackground'
    });

    // 2. Title (Top) - positioned at top of card
    const titleY = -halfH + (cardHeight * 0.08); // Near top
    const title = new fabric.Textbox(String(cleanedName || ''), {
        fontSize: baseSize * 0.09,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#1a1a1a',
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
        left: 0, // Centered horizontally
        top: titleY,
        width: width - 20,
        name: 'smart_title',
        shadow: new fabric.Shadow({ color: 'rgba(255,255,255,0.8)', blur: 2, offsetX: 1, offsetY: 1 }),
        // UX: Prevent font stretching/blurring, enforce reflow
        lockScalingY: true, 
        splitByGrapheme: false
    });
    if (typeof (title as any).initDimensions === 'function') (title as any).initDimensions();

    // 2.1 Limit (Below title)
    let limitObj: any = null;
    if (limitTextValue) {
        const titleH = (title.getScaledHeight?.() ?? title.height ?? 0);
        const gap = Math.max(4, baseSize * 0.02);
        limitObj = new fabric.Textbox(limitTextValue, {
            fontSize: baseSize * 0.045,
            fontFamily: 'Inter',
            fontWeight: '900',
            fill: '#d32f2f',
            textAlign: 'center',
            originX: 'center',
            originY: 'top',
            left: 0,
            top: titleY + titleH + gap,
            width: width - 20,
            name: 'smart_limit',
            data: { smartType: 'product-limit' },
            lockScalingY: true,
            splitByGrapheme: false
        });
        if (typeof (limitObj as any).initDimensions === 'function') (limitObj as any).initDimensions();
    }

    // 3. Product Image (Middle)
    let imgObj: any = null;
    const imgUrl = product.imageUrl || product.image || product.url;
    const imageY = 0; // Centered vertically
    
    if (imgUrl) {
        try {
            const proxiedImgUrl = toWasabiProxyUrl(imgUrl) || imgUrl;
            imgObj = await fabric.Image.fromURL(proxiedImgUrl, { crossOrigin: 'anonymous' });
            
            if (imgObj) {
                // Scale image to fit middle area
                const availW = width * 0.85;
                const availH = cardHeight * 0.5;
                const scale = Math.min(availW / imgObj.width, availH / imgObj.height);
                
                imgObj.set({
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center',
                    left: 0, // Centered
                    top: imageY, // Centered
                    name: 'smart_image'
                });
            }
        } catch (e) {
            console.warn('Image load failed, using placeholder rect', e);
            imgObj = null;
        }
    }
    
    // Fallback rect if no image
    if (!imgObj) {
        imgObj = new fabric.Rect({
            width: width * 0.7,
            height: cardHeight * 0.35,
            fill: '#333',
            rx: 8, ry: 8,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: imageY
        });
    }

    // 4. Price Tag (Bottom) - DINÂMICO: mostra apenas os preços que existem
    const marginBottom = cardHeight * 0.05;

    // Obter todos os preços disponíveis dinamicamente
    const availablePrices = getAvailablePrices(product);
    const priceStr = availablePrices.mainPrice
        .replace(/R\$\s*/gi, '')
        .replace(/\s+/g, '')
        .trim();

    // Unit label on the tag: ONLY "KG" or "UN" (gramatura stays in the product name).
    const unitText = inferUnitLabelFromProduct(product);

    console.log('[createSmartObject] Available prices:', {
        priceStr,
        unitText,
        availablePrices,
        originalPrice: product.price,
        priceUnit: product.priceUnit,
        priceSpecialUnit: product.priceSpecialUnit,
        pricePack: product.pricePack,
        priceSpecial: product.priceSpecial,
        specialCondition: product.specialCondition,
        name: product.name
    });

    if (!priceStr || priceStr === '0,00') {
        console.warn('[createSmartObject] PRECO VAZIO para produto:', product.name);
    }

    // Default tag (fallback)
    const buildDefaultPriceGroup = () => {
        // Use a neutral Y; we anchor it after layout so custom templates can have different heights.
        return buildDefaultPriceGroupForCard(priceStr, width, cardHeight, 0, unitText);
    };

    let priceTagGroup: any = null;
    if (labelTpl) {
        try {
            priceTagGroup = await instantiatePriceGroupFromTemplate(labelTpl);
            priceTagGroup.set({ left: 0, top: 0, name: 'priceGroup' });
            setPriceOnPriceGroup(priceTagGroup, priceStr, unitText);
            applyAtacarejoPricingToPriceGroup(priceTagGroup, product);
        } catch (e) {
            console.warn('[createSmartObject] Failed to use label template, falling back', e);
            priceTagGroup = null;
        }
    }
    if (!priceTagGroup) {
        // Verificar se tem preço especial/atacado usando o novo sistema
        const availablePrices = getAvailablePrices(product);
        const hasSpecial = availablePrices.prices.some(p => p.type === 'special');
        const hasMain = availablePrices.prices.some(p => p.type === 'main' || p.type === 'pack');
        // Atacarejo requer: preço especial (atacado) E (preço principal varejo OU condição especial)
        const hasWholesale = hasSpecial && (hasMain || !!product.specialCondition || !!product.priceWholesale);
        priceTagGroup = hasWholesale
            ? buildAtacarejoPriceGroupForCard(product, width, cardHeight, 0)
            : buildDefaultPriceGroup();
    }

    // Fill atacarejo fields even for the default group (no-op unless the template supports it).
    applyAtacarejoPricingToPriceGroup(priceTagGroup, product);

    const layout = layoutPriceGroup(priceTagGroup, width, cardHeight);
    const hForAnchor = layout?.pillH ?? (priceTagGroup.getScaledHeight?.() ?? priceTagGroup.height ?? (cardHeight * 0.18));
    priceTagGroup.set({
        originX: 'center',
        originY: 'center',
        left: 0,
        top: halfH - (hForAnchor / 2) - marginBottom
    });

    // Allow editing inside the label (select text/shapes).
    if (priceTagGroup && typeof priceTagGroup.getObjects === 'function') {
        priceTagGroup.set({ subTargetCheck: true, interactive: true });
        priceTagGroup.getObjects().forEach((child: any) => {
            const isBgImage = child?.name === 'price_bg_image' || child?.name === 'splash_image';
            child.set({
                selectable: !isBgImage,
                evented: !isBgImage,
                hasControls: !isBgImage,
                hasBorders: !isBgImage
            });
        });
    }

    // Main Product Card Group
    // NOTE: keep title above the image in stacking order (prevents it being hidden by tall images).
    const group = new fabric.Group([bg, imgObj, title, ...(limitObj ? [limitObj] : []), priceTagGroup], {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        isSmartObject: true,
        smartGridId: gridId,
        // Single-click deep select: user can click directly on inner elements.
        subTargetCheck: true,
        interactive: true
    });
    
    // Store card dimensions for containment checking (used by object:moving handler)
    (group as any)._cardWidth = width;
    (group as any)._cardHeight = cardHeight;

    // Persist ALL pricing metadata on the card so label templates can be reapplied safely.
    // This preserves ALL price information for future use.
    (group as any).price = (product as any).price ?? null;
    (group as any).pricePack = (product as any).pricePack ?? null;
    (group as any).priceUnit = (product as any).priceUnit ?? null;
    (group as any).priceSpecial = (product as any).priceSpecial ?? null;
    (group as any).priceSpecialUnit = (product as any).priceSpecialUnit ?? null;
    (group as any).specialCondition = (product as any).specialCondition ?? null;
    // Wholesale (legacy)
    (group as any).priceWholesale = (product as any).priceWholesale ?? null;
    (group as any).wholesaleTrigger = (product as any).wholesaleTrigger ?? null;
    (group as any).wholesaleTriggerUnit = (product as any).wholesaleTriggerUnit ?? null;
    // Pack metadata
    (group as any).packQuantity = (product as any).packQuantity ?? null;
    (group as any).packUnit = (product as any).packUnit ?? null;
    (group as any).packageLabel = (product as any).packageLabel ?? null;
    // Unit label
    (group as any).unit = (product as any).unit ?? null;
    (group as any).unitLabel = unitText;
    (group as any).limit = limitTextValue ?? null;
    // Store original product data for reference
    (group as any)._productData = { ...product };

    // Internal elements should be selectable for manual adjustments
    group.getObjects().forEach((obj: any) => {
        const isBackground = obj.name === 'offerBackground';
        obj.set({
            selectable: !isBackground,
            evented: !isBackground,
            hasControls: !isBackground,
            hasBorders: !isBackground
        });
    });
    
    // Add custom ID
    (group as any)._customId = Math.random().toString(36).substr(2, 9);

    // ESSENTIAL: Force group to calculate proper coordinates and cache
    group.setCoords();
    // Keep caching OFF for product cards to avoid occasional black-flash glitches.
    group.set({
        objectCaching: false,
        statefullCache: false,
        dirty: true,
        strokeWidth: 0 // Ensure no weird borders affect layout
    });

    // DEBUG: Log group creation details
    console.log('[createSmartObject] Group created:', {
        id: (group as any)._customId,
        objectsCount: group.getObjects().length,
        objects: group.getObjects().map((o: any) => ({ type: o.type, name: o.name, left: o.left, top: o.top })),
        groupLeft: group.left,
        groupTop: group.top,
        groupWidth: group.width,
        groupHeight: group.height
    });

    return group;
}

// Handler para abrir o modal de importação de lista, salvando a referência da zona
const handleImportProductList = () => {
    if (!canvas.value) return;

    const active = canvas.value.getActiveObject();
    if (active && isLikelyProductZone(active)) {
        targetGridZone.value = active;
        try {
            productImportExistingCount.value = getZoneChildren(active).length;
        } catch {
            productImportExistingCount.value = 0;
        }
    }

    showPasteListModal.value = true;
}

// Paste List Handlers
const handlePasteList = async () => {
    showPasteListModal.value = false;
    
    // Parse the list
    let data: any[] = [];
    if (activePasteTab.value === 'text') {
        data = parseProductList(pasteListText.value);
    } else {
        data = [];
    }

    if (data.length === 0) {
        pasteListText.value = '';
        pastedImage.value = null;
        return;
    }

    // Show processing state
    isProcessing.value = true;

    // Fetch images for each product from Contabo/Serper
    const productsWithImages = await Promise.all(
        data.map(async (product, index) => {
            try {
                // Build search term
                const searchTerm = `${product.name || ''} ${product.brand || ''} ${product.weight || ''}`.trim();
                
                const result = await $fetch<{ url?: string }>('/api/process-product-image', {
                    method: 'POST',
                    body: { term: searchTerm }
                });
                
                return {
                    ...product,
                    id: `prod_${Date.now()}_${index}`,
                    imageUrl: result?.url || null,
                    image: result?.url || null,
                    status: result?.url ? 'done' : 'error'
                };
            } catch (err) {
                console.warn('Failed to fetch image for:', product.name, err);
                return { 
                    ...product, 
                    id: `prod_${Date.now()}_${index}`,
                    imageUrl: null, 
                    image: null,
                    status: 'error'
                };
            }
        })
    );

    console.log('[handlePasteList] Products with images:', productsWithImages);

    isProcessing.value = false;
    
    // Store in review state and open review modal
    reviewProducts.value = productsWithImages;
    try {
        const zone = targetGridZone.value;
        productImportExistingCount.value = (zone && isLikelyProductZone(zone)) ? getZoneChildren(zone).length : 0;
    } catch {
        productImportExistingCount.value = 0;
    }
    showProductReviewModal.value = true;
    
    // Reset paste input (but keep data for review)
    pasteListText.value = '';
    pastedImage.value = null;
}

// Confirm import from review modal
const confirmProductImport = async (products: any[], opts?: { mode?: 'replace' | 'append'; labelTemplateId?: string }) => {
    console.log('[confirmProductImport] Called with products:', products);
    console.log('[confirmProductImport] targetGridZone:', targetGridZone.value);
    
    showProductReviewModal.value = false;
    
    if (!products || products.length === 0) {
        console.warn('[confirmProductImport] No products to import!');
        return;
    }
    
    // Get the saved zone reference and pass it to simulateSmartGrid
    const zone = targetGridZone.value;
    console.log('[confirmProductImport] Using zone:', zone);
    
    // Add to canvas using the products received from the modal (with edits applied)
    const mode = (opts?.mode === 'append' || opts?.mode === 'replace') ? opts.mode : 'replace';
    const labelTemplateId = typeof opts?.labelTemplateId === 'string' ? opts.labelTemplateId : undefined;
    await simulateSmartGrid(products, { margin: 10, gap: 15, orphanBehavior: 'fill' }, zone, { mode, labelTemplateId });
    
    // Clear review state and zone reference
    reviewProducts.value = [];
    targetGridZone.value = null;
    productImportExistingCount.value = 0;
    
    // Update layer panel
    if (canvas.value) {
        canvasObjects.value = [...canvas.value.getObjects()];
        console.log('[confirmProductImport] Canvas objects after import:', canvasObjects.value.length);
    }
}

const triggerListImageUpload = () => {
    listImageInput.value?.click();
}

const handleListImageUpload = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            pastedImage.value = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
}

const analyzeImageWithAI = () => {
    isAnalyzingImage.value = true;
    setTimeout(() => {
        isAnalyzingImage.value = false;
        // Mock AI result
        pasteListText.value = "Picanha Bovina - 69.90\nCerveja Heineken - 5.99\nCarvão 5kg - 15.00";
        activePasteTab.value = 'text';
    }, 2000);
}

const handleImagePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (items) {
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    pastedImage.value = event.target?.result as string;
                    activePasteTab.value = 'image';
                };
                if(blob) reader.readAsDataURL(blob);
            }
        }
    }
}

const handleFileUpload = (e: any) => {
    // ... Existing logic stub
}

const addGridFrames = (cols: number = 2, rows: number = 2, gap: number = 8) => {
    if (!canvas.value || !fabric) return;

    const center = getCenterOfView();
    const gridGroupId = 'grid_' + Math.random().toString(36).substr(2, 9);

    // Total grid dimensions — fit nicely in view
    const totalW = 600;
    const totalH = 600;
    const cellW = (totalW - gap * (cols - 1)) / cols;
    const cellH = (totalH - gap * (rows - 1)) / rows;

    // Top-left corner of the grid
    const startX = center.x - totalW / 2;
    const startY = center.y - totalH / 2;

    const cells: any[] = [];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = startX + c * (cellW + gap) + cellW / 2;
            const y = startY + r * (cellH + gap) + cellH / 2;

            const cell = new fabric.Rect({
                left: x,
                top: y,
                originX: 'center',
                originY: 'center',
                width: cellW,
                height: cellH,
                fill: '#e0e0e0',
                stroke: 'transparent',
                strokeWidth: 0,
                strokeUniform: true,
                isFrame: true,
                clipContent: true,
                name: `Grade ${cols}×${rows} [${r + 1},${c + 1}]`,
                objectCaching: false,
                statefullCache: false,
                noScaleCache: true,
                hasBorders: true,
                transparentCorners: false,
                cornerColor: '#0d99ff',
                cornerSize: 8,
                padding: 0,
                lockScalingX: false,
                lockScalingY: false,
                cornerStrokeColor: '#0d99ff',
                borderScaleFactor: 1
            });

            (cell as any)._customId = Math.random().toString(36).substr(2, 9);
            (cell as any).__strokeEnabled = false;
            (cell as any).layerName = 'FRAMER';
            (cell as any).gridGroupId = gridGroupId;
            (cell as any).gridCol = c;
            (cell as any).gridRow = r;
            (cell as any).isGridCell = true;

            cells.push(cell);
        }
    }

    // Add all cells to canvas
    cells.forEach((cell) => canvas.value!.add(cell));

    // Frames must stay below content
    ensureFramesBelowContents();

    // Select the first cell
    if (cells.length > 0) {
        canvas.value.setActiveObject(cells[0]);
    }

    canvas.value.requestRenderAll();
    canvasObjects.value = [...canvas.value.getObjects()];
    saveCurrentState();
}

const addGridZone = () => {
    if (!canvas.value) return;
    
    const center = getCenterOfView();
    // Create a nicer placeholder zone
    // Background with Glass/Dark aesthetic
    const zone = new fabric.Rect({
        width: 400, 
        height: 600, 
        fill: 'rgba(0,0,0,0)', 
        stroke: '#404040', 
        strokeWidth: 2, 
        strokeDashArray: [10, 10], 
        strokeUniform: true,
        rx: 16, ry: 16,
        originX: 'center', originY: 'center'
    });

    const group = new fabric.Group([zone], {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        isGridZone: true, // Marker flag
        name: 'gridZone',
        // Default layout behavior (matches ProductZoneSettings defaults)
        columns: 0,
        rows: 0,
        gapHorizontal: 20,
        gapVertical: 20,
        cardAspectRatio: 'auto',
        lastRowBehavior: 'fill',
        layoutDirection: 'horizontal',
        verticalAlign: 'top',
        subTargetCheck: false,
        hoverCursor: 'move',
        moveCursor: 'move',
        lockMovementX: false,
        lockMovementY: false,
        lockScalingFlip: true,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        transparentCorners: false,
        cornerColor: '#8b5cf6',
        cornerStyle: 'circle',
        cornerSize: 10,
        padding: 0,
        objectCaching: false,
        statefullCache: false
    });
    
    // Add Custom ID
    (group as any)._customId = Math.random().toString(36).substr(2, 9);
    (group as any)._zonePadding = 20;
    // CRITICAL: Initialize zone dimensions for persistence
    (group as any)._zoneWidth = 400;
    (group as any)._zoneHeight = 600;

    canvas.value.add(group);
    canvas.value.setActiveObject(group);
    canvas.value.requestRenderAll();
}

const simulateSmartGrid = async (
    customData: any[] = [],
    config = { margin: 10, gap: 15, orphanBehavior: 'fill' },
    zone: any = null,
    opts: { mode?: 'replace' | 'append'; labelTemplateId?: string } = {}
) => {
    console.log('[simulateSmartGrid] === START ===');
    console.log('[simulateSmartGrid] customData:', customData);
    console.log('[simulateSmartGrid] zone passed:', zone);
    
    if (!canvas.value || !fabric) {
        console.error('[simulateSmartGrid] Canvas or fabric not available!');
        return;
    }

    // 1. Identify Target Context (Zone vs Page) and Template
    // Use the passed zone if available, otherwise try to get from active selection
    let targetZone: any = zone;
    let templateObject: any = null;

    if (!targetZone) {
        const activeObj = canvas.value.getActiveObject();
        console.log('[simulateSmartGrid] No zone passed, checking activeObject:', activeObj);
        if (activeObj) {
            // Check for product zone using isLikelyProductZone to handle both isGridZone and isProductZone
            if (isLikelyProductZone(activeObj)) {
                targetZone = activeObj;
            } else if (activeObj.type === 'group') {
                templateObject = activeObj;
            }
        }
    } else {
        // Validate that the passed zone is still a valid product zone
        if (!isLikelyProductZone(targetZone)) {
            console.warn('[simulateSmartGrid] Passed zone is not a valid product zone, ignoring');
            targetZone = null;
        }
    }
    
    console.log('[simulateSmartGrid] Final targetZone:', targetZone);
    console.log('[simulateSmartGrid] templateObject:', templateObject);

    // 2. Setup Bounds
    let bounds = { 
        left: 0, 
        top: 0, 
        width: activePage.value?.width || 1080, 
        height: activePage.value?.height || 1920 
    };

    // When no zone is selected, try to use the first existing Frame as bounds
    // so products are placed INSIDE the visible frame area.
    if (!targetZone) {
        const existingFrame = canvas.value.getObjects().find((o: any) => !!o?.isFrame);
        if (existingFrame) {
            const fb = existingFrame.getBoundingRect(true);
            bounds = { left: fb.left, top: fb.top, width: fb.width, height: fb.height };
            console.log('[simulateSmartGrid] Using Frame bounds:', bounds);
        }
    }

    if (targetZone) {
        // Use getBoundingRect with absolute=true for world coordinates
        // This gives coordinates in the canvas logical space, not viewport
        let boundingRect = targetZone.getBoundingRect(true);
        const zoneCenterX = boundingRect.left + (boundingRect.width / 2);
        const zoneCenterY = boundingRect.top + (boundingRect.height / 2);

        if (targetZone.originX !== 'center' || targetZone.originY !== 'center') {
            targetZone.set({
                originX: 'center',
                originY: 'center',
                left: zoneCenterX,
                top: zoneCenterY
            });
            targetZone.setCoords();
            boundingRect = targetZone.getBoundingRect(true);
        }
        
        bounds = { 
            left: boundingRect.left, 
            top: boundingRect.top, 
            width: boundingRect.width, 
            height: boundingRect.height 
        };
        
        console.log('[simulateSmartGrid] Zone boundingRect (absolute):', boundingRect);
    }
    
    console.log('[simulateSmartGrid] bounds:', bounds);

    const mode: 'replace' | 'append' = (opts?.mode === 'append' || opts?.mode === 'replace') ? opts.mode : 'replace';
    const requestedTplId = typeof opts?.labelTemplateId === 'string' && opts.labelTemplateId.trim().length ? opts.labelTemplateId.trim() : undefined;

    // 3. Prepare Data
    let products = Array.isArray(customData) && customData.length > 0 ? customData : MOCK_PRODUCTS;
    const count = products.length;
    console.log('[simulateSmartGrid] products count:', count);
    if (count === 0) {
        console.warn('[simulateSmartGrid] No products to render!');
        return;
    }

    // When appending into a zone, compute the existing count to place new items after it.
    let existingCount = 0;
    if (targetZone && mode === 'append') {
        try {
            existingCount = getZoneChildren(targetZone).length;
        } catch {
            existingCount = 0;
        }
    }
    const countForLayout = targetZone ? (existingCount + count) : count;

    // 4. Grid Configuration
    const gap = config.gap || 15;
    const margin = config.margin || 20;
    const padding = targetZone && typeof targetZone._zonePadding === 'number' ? targetZone._zonePadding : (targetZone && typeof targetZone.padding === 'number' ? targetZone.padding : margin);
    const gapX = targetZone && typeof targetZone.gapHorizontal === 'number' ? targetZone.gapHorizontal : gap;
    const gapY = targetZone && typeof targetZone.gapVertical === 'number' ? targetZone.gapVertical : gap;
    const lastRowBehavior = targetZone?.lastRowBehavior || config.orphanBehavior || 'fill';
    
    // Determine Item Size
    let itemWidth = 200;
    let itemHeight = 300;
    let cols = 1; // Default
    let layoutRows = 1;

    if (targetZone) {
        const zoneConfig: ProductZone = {
            x: bounds.left,
            y: bounds.top,
            width: bounds.width,
            height: bounds.height,
            padding,
            gapHorizontal: gapX,
            gapVertical: gapY,
            columns: typeof targetZone.columns === 'number' ? targetZone.columns : 0,
            rows: typeof targetZone.rows === 'number' ? targetZone.rows : 0,
            cardAspectRatio: targetZone.cardAspectRatio ?? 'auto',
            lastRowBehavior: targetZone.lastRowBehavior ?? 'center'
        };
        
        const gridLayout = calculateGridLayout(zoneConfig, countForLayout);
        cols = gridLayout.cols;
        layoutRows = gridLayout.rows;
        itemWidth = gridLayout.itemWidth;
        itemHeight = gridLayout.itemHeight;
    } else if (templateObject) {
        itemWidth = templateObject.getScaledWidth();
        itemHeight = templateObject.getScaledHeight();
        
        if (!targetZone) {
            // If strictly replacing template on page, remove it
            canvas.value.remove(templateObject);
        }
    }

    // 5. Layout Calculation
    // Effective Width
    const effectiveWidth = bounds.width - (padding * 2);
    
    // Calculate Cols (Default Logic if not Zone)
    if (!targetZone) {
        const maxCols = Math.floor(effectiveWidth / (itemWidth + gap));
        cols = Math.max(1, Math.min(count, maxCols));
    }
    
    // Batch Generation ID
    const batchGridId = `grid_${Math.random().toString(36).substr(2, 9)}`;
    if (!targetZone) {
        layoutRows = Math.ceil(count / cols);
    }
    
    const totalRows = layoutRows;
    const lastRowItemCount = countForLayout % cols || cols;

    if (targetZone) {
        const hasFixedColumns = typeof targetZone.columns === 'number' && targetZone.columns > 0;
        targetZone._zonePadding = padding;
        targetZone.set({
            padding: 0,
            gapHorizontal: gapX,
            gapVertical: gapY,
            lastRowBehavior: lastRowBehavior,
            columns: hasFixedColumns ? targetZone.columns : 0,
            rows: hasFixedColumns ? totalRows : 0,
            // Ensure both flags are set for consistency
            isGridZone: true,
            isProductZone: true
        });
    }

    isProcessing.value = true;

    try {
        // Allow import-time override of the label template.
        const prevZoneTplId = targetZone ? String((targetZone as any)._zoneGlobalStyles?.splashTemplateId || '').trim() : '';
        const prevZoneTplIdNormalized = prevZoneTplId.length ? prevZoneTplId : undefined;
        const zoneTplId = requestedTplId ?? prevZoneTplIdNormalized;
        const zoneTpl = zoneTplId ? labelTemplates.value.find(t => t.id === zoneTplId) : undefined;

        // Persist override on the zone so future imports use the same template.
        if (targetZone && requestedTplId && requestedTplId !== prevZoneTplIdNormalized) {
            const prev = (targetZone as any)._zoneGlobalStyles ?? {};
            (targetZone as any)._zoneGlobalStyles = { ...prev, splashTemplateId: requestedTplId };
        }

        // If the user picked a template while appending, keep the zone consistent (apply to existing cards too).
        if (targetZone && mode === 'append' && requestedTplId && requestedTplId !== prevZoneTplIdNormalized && existingCount > 0) {
            await applyLabelTemplateToZone(targetZone, requestedTplId);
        }

        const promises = products.map(async (product: any, index: number) => {
            const slotIndex = existingCount + index;
            const currentRow = Math.floor(slotIndex / cols);
            const currentCol = slotIndex % cols;
            
            // Base Position (Relative to bounds)
            // Calculate strictly based on itemWidth/Height to fill the Zone
            let xOffset = padding + (currentCol * (itemWidth + gapX));
            const yOffset = padding + (currentRow * (itemHeight + gapY));
            
            // Center only if requested; "fill" will be handled by the zone relayout pass.
            if (currentRow === totalRows - 1 && lastRowItemCount < cols && lastRowBehavior === 'center') {
                const rowWidth = (lastRowItemCount * itemWidth) + ((lastRowItemCount - 1) * gapX);
                const totalZoneWidth = effectiveWidth;
                const centerStart = (totalZoneWidth - rowWidth) / 2;
                xOffset = centerStart + (currentCol * (itemWidth + gapX)) + padding;
            }

            const finalX = bounds.left + xOffset + (itemWidth / 2);
            const finalY = bounds.top + yOffset + (itemHeight / 2);
            
            console.log(`[simulateSmartGrid] Product ${index}: slotIndex=${slotIndex}, xOffset=${xOffset}, yOffset=${yOffset}, finalX=${finalX}, finalY=${finalY}, itemW=${itemWidth}, itemH=${itemHeight}`);

            // Generate Object
            if (templateObject) {
                  // Clone using Promise API (Fabric v6+)
                 const cloned: any = await templateObject.clone(['name', 'id', 'smartGridId', 'isSmartObject', 'originX', 'originY']);

                  // CRITICAL FIX: Preserve nested object names after clone
                  // The clone operation loses names of children inside groups (like priceGroup)
                  const fixNestedNames = (clonedObj: any, sourceObj: any) => {
                      if (!clonedObj || !sourceObj) return;
                      
                      // Fix direct children
                      if (typeof clonedObj.getObjects === 'function' && typeof sourceObj.getObjects === 'function') {
                          const clonedChildren = clonedObj.getObjects();
                          const sourceChildren = sourceObj.getObjects();
                          
                          clonedChildren.forEach((child: any, idx: number) => {
                              const sourceChild = sourceChildren[idx];
                              if (sourceChild && sourceChild.name && !child.name) {
                                  child.set('name', sourceChild.name);
                                  console.log(`[simulateSmartGrid] Fixed name for child ${idx}: ${sourceChild.name}`);
                              }
                              
                              // Recursively fix nested groups
                              if (child.type === 'group' && sourceChild && sourceChild.type === 'group') {
                                  fixNestedNames(child, sourceChild);
                              }
                          });
                      }
                  };
                  
                  fixNestedNames(cloned, templateObject);

                  cloned.set({
                     left: finalX,
                     top: finalY,
                     smartGridId: batchGridId,
                     opacity: 1,
                     visible: true,
                     originX: 'center',
                     originY: 'center',
                     // Default behavior (Canva-like): select/move the whole card.
                     // Deep select is enabled only on double click.
                     subTargetCheck: false,
                     interactive: false
                  });

                  // Ensure internal elements are selectable
                  const objects = cloned.getObjects ? cloned.getObjects() : [];
                  objects.forEach((obj: any) => {
                      const isBackground = obj.name === 'offerBackground' || obj.name === 'price_bg';
                      obj.set({
                          selectable: !isBackground,
                          evented: !isBackground,
                          hasControls: !isBackground,
                          hasBorders: !isBackground
                      });
                  });

                 // Data Injection Logic
                  let titleFound = false;
                  let priceFound = false;
                  const { cleanedName, extractedLimit } = extractLimitFromName(product?.name);
                  const limitTextValue = normalizeLimitText(product?.limit ?? extractedLimit);
                  let limitFound = false;

                  // Determinar preço principal (dinâmico - usa os preços disponíveis)
                  const availablePrices = getAvailablePrices(product);
                  const displayPrice = availablePrices.mainPrice;

                 objects.forEach((obj: any) => {
                    if (obj.type.includes('text')) {
                        if (obj.name === 'smart_title') {
                            obj.set('text', cleanedName);
                            titleFound = true;
                        } else if (obj.name === 'smart_price') {
                            obj.set('text', displayPrice);
                            priceFound = true;
                        } else if (
                            obj?.name === 'smart_limit' ||
                            obj?.name === 'limitText' ||
                            obj?.name === 'product_limit' ||
                            obj?.data?.smartType === 'product-limit'
                        ) {
                            obj.set('text', limitTextValue || '');
                            if (typeof obj.initDimensions === 'function') obj.initDimensions();
                            limitFound = true;
                        }
                    }
                 });

                 // Fallback
                 if (!titleFound || !priceFound) {
                     const texts = objects.filter((o: any) => o.type.includes('text'));
                     if (texts.length >= 1 && !titleFound) texts[0].set('text', cleanedName);
                     if (texts.length >= 2 && !priceFound) texts[1].set('text', displayPrice);
                 }

                 // If template doesn't include a limit object but product has a limit, create one.
                 if (!limitFound && limitTextValue) {
                     const cardW = cloned._cardWidth ?? cloned.width ?? itemWidth;
                     const cardH = cloned._cardHeight ?? cloned.height ?? itemHeight;
                     const baseSize = Math.min(cardW || itemWidth, cardH || itemHeight);
                     const limitObj = new fabric.Textbox(limitTextValue, {
                         fontSize: baseSize * 0.045,
                         fontFamily: 'Inter',
                         fontWeight: '900',
                         fill: '#d32f2f',
                         textAlign: 'center',
                         originX: 'center',
                         originY: 'top',
                         left: 0,
                         top: -(cardH || itemHeight) / 2 + ((cardH || itemHeight) * 0.12),
                         width: (cardW || itemWidth) * 0.9,
                         name: 'smart_limit',
                         data: { smartType: 'product-limit' },
                         lockScalingY: true,
                         splitByGrapheme: false
                     });
                     if (typeof (limitObj as any).initDimensions === 'function') (limitObj as any).initDimensions();
                     safeAddWithUpdate(cloned, limitObj);
                 }
                
                 if (!cloned._customId) cloned._customId = Math.random().toString(36).substr(2, 9);
                 return cloned;

                 } else {
                  return await createSmartObject(product, finalX, finalY, itemWidth, itemHeight, batchGridId, zoneTpl);
            }
        });

        const smartObjects = await Promise.all(promises);
        console.log('[simulateSmartGrid] Created objects:', smartObjects.length, smartObjects);
        
        // If we have a target zone, update it in place
        if (targetZone && canvas.value) {
            console.log('[simulateSmartGrid] Adding cards to zone group');

            // Get existing objects from zone (like background rect, labels)
            const existingZoneObjects = targetZone.getObjects ? targetZone.getObjects() : [];
            const canvasObjects = canvas.value.getObjects();
            const existingCards = canvasObjects.filter((obj: any) => (obj.isSmartObject || obj.isProductCard) && obj.parentZoneId === targetZone._customId);

            const zoneBounds = targetZone.getBoundingRect(true);
            const zoneRect = existingZoneObjects.find((obj: any) => obj.type === 'rect' && obj.strokeDashArray);

            // Remove previous cards from the zone only when replacing.
            if (mode === 'replace') {
                existingCards.forEach((card: any) => canvas.value.remove(card));
            }

            // IMPORTANT: For Fabric.js groups, internal object positions are relative to the GROUP CENTER
            // The zone has originX: 'center', originY: 'center', so we need to offset by half the zone dimensions
            const zoneWidth = zoneRect?.width || zoneBounds.width || 400;
            const zoneHeight = zoneRect?.height || zoneBounds.height || 600;

            // CRITICAL: Clear any clipPath from the zone to prevent rendering errors
            // Product zones should not have clipPath as cards are added separately to canvas
            if (targetZone && targetZone.clipPath) {
                targetZone.clipPath = null;
            }

            // DON'T add to zone group - add directly to canvas to avoid coordinate issues
            // This is the Figma-like behavior where elements are independent
            let maxOrder = -1;
            if (mode === 'append' && existingCards.length > 0) {
                existingCards.forEach((c: any) => {
                    const o = Number((c as any)._zoneOrder);
                    if (Number.isFinite(o)) maxOrder = Math.max(maxOrder, o);
                });
                if (maxOrder < 0) maxOrder = existingCards.length - 1;
            }
            smartObjects.forEach((obj: any) => {
                obj.isProductCard = true;
                obj.parentZoneId = targetZone._customId;
                // Preserve stable ordering when adding to an existing zone.
                if (mode === 'append') {
                    (obj as any)._zoneOrder = maxOrder + 1;
                    maxOrder += 1;
                }
                // Avoid rare black-flash rendering glitches on some browsers by disabling caching on cards.
                obj.set?.({ objectCaching: false, statefullCache: false, dirty: true });
                canvas.value.add(obj);
                // Fabric v7 uses bringObjectToFront; older builds sometimes expose bringToFront on canvas.
                const c: any = canvas.value as any;
                if (typeof c.bringObjectToFront === 'function') c.bringObjectToFront(obj);
                else if (typeof c.bringToFront === 'function') c.bringToFront(obj);
                else if (typeof (obj as any).bringToFront === 'function') (obj as any).bringToFront();
            });

            targetZone.set({
                isProductZone: true,
                isGridZone: true, // Ensure both flags are set for compatibility
                subTargetCheck: false, // Disable sub-target since cards are separate
                selectable: true,
                evented: true,
                name: 'productZoneContainer',
                lockScalingFlip: true,
                objectCaching: false,
                statefullCache: false
            });

            // Store zone dimensions for reference
            (targetZone as any)._zoneWidth = zoneWidth;
            (targetZone as any)._zoneHeight = zoneHeight;

            targetZone.setCoords();
            
            // Force Layout Recalculation to ensure alignment (centering, gaps) is perfect
            // We pass smartObjects explicitly so it doesn't have to search
            try {
                const cache = (mode === 'append') ? [...existingCards, ...smartObjects] : smartObjects;
                recalculateZoneLayout(targetZone, cache);
            } catch (calcErr) {
                console.warn('Grid layout recalc error:', calcErr);
            }

            // Select the first created object
            if (smartObjects.length > 0) {
                canvas.value.setActiveObject(smartObjects[0]);
            }
        } else {
            // No zone - add directly to canvas and ensure they're above the Frame
            console.log('[simulateSmartGrid] NO ZONE PATH - adding', smartObjects.length, 'cards directly. Bounds used:', JSON.stringify(bounds));
            smartObjects.forEach((obj: any, idx: number) => {
                console.log(`[simulateSmartGrid] Card ${idx}: left=${obj.left}, top=${obj.top}, w=${obj.width}, h=${obj.height}, visible=${obj.visible}, opacity=${obj.opacity}`);
                // Ensure cards are NOT parented to any Frame (prevents clipPath hiding them)
                obj.clipPath = null;
                obj.parentFrameId = undefined;
                delete obj._frameClipOwner;
                obj.visible = true;
                obj.opacity = 1;
                canvas.value.add(obj);
                // Bring each card to front so they sit ABOVE the white Frame
                const c: any = canvas.value as any;
                if (typeof c.bringObjectToFront === 'function') c.bringObjectToFront(obj);
                else if (typeof c.bringToFront === 'function') c.bringToFront(obj);
            });
            // Ensure frames stay behind all content (products on top, frame at back)
            ensureFramesBelowContents();

            // Select the first created object
            if (smartObjects.length > 0) {
                canvas.value.setActiveObject(smartObjects[0]);
            }

            // Diagnostic: log final canvas state
            const allObjs = canvas.value.getObjects();
            console.log('[simulateSmartGrid] Canvas objects after import:', allObjs.length);
            allObjs.forEach((o: any, i: number) => {
                console.log(`  [${i}] type=${o.type} name=${o.name || o.layerName || '?'} isFrame=${!!o.isFrame} isSmartObject=${!!o.isSmartObject} left=${o.left} top=${o.top} visible=${o.visible} opacity=${o.opacity} clipPath=${!!o.clipPath} parentFrameId=${o.parentFrameId || 'none'}`);
            });
        }
        
        console.log('[simulateSmartGrid] === DONE ===');

    } catch (err) {
        console.error("Grid Generation Failed:", err);
    } finally {
        isProcessing.value = false;
        canvas.value.requestRenderAll();
        saveCurrentState();
    }
}

// === ZONE LOGIC ===

const getCurrentZoneObject = () => {
    if (!canvas.value) return null;
    
    // 1. Check active canvas object first (the real Fabric object)
    const active = canvas.value.getActiveObject?.();
    if (active && isLikelyProductZone(active)) return active;
    
    // 2. If active is a product card, find its parent zone on canvas
    if (active && isLikelyProductCard(active)) {
        const parentZoneId = (active as any).parentZoneId;
        if (parentZoneId) {
            const zone = canvas.value.getObjects().find((o: any) => 
                isLikelyProductZone(o) && o._customId === parentZoneId
            );
            if (zone) return zone;
        }
    }
    
    // 3. If selected snapshot looks like a zone, find the REAL Fabric object by _customId
    // CRITICAL: Use isLikelyProductZone() for FULL detection (flags, name, custom props, strokeDashArray)
    // instead of checking individual properties. This is essential for legacy arts where flags
    // may not have been serialized originally.
    const selected = selectedObjectRef.value as any;
    if (selected && (selected.isGridZone || selected.isProductZone || selected.name === 'gridZone' || selected.name === 'productZoneContainer'
        || (typeof selected._zonePadding === 'number' && typeof selected._zoneWidth === 'number')
    )) {
        const zoneId = selected._customId;
        if (zoneId) {
            // First try with full detection
            let zone = canvas.value.getObjects().find((o: any) => 
                isLikelyProductZone(o) && o._customId === zoneId
            );
            if (zone) return zone;
            // Fallback: find by _customId alone and set flags if it's a group
            // (handles edge case where real object lost flags but snapshot preserved them)
            zone = canvas.value.getObjects().find((o: any) => o._customId === zoneId && o.type === 'group');
            if (zone) {
                zone.isGridZone = true;
                ensureZoneSanity(zone);
                return zone;
            }
        }
    }
    
    // 4. If selected snapshot is a product card, find parent zone on canvas
    if (selected && isLikelyProductCard(selected)) {
        const parentZoneId = selected.parentZoneId;
        if (parentZoneId) {
            const zone = canvas.value.getObjects().find((o: any) => 
                isLikelyProductZone(o) && o._customId === parentZoneId
            );
            if (zone) return zone;
        }
    }
    
    return null;
}

const handleUpdateZone = (prop: string, val: any) => {
    console.log('🔍 [handleUpdateZone] CALLED with prop:', prop, 'val:', val);
    // 1. Update Reactive State
    productZoneState.updateZone({ [prop]: val });
    
    // 2. Apply to Canvas Object
    updateZoneOnCanvas(prop, val);
}

const applyZoneUpdates = (zone: any, updates: Record<string, any>, opts: { save?: boolean } = {}) => {
    if (!canvas.value || !zone) return;
    ensureZoneSanity(zone);

    const zoneRect = getZoneRect(zone);
    const relayoutProps = new Set([
        'padding',
        'gapHorizontal',
        'gapVertical',
        'columns',
        'rows',
        'cardAspectRatio',
        'lastRowBehavior',
        'layoutDirection',
        'verticalAlign',
        'highlightCount',
        'highlightPos',
        'highlightHeight'
    ]);

    let shouldRelayout = false;

    Object.entries(updates).forEach(([prop, val]) => {
        if (prop === 'padding') {
            zone._zonePadding = Number(val);
            zone.set('padding', 0);
            shouldRelayout = true;
            return;
        }

        if (prop === 'isLocked') {
            const locked = !!val;
            zone.set({
                lockMovementX: locked,
                lockMovementY: locked,
                lockScalingX: locked,
                lockScalingY: locked
            });
            return;
        }

        // Visual props live on the inner rect.
        if (prop === 'backgroundColor' && zoneRect) {
            // Persist the intent on the zone (so we can distinguish "no background" vs Fabric default black).
            zone.set('backgroundColor', val);
            zoneRect.set('fill', val || 'transparent');
            return;
        }
        if (prop === 'borderColor' && zoneRect) {
            zoneRect.set('stroke', val);
            return;
        }
        if (prop === 'borderWidth' && zoneRect) {
            zoneRect.set('strokeWidth', Number(val));
            return;
        }
        if (prop === 'borderRadius' && zoneRect) {
            const r = Number(val);
            zoneRect.set({ rx: r, ry: r });
            return;
        }
        if (prop === 'showBorder' && zoneRect) {
            zoneRect.set('strokeWidth', val ? Math.max(zoneRect.strokeWidth || 0, 2) : 0);
            return;
        }

        zone.set(prop, val);
        if (relayoutProps.has(prop)) shouldRelayout = true;
    });

    safeAddWithUpdate(zone);
    zone.setCoords();

    if (shouldRelayout) {
        // Cache children before relayout to prevent losing them
        const cachedChildren = getZoneChildren(zone);
        recalculateZoneLayout(zone, cachedChildren, { save: false });
    }

    canvas.value.requestRenderAll();
    if (opts.save !== false) {
        // Set flag to prevent object:modified event from also saving state (prevents duplicate entries)
        isApplyingZoneUpdate = true;
        saveCurrentState();
        isApplyingZoneUpdate = false;
    }
    // Refresh snapshot so PropertiesPanel picks up the new values
    refreshSelectedRef();
};

const updateZoneOnCanvas = (prop: string, val: any) => {
    const zone = getCurrentZoneObject();
    console.log('🔍 [updateZoneOnCanvas] zone found:', !!zone, zone?._customId, 'prop:', prop);
    if (!zone) {
        console.warn('⚠️ [updateZoneOnCanvas] No zone found! Cannot update canvas.');
        return;
    }
    applyZoneUpdates(zone, { [prop]: val });
}

const applyGlobalStylesToCards = (styles: Partial<GlobalStyles>, zone?: any) => {
    console.log('🔍 [applyGlobalStylesToCards] CALLED', { hasZone: !!zone, stylesKeys: Object.keys(styles || {}) });
    if (!canvas.value) {
        console.warn('⚠️ [applyGlobalStylesToCards] No canvas!');
        return;
    }
    const list = zone && isLikelyProductZone(zone)
        ? getZoneChildren(zone)
        : canvas.value.getObjects().filter((o: any) => o?.type === 'group' && (o.isSmartObject || o.isProductCard || isLikelyProductCard(o)));
    
    console.log('🔍 [applyGlobalStylesToCards] Found cards:', list.length);

    list.forEach((card: any, idx: number) => {
        console.log(`🔍 [applyGlobalStylesToCards] Processing card ${idx}:`, { 
            type: card?.type, 
            name: card?.name,
            hasGetObjects: typeof card?.getObjects === 'function'
        });
        if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') {
            console.log(`⚠️ [applyGlobalStylesToCards] Skipping card ${idx} - invalid`);
            return;
        }
        const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? 0;
        const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? 0;
        console.log(`🔍 [applyGlobalStylesToCards] Card ${idx} dimensions:`, { cardW, cardH });
        if (cardW && cardH) {
            console.log(`🔍 [applyGlobalStylesToCards] Calling resizeSmartObject for card ${idx}`);
            resizeSmartObject(card, cardW, cardH, styles);
        }
        safeAddWithUpdate(card);
        card.setCoords();
    });
    
    console.log('🔍 [applyGlobalStylesToCards] DONE');
};

const handleApplyZonePreset = (presetId: string) => {
    console.log('🔍 [handleApplyZonePreset] CALLED with presetId:', presetId);
    productZoneState.applyPreset(presetId);
    if (!canvas.value) return;
    const active = getCurrentZoneObject();
    if (!active) return;
    const z = productZoneState.productZone.value;
    applyZoneUpdates(active, {
        columns: z.columns ?? 0,
        rows: z.rows ?? 0,
        layoutDirection: z.layoutDirection ?? 'horizontal',
        cardAspectRatio: z.cardAspectRatio ?? 'auto',
        lastRowBehavior: z.lastRowBehavior ?? 'fill'
    });
};

const handleSyncZoneGaps = (padding: number) => {
    productZoneState.syncGapsWithPadding(padding);
    if (!canvas.value) return;
    const active = getCurrentZoneObject();
    if (!active) return;
    const z = productZoneState.productZone.value;
    applyZoneUpdates(active, {
        padding: z.padding,
        gapHorizontal: z.gapHorizontal ?? z.padding,
        gapVertical: z.gapVertical ?? z.padding
    });
};

const handleUpdateGlobalStyles = async (prop: string, val: any) => {
    console.log('🔍 [handleUpdateGlobalStyles] CALLED with prop:', prop, 'val:', val);
    productZoneState.updateGlobalStyles({ [prop]: val });
    if (!canvas.value) return;

    let zone = getCurrentZoneObject();

    // If no zone found but a card is selected, try to find its parent zone
    if (!zone && selectedObjectRef.value && isLikelyProductCard(selectedObjectRef.value)) {
        const parentZoneId = selectedObjectRef.value.parentZoneId;
        if (parentZoneId) {
            zone = canvas.value.getObjects().find((o: any) =>
                isLikelyProductZone(o) && o._customId === parentZoneId
            );
        }
    }

    // Persist styles on the zone so they survive undo/redo and reload.
    if (zone) {
        const prev = (zone as any)._zoneGlobalStyles ?? {};
        (zone as any)._zoneGlobalStyles = { ...prev, [prop]: val };
    }

    const stylesToApply: Partial<GlobalStyles> = zone
        ? ((zone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value)
        : productZoneState.globalStyles.value;

    // Special case: label template selection - just update reference, don't rebuild existing cards
    // The template will be used for NEW products added to the zone
    if (prop === 'splashTemplateId' && zone) {
        // Just update the template reference without rebuilding existing cards
        await applyLabelTemplateToZone(zone, val, false);
        refreshSelectedRef();
        return;
    }

    applyGlobalStylesToCards(stylesToApply, zone || undefined);
    canvas.value.requestRenderAll();
    // Força a atualização visual adicional para garantir que mudanças sejam visíveis
    nextTick(() => {
        canvas.value?.requestRenderAll();
    });
    saveCurrentState();
    refreshSelectedRef();
};

const handleApplyTemplateToZone = async () => {
    const zone = getCurrentZoneObject();
    if (!zone) return;

    const templateId = (zone as any)._zoneGlobalStyles?.splashTemplateId;
    if (!templateId) {
        console.log('⚠️ [handleApplyTemplateToZone] No template selected');
        return;
    }

    console.log('🔍 [handleApplyTemplateToZone] Applying template to all cards:', templateId);
    await applyLabelTemplateToZone(zone, templateId, true); // true = apply to existing cards
    refreshSelectedRef();
};

const collectObjectsDeep = (root: any): any[] => {
    const out: any[] = [];
    const walk = (obj: any) => {
        if (!obj) return;
        out.push(obj);
        if (obj.type === 'group' && typeof obj.getObjects === 'function') {
            const children = obj.getObjects() || [];
            children.forEach(walk);
        }
    };
    if (root && typeof root.getObjects === 'function') {
        root.getObjects().forEach(walk);
    }
    return out;
};

const findByName = (objects: any[], name: string) => objects.find((o: any) => o?.name === name);

const parsePriceToCents = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const s0 = String(v).trim();
    if (!s0) return null;
    const s = s0.replace(/[^\d.,-]/g, '');
    if (!s) return null;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    let normalized = s;
    if (hasComma && hasDot) normalized = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
    else if (hasComma) normalized = s.replace(/\./g, '').replace(',', '.'); // 123,45 -> 123.45
    else normalized = s.replace(/,/g, ''); // 1,234.56 -> 1234.56
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
};

const formatCentsToPrice = (cents: number | null): string | null => {
    if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
    const n = Math.round(cents);
    const abs = Math.abs(n);
    const int = Math.floor(abs / 100);
    const dec = String(abs % 100).padStart(2, '0');
    const sign = n < 0 ? '-' : '';
    return `${sign}${int},${dec}`;
};

const splitPriceParts = (raw: any): { integer: string; dec: string } => {
    const s0 = String(raw ?? '')
        .replace(/R\$\s*/gi, '')
        .replace(/\s+/g, '')
        .trim();
    if (!s0) return { integer: '0', dec: '00' };

    // Support thousands separators:
    // - "1.999,99" (pt-BR)
    // - "1,999.99" (en-US)
    const lastComma = s0.lastIndexOf(',');
    const lastDot = s0.lastIndexOf('.');
    const sepIdx = Math.max(lastComma, lastDot);

    if (sepIdx === -1) {
        const integer = s0.replace(/[^\d]/g, '') || '0';
        return { integer, dec: '00' };
    }

    const rawInt = s0.slice(0, sepIdx);
    const rawDec = s0.slice(sepIdx + 1);
    const integer = rawInt.replace(/[^\d]/g, '') || '0';
    const dec = rawDec.replace(/[^\d]/g, '').padEnd(2, '0').slice(0, 2) || '00';
    return { integer, dec };
};

const normalizeUnitForLabel = (raw: any): 'KG' | 'UN' => {
    const s0 = String(raw ?? '').trim();
    if (!s0) return 'UN';
    const s = s0.toUpperCase().replace(/\s+/g, '');

    // Remove a leading numeric quantity (e.g. "500ML", "1KG", "2,5KG") so we don't show gramatura.
    const tok = s.replace(/^\d+(?:[.,]\d+)?/, '');

    // Only allow these units on the label.
    if (tok === 'KG' || tok === 'K' || tok === 'KILO' || tok === 'KILOS' || tok.includes('KG')) return 'KG';
    if (tok === 'UN' || tok === 'UND' || tok === 'UNID' || tok === 'UNIDADE' || tok.includes('UN')) return 'UN';

    // Everything else (ML/L/G/etc) becomes "UN" (gramatura stays in the product name).
    return 'UN';
};

const inferUnitLabelFromProduct = (product: any): 'KG' | 'UN' => {
    // Priority:
    // 1) explicit product.unit
    // 2) Detect based on name: if has NUMBER before weight unit → UN, else → KG
    // 3) packUnit if present
    // 4) default UN

    const unitRaw = String(product?.unit ?? '').trim();
    if (unitRaw) return normalizeUnitForLabel(unitRaw);

    const name = String(product?.name ?? '');
    const weight = String(product?.weight ?? '');
    const packageLabel = String(product?.packageLabel ?? '');
    const probe = `${name} ${weight} ${packageLabel}`.toUpperCase();

    // CRITICAL: Check if there's a NUMBER before the weight unit (KG, G, ML, L)
    // Pattern like "5KG", "500G", "2L" = sold by unit → use "UN"
    // Pattern like "KG", "G" without number = sold by kilo → use "KG"
    const hasNumberBeforeWeightUnit = /\d+\s*(?:KG|G|ML|L)\b/.test(probe);
    const hasWeightUnitWithoutNumber = /\b(?:KG|G|ML|L)\b/.test(probe) && !hasNumberBeforeWeightUnit;

    if (hasWeightUnitWithoutNumber) return 'KG'; // Vendido por quilo (ex: "ARROZ KG")
    if (hasNumberBeforeWeightUnit) return 'UN'; // Vendido por unidade (ex: "ARROZ 5KG")

    // Fallback to packUnit
    const packUnitRaw = String(product?.packUnit ?? '').trim();
    const packUnitNorm = packUnitRaw ? normalizeUnitForLabel(packUnitRaw) : '';
    if (packUnitNorm === 'KG') return 'KG';
    if (packUnitNorm === 'UN') return 'UN';

    return 'UN';
};

const computePackLine = (opts: { packageLabel?: any; packQuantity?: any; packUnit?: any; packPrice?: any }): string | null => {
    const label = String(opts.packageLabel ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const q = Number.parseInt(String(opts.packQuantity ?? '').replace(/[^\d]/g, ''), 10);
    const unit = String(opts.packUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const price = String(opts.packPrice ?? '').trim();
    if (!label || !Number.isFinite(q) || q <= 0 || !unit || !price) return null;
    return `${label} C/${q}${unit}: R$ ${price}`;
};

const setText = (obj: any, text: string) => {
    if (!obj || typeof obj.set !== 'function') return;
    obj.set('text', text);
    if (typeof obj.initDimensions === 'function') obj.initDimensions();
};

const setVisible = (obj: any, visible: boolean) => {
    if (!obj || typeof obj.set !== 'function') return;
    // `visible=false` can still affect group bounds in Fabric; scale-to-zero avoids giant selections.
    obj.set({ visible, scaleX: visible ? 1 : 0, scaleY: visible ? 1 : 0 });
};

const applyAtacarejoPricingToPriceGroup = (pg: any, data: any) => {
    if (!pg || typeof pg.getObjects !== 'function') return;
    const all = collectObjectsDeep(pg);

    const retailBg = findByName(all, 'atac_retail_bg');
    const bannerBg = findByName(all, 'atac_banner_bg');
    const wholesaleBg = findByName(all, 'atac_wholesale_bg');
    // Not an atacarejo template
    if (!retailBg) return;

    const retailCurrency = findByName(all, 'retail_currency_text');
    const retailInteger = findByName(all, 'retail_integer_text');
    const retailDecimal = findByName(all, 'retail_decimal_text');
    const retailUnit = findByName(all, 'retail_unit_text');
    const retailPack = findByName(all, 'retail_pack_line_text');

    const bannerText = findByName(all, 'wholesale_banner_text');

    const wholesaleCurrency = findByName(all, 'wholesale_currency_text');
    const wholesaleInteger = findByName(all, 'wholesale_integer_text');
    const wholesaleDecimal = findByName(all, 'wholesale_decimal_text');
    const wholesaleUnit = findByName(all, 'wholesale_unit_text');
    const wholesalePack = findByName(all, 'wholesale_pack_line_text');

    // ===== NOVO SISTEMA: Obter preços disponíveis dinamicamente =====
    const availablePrices = getAvailablePrices(data);
    const prices = availablePrices.prices;

    // DEBUG: Log para ver os preços disponíveis
    console.log('🔍 [applyAtacarejoPricing] Produto:', data?.name);
    console.log('🔍 [applyAtacarejoPricing] Preços disponíveis:', prices.map(p => ({ type: p.type, value: p.value, label: p.label })));
    console.log('🔍 [applyAtacarejoPricing] Dados brutos:', {
        priceUnit: data?.priceUnit,
        pricePack: data?.pricePack,
        priceSpecial: data?.priceSpecial,
        priceSpecialUnit: data?.priceSpecialUnit,
        priceWholesale: data?.priceWholesale,
        specialCondition: data?.specialCondition
    });

    // Determinar preço varejo (regular) e atacado (especial)
    let retailPrice = null;
    let wholesalePrice = null;
    let condition = null;

    // Buscar preço regular (varejo) e preço especial (atacado)
    // No atacarejo: special = preço menor (atacado), main/pack = preço maior (varejo)
    for (const p of prices) {
        if (p.type === 'main' || p.type === 'pack') {
            retailPrice = retailPrice || p.value;
        } else if (p.type === 'special') {
            wholesalePrice = wholesalePrice || p.value;
        }
    }

    // Se não encontrou, usar legado
    if (!retailPrice) {
        retailPrice = formatPriceValue(data?.priceUnit ?? data?.pricePack ?? data?.price);
    }
    if (!wholesalePrice) {
        wholesalePrice = formatPriceValue(data?.priceSpecialUnit ?? data?.priceSpecial ?? data?.priceWholesale);
    }
    condition = data?.specialCondition ?? null;

    console.log('🔍 [applyAtacarejoPricing] Resultado:', { retailPrice, wholesalePrice, condition, hasRetail: !!retailPrice, hasWholesale: !!wholesalePrice });

    // Se retail e wholesale são iguais, é produto simples — não mostrar duas faixas
    if (retailPrice && wholesalePrice && retailPrice === wholesalePrice && !condition) {
        wholesalePrice = null;
    }

    const hasRetail = !!retailPrice;
    const hasWholesale = !!wholesalePrice;

    // When only one tier exists, we hide the other and the banner.
    const showBanner = hasRetail && hasWholesale;
    setVisible(bannerBg, showBanner);
    setVisible(bannerText, showBanner);
    setVisible(wholesaleBg, hasWholesale);
    setVisible(wholesaleCurrency, hasWholesale);
    setVisible(wholesaleInteger, hasWholesale);
    setVisible(wholesaleDecimal, hasWholesale);
    setVisible(wholesaleUnit, hasWholesale);
    setVisible(wholesalePack, hasWholesale);
    setVisible(retailBg, hasRetail || !hasWholesale);
    setVisible(retailCurrency, hasRetail || !hasWholesale);
    setVisible(retailInteger, hasRetail || !hasWholesale);
    setVisible(retailDecimal, hasRetail || !hasWholesale);
    setVisible(retailUnit, hasRetail || !hasWholesale);
    setVisible(retailPack, hasRetail || !hasWholesale);

    if (retailCurrency && (!retailCurrency.text || String(retailCurrency.text).trim().length === 0)) setText(retailCurrency, 'R$');
    if (wholesaleCurrency && (!wholesaleCurrency.text || String(wholesaleCurrency.text).trim().length === 0)) setText(wholesaleCurrency, 'R$');

    if (hasRetail || !hasWholesale) {
        const parts = splitPriceParts(retailPrice);
        setText(retailInteger, parts.integer);
        setText(retailDecimal, `,${parts.dec}`);
    }

    if (hasWholesale) {
        const parts = splitPriceParts(wholesalePrice);
        setText(wholesaleInteger, parts.integer);
        setText(wholesaleDecimal, `,${parts.dec}`);
    }

    // Unit label: infer from product fields (never let a default "UN" override a clear "KG" in the name).
    const unitLabel = inferUnitLabelFromProduct(data);
    if (retailUnit) setText(retailUnit, unitLabel);
    if (wholesaleUnit) setText(wholesaleUnit, unitLabel);

    const packageLabel = String(data?.packageLabel ?? data?.wholesaleTriggerUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const packQuantity = Number.parseInt(String(data?.packQuantity ?? '').replace(/[^\d]/g, ''), 10);
    const packUnit = String(data?.packUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');

    const retailCents = parsePriceToCents(retailPrice);
    const wholesaleCents = parsePriceToCents(wholesalePrice);
    const retailPackPrice = (retailCents !== null && Number.isFinite(packQuantity) && packQuantity > 0)
        ? formatCentsToPrice(retailCents * packQuantity)
        : null;
    const wholesalePackPrice = (wholesaleCents !== null && Number.isFinite(packQuantity) && packQuantity > 0)
        ? formatCentsToPrice(wholesaleCents * packQuantity)
        : null;

    const retailPackLine = computePackLine({ packageLabel, packQuantity, packUnit, packPrice: retailPackPrice });
    const wholesalePackLine = computePackLine({ packageLabel, packQuantity, packUnit, packPrice: wholesalePackPrice });

    if (retailPack) {
        const txt = retailPackLine || '';
        setText(retailPack, txt);
        setVisible(retailPack, !!txt);
    }
    if (wholesalePack) {
        const txt = wholesalePackLine || '';
        setText(wholesalePack, txt);
        setVisible(wholesalePack, !!txt);
    }

    if (bannerText) {
        // Usar condição especial se disponível, senão usar lógica legada
        let bannerLabel = 'ATACADO';
        if (condition) {
            // Limpar e formatar a condição para caber no banner
            let cleanCondition = condition.toUpperCase().trim();
            // Remover pontuação final desnecessária
            cleanCondition = cleanCondition.replace(/[.;,]+$/, '').trim();
            // Se é "ACIMA DE X UN/FD/CX" — formato compacto para o banner
            const condMatch = cleanCondition.match(/(?:ACIMA\s+DE\s+|A\s+PARTIR\s+DE\s+|MIN\.?\s*)(\d+)\s*(.+)/i);
            if (condMatch) {
                const qty = condMatch[1];
                let unit = condMatch[2].trim().replace(/\.+$/, '');
                // Normalizar unidade para abreviatura
                const unitNorm: Record<string, string> = {
                    'UNIDADES': 'UN', 'UNIDADE': 'UN', 'UND': 'UN', 'UN': 'UN',
                    'FARDOS': 'FD', 'FARDO': 'FD', 'FD': 'FD',
                    'CAIXAS': 'CX', 'CAIXA': 'CX', 'CX': 'CX',
                    'PACOTES': 'PCT', 'PACOTE': 'PCT', 'PCT': 'PCT',
                };
                unit = unitNorm[unit.toUpperCase()] || unit;
                bannerLabel = `ACIMA ${qty} ${unit}`;
            } else {
                bannerLabel = cleanCondition;
            }
        } else {
            const trig = data?.wholesaleTrigger;
            const trigN = typeof trig === 'number' ? trig : Number.parseInt(String(trig ?? '').replace(/[^\d]/g, ''), 10);
            const unitTok = String(data?.wholesaleTriggerUnit ?? packageLabel ?? '').trim().toUpperCase().replace(/\s+/g, '');
            if (Number.isFinite(trigN) && trigN > 0 && unitTok) {
                bannerLabel = `ACIMA ${trigN} ${unitTok}`;
            }
        }
        setText(bannerText, `\u2605 ${bannerLabel} \u2605`);
    }

    safeAddWithUpdate(pg);
};

const layoutAtacarejoPriceGroup = (priceGroup: any, cardW: number, cardH: number) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null;
    const all = collectObjectsDeep(priceGroup);

    const retailBg = findByName(all, 'atac_retail_bg');
    if (!retailBg) return null;

    const bannerBg = findByName(all, 'atac_banner_bg');
    const wholesaleBg = findByName(all, 'atac_wholesale_bg');

    const retailCurrency = findByName(all, 'retail_currency_text');
    const retailInteger = findByName(all, 'retail_integer_text');
    const retailDecimal = findByName(all, 'retail_decimal_text');
    const retailUnit = findByName(all, 'retail_unit_text');
    const retailPack = findByName(all, 'retail_pack_line_text');

    const bannerText = findByName(all, 'wholesale_banner_text');

    const wholesaleCurrency = findByName(all, 'wholesale_currency_text');
    const wholesaleInteger = findByName(all, 'wholesale_integer_text');
    const wholesaleDecimal = findByName(all, 'wholesale_decimal_text');
    const wholesaleUnit = findByName(all, 'wholesale_unit_text');
    const wholesalePack = findByName(all, 'wholesale_pack_line_text');

    const isShown = (o: any) => !!(o && o.visible !== false && (o.scaleX ?? 1) !== 0 && (o.scaleY ?? 1) !== 0);
    const showRetail = isShown(retailBg);
    const showWholesale = isShown(wholesaleBg);
    const showBanner = isShown(bannerBg) && isShown(bannerText);

    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

    // Keep width content-driven (prevents "stretch wide" tags when cards are wide).
    // We'll compute it after we size texts.
    let totalW = clamp(cardW * 0.9, 160, cardW);
    const ratio = (showRetail && showWholesale) ? 0.30 : 0.22;
    const totalH = clamp(cardH * ratio, 70, Math.max(70, cardH * 0.45));
    const padX = clamp(cardW * 0.04, 10, 28);

    // Section heights
    let retailH = 0;
    let bannerH = 0;
    let wholesaleH = 0;
    if (showRetail && showWholesale) {
        bannerH = totalH * 0.14;
        retailH = totalH * 0.43;
        wholesaleH = totalH - retailH - bannerH;
    } else if (showWholesale && !showRetail) {
        wholesaleH = totalH;
    } else {
        retailH = totalH;
    }

    const y0 = -totalH / 2;
    const retailCY = showRetail ? (y0 + retailH / 2) : 0;
    const bannerCY = (showRetail && showWholesale && showBanner) ? (y0 + retailH + bannerH / 2) : 0;
    const wholesaleCY = showWholesale ? (y0 + retailH + bannerH + wholesaleH / 2) : 0;

    const setBg = (bg: any, h: number, cy: number, rx: number) => {
        if (!bg || typeof bg.set !== 'function') return;
        bg.set({
            width: totalW,
            height: h,
            rx,
            ry: rx,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: cy
        });
    };

    const setTextSizing = (txt: any, defaultScale: number, baseH: number) => {
        if (!txt || !String(txt.type || '').includes('text')) return;
        const scale = typeof txt.__fontScale === 'number' ? txt.__fontScale : defaultScale;
        txt.set({ fontSize: baseH * scale, scaleX: 1, scaleY: 1 });
        if (typeof txt.initDimensions === 'function') txt.initDimensions();
    };
    const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0);

    const measureTierWidth = (tier: {
        blockH: number;
        currency: any;
        integer: any;
        decimal: any;
        unit: any;
        pack: any;
    }) => {
        const { blockH, currency, integer, decimal, unit, pack } = tier;
        if (!blockH || !Number.isFinite(blockH)) return 0;

        const gapX = Math.max(4, blockH * 0.06);
        setTextSizing(integer, 0.60, blockH);
        setTextSizing(decimal, 0.36, blockH);
        setTextSizing(currency, 0.22, blockH);
        setTextSizing(unit, 0.22, blockH);
        setTextSizing(pack, 0.18, blockH);

        const packVisible = isShown(pack) && String(pack?.text || '').trim().length > 0;
        const unitVisible = isShown(unit) && String(unit?.text || '').trim().length > 0;

        let w = getW(currency) + gapX + getW(integer) + getW(decimal);
        if (unitVisible) w += gapX + getW(unit);
        if (packVisible) w = Math.max(w, getW(pack));
        return w;
    };

    // Pass 1: compute minimal required width based on text content.
    let contentW = 0;
    if (showRetail) contentW = Math.max(contentW, measureTierWidth({ blockH: retailH, currency: retailCurrency, integer: retailInteger, decimal: retailDecimal, unit: retailUnit, pack: retailPack }));
    if (showWholesale) contentW = Math.max(contentW, measureTierWidth({ blockH: wholesaleH, currency: wholesaleCurrency, integer: wholesaleInteger, decimal: wholesaleDecimal, unit: wholesaleUnit, pack: wholesalePack }));
    if (showBanner && bannerText) {
        setTextSizing(bannerText, 0.32, bannerH);
        contentW = Math.max(contentW, getW(bannerText));
    }
    totalW = clamp(contentW + (padX * 2), 160, cardW);

    // Apply final width to backgrounds.
    if (showRetail) setBg(retailBg, retailH, retailCY, Math.max(6, Math.min(18, totalH * 0.08)));
    if (showBanner && bannerBg) setBg(bannerBg, bannerH, bannerCY, Math.max(4, Math.min(12, totalH * 0.05)));
    if (showWholesale) setBg(wholesaleBg, wholesaleH, wholesaleCY, Math.max(6, Math.min(18, totalH * 0.08)));

    const layoutTier = (tier: {
        blockH: number;
        blockCY: number;
        currency: any;
        integer: any;
        decimal: any;
        unit: any;
        pack: any;
    }) => {
        const { blockH, blockCY, currency, integer, decimal, unit, pack } = tier;
        if (!blockH || !Number.isFinite(blockH)) return;

        const maxPriceW = totalW - (padX * 2);
        const gapX = Math.max(4, blockH * 0.06);

        setTextSizing(integer, 0.60, blockH);
        setTextSizing(decimal, 0.36, blockH);
        setTextSizing(currency, 0.22, blockH);
        setTextSizing(unit, 0.22, blockH);
        setTextSizing(pack, 0.18, blockH);

        const packVisible = isShown(pack) && String(pack?.text || '').trim().length > 0;
        const unitVisible = isShown(unit) && String(unit?.text || '').trim().length > 0;

        // Center the full "R$ + price" horizontally.
        let priceW = getW(currency) + gapX + getW(integer) + getW(decimal);
        if (priceW > maxPriceW && priceW > 0) {
            const s = maxPriceW / priceW;
            [currency, integer, decimal].forEach((t: any) => t?.set?.({ scaleX: s, scaleY: s }));
            priceW = getW(currency) + gapX + getW(integer) + getW(decimal);
        }

        const startX = -priceW / 2;
        const priceShiftY = packVisible ? (blockH * 0.10) : 0;
        const intY = blockCY - priceShiftY;
        const decY = intY - (blockH * 0.22);
        const curY = intY - (blockH * 0.18);

        const curW = getW(currency);
        currency?.set?.({ originX: 'left', originY: 'center', left: startX, top: curY });

        const intX = startX + curW + gapX;
        integer?.set?.({ originX: 'left', originY: 'center', left: intX, top: intY });

        const intW = getW(integer);
        decimal?.set?.({ originX: 'left', originY: 'center', left: intX + intW, top: decY });

        if (unit && unitVisible) {
            unit.set({ originX: 'left', originY: 'center', left: intX + intW + getW(decimal) + gapX, top: intY + (blockH * 0.22) });
        }

        if (pack && packVisible) {
            // Fit pack line within block width if needed.
            const pw = getW(pack);
            const maxPackW = totalW - (padX * 2);
            if (pw > maxPackW && pw > 0) {
                const s = maxPackW / pw;
                pack.set({ scaleX: s, scaleY: s });
            } else {
                pack.set({ scaleX: 1, scaleY: 1 });
            }
            pack.set({ originX: 'center', originY: 'center', left: 0, top: blockCY + (blockH * 0.33) });
        }
    };

    if (showRetail) layoutTier({ blockH: retailH, blockCY: retailCY, currency: retailCurrency, integer: retailInteger, decimal: retailDecimal, unit: retailUnit, pack: retailPack });
    if (showWholesale) layoutTier({ blockH: wholesaleH, blockCY: wholesaleCY, currency: wholesaleCurrency, integer: wholesaleInteger, decimal: wholesaleDecimal, unit: wholesaleUnit, pack: wholesalePack });

    if (showBanner && bannerText) {
        setTextSizing(bannerText, 0.32, bannerH);
        bannerText.set({ originX: 'center', originY: 'center', left: 0, top: bannerCY });
    }

    safeAddWithUpdate(priceGroup);
    return { pillW: totalW, pillH: totalH };
};


/**
 * Layout function for custom user-created templates.
 * Preserves the original proportions and scales everything proportionally.
 */
function layoutCustomPriceGroup(priceGroup: any, cardW: number, cardH: number) {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null;

    const all = priceGroup.getObjects();
    const priceBg = all.find((o: any) => o.name === 'price_bg');
    const priceBgImage = all.find((o: any) => o.name === 'price_bg_image' || o.name === 'splash_image');

    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

    // Get original template dimensions from priceBg metadata
    const originalW = typeof (priceBg as any)?.__originalWidth === 'number'
        ? (priceBg as any).__originalWidth
        : (priceBg?.width || 200);
    const originalH = typeof (priceBg as any)?.__originalHeight === 'number'
        ? (priceBg as any).__originalHeight
        : (priceBg?.height || 46);

    // Calculate target size based on card dimensions
    const maxPillW = cardW * 0.96;
    const maxPillH = cardH * 0.28;
    const minPillH = Math.max(36, cardH * 0.12);

    // Calculate scale factors to fit within bounds
    const scaleByWidth = maxPillW / originalW;
    const scaleByHeight = maxPillH / originalH;
    let scale = Math.min(scaleByWidth, scaleByHeight);

    // Ensure minimum height
    const scaledH = originalH * scale;
    if (scaledH < minPillH) {
        scale = minPillH / originalH;
    }

    // Clamp scale to reasonable limits
    scale = clamp(scale, 0.3, 3);

    // Apply scale to priceBg
    const newW = originalW * scale;
    const newH = originalH * scale;

    // Get roundness from metadata or default to 1 (fully rounded)
    const roundness = clamp(
        typeof (priceBg as any)?.__roundness === 'number' ? (priceBg as any).__roundness : 1,
        0,
        1
    );
    const radius = (newH / 2) * roundness;

    priceBg.set({
        width: newW,
        height: newH,
        rx: radius,
        ry: radius,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Scale stroke proportionally
    const originalStrokeW = typeof (priceBg as any)?.__strokeWidth === 'number'
        ? (priceBg as any).__strokeWidth
        : null;
    if (originalStrokeW !== null) {
        priceBg.set({ strokeWidth: originalStrokeW * scale });
    }

    // Scale shadow blur proportionally
    if (fabric?.Shadow && priceBg.shadow) {
        const originalBlur = typeof (priceBg as any)?.__shadowBlur === 'number'
            ? (priceBg as any).____shadowBlur
            : 15;
        const shadow = priceBg.shadow;
        shadow.blur = Math.max(2, originalBlur * scale);
    }

    // Handle background image
    if (priceBgImage && priceBgImage.type === 'image') {
        const img: any = priceBgImage;
        img.set({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        });

        const el: any = img._originalElement || img._element;
        const iw = el?.naturalWidth || el?.width || img.width || 0;
        const ih = el?.naturalHeight || el?.height || img.height || 0;

        if (iw > 0 && ih > 0) {
            img.set({ cropX: 0, cropY: 0, width: iw, height: ih });
            const imgScale = Math.max(newW / iw, newH / ih);
            if (Number.isFinite(imgScale) && imgScale > 0) {
                const cropW = Math.min(iw, newW / imgScale);
                const cropH = Math.min(ih, newH / imgScale);
                const cropX = Math.max(0, (iw - cropW) / 2);
                const cropY = Math.max(0, (ih - cropH) / 2);
                img.set({ cropX, cropY, width: cropW, height: cropH, scaleX: imgScale, scaleY: imgScale });
            }
        }

        // Clip to pill shape
        if (fabric?.Rect) {
            const clip = new fabric.Rect({
                width: newW,
                height: newH,
                rx: radius,
                ry: radius,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0
            });
            img.set({ clipPath: clip });
        }

        if (typeof priceBg.fill === 'string' && priceBg.fill !== 'transparent') {
            priceBg.set('fill', 'transparent');
        }
        if (typeof img.sendToBack === 'function') img.sendToBack();
    }

    // Identify price-related text elements for dynamic positioning
    const priceInteger = all.find((o: any) => o.name === 'price_integer_text' || o.name === 'priceInteger' || o.name === 'price_integer');
    const priceDecimal = all.find((o: any) => o.name === 'price_decimal_text' || o.name === 'priceDecimal' || o.name === 'price_decimal');
    const priceUnit = all.find((o: any) => o.name === 'price_unit_text' || o.name === 'priceUnit' || o.name === 'price_unit');
    const currencyText = all.find((o: any) => o.name === 'price_currency_text');
    const currencyCircle = all.find((o: any) => o.name === 'price_currency_bg' || o.name === 'priceSymbolBg');
    const priceText = all.find((o: any) => o.name === 'price_value_text' || o.name === 'smart_price');

    // Check if we have split price elements (integer + decimal)
    const hasSplitPrice = !!(priceInteger && priceDecimal);
    const hasPriceStructure = hasSplitPrice || priceText;

    // First pass: scale all text elements
    all.forEach((obj: any) => {
        if (!obj || obj.type !== 'text') return;

        // Get original font size from metadata or current value
        const originalFontSize = typeof obj.__originalFontSize === 'number'
            ? obj.__originalFontSize
            : (obj.fontSize || 14);

        // Get original fontFamily from metadata or current value
        const originalFontFamily = typeof obj.__originalFontFamily === 'string'
            ? obj.__originalFontFamily
            : obj.fontFamily;

        // Apply scaled font size and preserve fontFamily
        // Position will be set later for price elements
        obj.set({
            fontFamily: originalFontFamily || undefined,
            fontSize: originalFontSize * scale,
            scaleX: 1,
            scaleY: 1,
            strokeWidth: (obj.strokeWidth || 0) * scale
        });

        if (typeof obj.initDimensions === 'function') obj.initDimensions();
    });

    // Second pass: set non-price text positions proportionally
    all.forEach((obj: any) => {
        if (!obj || obj.type !== 'text') return;
        // Skip price elements - they will be positioned dynamically
        if (hasPriceStructure && (
            obj === priceInteger || obj === priceDecimal || obj === priceUnit ||
            obj === priceText || obj === currencyText
        )) {
            return;
        }

        const originalLeft = typeof obj.__originalLeft === 'number' ? obj.__originalLeft : obj.left;
        const originalTop = typeof obj.__originalTop === 'number' ? obj.__originalTop : obj.top;
        const originalOriginX = obj.__originalOriginX || obj.originX || 'center';
        const originalOriginY = obj.__originalOriginY || obj.originY || 'center';

        obj.set({
            left: (typeof originalLeft === 'number' ? originalLeft * scale : originalLeft),
            top: (typeof originalTop === 'number' ? originalTop * scale : originalTop),
            originX: originalOriginX,
            originY: originalOriginY
        });
    });

    // Dynamic positioning for price elements (same logic as layoutPriceGroup)
    if (hasPriceStructure) {
        const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0);

        // Calculate starting X position for price text
        let textStartX = -(newW / 2) + (newH * 0.35 * 0.85); // Similar to circleCenterX + circleSize/2

        // If we have a currency circle, adjust textStartX
        if (currencyCircle) {
            const circleSize = newH * 0.72;
            const circleCenterX = -(newW / 2) + (circleSize * 0.35);
            textStartX = circleCenterX + (circleSize / 2) + (newH * 0.18);
        } else if (currencyText) {
            // Use currency text width to determine start position
            const currencyW = getW(currencyText);
            textStartX = -(newW / 2) + currencyW + (newH * 0.1);
        }

        if (hasSplitPrice) {
            // Position integer and decimal dynamically
            const intY = (typeof priceInteger.__yOffsetRatio === 'number' ? priceInteger.__yOffsetRatio : 0) * newH;
            const decY = (typeof priceDecimal.__yOffsetRatio === 'number' ? priceDecimal.__yOffsetRatio : -0.18) * newH;

            const intW = getW(priceInteger);
            priceInteger.set({ originX: 'left', originY: 'center', left: textStartX, top: intY });

            priceDecimal.set({ originX: 'left', originY: 'center', left: textStartX + intW, top: decY });

            // Position unit dynamically if exists
            if (priceUnit) {
                const unitText = String(priceUnit.text || '').trim();
                const unitVisible = priceUnit.visible !== false && unitText.length > 0;
                priceUnit.set({ visible: unitVisible });
                if (unitVisible) {
                    const unitY = (typeof priceUnit.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.22) * newH;
                    const decW = getW(priceDecimal);
                    const unitRightX = textStartX + intW + decW;
                    priceUnit.set({ originX: 'right', originY: 'center', left: unitRightX, top: unitY });

                    // Shrink unit if it's wider than the cents block
                    const unitW = getW(priceUnit);
                    if (decW > 0 && unitW > decW) {
                        const s = decW / unitW;
                        priceUnit.set({ scaleX: s, scaleY: s });
                    }
                }
            }
        } else if (priceText) {
            // Single price text
            const priceY = (typeof priceText.__yOffsetRatio === 'number' ? priceText.__yOffsetRatio : 0) * newH;
            priceText.set({ originX: 'left', originY: 'center', left: textStartX, top: priceY });
        }
    }

    // Scale all other objects (circles, rects, etc.)
    all.forEach((obj: any) => {
        if (!obj || obj.type === 'text') return;
        if (obj.name === 'price_bg' || obj.name === 'price_bg_image' || obj.name === 'splash_image') return;

        // Get original dimensions
        const originalLeft = typeof obj.__originalLeft === 'number' ? obj.__originalLeft : obj.left;
        const originalTop = typeof obj.__originalTop === 'number' ? obj.__originalTop : obj.top;
        const originalScaleX = typeof obj.__originalScaleX === 'number' ? obj.__originalScaleX : 1;
        const originalScaleY = typeof obj.__originalScaleY === 'number' ? obj.__originalScaleY : 1;

        obj.set({
            left: (typeof originalLeft === 'number' ? originalLeft * scale : originalLeft),
            top: (typeof originalTop === 'number' ? originalTop * scale : originalTop),
            scaleX: originalScaleX * scale,
            scaleY: originalScaleY * scale
        });

        // For circles, also scale radius
        if (obj.type === 'circle' && typeof obj.__originalRadius === 'number') {
            obj.set({ radius: obj.__originalRadius * scale });
        }
        // For rects, also scale width/height if they have original values stored
        if (obj.type === 'rect') {
            if (typeof obj.__originalWidth === 'number') {
                obj.set({ width: obj.__originalWidth * scale });
            }
            if (typeof obj.__originalHeight === 'number') {
                obj.set({ height: obj.__originalHeight * scale });
            }
            if (typeof obj.__originalRx === 'number') {
                obj.set({ rx: obj.__originalRx * scale });
            }
            if (typeof obj.__originalRy === 'number') {
                obj.set({ ry: obj.__originalRy * scale });
            }
        }
    });

    safeAddWithUpdate(priceGroup);
    return { pillW: newW, pillH: newH };
}


function layoutPriceGroup(priceGroup: any, cardW: number, cardH: number) {
    console.log('🔍 [layoutPriceGroup] CALLED', { hasPriceGroup: !!priceGroup, hasGetObjects: !!priceGroup?.getObjects, cardW, cardH });
    if (!priceGroup || !priceGroup.getObjects) {
        console.log('🔍 [layoutPriceGroup] Returning null - no priceGroup or getObjects');
        return null;
    }

    // Atacarejo template (2-tier label)
    try {
        const deep = collectObjectsDeep(priceGroup);
        const hasAtacarejo = findByName(deep, 'atac_retail_bg');
        console.log('🔍 [layoutPriceGroup] Atacarejo check:', hasAtacarejo);
        if (hasAtacarejo) {
            return layoutAtacarejoPriceGroup(priceGroup, cardW, cardH);
        }
    } catch (e) {
        console.log('🔍 [layoutPriceGroup] Atacarejo check error:', e);
        // fall through to legacy layout
    }

    const all = priceGroup.getObjects();
    console.log('🔍 [layoutPriceGroup] Objects in priceGroup:', all.length, all.map((o: any) => o?.name || 'unnamed'));

    const priceBg = all.find((o: any) => o.name === 'price_bg');
    const priceBgImage = all.find((o: any) => o.name === 'price_bg_image' || o.name === 'splash_image');
    const currencyCircle = all.find((o: any) => o.name === 'price_currency_bg' || o.name === 'priceSymbolBg');
    const currencyTextPrimary = all.find((o: any) => o.name === 'price_currency_text');
    const currencyTextLegacy = all.find((o: any) => o.name === 'priceSymbol' || o.name === 'price_currency');
    const currencyText = currencyTextPrimary || currencyTextLegacy;
    const priceText = all.find((o: any) => o.name === 'price_value_text' || o.name === 'smart_price');
    const priceInteger = all.find((o: any) => o.name === 'price_integer_text' || o.name === 'priceInteger' || o.name === 'price_integer');
    const priceDecimal = all.find((o: any) => o.name === 'price_decimal_text' || o.name === 'priceDecimal' || o.name === 'price_decimal');
    const priceUnit = all.find((o: any) => o.name === 'price_unit_text' || o.name === 'priceUnit' || o.name === 'price_unit');

    // Check if this has the standard template structure (price_bg + currencyCircle + currencyText + price texts)
    const hasStandardStructure = !!(priceBg && currencyCircle && currencyText &&
                                   (priceText || (priceInteger && priceDecimal)));

    // Check if this is a custom template:
    // - Explicitly marked as custom, OR
    // - Does NOT have standard structure BUT has __originalWidth metadata
    const isCustomTemplate = (priceGroup as any).__isCustomTemplate === true ||
                            (!hasStandardStructure && priceBg && typeof (priceBg as any).__originalWidth === 'number');

    // For custom templates, use proportional scaling to preserve original design
    if (isCustomTemplate && priceBg) {
        console.log('🔍 [layoutPriceGroup] Using custom template layout (standard structure:', hasStandardStructure, ')');
        return layoutCustomPriceGroup(priceGroup, cardW, cardH);
    }

    console.log('🔍 [layoutPriceGroup] Found elements:', { priceBg: !!priceBg, currencyCircle: !!currencyCircle, currencyText: !!currencyText, priceText: !!priceText, priceInteger: !!priceInteger, priceDecimal: !!priceDecimal });
    
    if (!priceBg || !currencyCircle || !currencyText) {
        console.log('🔍 [layoutPriceGroup] Returning null - missing required elements');
        return null;
    }
    
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

    // Scale label by overall card size (avoid "stretch wide" when cards are wide).
    const base = Math.min(cardW, cardH);
    const pillH = clamp(base * 0.18, 46, Math.max(46, cardH * 0.24));
    const circleSize = pillH * 0.72; // Slightly smaller "R$" area
    const textGap = pillH * 0.18;
    const rightPad = pillH * 0.35;

    // If we have split parts, use them; otherwise fall back to `smart_price`.
    const hasSplit = !!(priceInteger && priceDecimal);
    const anyText = (hasSplit ? priceInteger : priceText);
    if (!anyText) return null;

    // Remove legacy duplicates that would inflate the group bounds (common after template edits).
    const recognized = new Set<any>([
        priceBg,
        priceBgImage,
        currencyCircle,
        currencyText,
        priceText,
        priceInteger,
        priceDecimal,
        priceUnit
    ]);
    const cleanupNames = new Set([
        'priceSymbol',
        'price_currency',
        'price_currency_text',
        'priceInteger',
        'priceDecimal',
        'priceUnit',
        'smart_price',
        'price_value_text'
    ]);
    all.forEach((o: any) => {
        if (!o || recognized.has(o)) return;
        if (!cleanupNames.has(String(o.name || ''))) return;
        // Drop duplicates from instances (keep templates clean via mini editor).
        if (typeof priceGroup.remove === 'function') priceGroup.remove(o);
    });

    const setTextSizing = (txt: any, defaultScale: number) => {
        if (!txt || !txt.type || !String(txt.type).includes('text')) return;
        const scale = typeof txt.__fontScale === 'number' ? txt.__fontScale : defaultScale;
        txt.set({ fontSize: pillH * scale, scaleX: 1, scaleY: 1 });
        if (typeof txt.initDimensions === 'function') txt.initDimensions();
    };

    if (hasSplit) {
        setTextSizing(priceInteger, 0.72);
        setTextSizing(priceDecimal, 0.42);
        setTextSizing(priceUnit, 0.26);
    } else {
        setTextSizing(priceText, 0.7);
    }

    // Normalize the unit label so we never show gramatura (e.g. "500ML") in the tag.
    if (priceUnit && priceUnit.visible !== false) {
        const cur = String(priceUnit.text || '').trim();
        if (cur) {
            const normalized = normalizeUnitForLabel(cur);
            if (normalized !== cur.toUpperCase().replace(/\s+/g, '')) {
                priceUnit.set?.('text', normalized);
                if (typeof priceUnit.initDimensions === 'function') priceUnit.initDimensions();
            }
        }
    }

    const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0);
    const calcTextWidth = () =>
        hasSplit
            ? (getW(priceInteger) + getW(priceDecimal))
            : getW(priceText);

    let textWidth = calcTextWidth();
    const maxPillW = cardW * 0.96;
    const minPillW = textWidth + (circleSize * 0.85) + textGap + rightPad;
    const minVisualW = Math.max(120, pillH * 2.6);
    let pillW = clamp(minPillW, minVisualW, maxPillW);
    
    if (minPillW > maxPillW && textWidth > 0) {
        const availableTextWidth = maxPillW - (circleSize * 0.85) - textGap - rightPad;
        if (availableTextWidth > 0) {
            const scale = availableTextWidth / textWidth;
            if (hasSplit) {
                if (priceInteger) priceInteger.set({ scaleX: scale, scaleY: scale });
                if (priceDecimal) priceDecimal.set({ scaleX: scale, scaleY: scale });
                if (priceUnit) priceUnit.set({ scaleX: scale, scaleY: scale });
            } else if (priceText) {
                priceText.set({ scaleX: scale, scaleY: scale });
            }
            textWidth = calcTextWidth();
        }
        pillW = maxPillW;
    }
    
    const roundness = clamp(
        typeof (priceBg as any).__roundness === 'number' ? (priceBg as any).__roundness : 1,
        0,
        1
    );
    const radius = (pillH / 2) * roundness;

    priceBg.set({
        width: pillW,
        height: pillH,
        rx: radius,
        ry: radius,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Keep the "neon" border/glow proportional to the pill size (prevents losing the pattern on resize).
    const customStrokeW = Number((priceBg as any).__strokeWidth);
    const strokeW = Number.isFinite(customStrokeW) ? clamp(customStrokeW, 0, Math.max(0, pillH * 0.2)) : Math.max(1, Math.min(4, pillH * 0.04));
    const accentColor = typeof priceBg.stroke === 'string' ? priceBg.stroke : '#ff0000';
    priceBg.set({ strokeWidth: strokeW });
    if (fabric?.Shadow) {
        const blur = Math.max(6, Math.min(26, pillH * 0.22));
        priceBg.set('shadow', new fabric.Shadow({ color: accentColor, blur, offsetX: 0, offsetY: 0 }));
    }

    // Optional: image as splash background (inside the pill)
    if (priceBgImage && priceBgImage.type === 'image') {
        const img: any = priceBgImage;
        img.set({
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0
        });
        // Use natural dimensions when available to avoid massive bounds.
        // Also: crop the image so its *actual bounds* match the pill (clipPath does not affect selection bounds).
        const el: any = img._originalElement || img._element;
        const iw = el?.naturalWidth || el?.width || img.width || 0;
        const ih = el?.naturalHeight || el?.height || img.height || 0;
        if (iw > 0 && ih > 0) {
            // Reset any previous crop so we can compute from the full image.
            img.set({ cropX: 0, cropY: 0, width: iw, height: ih });

            // Cover (no empty areas)
            let scale = Math.max(pillW / iw, pillH / ih);
            if (!Number.isFinite(scale) || scale <= 0) scale = 1;
            // Clamp (safety)
            scale = Math.min(scale, 20);

            // Crop window in source pixels so that, after scaling, bounds == pillW x pillH.
            const cropW = Math.min(iw, pillW / scale);
            const cropH = Math.min(ih, pillH / scale);
            const cropX = Math.max(0, (iw - cropW) / 2);
            const cropY = Math.max(0, (ih - cropH) / 2);

            img.set({ cropX, cropY, width: cropW, height: cropH, scaleX: scale, scaleY: scale });
        } else {
            // If the image hasn't reported dimensions yet, force its bounds to the pill.
            // This prevents a giant selection box until the real image dimensions are available.
            img.set({ cropX: 0, cropY: 0, width: pillW, height: pillH, scaleX: 1, scaleY: 1 });
        }
        // Clip to pill shape
        if (fabric?.Rect) {
            const clip = new fabric.Rect({
                width: pillW,
                height: pillH,
                rx: radius,
                ry: radius,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: 0
            });
            img.set({ clipPath: clip });
        }
        // Ensure the rect doesn't hide the image (rect can still keep stroke/glow)
        if (typeof priceBg.fill === 'string' && priceBg.fill !== 'transparent') {
            priceBg.set('fill', 'transparent');
        }
        if (typeof (img as any).sendToBack === 'function') (img as any).sendToBack();
    }
    
    const circleCenterX = -(pillW / 2) + (circleSize * 0.35);
    currencyCircle.set({
        radius: circleSize / 2,
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0
    });
    
    currencyText.set({
        fontSize: circleSize * 0.32,
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0,
        scaleX: 1,
        scaleY: 1
    });

    const textStartX = circleCenterX + (circleSize / 2) + textGap;
    if (hasSplit) {
        const intY = (typeof priceInteger.__yOffsetRatio === 'number' ? priceInteger.__yOffsetRatio : 0) * pillH;
        const decY = (typeof priceDecimal.__yOffsetRatio === 'number' ? priceDecimal.__yOffsetRatio : -0.18) * pillH;

        const intW = getW(priceInteger);
        priceInteger.set({ originX: 'left', originY: 'center', left: textStartX, top: intY });

        priceDecimal.set({ originX: 'left', originY: 'center', left: textStartX + intW, top: decY });

        if (priceUnit) {
            const unitText = String(priceUnit.text || '').trim();
            const unitVisible = priceUnit.visible !== false && unitText.length > 0;
            priceUnit.set({ visible: unitVisible });
            if (unitVisible) {
                const unitY = (typeof priceUnit.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.22) * pillH;
                const decW = getW(priceDecimal);

                // Place unit UNDER the cents (centavos), aligned to the right edge of the decimal block.
                const unitRightX = textStartX + intW + decW;
                priceUnit.set({ originX: 'right', originY: 'center', left: unitRightX, top: unitY });

                // If unit becomes wider than the cents block, shrink it to fit under the cents.
                const unitW = getW(priceUnit);
                if (decW > 0 && unitW > decW) {
                    const s = decW / unitW;
                    priceUnit.set({ scaleX: s, scaleY: s });
                } else {
                    priceUnit.set({ scaleX: 1, scaleY: 1 });
                }
            }
        }
    } else if (priceText) {
        const scaledTextWidth = priceText.getScaledWidth();
        const textCenterX = textStartX + (scaledTextWidth / 2);
        priceText.set({ originX: 'center', originY: 'center', left: textCenterX, top: 0 });
    }

    safeAddWithUpdate(priceGroup);
    return { pillW, pillH };
}

function getPriceGroupFromAny(obj: any): any | null {
    if (!obj) return null;

    // Direct selection (group)
    if (obj.type === 'group' && obj.name === 'priceGroup') return obj;

    // If user selected a child inside the price group, walk up the group chain.
    let cur: any = obj;
    while (cur && cur.group) {
        if (cur.group.type === 'group' && cur.group.name === 'priceGroup') return cur.group;
        cur = cur.group;
    }

    // If a full card (or any group) is selected, grab its internal price group (deep).
    if (obj.type === 'group' && typeof obj.getObjects === 'function') {
        const queue: any[] = [...(obj.getObjects() || [])];
        while (queue.length) {
            const cur = queue.shift();
            if (!cur) continue;
            if (cur.type === 'group' && cur.name === 'priceGroup') return cur;
            if (cur.type === 'group' && typeof cur.getObjects === 'function') {
                const kids = cur.getObjects() || [];
                for (const k of kids) queue.push(k);
            }
        }
    }

    return null;
}

function getCardGroupFromAny(obj: any): any | null {
    if (!obj) return null;
    if (obj.type === 'group' && (obj.isSmartObject || obj.isProductCard)) return obj;
    let cur: any = obj;
    while (cur && cur.group) {
        if (cur.group.type === 'group' && (cur.group.isSmartObject || cur.group.isProductCard)) return cur.group;
        cur = cur.group;
    }
    return null;
}

const enlivenObjectsAsync = (objectsJson: any[]) => {
    if (!fabric?.util?.enlivenObjects) return Promise.resolve([]);
    const fn = fabric.util.enlivenObjects;
    try {
        const maybe = fn(objectsJson);
        if (maybe && typeof maybe.then === 'function') return maybe;
    } catch (_) {
        // fall back to callback form below
    }
    return new Promise<any[]>((resolve, reject) => {
        try {
            fn(objectsJson, (enlivened: any[]) => resolve(enlivened));
        } catch (err) {
            reject(err);
        }
    });
};

async function instantiatePriceGroupFromTemplate(tpl: LabelTemplate): Promise<any> {
    const groupJson: any = tpl?.group;
    if (!fabric || !groupJson) throw new Error('Template missing group JSON');
    const objectsJson = Array.isArray(groupJson.objects) ? groupJson.objects : [];
    const opts = { ...groupJson };
    delete (opts as any).objects;
    // Fabric objects have a fixed `type` based on the class; restoring `type` from JSON is ignored and warns.
    delete (opts as any).type;
    // Never restore layoutManager from plain JSON (Fabric v7 expects class instance).
    delete (opts as any).layoutManager;
    delete (opts as any).layout;
    const enlivened = await enlivenObjectsAsync(objectsJson);
    const g = new fabric.Group(enlivened, opts);
    // Ensure templates always start from a normalized transform.
    g.set({ name: 'priceGroup', originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0 });
    return g;
}

function normalizePriceGroupForPreview(pg: any) {
    if (!pg || typeof pg.getObjects !== 'function') return;
    pg.set({ originX: 'center', originY: 'center', left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0 });

    const all: any[] = pg.getObjects();

    // ===== ATACAREJO TEMPLATE SUPPORT =====
    // Check if this is an atacarejo (2-price) template by looking for the retail background
    const retailBg = all.find(o => o?.name === 'atac_retail_bg');
    const isAtacarejo = !!retailBg;

    if (isAtacarejo) {
        // This is an atacarejo template - normalize all atacarejo elements for preview
        const bannerBg = all.find(o => o?.name === 'atac_banner_bg');
        const wholesaleBg = all.find(o => o?.name === 'atac_wholesale_bg');

        const retailCurrency = all.find(o => o?.name === 'retail_currency_text');
        const retailInteger = all.find(o => o?.name === 'retail_integer_text');
        const retailDecimal = all.find(o => o?.name === 'retail_decimal_text');
        const retailUnit = all.find(o => o?.name === 'retail_unit_text');
        const retailPack = all.find(o => o?.name === 'retail_pack_line_text');

        const bannerText = all.find(o => o?.name === 'wholesale_banner_text');

        const wholesaleCurrency = all.find(o => o?.name === 'wholesale_currency_text');
        const wholesaleInteger = all.find(o => o?.name === 'wholesale_integer_text');
        const wholesaleDecimal = all.find(o => o?.name === 'wholesale_decimal_text');
        const wholesaleUnit = all.find(o => o?.name === 'wholesale_unit_text');
        const wholesalePack = all.find(o => o?.name === 'wholesale_pack_line_text');

        // Use a standard preview size that matches the preview thumbnail
        const previewW = 320;
        const previewH = 220;
        const totalH = previewH * 0.8;  // Total height for the price tag

        // Section heights (same proportions as layoutAtacarejoPriceGroup)
        const bannerH = totalH * 0.14;
        const retailH = totalH * 0.43;
        const wholesaleH = totalH - retailH - bannerH;

        // Vertical positions (centered around 0)
        const y0 = -totalH / 2;
        const retailCY = y0 + retailH / 2;
        const bannerCY = y0 + retailH + bannerH / 2;
        const wholesaleCY = y0 + retailH + bannerH + wholesaleH / 2;

        // Backgrounds - center horizontally, position vertically
        if (retailBg) retailBg.set({ originX: 'center', originY: 'center', width: previewW, height: retailH, left: 0, top: retailCY });
        if (bannerBg) bannerBg.set({ originX: 'center', originY: 'center', width: previewW, height: bannerH, left: 0, top: bannerCY });
        if (wholesaleBg) wholesaleBg.set({ originX: 'center', originY: 'center', width: previewW, height: wholesaleH, left: 0, top: wholesaleCY });

        // Helper to set font size based on block height
        const setFontSize = (obj: any, scale: number, baseH: number) => {
            if (obj) {
                const fontSize = typeof obj.__fontScale === 'number' ? baseH * obj.__fontScale : baseH * scale;
                obj.set({ fontSize, scaleX: 1, scaleY: 1 });
                if (typeof obj.initDimensions === 'function') obj.initDimensions();
            }
        };

        // Layout retail tier (top section - red background)
        setFontSize(retailInteger, 0.60, retailH);
        setFontSize(retailDecimal, 0.36, retailH);
        setFontSize(retailCurrency, 0.22, retailH);
        setFontSize(retailUnit, 0.22, retailH);
        setFontSize(retailPack, 0.18, retailH);

        if (retailCurrency) retailCurrency.set({ originX: 'left', originY: 'center', left: -60, top: retailCY - (retailH * 0.05) });
        if (retailInteger) retailInteger.set({ originX: 'left', originY: 'center', left: -40, top: retailCY });
        if (retailDecimal) retailDecimal.set({ originX: 'left', originY: 'center', left: 10, top: retailCY - (retailH * 0.18) });
        if (retailUnit) retailUnit.set({ originX: 'left', originY: 'center', left: 45, top: retailCY + (retailH * 0.18) });
        if (retailPack) retailPack.set({ originX: 'center', originY: 'center', left: 0, top: retailCY + (retailH * 0.30) });

        // Layout banner (middle section - white background)
        setFontSize(bannerText, 0.32, bannerH);
        if (bannerText) bannerText.set({ originX: 'center', originY: 'center', left: 0, top: bannerCY });

        // Layout wholesale tier (bottom section - yellow background)
        setFontSize(wholesaleInteger, 0.60, wholesaleH);
        setFontSize(wholesaleDecimal, 0.36, wholesaleH);
        setFontSize(wholesaleCurrency, 0.22, wholesaleH);
        setFontSize(wholesaleUnit, 0.22, wholesaleH);
        setFontSize(wholesalePack, 0.18, wholesaleH);

        if (wholesaleCurrency) wholesaleCurrency.set({ originX: 'left', originY: 'center', left: -60, top: wholesaleCY - (wholesaleH * 0.05) });
        if (wholesaleInteger) wholesaleInteger.set({ originX: 'left', originY: 'center', left: -40, top: wholesaleCY });
        if (wholesaleDecimal) wholesaleDecimal.set({ originX: 'left', originY: 'center', left: 10, top: wholesaleCY - (wholesaleH * 0.18) });
        if (wholesaleUnit) wholesaleUnit.set({ originX: 'left', originY: 'center', left: 45, top: wholesaleCY + (wholesaleH * 0.18) });
        if (wholesalePack) wholesalePack.set({ originX: 'center', originY: 'center', left: 0, top: wholesaleCY + (wholesaleH * 0.30) });

        safeAddWithUpdate(pg);
        return;
    }

    // ===== STANDARD SINGLE-PRICE TEMPLATE =====
    const priceBg = all.find(o => o?.name === 'price_bg');
    const priceBgImage = all.find(o => o?.name === 'price_bg_image' || o?.name === 'splash_image');
    const currencyCircle = all.find(o => o?.name === 'price_currency_bg' || o?.name === 'priceSymbolBg');
    const currencyTextPrimary = all.find(o => o?.name === 'price_currency_text');
    const currencyTextLegacy = all.find(o => o?.name === 'priceSymbol' || o?.name === 'price_currency');
    const currencyText = currencyTextPrimary || currencyTextLegacy;
    const priceText = all.find(o => o?.name === 'smart_price' || o?.name === 'price_value_text');
    const priceInteger = all.find(o => o?.name === 'price_integer_text' || o?.name === 'priceInteger');
    const priceDecimal = all.find(o => o?.name === 'price_decimal_text' || o?.name === 'priceDecimal');
    const priceUnit = all.find(o => o?.name === 'price_unit_text' || o?.name === 'priceUnit');

    // Drop legacy duplicates that inflate bounds (causes tiny/offset previews).
    const recognized = new Set<any>([
        priceBg,
        priceBgImage,
        currencyCircle,
        currencyText,
        priceText,
        priceInteger,
        priceDecimal,
        priceUnit
    ]);
    const cleanupNames = new Set([
        'priceSymbol',
        'price_currency',
        'price_currency_text',
        'priceInteger',
        'priceDecimal',
        'priceUnit',
        'smart_price',
        'price_value_text'
    ]);
    all.forEach((o) => {
        if (!o || recognized.has(o)) return;
        if (!cleanupNames.has(String(o.name || ''))) return;
        pg.remove(o);
    });

    // If there's a splash image, crop it so its real bounds match the pill.
    if (priceBgImage && priceBg && priceBgImage.type === 'image' && priceBg.type === 'rect') {
        const img: any = priceBgImage;
        const pillW = priceBg.width || 1;
        const pillH = priceBg.height || 1;
        img.set({ originX: 'center', originY: 'center', left: 0, top: 0 });

        const el: any = img._originalElement || img._element;
        const iw = el?.naturalWidth || el?.width || img.width || 0;
        const ih = el?.naturalHeight || el?.height || img.height || 0;
        if (iw > 0 && ih > 0) {
            img.set({ cropX: 0, cropY: 0, width: iw, height: ih });
            let scale = Math.max(pillW / iw, pillH / ih);
            if (!Number.isFinite(scale) || scale <= 0) scale = 1;
            scale = Math.min(scale, 20);
            const cropW = Math.min(iw, pillW / scale);
            const cropH = Math.min(ih, pillH / scale);
            const cropX = Math.max(0, (iw - cropW) / 2);
            const cropY = Math.max(0, (ih - cropH) / 2);
            img.set({ cropX, cropY, width: cropW, height: cropH, scaleX: scale, scaleY: scale });
        } else {
            img.set({ cropX: 0, cropY: 0, width: pillW, height: pillH, scaleX: 1, scaleY: 1 });
        }
    }

    safeAddWithUpdate(pg);
}

function serializePriceGroupForTemplate(pg: any) {
    if (!pg || typeof pg.toObject !== 'function') return null;

    const prev = {
        left: pg.left,
        top: pg.top,
        scaleX: pg.scaleX,
        scaleY: pg.scaleY,
        angle: pg.angle,
        originX: pg.originX,
        originY: pg.originY
    };

    // Normalize so saved templates are position/scale-independent.
    pg.set({ left: 0, top: 0, scaleX: 1, scaleY: 1, angle: 0, originX: 'center', originY: 'center' });
    safeAddWithUpdate(pg);
    const j: any = pg.toObject(LABEL_TEMPLATE_EXTRA_PROPS);
    pg.set(prev);
    safeAddWithUpdate(pg);
    delete j.layoutManager;
    delete j.layout;

    // Mark this as a custom template and store original dimensions for proportional scaling
    (j as any).__isCustomTemplate = true;

    // Store original values on each object for proportional scaling
    if (Array.isArray(j.objects)) {
        j.objects.forEach((obj: any) => {
            if (!obj) return;

            // Store original position
            obj.__originalLeft = obj.left;
            obj.__originalTop = obj.top;
            obj.__originalOriginX = obj.originX;
            obj.__originalOriginY = obj.originY;
            obj.__originalScaleX = obj.scaleX || 1;
            obj.__originalScaleY = obj.scaleY || 1;

            // For text objects, store original font size and font family
            if (obj.type === 'text') {
                if (typeof obj.fontSize === 'number') {
                    obj.__originalFontSize = obj.fontSize;
                }
                if (typeof obj.fontFamily === 'string') {
                    obj.__originalFontFamily = obj.fontFamily;
                }
            }

            // For circles, store original radius
            if (obj.type === 'circle' && typeof obj.radius === 'number') {
                obj.__originalRadius = obj.radius;
            }

            // For rects, store original dimensions and radius
            if (obj.type === 'rect') {
                if (typeof obj.width === 'number') obj.__originalWidth = obj.width;
                if (typeof obj.height === 'number') obj.__originalHeight = obj.height;
                if (typeof obj.rx === 'number') obj.__originalRx = obj.rx;
                if (typeof obj.ry === 'number') obj.__originalRy = obj.ry;

                // For price_bg, store special metadata
                if (obj.name === 'price_bg') {
                    obj.__originalWidth = obj.width;
                    obj.__originalHeight = obj.height;
                    obj.__roundness = typeof obj.rx === 'number' && obj.height > 0
                        ? (obj.rx * 2) / obj.height
                        : 1;
                    if (typeof obj.strokeWidth === 'number') {
                        obj.__strokeWidth = obj.strokeWidth;
                    }
                    if (obj.shadow && typeof obj.shadow.blur === 'number') {
                        obj.__shadowBlur = obj.shadow.blur;
                    }
                }
            }

            // Store original stroke width
            if (typeof obj.strokeWidth === 'number') {
                obj.__originalStrokeWidth = obj.strokeWidth;
            }
        });
    }

    return j;
}

function setPriceOnPriceGroup(pg: any, rawPrice: string, unitText?: string) {
    if (!pg || typeof pg.getObjects !== 'function') return;
    const parts = collectObjectsDeep(pg);

    const currency = parts.find((o: any) => o?.name === 'price_currency_text');
    if (currency && (!currency.text || String(currency.text).trim().length === 0)) currency.set?.('text', 'R$');

    const intTxt = parts.find((o: any) => o?.name === 'price_integer_text');
    const decTxt = parts.find((o: any) => o?.name === 'price_decimal_text');
    const unitTxt = parts.find((o: any) => o?.name === 'price_unit_text');
    const legacy = parts.find((o: any) => o?.name === 'smart_price' || o?.name === 'price_value_text');

    const priceParts = splitPriceParts(rawPrice);
    const integer = priceParts.integer;
    const decimalText = `,${priceParts.dec}`;

    if (intTxt && decTxt) {
        intTxt.set?.('text', integer);
        decTxt.set?.('text', decimalText);
        if (typeof intTxt.initDimensions === 'function') intTxt.initDimensions();
        if (typeof decTxt.initDimensions === 'function') decTxt.initDimensions();

        if (unitTxt) {
            const raw = (typeof unitText === 'string' && unitText.trim().length) ? unitText : String(unitTxt.text || '').trim();
            const u = raw ? normalizeUnitForLabel(raw) : '';
            unitTxt.set?.('text', u);
            if (typeof unitTxt.initDimensions === 'function') unitTxt.initDimensions();
        }
        return;
    }

    if (legacy) legacy.set?.('text', `${integer}${decimalText}`);
}

function inferUnitFromCard(card: any): string | undefined {
    if (!card) return 'UN';
    // Prefer explicit metadata (new cards store it on the group).
    const meta = (card as any).unitLabel ?? (card as any).unit ?? (card as any).packUnit ?? '';
    if (String(meta || '').trim().length) return normalizeUnitForLabel(meta);

    // Fallback: if the title mentions KG anywhere, treat as KG (gramatura stays in the name).
    if (typeof card.getObjects === 'function') {
        const title = card.getObjects().find((o: any) => o?.name === 'smart_title' || o?.name === 'title');
        const text = String(title?.text || '');
        if (/\bkg\b/i.test(text)) return 'KG';
    }
    return 'UN';
}

async function renderLabelTemplatePreview(tpl: LabelTemplate): Promise<string | undefined> {
    if (!fabric) return undefined;
    try {
        const el = document.createElement('canvas');
        el.width = 280;
        el.height = 110;
        const sc = new fabric.StaticCanvas(el, { backgroundColor: 'transparent' });
        const g = await instantiatePriceGroupFromTemplate(tpl);
        normalizePriceGroupForPreview(g);
        layoutPriceGroup(g, 320, 220);
        g.set({ left: sc.getWidth() / 2, top: sc.getHeight() / 2 });
        // Fit with a bit of padding
        const bw = g.getScaledWidth?.() ?? g.width ?? 1;
        const bh = g.getScaledHeight?.() ?? g.height ?? 1;
        // Allow upscaling so the label fills the thumbnail area (prevents tiny previews).
        const scale = Math.min((sc.getWidth() * 0.95) / bw, (sc.getHeight() * 0.9) / bh, 3);
        g.set({ scaleX: scale, scaleY: scale });
        sc.add(g);
        try {
            sc.renderAll();
        } catch (e) {
            // Ignore render errors on static canvas
        }
        const url = sc.toDataURL({ format: 'png', multiplier: 1 });
        try {
            sc.dispose();
        } catch (e) {
            // Ignore dispose errors
        }
        return url;
    } catch (err) {
        console.warn('[labelTemplates] Failed to render preview', err);
        return undefined;
    }
}

async function createLabelTemplateFromSelection(name: string) {
    if (!canvas.value) return;
    const pg = getPriceGroupFromAny(canvas.value.getActiveObject());
    if (!pg) return;

    const now = new Date().toISOString();
    const tpl: LabelTemplate = {
        id: Math.random().toString(36).substr(2, 9),
        name: (name || 'Etiqueta').trim() || 'Etiqueta',
        kind: 'priceGroup-v1',
        group: serializePriceGroupForTemplate(pg),
        createdAt: now,
        updatedAt: now
    };
    tpl.previewDataUrl = await renderLabelTemplatePreview(tpl);
    labelTemplates.value = [...labelTemplates.value, tpl];
    saveCurrentState();
    await upsertLabelTemplateToDb(tpl);
}

async function createDefaultLabelTemplate(name: string) {
    if (!fabric) return;
    const now = new Date().toISOString();
    try {
        const pg = buildDefaultPriceGroupForCard('22,99', 320, 450, 0);
        // Make sure nested editing works if inserted later.
        pg.set({ name: 'priceGroup', subTargetCheck: true, interactive: true });
        if (typeof pg.getObjects === 'function') {
            pg.getObjects().forEach((child: any) => child.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }));
        }

        const tpl: LabelTemplate = {
            id: Math.random().toString(36).substr(2, 9),
            name: (name || 'Etiqueta Padrao').trim() || 'Etiqueta Padrao',
            kind: 'priceGroup-v1',
            group: serializePriceGroupForTemplate(pg),
            createdAt: now,
            updatedAt: now
        };
        tpl.previewDataUrl = await renderLabelTemplatePreview(tpl);
        labelTemplates.value = [...labelTemplates.value, tpl];
        saveCurrentState();
        await upsertLabelTemplateToDb(tpl);
    } catch (err) {
        console.warn('[labelTemplates] Failed to create default template', err);
    }
}

async function ensureBuiltInDefaultLabelTemplate() {
    // Seed a "Padrão" template so it appears in the list and can be edited/duplicated.
    if (!fabric) return;
    const exists = (labelTemplates.value || []).some(t => t.id === BUILTIN_DEFAULT_LABEL_TEMPLATE_ID);
    if (exists) return;

    const now = new Date().toISOString();
    const pg = buildDefaultPriceGroupForCard('22,99', 320, 450, 0);
    pg.set({ name: 'priceGroup', subTargetCheck: true, interactive: true });
    if (typeof pg.getObjects === 'function') {
        pg.getObjects().forEach((child: any) => child.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }));
    }

    const tpl: LabelTemplate = {
        id: BUILTIN_DEFAULT_LABEL_TEMPLATE_ID,
        name: 'Padrão',
        kind: 'priceGroup-v1',
        group: serializePriceGroupForTemplate(pg),
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
    };
    tpl.previewDataUrl = await renderLabelTemplatePreview(tpl);
    labelTemplates.value = [tpl, ...(labelTemplates.value || [])];
    saveCurrentState();
}

async function ensureBuiltInAtacarejoLabelTemplate() {
    // Seed an "Atacarejo" 2-tier template (regular + wholesale) for CSV/Excel-like price tables.
    if (!fabric) return;
    const exists = (labelTemplates.value || []).some(t => t.id === BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID);
    if (exists) return;

    const now = new Date().toISOString();
    const pg = buildAtacarejoPriceGroupForCard({
        price: '1,95',
        priceWholesale: '1,92',
        wholesaleTrigger: 10,
        wholesaleTriggerUnit: 'FD',
        packQuantity: 12,
        packUnit: 'UN',
        packageLabel: 'FD'
    }, 320, 450, 0);
    pg.set({ name: 'priceGroup', subTargetCheck: true, interactive: true });
    if (typeof pg.getObjects === 'function') {
        pg.getObjects().forEach((child: any) => child.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }));
    }

    const tpl: LabelTemplate = {
        id: BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID,
        name: 'Atacarejo (2 precos)',
        kind: 'priceGroup-v1',
        group: serializePriceGroupForTemplate(pg),
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
    };
    tpl.previewDataUrl = await renderLabelTemplatePreview(tpl);
    labelTemplates.value = [tpl, ...(labelTemplates.value || [])];
    saveCurrentState();
}

async function ensureBuiltInBlackYellowLabelTemplate() {
    // Seed a "Preto/Amarelo" template similar to the reference (black pill + yellow text).
    if (!fabric) return;
    const exists = (labelTemplates.value || []).some(t => t.id === BUILTIN_BLACK_YELLOW_LABEL_TEMPLATE_ID);
    if (exists) return;

    const now = new Date().toISOString();
    const pg = buildBlackYellowPriceGroupForCard('26,99', 320, 450, 0);
    pg.set({ name: 'priceGroup', subTargetCheck: true, interactive: true });
    if (typeof pg.getObjects === 'function') {
        pg.getObjects().forEach((child: any) => child.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }));
    }

    const tpl: LabelTemplate = {
        id: BUILTIN_BLACK_YELLOW_LABEL_TEMPLATE_ID,
        name: 'Preto/Amarelo',
        kind: 'priceGroup-v1',
        group: serializePriceGroupForTemplate(pg),
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now
    };
    tpl.previewDataUrl = await renderLabelTemplatePreview(tpl);
    labelTemplates.value = [tpl, ...(labelTemplates.value || [])];
    saveCurrentState();
}

async function updateLabelTemplateFromSelection(templateId: string) {
    if (!canvas.value) return;
    const pg = getPriceGroupFromAny(canvas.value.getActiveObject());
    if (!pg) return;

    const idx = labelTemplates.value.findIndex(t => t.id === templateId);
    if (idx === -1) return;

    const prev = labelTemplates.value[idx]!;
    const next: LabelTemplate = {
        ...prev,
        group: serializePriceGroupForTemplate(pg),
        updatedAt: new Date().toISOString()
    };
    next.previewDataUrl = await renderLabelTemplatePreview(next);
    const copy = [...labelTemplates.value];
    copy[idx] = next;
    labelTemplates.value = copy;
    saveCurrentState();
    await upsertLabelTemplateToDb(next);
}

function deleteLabelTemplateById(templateId: string) {
    const t = labelTemplates.value.find(x => x.id === templateId);
    if (t?.isBuiltIn) return;
    labelTemplates.value = (labelTemplates.value || []).filter(x => x.id !== templateId);
    saveCurrentState();
    void deleteLabelTemplateFromDb(templateId);
}

async function duplicateLabelTemplateById(templateId: string) {
    const src = labelTemplates.value.find(t => t.id === templateId);
    if (!src) return;
    const now = new Date().toISOString();
    const copy: LabelTemplate = {
        ...src,
        id: Math.random().toString(36).substr(2, 9),
        name: `${src.name} (Copia)`,
        createdAt: now,
        updatedAt: now
    };
    if (!copy.previewDataUrl) copy.previewDataUrl = await renderLabelTemplatePreview(copy);
    labelTemplates.value = [...labelTemplates.value, copy];
    saveCurrentState();
    await upsertLabelTemplateToDb(copy);
}

async function applyLabelTemplateToCard(card: any, templateId: string) {
    if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') return;
    const tpl = labelTemplates.value.find(t => t.id === templateId);
    if (!tpl) return;

    const objs = card.getObjects();
    const oldPg = objs.find((o: any) => o && o.type === 'group' && o.name === 'priceGroup');
    if (!oldPg) return;

    const oldParts = typeof oldPg.getObjects === 'function' ? oldPg.getObjects() : [];
    const oldPrice = oldParts.find((o: any) => o.name === 'smart_price' || o.name === 'price_value_text');
    const oldInt = oldParts.find((o: any) => o.name === 'price_integer_text');
    const oldDec = oldParts.find((o: any) => o.name === 'price_decimal_text');
    const oldUnit = oldParts.find((o: any) => o.name === 'price_unit_text');
    const oldCurrency = oldParts.find((o: any) => o.name === 'price_currency_text');
    const oldPriceText = (oldInt && oldDec) ? `${oldInt.text || '0'}${oldDec.text || ',00'}` : oldPrice?.text;
    const oldCurrencyText = oldCurrency?.text;
    const oldUnitText = oldUnit?.text;
    const inferredUnit = (typeof oldUnitText === 'string' && oldUnitText.trim().length)
        ? normalizeUnitForLabel(oldUnitText)
        : inferUnitFromCard(card);

    const newPg = await instantiatePriceGroupFromTemplate(tpl);
    if (typeof oldPriceText === 'string') setPriceOnPriceGroup(newPg, oldPriceText, typeof inferredUnit === 'string' ? inferredUnit : undefined);
    if (typeof oldCurrencyText === 'string') {
        const c = newPg.getObjects?.().find((o: any) => o.name === 'price_currency_text');
        if (c && typeof c.set === 'function') c.set('text', oldCurrencyText);
    }
    // Apply wholesale/pack metadata when the template supports it (no-op otherwise).
    applyAtacarejoPricingToPriceGroup(newPg, {
        price: typeof oldPriceText === 'string' ? oldPriceText : null,
        priceWholesale: (card as any).priceWholesale ?? null,
        wholesaleTrigger: (card as any).wholesaleTrigger ?? null,
        wholesaleTriggerUnit: (card as any).wholesaleTriggerUnit ?? null,
        packQuantity: (card as any).packQuantity ?? null,
        packUnit: (card as any).packUnit ?? null,
        packageLabel: (card as any).packageLabel ?? null,
        weight: typeof inferredUnit === 'string' ? inferredUnit : null
    });

    newPg.set({
        left: oldPg.left ?? 0,
        top: oldPg.top ?? 0,
        originX: oldPg.originX ?? 'center',
        originY: oldPg.originY ?? 'center',
        angle: oldPg.angle ?? 0,
        scaleX: 1,
        scaleY: 1,
        name: 'priceGroup',
        subTargetCheck: true,
        interactive: true
    });
    if (typeof newPg.getObjects === 'function') {
        newPg.getObjects().forEach((child: any) => {
            const isBgImage = child?.name === 'price_bg_image' || child?.name === 'splash_image';
            child.set({
                selectable: !isBgImage,
                evented: !isBgImage,
                hasControls: !isBgImage,
                hasBorders: !isBgImage
            });
        });
    }

    card.remove(oldPg);
    safeAddWithUpdate(card, newPg);

    const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? 0;
    const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? 0;
    if (cardW && cardH) {
        const layout = layoutPriceGroup(newPg, cardW, cardH);
        const marginBottom = cardH * 0.05;
        const halfH = cardH / 2;
        const hForAnchor = layout?.pillH ?? (newPg.getScaledHeight?.() ?? newPg.height ?? (cardH * 0.18));
        newPg.set({ top: halfH - (hForAnchor / 2) - marginBottom });
    }

    safeAddWithUpdate(card);
    card.setCoords();
}

function buildDefaultPriceGroupForCard(priceStr: string, cardW: number, cardH: number, top: number, unitText?: string) {
    const pillH = cardH * 0.18;
    const pillW = Math.min(cardW * 0.6, cardW - 10);
    const priceBg = new fabric.Rect({
        width: pillW,
        height: pillH,
        rx: pillH / 2,
        ry: pillH / 2,
        fill: '#000000',
        stroke: '#ff0000',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_bg',
        shadow: new fabric.Shadow({ color: '#ff0000', blur: 12, offsetX: 0, offsetY: 0 })
    });

    const circleSize = pillH * 0.72;
    const circleCenterX = -(pillW / 2) + (circleSize * 0.35);
    const currencyCircle = new fabric.Circle({
        radius: circleSize / 2,
        fill: '#FFFF00',
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0,
        name: 'price_currency_bg'
    });

    const currencyText = new fabric.Text('R$', {
        fontSize: circleSize * 0.32,
        fontFamily: 'Inter',
        fontWeight: 'bold',
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0,
        name: 'price_currency_text'
    });

    const parts = splitPriceParts(priceStr);
    const integer = parts.integer;
    const dec = parts.dec;

    const priceInteger = new fabric.IText(integer, {
        fontSize: pillH * 0.72,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#ffffff',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_integer_text',
        __fontScale: 0.72,
        __yOffsetRatio: 0
    });

    const priceDecimal = new fabric.IText(`,${dec}`, {
        fontSize: pillH * 0.42,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#ffffff',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_decimal_text',
        __fontScale: 0.42,
        __yOffsetRatio: -0.18
    });

    const u = normalizeUnitForLabel(unitText);
    const priceUnit = new fabric.IText(u, {
        fontSize: pillH * 0.26,
        fontFamily: 'Inter',
        fontWeight: '800',
        fill: '#ffffff',
        originX: 'right',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_unit_text',
        __fontScale: 0.26,
        __yOffsetRatio: 0.22,
        visible: !!u
    });

    const pg = new fabric.Group([priceBg, currencyCircle, currencyText, priceInteger, priceDecimal, priceUnit], {
        originX: 'center',
        originY: 'center',
        left: 0,
        top,
        name: 'priceGroup'
    });
    layoutPriceGroup(pg, cardW, cardH);
    return pg;
}

function buildBlackYellowPriceGroupForCard(priceStr: string, cardW: number, cardH: number, top: number, unitText?: string) {
    const pillH = cardH * 0.18;
    const pillW = Math.min(cardW * 0.6, cardW - 10);
    const yellow = '#FDE047'; // close to the reference

    const priceBg = new fabric.Rect({
        width: pillW,
        height: pillH,
        rx: pillH / 2,
        ry: pillH / 2,
        fill: '#000000',
        stroke: 'rgba(0,0,0,0)', // prevent red glow fallback in layoutPriceGroup
        strokeWidth: 0,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_bg',
        // layoutPriceGroup reads these:
        __roundness: 1,
        __strokeWidth: 0
    });

    // Keep a (hidden-in-plain-sight) circle so layoutPriceGroup can position "R$" consistently.
    const circleSize = pillH * 0.72;
    const circleCenterX = -(pillW / 2) + (circleSize * 0.35);
    const currencyCircle = new fabric.Circle({
        radius: circleSize / 2,
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0,
        name: 'price_currency_bg'
    });

    const currencyText = new fabric.Text('R$', {
        fontSize: circleSize * 0.30,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: yellow,
        originX: 'center',
        originY: 'center',
        left: circleCenterX,
        top: 0,
        name: 'price_currency_text'
    });

    const parts = splitPriceParts(priceStr);
    const integer = parts.integer;
    const dec = parts.dec;

    const priceInteger = new fabric.IText(integer, {
        fontSize: pillH * 0.86,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: yellow,
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_integer_text',
        __fontScale: 0.86,
        __yOffsetRatio: 0
    });

    const priceDecimal = new fabric.IText(`,${dec}`, {
        fontSize: pillH * 0.55,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: yellow,
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_decimal_text',
        __fontScale: 0.55,
        __yOffsetRatio: -0.30
    });

    // This template matches the reference (no KG/UN shown). Users can enable it via the mini editor if needed.
    const priceUnit = new fabric.IText('', {
        fontSize: pillH * 0.26,
        fontFamily: 'Inter',
        fontWeight: '800',
        fill: yellow,
        originX: 'right',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_unit_text',
        __fontScale: 0.26,
        __yOffsetRatio: 0.22,
        visible: false
    });

    const pg = new fabric.Group([priceBg, currencyCircle, currencyText, priceInteger, priceDecimal, priceUnit], {
        originX: 'center',
        originY: 'center',
        left: 0,
        top,
        name: 'priceGroup'
    });
    layoutPriceGroup(pg, cardW, cardH);
    return pg;
}

function buildAtacarejoPriceGroupForCard(sample: any, cardW: number, cardH: number, top: number) {
    const retailBg = new fabric.Rect({
        width: 300,
        height: 60,
        rx: 10,
        ry: 10,
        fill: '#EF4444',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'atac_retail_bg'
    });

    const bannerBg = new fabric.Rect({
        width: 300,
        height: 18,
        rx: 8,
        ry: 8,
        fill: '#FFFFFF',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'atac_banner_bg'
    });

    const wholesaleBg = new fabric.Rect({
        width: 300,
        height: 60,
        rx: 10,
        ry: 10,
        fill: '#FDE047',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'atac_wholesale_bg'
    });

    const retailCurrency = new fabric.IText('R$', {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#FFFFFF',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'retail_currency_text',
        __fontScale: 0.22
    });

    const retailInteger = new fabric.IText('0', {
        fontSize: 40,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#FFFFFF',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'retail_integer_text',
        __fontScale: 0.60
    });

    const retailDecimal = new fabric.IText(',00', {
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#FFFFFF',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'retail_decimal_text',
        __fontScale: 0.36
    });

    const retailUnit = new fabric.IText('UN', {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#FFFFFF',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'retail_unit_text',
        __fontScale: 0.22
    });

    const retailPack = new fabric.IText('', {
        fontSize: 12,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#FFFFFF',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'retail_pack_line_text',
        __fontScale: 0.18,
        visible: false
    });

    const bannerText = new fabric.IText('ACIMA 10 FD', {
        fontSize: 12,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_banner_text',
        __fontScale: 0.32
    });

    const wholesaleCurrency = new fabric.IText('R$', {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_currency_text',
        __fontScale: 0.22
    });

    const wholesaleInteger = new fabric.IText('0', {
        fontSize: 40,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_integer_text',
        __fontScale: 0.60
    });

    const wholesaleDecimal = new fabric.IText(',00', {
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_decimal_text',
        __fontScale: 0.36
    });

    const wholesaleUnit = new fabric.IText('UN', {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_unit_text',
        __fontScale: 0.22
    });

    const wholesalePack = new fabric.IText('', {
        fontSize: 12,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#000000',
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'wholesale_pack_line_text',
        __fontScale: 0.18,
        visible: false
    });

    const pg = new fabric.Group([
        retailBg,
        bannerBg,
        wholesaleBg,
        retailCurrency,
        retailInteger,
        retailDecimal,
        retailUnit,
        retailPack,
        bannerText,
        wholesaleCurrency,
        wholesaleInteger,
        wholesaleDecimal,
        wholesaleUnit,
        wholesalePack
    ], {
        originX: 'center',
        originY: 'center',
        left: 0,
        top,
        name: 'priceGroup'
    });

    applyAtacarejoPricingToPriceGroup(pg, sample);
    layoutPriceGroup(pg, cardW, cardH);
    return pg;
}

async function resetCardPriceGroupToDefault(card: any) {
    if (!fabric || !card || card.type !== 'group' || typeof card.getObjects !== 'function') return;
    const objs = card.getObjects();
    const oldPg = objs.find((o: any) => o && o.type === 'group' && o.name === 'priceGroup');
    if (!oldPg) return;

    const oldParts = typeof oldPg.getObjects === 'function' ? oldPg.getObjects() : [];
    const oldPrice = oldParts.find((o: any) => o.name === 'smart_price' || o.name === 'price_value_text');
    const oldInt = oldParts.find((o: any) => o.name === 'price_integer_text');
    const oldDec = oldParts.find((o: any) => o.name === 'price_decimal_text');
    const oldUnit = oldParts.find((o: any) => o.name === 'price_unit_text');
    const oldPriceText =
        (oldInt && oldDec)
            ? `${oldInt.text || '0'}${oldDec.text || ',00'}`
            : (typeof oldPrice?.text === 'string' ? oldPrice.text : '0,00');
    const oldUnitText = typeof oldUnit?.text === 'string' ? oldUnit.text : undefined;
    const inferredUnit = oldUnitText && oldUnitText.trim().length ? normalizeUnitForLabel(oldUnitText) : inferUnitFromCard(card);

    const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? 0;
    const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? 0;
    if (!cardW || !cardH) return;

    const newPg = buildDefaultPriceGroupForCard(oldPriceText, cardW, cardH, oldPg.top ?? 0, inferredUnit);
    newPg.set({
        left: oldPg.left ?? 0,
        originX: oldPg.originX ?? 'center',
        originY: oldPg.originY ?? 'center',
        angle: oldPg.angle ?? 0
    });

    card.remove(oldPg);
    safeAddWithUpdate(card, newPg);
    safeAddWithUpdate(card);
    card.setCoords();
}

async function applyLabelTemplateToZone(zone: any, templateId?: string, applyToExisting: boolean = false) {
    if (!canvas.value || !zone || !isLikelyProductZone(zone)) return;
    const id = templateId || undefined;
    const prev = (zone as any)._zoneGlobalStyles ?? {};
    (zone as any)._zoneGlobalStyles = { ...prev, splashTemplateId: id };

    // Only apply to existing cards if explicitly requested (e.g., user explicitly changes template)
    // If applyToExisting is false, just update the reference for new products
    if (applyToExisting) {
        const cards = getZoneChildren(zone);
        for (const card of cards) {
            if (id) await applyLabelTemplateToCard(card, id);
            else await resetCardPriceGroupToDefault(card);
        }

        // Also re-apply colors/text style if the zone has global styles.
        const styles = (zone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value;
        applyGlobalStylesToCards(styles, zone);
    }

    canvas.value.requestRenderAll();
    saveCurrentState();
}

async function setTemplateSplashImage(templateId: string, file: File) {
    if (!fabric) return;
    const idx = labelTemplates.value.findIndex(t => t.id === templateId);
    if (idx === -1) return;

    try {
        const uploaded = await uploadFile(file);
        if (!uploaded?.success || !uploaded?.url) return;

        const tpl = labelTemplates.value[idx]!;
        const g = await instantiatePriceGroupFromTemplate(tpl);

        const labelProxyUrl = toWasabiProxyUrl(uploaded.url) || uploaded.url;
        const img: any = await fabric.Image.fromURL(labelProxyUrl, { crossOrigin: 'anonymous' });
        img.set({
            name: 'price_bg_image',
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0,
            selectable: false,
            evented: false
        });

        const current = typeof g.getObjects === 'function' ? g.getObjects().slice() : [];
        current.forEach((o: any) => g.remove(o));
        safeAddWithUpdate(g, img);
        current.forEach((o: any) => safeAddWithUpdate(g, o));

        // Serialize back into the template
        const next: LabelTemplate = {
            ...tpl,
            group: serializePriceGroupForTemplate(g),
            updatedAt: new Date().toISOString()
        };
        next.previewDataUrl = await renderLabelTemplatePreview(next);

        const list = [...labelTemplates.value];
        list[idx] = next;
        labelTemplates.value = list;
        saveCurrentState();
        await upsertLabelTemplateToDb(next);
    } catch (err) {
        console.warn('[labelTemplates] Failed to set splash image', err);
    }
}

async function insertLabelTemplateToCanvas(templateId: string) {
    if (!canvas.value) return;
    const tpl = labelTemplates.value.find(t => t.id === templateId);
    if (!tpl) return;
    try {
        const g = await instantiatePriceGroupFromTemplate(tpl);
        layoutPriceGroup(g, 320, 220);
        const center = getCenterOfView();
        g.set({
            left: center.x,
            top: center.y,
            originX: 'center',
            originY: 'center',
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            excludeFromExport: true,
            name: 'priceGroup',
            subTargetCheck: true,
            interactive: true
        });
        if (typeof g.getObjects === 'function') {
            g.getObjects().forEach((child: any) => child.set({ selectable: true, evented: true, hasControls: true, hasBorders: true }));
        }
        (g as any)._customId = Math.random().toString(36).substr(2, 9);
        canvas.value.add(g);
        canvas.value.setActiveObject(g);
        canvas.value.requestRenderAll();
        saveCurrentState();
    } catch (err) {
        console.warn('[labelTemplates] Failed to insert template', err);
    }
}

function beginEditSelectedLabel() {
    if (!canvas.value) return;

    const active = canvas.value.getActiveObject();
    const card = getCardGroupFromAny(active);
    const pg = getPriceGroupFromAny(active);

    // Close modal so the user can interact with the canvas immediately.
    showLabelTemplatesModal.value = false;

    // Enable deep editing on the card so sub-targets can be selected.
    if (card && card.type === 'group') {
        card.set({ subTargetCheck: true, interactive: true });
        if (typeof card.getObjects === 'function') {
            card.getObjects().forEach((child: any) => {
                child.set({
                    selectable: true,
                    evented: true,
                    hasControls: true,
                    hasBorders: true,
                    lockMovementX: false,
                    lockMovementY: false,
                    lockScalingX: false,
                    lockScalingY: false,
                    lockRotation: false
                });
                child.setCoords?.();
            });
        }
        card.setCoords?.();
        canvas.value.setActiveObject(card);
    }

    // Also enable editing inside the priceGroup directly (2nd level).
    if (pg && pg.type === 'group') {
        pg.set({ subTargetCheck: true, interactive: true });
        if (typeof pg.getObjects === 'function') {
            pg.getObjects().forEach((child: any) => {
                const isBgImage = child?.name === 'price_bg_image' || child?.name === 'splash_image';
                child.set({
                    selectable: !isBgImage,
                    evented: !isBgImage,
                    hasControls: !isBgImage,
                    hasBorders: !isBgImage,
                    lockMovementX: false,
                    lockMovementY: false,
                    lockScalingX: false,
                    lockScalingY: false,
                    lockRotation: false
                });
                child.setCoords?.();
            });
        }
        pg.setCoords?.();
    }

    canvas.value.requestRenderAll();
    triggerRef(selectedObjectRef);
}

async function handleUpdateTemplateFromMiniEditor(templateId: string, updates: { group: any; previewDataUrl?: string; name?: string }) {
    const idx = labelTemplates.value.findIndex(t => t.id === templateId);
    if (idx === -1) return;
    const prev = labelTemplates.value[idx]!;
    const next: LabelTemplate = {
        ...prev,
        name: (updates.name ?? prev.name),
        group: (() => {
            const j: any = (updates.group ?? prev.group);
            if (j && typeof j === 'object') { delete j.layoutManager; delete j.layout; }
            return j;
        })(),
        previewDataUrl: updates.previewDataUrl ?? prev.previewDataUrl,
        updatedAt: new Date().toISOString()
    };
    const list = [...labelTemplates.value];
    list[idx] = next;
    labelTemplates.value = list;
    saveCurrentState();
    await upsertLabelTemplateToDb(next);

    // If this template is in use by any zone, re-apply it to keep cards in sync.
    if (canvas.value) {
        const zones = canvas.value.getObjects().filter((o: any) => isLikelyProductZone(o));
        for (const z of zones) {
            const used = (z as any)._zoneGlobalStyles?.splashTemplateId;
            if (used === templateId) {
                await applyLabelTemplateToZone(z, templateId);
            }
        }
    }
}

// Helper for Responsive Card Layout
const resizeSmartObject = (group: any, w: number, h: number, styles?: Partial<GlobalStyles>) => {
    console.log('🔍 [resizeSmartObject] CALLED', { groupName: group?.name, w, h, hasStyles: !!styles, splashScale: styles?.splashScale, splashOffsetY: styles?.splashOffsetY });
    
    // Reset Group Scale/Skew to ensure clean internal layout
    group.scale(1);
    group.set({ width: w, height: h });
    
    const halfW = w / 2;
    const halfH = h / 2;
    const baseSize = Math.min(w, h);
    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const objects = group.getObjects();
    console.log('🔍 [resizeSmartObject] Objects in group:', objects.length, objects.map((o: any) => o?.name));
    
    const bg = objects.find((o: any) => o.name === 'offerBackground');
    const title = objects.find((o: any) => o.name === 'smart_title');
    const limit = objects.find((o: any) =>
        o?.name === 'smart_limit' ||
        o?.name === 'limitText' ||
        o?.name === 'product_limit' ||
        o?.data?.smartType === 'product-limit'
    );
    const img = objects.find((o: any) => o.name === 'smart_image');
    // Splash can vary names; prefer the canonical price label group when present (even when nested).
    const priceGroup = getPriceGroupFromAny(group);
    console.log('🔍 [resizeSmartObject] priceGroup found:', !!priceGroup, priceGroup?.name);
    const splash = priceGroup ?? objects.find((o: any) => o.name === 'smart_price' || o.name === 'smart_splash' || (o.type === 'group' && o !== bg));
    console.log('🔍 [resizeSmartObject] splash found:', !!splash, splash?.name, splash?.type);

    // When the user moves an inner element (deep select), we mark it with `__manualTransform`.
    // During zone relayout (and on reload), we must NOT override these user placements.
    const isManual = (o: any) => !!(o && (o as any).__manualTransform);

    // If the card size changes (ex: more items in the zone, zone resize, preset change),
    // reposition manual elements proportionally so they keep their relative placement.
    const maybeRescaleManualTransforms = (o: any) => {
        if (!o || !isManual(o)) return;
        const prevW = Number((o as any).__manualTransformCardW);
        const prevH = Number((o as any).__manualTransformCardH);

        // Initialize baseline on first layout pass.
        if (!Number.isFinite(prevW) || prevW <= 0 || !Number.isFinite(prevH) || prevH <= 0) {
            (o as any).__manualTransformCardW = w;
            (o as any).__manualTransformCardH = h;
            return;
        }

        // Skip micro-deltas to avoid drift on repeated relayouts with same size.
        const dw = Math.abs(prevW - w);
        const dh = Math.abs(prevH - h);
        if (dw < 0.5 && dh < 0.5) return;

        const rx = w / prevW;
        const ry = h / prevH;
        if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;

        if (typeof o.left === 'number') o.left = o.left * rx;
        if (typeof o.top === 'number') o.top = o.top * ry;
        o.setCoords?.();

        (o as any).__manualTransformCardW = w;
        (o as any).__manualTransformCardH = h;
    };
    objects.forEach((o: any) => maybeRescaleManualTransforms(o));
    
    // 1. Background Fill
    if (bg) {
        if(bg.type === 'rect') {
             // Keep the background centered on the group origin to avoid drifting bounds/selection boxes.
             bg.set({
                 width: w,
                 height: h,
                 scaleX: 1,
                 scaleY: 1,
                 originX: 'center',
                 originY: 'center',
                 left: 0,
                 top: 0
             });

             if (styles) {
                 if (styles.isProdBgTransparent) bg.set('fill', 'transparent');
                 else if (styles.cardColor) bg.set('fill', styles.cardColor);
                 if (typeof styles.cardBorderRadius === 'number') bg.set({ rx: styles.cardBorderRadius, ry: styles.cardBorderRadius });

                 // Apply border color and width - if color is set but width is 0, use minimum visible width
                 if (styles.cardBorderColor) {
                     bg.set('stroke', styles.cardBorderColor);
                     const borderWidth = typeof styles.cardBorderWidth === 'number' ? styles.cardBorderWidth : 0;
                     // If border color is set but width is 0, use minimum visible width (1px)
                     if (borderWidth === 0 && styles.cardBorderColor) {
                         bg.set('strokeWidth', 1);
                     } else if (borderWidth > 0) {
                         bg.set('strokeWidth', borderWidth);
                     }
                 } else if (typeof styles.cardBorderWidth === 'number') {
                     bg.set('strokeWidth', styles.cardBorderWidth);
                 }
             }
        } else {
             bg.set({ scaleX: w / bg.width, scaleY: h / bg.height, left: 0, top: 0, originX: 'center', originY: 'center' });
        }
    }
    
    // 2. Title (Top)
    let titleH = 0;
    if (title) {
        // Margin Top: 5% of height
        const marginTop = h * 0.05;
        if (!isManual(title)) {
            title.set({
                originX: 'center',
                originY: 'top',
                left: 0,
                top: -halfH + marginTop,
                scaleX: 1, scaleY: 1
            });
        }

        if (styles) {
            if (styles.prodNameFont) title.set('fontFamily', styles.prodNameFont);
            if (styles.prodNameColor) title.set('fill', styles.prodNameColor);
            if (styles.prodNameWeight !== undefined) title.set('fontWeight', styles.prodNameWeight as any);
            if (styles.prodNameAlign) title.set('textAlign', styles.prodNameAlign);
            if (typeof styles.prodNameLineHeight === 'number') title.set('lineHeight', styles.prodNameLineHeight);

            const rawKey = '__rawText';
            const curText = String((title as any).text ?? '');
            if (typeof (title as any)[rawKey] !== 'string') (title as any)[rawKey] = curText;
            const mode = styles.prodNameTransform ?? 'none';
            if (mode === 'none') {
                (title as any)[rawKey] = curText;
            } else {
                const baseText = String((title as any)[rawKey] ?? curText);
                const nextText = mode === 'upper' ? baseText.toUpperCase() : mode === 'lower' ? baseText.toLowerCase() : baseText;
                if (nextText !== curText) title.set('text', nextText);
            }

            const scale = typeof styles.prodNameScale === 'number' ? styles.prodNameScale : 1;
            const baseFont = baseSize * 0.09;
            const nextFont = clamp(baseFont * scale, 10, baseSize * 0.22);
            title.set('fontSize', nextFont);
        }
        
        // Responsive Text Width
        if (title.type === 'textbox') {
            title.set({ width: w * 0.9 }); // 90% width
            if (typeof title.initDimensions === 'function') title.initDimensions();
        } else {
            // Scale down if too wide
            if (title.width > w * 0.9) {
                title.scale((w * 0.9) / title.width);
            }
        }
        if (typeof title.initDimensions === 'function') title.initDimensions();
        titleH = title.getScaledHeight() + marginTop;
    }

    // 2.1 Limit badge/text (Below Title)
    let limitH = 0;
    if (limit && String(limit.type || '').includes('text')) {
        const marginTop = h * 0.05;
        const gap = Math.max(4, h * 0.008);

        const titleHeight = title ? (title.getScaledHeight?.() ?? title.height ?? 0) : 0;
        if (!isManual(limit)) {
            limit.set({
                originX: 'center',
                originY: 'top',
                left: 0,
                top: -halfH + marginTop + titleHeight + gap,
                scaleX: 1,
                scaleY: 1
            });
        }

        if (styles) {
            if (styles.limitFont) limit.set('fontFamily', styles.limitFont);
            if (styles.limitColor) limit.set('fill', styles.limitColor);

            // Dynamic sizing: base on card size, and respect legacy `limitSize` as multiplier (default ~14).
            const mult = (typeof styles.limitSize === 'number' && styles.limitSize > 0) ? (styles.limitSize / 14) : 1;
            const baseFont = baseSize * 0.045;
            const nextFont = clamp(baseFont * mult, 8, baseSize * 0.12);
            limit.set('fontSize', nextFont);
        } else {
            // Reasonable default if older cards have this text but no styles passed
            const baseFont = baseSize * 0.045;
            limit.set('fontSize', clamp(baseFont, 8, baseSize * 0.12));
        }

        // Hide if empty
        const txt = String((limit as any).text ?? '').trim();
        limit.visible = txt.length > 0;

        if (limit.type === 'textbox') {
            limit.set({ width: w * 0.9 });
            if (typeof (limit as any).initDimensions === 'function') (limit as any).initDimensions();
        }

        if (typeof (limit as any).initDimensions === 'function') (limit as any).initDimensions();
        limitH = limit.visible ? ((limit.getScaledHeight?.() ?? 0) + gap) : 0;
    }

    // 3. Bottom Element (Splash/Price)
    let bottomH = 0;
    if (splash) {
        const marginBottom = h * 0.05;
        const splashManual = isManual(splash);

        // Extract priceBg for later use (shadow update needs pillH from layout)
        let priceBg: any = null;

        if (splash.type === 'group' && splash.name === 'priceGroup') {
            // Apply label styling overrides (local to the selected zone/design; never mutates templates).
            if (styles && typeof splash.getObjects === 'function') {
                // When a zone uses a label template, the template should be the source of truth for
                // styling (fill/stroke/roundness/fonts/colors). Keep only explicit overrides that
                // are meant to be applied on top (ex: currency color).
                const usingLabelTemplate = typeof styles.splashTemplateId === 'string' && styles.splashTemplateId.trim().length > 0;

                const parts = splash.getObjects();
                priceBg = parts.find((o: any) => o?.name === 'price_bg');
                const currencyText = parts.find((o: any) => o?.name === 'price_currency_text');
                const priceInteger = parts.find((o: any) => o?.name === 'price_integer_text');
                const priceDecimal = parts.find((o: any) => o?.name === 'price_decimal_text');
                const priceUnit = parts.find((o: any) => o?.name === 'price_unit_text');

                if (priceBg) {
                    // Apply styles to price background
                    // Priority: explicit splashFill > template fill > default
                    if (styles.splashFill) {
                        priceBg.set('fill', styles.splashFill);
                    }
                    if (typeof styles.splashRoundness === 'number') (priceBg as any).__roundness = styles.splashRoundness;
                    if (typeof styles.splashStrokeWidth === 'number') (priceBg as any).__strokeWidth = styles.splashStrokeWidth;

                    // Apply accent/splash color - always apply if set, regardless of template
                    // This allows users to override template colors with zone styles
                    const accent = styles.splashColor ?? styles.accentColor;
                    if (accent) {
                        priceBg.set('stroke', accent);
                    }
                }

                const applyTextShared = (t: any) => {
                    if (!t || !String(t.type || '').includes('text')) return;
                    // Always apply font and weight if explicitly set (overrides template)
                    if (styles.priceFont) t.set('fontFamily', styles.priceFont);
                    if (styles.priceFontWeight !== undefined) t.set('fontWeight', styles.priceFontWeight as any);

                    const mult = typeof styles.splashTextScale === 'number' ? styles.splashTextScale : 1;
                    if (typeof t.__fontScale === 'number') {
                        if (typeof t.__fontScaleBase !== 'number') t.__fontScaleBase = t.__fontScale;
                        t.__fontScale = t.__fontScaleBase * mult;
                    }
                    if (typeof t.initDimensions === 'function') t.initDimensions();
                };

                const applyPriceText = (t: any) => {
                    applyTextShared(t);
                    if (!t || !String(t.type || '').includes('text')) return;
                    // Apply text color if set (explicit override)
                    if (typeof styles.priceTextColor === 'string' && styles.priceTextColor.trim()) t.set('fill', styles.priceTextColor);
                    else if (typeof styles.splashTextColor === 'string' && styles.splashTextColor.trim()) t.set('fill', styles.splashTextColor);
                };

                const applyCurrencyText = (t: any) => {
                    applyTextShared(t);
                    if (!t || !String(t.type || '').includes('text')) return;
                    // Apply currency color if explicitly set
                    if (typeof styles.priceCurrencyColor === 'string' && styles.priceCurrencyColor.trim()) t.set('fill', styles.priceCurrencyColor);
                };

                applyCurrencyText(currencyText);
                [priceInteger, priceDecimal, priceUnit].forEach(applyPriceText);
            }

            const layout = layoutPriceGroup(splash, w, h);
            console.log('🔍 [resizeSmartObject] layoutPriceGroup result:', !!layout, layout ? { pillH: layout.pillH } : 'null');

            if (layout) {
                const { pillH } = layout;
                const scale = typeof styles?.splashScale === 'number' ? styles!.splashScale! : 1;
                const offsetY = typeof styles?.splashOffsetY === 'number' ? styles!.splashOffsetY! : 0;
                console.log('🔍 [resizeSmartObject] Applying styles to splash:', { scale, offsetY, splashManual });

                // Update shadow color to match accent (after we have pillH for proper blur calculation)
                const accent = styles?.splashColor ?? styles?.accentColor;
                if (accent && priceBg && fabric?.Shadow) {
                    priceBg.set('stroke', accent);
                    const blur = Math.max(6, Math.min(26, pillH * 0.22));
                    priceBg.set('shadow', new fabric.Shadow({ color: accent, blur, offsetX: 0, offsetY: 0 }));
                }

                // Force dirty flag to ensure Fabric.js updates the object
                splash.dirty = true;
                
                if (!splashManual) {
                    const newTop = halfH - ((pillH * scale) / 2) - marginBottom + offsetY;
                    console.log('🔍 [resizeSmartObject] Setting splash position:', { left: 0, top: newTop, scale });
                    splash.set({
                        scaleX: scale,
                        scaleY: scale,
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: newTop
                    });
                } else {
                    // Manual positioning: keep left/top, but still apply the zone-level scale.
                    console.log('🔍 [resizeSmartObject] Manual mode - applying only scale:', scale);
                    splash.set({ scaleX: scale, scaleY: scale });
                }
                
                // Force coordinate update
                splash.setCoords();
                
                bottomH = (pillH * scale) + marginBottom;
                console.log('🔍 [resizeSmartObject] Splash updated, bottomH:', bottomH);
            } else {
                // Fallback to generic scaling for older cards without named parts
                // Apply global styles even in fallback mode
                const globalScale = typeof styles?.splashScale === 'number' ? styles!.splashScale! : 1;
                const offsetY = typeof styles?.splashOffsetY === 'number' ? styles!.splashOffsetY! : 0;

                // Armazenar o scale ORIGINAL (na criação), não o scale atual
                // Isso garante que o redimensionamento funcione corretamente em ambas direções
                if (typeof (splash as any).__originalScaleX !== 'number') {
                    // Primeira vez: capturar o scale atual como "original"
                    (splash as any).__originalScaleX = splash.scaleX || 1;
                    (splash as any).__originalScaleY = splash.scaleY || 1;
                }

                // Calcular scale baseado no tamanho do cartão relativo ao tamanho original
                const originalW = (splash as any).__originalCardWidth || splash.width || 100;
                const sizeRatio = w / originalW;

                // Aplicar: scale_original × ratio × globalScale
                const origScaleX = (splash as any).__originalScaleX || 1;
                const origScaleY = (splash as any).__originalScaleY || 1;
                let sScaleX = origScaleX * sizeRatio * globalScale;
                let sScaleY = origScaleY * sizeRatio * globalScale;

                // Armazenar largura original do cartão para próximos redimensionamentos
                (splash as any).__originalCardWidth = w;

                // Clamp para não ultrapassar limites
                if ((splash.width * sScaleX) > w * 0.9) {
                    const clampScale = (w * 0.9) / splash.width;
                    sScaleX = clampScale;
                    sScaleY = clampScale;
                }

                const maxSplashH = h * 0.35;
                if ((splash.height * sScaleY) > maxSplashH) {
                    const clampScale = maxSplashH / splash.height;
                    sScaleX = clampScale;
                    sScaleY = clampScale;
                }

                console.log('🔍 [resizeSmartObject] Fallback - Applying scale:', { origScaleX, sizeRatio, globalScale, sScaleX, sScaleY, offsetY });

                // Force dirty flag to ensure Fabric.js updates the object
                splash.dirty = true;

                if (!splashManual) {
                    const newTop = halfH - marginBottom + offsetY;
                    console.log('🔍 [resizeSmartObject] Fallback - Setting position:', { left: 0, top: newTop, sScaleX, sScaleY });
                    splash.set({
                        scaleX: sScaleX,
                        scaleY: sScaleY,
                        originX: 'center',
                        originY: 'bottom',
                        left: 0,
                        top: newTop
                    });
                } else {
                    splash.set({ scaleX: sScaleX, scaleY: sScaleY });
                }

                // Force coordinate update
                splash.setCoords();

                bottomH = (splash.height * sScaleY) + marginBottom;
                console.log('🔍 [resizeSmartObject] Fallback - Splash updated, bottomH:', bottomH);
            }
        } else {
            // Max height for splash: 30% of card
            const maxSplashH = h * 0.35;
            
            // Scale splash to fit width or max height
            let sScale = splash.scaleX; // Use current or reset? Better maintain relative scale if possible, or reset.
            // Assuming splash starts at scale 1 relative to card creation size...
            // But users scale splash individually.
            // Let's rely on bounding Width relative to W.
            
            // Fit width (90%)
            if ((splash.width * sScale) > w * 0.9) {
                sScale = (w * 0.9) / splash.width;
            }
            
            // Check height Constraint
            if ((splash.height * sScale) > maxSplashH) {
                sScale = maxSplashH / splash.height;
            }
            
            if (!splashManual) {
                splash.set({
                    scaleX: sScale,
                    scaleY: sScale,
                    originX: 'center',
                    originY: 'bottom',
                    left: 0,
                    top: halfH - marginBottom
                });
            }
            
            bottomH = (splash.height * sScale) + marginBottom;
        }

        // If the user positioned the splash manually, reserve space based on its current size,
        // not the auto-layout computation above (prevents image layout from hiding it).
        if (splashManual) {
            const sh = typeof splash.getScaledHeight === 'function'
                ? splash.getScaledHeight()
                : (Number(splash.height || 0) * Number(splash.scaleY || 1));
            bottomH = Math.max(0, Number(sh) || 0) + marginBottom;
        }
    }
    
    // 4. Image (Middle - Object Fit: Contain)
    if (img) {
        const imgManual = isManual(img);
        const availH = h - titleH - limitH - bottomH - 20; // 20px buffer
        const availW = w * 0.9;
        
        if (availH > 20) {
            // Restore scale 1 to measure
            const currentScale = img.scaleX; 
            // We use raw img.width/height assuming scale=1 is base assets.
            
            const iW = img.width;
            const iH = img.height;
            const iRatio = iW / iH;
            const availRatio = availW / availH;
            
            let scale = 1;
            if (iRatio > availRatio) {
                // Width constrained
                scale = availW / iW;
            } else {
                // Height constrained
                scale = availH / iH;
            }
            
            // Center in available space
            // Space starts at: -halfH + titleH
            // Space center: (-halfH + titleH) + (availH / 2)
            const centerY = (-halfH + titleH + limitH) + (availH / 2);
            
            img.visible = true;
            if (!imgManual) {
                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: centerY
                });
            }
        } else {
            // Hide only when auto-layout controls the image; a manual image should remain visible.
            if (!imgManual) img.visible = false;
            else img.visible = true;
        }
    }

    // Keep user-positioned inner elements inside the card bounds after any resize/relayout.
    // This avoids "teleporting" on reload when the card size changes (zone preset/columns/etc.).
    const clampChildToCard = (obj: any) => {
        if (!obj || typeof obj.getScaledWidth !== 'function' || typeof obj.getScaledHeight !== 'function') return;
        const objW = obj.getScaledWidth();
        const objH = obj.getScaledHeight();
        let minX = -halfW;
        let maxX = halfW;
        let minY = -halfH;
        let maxY = halfH;
        if (obj.originX === 'center') { minX = -halfW + objW / 2; maxX = halfW - objW / 2; }
        else if (obj.originX === 'left') { maxX = halfW - objW; }
        if (obj.originY === 'center') { minY = -halfH + objH / 2; maxY = halfH - objH / 2; }
        else if (obj.originY === 'top') { maxY = halfH - objH; }
        if (minX > maxX) { const t = minX; minX = maxX; maxX = t; }
        if (minY > maxY) { const t = minY; minY = maxY; maxY = t; }
        if (typeof obj.left === 'number') obj.left = Math.min(maxX, Math.max(minX, obj.left));
        if (typeof obj.top === 'number') obj.top = Math.min(maxY, Math.max(minY, obj.top));
        obj.setCoords?.();
    };
    objects.forEach((o: any) => {
        if (!o || o === bg) return;
        if (isManual(o)) clampChildToCard(o);
    });

    // Ensure stacking order stays predictable (image should not hide the title).
    // We reorder via the internal array to avoid coordinate transforms from remove/add.
    const stackList = (group as any)?._objects;
    if (Array.isArray(stackList)) {
        const moveToIndex = (obj: any, index: number) => {
            if (!obj) return;
            const from = stackList.indexOf(obj);
            if (from === -1) return;
            stackList.splice(from, 1);
            const to = Math.max(0, Math.min(index, stackList.length));
            stackList.splice(to, 0, obj);
        };
        const moveToEnd = (obj: any) => moveToIndex(obj, stackList.length);
        moveToIndex(bg, 0);
        moveToIndex(img, 1);
        moveToEnd(title);
        moveToEnd(splash);
        if (typeof (group as any)._onStackOrderChanged === 'function') {
            (group as any)._onStackOrderChanged();
        }
    }
    
    (group as any)._cardWidth = w;
    (group as any)._cardHeight = h;
    safeAddWithUpdate(group);
}

const getZoneRect = (zone: any) => {
    if (!zone) return null;
    if (zone.type === 'rect') return zone;
    if (typeof zone.getObjects !== 'function') return null;
    const objs = zone.getObjects() || [];
    return (
        objs.find((o: any) => o.type === 'rect' && (o.name === 'zoneRect' || o.name === 'zone-border' || Array.isArray(o.strokeDashArray))) ||
        objs.find((o: any) => o.type === 'rect') ||
        null
    );
}

const isLikelyProductZone = (obj: any) => {
    if (!obj) return false;
    if (obj.isGridZone || obj.isProductZone) return true;
    if (obj.name === 'gridZone' || obj.name === 'productZoneContainer') return true;
    // CRITICAL: Detect zones via zone-specific custom properties that survive serialization.
    // This catches legacy arts where flags were not originally in CANVAS_CUSTOM_PROPS.
    if (typeof obj._zonePadding === 'number' && typeof obj._zoneWidth === 'number' && typeof obj._zoneHeight === 'number') return true;
    if (obj.type !== 'group') return false;
    const rect = getZoneRect(obj);
    return !!(rect && Array.isArray(rect.strokeDashArray));
}

const isLikelyProductCard = (obj: any) => {
    if (!obj) return false;
    if (obj.excludeFromExport) return false;
    if (obj.isFrame) return false;
    if (isLikelyProductZone(obj)) return false;
    if (obj.type !== 'group' || typeof obj.getObjects !== 'function') return false;
    // A standalone label template inserted to canvas is usually the "priceGroup" itself.
    if (String(obj.name || '') === 'priceGroup') return false;

    // If it already has a zone binding, treat as a product card (legacy-safe).
    const pz = String((obj as any).parentZoneId || '').trim();
    if (pz) return true;

    // Strong signals from our engine (even in older saves).
    const cw = Number((obj as any)._cardWidth);
    const ch = Number((obj as any)._cardHeight);
    if (Number.isFinite(cw) && cw > 0 && Number.isFinite(ch) && ch > 0) return true;
    if (String((obj as any).smartGridId || '').trim()) return true;
    if (String((obj as any).priceMode || '').trim()) return true;

    const children = obj.getObjects() || [];
    if (!children.length) return false;

    const isText = (o: any) => String(o?.type || '').toLowerCase().includes('text');
    const hasOfferBg = children.some((c: any) => String(c?.name || '') === 'offerBackground');
    const hasBg = hasOfferBg || children.some((c: any) => String(c?.type || '').toLowerCase() === 'rect' && /(offerBackground|background|bg)/i.test(String(c?.name || '')));
    const hasPriceGroup = children.some((c: any) => String(c?.type || '').toLowerCase() === 'group' && String(c?.name || '') === 'priceGroup');
    const hasAnyPriceText = children.some((c: any) => /price_(integer|decimal|value|currency|unit)_text/i.test(String(c?.name || '')));
    const hasImage = children.some((c: any) => {
        const t = String(c?.type || '').toLowerCase();
        const n = String(c?.name || '');
        return t === 'image' || ['smart_image', 'product_image', 'productImage'].includes(n);
    });
    const hasTitle = children.some((c: any) => isText(c) && /(^smart_title$|^title$|title)/i.test(String(c?.name || '')));
    const textCount = children.filter((c: any) => isText(c)).length;
    const nonTextCount = children.length - textCount;

    // Super-forte: o retângulo de fundo padrão do card.
    if (hasOfferBg) return true;
    // Forte: templates normalmente sempre têm o priceGroup.
    if (hasPriceGroup && (hasImage || hasTitle || textCount >= 1)) return true;

    // Heurística mais permissiva para cards montados manualmente:
    // se for um grupo (não-zone) com texto + algum elemento visual, tratamos como card.
    if (textCount >= 1 && nonTextCount >= 1 && (hasImage || hasBg || hasAnyPriceText)) return true;

    // Most cards have an embedded priceGroup. Require at least 2 signals to avoid false positives.
    const signals = [hasPriceGroup, hasImage, hasTitle, hasBg, hasAnyPriceText].filter(Boolean).length;
    if (hasAnyPriceText && hasImage && textCount >= 1) return true;
    return signals >= 3 || (hasAnyPriceText && textCount >= 2);
}

const ensureZoneSanity = (zone: any) => {
    if (!zone) return;
    if (!zone._customId) zone._customId = Math.random().toString(36).substr(2, 9);
    let needsBoundsUpdate = false;

    // CRITICAL: Product zones should NOT have clipPath as it causes rendering errors
    // Cards are added separately to canvas, not as children of the zone group
    if (zone.clipPath) {
        zone.clipPath = null;
    }

    // Keep Fabric group padding at 0 to avoid inflating the selection bounds.
    // Use `_zonePadding` for layout math instead (used by recalculateZoneLayout).
    if (typeof zone._zonePadding !== 'number') {
        const currentPad = typeof zone.padding === 'number' ? zone.padding : 0;
        // Legacy zones used `group.padding` for layout; older defaults used 5 just for selection padding.
        zone._zonePadding = currentPad >= 10 ? currentPad : 20;
    }
    if (zone.padding !== 0) {
        zone.set('padding', 0);
        needsBoundsUpdate = true;
    }

    // CRITICAL: Initialize _zoneWidth and _zoneHeight if missing (for persistence after reload)
    // This ensures the zone dimensions are correctly restored from the inner rect or calculated bounds
    if (typeof zone._zoneWidth !== 'number' || typeof zone._zoneHeight !== 'number') {
        const rect = typeof zone.getObjects === 'function' 
            ? zone.getObjects().find((o: any) => o?.type === 'rect') 
            : null;
        const rectWidth = rect ? (rect.width ?? 0) * (rect.scaleX ?? 1) : 0;
        const rectHeight = rect ? (rect.height ?? 0) * (rect.scaleY ?? 1) : 0;
        const zoneScaleX = Math.abs(zone.scaleX ?? 1);
        const zoneScaleY = Math.abs(zone.scaleY ?? 1);
        
        if (typeof zone._zoneWidth !== 'number') {
            zone._zoneWidth = rectWidth ? rectWidth * zoneScaleX : (zone.getScaledWidth?.() ?? zone.width ?? 400);
        }
        if (typeof zone._zoneHeight !== 'number') {
            zone._zoneHeight = rectHeight ? rectHeight * zoneScaleY : (zone.getScaledHeight?.() ?? zone.height ?? 600);
        }
        console.log('🔧 [ensureZoneSanity] Initialized zone dimensions:', { _zoneWidth: zone._zoneWidth, _zoneHeight: zone._zoneHeight });
    }

    // Ensure stable interaction flags
    zone.set({
        lockScalingFlip: true,
        objectCaching: false,
        statefullCache: false,
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        subTargetCheck: false
    });

    // Normalize the inner rect scale so it always matches the group bounds while scaling.
    const rect = getZoneRect(zone);
    if (rect) {
        const sx = rect.scaleX ?? 1;
        const sy = rect.scaleY ?? 1;
        if (sx !== 1 || sy !== 1) {
            rect.set({
                width: (rect.width ?? 0) * sx,
                height: (rect.height ?? 0) * sy,
                scaleX: 1,
                scaleY: 1
            });
            needsBoundsUpdate = true;
        }
        rect.set({
            selectable: false,
            evented: false,
            strokeUniform: true
        });
    }

    if (needsBoundsUpdate) safeAddWithUpdate(zone);
    zone.setCoords();
}

const getZoneMetrics = (zone: any) => {
    if (!zone) return null;
    
    // CRITICAL: Prefer _zoneWidth/_zoneHeight when available (persisted dimensions)
    // This ensures correct layout after reload even if Fabric bounds are not yet updated
    let width = 0;
    let height = 0;
    
    if (typeof zone._zoneWidth === 'number' && zone._zoneWidth > 0 &&
        typeof zone._zoneHeight === 'number' && zone._zoneHeight > 0) {
        width = zone._zoneWidth;
        height = zone._zoneHeight;
    } else {
        const rect = getZoneRect(zone);
        const rectScaleX = rect?.scaleX ?? 1;
        const rectScaleY = rect?.scaleY ?? 1;
        const baseWidth = rect?.width ? rect.width * rectScaleX : zone.width;
        const baseHeight = rect?.height ? rect.height * rectScaleY : zone.height;
        const scaleX = Math.abs(zone.scaleX ?? 1);
        const scaleY = Math.abs(zone.scaleY ?? 1);
        width = baseWidth ? baseWidth * scaleX : zone.getScaledWidth?.() ?? 0;
        height = baseHeight ? baseHeight * scaleY : zone.getScaledHeight?.() ?? 0;
    }
    
    if (!width || !height) {
        const fallback = zone.getBoundingRect ? zone.getBoundingRect(true) : { left: zone.left ?? 0, top: zone.top ?? 0, width: 0, height: 0 };
        return {
            left: fallback.left,
            top: fallback.top,
            width: fallback.width,
            height: fallback.height,
            centerX: fallback.left + (fallback.width / 2),
            centerY: fallback.top + (fallback.height / 2)
        };
    }
    const center = zone.getCenterPoint ? zone.getCenterPoint() : { x: zone.left ?? 0, y: zone.top ?? 0 };
    return {
        left: center.x - (width / 2),
        top: center.y - (height / 2),
        width,
        height,
        centerX: center.x,
        centerY: center.y
    };
}

const getZoneChildren = (zone: any) => {
    if (!canvas.value || !zone) return [];
    
    const objs = canvas.value.getObjects();
    const zoneBounds = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
    const margin = (() => {
        const pad = typeof (zone as any)._zonePadding === 'number' ? (zone as any)._zonePadding : 20;
        const base = Math.min(zoneBounds.width || 0, zoneBounds.height || 0);
        // Small tolerance to keep legacy cards attached after reload (prevents "zone moves alone").
        return Math.max(60, Math.min(220, pad + base * 0.12));
    })();
    
    return objs.filter((o: any) => {
        if (o === zone) return false;

        if (o.visible === false) return false;

        // If object is explicitly bound to this zone, accept it even if flags/heuristics are missing.
        const zoneId = String((zone as any)?._customId || '').trim();
        const boundId = String((o as any)?.parentZoneId || '').trim();
        if (zoneId && boundId && boundId === zoneId) {
            if ((o as any).excludeFromExport) return false;
            if ((o as any).isFrame) return false;
            if (isLikelyProductZone(o)) return false;
            if (o.type !== 'group' || typeof o.getObjects !== 'function') return false;
            if (String(o.name || '') === 'priceGroup') return false;
            return true;
        }

        const isCard = !!(o.isProductCard || o.isSmartObject || isLikelyProductCard(o));
        if (!isCard) return false;

        // Upgrade legacy card objects (old saves) so the rest of the engine can rely on flags.
        if (!o.isProductCard && !o.isSmartObject && isLikelyProductCard(o)) {
            o.isProductCard = true;
            o.isSmartObject = true;
            // Single-click deep select: user can click directly on inner elements.
            o.subTargetCheck = true;
            o.interactive = true;
            o.selectable = true;
            o.evented = true;
            // Ensure inner elements are selectable with controls
            if (typeof o.getObjects === 'function') {
                o.getObjects().forEach((child: any) => {
                    const isBackground = child.name === 'offerBackground' || child.name === 'price_bg';
                    child.selectable = !isBackground;
                    child.evented = !isBackground;
                    child.hasControls = !isBackground;
                    child.hasBorders = !isBackground;
                });
            }
            if (typeof o.setCoords === 'function') o.setCoords();
        }
        
        if (o.parentZoneId === zone._customId) return true;
        
        const objBounds = o.getBoundingRect();
        const isInside = 
            objBounds.left >= zoneBounds.left &&
            objBounds.top >= zoneBounds.top &&
            objBounds.left + objBounds.width <= zoneBounds.left + zoneBounds.width &&
            objBounds.top + objBounds.height <= zoneBounds.top + zoneBounds.height;

        // Legacy tolerance: consider "near inside" so a slightly offset card still belongs to the zone.
        const center = typeof o.getCenterPoint === 'function'
            ? o.getCenterPoint()
            : { x: (o.left ?? 0), y: (o.top ?? 0) };
        const nearInside =
            center.x >= (zoneBounds.left - margin) &&
            center.x <= (zoneBounds.left + zoneBounds.width + margin) &&
            center.y >= (zoneBounds.top - margin) &&
            center.y <= (zoneBounds.top + zoneBounds.height + margin);
        
        const intersects = zone.intersectsWithObject(o);
        if (isInside || intersects || nearInside) {
            o.parentZoneId = zone._customId;
            return true;
        }
        
        return false;
    });
}

const moveZoneChildren = (zone: any, dx: number, dy: number, children?: any[]) => {
    if (!zone || (!dx && !dy)) return;
    const list = children && children.length > 0 ? children : getZoneChildren(zone);
    list.forEach((child: any) => {
        child.set({
            left: child.left + dx,
            top: child.top + dy
        });
        child.setCoords();
    });
}

const normalizeZoneScale = (zone: any) => {
    if (!zone || !zone.getObjects) return;
    if (zone.scaleX === 1 && zone.scaleY === 1) return;
    applyZoneScaleToRect(zone);
}

const applyZoneScaleToRect = (zone: any, minSize = 60) => {
    if (!zone || !zone.getObjects) return null;
    const zoneRect = zone.getObjects().find((o: any) => o.type === 'rect');
    if (!zoneRect) return null;

    const nextWidth = Math.max(minSize, Math.abs(zone.getScaledWidth?.() ?? 0));
    const nextHeight = Math.max(minSize, Math.abs(zone.getScaledHeight?.() ?? 0));
    if (!nextWidth || !nextHeight) return null;

    zoneRect.set({
        width: nextWidth,
        height: nextHeight,
        scaleX: 1,
        scaleY: 1
    });

    zone.set({
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false
    });

    safeAddWithUpdate(zone);
    zone.setCoords();
    zone._zoneWidth = nextWidth;
    zone._zoneHeight = nextHeight;
    return { width: nextWidth, height: nextHeight };
}

/**
 * Normaliza o scale de retângulos após redimensionamento.
 * Converte scaleX/scaleY em width/height reais e preserva o border-radius proporcional.
 * Igual ao Figma: usa dimensões reais em vez de scale para evitar distorção dos cantos.
 */
const normalizeRectScale = (obj: any, minSize = 1) => {
    if (!obj) return;

    // Apenas para retângulos (rect, Rect)
    if (obj.type !== 'rect') return;

    // Se não há scale para normalizar, retorna
    if (obj.scaleX === 1 && obj.scaleY === 1) return;

    const newWidth = Math.max(minSize, Math.abs(obj.getScaledWidth?.() ?? (obj.width * obj.scaleX)));
    const newHeight = Math.max(minSize, Math.abs(obj.getScaledHeight?.() ?? (obj.height * obj.scaleY)));

    // Calcular o novo border-radius proporcional, limitado a metade da menor dimensão
    // Isso evita cantos quebrados e mantém a aparência visual consistente
    const originalRx = obj.rx || 0;
    const originalRy = obj.ry || 0;

    // Fator de escala aplicado
    const scaleFatorX = newWidth / obj.width;
    const scaleFatorY = newHeight / obj.height;

    // Novo radius proporcional (média dos fatores de escala para manter aparência)
    const newRadius = Math.min(
        (originalRx * Math.max(scaleFatorX, scaleFatorY)),
        newWidth / 2,
        newHeight / 2
    );

    obj.set({
        width: newWidth,
        height: newHeight,
        rx: newRadius,
        ry: newRadius,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false
    });

    obj.setCoords();
    return { width: newWidth, height: newHeight, rx: newRadius, ry: newRadius };
};

/**
 * Normaliza o scale de grupos que contêm retângulos com border-radius.
 * Percorre todos os objetos dentro do grupo e normaliza os retângulos.
 */
const normalizeGroupRects = (group: any) => {
    if (!group || !group.getObjects || group.type !== 'group') return;

    const objects = group.getObjects();
    if (!Array.isArray(objects)) return;

    objects.forEach((obj: any) => {
        if (obj.type === 'rect') {
            normalizeRectScale(obj);
        } else if (obj.type === 'group') {
            // Recursivo para grupos aninhados
            normalizeGroupRects(obj);
        }
    });
};

const stableHash32 = (s: string): number => {
    // FNV-1a 32-bit hash (stable across sessions).
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

const getZoneHighlightPredicate = (zone: any, cards: any[]) => {
    const count = Array.isArray(cards) ? cards.length : 0;
    const rawCount = Number((zone as any)?.highlightCount ?? 0);
    const want = Math.max(0, Math.min(count, Math.round(Number.isFinite(rawCount) ? rawCount : 0)));
    const rawMult = Number((zone as any)?.highlightHeight ?? 1);
    const mult = Math.max(1, Math.min(4, Number.isFinite(rawMult) ? rawMult : 1));
    const pos = String((zone as any)?.highlightPos ?? 'first').toLowerCase();

    if (!want || mult <= 1) {
        return { count: 0, mult: 1, isHighlighted: (_card: any, _index: number) => false };
    }

    // Random = stable per-zone/per-card identity (does NOT reshuffle every relayout).
    if (pos === 'random') {
        const zoneId = String((zone as any)?._customId ?? 'zone');
        const scored = cards.map((c: any, idx: number) => {
            const id = String(c?._customId ?? c?.id ?? idx);
            return { id, score: stableHash32(`${zoneId}:${id}`) };
        });
        scored.sort((a, b) => a.score - b.score);
        const picked = scored.slice(0, want);
        const idSet = new Set<string>(picked.map(p => p.id));
        return {
            count: want,
            mult,
            isHighlighted: (card: any, index: number) => idSet.has(String(card?._customId ?? card?.id ?? index))
        };
    }

    if (pos === 'last') {
        return {
            count: want,
            mult,
            isHighlighted: (_card: any, index: number) => index >= (count - want)
        };
    }

    // Default = first
    return {
        count: want,
        mult,
        isHighlighted: (_card: any, index: number) => index < want
    };
};

const recalculateZoneLayout = (zone: any, cachedChildren?: any[], opts: { save?: boolean } = {}) => {
    if (!zone || !canvas.value) return;
    const shouldSave = opts.save !== false;
    
    // 1. Find cards in zone (Use cache if available for performance)
    const cardMap = new Map<any, any>();
    (cachedChildren || []).forEach((card: any) => {
        const key = card._customId ?? card.id ?? card;
        cardMap.set(key, card);
    });
    
    getZoneChildren(zone).forEach((card: any) => {
        const key = card._customId ?? card.id ?? card;
        cardMap.set(key, card);
    });
    
    let cards = Array.from(cardMap.values());
    
    if (cards.length === 0) return;
    
    // 2. Sort by stable zone order when available, otherwise fall back to visual order.
    const hasAllOrders = cards.every((c: any) => Number.isFinite((c as any)._zoneOrder));
    if (hasAllOrders) {
        cards.sort((a: any, b: any) => ((a as any)._zoneOrder ?? 0) - ((b as any)._zoneOrder ?? 0));
    } else {
        cards.sort((a: any, b: any) => {
            const rowDiff = (a.top ?? 0) - (b.top ?? 0);
            if (Math.abs(rowDiff) > 50) return rowDiff; // Same row tolerance
            return (a.left ?? 0) - (b.left ?? 0);
        });
        cards.forEach((c: any, i: number) => ((c as any)._zoneOrder = i));
    }
    
    // 3. Setup Grid Vars
    const zoneRect = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
    
    const padding = typeof zone._zonePadding === 'number' ? zone._zonePadding : (zone.padding ?? 20);
    const gapX = zone.gapHorizontal ?? padding;
    const gapY = zone.gapVertical ?? padding;
    // Default to `fill` so the grid always uses the full zone width (no empty space).
    const lastRowBehavior = zone.lastRowBehavior || 'fill'; 
    const layoutDirection = zone.layoutDirection || 'horizontal';
    const verticalAlign = zone.verticalAlign || 'top';
    const stylesToApply: Partial<GlobalStyles> = (zone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value;
    
    const count = cards.length;
    
    const zoneConfig: ProductZone = {
        x: zoneRect.left,
        y: zoneRect.top,
        width: zoneRect.width,
        height: zoneRect.height,
        padding,
        gapHorizontal: gapX,
        gapVertical: gapY,
        columns: typeof zone.columns === 'number' ? zone.columns : 0,
        rows: typeof zone.rows === 'number' ? zone.rows : 0,
        cardAspectRatio: zone.cardAspectRatio ?? 'auto',
        lastRowBehavior: lastRowBehavior
    };
    
    const { cols, rows, itemWidth, itemHeight } = calculateGridLayout(zoneConfig, count);
    let itemW = itemWidth;
    let itemH = itemHeight;
    
    // Effective usable area
    const usableW = Math.max(0, zoneRect.width - (padding * 2));
    const usableH = Math.max(0, zoneRect.height - (padding * 2));
    
    // Safety Limits
    itemW = Math.max(50, itemW);
    itemH = Math.max(50, itemH);
    
    // 4. Layout Execution
    const startX = zoneRect.left + padding;
    let startY = zoneRect.top + padding;

    // Highlights: allow a few items to be taller (featured) without breaking the grid.
    // Rows that contain any highlighted card get a taller row height, but only the highlighted cards expand.
    const safeRows = Math.max(1, rows);
    const hl = getZoneHighlightPredicate(zone, cards);
    const rowHasHighlight = new Array<boolean>(rows).fill(false);
    if (hl.count > 0 && hl.mult > 1) {
        for (let i = 0; i < count; i++) {
            if (!hl.isHighlighted(cards[i], i)) continue;
            const r = layoutDirection === 'vertical' ? (i % safeRows) : Math.floor(i / cols);
            if (r >= 0 && r < rows) rowHasHighlight[r] = true;
        }
    }
    const highlightRowCount = rowHasHighlight.filter(Boolean).length;

    const gapTotalH = (rows - 1) * gapY;
    const denom = rows + (highlightRowCount * (hl.mult - 1));
    const maxBaseH = (rows > 0 && denom > 0) ? ((usableH - gapTotalH) / denom) : itemH;

    // Base height is the "normal" card height (non-highlight). Highlighted cards are baseH * hl.mult.
    // - `stretch`: fill the vertical space.
    // - others: never exceed the computed itemHeight (keeps aspect ratio preference when possible).
    let baseH = itemH;
    if (verticalAlign === 'stretch') baseH = maxBaseH;
    else baseH = Math.min(baseH, maxBaseH);
    baseH = Math.max(50, baseH);

    const rowHeights = new Array<number>(rows).fill(baseH);
    for (let r = 0; r < rows; r++) {
        if (rowHasHighlight[r]) rowHeights[r] = baseH * hl.mult;
    }

    // Align the full grid vertically inside the zone when there's leftover space (e.g., fixed aspect ratio).
    const usedGridH = rowHeights.reduce((sum, h) => sum + h, 0) + gapTotalH;
    if (verticalAlign === 'center') {
        startY += Math.max(0, (usableH - usedGridH) / 2);
    } else if (verticalAlign === 'bottom') {
        startY += Math.max(0, usableH - usedGridH);
    }

    const rowTops: number[] = [startY];
    for (let r = 1; r < rows; r++) {
        rowTops[r] = rowTops[r - 1]! + (rowHeights[r - 1] ?? baseH) + gapY;
    }
    
    cards.forEach((card: any, index: number) => {
        // Bind to zone
        card.parentZoneId = zone._customId;
        const col = layoutDirection === 'vertical'
            ? Math.floor(index / safeRows)
            : (index % cols);
        const row = layoutDirection === 'vertical'
            ? (index % safeRows)
            : Math.floor(index / cols);
        const isHighlighted = hl.isHighlighted(card, index);
        const slotH = rowHeights[row] ?? baseH;
        const cardH = isHighlighted ? (baseH * hl.mult) : baseH;
        const rowTop = rowTops[row] ?? startY;

        const isLastRow = layoutDirection !== 'vertical' && row === rows - 1;
        const itemsInRow = isLastRow ? (count % cols || cols) : cols;
        const shouldFillRow = isLastRow && (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') && itemsInRow < cols;
        const rowItemW = shouldFillRow
            ? Math.max(50, (usableW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow))
            : itemW;
        const slotW = (layoutDirection === 'vertical' ? itemW : rowItemW);

        // Base Position
        let x = startX + (col * (slotW + gapX));

        // Last Row Logic (Horizontal Fill Order)
        if (isLastRow && lastRowBehavior === 'center' && itemsInRow < cols) {
            const rowWidth = (itemsInRow * itemW) + ((itemsInRow - 1) * gapX);
            const remainingSpace = usableW - rowWidth;
            x += remainingSpace / 2;
        }

        const centerX = x + (slotW / 2);
        // Align cards to the top of the row so highlights feel like true "featured" items.
        const centerY = rowTop + (cardH / 2);

        // Store slot bounds for optional tooling/debugging and future constraints.
        (card as any)._zoneSlot = { zoneId: zone._customId, left: x, top: rowTop, width: slotW, height: slotH };
        
        // Resize & Position
        if (card.isSmartObject || card.name?.startsWith('product-card')) {
             resizeSmartObject(card, rowItemW, cardH, stylesToApply);
             card.set({
                 left: centerX,
                 top: centerY,
                 originX: 'center',
                 originY: 'center',
                 scaleX: 1, 
                 scaleY: 1
             });
        } else {
             card.set({
                 left: centerX,
                 top: centerY,
                 originX: 'center',
                 originY: 'center',
                 scaleX: itemW / card.width,
                 scaleY: cardH / card.height
             });
        }

        card.setCoords();
    });
    
    canvas.value.requestRenderAll();
    if (shouldSave) saveCurrentState();
}

const rehydrateCanvasZones = (opts: { relayout?: boolean } = {}) => {
    if (!canvas.value) return;
    const relayout = opts.relayout !== false;

    const prevHistory = isHistoryProcessing.value;
    isHistoryProcessing.value = true;
    try {
        const objs = canvas.value.getObjects();

        // Ensure IDs exist (used for parentZoneId mapping and selection)
        objs.forEach((o: any) => {
            if (!o._customId) o._customId = Math.random().toString(36).substr(2, 9);
        });

        // CRITICAL: Clear clipPath from all product zones to prevent rendering errors
        // Product zones should not have clipPath as cards are added separately to canvas
        objs.forEach((o: any) => {
            if (o.clipPath && (o.isGridZone || o.isProductZone || o.name === 'gridZone' || o.name === 'productZoneContainer')) {
                o.clipPath = null;
            }
            // CRITICAL: Ensure all remaining clipPaths have _objects initialized
            // This prevents "forEach of undefined" errors in fabric.js createClipPathLayer
            if (o.clipPath && o.clipPath._objects === undefined) {
                o.clipPath._objects = [];
            }

            // CRITICAL: Normalize product cards to Canva-like behavior:
            // - Default: select/move the whole card (subTargetCheck OFF)
            // - Double click: enable deep select for inner elements (handled elsewhere)
            // Also supports legacy projects where flags were not serialized yet (heuristic-based detection).
            const isCardLike = (o.isProductCard || o.isSmartObject || isLikelyProductCard(o)) && o.type === 'group' && String(o.name || '') !== 'priceGroup';
            if (isCardLike) {
                if (!o.isProductCard && !o.isSmartObject && isLikelyProductCard(o)) {
                    o.isProductCard = true;
                    o.isSmartObject = true;
                }

                // Normalize origin to center for stable containment math.
                try {
                    const cp = typeof o.getCenterPoint === 'function'
                        ? o.getCenterPoint()
                        : { x: (o.left ?? 0), y: (o.top ?? 0) };
                    if (o.originX !== 'center' || o.originY !== 'center') {
                        o.set({ originX: 'center', originY: 'center', left: cp.x, top: cp.y });
                    }
                } catch (e) {
                    // ignore
                }
                // Single-click deep select: user can click directly on inner elements.
                if (o.subTargetCheck !== true) o.subTargetCheck = true;
                if (o.interactive !== true) o.interactive = true;
                if (o.selectable !== true) o.selectable = true;
                if (o.evented !== true) o.evented = true;
                // Ensure internal elements are selectable with controls
                if (typeof o.getObjects === 'function') {
                    o.getObjects().forEach((child: any) => {
                        const isBackground = child.name === 'offerBackground' || child.name === 'price_bg';
                        child.selectable = !isBackground;
                        child.evented = !isBackground;
                        child.hasControls = !isBackground;
                        child.hasBorders = !isBackground;
                    });
                }
            }
        });

        // Re-apply custom rendering patches (e.g. per-corner rounded rects) recursively.
        const patchTree = (o: any) => {
            if (!o) return;
            if (isRectObject(o) && o.cornerRadii) applyRectCornerRadiiPatch(o);
            // Re-apply sticker outline patch for images loaded from JSON
            if (String(o.type || '').toLowerCase() === 'image' && o.__stickerOutlineEnabled) {
                applyStickerOutlinePatch(o);
                // Images may not have their element loaded yet after loadFromJSON
                // Schedule additional retries to ensure outline is generated
                setTimeout(() => {
                    if (o.__stickerOutlineEnabled && !o.__stickerOutlineCache) {
                        applyStickerOutlinePatch(o);
                    }
                }, 1500);
                setTimeout(() => {
                    if (o.__stickerOutlineEnabled && !o.__stickerOutlineCache) {
                        applyStickerOutlinePatch(o);
                    }
                }, 4000);
            }
            if (o.type === 'group' && typeof o.getObjects === 'function') {
                o.getObjects().forEach((c: any) => patchTree(c));
            }
        };
        objs.forEach((o: any) => patchTree(o));

        const isFrameLike = (o: any) => {
            if (!o) return false;
            const nRaw = (o?.name ?? '').toString();
            const n = nRaw.toUpperCase();
            // Prefer explicit flag.
            if (o?.isFrame) return true;
            // Common legacy names.
            if (n === 'FRAME' || n === 'FRAMER' || /^FRAME\s+\d+\s*$/i.test(nRaw)) return true;
            // Heuristic for older saves where custom props were missing:
            // A Frame is a Rect with clipContent + Figma blue stroke.
            const stroke = (o?.stroke ?? '').toString().toLowerCase();
            const isRect = isRectObject(o) || o?.type === 'rect';
            if (isRect && (o?.clipContent === true || o?.clipContent === 1) && stroke === '#0d99ff') return true;
            return false;
        };

        // Frames: restore flags + clip behavior
        const frames = objs.filter((o: any) => isFrameLike(o));

        // Normalize default Frame names (Figma-like): Frame 1, Frame 2, ...
        // Only touch frames that were never explicitly renamed (no layerName) and have a generic name.
        let maxFrameN = 0;
        frames.forEach((f: any) => {
            const n = (f?.layerName || f?.name || '').toString();
            const m = /^Frame\s+(\d+)\s*$/i.exec(n);
            if (m) maxFrameN = Math.max(maxFrameN, Number(m[1] || 0));
        });
        const nextFrameName = () => `Frame ${++maxFrameN}`;
        frames.forEach((f: any) => {
            // CRITICAL: Always restore isFrame flag (even if missing from JSON)
            f.isFrame = true;
            if (typeof f.clipContent !== 'boolean') f.clipContent = true;

            // CRITICAL: Ensure frames always have originX='center' and originY='center'
            // This prevents size jumps after reload when clipPath is recalculated
            if (f.originX !== 'center') {
                f.originX = 'center';
                f.setCoords?.();
            }
            if (f.originY !== 'center') {
                f.originY = 'center';
                f.setCoords?.();
            }
            
            // Normalize name: if user renamed via layerName, keep it. Otherwise ensure proper "Frame N" name.
            if (!f.layerName) {
                const n = (f?.name || '').toString().trim();
                const isGeneric = !n || /^frame$/i.test(n) || /^framer$/i.test(n) || /^ret(â|a)ngulo$/i.test(n);
                const isNumbered = /^Frame\s+\d+\s*$/i.test(n);
                if (isGeneric) {
                    // Force normalize generic names to "Frame N"
                    f.name = nextFrameName();
                    console.log(`🔄 Frame normalizado: "${n}" → "${f.name}"`);
                } else if (!isNumbered && !/^Frame\s+\d+/.test(n)) {
                    // Custom name - leave as-is but ensure it's not empty
                    if (!f.name) f.name = nextFrameName();
                }
            } else {
                // User renamed - keep layerName, but also ensure name is set for display
                if (!f.name || /^ret(â|a)ngulo$/i.test(f.name)) {
                    f.name = f.layerName;
                }
            }
            
            // Ensure stroke is Figma blue if missing (helps with detection)
            if (!f.stroke || String(f.stroke).toLowerCase() !== '#0d99ff') {
                f.stroke = '#0d99ff';
            }
            
            if (isRectObject(f) && f.cornerRadii) applyRectCornerRadiiPatch(f);
            getOrCreateFrameClipRect(f);
        });

        const frameIds = new Set<string>(frames.map((f: any) => f._customId).filter(Boolean));
        objs.forEach((o: any) => {
            if (o?.parentFrameId && !frameIds.has(o.parentFrameId)) {
                o.parentFrameId = undefined;
                if (o._frameClipOwner) {
                    o.clipPath = null;
                    delete o._frameClipOwner;
                }
            }
        });

        // CRITICAL: Clear parentFrameId for objects that are NOT inside their supposed parent frame
        // This prevents clipping issues when objects are moved outside frames
        objs.forEach((o: any) => {
            if (!o?.parentFrameId || o?.isFrame) return;
            const frame = frames.find((f: any) => f._customId === o.parentFrameId);
            if (!frame) {
                o.parentFrameId = undefined;
                if (o._frameClipOwner) {
                    o.clipPath = null;
                    delete o._frameClipOwner;
                }
                return;
            }
            
            // Check if object center is inside frame bounds
            // CRITICAL: Use getBoundingRect() to correctly calculate bounds regardless of originX/originY
            const center = typeof o.getCenterPoint === 'function' ? o.getCenterPoint() : null;
            if (center) {
                const frameBounds = typeof frame.getBoundingRect === 'function'
                    ? frame.getBoundingRect()
                    : { left: frame.left, top: frame.top, width: frame.width * (frame.scaleX || 1), height: frame.height * (frame.scaleY || 1) };

                const isInsideFrame = center.x >= frameBounds.left &&
                                      center.x <= frameBounds.left + frameBounds.width &&
                                      center.y >= frameBounds.top &&
                                      center.y <= frameBounds.top + frameBounds.height;
                
                if (!isInsideFrame) {
                    console.log(`🔓 Removendo parentFrameId de objeto fora do frame:`, {
                        object: o.name || o._customId,
                        frame: frame.name || frame._customId
                    });
                    o.parentFrameId = undefined;
                    if (o._frameClipOwner) {
                        o.clipPath = null;
                        delete o._frameClipOwner;
                    }
                }
            }
        });

        // Re-apply clipPaths using shared frame clip rects (prevents stale deserialized clip rects).
        objs.forEach((o: any) => {
            if (o?.parentFrameId || o?._frameClipOwner) syncObjectFrameClip(o);
        });
        frames.forEach((f: any) => syncFrameClips(f));

        const zones = objs.filter((o: any) => isLikelyProductZone(o));
        zones.forEach((z: any) => {
            if (z.name === 'gridZone') z.isGridZone = true;
            if (z.name === 'productZoneContainer') z.isProductZone = true;
            if (!z.isGridZone && !z.isProductZone) z.isGridZone = true;

            // CRITICAL: Clear clipPath from zone AND all its children
            if (z.clipPath) {
                z.clipPath = null;
            }
            if (typeof z.getObjects === 'function') {
                z.getObjects().forEach((child: any) => {
                    if (child.clipPath) {
                        child.clipPath = null;
                    }
                });
            }

            // CRITICAL: Ensure zone is visible
            if (z.visible === false) z.visible = true;
            if (z.opacity === 0) z.opacity = 1;

            ensureZoneSanity(z);

            // Zones should start with no background by default.
            // Fabric defaults rect fill to black when fill is unset/undefined; we normalize using `z.backgroundColor`.
            const zr = getZoneRect(z);
            if (zr) {
                const desired = typeof (z as any).backgroundColor === 'string' ? String((z as any).backgroundColor).trim() : '';
                if (!desired || desired === 'transparent') {
                    zr.set('fill', 'transparent');
                } else {
                    zr.set('fill', desired);
                }
            }

            normalizeZoneScale(z);
            // Ensure Fabric v7 group bounds match the inner rect (prevents the "outer container" selection bug).
            safeAddWithUpdate(z);
            const zoneStyles = (z as any)._zoneGlobalStyles;
            if (zoneStyles && typeof zoneStyles === 'object') {
                applyGlobalStylesToCards(zoneStyles, z);
            }
        });

        const zonesById = new Map<string, any>();
        zones.forEach((z: any) => zonesById.set(z._customId, z));

        const cards = objs.filter((o: any) => (o?.isSmartObject || o?.isProductCard || isLikelyProductCard(o)) && o !== null && o !== undefined);

        const validZoneIds = new Set<string>(zones.map((z: any) => String(z?._customId || '').trim()).filter(Boolean));
        const hadAnyValidBinding = cards.some((c: any) => {
            const id = String(c?.parentZoneId || '').trim();
            return id && validZoneIds.has(id);
        });

        // CRITICAL: Ensure all product cards are visible and have valid properties
        cards.forEach((card: any) => {
            if (!card.isProductCard && !card.isSmartObject && isLikelyProductCard(card)) {
                card.isProductCard = true;
                card.isSmartObject = true;
            }
            // Ensure visibility
            if (card.visible === false) card.visible = true;
            if (card.opacity === 0 || card.opacity === undefined) card.opacity = 1;

            // Prevent random black rectangles: Fabric defaults rect fill to black when fill is unset/undefined.
            // If a card's background fill becomes invalid, restore a safe default.
            if (card.type === 'group' && typeof card.getObjects === 'function') {
                const bg = card.getObjects().find((c: any) => c?.name === 'offerBackground' && c?.type === 'rect');
                if (bg && (bg.fill === undefined || bg.fill === null || bg.fill === '')) {
                    bg.set('fill', 'transparent');
                }
            }

            // Ensure the card is properly initialized
            if (typeof card.setCoords === 'function') card.setCoords();
        });

        // Repair missing parentZoneId by intersection (helps after old history/undo states)
        // CRITICAL: Preserve card positions from saved data - only repair missing parentZoneId
        const cardsWithSavedParentZone = new Set<any>();
        cards.forEach((card: any) => {
            if (!card._customId) card._customId = Math.random().toString(36).substr(2, 9);
            if (card._cardWidth == null) card._cardWidth = card.width;
            if (card._cardHeight == null) card._cardHeight = card.height;

            // If card already has a valid parentZoneId from saved data, preserve it
            if (card.parentZoneId && zonesById.has(card.parentZoneId)) {
                cardsWithSavedParentZone.add(card);
                return;
            }
            
            // Only repair cards that are missing parentZoneId
            card.parentZoneId = undefined;

            const center = typeof card.getCenterPoint === 'function'
                ? card.getCenterPoint()
                : { x: (card.left ?? 0), y: (card.top ?? 0) };

            let bestZone: any = null;
            let bestD2 = Infinity;

            for (const zone of zones) {
                if (zone.intersectsWithObject && zone.intersectsWithObject(card)) {
                    card.parentZoneId = zone._customId;
                    bestZone = null;
                    bestD2 = Infinity;
                    break;
                }

                // Fallback: distance from card center to zone rect (more robust than center-to-center).
                const zm = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
                const dx = (center.x < zm.left)
                    ? (zm.left - center.x)
                    : (center.x > (zm.left + zm.width))
                        ? (center.x - (zm.left + zm.width))
                        : 0;
                const dy = (center.y < zm.top)
                    ? (zm.top - center.y)
                    : (center.y > (zm.top + zm.height))
                        ? (center.y - (zm.top + zm.height))
                        : 0;
                const d2 = (dx * dx) + (dy * dy);
                if (d2 < bestD2) {
                    bestD2 = d2;
                    bestZone = zone;
                }
            }

            // If not intersecting any zone, attach to the nearest one only if it's reasonably close.
            if (!card.parentZoneId && bestZone) {
                // If there's only one zone, legacy projects often lost the IDs entirely.
                // In that case, bind every card-like group to the single zone so the layout can be reconstructed.
                if (zones.length === 1) {
                    card.parentZoneId = bestZone._customId;
                    return;
                }

                const zm = getZoneMetrics(bestZone) ?? bestZone.getBoundingRect(true);
                const maxDim = Math.max(zm.width || 0, zm.height || 0);

                // More aggressive repair if the project has no valid bindings at all (classic "solto" legacy state).
                const base = hadAnyValidBinding ? 2.5 : 6.0;
                const maxD = Math.max(200, maxDim * base);
                if (Number.isFinite(bestD2) && bestD2 <= (maxD * maxD)) {
                    card.parentZoneId = bestZone._customId;
                }
            }
        });

        const zoneIdsWithCards = new Set<string>();
        cards.forEach((c: any) => {
            if (typeof c.parentZoneId === 'string') zoneIdsWithCards.add(c.parentZoneId);
        });
        zones.forEach((z: any) => {
            if (zoneIdsWithCards.has(z._customId)) z.isProductZone = true;
        });

        if (relayout) {
            zones.forEach((z: any) => {
                if (z.isProductZone || zoneIdsWithCards.has(z._customId)) {
                    try {
                        // CRITICAL: Only relayout if cards don't have saved positions
                        // Check if cards in this zone have valid positions from saved data
                        const zoneCards = cards.filter((c: any) => c.parentZoneId === z._customId);
                        const hasAllSavedPositions = zoneCards.every((c: any) => 
                            cardsWithSavedParentZone.has(c) && 
                            typeof c.left === 'number' && 
                            typeof c.top === 'number'
                        );
                        
                        // Skip relayout if all cards have saved positions (preserve loaded layout)
                        if (!hasAllSavedPositions) {
                            recalculateZoneLayout(z);
                        } else {
                            console.log(`📍 Preservando posições salvas dos cards na zona ${z.name || z._customId}`);
                        }
                    } catch (err) {
                        console.warn('[rehydrateCanvasZones] Failed to relayout zone', err);
                    }
                }
            });
        }

        // Ensure zones never sit above their cards (legacy saved designs sometimes have wrong stacking order).
        // If the zone is above the cards, it intercepts clicks and prevents selecting products individually.
        try {
            const c: any = canvas.value as any;
            if (typeof c.moveTo === 'function') {
                zones.forEach((z: any) => {
                    const list = canvas.value!.getObjects();
                    const zoneIndex = list.indexOf(z);
                    if (zoneIndex < 0) return;

                    const zoneCardIndices: number[] = [];
                    for (let i = 0; i < list.length; i++) {
                        const o = list[i];
                        if (!o || o === z) continue;
                        const isCard = !!(o.isSmartObject || o.isProductCard || isLikelyProductCard(o));
                        if (!isCard) continue;
                        if ((o as any).parentZoneId === z._customId) zoneCardIndices.push(i);
                    }
                    if (!zoneCardIndices.length) return;

                    const minCardIndex = Math.min(...zoneCardIndices);
                    if (!Number.isFinite(minCardIndex)) return;

                    // Keep it above artboard-bg and frames.
                    const bgIndex = list.findIndex((o: any) => o?.id === 'artboard-bg');
                    let floorIndex = bgIndex >= 0 ? bgIndex + 1 : 0;
                    for (let i = 0; i < list.length; i++) {
                        if (list[i]?.isFrame) floorIndex = Math.max(floorIndex, i + 1);
                    }

                    const targetIndex = Math.max(floorIndex, minCardIndex - 1);
                    if (zoneIndex > targetIndex) c.moveTo(z, targetIndex);
                });
            }
        } catch (e) {
            // Ignore stacking errors
        }

        // Frames sempre atrás do conteúdo (evita bloquear drag do mouse em imagens)
        ensureFramesBelowContents();

        canvasObjects.value = [...canvas.value.getObjects()];
        canvas.value.requestRenderAll();
    } finally {
        isHistoryProcessing.value = prevHistory;
    }
}

const handleRecalculateLayout = () => {
    const zone = getCurrentZoneObject();
    if (!zone) return;
    ensureZoneSanity(zone);
    recalculateZoneLayout(zone);
}


</script>

<template>
  <div class="flex flex-col h-full min-h-0 min-w-0 w-full bg-background text-foreground antialiased font-sans overflow-hidden">
      
      <ProjectManager 
        :isOpen="showProjectManager" 
        @close="showProjectManager = false"
        @load="(data) => loadCanvasData(data)"
      />

      <AiImageStudioModal
        v-model="aiStudioOpen"
        :uploads="aiStudioUploads"
        :initial="aiStudioOptions.initial"
        @created="handleAiStudioCreated"
      />

      <!-- Central Workspace -->
      <div class="flex flex-1 min-h-0 min-w-0 overflow-hidden relative bg-[#1a1a1a]">
          <!-- Left Sidebar (New Component) -->
          <SidebarLeft @insert-asset="insertAssetToCanvas" @insert-element="insertElementToCanvas" @open-menu="showProjectManager = true">
              <template #layers-panel>
                  <LayersPanel 
                      class="flex-1"
                      :objects="canvasObjects" 
                      :selectedId="selectedObjectId"
                      @select="selectObject"
                      @toggle-visible="toggleVisible"
                      @toggle-lock="toggleLock"
                      @delete="deleteObject"
                      @move-up="id => moveLayer(id, 'up')"
                      @move-down="id => moveLayer(id, 'down')"
                      @rename="renameLayer"
                  />
              </template>
          </SidebarLeft>

          <!-- Canvas Stage -->
          <main class="flex-1 min-w-0 min-h-0 relative bg-[#1a1a1a] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
              <!-- Infinite Canvas Effect (Wrapper) -->
              <div ref="wrapperEl" class="w-full h-full min-w-0 min-h-0 relative flex items-center justify-center overflow-hidden bg-[#1a1a1a]">
                  <canvas ref="canvasEl" class="block" @contextmenu.prevent.stop></canvas>
                  <ContextMenu
                    v-model="canvasContextMenu.show"
                    :x="canvasContextMenu.x"
                    :y="canvasContextMenu.y"
                    :items="canvasContextMenuItems"
                    @select="handleCanvasContextMenuSelect"
                  />
                  
                  <!-- Virtual Scrollbars (Figma Style) -->
                  <div 
                    v-show="scrollV.visible" 
                    class="absolute right-1 w-1.5 bg-white/20 hover:bg-white/40 rounded-full z-50 transition-colors cursor-pointer" 
                    :style="{ top: scrollV.top + 'px', height: scrollV.height + 'px' }"
                    @mousedown="handleVerticalScrollbarDrag"
                  ></div>
                  <div 
                    v-show="scrollH.visible" 
                                        class="absolute bottom-1 h-1.5 bg-white/20 hover:bg-white/40 rounded-full z-60 transition-colors cursor-pointer" 
                    :style="{ left: scrollH.left + 'px', width: scrollH.width + 'px' }"
                    @mousedown="handleHorizontalScrollbarDrag"
                  ></div>

                  <!-- Frame Label Overlays (clickable, always visible) -->
                  <template v-for="label in frameLabels" :key="label.id">
                    <!-- Frame Name (top-left, clickable to select/drag) -->
                    <div
                      class="absolute z-40 select-none cursor-pointer whitespace-nowrap"
                      :style="{
                        left: label.x + 'px',
                        top: label.y + 'px',
                        pointerEvents: 'auto',
                      }"
                      @mousedown.stop.prevent="handleFrameLabelMouseDown(label, $event)"
                      @click.stop.prevent="handleFrameLabelClick(label, $event)"
                      @dblclick.stop.prevent
                    >
                      <span
                        class="text-xs font-bold px-1 py-0.5 rounded transition-colors"
                        :class="label.isSelected ? 'text-[#0d99ff] bg-[#0d99ff]/10' : 'text-[#0d99ff]/60 hover:text-[#0d99ff] hover:bg-[#0d99ff]/10'"
                      >
                        {{ label.name }}
                      </span>
                    </div>
                    <!-- Frame Dimensions Badge (bottom-center) -->
                    <div
                      class="absolute z-40 select-none pointer-events-none whitespace-nowrap"
                      :style="{
                        left: label.dimX + 'px',
                        top: label.dimY + 'px',
                        transform: 'translateX(-50%)',
                      }"
                    >
                      <span
                        class="text-[11px] font-bold px-1.5 py-0.5 rounded"
                        :class="label.isSelected ? 'bg-[#0d99ff] text-white' : 'bg-[#0d99ff]/60 text-white/85'"
                      >
                        {{ label.dims }}
                      </span>
                    </div>
                  </template>

                  <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" accept="image/*" />
              </div>

              <!-- Contextual Toolbar for Vector Paths (Above Main Toolbar) -->
              <Transition>
                <div 
                  v-if="showPenContextualToolbar && selectedObjectRef?.isVectorPath"
                  class="absolute left-1/2 -translate-x-1/2 bottom-20 contextual-toolbar flex items-center gap-1 bg-[#2a2a2a] p-1.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] border border-white/10 z-40 select-none backdrop-blur-sm"
                >
                  <!-- Union/Subtract - Placeholder for future boolean operations -->
                  <button 
                    @click="() => console.log('Union - requires multiple selected paths')" 
                    title="Unir (requer múltiplos caminhos)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all opacity-50 cursor-not-allowed"
                  >
                    <Combine class="w-4 h-4" />
                  </button>
                  
                  <!-- Subtract -->
                  <button 
                    @click="() => console.log('Subtract - requires multiple selected paths')" 
                    title="Subtrair (requer múltiplos caminhos)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all opacity-50 cursor-not-allowed"
                  >
                    <Scissors class="w-4 h-4" />
                  </button>
                  
                  <div class="w-px h-6 bg-white/10 mx-0.5"></div>
                  
                  <!-- Visibility Toggle -->
                  <button 
                    @click="updateObjectProperty('visible', !selectedObjectRef.visible)" 
                    title="Alternar Visibilidade"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  >
                    <Eye class="w-4 h-4" />
                  </button>
                  
                  <!-- Edit Nodes -->
                  <button 
                    @click="handleAction('toggle-handles')" 
                    title="Editar Nós"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all"
                    :class="isNodeEditing ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'"
                  >
                    <PenTool class="w-4 h-4" />
                  </button>
                  
                  <!-- Add Point -->
                  <button 
                    @click="handleAction('add-path-point')" 
                    title="Adicionar Ponto"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  >
                    <PlusCircle class="w-4 h-4" />
                  </button>
                  
                  <!-- Delete Point -->
                  <button 
                    @click="handleAction('delete-path-point')" 
                    title="Excluir Ponto (Delete)"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                    :class="selectedPathNodeIndex === null ? 'opacity-50 cursor-not-allowed' : ''"
                  >
                    <MinusCircle class="w-4 h-4" />
                  </button>
                  
                  <div class="w-px h-6 bg-white/10 mx-0.5"></div>
                  
                  <!-- Split Path -->
                  <button 
                    @click="splitPath" 
                    title="Dividir Caminho"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  >
                    <Scissors class="w-4 h-4" />
                  </button>
                  
                  <!-- Simplify Path -->
                  <button 
                    @click="simplifyPath" 
                    title="Simplificar Caminho"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  >
                    <Move3D class="w-4 h-4" />
                  </button>
                  
                  <!-- Close Path -->
                  <button 
                    @click="closePath" 
                    title="Fechar Caminho"
                    class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </Transition>

              <!-- Floating Toolbar (Figma Style) - Bottom Center -->
              <div class="absolute left-1/2 -translate-x-1/2 floating-toolbar flex items-center gap-1 bg-[#2a2a2a] p-1.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] border border-white/10 z-30 select-none backdrop-blur-sm">
                  <button @click="setTool('select')" title="Mover (V)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all" :class="!isDrawing ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'">
                    <MousePointer2 class="w-4 h-4" />
                  </button>
                  <div class="w-px h-6 bg-white/10 mx-0.5"></div>
                  
                  <!-- Frame Tool with Dropdown -->
                  <div class="relative group">
                    <button @click="addFrame" title="Quadro (F)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
                      <Frame class="w-4 h-4" />
                      <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                                        <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button @click="addFrame" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Quadro</button>
                      <button @click="addShape('rect')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retângulo</button>
                    </div>
                  </div>
                  
                  <!-- Rectangle Tool with Dropdown -->
                  <div class="relative group">
                    <button @click="addShape('rect')" title="Retângulo (R)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
                      <Square class="w-4 h-4" />
                      <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                                        <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button @click="addShape('rect')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retângulo</button>
                      <button @click="addShape('rect', { rx: 20, ry: 20 })" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Retângulo Arredondado</button>
                    </div>
                  </div>
                  
                  <!-- Circle Tool with Dropdown -->
                  <div class="relative group">
                    <button @click="addShape('circle')" title="Círculo (O)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
                      <Circle class="w-4 h-4" />
                      <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                                        <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button @click="addShape('circle')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Círculo</button>
                      <button @click="addShape('ellipse')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Elipse</button>
                    </div>
                  </div>
                  
                  <!-- Text Tool with Dropdown -->
                  <div class="relative group">
                    <button @click="() => addText()" title="Texto (T)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all relative">
                      <Type class="w-4 h-4" />
                      <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                                        <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button @click="() => addText()" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Texto</button>
                      <button @click="() => addText('heading')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Título</button>
                      <button @click="() => addText('body')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Corpo</button>
                    </div>
                  </div>
                  
                  <!-- Pen Tool with Dropdown -->
                  <div class="relative group">
                    <button @click="togglePenMode" title="Caneta (P)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-all relative" :class="isPenMode ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'text-zinc-400 hover:text-white'">
                      <PenTool class="w-4 h-4" />
                      <ChevronDown class="absolute -bottom-1 -right-1 w-2.5 h-2.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                                        <div class="absolute top-full left-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-35 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button @click="togglePenMode" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Caneta</button>
                      <button @click="toggleDrawing" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Lápis</button>
                      <div class="h-px bg-white/10 my-1"></div>
                      <button @click="setPenWidth(5)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Fino (5px)</button>
                      <button @click="setPenWidth(10)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Médio (10px)</button>
                      <button @click="setPenWidth(20)" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Grosso (20px)</button>
                    </div>
                  </div>
                  
                  <div class="w-px h-6 bg-white/10 mx-0.5"></div>
                  
                  <button @click="addGridZone" title="Zona de Produtos" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                    <LayoutGrid class="w-4 h-4" />
                  </button>
                  
                  <button @click="showLabelTemplatesModal = true" title="Modelos de Etiqueta" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                    <Tag class="w-4 h-4" />
                  </button>
              </div>
          </main>

          <!-- Right Sidebar (Properties - Figma Style) -->
           <aside class="w-75 border-l border-white/5 h-full bg-[#1a1a1a] text-white flex flex-col shrink-0 z-10 overflow-hidden">
               <!-- Top Controls (Share, Play, Zoom, Avatar) -->
               <div class="h-10 px-2 flex items-center justify-end border-b border-white/5 shrink-0 min-w-0">
                 
                 <!-- Right: Controls -->
                                 <div class="flex items-center gap-0.5 shrink-0 min-w-0">
                   <!-- User Avatar -->
                                     <div class="flex items-center -space-x-1 shrink-0">
                     <div 
                       v-for="(user, index) in (collaborators.length > 0 ? collaborators : (currentUser ? [currentUser] : [])).slice(0, 1)" 
                       :key="user.id || index"
                       :class="[
                         'w-5 h-5 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center text-[8px] font-semibold text-white',
                         getColorFromString(user.email || user.name || 'user')
                       ]"
                       :title="user.name || user.email || 'Usuário'"
                     >
                       <img 
                         v-if="user.avatar_url" 
                         :src="user.avatar_url" 
                         :alt="user.name || 'User'"
                         class="w-full h-full rounded-full object-cover"
                       />
                       <span v-else>{{ getInitial(user.name) }}</span>
                     </div>
                   </div>
                   
                   <!-- Play Button -->
                   <button
                     @click="() => startPresentation()"
                                         class="w-5 h-5 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all shrink-0"
                     title="Apresentar"
                   >
                     <Play class="w-2.5 h-2.5" />
                   </button>

                   <!-- Share Button -->
                   <button
                     @click="showShareModal = true"
                                         class="h-5 px-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-medium transition-all flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                   >
                                         <Share2 class="w-2.5 h-2.5 shrink-0" />
                     <span>Exportar</span>
                   </button>

                   <!-- Zoom Dropdown -->
                   <div class="relative shrink-0 pr-0.5">
                     <button 
                       @click="showZoomMenu = !showZoomMenu"
                       class="h-5 px-1 hover:bg-white/10 rounded text-[9px] font-medium text-white flex items-center gap-0.5 transition-all whitespace-nowrap"
                     >
                       <span>{{ currentZoom }}%</span>
                                             <ChevronDown class="w-2 h-2 text-zinc-400 shrink-0" />
                     </button>
                     
                     <!-- Zoom Menu -->
                     <div 
                       v-if="showZoomMenu"
                                             class="absolute top-full right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-30 z-50"
                       @click.stop
                     >
                       <button @click="handleZoom50" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">50%</button>
                       <button @click="handleZoom100" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">100%</button>
                       <button @click="handleZoom200" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">200%</button>
                       <button @click="handleZoom400" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">400%</button>
                       <div class="h-px bg-white/10 my-1"></div>
                       <button @click="zoomToFit" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Ajustar à Tela</button>
                       <button @click="handleZoomToSelection" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Ajustar Seleção</button>
                     </div>
                   </div>
                 </div>
               </div>
               
               <div class="min-h-0 flex-1 flex flex-col">
      <PropertiesPanel
        v-if="selectedObjectRef"
        :selectedObject="selectedObjectRef"
        :activeMode="activeMode"
        :pageSettings="pageSettings"
        :colorStyles="project.colorStyles"
        :productZone="productZoneState.productZone.value"
        :productGlobalStyles="productZoneState.globalStyles.value"
        :labelTemplates="labelTemplates"
        @update-property="updateObjectProperty"
        @update-smart-group="updateSmartGroup"
        @update-page-settings="updatePageSettings"
        @action="handleAction"
        @add-color-style="addColorStyle"
        @apply-color-style="applyColorStyle"
        @add-interaction="() => {}"
        @update-zone="handleUpdateZone"
        @update-global-styles="handleUpdateGlobalStyles"
        @apply-template-to-zone="handleApplyTemplateToZone"
        @apply-preset="handleApplyZonePreset"
        @sync-gaps="handleSyncZoneGaps"
        @recalculate-layout="handleRecalculateLayout"
        @manage-label-templates="showLabelTemplatesModal = true"
        @change-mode="(mode: 'design' | 'prototype') => activeMode = mode"
      />
               </div>
          </aside>
      </div>

      <!-- MODALS SYSTEM (Internal Dialogs) -->
      
      <!-- Save Project Modal -->
      <UiDialog v-model="showSaveModal" title="Salvar Projeto" @close="showSaveModal = false">
        <template #default>
          <div class="space-y-4 py-2">
            <p class="text-sm text-muted-foreground">Escolha um nome para identificar seu projeto na galeria.</p>
            <div class="space-y-2">
              <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do Projeto</label>
              <input 
                v-model="saveProjectName" 
                type="text" 
                placeholder="Ex: Ofertas de Verão 2024"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                @keyup.enter="saveProject"
              />
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3 w-full">
            <Button variant="ghost" @click="showSaveModal = false">Cancelar</Button>
            <Button variant="default" :disabled="!saveProjectName" @click="saveProject">Salvar Alterações</Button>
          </div>
        </template>
      </UiDialog>

      <!-- Label Templates Modal -->
      <UiDialog v-model="showLabelTemplatesModal" title="Modelos de Etiqueta" @close="showLabelTemplatesModal = false" width="min(920px, 96vw)">
        <template #default>
          <LabelTemplateManager
            :templates="labelTemplates"
            :selected-template-id="activeZoneTemplateId()"
            :can-save-from-selection="canSaveLabelTemplateFromSelectionComputed"
            @close="showLabelTemplatesModal = false"
            @edit-selection="beginEditSelectedLabel"
            @create-from-selection="createLabelTemplateFromSelection"
            @create-default="createDefaultLabelTemplate"
            @update-from-selection="updateLabelTemplateFromSelection"
            @insert-to-canvas="insertLabelTemplateToCanvas"
            @update-template="handleUpdateTemplateFromMiniEditor"
            @duplicate="duplicateLabelTemplateById"
            @delete="deleteLabelTemplateById"
            @apply-to-zone="(id) => { const z = canvas?.getActiveObject?.(); if (z && isLikelyProductZone(z)) applyLabelTemplateToZone(z, id); }"
            @set-splash-image="(id, file) => setTemplateSplashImage(id, file)"
          />
        </template>
      </UiDialog>

      <!-- AI Prompt Modal -->
      <UiDialog v-model="showAIModal" title="Assistente Criativo" @close="showAIModal = false" width="460px">
        <template #default>
          <div class="space-y-5 py-2">
            <div class="relative group">
                            <div class="absolute -inset-1 bg-linear-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <div class="relative flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-border/50 rounded-2xl shadow-sm">
                <div class="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Sparkles class="w-5 h-5 text-violet-600" />
                </div>
                <p class="text-[11px] text-foreground/80 leading-relaxed font-medium">
                  Descreva o conceito do seu encarte. A IA irá configurar cores, fontes e layout base inspirados no seu briefing.
                </p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/70">Instruções de Design</label>
                <span class="text-[9px] font-bold text-violet-600 px-2 py-0.5 bg-violet-500/5 rounded-full uppercase tracking-widest">GPT-4o Vision</span>
              </div>
              <textarea 
                v-model="aiPrompt" 
                rows="5"
                placeholder="Ex: Crie um folheto de hortifruti com tons verdes, fonte rústica e clean, estilo minimalista para Instagram..."
                class="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all placeholder:opacity-30"
              ></textarea>
            </div>
            
            <div class="flex flex-wrap gap-2">
               <button @click="aiPrompt = 'Encarte de Supermercado, cores vibrantes, estilo varejo popular'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Varejo Popular</button>
               <button @click="aiPrompt = 'Banner minimalista de eletrônicos, cores dark, neon azul'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Tech Dark</button>
               <button @click="aiPrompt = 'Folheto de padaria, tons pastéis, estilo artesanal'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Artesanal</button>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-center justify-between w-full">
            <button @click="showAIModal = false" class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Fechar</button>
            <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-10 text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-violet-500/20 active:scale-95 transition-all" :disabled="!aiPrompt" @click="generateFlyerWithAI">
              <Wand2 class="w-4 h-4 mr-2" />
              Gerar Design
            </Button>
          </div>
        </template>
      </UiDialog>

      <!-- Paste List Modal -->
      <UiDialog v-model="showPasteListModal" title="Importar Lista de Produtos" @close="showPasteListModal = false" width="500px">
        <template #default>
          <div class="space-y-4 py-2" @paste="handleImagePaste">
            <!-- Tabs Header (Studio Style) -->
            <div class="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg w-full mb-4">
              <button 
                @click="activePasteTab = 'text'" 
                :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', activePasteTab === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
              >
                Lista de Texto
              </button>
              <button 
                @click="activePasteTab = 'image'" 
                :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', activePasteTab === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
              >
                Scan por Imagem (IA)
              </button>
            </div>

            <!-- Text Tab -->
            <div v-if="activePasteTab === 'text'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div class="flex items-start gap-3 p-3 bg-violet-500/5 rounded-lg border border-violet-500/10">
                <StickyNote class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <p class="text-[11px] text-violet-600/80 dark:text-violet-400 leading-relaxed font-medium">Cole uma lista de produtos (um por linha) com nome e preço. Nossa IA cuidará da formatação automática ao adicionar no palco.</p>
              </div>
              <textarea 
                v-model="pasteListText" 
                rows="8"
                placeholder="Exemplo:&#10;Arroz Tio João 5kg - 29,90&#10;Feijão Carioca 1kg - 7,50&#10;Óleo de Soja 900ml - 5,99"
                class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-[13px] font-mono text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none transition-all placeholder:text-zinc-600"
              ></textarea>
            </div>

            <!-- Image Tab -->
            <div v-else class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div class="flex items-start gap-3 p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
                <Wand2 class="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <p class="text-[11px] text-violet-600/80 leading-relaxed font-medium">Capture ofertas de folhetos, fotos de gôndolas ou prints. A IA Vision vai extrair os produtos e preços automaticamente para você.</p>
              </div>
              
              <div 
                v-if="!pastedImage"
                class="group relative border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer bg-zinc-800/30 hover:bg-violet-500/10"
                @click="triggerListImageUpload"
              >
                <div class="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-violet-500/20 transition-all duration-500">
                  <Upload class="w-7 h-7 text-violet-400" />
                </div>
                <div class="text-center">
                  <p class="text-[13px] font-bold text-white">Clique para Upload ou Cole (Ctrl+V)</p>
                  <p class="text-[11px] text-zinc-400 mt-1">Suporta Excel, PDF, CSV, Imagens e Texto</p>
                </div>
                <input ref="listImageInput" type="file" hidden accept="image/*" @change="handleListImageUpload" />
              </div>

                            <div v-else class="relative rounded-2xl overflow-hidden border border-border bg-black/2 p-2">
                <div class="aspect-video w-full rounded-xl overflow-hidden bg-black/5 flex items-center justify-center relative group">
                  <img :src="pastedImage" class="max-w-full max-h-full object-contain shadow-2xl" />
                  <button @click="pastedImage = null" class="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all">
                    <X class="w-4 h-4" />
                  </button>
                </div>
                <Button class="w-full mt-2" :disabled="isAnalyzingImage" @click="analyzeImageWithAI">
                   <span v-if="isAnalyzingImage" class="flex items-center gap-2"><div class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> Analisando...</span>
                   <span v-else>Extrair Produtos com IA</span>
                </Button>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-between items-center w-full pt-2">
            <Button variant="ghost" class="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground" @click="showPasteListModal = false">Cancelar</Button>
            <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-6 h-9 text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all" :disabled="!pasteListText && activePasteTab === 'text'" @click="handlePasteList">Adicionar ao Palco</Button>
          </div>
        </template>
      </UiDialog>

      <!-- Delete Page Confirmation Modal -->
      <UiDialog v-model="showDeletePageModal" title="Excluir Página?" @close="showDeletePageModal = false">
          <p class="py-4 text-sm text-muted-foreground">Tem certeza que deseja excluir esta página? Esta ação não pode ser desfeita.</p>
          <template #footer>
              <div class="flex justify-end gap-3 w-full">
                  <Button variant="ghost" @click="showDeletePageModal = false">Cancelar</Button>
                  <Button variant="destructive" @click="confirmDeletePage">Sim, Excluir</Button>
              </div>
          </template>
      </UiDialog>

      <!-- Product Review Modal for List Import -->
      <ProductReviewModal 
          v-model="showProductReviewModal"
          :initial-products="reviewProducts"
          :show-import-mode="!!(targetGridZone && isLikelyProductZone(targetGridZone))"
          :existing-count="productImportExistingCount"
          :label-templates="labelTemplates"
          :initial-label-template-id="importZoneLabelTemplateId"
          @import="confirmProductImport"
      />

      <!-- Export Modal -->
      <UiDialog v-model="showExportModal" title="Exportar Design" @close="showExportModal = false" width="450px">
        <template #default>
          <div class="space-y-4 py-4">
             <!-- Export Scope (Canvas vs Frames) -->
             <div class="space-y-2">
                 <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que exportar</label>
                 <div class="grid grid-cols-3 gap-2">
                     <button
                         @click="exportSettings.exportScope = 'canvas'"
                         :class="exportSettings.exportScope === 'canvas' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
                         class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
                     >
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                         <span>Tela Inteira</span>
                     </button>
                     <button
                         @click="exportSettings.exportScope = 'selected-frame'"
                         :class="exportSettings.exportScope === 'selected-frame' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
                         class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
                     >
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                         </svg>
                         <span>Frame Selecionado</span>
                     </button>
                     <button
                         @click="exportSettings.exportScope = 'all-frames'"
                         :class="exportSettings.exportScope === 'all-frames' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent hover:bg-zinc-800'"
                         class="py-2.5 text-xs font-bold rounded border transition-colors flex flex-col items-center gap-1"
                     >
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                         </svg>
                         <span>Todos os Frames</span>
                     </button>
                 </div>
             </div>

             <!-- Frame Selector (when selected-frame is chosen) -->
             <div class="space-y-2" v-if="exportSettings.exportScope === 'selected-frame'">
                 <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selecione o Frame</label>
                 <select
                     v-model="exportSettings.selectedFrameId"
                     class="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                 >
                     <option value="">Selecione um frame...</option>
                     <option v-for="frame in availableFramesForExport" :key="frame.id" :value="frame.id">
                         {{ frame.name }}
                     </option>
                 </select>
                 <p v-if="availableFramesForExport.length === 0" class="text-[10px] text-amber-500">
                     Nenhum frame encontrado no canvas. Crie um frame primeiro.
                 </p>
             </div>

             <!-- Format -->
             <div class="space-y-2" v-if="exportSettings.exportScope !== 'all-frames' || exportSettings.format !== 'svg'">
                 <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formato</label>
                 <div class="flex gap-2">
                     <button @click="exportSettings.format = 'png'" :class="exportSettings.format === 'png' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">PNG</button>
                     <button @click="exportSettings.format = 'jpeg'" :class="exportSettings.format === 'jpeg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">JPG</button>
                     <button v-if="exportSettings.exportScope === 'canvas'" @click="exportSettings.format = 'svg'" :class="exportSettings.format === 'svg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">SVG</button>
                 </div>
                 <p v-if="exportSettings.exportScope === 'all-frames'" class="text-[10px] text-zinc-500">
                     A exportação de múltiplos frames suporta apenas PNG/JPG
                 </p>
             </div>

             <!-- Scale -->
             <div class="space-y-2" v-if="exportSettings.format !== 'svg'">
                 <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escala (Resolução)</label>
                 <div class="flex gap-2">
                     <button @click="exportSettings.scale = 1" :class="exportSettings.scale === 1 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">1x</button>
                     <button @click="exportSettings.scale = 2" :class="exportSettings.scale === 2 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">2x</button>
                     <button @click="exportSettings.scale = 3" :class="exportSettings.scale === 3 ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">3x</button>
                 </div>
                 <p class="text-[10px] text-zinc-500 text-right">
                    {{ exportSettings.scale === 1 ? '72 DPI (Tela)' : exportSettings.scale === 2 ? '144 DPI (Retina)' : '300 DPI (Impressão)' }}
                 </p>
             </div>

             <!-- Info for multiple frames -->
             <div v-if="exportSettings.exportScope === 'all-frames' && availableFramesForExport.length > 1" class="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                 <svg class="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <p class="text-[10px] text-blue-200">
                     Cada frame será exportado como um arquivo separado. {{ availableFramesForExport.length }} frames serão exportados.
                 </p>
             </div>
          </div>
        </template>
        <template #footer>
            <div class="flex justify-between items-center w-full">
                <span class="text-[10px] text-muted-foreground">
                    {{ exportSettings.exportScope === 'all-frames' ? `${availableFramesForExport.length} arquivos` : '1 arquivo' }}
                </span>
                <div class="flex gap-2">
                    <Button variant="ghost" @click="showExportModal = false">Cancelar</Button>
                    <Button variant="default" @click="performExport" :disabled="exportSettings.exportScope === 'selected-frame' && !exportSettings.selectedFrameId">Exportar</Button>
                </div>
            </div>
        </template>
      </UiDialog>

      <!-- Share Modal -->
      <UiDialog v-model="showShareModal" title="Exportar" @close="showShareModal = false" width="400px">
        <template #default>
          <div class="space-y-5 py-3">

             <!-- Escopo -->
             <div class="space-y-1.5">
                 <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Área</label>
                 <div class="grid grid-cols-3 gap-1.5">
                     <button
                         @click="shareSettings.shareScope = 'canvas'"
                         :class="shareSettings.shareScope === 'canvas' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                         class="py-2 text-[11px] font-medium rounded-lg transition-all"
                     >Página Inteira</button>
                     <button
                         @click="shareSettings.shareScope = 'selected-frame'"
                         :class="shareSettings.shareScope === 'selected-frame' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                         class="py-2 text-[11px] font-medium rounded-lg transition-all"
                     >Frame</button>
                     <button
                         @click="shareSettings.shareScope = 'all-frames'"
                         :class="shareSettings.shareScope === 'all-frames' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                         class="py-2 text-[11px] font-medium rounded-lg transition-all"
                     >Todos Frames</button>
                 </div>
             </div>

             <!-- Frame Selector (condicional) -->
             <div class="space-y-1.5" v-if="shareSettings.shareScope === 'selected-frame'">
                 <div class="flex items-center justify-between">
                     <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Frames</label>
                     <button
                         @click="selectAllFrames"
                         class="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                     >{{ shareSettings.selectedFrameIds.length === availableFramesForExport.length ? 'Desmarcar todos' : 'Selecionar todos' }}</button>
                 </div>
                 <div class="bg-zinc-800 border border-zinc-700 rounded-lg max-h-32 overflow-y-auto custom-scrollbar">
                     <label
                         v-for="frame in availableFramesForExport"
                         :key="frame.id"
                         class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-zinc-700/50 transition-colors border-b border-zinc-700/50 last:border-b-0"
                     >
                         <input
                             type="checkbox"
                             :checked="shareSettings.selectedFrameIds.includes(frame.id)"
                             @change="toggleFrameSelection(frame.id)"
                             class="w-3.5 h-3.5 rounded border-zinc-600 text-violet-500 focus:ring-violet-500/30 bg-zinc-700 shrink-0"
                         />
                         <span class="text-xs text-white truncate">{{ frame.name }}</span>
                     </label>
                     <div v-if="!availableFramesForExport.length" class="px-3 py-3 text-[10px] text-zinc-500 text-center">Nenhum frame encontrado</div>
                 </div>
             </div>

             <!-- Formato + Escala lado a lado -->
             <div class="grid grid-cols-2 gap-4" v-if="shareSettings.shareScope !== 'all-frames'">
                 <div class="space-y-1.5">
                     <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Formato</label>
                     <div class="flex gap-1.5">
                         <button @click="shareSettings.format = 'png'" :class="shareSettings.format === 'png' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">PNG</button>
                         <button @click="shareSettings.format = 'jpeg'" :class="shareSettings.format === 'jpeg' ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">JPG</button>
                     </div>
                 </div>
                 <div class="space-y-1.5">
                     <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Escala</label>
                     <div class="flex gap-1.5">
                         <button @click="shareSettings.scale = 1" :class="shareSettings.scale === 1 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">1x</button>
                         <button @click="shareSettings.scale = 2" :class="shareSettings.scale === 2 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">2x</button>
                         <button @click="shareSettings.scale = 3" :class="shareSettings.scale === 3 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">3x</button>
                     </div>
                 </div>
             </div>

             <!-- Escala (quando all-frames, formato não aparece) -->
             <div class="space-y-1.5" v-if="shareSettings.shareScope === 'all-frames'">
                 <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Escala</label>
                 <div class="flex gap-1.5 max-w-50">
                     <button @click="shareSettings.scale = 1" :class="shareSettings.scale === 1 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">1x</button>
                     <button @click="shareSettings.scale = 2" :class="shareSettings.scale === 2 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">2x</button>
                     <button @click="shareSettings.scale = 3" :class="shareSettings.scale === 3 ? 'bg-violet-600 text-white ring-1 ring-violet-500' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'" class="flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-all">3x</button>
                 </div>
             </div>

          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <button @click="showShareModal = false" class="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-all">Cancelar</button>
            <Button variant="default" size="sm" @click="performShare" :disabled="shareSettings.shareScope === 'selected-frame' && shareSettings.selectedFrameIds.length === 0">
                <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar
            </Button>
          </div>
        </template>
      </UiDialog>

      <!-- Presentation Mode Overlay -->
      <div v-if="showPresentationModal" class="fixed inset-0 z-100 bg-black flex items-center justify-center">
          <div class="relative w-full h-full flex items-center justify-center">
              <div class="relative w-full h-full">
                  <img :src="presentationImage" class="w-full h-full object-contain" />
                  
                  <!-- Hotspots Layer -->
                  <div class="absolute inset-0 w-full h-full">
                      <div 
                        v-for="(hotspot, i) in presentationHotspots" 
                        :key="i"
                        class="absolute cursor-pointer hover:bg-violet-500/30 transition-colors"
                        :style="{ top: hotspot.top, left: hotspot.left, width: hotspot.width, height: hotspot.height }"
                        @click="handleHotspotClick(hotspot.target)"
                        title="Clique para Navegar"
                      ></div>
                  </div>
              </div>
              
              <!-- Close Button -->
              <button @click="showPresentationModal = false" class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-white/20 transition-all z-50">
                  <X class="w-6 h-6" />
              </button>

              <!-- Controls -->
              <div class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#2c2c2c] px-4 py-2 rounded-full flex gap-4 border border-white/10 shadow-xl z-50">
                  <span class="text-xs text-white font-medium">Modo Apresentação Interativa</span>
              </div>
          </div>
      </div>

      <!-- Figma-style Crop Overlay -->
      <FigmaCropOverlay
          v-model="figmaCrop.isCropActive.value"
          :frame-rect="figmaCrop.cropFrameRect.value"
          :frame-name="figmaCrop.cropFrameName.value"
          :zoom="1"
          :canvas-offset="cropCanvasOffset"
          @update:frame-rect="handleCropRectUpdate"
          @crop-complete="handleCropComplete"
      />

  </div>
</template>

<style scoped>
/* Ensure canvas container handles canvas element correctly */
 :deep(.canvas-container) {
     background-color: transparent !important;
     box-shadow: 0 0 40px rgba(0,0,0,0.5); /* Figma-like page shadow */
 }
 main {
     background-color: #1a1a1a !important;
 }

/* Keep floating toolbar from "jumping" near bottom (safe area / scrollbars) */
.floating-toolbar {
    /* closer to the bottom scrollbar (which sits at bottom-1) */
    bottom: calc(1.75rem + env(safe-area-inset-bottom, 0px));
}
 
 /* Figma-like Scrollbar */
 .custom-scrollbar::-webkit-scrollbar {
     width: 10px;
     height: 10px;
 }
 .custom-scrollbar::-webkit-scrollbar-track {
     background: #1e1e1e;
     border-left: 1px solid #333;
 }
 .custom-scrollbar::-webkit-scrollbar-thumb {
     background: #444;
     border-radius: 5px;
     border: 2px solid #1e1e1e; /* Creates padding effect */
 }
 .custom-scrollbar::-webkit-scrollbar-thumb:hover {
     background: #666;
 }
 .custom-scrollbar::-webkit-scrollbar-corner {
     background: #1e1e1e;
 }
</style>

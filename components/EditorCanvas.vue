<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef, watch, watchEffect, triggerRef, computed } from 'vue'
import Button from './ui/Button.vue'
import LayersPanel from './LayersPanel.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import ProjectManager from './ProjectManager.vue'
import SidebarLeft from './SidebarLeft.vue'
import ProductReviewModal from './ProductReviewModal.vue'
import LabelTemplateManager from './LabelTemplateManager.vue'
import ContextMenu from './ui/ContextMenu.vue'
import { useProductZone } from '~/composables/useProductZone'
import { removeBackground } from "@imgly/background-removal"
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
  Ungroup // Ungroup icon
} from 'lucide-vue-next'

const isDrawing = ref(false)
const isNodeEditing = ref(false)
let globalMouseUpHandler: ((e: MouseEvent) => void) | null = null

// Product Zone State
const productZoneState = useProductZone()

// Label templates (price splash models)
const showLabelTemplatesModal = ref(false)
const labelTemplates = ref<LabelTemplate[]>([])

const LABEL_TEMPLATES_JSON_KEY = '__labelTemplates'
const BUILTIN_DEFAULT_LABEL_TEMPLATE_ID = 'tpl_default'
const BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID = 'tpl_atacarejo_10fd'
const LABEL_TEMPLATE_EXTRA_PROPS = ['name', '__fontScale', '__yOffsetRatio']

const serializeLabelTemplatesForProject = () => {
    // Keep project JSON lean: previews can be regenerated client-side.
    return (labelTemplates.value || []).map((t: any) => ({ ...t, previewDataUrl: undefined }))
}

const hydrateLabelTemplatesFromProjectJson = (json: any) => {
    const raw = json?.[LABEL_TEMPLATES_JSON_KEY]
    if (Array.isArray(raw)) labelTemplates.value = raw as any
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
    await ensureBuiltInDefaultLabelTemplate();
    await ensureBuiltInAtacarejoLabelTemplate();
    // Generate missing previews lazily (not persisted in the project JSON).
    const list = [...(labelTemplates.value || [])];
    let changed = false;
    for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t || t.previewDataUrl) continue;
        const url = await renderLabelTemplatePreview(t);
        if (url) {
            (list[i] as any) = { ...t, previewDataUrl: url };
            changed = true;
        }
    }
    if (changed) labelTemplates.value = list as any;
});

const addFrame = () => {
    if (!canvas.value) return;
    const center = getCenterOfView();

    const frameWidth = 400;
    const frameHeight = 600;

    // Create Frame Rect - CENTRALIZADO
    const frame = new fabric.Rect({
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        width: frameWidth,
        height: frameHeight,
        fill: '#ffffff',
        stroke: '#0d99ff', // Figma Blue
        strokeWidth: 2,
        isFrame: true, // Custom Flag used by after:render
        clipContent: true,
        name: 'Frame',
        objectCaching: true,
        statefullCache: true,
        noScaleCache: false,
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

    canvas.value.add(frame);

    // Create dimension label below the frame
    const dpiMap: Record<number, number> = { 1: 72, 2: 144, 3: 300 };
    const dpi = dpiMap[exportSettings.value.scale] || 72;
    const labelText = `${frameWidth}x${frameHeight} @ ${dpi}dpi`;

    const dimensionLabel = new fabric.Text(labelText, {
        left: center.x,
        top: center.y + frameHeight / 2 + 15, // 15px abaixo do frame
        originX: 'center',
        originY: 'top',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
        fill: '#666666',
        selectable: false,
        evented: false,
        isFrameLabel: true, // Flag para identificar que é label do frame
    });

    canvas.value.add(dimensionLabel);

    canvas.value.setActiveObject(frame);
    canvas.value.requestRenderAll();
    saveCurrentState();
}

// === FRAMES (Figma-like) ===
// Basic parenting via `parentFrameId` + optional clipping via `clipContent`.
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

    if (!(frame as any).__clipRect) {
        (frame as any).__clipRect = wantPathClip
            ? new fabric.Path(buildCornerPath(frame.width, frame.height, frame.cornerRadii), {
                left: frame.left,
                top: frame.top,
                originX: frame.originX ?? 'left',
                originY: frame.originY ?? 'top',
                angle: frame.angle ?? 0,
                scaleX: frame.scaleX ?? 1,
                scaleY: frame.scaleY ?? 1,
                absolutePositioned: true,
                selectable: false,
                evented: false,
                objectCaching: false
            })
            : new fabric.Rect({
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                originX: frame.originX ?? 'left',
                originY: frame.originY ?? 'top',
                angle: frame.angle ?? 0,
                scaleX: frame.scaleX ?? 1,
                scaleY: frame.scaleY ?? 1,
                rx: frame.rx ?? 0,
                ry: frame.ry ?? 0,
                absolutePositioned: true,
                selectable: false,
                evented: false,
                objectCaching: false
            });
    }

    let clip = (frame as any).__clipRect;
    // If mode changed (rect -> path or path -> rect), recreate clip and let syncFrameClips refresh children.
    const isPathClip = String(clip?.type || '').toLowerCase() === 'path';
    if (wantPathClip && !isPathClip) {
        clip = new fabric.Path(buildCornerPath(frame.width, frame.height, frame.cornerRadii), {
            left: frame.left,
            top: frame.top,
            originX: frame.originX ?? 'left',
            originY: frame.originY ?? 'top',
            angle: frame.angle ?? 0,
            scaleX: frame.scaleX ?? 1,
            scaleY: frame.scaleY ?? 1,
            absolutePositioned: true,
            selectable: false,
            evented: false,
            objectCaching: false
        });
        (frame as any).__clipRect = clip;
    } else if (!wantPathClip && isPathClip) {
        clip = new fabric.Rect({
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            originX: frame.originX ?? 'left',
            originY: frame.originY ?? 'top',
            angle: frame.angle ?? 0,
            scaleX: frame.scaleX ?? 1,
            scaleY: frame.scaleY ?? 1,
            rx: frame.rx ?? 0,
            ry: frame.ry ?? 0,
            absolutePositioned: true,
            selectable: false,
            evented: false,
            objectCaching: false
        });
        (frame as any).__clipRect = clip;
    }

    // Update properties.
    if (String(clip?.type || '').toLowerCase() === 'path') {
        clip.set({
            left: frame.left,
            top: frame.top,
            originX: frame.originX ?? 'left',
            originY: frame.originY ?? 'top',
            angle: frame.angle ?? 0,
            scaleX: frame.scaleX ?? 1,
            scaleY: frame.scaleY ?? 1,
            absolutePositioned: true
        });
        if (fabric?.util?.parsePath) {
            clip.set('path', fabric.util.parsePath(buildCornerPath(frame.width, frame.height, frame.cornerRadii)));
        }
        clip.dirty = true;
    } else {
        clip.set({
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
            originX: frame.originX ?? 'left',
            originY: frame.originY ?? 'top',
            angle: frame.angle ?? 0,
            scaleX: frame.scaleX ?? 1,
            scaleY: frame.scaleY ?? 1,
            rx: frame.rx ?? 0,
            ry: frame.ry ?? 0,
            absolutePositioned: true
        });
    }
    if (typeof clip.setCoords === 'function') clip.setCoords();
    return clip;
};

const findFrameUnderObject = (obj: any) => {
    if (!canvas.value || !obj) return null;
    const center = typeof obj.getCenterPoint === 'function' ? obj.getCenterPoint() : null;
    if (!center) return null;

    const frames = getAllFrames().filter((f: any) => f !== obj);
    const hits = frames.filter((f: any) => typeof f.containsPoint === 'function' && f.containsPoint(center));
    if (!hits.length) return null;

    // Prefer the smallest frame (innermost) when nested.
    hits.sort((a: any, b: any) => (a.getScaledWidth() * a.getScaledHeight()) - (b.getScaledWidth() * b.getScaledHeight()));
    return hits[0];
};

const syncObjectFrameClip = (obj: any) => {
    if (!canvas.value || !obj) return;
    if ((obj as any).excludeFromExport) return;

    const frameId = (obj as any).parentFrameId as (string | undefined);
    const frame = frameId ? getFrameById(frameId) : null;
    const ownedBy = (obj as any)._frameClipOwner as (string | undefined);

    if (!frame || !frame.clipContent) {
        if (ownedBy) {
            obj.set?.('clipPath', null);
            delete (obj as any)._frameClipOwner;
        }
        return;
    }

    // Don't override an existing clipPath we don't own (e.g. masks/crops).
    if (obj.clipPath && !ownedBy) return;

    const clip = getOrCreateFrameClipRect(frame);
    if (!clip) return;

    obj.set?.('clipPath', clip);
    (obj as any)._frameClipOwner = frame._customId;
};

const syncFrameClips = (frame: any) => {
    if (!canvas.value || !frame?._customId) return;
    getOrCreateFrameClipRect(frame);
    const children = canvas.value.getObjects().filter((o: any) => o !== frame && o.parentFrameId === frame._customId);
    children.forEach((child: any) => syncObjectFrameClip(child));
};

const maybeReparentToFrameOnDrop = (obj: any) => {
    if (!canvas.value || !obj || (obj as any).excludeFromExport) return;
    const frame = findFrameUnderObject(obj);
    if (!frame || !frame._customId) return;
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
    // Avoid double rounding via rx/ry.
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

const setTool = (tool: 'select' | 'draw') => {
    if (!canvas.value) return;

    // Reset States
    isNodeEditing.value = false;
    exitNodeEditing();
    
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
        
    } else {
        // Select Mode
        isDrawing.value = false;
        canvas.value.isDrawingMode = false;
        selectedObjectRef.value = null;
        triggerRef(selectedObjectRef);
    }
}

const toggleDrawing = () => {
    if (isDrawing.value) setTool('select');
    else setTool('draw');
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
            data: { index: index, parentObj: obj } // Link to parent
        });
        
        canvas.value.add(control);
    });
    
    obj.selectable = false; // Lock parent while editing
    obj.evented = false;
    canvas.value.requestRenderAll();
}



const createPriceLayout = (product: any, width: number, top: number) => {
    // Basic Stub for Price Layout
    const group = new fabric.Group([], { left: 0, top: top });
    const priceText = new fabric.Text(product.price || '0,00', { fontSize: 40, fill: 'red' });
    safeAddWithUpdate(group, priceText);
    return group;
}

const exitNodeEditing = () => {
    isNodeEditing.value = false;
    if (!canvas.value) return;
    
    const controls = canvas.value.getObjects().filter((o: any) => o.name === 'control_point');
    let parentObj: any = null;
    
    if (controls.length > 0) {
        parentObj = controls[0].data.parentObj;
    }
    
    // Remove controls
    controls.forEach((c: any) => canvas.value.remove(c));
    
    if (parentObj) {
        parentObj.selectable = true;
        parentObj.evented = true;
        canvas.value.setActiveObject(parentObj);
    }
    
    canvas.value.requestRenderAll();
}

// Update polygon when control point moves
const handleInteraction = () => {
    // Reduced work during interaction to avoid lag
    // Scrollbars and Properties panel will update on 'mouse:up' or 'object:modified'
};

const safeAddWithUpdate = (group: any, object?: any) => {
    if (!group) return;
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
    // Fabric keeps render order in the internal `_objects` array for both Canvas and Group.
    const internal = (container as any)._objects;
    if (Array.isArray(internal)) {
        internal.length = 0;
        newOrder.forEach(o => internal.push(o));
        if (typeof container._onStackOrderChanged === 'function') container._onStackOrderChanged();
    } else if (typeof container.getObjects === 'function' && typeof container.remove === 'function' && typeof container.add === 'function') {
        // Fallback: rebuild by remove/add (can be slower, but safe).
        const cur = container.getObjects().slice();
        cur.forEach((o: any) => container.remove(o));
        newOrder.forEach((o: any) => container.add(o));
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

import { GOOGLE_WEBFONT_FAMILIES } from '~/utils/font-catalog'

// Import fabric type for TS (optional if we had types, using any for now to be fast)
// import { fabric } from 'fabric'

const { project, activePage, initProject, updatePageData, updatePageThumbnail, deletePage, resizePage, saveProjectDB, triggerAutoSave, isProjectLoaded } = useProject()

const canvas = shallowRef<any>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const wrapperEl = ref<HTMLDivElement | null>(null)
const isProcessing = ref(false)
const currentZoom = ref(100) // Zoom state

const pageSettings = ref({
    backgroundColor: '#1e1e1e' // Match default dark workspace
})

// Virtual Scrollbars State
const scrollV = ref({ top: 0, height: 0, visible: false })
const scrollH = ref({ left: 0, width: 0, visible: false })

const updateScrollbars = () => {
    if (!canvas.value || !wrapperEl.value) return;

    const vpt = canvas.value.viewportTransform;
    const zoom = canvas.value.getZoom();
    const width = canvas.value.getWidth();
    const height = canvas.value.getHeight();

    // Calculate logical boundaries (all objects + artboard)
    const objects = canvas.value.getObjects();
    let minX = 0, minY = 0, maxX = activePage.value?.width || 1080, maxY = activePage.value?.height || 1920;

    objects.forEach((obj: any) => {
        const bounds = obj.getBoundingRect();
        // Convert screen bounds to logical bounds
        const oMinX = (bounds.left - vpt[4]) / zoom;
        const oMinY = (bounds.top - vpt[5]) / zoom;
        const oMaxX = oMinX + bounds.width / zoom;
        const oMaxY = oMinY + bounds.height / zoom;

        minX = Math.min(minX, oMinX);
        minY = Math.min(minY, oMinY);
        maxX = Math.max(maxX, oMaxX);
        maxY = Math.max(maxY, oMaxY);
    });

    // Padding for the "Infinite" feel
    const padding = 100; // Reduced padding to trigger scroll earlier
    const totalW = (maxX - minX + padding * 2) * zoom;
    const totalH = (maxY - minY + padding * 2) * zoom;

    // Vertical Scrollbar
    scrollV.value.height = Math.max(40, (height / totalH) * height);
    const relY = (vpt[5] - minY * zoom + padding * zoom);
    // Invert position relative to viewport
    scrollV.value.top = Math.max(0, Math.min(height - scrollV.value.height, ((vpt[5] * -1) / totalH) * height + (height/2))); 
    // Simplified Visibilty: If viewport transform is significantly off-center
    scrollV.value.visible = totalH > height || Math.abs(vpt[5]) > 10;

    // Horizontal Scrollbar
    scrollH.value.width = Math.max(40, (width / totalW) * width);
    // Simplified position logic
    scrollH.value.left = Math.max(0, Math.min(width - scrollH.value.width, ((vpt[4] * -1) / totalW) * width + (width/2)));
    scrollH.value.visible = totalW > width || Math.abs(vpt[4]) > 10;
}

// View Controls
const updateZoomState = () => {
    if (!canvas.value) return;
    currentZoom.value = Math.round(canvas.value.getZoom() * 100);
    updateScrollbars();
}

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

const canvasObjects = shallowRef<any[]>([]) // Reactive list (shallow for performance)
const selectedObjectId = ref<string | null>(null)
const selectedObjectRef = shallowRef<any>(null) // Direct reference for properties panel (shallow for performance)
const selectedObjectPos = ref<{top: number, left: number, width: number, visible: boolean}>({ top: 0, left: 0, width: 0, visible: false })

// Enable/disable "Salvar da Selecao" in the label templates modal.
canSaveLabelTemplateFromSelectionComputed = computed(() => {
    return !!getPriceGroupFromAny(selectedObjectRef.value);
});

const showProjectManager = ref(false)
const showGrid = ref(false)
const showRulers = ref(false)

const toggleGrid = () => {
    showGrid.value = !showGrid.value;
    if (!canvas.value) return;
    
    if (showGrid.value) {
        canvas.value.setBackgroundColor({
            source: createGridPattern(),
            repeat: 'repeat'
        }, canvas.value.renderAll.bind(canvas.value));
    } else {
        canvas.value.setBackgroundColor('#1e1e1e', canvas.value.renderAll.bind(canvas.value));
    }
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

const toggleRulers = () => {
    showRulers.value = !showRulers.value;
    // Rulers are often handled by a separate SVG or Canvas overlay
    // For now, we'll toggle the state
}

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
const targetGridZone = ref<any>(null) // Reference to the Grid Zone that was double-clicked

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
    
    // 1. Generate Image
    presentationImage.value = canvas.value.toDataURL({
        format: 'png',
        multiplier: 2
    });
    
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
    quality: 0.9
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
        selectedObjectRef.value = { ...active };
    }
}

// History System
const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);
const isHistoryProcessing = ref(false); // Flag to prevent loop

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

    if (!zoneRect) {
        // Auto-creation DISABLED due to user preference for 'Infinite/Free Canvas'
        // To enable: Trigger this manually or use a flag
        return;

        /* 
        // Create Zone Container
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
            isZone: true // Custom flag
        });
        */

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
        canvas.value.sendToBack(zoneRect); // Keep behind products
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

            const priceVal = product.price !== undefined ? product.price : 0;
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
                subTargetCheck: true 
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
                items[0].set({ width: product.width, height: product.height, fill: product.backgroundColor });
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
                const priceVal = product.price !== undefined ? product.price : 0;
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

    // 1. Snapshot logic...
    
    // 2. Clear & Resize Canvas
    isHistoryProcessing.value = true;
    
    canvas.value.clear();
    // THE WORKSPACE BACKGROUND IS DYNAMIC
    canvas.value.backgroundColor = pageSettings.value.backgroundColor; 
    
    canvas.value.setDimensions({
        width: newPage.width,
        height: newPage.height
    });

	    // 3. Load Data
	    try {
	        if (newPage.canvasData) {
	            // Restore label templates stored alongside the Fabric JSON (persisted per page).
	            hydrateLabelTemplatesFromProjectJson(newPage.canvasData);
	            await canvas.value.loadFromJSON(newPage.canvasData);
	            rehydrateCanvasZones();
            
            // Try to sync settings from loaded artboard
            const artboard = canvas.value.getObjects().find((o: any) => o.id === 'artboard-bg');
            if (artboard && artboard.fill) {
                pageSettings.value.backgroundColor = artboard.fill as string;
            }
            
            // Restore IDs if lost
            canvas.value.getObjects().forEach((o: any) => {
                if (o.type === 'rect' && !o.selectable && !o.id) o.set('id', 'artboard-bg');
            });

            canvas.value.renderAll();
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
    if (newPage.canvasData) {
        isHistoryProcessing.value = true;
        saveCurrentState(); 
        isHistoryProcessing.value = false;
    }

    // 5. Zoom to Fit logic
    setTimeout(zoomToFit, 50);

    // 6. Refresh Reactivity
    const objs = canvas.value.getObjects();
    objs.forEach((o: any) => {
          if (!o._customId) o._customId = Math.random().toString(36).substr(2, 9);
    });
    canvasObjects.value = [...objs];
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
    
    if (objects.length === 0) {
        // Empty Canvas? Center at (0,0) with zoom 1 or default zoom
        canvas.value.setViewportTransform([1, 0, 0, 1, vWidth / 2, vHeight / 2]);
        updateZoomState();
        return;
    }

    // Calculate Bounding Box of all content
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    objects.forEach((obj: any) => {
        const br = obj.getBoundingRect();
        if (br.left < minX) minX = br.left;
        if (br.top < minY) minY = br.top;
        if (br.left + br.width > maxX) maxX = br.left + br.width;
        if (br.top + br.height > maxY) maxY = br.top + br.height;
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Safety check
    if (contentWidth <= 0 || contentHeight <= 0) {
         canvas.value.setViewportTransform([1, 0, 0, 1, vWidth / 2, vHeight / 2]);
         updateZoomState();
         return;
    }

    // Add padding (10%)
    const padding = 100;
    
    const scaleX = (vWidth - padding * 2) / contentWidth;
    const scaleY = (vHeight - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Max zoom 1 to avoid too close

    // Center Logic
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    const viewportX = (vWidth / 2) - (contentCenterX * scale);
    const viewportY = (vHeight / 2) - (contentCenterY * scale);

    canvas.value.setViewportTransform([scale, 0, 0, scale, viewportX, viewportY]);
    updateZoomState();
    
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
    if(canvas.value && wrapperEl.value) {
        canvas.value.setDimensions({
            width: wrapperEl.value.clientWidth,
            height: wrapperEl.value.clientHeight
        });
    }
}

onMounted(async () => {
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
    
    if (canvasEl.value && wrapperEl.value) {
      // Init Infinite Canvas (Full Wrapper Size)
      canvas.value = new fabric.Canvas(canvasEl.value, {
        width: wrapperEl.value.clientWidth,
        height: wrapperEl.value.clientHeight,
        backgroundColor: '#1e1e1e', // Dark Workspace
        preserveObjectStacking: true, 
      });

      // Initialize Smart Grid
      initProductZone();
      
      // Force workspace to dark
      wrapperEl.value.style.backgroundColor = '#121212';
      
      // --- Frame Label Renderer (Optimized) ---
      canvas.value.on('after:render', () => {
          const activeObj = canvas.value.getActiveObject();
          if (!activeObj) return;

          const ctx = canvas.value.getContext();
          const vpt = canvas.value.viewportTransform;
          
          // Only draw labels for the active object if it's a frame.
          // Optimization: iterating all objects during render causes drag lag.
          const objectsToLabel = activeObj && activeObj.isFrame ? [activeObj] : [];

          ctx.save();
          for (const obj of objectsToLabel) {
              const tl = obj.getCoords()[0]; 
              const p_tl = fabric.util.transformPoint(tl, vpt);
              
              const w = Math.round(obj.getScaledWidth());
              const h = Math.round(obj.getScaledHeight());
              
              // Draw Title
              ctx.font = '12px Inter, sans-serif';
              ctx.fillStyle = '#888';
              ctx.fillText(obj.name || 'Frame', p_tl.x, p_tl.y - 8);
              
              // Dimensions Badge
              const center = obj.getCenterPoint();
              const p_bc_raw = { x: center.x, y: center.y + (obj.getScaledHeight()/2) };
              const p_bc = fabric.util.transformPoint(p_bc_raw, vpt);
              
              const text = `${w} × ${h}`;
              ctx.font = 'bold 11px Inter, sans-serif';
              const textMetrics = ctx.measureText(text);
              const bw = textMetrics.width + 12;
              const bh = 20;
              
              ctx.beginPath();
              const bx = p_bc.x - bw/2;
              const by = p_bc.y + 8;
              
              // Simplified Rect for speed
              ctx.fillStyle = '#0d99ff';
              if (ctx.roundRect) {
                  ctx.roundRect(bx, by, bw, bh, 4);
                  ctx.fill();
              } else {
                  ctx.fillRect(bx, by, bw, bh);
              }
              
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, p_bc.x, by + (bh/2));
          }
          ctx.restore();
      });

      // Resize Window Event - Resize Canvas & Re-center
      window.addEventListener('resize', resizeCanvas);
      
      // Zoom & Pan
      setupZoomPan();
      
      // Snapping
      setupSnapping();

      // Load Fonts
      loadFonts();

      // Hook events for Reactivity
      setupReactivity();

      // Hook History
      setupHistory();
      
      // Global Key Listener
      window.addEventListener('keydown', handleKeyDown);
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
                  canvas.value.requestRenderAll();
              }
          };
          window.addEventListener('mouseup', globalMouseUpHandler);
      }

      // Watch for project loaded state before loading canvas data
      // Use watchEffect to automatically re-evaluate when dependencies change
      const stopWatch = watchEffect(async () => {
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
                  stopWatch();
                  return;
              }

              isHistoryProcessing.value = true;

              try {
                  if (page.canvasData) {
                      console.log('📥 Carregando canvasData da página:', page.id);
                      // Restore label templates stored alongside the Fabric JSON
                      hydrateLabelTemplatesFromProjectJson(page.canvasData);
                      await canvas.value.loadFromJSON(page.canvasData);
                      rehydrateCanvasZones();

                      // Ensure objects have IDs restored if missing
                      const objs = canvas.value.getObjects();
                      console.log('📦 Objetos carregados:', objs.map((o: any) => ({ type: o.type, id: o.id, left: o.left, top: o.top, width: o.width, height: o.height })));
                      if (objs.length > 0 && objs[0].type === 'rect' && !objs[0].id) {
                          objs[0].set('id', 'artboard-bg');
                          console.log('✅ Artboard ID restaurado');
                      }

                      canvas.value.renderAll();
                  } else {
                      console.log('⚠️ Página sem canvasData, criando canvas vazio');
                  }

                  // Ensure Artboard is there
                  updateArtboard();
                  canvasObjects.value = [...canvas.value.getObjects()];
                  isHistoryProcessing.value = false;
                  historyStack.value = [];
                  historyIndex.value = -1;
                  saveCurrentState();
                  zoomToFit();

                  // Stop watching after successful load
                  console.log('✅ Carregamento concluído, parando watch');
                  stopWatch();
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
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('keydown', handleKeyDown);
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
let saveCurrentState = () => {}; 

const CANVAS_CUSTOM_PROPS = [
    // Identity / selection
    'id',
    '_customId',
    'name',
    'excludeFromExport',

    // Frames
    'isFrame',
    'clipContent',
    'parentFrameId',
    '_frameClipOwner',

    // Smart objects / cards
    'isSmartObject',
    'isProductCard',
    'smartGridId',
    'parentZoneId',
    '_cardWidth',
    '_cardHeight',
    'subTargetCheck',
    'interactive',

    // Product zone metadata
    'isGridZone',
    'isProductZone',
    '_zoneWidth',
    '_zoneHeight',
    '_zonePadding',
    '_zoneGlobalStyles',
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

    // Frame labels
    'isFrameLabel'
] as const;

const setupHistory = () => {
    if (!canvas.value) return;

    const saveState = () => {
        if (isHistoryProcessing.value) return; // Prevent loop
        
        // Remove redo stack if new action happens (standard history behavior)
        if (historyIndex.value < historyStack.value.length - 1) {
            historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
        }

        const json = canvas.value.toJSON([...CANVAS_CUSTOM_PROPS]);
        // Persist app-level metadata alongside Fabric JSON.
        (json as any)[LABEL_TEMPLATES_JSON_KEY] = serializeLabelTemplatesForProject();
        const jsonStr = JSON.stringify(json);
        
        historyStack.value.push(jsonStr);
        historyIndex.value = historyStack.value.length - 1;
        
        // Limit Stack
        if (historyStack.value.length > 50) {
            historyStack.value.shift();
            historyIndex.value--;
        }

        // --- SYNC WITH STORE ---
        if (project.activePageIndex >= 0) {
             updatePageData(project.activePageIndex, json);
             
             // Generate Thumbnail (Debounced ideally, but simplistic here)
             // We use a small multiplier to keep it light
             const dataURL = canvas.value.toDataURL({
                 format: 'jpeg',
                 quality: 0.5,
                 multiplier: 0.1 // 10% size
             });
             updatePageThumbnail(project.activePageIndex, dataURL);
        }
    }
    
    // Export for external use
    saveCurrentState = saveState;

    // Capture initial state
    saveState();

    // Fabric Events to trigger Save
    canvas.value.on('object:added', (e: any) => {
        if (!isHistoryProcessing.value) {
            saveState();
            triggerAutoSave(); // Auto-save to Contabo
        }
    });
    canvas.value.on('object:modified', (e: any) => {
        if (isHistoryProcessing.value) return;

        const obj = e?.target;
        // For zones, run our normalization/layout first and save only once (prevents unstable undo states).
        if (obj && isLikelyProductZone(obj)) {
            handleObjectModified(e);
            saveState();
            triggerAutoSave(); // Auto-save to Contabo
            return;
        }

        saveState();
        handleObjectModified(e);
        triggerAutoSave(); // Auto-save to Contabo
    });
    canvas.value.on('object:removed', (e: any) => {
        if (!isHistoryProcessing.value) {
            saveState();
            triggerAutoSave(); // Auto-save to Contabo
        }
    });
}

// --- Sync Logic (Herd Effect) ---
const handleObjectModified = (e: any) => {
    const obj = e.target;
    if (!obj) return;
    
    if (isLikelyProductZone(obj)) {
        ensureZoneSanity(obj);
        normalizeZoneScale(obj);
        recalculateZoneLayout(obj, undefined, { save: false });
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
    if (historyIndex.value > 0) {
        isHistoryProcessing.value = true;
        historyIndex.value--;
        const state = JSON.parse(historyStack.value[historyIndex.value] || '{}');
        hydrateLabelTemplatesFromProjectJson(state);
        
        await canvas.value.loadFromJSON(state);
        rehydrateCanvasZones();
        canvas.value.renderAll();
        // Refresh Reactivity
        const objs = canvas.value.getObjects();
        canvasObjects.value = [...objs];
        isHistoryProcessing.value = false;
    }
}

const redo = async () => {
    if (historyIndex.value < historyStack.value.length - 1) {
        isHistoryProcessing.value = true;
        historyIndex.value++;
        const state = JSON.parse(historyStack.value[historyIndex.value] || '{}');
        hydrateLabelTemplatesFromProjectJson(state);
        
        await canvas.value.loadFromJSON(state);
        rehydrateCanvasZones();
        canvas.value.renderAll();
        // Refresh Reactivity
        const objs = canvas.value.getObjects();
        canvasObjects.value = [...objs];
        isHistoryProcessing.value = false;
    }
}

const handleKeyDown = (e: KeyboardEvent) => {
    if (!canvas.value) return;
    
    // Ignore input fields so we don't trigger shortcuts while typing
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    const isCtrl = e.ctrlKey || e.metaKey;

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
        const active = canvas.value.getActiveObjects();
        if (active.length) {
            canvas.value.discardActiveObject();
            active.forEach((obj: any) => canvas.value.remove(obj));
            canvas.value.requestRenderAll();
            saveCurrentState();
        }
    }

    // Arrows Movement (Nudge) + Alt+Arrows para resize frames
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const active = canvas.value.getActiveObject();

        // Alt+Setas = Redimensionar frame de 1 pixel
        if (active && active.isFrame && e.altKey) {
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
    if (isCtrl && e.key === 'c') {
       const active = canvas.value.getActiveObject();
       if(active) {
            active.clone((cloned: any) => {
                (window as any)._clipboard = cloned;
            }, ['_customId']);
       }
    }

    if (isCtrl && e.key === 'v') {
        if ((window as any)._clipboard) {
            (window as any)._clipboard.clone((cloned: any) => {
                canvas.value.discardActiveObject();
                cloned.set({
                    left: cloned.left + 20,
                    top: cloned.top + 20,
                    evented: true,
                });

                // Assign new IDs
                if (cloned.type === 'activeSelection') {
                    cloned.canvas = canvas.value;
                    cloned.forEachObject((obj: any) => {
                         obj._customId = Math.random().toString(36).substr(2, 9);
                         canvas.value.add(obj);
                    });
                     cloned.setCoords();
                } else {
                     cloned._customId = Math.random().toString(36).substr(2, 9);
                     canvas.value.add(cloned);
                }

                canvas.value.setActiveObject(cloned);
                canvas.value.requestRenderAll();
                saveCurrentState();
            }, ['_customId']);
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

    // Undo/Redo Shortcuts (Ctrl+Z, Ctrl+Shift+Z)
    if (isCtrl && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
    }
}

const setupZoomPan = () => {
    if (!canvas.value) return; 

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
                 vpt[5] -= delta; // Pan Vertical
                 if (evt.shiftKey) { 
                     vpt[5] += delta; // Revert Vertical
                     vpt[4] -= delta; // Pan Horizontal
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
        // Standard interaction handled by Fabric
    });
    
    // Removed manual drag logic for gridZone as it conflicted with default behavior

    canvas.value.on('mouse:dblclick', (opt: any) => {
        if (opt.target) {
            if (opt.target.isGridZone) {
                // Save reference to the zone for later use during import
                targetGridZone.value = opt.target;
                // Open the Product Review Modal directly (same as Assets panel)
                showProductReviewModal.value = true;
            } else if (opt.target.type === 'polygon' || opt.target.type === 'polyline') {
                enterNodeEditing(opt.target);
            }
        }
    });
    
    // Node Moving Logic
    canvas.value.on('object:moving', (e: any) => {
        if (isNodeEditing.value && e.target.name === 'control_point') {
             const p = e.target;
             const parent = p.data.parentObj;
             const index = p.data.index;
             
             // Inverse transform canvas point to polygon local point
             // This requires inverting the object's matrix
             const matrix = parent.calcTransformMatrix();
             const invertMatrix = fabric.util.invertTransform(matrix);
             const localPoint = fabric.util.transformPoint({ x: p.left, y: p.top }, invertMatrix);
             
             // Update the specific point in the array
             // Adjust for pathOffset
             const finalX = localPoint.x + parent.pathOffset.x;
             const finalY = localPoint.y + parent.pathOffset.y;
             
             parent.points[index] = { x: finalX, y: finalY };
             
             // Force re-render of polygon (dirty hack, might need to reset dims)
             // parent.set({ dirty: true, objectCaching: false }); // Didn't work well in v5
             // Best way: Remove and re-add or set 'points' and initDimensions?
             // Fabric doesn't reactively update points.
             
             // Workaround: We wait until 'mouse:up' to commit changes to avoid heavy re-render loop
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
        
        // Commit Node Changes
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
        
        // Remove direct guide access here as they are scoped to setupSnapping
        // verticalGuide.set({ visible: false }); 
        // horizontalGuide.set({ visible: false });
        
        canvas.value.requestRenderAll();
        
        // Also ensure reactivity properties update on drop
        if (selectedObjectRef.value) {
             triggerRef(selectedObjectRef);
        }
    });
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
                    // Re-render canvas to apply fonts if any text was already rendered
                    if (canvas.value) canvas.value.requestRenderAll();
                }
            });
        })
    }
}

// --- Snapping (Guias Magnéticas) ---
const setupSnapping = () => {
    if (!canvas.value) return; 

    const snapRange = 10;
    
    // Create guides
    const verticalGuide = new fabric.Line([0, 0, 0, 10000], {
        stroke: 'cyan',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        opacity: 0.8,
        strokeDashArray: [4, 4],
        id: 'guide-vertical',
        excludeFromExport: true
    });
    
    const horizontalGuide = new fabric.Line([0, 0, 10000, 0], {
        stroke: 'cyan',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        visible: false,
        opacity: 0.8,
        strokeDashArray: [4, 4],
        id: 'guide-horizontal',
        excludeFromExport: true
    });

    canvas.value.add(verticalGuide);
    canvas.value.add(horizontalGuide);

    canvas.value.on('object:moving', (e: any) => {
        const obj = e.target;
        if (!obj || obj.isFrame) { 
             if (verticalGuide.visible) verticalGuide.set({ visible: false });
             if (horizontalGuide.visible) horizontalGuide.set({ visible: false });
             return; 
        }
        
        // === CONTAINMENT LOGIC FOR SMART OBJECT CHILDREN ===
        // If this object is inside a smart object group, restrict its movement
        if (obj.group && (obj.group as any).isSmartObject) {
            const parentGroup = obj.group;
            const cardW = (parentGroup as any)._cardWidth || parentGroup.width;
            const cardH = (parentGroup as any)._cardHeight || parentGroup.height;
            const halfW = cardW / 2;
            const halfH = cardH / 2;
            
            // Get object bounds (relative to group center)
            const objW = obj.getScaledWidth();
            const objH = obj.getScaledHeight();
            
            // Calculate min/max based on object origin
            let minX = -halfW;
            let maxX = halfW;
            let minY = -halfH;
            let maxY = halfH;
            
            // Adjust for object dimensions based on origin
            if (obj.originX === 'center') {
                minX = -halfW + objW / 2;
                maxX = halfW - objW / 2;
            } else if (obj.originX === 'left') {
                maxX = halfW - objW;
            }
            
            if (obj.originY === 'center') {
                minY = -halfH + objH / 2;
                maxY = halfH - objH / 2;
            } else if (obj.originY === 'top') {
                maxY = halfH - objH;
            }
            
            // Clamp position within bounds
            if (obj.left < minX) obj.set('left', minX);
            if (obj.left > maxX) obj.set('left', maxX);
            if (obj.top < minY) obj.set('top', minY);
            if (obj.top > maxY) obj.set('top', maxY);
            
            return; // Skip snapping for contained elements
        }
        
        // If this object is a product card inside a zone group, restrict to zone bounds
        if (obj.group && (obj.group as any).isProductZone) {
            const parentZone = obj.group;
            const zoneW = (parentZone as any)._zoneWidth || parentZone.width;
            const zoneH = (parentZone as any)._zoneHeight || parentZone.height;
            const halfW = zoneW / 2;
            const halfH = zoneH / 2;
            
            // Get card bounds
            const cardW = obj.getScaledWidth();
            const cardH = obj.getScaledHeight();
            
            // Calculate min/max based on card origin
            let minX = -halfW;
            let maxX = halfW - cardW;
            let minY = -halfH;
            let maxY = halfH - cardH;
            
            if (obj.originX === 'center') {
                minX = -halfW + cardW / 2;
                maxX = halfW - cardW / 2;
            }
            if (obj.originY === 'center') {
                minY = -halfH + cardH / 2;
                maxY = halfH - cardH / 2;
            }
            
            // Clamp position within zone bounds
            if (obj.left < minX) obj.set('left', minX);
            if (obj.left > maxX) obj.set('left', maxX);
            if (obj.top < minY) obj.set('top', minY);
            if (obj.top > maxY) obj.set('top', maxY);
            
            return; // Skip snapping for contained cards
        }

        // Snap to Artboard Center (Page Center)
        const pWidth = activePage.value ? activePage.value.width : 1080;
        const pHeight = activePage.value ? activePage.value.height : 1920;
        
        const centerX = pWidth / 2;
        const centerY = pHeight / 2;
        const objCenter = obj.getCenterPoint();

        let vVisible = false;
        let hVisible = false;

        // Snap X
        if (Math.abs(objCenter.x - centerX) < snapRange) {
            if (obj.originX === 'center') {
                obj.set('left', centerX);
            } else {
                obj.set('left', centerX - (obj.width * obj.scaleX / 2));
            }
            verticalGuide.set({ x1: centerX, y1: -5000, x2: centerX, y2: 5000 });
            vVisible = true;
        }

        // Snap Y
        if (Math.abs(objCenter.y - centerY) < snapRange) {
            if (obj.originY === 'center') {
                obj.set('top', centerY);
            } else {
                obj.set('top', centerY - (obj.height * obj.scaleY / 2));
            }
            horizontalGuide.set({ x1: -5000, y1: centerY, x2: 5000, y2: centerY });
            hVisible = true;
        }

        // Only render if visibility changed
        if (verticalGuide.visible !== vVisible || horizontalGuide.visible !== hVisible) {
            verticalGuide.set({ visible: vVisible });
            horizontalGuide.set({ visible: hVisible });
            canvas.value.requestRenderAll();
        }
    });

    canvas.value.on('mouse:up', () => {
        verticalGuide.set({ visible: false });
        horizontalGuide.set({ visible: false });
        canvas.value.requestRenderAll();
        
        // Also ensure reactivity properties update on drop
        if (selectedObjectRef.value) {
            // Force update to refresh X/Y in pannel
            triggerRef(selectedObjectRef);
        }
    });
}

// --- Reactivity & Layers Sync ---
const setupReactivity = () => {
    if (!canvas.value) return; 

    const updateObjects = () => {
        // We create a shallow copy array of objects. 
        // Important: Assign a unique ID if not present
        const objs = canvas.value.getObjects();
        objs.forEach((o: any) => {
            if (!o._customId) {
                o._customId = Math.random().toString(36).substr(2, 9);
            }
        });
        canvasObjects.value = [...objs];
    };

    const updateSelection = () => {
        const active = canvas.value.getActiveObject();
        selectedObjectId.value = active ? active._customId : null;
        selectedObjectRef.value = active; // Update ref for Properties Panel
        updateFloatingUI();
        
        // Sync Product Zone State
        if (active && isLikelyProductZone(active)) {
            ensureZoneSanity(active);
            const zoneRect = getZoneRect(active);
            // Initialize state from object data
            // We assume object has stored its config in data or properties
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
                isLocked: active.lockMovementX && active.lockMovementY,
                backgroundColor: zoneRect?.fill && zoneRect.fill !== 'transparent' ? zoneRect.fill : undefined,
                showBorder: (zoneRect?.strokeWidth ?? 0) > 0
            };
            // Use updateZone to sync state (initZone does not exist)
            productZoneState.updateZone(zoneConfig);
            const zoneStyles = (active as any)._zoneGlobalStyles;
            if (zoneStyles && typeof zoneStyles === 'object') {
                productZoneState.updateGlobalStyles(zoneStyles);
            }
        } else {
            // Do not clear immediately if clicking inside zone? 
            // Better to clear to avoid confusion.
            // productZoneState.clearZone(); 
        }
    }

    const updateFloatingUI = () => {
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

    canvas.value.on('object:added', updateObjects);
    canvas.value.on('object:removed', updateObjects);
    canvas.value.on('object:modified', updateObjects); 

    // Frames: auto-parent new objects when created inside a frame + keep clipPaths in sync
    canvas.value.on('object:added', (e: any) => {
        const obj = e?.target;
        if (!obj || obj.excludeFromExport) return;
        if (!obj._customId) obj._customId = Math.random().toString(36).substr(2, 9);

        if (!obj.parentFrameId) {
            const frame = findFrameUnderObject(obj);
            if (frame && frame._customId) obj.parentFrameId = frame._customId;
        }
        syncObjectFrameClip(obj);
    });

    canvas.value.on('object:modified', (e: any) => {
        const obj = e?.target;
        if (!obj || obj.excludeFromExport) return;

        maybeReparentToFrameOnDrop(obj);
        syncObjectFrameClip(obj);

        if (obj.isFrame) {
            getOrCreateFrameClipRect(obj);
            syncFrameClips(obj);
        }
    });

    canvas.value.on('object:modified', () => { 
        if(selectedObjectRef.value) triggerRef(selectedObjectRef); 
        updateScrollbars(); // Update scrollbars
        updateFloatingUI();
    });
    
    // Auto-Layout: When a product card is added, find its parent zone and trigger layout
    let layoutDebounceTimer: any = null;
    let pendingZones: Set<any> = new Set();
    
    canvas.value.on('object:added', (e: any) => {
        const obj = e.target;
        if (!obj || (!obj.isProductCard && !obj.isSmartObject)) return;
        
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
    canvas.value.on('object:moving', (e: any) => {
        updateFloatingUI();
        
        const target = e.target;
        // Frame moves its descendants (Figma-like parenting)
        if (target && target.isFrame) {
             const dx = target.left - lastFrameState.left;
             const dy = target.top - lastFrameState.top;

             if (frameChildrenCache.length === 0) {
                 frameChildrenCache = getFrameDescendants(target);
             }
             moveFrameDescendants(target, dx, dy, frameChildrenCache);
             lastFrameState.left = target.left;
             lastFrameState.top = target.top;
             getOrCreateFrameClipRect(target);
             return;
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
    });

    // Smart Scaling for Textbox Reflow & Product Zone AutoLayout
    canvas.value.on('object:scaling', (e: any) => {
        updateFloatingUI();
        const obj = e.target;

        // Frames: keep clip rect synced while resizing
        if (obj && obj.isFrame) {
            getOrCreateFrameClipRect(obj);
        }
        
        // 1. Textbox Reflow
        if (obj && obj.type === 'textbox' && obj.lockScalingY) {
            const w = obj.width * obj.scaleX;
            obj.set({
                width: w,
                scaleX: 1
            });
        }
        
        // 2. Zone Auto-Layout (Realtime Resize)
        if (obj && isLikelyProductZone(obj)) {
            ensureZoneSanity(obj);
            obj.setCoords();
            obj._zoneWidth = Math.abs(obj.getScaledWidth?.() ?? obj._zoneWidth ?? 0);
            obj._zoneHeight = Math.abs(obj.getScaledHeight?.() ?? obj._zoneHeight ?? 0);
            recalculateZoneLayout(obj, undefined, { save: false });
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
    // 1. Reset all smart objects to rigid mode (move as group)
    const resetDeepSelection = () => {
        const objs = canvas.value.getObjects();
        objs.forEach((o: any) => {
             if ((o.isSmartObject || o.isProductCard) && o.type === 'group') {
                 if (o.subTargetCheck) { 
                     // Only update if needed to avoid re-renders
                     o.set({ subTargetCheck: false, interactive: false });
                     if (o.getObjects) {
                         o.getObjects().forEach((c: any) => c.set({ 
                             selectable: false, 
                             evented: false,
                             hasControls: false,
                             hasBorders: false 
                         }));
                     }
                 }
             }
        });
        canvas.value.requestRenderAll();
    }

    // 2. Enable deep select on Double Click
    canvas.value.on('mouse:dblclick', (opt: any) => {
        const target = opt.target;
        if (!target) return;
        
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
                 });
             }
             canvas.value.requestRenderAll();
             return;
        }

        if ((target.isSmartObject || target.isProductCard) && target.type === 'group') {
             console.log('[DeepSelect] Entering group edit mode');
             target.set({
                 subTargetCheck: true,
                 interactive: true
             });
             if (target.getObjects) {
                 target.getObjects().forEach((child: any) => {
                     child.set({ 
                         selectable: true, 
                         evented: true,
                         hasControls: true, // Enable resize handles
                         hasBorders: true,   // Show selection border
                         lockMovementX: false,
                         lockMovementY: false,
                         lockScalingX: false,
                         lockScalingY: false,
                         lockRotation: false
                     });
                 });
             }
             canvas.value.requestRenderAll();
        }
    });

    // 3. Reset others when selecting a new object (unless it's a child of an active group)
    canvas.value.on('selection:created', (e: any) => {
        // If we select a group normally (single click), ensure it is rigid properly
        // If we select a child, the parent group must remain interactive.
        // Simple logic: Reset everything that is NOT the current parent.
        const selected = e.selected?.[0];
        if (selected) {
            // Find parent if it's a child
            const activeGroup = selected.group; 
            
            const objs = canvas.value.getObjects();
            objs.forEach((o: any) => {
                // If this object is NOT the active group and NOT the selected object
                if (o !== selected && o !== activeGroup) {
                    if ((o.isSmartObject || o.isProductCard) && o.type === 'group' && o.subTargetCheck) {
                        o.set({ subTargetCheck: false, interactive: false });
                        if(o.getObjects) {
                            o.getObjects().forEach((c: any) => c.set({ 
                                selectable: false, 
                                evented: false,
                                hasControls: false,
                                hasBorders: false
                            }));
                        }
                    }
                }
            });
        }
    });
    
    // Initial fetch
    updateObjects();
}

// Properties Updates
const updatePageSettings = (prop: string, value: any) => {
    if (prop === 'backgroundColor') {
        pageSettings.value.backgroundColor = value;
        if (canvas.value) {
            canvas.value.backgroundColor = value;
            canvas.value.requestRenderAll();
            saveCurrentState();
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
        
        triggerRef(selectedObjectRef);
        return;
    }

    if (!canvas.value) return; 
    const active = canvas.value.getActiveObject();
    
    if (active) {
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
            if (active.isFrame) getOrCreateFrameClipRect(active);
            if (active.isFrame) syncFrameClips(active);
            safeAddWithUpdate(active);
            active.setCoords?.();
            canvas.value.requestRenderAll();
            saveCurrentState();
            triggerRef(selectedObjectRef);
            return;
        }
        if (prop === 'strokeEnabled') {
            applyToActiveOrSelection((o) => toggleStroke(o, !!value));
            if (active.isFrame) getOrCreateFrameClipRect(active);
            if (active.isFrame) syncFrameClips(active);
            safeAddWithUpdate(active);
            active.setCoords?.();
            canvas.value.requestRenderAll();
            saveCurrentState();
            triggerRef(selectedObjectRef);
            return;
        }
        if (prop === 'cornerRadius') {
            const r = Math.max(0, Number(value || 0));
            applyToActiveOrSelection((o) => {
                if (o && (o as any).cornerRadii) delete (o as any).cornerRadii;
                o?.set?.({ rx: r, ry: r });
                applyRectCornerRadiiPatch(o);
            });
            if (active.isFrame) {
                getOrCreateFrameClipRect(active);
                syncFrameClips(active);
            }
            safeAddWithUpdate(active);
            active.setCoords?.();
            canvas.value.requestRenderAll();
            saveCurrentState();
            triggerRef(selectedObjectRef);
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
            saveCurrentState();
            triggerRef(selectedObjectRef);
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
                saveCurrentState();
                triggerRef(selectedObjectRef);
                return;
            }

            if (prop === 'width' || prop === 'height') {
                if (prop === 'width') active.set({ width: Number(value), scaleX: 1 });
                if (prop === 'height') active.set({ height: Number(value), scaleY: 1 });
                active.setCoords();
                getOrCreateFrameClipRect(active);
                syncFrameClips(active);
                canvas.value.requestRenderAll();
                saveCurrentState();
                triggerRef(selectedObjectRef);
                return;
            }

            if (prop === 'clipContent') {
                active.set('clipContent', !!value);
                syncFrameClips(active);
                canvas.value.requestRenderAll();
                saveCurrentState();
                triggerRef(selectedObjectRef);
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
                saveCurrentState();
                triggerRef(selectedObjectRef);
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
                    
                    recalculateZoneLayout(active, undefined, { save: false });
                    canvas.value.requestRenderAll();
                    saveCurrentState();
                    triggerRef(selectedObjectRef);
                    return;
                }
            }
            
            if (prop === 'scaleX' || prop === 'scaleY') {
                active.set(prop, value);
                normalizeZoneScale(active);
                recalculateZoneLayout(active, undefined, { save: false });
                canvas.value.requestRenderAll();
                saveCurrentState();
                triggerRef(selectedObjectRef);
                return;
            }
        }

        // Map common styling props to the correct child object when the selection is a group.
        // Fabric groups don't support fill/stroke/radius directly.
        if (isLikelyProductZone(active)) {
            const zoneRect = getZoneRect(active);
            if (zoneRect && ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'rx', 'ry'].includes(prop)) {
                if (prop === 'fill') zoneRect.set('fill', value);
                if (prop === 'stroke') zoneRect.set('stroke', value);
                if (prop === 'strokeWidth') zoneRect.set('strokeWidth', Number(value));
                if (prop === 'strokeDashArray') zoneRect.set('strokeDashArray', value);
                if (prop === 'rx') zoneRect.set({ rx: Number(value), ry: Number(value) });
                if (prop === 'ry') zoneRect.set('ry', Number(value));

                safeAddWithUpdate(active);
                active.setCoords();
                canvas.value.requestRenderAll();
                saveCurrentState();
                triggerRef(selectedObjectRef);
                return;
            }
        }

        if (active.type === 'group' && (active.isSmartObject || active.isProductCard)) {
            const bg = typeof active.getObjects === 'function'
                ? active.getObjects().find((o: any) => o.name === 'offerBackground')
                : null;
            if (bg && ['fill', 'stroke', 'strokeWidth', 'strokeDashArray', 'rx', 'ry'].includes(prop)) {
                if (prop === 'fill') bg.set('fill', value);
                if (prop === 'stroke') bg.set('stroke', value);
                if (prop === 'strokeWidth') bg.set('strokeWidth', Number(value));
                if (prop === 'strokeDashArray') bg.set('strokeDashArray', value);
                if (prop === 'rx') bg.set({ rx: Number(value), ry: Number(value) });
                if (prop === 'ry') bg.set('ry', Number(value));

                safeAddWithUpdate(active);
                active.setCoords();
                canvas.value.requestRenderAll();
                saveCurrentState();
                triggerRef(selectedObjectRef);
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
            active.set('shadow', currentShadow);
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
            const filterName = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize

            if (active.type === 'image' && typeof active.applyFilters === 'function') {
                active.filters = Array.isArray(active.filters) ? active.filters : [];
                // Remove existing filter of same type
                active.filters = active.filters.filter((f: any) => f.type !== filterName);

                // Add new filter if value is not 0 (or neutral)
                if (value !== 0) {
                    const options: any = {};
                    options[type] = value;
                    // Fabric.js 7: filters are in fabric.filters, not fabric.Image.filters
                    active.filters.push(new (fabric.filters as any)[filterName](options));
                }

                active.applyFilters();
            }
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
        
        canvas.value.requestRenderAll();
        saveCurrentState();
        // Force update ref
        triggerRef(selectedObjectRef);
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
        if (bg) bg.set('fill', value);
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

const handleAction = (action: string) => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    
    // Group / Ungroup
    if (action === 'group') {
        if (!active || active.type !== 'activeSelection') return;
        active.toGroup();
        canvas.value.requestRenderAll();
        saveCurrentState();
        // Update selection to the new group
        const newGroup = canvas.value.getActiveObject();
        if (newGroup) {
             if (!newGroup._customId) newGroup._customId = Math.random().toString(36).substr(2, 9);
             selectedObjectRef.value = newGroup;
        }
        return;
    }
    if (action === 'ungroup') {
        if (!active || active.type !== 'group') return;
        active.toActiveSelection();
        canvas.value.requestRenderAll();
        saveCurrentState();
        // Update selection
        selectedObjectRef.value = canvas.value.getActiveObject();
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
            selectedObjectRef.value = { ...target };
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
        obj.visible = !obj.visible;
        // Deselect if hidden
        if (!obj.visible) canvas.value.discardActiveObject();
        canvas.value.requestRenderAll();
        // Trigger update to refresh UI icons
        // (Fabric doesn't emit 'modified' on property set via code usually, need to force or rely on array ref update might not catch deep prop)
        // Since canvasObjects is shallow array, deep prop change might not trigger watcher if we had one. 
        // But our LayersPanel reads directly from the object prop. We might need to force update the array reference to trigger re-render of panel items.
        canvasObjects.value = [...canvas.value.getObjects()];
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
    }
}

const deleteObject = (id: string) => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        canvas.value.remove(obj);
        canvas.value.requestRenderAll();
    }
}

const moveLayer = (id: string, dir: 'up' | 'down') => {
    if (!canvas.value) return; 
    const obj = canvas.value.getObjects().find((o: any) => o._customId === id);
    if (obj) {
        if (dir === 'up') obj.bringForward();
        else obj.sendBackwards();
        
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

const performExport = () => {
    if (!canvas.value) return; 
    
    // Deselect for clean export
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();

    const { format, scale, quality } = exportSettings.value;
    const fileName = `design-export-${Date.now()}`;
    
    let dataURL = '';

    if (format === 'svg') {
        const svgContent = canvas.value.toSVG();
        const blob = new Blob([svgContent], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        downloadFile(url, `${fileName}.svg`);
    } else if (format === 'pdf') {
        // Simple PDF export (Canvas to Image to PDF usually requires jsPDF, 
        // here we'll export as high-res Image and browser print or use simple dataURL if library allowed)
        // Fabric doesn't do PDF natively without jspdf. 
        // We will fallback to PNG for this demo or just warn.
        console.warn("PDF requires external lib, exporting as PNG");
        dataURL = canvas.value.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: scale
        });
        downloadFile(dataURL, `${fileName}.png`);
    } else {
        // PNG or JPG
        dataURL = canvas.value.toDataURL({
            format: format,
            quality: quality,
            multiplier: scale
        });
        downloadFile(dataURL, `${fileName}.${format}`);
    }
    
    showExportModal.value = false;
}

const downloadFile = (url: string, name: string) => {
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    isHistoryProcessing.value = true;
    hydrateLabelTemplatesFromProjectJson(json);
    await canvas.value.loadFromJSON(json);
    rehydrateCanvasZones();
    
    // REPAIR LEGACY OBJECTS: Fix grouping for loaded objects
    const loadedObjs = canvas.value.getObjects();
    loadedObjs.forEach((obj: any) => {
        if ((obj.isSmartObject || obj.isProductCard) && obj.type === 'group') {
             // Force disable subSelection for legacy cards
             obj.set({
                subTargetCheck: false,
                interactive: false
             });
             // Fix children
             if(obj.getObjects) {
                 obj.getObjects().forEach((child: any) => {
                     child.set({ selectable: false, evented: false });
                 });
             }
             obj.setCoords();
        }
    });
    
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
    if (!canvas.value) return { x: 100, y: 100 };
    const vpt = canvas.value.viewportTransform;
    if (!vpt) return { x: canvas.value.width / 2, y: canvas.value.height / 2 };
    
    // Invert transform to find canvas coordinates of the viewport center
    const width = canvas.value.getWidth();
    const height = canvas.value.getHeight();
    const invertedVpt = fabric.util.invertTransform(vpt);
    const centerPoint = fabric.util.transformPoint({ x: width / 2, y: height / 2 }, invertedVpt);
    
    return centerPoint;
}

const { uploadFile } = useUpload()

const insertAssetToCanvas = async (asset: any) => {
    if (!canvas.value || !fabric) return;
    if (!asset?.url) return;

    try {
        const center = getCenterOfView();
        const img: any = await fabric.Image.fromURL(asset.url, { crossOrigin: 'anonymous' });

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
                         const img = await fabric.Image.fromURL(result.url, { crossOrigin: 'anonymous' });
                         if (img) {
                            const center = getCenterOfView();
                            img.set({
                                left: center.x,
                                top: center.y,
                                originX: 'center',
                                originY: 'center'
                            });
                             // Scale down if huge
                             if (img.width > 500) {
                                 img.scaleToWidth(500);
                             }
                             
                             (img as any)._customId = Math.random().toString(36).substr(2, 9);
                             
                             canvas.value.add(img);
                             canvas.value.setActiveObject(img);
                             canvas.value.requestRenderAll();
                             saveCurrentState();
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

const addShape = (type: 'rect' | 'circle' | 'triangle' | 'star' | 'polygon' | 'line' | 'arrow') => {
    if (!canvas.value) return; 
    let shape;
    const center = getCenterOfView();
    const opts = { left: center.x - 50, top: center.y - 50, fill: '#cccccc', stroke: '#cccccc', strokeWidth: 2 };
    
    if (type === 'rect') {
        shape = new fabric.Rect({ ...opts, width: 100, height: 100 });
    } else if (type === 'circle') {
        shape = new fabric.Circle({ ...opts, radius: 50 });
    } else if (type === 'triangle') {
        shape = new fabric.Triangle({ ...opts, width: 100, height: 100 });
    } else if (type === 'polygon') {
        const points = [
            { x: 50, y: 0 }, { x: 100, y: 38 }, { x: 82, y: 100 }, 
            { x: 18, y: 100 }, { x: 0, y: 38 }
        ];
        shape = new fabric.Polygon(points, opts);
    } else if (type === 'star') {
        const points = [
            {x: 50, y: 0}, {x: 61, y: 35}, {x: 98, y: 35}, {x: 68, y: 57}, 
            {x: 79, y: 91}, {x: 50, y: 70}, {x: 21, y: 91}, {x: 32, y: 57}, 
            {x: 2, y: 35}, {x: 39, y: 35}
        ];
        shape = new fabric.Polygon(points, opts);
    } else if (type === 'line') {
        shape = new fabric.Line([0, 0, 200, 0], { ...opts, left: center.x - 100, top: center.y });
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

const addText = () => {
    if (!canvas.value) return; 
    setTool('select'); // Ensure we exit drawing mode
    const center = getCenterOfView();
    const text = new fabric.IText('Seu Texto', {
        left: center.x - 60, top: center.y - 20, // Approx centered text
        fontFamily: 'Arial',
        fill: '#333333',
        fontSize: 40
    });
    
    (text as any)._customId = Math.random().toString(36).substr(2, 9);
    canvas.value.add(text);
    canvas.value.setActiveObject(text);
    canvas.value.requestRenderAll();
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

// Smart Object Generator (Product Card)
const createSmartObject = async (product: any, x: number, y: number, width: number, height: number, gridId: string, labelTpl?: LabelTemplate) => {
    // Layout Constants
    const cardHeight = height || width * 1.4; // Aspect ratio 1:1.4 (fallback)
    const halfW = width / 2;
    const halfH = cardHeight / 2;
    const baseSize = Math.min(width, cardHeight);
    
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
    const title = new fabric.Textbox(product.name.toUpperCase(), {
        fontSize: baseSize * 0.09,
        fontFamily: 'Inter',
        fontWeight: '900',
        fill: '#ffffff',
        textAlign: 'center',
        originX: 'center',
        originY: 'top',
        left: 0, // Centered horizontally
        top: titleY,
        width: width - 20,
        name: 'smart_title',
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 4, offsetX: 2, offsetY: 2 }),
        // UX: Prevent font stretching/blurring, enforce reflow
        lockScalingY: true, 
        splitByGrapheme: false
    });

    // 3. Product Image (Middle)
    let imgObj: any = null;
    const imgUrl = product.imageUrl || product.image || product.url;
    const imageY = 0; // Centered vertically
    
    if (imgUrl) {
        try {
            imgObj = await fabric.Image.fromURL(imgUrl, { crossOrigin: 'anonymous' });
            
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

    // 4. Price Tag (Bottom)
    const marginBottom = cardHeight * 0.05;

    // Price Value (shared)
    const priceStr = String(product.price ?? '')
        .replace(/R\\$\\s*/gi, '')
        .replace(/\\s+/g, '')
        .trim();

    const unitText = (product as any).weight || (product as any).packUnit;

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
        const hasWholesale = !!String((product as any).priceWholesale || '').trim();
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
    const group = new fabric.Group([bg, imgObj, title, priceTagGroup], {
        left: x,
        top: y,
        originX: 'center',
        originY: 'center',
        isSmartObject: true,
        smartGridId: gridId,
        subTargetCheck: true,
        interactive: true
    });
    
    // Store card dimensions for containment checking (used by object:moving handler)
    (group as any)._cardWidth = width;
    (group as any)._cardHeight = cardHeight;

    // Persist pricing metadata on the card so label templates can be reapplied safely.
    (group as any).priceWholesale = (product as any).priceWholesale ?? null;
    (group as any).wholesaleTrigger = (product as any).wholesaleTrigger ?? null;
    (group as any).wholesaleTriggerUnit = (product as any).wholesaleTriggerUnit ?? null;
    (group as any).packQuantity = (product as any).packQuantity ?? null;
    (group as any).packUnit = (product as any).packUnit ?? null;
    (group as any).packageLabel = (product as any).packageLabel ?? null;
    
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
    // Default caching on
    group.set({
        objectCaching: true, 
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
                
                const result = await $fetch('/api/process-product-image', {
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
    showProductReviewModal.value = true;
    
    // Reset paste input (but keep data for review)
    pasteListText.value = '';
    pastedImage.value = null;
}

// Confirm import from review modal
const confirmProductImport = async (products: any[]) => {
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
    await simulateSmartGrid(products, { margin: 10, gap: 15, orphanBehavior: 'fill' }, zone);
    
    // Clear review state and zone reference
    reviewProducts.value = [];
    targetGridZone.value = null;
    
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

const handleRemoveBackground = () => {
    // ... Existing logic stub
}

const handleFileUpload = (e: any) => {
    // ... Existing logic stub
}

const addGridZone = () => {
    if (!canvas.value) return;
    
    const center = getCenterOfView();
    // Create a nicer placeholder zone
    // Background with Glass/Dark aesthetic
    const zone = new fabric.Rect({
        width: 400, 
        height: 600, 
        fill: 'transparent', 
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

    canvas.value.add(group);
    canvas.value.setActiveObject(group);
    canvas.value.requestRenderAll();
}

const simulateSmartGrid = async (customData: any[] = [], config = { margin: 10, gap: 15, orphanBehavior: 'fill' }, zone: any = null) => {
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
            // Check custom property safely
            const isZone = (activeObj as any).isGridZone;
            
            if (isZone) {
                targetZone = activeObj;
            } else if (activeObj.type === 'group' && !isZone) {
                templateObject = activeObj;
            }
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

    // 3. Prepare Data
    let products = Array.isArray(customData) && customData.length > 0 ? customData : MOCK_PRODUCTS;
    const count = products.length;
    console.log('[simulateSmartGrid] products count:', count);
    if (count === 0) {
        console.warn('[simulateSmartGrid] No products to render!');
        return;
    }

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
        
        const gridLayout = calculateGridLayout(zoneConfig, count);
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
    const lastRowItemCount = count % cols || cols;

    if (targetZone) {
        const hasFixedColumns = typeof targetZone.columns === 'number' && targetZone.columns > 0;
        targetZone._zonePadding = padding;
        targetZone.set({
            padding: 0,
            gapHorizontal: gapX,
            gapVertical: gapY,
            lastRowBehavior: lastRowBehavior,
            columns: hasFixedColumns ? targetZone.columns : 0,
            rows: hasFixedColumns ? totalRows : 0
        });
    }

    isProcessing.value = true;

    try {
        const zoneTplId = targetZone ? ((targetZone as any)._zoneGlobalStyles?.splashTemplateId as (string | undefined)) : undefined;
        const zoneTpl = zoneTplId ? labelTemplates.value.find(t => t.id === zoneTplId) : undefined;

        const promises = products.map(async (product: any, index: number) => {
            const currentRow = Math.floor(index / cols);
            const currentCol = index % cols;
            
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
            
            console.log(`[simulateSmartGrid] Product ${index}: xOffset=${xOffset}, yOffset=${yOffset}, finalX=${finalX}, finalY=${finalY}, itemW=${itemWidth}, itemH=${itemHeight}`);

            // Generate Object
            if (templateObject) {
                 // Clone using Promise API (Fabric v6+)
                 const cloned: any = await templateObject.clone(['name', 'id', 'smartGridId', 'isSmartObject', 'originX', 'originY']);
                 
                  cloned.set({
                     left: finalX,
                     top: finalY,
                     smartGridId: batchGridId,
                     opacity: 1,
                     visible: true,
                     originX: 'center',
                     originY: 'center',
                     subTargetCheck: false, // Disable sub-target for cohesive card movement
                     interactive: false // Card moves as a whole
                  });
                 
                 // Data Injection Logic
                 const objects = cloned.getObjects ? cloned.getObjects() : [];
                 let titleFound = false;
                 let priceFound = false;

                 objects.forEach((obj: any) => {
                    if (obj.type.includes('text')) {
                        if (obj.name === 'smart_title') {
                            obj.set('text', product.name);
                            titleFound = true;
                        } else if (obj.name === 'smart_price') {
                            obj.set('text', product.price);
                            priceFound = true;
                        }
                    }
                 });

                 // Fallback
                 if (!titleFound || !priceFound) {
                     const texts = objects.filter((o: any) => o.type.includes('text'));
                     if (texts.length >= 1 && !titleFound) texts[0].set('text', product.name);
                     if (texts.length >= 2 && !priceFound) texts[1].set('text', product.price);
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

            // Remove previous cards from the zone
            existingCards.forEach((card: any) => canvas.value.remove(card));

            // IMPORTANT: For Fabric.js groups, internal object positions are relative to the GROUP CENTER
            // The zone has originX: 'center', originY: 'center', so we need to offset by half the zone dimensions
            const zoneWidth = zoneRect?.width || zoneBounds.width || 400;
            const zoneHeight = zoneRect?.height || zoneBounds.height || 600;

            // DON'T add to zone group - add directly to canvas to avoid coordinate issues
            // This is the Figma-like behavior where elements are independent
            smartObjects.forEach((obj: any) => {
                obj.isProductCard = true;
                obj.parentZoneId = targetZone._customId;
                canvas.value.add(obj);
                // Fabric v7 uses bringObjectToFront; older builds sometimes expose bringToFront on canvas.
                const c: any = canvas.value as any;
                if (typeof c.bringObjectToFront === 'function') c.bringObjectToFront(obj);
                else if (typeof c.bringToFront === 'function') c.bringToFront(obj);
                else if (typeof (obj as any).bringToFront === 'function') (obj as any).bringToFront();
            });

            targetZone.set({
                isProductZone: true,
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
                recalculateZoneLayout(targetZone, smartObjects);
            } catch (calcErr) {
                console.warn('Grid layout recalc error:', calcErr);
            }

            // Select the first created object
            if (smartObjects.length > 0) {
                canvas.value.setActiveObject(smartObjects[0]);
            }
        } else {
            // No zone - add directly to canvas (old behavior)
            smartObjects.forEach((obj: any) => {
                console.log('[simulateSmartGrid] Adding object to canvas:', obj);
                canvas.value.add(obj);
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

const handleUpdateZone = (prop: string, val: any) => {
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
        recalculateZoneLayout(zone, undefined, { save: false });
    }

    canvas.value.requestRenderAll();
    if (opts.save !== false) saveCurrentState();
    triggerRef(selectedObjectRef);
};

const updateZoneOnCanvas = (prop: string, val: any) => {
    const active = canvas.value.getActiveObject();
    if (!active || !isLikelyProductZone(active)) return;
    applyZoneUpdates(active, { [prop]: val });
}

const applyGlobalStylesToCards = (styles: Partial<GlobalStyles>, zone?: any) => {
    if (!canvas.value) return;
    const list = zone && isLikelyProductZone(zone)
        ? getZoneChildren(zone)
        : canvas.value.getObjects().filter((o: any) => (o.isSmartObject || o.isProductCard) && o.type === 'group');

    list.forEach((card: any) => {
        if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') return;
        const objs = card.getObjects();
        const bg = objs.find((o: any) => o.name === 'offerBackground');

        if (bg && bg.type === 'rect') {
            if (styles.isProdBgTransparent) bg.set('fill', 'transparent');
            else if (styles.cardColor) bg.set('fill', styles.cardColor);

            if (typeof styles.cardBorderRadius === 'number') {
                bg.set({ rx: styles.cardBorderRadius, ry: styles.cardBorderRadius });
            }
            if (styles.cardBorderColor) bg.set('stroke', styles.cardBorderColor);
            if (typeof styles.cardBorderWidth === 'number') bg.set('strokeWidth', styles.cardBorderWidth);
        }

        const priceGroup = objs.find((o: any) => o.name === 'priceGroup');
        if (priceGroup && priceGroup.type === 'group' && typeof priceGroup.getObjects === 'function') {
            const parts = priceGroup.getObjects();
            const priceBg = parts.find((o: any) => o.name === 'price_bg');
            const priceText = parts.find((o: any) => o.name === 'price_value_text' || o.name === 'smart_price');

            const accent = styles.splashColor ?? styles.accentColor;
            if (priceBg && accent) {
                priceBg.set('stroke', accent);
                if (fabric?.Shadow) {
                    const blur = priceBg.shadow?.blur ?? 12;
                    priceBg.set('shadow', new fabric.Shadow({ color: accent, blur, offsetX: 0, offsetY: 0 }));
                }
            }

            if (priceText && styles.splashTextColor) {
                priceText.set('fill', styles.splashTextColor);
            }

            // Reflow price parts in case the font or card size changed.
            const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? 0;
            const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? 0;
            if (cardW && cardH) layoutPriceGroup(priceGroup, cardW, cardH);
            safeAddWithUpdate(priceGroup);
        }

        safeAddWithUpdate(card);
        card.setCoords();
    });
};

const handleApplyZonePreset = (presetId: string) => {
    productZoneState.applyPreset(presetId);
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    if (!active || !isLikelyProductZone(active)) return;
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
    const active = canvas.value.getActiveObject();
    if (!active || !isLikelyProductZone(active)) return;
    const z = productZoneState.productZone.value;
    applyZoneUpdates(active, {
        padding: z.padding,
        gapHorizontal: z.gapHorizontal ?? z.padding,
        gapVertical: z.gapVertical ?? z.padding
    });
};

const handleUpdateGlobalStyles = async (prop: string, val: any) => {
    productZoneState.updateGlobalStyles({ [prop]: val });
    if (!canvas.value) return;

    const active = canvas.value.getActiveObject();
    const zone = active && isLikelyProductZone(active) ? active : null;

    // Persist styles on the zone so they survive undo/redo and reload.
    if (zone) {
        const prev = (zone as any)._zoneGlobalStyles ?? {};
        (zone as any)._zoneGlobalStyles = { ...prev, [prop]: val };
    }

    const stylesToApply: Partial<GlobalStyles> = zone
        ? ((zone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value)
        : productZoneState.globalStyles.value;

    // Special case: label template swap needs to rebuild each card's price group.
    if (prop === 'splashTemplateId' && zone) {
        await applyLabelTemplateToZone(zone, val);
        triggerRef(selectedObjectRef);
        return;
    }

    applyGlobalStylesToCards(stylesToApply, zone || undefined);
    canvas.value.requestRenderAll();
    saveCurrentState();
    triggerRef(selectedObjectRef);
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
    const s = String(raw ?? '').replace(/R\$\s*/gi, '').trim();
    const m = s.match(/^(\d+)(?:[.,](\d{1,2}))?/);
    const integer = m?.[1] || '0';
    const dec = (m?.[2] || '00').padEnd(2, '0').slice(0, 2);
    return { integer, dec };
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

    const price = data?.price ?? null;
    const priceWholesale = data?.priceWholesale ?? null;

    const hasRetail = !!String(price || '').trim();
    const hasWholesale = !!String(priceWholesale || '').trim();

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
        const parts = splitPriceParts(price);
        setText(retailInteger, parts.integer);
        setText(retailDecimal, `,${parts.dec}`);
    }

    if (hasWholesale) {
        const parts = splitPriceParts(priceWholesale);
        setText(wholesaleInteger, parts.integer);
        setText(wholesaleDecimal, `,${parts.dec}`);
    }

    // Unit label: prefer packUnit ("UN") and fall back to inferred unit from weight (e.g. "KG").
    const unitFromPack = String(data?.packUnit ?? '').trim();
    const unit = (unitFromPack || String(data?.unit ?? '').trim() || String(data?.weight ?? '').trim()).toUpperCase().replace(/\s+/g, '');
    const unitLabel = unit ? unit.replace(/^\d+(?:[.,]\d+)?/, '') : '';
    if (retailUnit) setText(retailUnit, unitLabel);
    if (wholesaleUnit) setText(wholesaleUnit, unitLabel);

    const packageLabel = String(data?.packageLabel ?? data?.wholesaleTriggerUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const packQuantity = Number.parseInt(String(data?.packQuantity ?? '').replace(/[^\d]/g, ''), 10);
    const packUnit = String(data?.packUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');

    const retailCents = parsePriceToCents(price);
    const wholesaleCents = parsePriceToCents(priceWholesale);
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
        const trig = data?.wholesaleTrigger;
        const trigN = typeof trig === 'number' ? trig : Number.parseInt(String(trig ?? '').replace(/[^\d]/g, ''), 10);
        const unitTok = String(data?.wholesaleTriggerUnit ?? packageLabel ?? '').trim().toUpperCase().replace(/\s+/g, '');
        const label = Number.isFinite(trigN) && trigN > 0 && unitTok ? `ACIMA ${trigN} ${unitTok}` : 'ATACADO';
        setText(bannerText, `\u2605 ${label} \u2605`);
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

    const totalW = clamp(cardW * 0.98, 160, cardW);
    const ratio = (showRetail && showWholesale) ? 0.30 : 0.22;
    const totalH = clamp(cardH * ratio, 70, Math.max(70, cardH * 0.45));

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

    if (showRetail) setBg(retailBg, retailH, retailCY, Math.max(6, Math.min(18, totalH * 0.08)));
    if (showBanner && bannerBg) setBg(bannerBg, bannerH, bannerCY, Math.max(4, Math.min(12, totalH * 0.05)));
    if (showWholesale) setBg(wholesaleBg, wholesaleH, wholesaleCY, Math.max(6, Math.min(18, totalH * 0.08)));

    const setTextSizing = (txt: any, defaultScale: number, baseH: number) => {
        if (!txt || !String(txt.type || '').includes('text')) return;
        const scale = typeof txt.__fontScale === 'number' ? txt.__fontScale : defaultScale;
        txt.set({ fontSize: baseH * scale, scaleX: 1, scaleY: 1 });
        if (typeof txt.initDimensions === 'function') txt.initDimensions();
    };
    const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0);

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

        const padX = totalW * 0.06;
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


function layoutPriceGroup(priceGroup: any, cardW: number, cardH: number) {
    if (!priceGroup || !priceGroup.getObjects) return null;

    // Atacarejo template (2-tier label)
    try {
        const deep = collectObjectsDeep(priceGroup);
        if (findByName(deep, 'atac_retail_bg')) {
            return layoutAtacarejoPriceGroup(priceGroup, cardW, cardH);
        }
    } catch (_) {
        // fall through to legacy layout
    }
    
    const all = priceGroup.getObjects();
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
    
    if (!priceBg || !currencyCircle || !currencyText) return null;
    
    const pillH = cardH * 0.18;
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

    const getW = (t: any) => (t && typeof t.getScaledWidth === 'function' ? t.getScaledWidth() : 0);
    const calcTextWidth = () =>
        hasSplit
            ? (getW(priceInteger) +
                  getW(priceDecimal) +
                  (priceUnit && priceUnit.visible !== false && String(priceUnit.text || '').trim()
                      ? (getW(priceUnit) + textGap)
                      : 0))
            : getW(priceText);

    let textWidth = calcTextWidth();
    const basePillW = cardW * 0.85;
    const maxPillW = cardW * 0.98;
    const minPillW = textWidth + (circleSize * 0.85) + textGap + rightPad;
    let pillW = Math.min(Math.max(basePillW, minPillW), maxPillW);
    
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
    
    priceBg.set({
        width: pillW,
        height: pillH,
        rx: pillH / 2,
        ry: pillH / 2,
        originX: 'center',
        originY: 'center',
        left: 0,
        top: 0
    });

    // Keep the "neon" border/glow proportional to the pill size (prevents losing the pattern on resize).
    const strokeW = Math.max(1, Math.min(4, pillH * 0.04));
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
                rx: pillH / 2,
                ry: pillH / 2,
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
                const unitY = (typeof priceUnit.__yOffsetRatio === 'number' ? priceUnit.__yOffsetRatio : 0.24) * pillH;
                const decW = getW(priceDecimal);
                priceUnit.set({ originX: 'left', originY: 'center', left: textStartX + intW + decW + textGap, top: unitY });
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

    // If a full card group is selected, grab its internal price group.
    if (obj.type === 'group' && typeof obj.getObjects === 'function') {
        const children = obj.getObjects();
        const pg = children.find((o: any) => o && o.type === 'group' && o.name === 'priceGroup');
        if (pg) return pg;
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

    const cleaned = String(rawPrice || '')
        .replace(/R\\$\\s*/gi, '')
        .replace(/\\s+/g, '')
        .trim();

    const m = cleaned.match(/^(\\d+)(?:[\\.,](\\d{1,2}))?/);
    const integer = m?.[1] || '0';
    const dec = (m?.[2] || '00').padEnd(2, '0').slice(0, 2);
    const decimalText = `,${dec}`;

    if (intTxt && decTxt) {
        intTxt.set?.('text', integer);
        decTxt.set?.('text', decimalText);
        if (typeof intTxt.initDimensions === 'function') intTxt.initDimensions();
        if (typeof decTxt.initDimensions === 'function') decTxt.initDimensions();

        if (unitTxt) {
            const u = String(unitText || unitTxt.text || '').trim();
            unitTxt.set?.('text', u ? u.toUpperCase() : '');
            if (typeof unitTxt.initDimensions === 'function') unitTxt.initDimensions();
        }
        return;
    }

    if (legacy) legacy.set?.('text', `${integer}${decimalText}`);
}

function inferUnitFromCard(card: any): string | undefined {
    if (!card || typeof card.getObjects !== 'function') return undefined;
    const title = card.getObjects().find((o: any) => o?.name === 'smart_title' || o?.name === 'title');
    const text = String(title?.text || '').toLowerCase();
    const m = text.match(/\\b\\d+(?:[\\.,]\\d+)?\\s*(kg|g|mg|l|ml|un)\\b/i);
    if (!m) return undefined;
    const raw = m[0].replace(/\\s+/g, '');
    return raw.toUpperCase();
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
        sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 1 });
        sc.dispose();
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
}

function deleteLabelTemplateById(templateId: string) {
    const t = labelTemplates.value.find(x => x.id === templateId);
    if (t?.isBuiltIn) return;
    labelTemplates.value = (labelTemplates.value || []).filter(x => x.id !== templateId);
    saveCurrentState();
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
    labelTemplates.value = [...labelTemplates.value, copy];
    saveCurrentState();
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
        ? oldUnitText
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
    const pillW = cardW * 0.85;
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

    const cleaned = String(priceStr || '').replace(/R\\$\\s*/gi, '').trim();
    const m = cleaned.match(/^(\\d+)(?:[\\.,](\\d{1,2}))?/);
    const integer = m?.[1] || '0';
    const dec = (m?.[2] || '00').padEnd(2, '0').slice(0, 2);

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

    const u = String(unitText || '').trim();
    const priceUnit = new fabric.IText(u ? u.toUpperCase() : '', {
        fontSize: pillH * 0.26,
        fontFamily: 'Inter',
        fontWeight: '800',
        fill: '#ffffff',
        originX: 'left',
        originY: 'center',
        left: 0,
        top: 0,
        name: 'price_unit_text',
        __fontScale: 0.26,
        __yOffsetRatio: 0.24,
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
    const inferredUnit = oldUnitText && oldUnitText.trim().length ? oldUnitText : inferUnitFromCard(card);

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

async function applyLabelTemplateToZone(zone: any, templateId?: string) {
    if (!canvas.value || !zone || !isLikelyProductZone(zone)) return;
    const id = templateId || undefined;
    const prev = (zone as any)._zoneGlobalStyles ?? {};
    (zone as any)._zoneGlobalStyles = { ...prev, splashTemplateId: id };

    // Apply to every card in the zone.
    const cards = getZoneChildren(zone);
    for (const card of cards) {
        if (id) await applyLabelTemplateToCard(card, id);
        else await resetCardPriceGroupToDefault(card);
    }

    // Also re-apply colors/text style if the zone has global styles.
    const styles = (zone as any)._zoneGlobalStyles ?? productZoneState.globalStyles.value;
    applyGlobalStylesToCards(styles, zone);

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

        const img: any = await fabric.Image.fromURL(uploaded.url, { crossOrigin: 'anonymous' });
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
            });
        }
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
            });
        }
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
const resizeSmartObject = (group: any, w: number, h: number) => {
    // Reset Group Scale/Skew to ensure clean internal layout
    group.scale(1);
    group.set({ width: w, height: h });
    
    const halfW = w / 2;
    const halfH = h / 2;
    const objects = group.getObjects();
    
    const bg = objects.find((o: any) => o.name === 'offerBackground');
    const title = objects.find((o: any) => o.name === 'smart_title');
    const img = objects.find((o: any) => o.name === 'smart_image');
    // Splash can vary names, find by exclusion or property
    const splash = objects.find((o: any) => o.name === 'smart_price' || o.name === 'smart_splash' || (o.type === 'group' && o !== bg));
    
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
        } else {
             bg.set({ scaleX: w / bg.width, scaleY: h / bg.height, left: 0, top: 0, originX: 'center', originY: 'center' });
        }
    }
    
    // 2. Title (Top)
    let titleH = 0;
    if (title) {
        // Margin Top: 5% of height
        const marginTop = h * 0.05;
        title.set({
            originX: 'center',
            originY: 'top',
            left: 0,
            top: -halfH + marginTop,
            scaleX: 1, scaleY: 1
        });
        
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
    
    // 3. Bottom Element (Splash/Price)
    let bottomH = 0;
    if (splash) {
        const marginBottom = h * 0.05;
        
        if (splash.type === 'group' && splash.name === 'priceGroup') {
            const layout = layoutPriceGroup(splash, w, h);
            
            if (layout) {
                const { pillH } = layout;
                splash.set({
                    scaleX: 1,
                    scaleY: 1,
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: halfH - (pillH / 2) - marginBottom
                });
                
                bottomH = pillH + marginBottom;
            } else {
                // Fallback to generic scaling for older cards without named parts
                let sScale = splash.scaleX;
                if ((splash.width * sScale) > w * 0.9) {
                    sScale = (w * 0.9) / splash.width;
                }
                
                const maxSplashH = h * 0.35;
                if ((splash.height * sScale) > maxSplashH) {
                    sScale = maxSplashH / splash.height;
                }
                
                splash.set({
                    scaleX: sScale,
                    scaleY: sScale,
                    originX: 'center',
                    originY: 'bottom',
                    left: 0,
                    top: halfH - marginBottom
                });
                
                bottomH = (splash.height * sScale) + marginBottom;
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
            
            splash.set({
                scaleX: sScale,
                scaleY: sScale,
                originX: 'center',
                originY: 'bottom',
                left: 0,
                top: halfH - marginBottom
            });
            
            bottomH = (splash.height * sScale) + marginBottom;
        }
    }
    
    // 4. Image (Middle - Object Fit: Contain)
    if (img) {
        const availH = h - titleH - bottomH - 20; // 20px buffer
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
            const centerY = (-halfH + titleH) + (availH / 2);
            
            img.set({
                scaleX: scale,
                scaleY: scale,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: centerY
            });
            img.visible = true;
        } else {
             img.visible = false; // Hide if no space
        }
    }

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
    if (obj.type !== 'group') return false;
    const rect = getZoneRect(obj);
    return !!(rect && Array.isArray(rect.strokeDashArray));
}

const ensureZoneSanity = (zone: any) => {
    if (!zone) return;
    if (!zone._customId) zone._customId = Math.random().toString(36).substr(2, 9);
    let needsBoundsUpdate = false;

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
    const rect = getZoneRect(zone);
    const rectScaleX = rect?.scaleX ?? 1;
    const rectScaleY = rect?.scaleY ?? 1;
    const baseWidth = rect?.width ? rect.width * rectScaleX : zone.width;
    const baseHeight = rect?.height ? rect.height * rectScaleY : zone.height;
    const scaleX = Math.abs(zone.scaleX ?? 1);
    const scaleY = Math.abs(zone.scaleY ?? 1);
    const width = baseWidth ? baseWidth * scaleX : zone.getScaledWidth?.() ?? 0;
    const height = baseHeight ? baseHeight * scaleY : zone.getScaledHeight?.() ?? 0;
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
    
    return objs.filter((o: any) => {
        if (o === zone) return false;
        if (!o.isProductCard && !o.isSmartObject) return false;
        if (o.visible === false) return false;
        
        if (o.parentZoneId === zone._customId) return true;
        
        const objBounds = o.getBoundingRect();
        const isInside = 
            objBounds.left >= zoneBounds.left &&
            objBounds.top >= zoneBounds.top &&
            objBounds.left + objBounds.width <= zoneBounds.left + zoneBounds.width &&
            objBounds.top + objBounds.height <= zoneBounds.top + zoneBounds.height;
        
        const intersects = zone.intersectsWithObject(o);
        if (isInside || intersects) {
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
    
    // 2. Sort by visual order (Top-Left to Bottom-Right)
    cards.sort((a: any, b: any) => {
        const rowDiff = a.top - b.top;
        if (Math.abs(rowDiff) > 50) return rowDiff; // Same row tolerance
        return a.left - b.left;
    });
    
    // 3. Setup Grid Vars
    const zoneRect = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
    const padding = typeof zone._zonePadding === 'number' ? zone._zonePadding : (zone.padding ?? 20);
    const gapX = zone.gapHorizontal ?? padding;
    const gapY = zone.gapVertical ?? padding;
    // Default to `fill` so the grid always uses the full zone width (no empty space).
    const lastRowBehavior = zone.lastRowBehavior || 'fill'; 
    const layoutDirection = zone.layoutDirection || 'horizontal';
    const verticalAlign = zone.verticalAlign || 'top';
    
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

    // Stretch height to use all available space when requested.
    if (verticalAlign === 'stretch' && rows > 0) {
        itemH = Math.max(50, (usableH - ((rows - 1) * gapY)) / rows);
    }

    // Align the full grid vertically inside the zone when there's leftover space (e.g., fixed aspect ratio).
    const usedGridH = (rows * itemH) + ((rows - 1) * gapY);
    if (verticalAlign === 'center') {
        startY += Math.max(0, (usableH - usedGridH) / 2);
    } else if (verticalAlign === 'bottom') {
        startY += Math.max(0, usableH - usedGridH);
    }
    
    cards.forEach((card: any, index: number) => {
        // Bind to zone
        card.parentZoneId = zone._customId;

        const safeRows = Math.max(1, rows);
        const col = layoutDirection === 'vertical'
            ? Math.floor(index / safeRows)
            : (index % cols);
        const row = layoutDirection === 'vertical'
            ? (index % safeRows)
            : Math.floor(index / cols);

        const isLastRow = layoutDirection !== 'vertical' && row === rows - 1;
        const itemsInRow = isLastRow ? (count % cols || cols) : cols;
        const shouldFillRow = isLastRow && (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') && itemsInRow < cols;
        const rowItemW = shouldFillRow
            ? Math.max(50, (usableW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow))
            : itemW;

        // Base Position
        let x = startX + (col * ((layoutDirection === 'vertical' ? itemW : rowItemW) + gapX));

        // Last Row Logic (Horizontal Fill Order)
        if (isLastRow && lastRowBehavior === 'center' && itemsInRow < cols) {
            const rowWidth = (itemsInRow * itemW) + ((itemsInRow - 1) * gapX);
            const remainingSpace = usableW - rowWidth;
            x += remainingSpace / 2;
        }

        const centerX = x + ((layoutDirection === 'vertical' ? itemW : rowItemW) / 2);
        const centerY = startY + (row * (itemH + gapY)) + (itemH / 2);
        
        // Resize & Position
        if (card.isSmartObject || card.name?.startsWith('product-card')) {
             resizeSmartObject(card, rowItemW, itemH);
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
                 scaleY: itemH / card.height
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

        // Re-apply custom rendering patches (e.g. per-corner rounded rects) recursively.
        const patchTree = (o: any) => {
            if (!o) return;
            if (isRectObject(o) && o.cornerRadii) applyRectCornerRadiiPatch(o);
            if (o.type === 'group' && typeof o.getObjects === 'function') {
                o.getObjects().forEach((c: any) => patchTree(c));
            }
        };
        objs.forEach((o: any) => patchTree(o));

        // Frames: restore flags + clip behavior
        const frames = objs.filter((o: any) => o?.isFrame || o?.name === 'Frame');
        frames.forEach((f: any) => {
            f.isFrame = true;
            if (typeof f.clipContent !== 'boolean') f.clipContent = true;
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
            ensureZoneSanity(z);
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

        const cards = objs.filter((o: any) => (o.isSmartObject || o.isProductCard) && o !== null && o !== undefined);

        // Repair missing parentZoneId by intersection (helps after old history/undo states)
        cards.forEach((card: any) => {
            if (!card._customId) card._customId = Math.random().toString(36).substr(2, 9);
            if (card._cardWidth == null) card._cardWidth = card.width;
            if (card._cardHeight == null) card._cardHeight = card.height;

            if (card.parentZoneId && zonesById.has(card.parentZoneId)) return;
            card.parentZoneId = undefined;

            for (const zone of zones) {
                if (zone.intersectsWithObject && zone.intersectsWithObject(card)) {
                    card.parentZoneId = zone._customId;
                    break;
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
                        recalculateZoneLayout(z);
                    } catch (err) {
                        console.warn('[rehydrateCanvasZones] Failed to relayout zone', err);
                    }
                }
            });
        }

        canvasObjects.value = [...canvas.value.getObjects()];
        canvas.value.requestRenderAll();
    } finally {
        isHistoryProcessing.value = prevHistory;
    }
}

const handleRecalculateLayout = () => {
    const active = canvas.value.getActiveObject();
    if (active && isLikelyProductZone(active)) {
        ensureZoneSanity(active);
        recalculateZoneLayout(active);
    }
}


</script>

<template>
  <div class="flex flex-col h-screen w-full bg-background text-foreground antialiased font-sans overflow-hidden">
      
      <ProjectManager 
        :isOpen="showProjectManager" 
        @close="showProjectManager = false"
        @load="(data) => loadCanvasData(data)"
      />

      <!-- Header / Unified Toolbar (Figma Style) -->
      <header class="h-12 border-b border-white/5 flex items-center px-4 gap-4 bg-[#1e1e1e] text-white shrink-0 z-20 shadow-sm relative">
          <div class="flex items-center gap-3 mr-4 select-none">
            <div class="flex items-center gap-2">
                 <!-- Simple Hamburger / Menu Icon mockup -->
                 <div class="w-8 h-8 hover:bg-white/10 rounded flex items-center justify-center cursor-pointer">
                    <LayoutGrid class="w-5 h-5 text-zinc-400" />
                 </div>
                 <span class="text-[13px] font-medium text-white tracking-wide">Untitled Project</span>
                 <span class="text-[10px] text-zinc-500 font-normal px-2 py-0.5 rounded border border-zinc-700">Rascunho</span>
            </div>
          </div>
          
          <div class="ml-auto flex items-center gap-3">
             <!-- Share / Play -->
             <div class="flex items-center -space-x-1 mr-2">
                 <div class="w-6 h-6 rounded-full bg-green-500 border border-[#1e1e1e] flex items-center justify-center text-[9px] font-bold">R</div>
                 <div class="w-6 h-6 rounded-full bg-purple-500 border border-[#1e1e1e] flex items-center justify-center text-[9px] font-bold">M</div>
             </div>
             
             <Button variant="ghost" size="sm" @click="toggleGrid" :class="showGrid ? 'text-violet-400' : 'text-white/80'" class="h-8 px-2 hover:bg-white/10 rounded">
                <LayoutGrid class="w-3.5 h-3.5" />
             </Button>

             <Button variant="ghost" size="sm" @click="toggleRulers" :class="showRulers ? 'text-violet-400' : 'text-white/80'" class="h-8 px-2 hover:bg-white/10 rounded">
                <Maximize class="w-3.5 h-3.5" />
             </Button>

             <div class="w-px h-4 bg-white/10 mx-1"></div>

             <Button variant="ghost" size="sm" @click="exportDesign" class="h-8 gap-2 px-3 text-[11px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all rounded">
                <Share2 class="w-3.5 h-3.5" />
                <span>Exportar</span>
             </Button>

             <Button variant="default" size="sm" class="h-8 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-[11px] font-medium transition-all shadow-sm flex items-center gap-2" @click="startPresentation">
                <Play class="w-3 h-3 fill-current" />
                <span class="hidden md:inline">Apresentar</span>
            </Button>
          </div>
      </header>

      <!-- Central Workspace -->
      <div class="flex flex-1 overflow-hidden relative bg-[#1e1e1e]">
          <!-- Left Sidebar (New Component) -->
          <SidebarLeft @insert-asset="insertAssetToCanvas">
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
          <main class="flex-1 relative bg-[#1e1e1e] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
              <!-- Infinite Canvas Effect (Wrapper) -->
              <div ref="wrapperEl" class="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#1e1e1e]">
                  <canvas ref="canvasEl" @contextmenu.prevent.stop></canvas>
                  <ContextMenu
                    v-model="canvasContextMenu.show"
                    :x="canvasContextMenu.x"
                    :y="canvasContextMenu.y"
                    :items="canvasContextMenuItems"
                    @select="handleCanvasContextMenuSelect"
                  />
                  
                  <!-- Floating Grid Actions (HTML UI outside the grid) -->
                  <div 
                    v-if="selectedObjectPos.visible"
                    class="absolute z-40 pointer-events-none"
                    :style="{ 
                        top: (selectedObjectPos.top - 40) + 'px', 
                        left: selectedObjectPos.left + 'px', 
                        width: selectedObjectPos.width + 'px',
                        display: 'flex',
                        justifyContent: 'center'
                    }"
                  >
                    <div class="bg-[#2c2c2c] p-1 rounded-lg shadow-lg border border-white/10 pointer-events-auto animate-in fade-in zoom-in duration-200" title="Importar Lista de Produtos">
                        <button 
                            @click="showPasteListModal = true"
                            class="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <StickyNote class="w-4 h-4" />
                        </button>
                    </div>
                  </div>

                  <!-- Virtual Scrollbars (Figma Style) -->
                  <div v-show="scrollV.visible" class="absolute right-1 w-1.5 bg-white/20 hover:bg-white/40 rounded-full z-50 transition-colors pointer-events-none" :style="{ top: scrollV.top + 'px', height: scrollV.height + 'px' }"></div>
                  <div v-show="scrollH.visible" class="absolute bottom-1 h-1.5 bg-white/20 hover:bg-white/40 rounded-full z-50 transition-colors pointer-events-none" :style="{ left: scrollH.left + 'px', width: scrollH.width + 'px' }"></div>

                  <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" accept="image/*" />
              </div>

              <!-- Floating Toolbar (Figma Style) - Bottom Center -->
              <div class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#2c2c2c] p-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10 z-30 select-none">
                  <button @click="setTool('select')" title="Move (V)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors shadow-sm" :class="!isDrawing ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:text-white'"><MousePointer2 class="w-4 h-4 ml-0.5" /></button>
                  <div class="w-px h-5 bg-white/10 mx-1"></div>
                  
                  <button @click="addFrame" title="Frame (F) - Alt+Setas para resize 1px" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                      <Frame class="w-4 h-4" />
                  </button>
                  
                  <button @click="addGridZone" title="Zona de Produtos" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                      <LayoutGrid class="w-4 h-4" />
                  </button>

                  <button @click="showLabelTemplatesModal = true" title="Modelos de Etiqueta" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                      <Tag class="w-4 h-4" />
                  </button>
                  
                  <button @click="addShape('rect')" title="Rectangle (R)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Square class="w-4 h-4" /></button>
                  <button @click="addShape('circle')" title="Circle (O)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Circle class="w-4 h-4" /></button>
                  <button @click="addShape('line')" title="Line (L)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Minus class="w-4 h-4" /></button>
                  <button @click="addShape('arrow')" title="Arrow" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><ArrowRightFromLine class="w-4 h-4 rotate-45" /></button>
                  
                  <button @click="addText" title="Text (T)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"><Type class="w-4 h-4" /></button>
                  <button @click="toggleDrawing" title="Pen (P)" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors" :class="isDrawing ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:text-white'"><PenTool class="w-4 h-4" /></button>
                  
                  <div class="w-px h-5 bg-white/10 mx-1"></div>
                  
                  <button @click="handleRemoveBackground" :disabled="isProcessing" title="Remove BG" class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors relative">
                      <Scissors class="w-4 h-4" />
                      <span v-if="isProcessing" class="absolute inset-0 flex items-center justify-center bg-[#2c2c2c] rounded-xl"><span class="w-2 h-2 rounded-full border-2 border-zinc-500 border-t-white animate-spin"></span></span>
                  </button>
              </div>
          </main>

          <!-- Right Sidebar (Properties) -->
          <aside class="w-[280px] border-l border-white/5 h-full bg-[#1e1e1e] text-white flex flex-col shrink-0 z-10">
               <div class="min-h-0 flex-1 flex flex-col">
                  <PropertiesPanel 
                     :selectedObject="selectedObjectRef" 
                     :pageSettings="pageSettings"
                     :colorStyles="colorStyles"
                     :productZone="productZoneState.productZone.value"
                     :productGlobalStyles="productZoneState.globalStyles.value"
                     :labelTemplates="labelTemplates"
                     @update-property="updateObjectProperty"
                     @update-smart-group="updateSmartGroup"
                     @update-page-settings="updatePageSettings"
                     @action="handleAction"
                     @add-color-style="addColorStyle"
                     @apply-color-style="applyColorStyle"
                     @update-zone="handleUpdateZone"
                     @update-global-styles="handleUpdateGlobalStyles"
                     @apply-preset="handleApplyZonePreset"
                     @sync-gaps="handleSyncZoneGaps"
                     @recalculate-layout="handleRecalculateLayout"
                     @manage-label-templates="showLabelTemplatesModal = true"
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
              <div class="absolute -inset-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
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

              <div v-else class="relative rounded-2xl overflow-hidden border border-border bg-black/[0.02] p-2">
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
          @import="confirmProductImport"
      />

      <!-- Export Modal -->
      <UiDialog v-model="showExportModal" title="Exportar Design" @close="showExportModal = false" width="400px">
        <template #default>
          <div class="space-y-4 py-4">
             <!-- Format -->
             <div class="space-y-2">
                 <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formato</label>
                 <div class="flex gap-2">
                     <button @click="exportSettings.format = 'png'" :class="exportSettings.format === 'png' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">PNG</button>
                     <button @click="exportSettings.format = 'jpeg'" :class="exportSettings.format === 'jpeg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">JPG</button>
                     <button @click="exportSettings.format = 'svg'" :class="exportSettings.format === 'svg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">SVG</button>
                 </div>
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
          </div>
        </template>
        <template #footer>
            <div class="flex justify-end gap-3 w-full">
                <Button variant="ghost" @click="showExportModal = false">Cancelar</Button>
                <Button variant="default" @click="performExport">Exportar Arquivo</Button>
            </div>
        </template>
      </UiDialog>

      <!-- Presentation Mode Overlay -->
      <div v-if="showPresentationModal" class="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <div class="relative w-full h-full flex items-center justify-center p-10">
              <div class="relative shadow-2xl max-w-full max-h-full aspect-[9/16]">
                  <img :src="presentationImage" class="w-full h-full object-contain" />
                  
                  <!-- Hotspots Layer -->
                  <div class="absolute inset-0 w-full h-full">
                      <div 
                        v-for="(hotspot, i) in presentationHotspots" 
                        :key="i"
                        class="absolute cursor-pointer hover:bg-violet-500/30 transition-colors"
                        :style="{ top: hotspot.top, left: hotspot.left, width: hotspot.width, height: hotspot.height }"
                        @click="handleHotspotClick(hotspot.target)"
                        title="Click to Navigate"
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

  </div>
</template>

<style scoped>
/* Ensure canvas container handles canvas element correctly */
 :deep(.canvas-container) {
     background-color: transparent !important;
     box-shadow: 0 0 40px rgba(0,0,0,0.5); /* Figma-like page shadow */
 }
 main {
     background-color: #121212 !important;
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

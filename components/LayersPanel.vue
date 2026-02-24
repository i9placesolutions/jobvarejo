<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Button from './ui/Button.vue'
import { Eye, EyeOff, Lock, Unlock, Trash2, ArrowUp, ArrowDown, Box, Type, Image as ImageIcon, Square, Circle, Triangle, ChevronRight, ChevronDown, Layers, Scan, Link2 } from 'lucide-vue-next'

const props = defineProps<{
  objects: any[]
  selectedId: string | null
  selectedIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'select', payload: string | { id: string; additive?: boolean; toggle?: boolean; range?: boolean }): void
  (e: 'toggle-visible', id: string): void
  (e: 'toggle-lock', id: string): void
  (e: 'delete', id: string): void
  (e: 'move-up', id: string): void
  (e: 'move-down', id: string): void
  (e: 'rename', id: string, name: string): void
  (e: 'reorder', payload: { sourceId: string; targetId: string; place: 'before' | 'after' }): void
  (e: 'context-menu', payload: { id: string; x: number; y: number }): void
}>()

const handleLayerRowClick = (id: string, evt?: MouseEvent) => {
  const additive = !!(evt?.shiftKey || evt?.ctrlKey || evt?.metaKey)
  const toggle = !!(evt?.ctrlKey || evt?.metaKey)
  const range = !!evt?.shiftKey
  emit('select', { id, additive, toggle, range })
}

const handleLayerContextMenu = (id: string, evt: MouseEvent) => {
  emit('context-menu', {
    id,
    x: Number(evt.clientX || 0),
    y: Number(evt.clientY || 0)
  })
}

const selectedIdSet = computed(() => {
  const ids = new Set<string>()
  const list = Array.isArray(props.selectedIds) ? props.selectedIds : []
  list.forEach((id) => {
    const value = String(id || '').trim()
    if (value) ids.add(value)
  })
  const single = String(props.selectedId || '').trim()
  if (single) ids.add(single)
  return ids
})

const isLayerSelected = (id: string) => selectedIdSet.value.has(String(id || '').trim())
const dragSourceId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragOverPlacement = ref<'before' | 'after' | null>(null)

const getDropPlacement = (evt: DragEvent): 'before' | 'after' => {
  const target = evt.currentTarget as HTMLElement | null
  if (!target) return 'after'
  const rect = target.getBoundingClientRect()
  const offsetY = evt.clientY - rect.top
  return offsetY < rect.height / 2 ? 'before' : 'after'
}

const handleDragStart = (id: string, evt: DragEvent) => {
  dragSourceId.value = id
  dragOverId.value = null
  dragOverPlacement.value = null
  if (evt.dataTransfer) {
    evt.dataTransfer.effectAllowed = 'move'
    evt.dataTransfer.setData('text/plain', id)
  }
}

const handleDragOver = (id: string, evt: DragEvent) => {
  if (!dragSourceId.value || dragSourceId.value === id) return
  evt.preventDefault()
  if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move'
  dragOverId.value = id
  dragOverPlacement.value = getDropPlacement(evt)
}

const handleDragLeave = (id: string) => {
  if (dragOverId.value === id) {
    dragOverId.value = null
    dragOverPlacement.value = null
  }
}

const handleDrop = (id: string, evt: DragEvent) => {
  evt.preventDefault()
  const sourceId = String(dragSourceId.value || '').trim()
  const targetId = String(id || '').trim()
  const place = dragOverPlacement.value || getDropPlacement(evt)
  if (!sourceId || !targetId || sourceId === targetId) {
    dragSourceId.value = null
    dragOverId.value = null
    dragOverPlacement.value = null
    return
  }
  emit('reorder', { sourceId, targetId, place })
  dragSourceId.value = null
  dragOverId.value = null
  dragOverPlacement.value = null
}

const handleDragEnd = () => {
  dragSourceId.value = null
  dragOverId.value = null
  dragOverPlacement.value = null
}

const editingId = ref<string | null>(null)
const editingName = ref('')
// Track which frames are expanded
const expandedFrames = ref<Set<string>>(new Set())

const startEditing = (obj: any) => {
  editingId.value = obj._customId
  editingName.value = getLayerName(obj, 0)
}

const finishEditing = () => {
  if (editingId.value && editingName.value.trim()) {
    emit('rename', editingId.value, editingName.value.trim())
  }
  editingId.value = null
  editingName.value = ''
}

const toggleExpand = (frameId: string) => {
  if (expandedFrames.value.has(frameId)) {
    expandedFrames.value.delete(frameId)
  } else {
    expandedFrames.value.add(frameId)
  }
  // Force reactivity by creating new Set
  expandedFrames.value = new Set(expandedFrames.value)
}

const isFrameExpanded = (frameId: string) => {
  return expandedFrames.value.has(frameId)
}

// Helper to get a name for the layer
const getLayerName = (obj: any, index: number) => {
  if (obj.layerName) return obj.layerName

  const isFigmaBlue = (stroke: any) => {
    if (stroke == null) return false
    const s = String(stroke).trim().toLowerCase()
    if (!s) return false
    if (s === '#0d99ff') return true
    const m = s.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i)
    if (m) {
      const r = Number(m[1]), g = Number(m[2]), b = Number(m[3])
      return Math.abs(r - 13) <= 1 && Math.abs(g - 153) <= 1 && Math.abs(b - 255) <= 1
    }
    return false
  }

  const n = String(obj?.name || '').trim()
  const isFrameLike =
    !!obj?.isFrame ||
    /^frame\b/i.test(n) ||
    (obj?.type === 'rect' && (obj?.clipContent === true || obj?.clipContent === 1) && isFigmaBlue(obj?.stroke))

  if (isFrameLike) {
    return obj?.layerName && obj.layerName !== 'FRAMER' ? obj.layerName : 'FRAMER'
  }

  if (obj.name && obj.name !== '') return obj.name
  if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') return obj.text?.substring(0, 18) || 'Texto'
  if (obj.type === 'image') return obj.isBackground ? 'Plano de Fundo' : 'Imagem'
  if (obj.type === 'group') {
    if (obj.isSmartGroup) return '📦 GRID ' + (obj.productName?.substring(0, 10) || 'SMART')
    return 'Grupo'
  }
  if (obj.type === 'rect') {
    const checkIsFrame = !!obj?.isFrame ||
      /^frame\b/i.test(String(obj?.name || '')) ||
      (obj?.clipContent === true || obj?.clipContent === 1) && isFigmaBlue(obj?.stroke)
    if (checkIsFrame) {
      return obj?.layerName && obj.layerName !== 'FRAMER' ? obj.layerName : 'FRAMER'
    }
    return 'Retângulo'
  }
  if (obj.type === 'circle') return 'Círculo'
  if (obj.type === 'line') return 'Linha'
  if (obj.type === 'path') return 'Vetor'
  return 'Camada'
}

// Filter valid objects
const getValidObjects = () => {
  return props.objects.filter((o, idx, arr) => {
    if (o.id === 'artboard-bg' || o.id === 'guide-vertical' || o.id === 'guide-horizontal') return false
    if ((o as any)?.excludeFromExport) return false
    const name = (o as any)?.name || ''
    if (name === 'path_node' || name === 'bezier_handle' || name === 'control_point' || name === 'handle_line') return false
    const data = (o as any)?.data
    if (data && (data.parentPath || data.parentObj || data.type === 'node' || data.type === 'handle_in' || data.type === 'handle_out')) return false
    if (o.type === 'circle' && (o as any).radius && (o as any).radius <= 10) return false
    if (o.type === 'circle' && !(o as any)._customId) return false
    if (o.type === 'line' && !(o as any)._customId) return false
    if (o.type === 'path' && !(o as any)._customId && !(o as any).isVectorPath) return false
    const customId = (o as any)?._customId
    if (!customId) return false
    const firstIndex = arr.findIndex(item => (item as any)?._customId === customId)
    return firstIndex === idx
  })
}

// Build hierarchical tree structure
interface LayerItem {
  obj: any
  id: string
  name: string
  type: string
  depth: number
  isFrame: boolean
  isExpanded: boolean
  visible: boolean
  locked: boolean
  masked?: boolean
  maskSourceName?: string
  masksTargetNames?: string[]
  childCount?: number
}

const buildLayerTree = computed(() => {
  const validObjects = getValidObjects()
  const items: LayerItem[] = []

  // Fabric stack order is back->front. Layers panel should show front->back.
  const stackIndex = new Map<string, number>()
  validObjects.forEach((obj, idx) => {
    if (obj?._customId) stackIndex.set(String(obj._customId), idx)
  })
  const byTopMostFirst = (a: any, b: any) => {
    const aIdx = stackIndex.get(String(a?._customId || '')) ?? -1
    const bIdx = stackIndex.get(String(b?._customId || '')) ?? -1
    return bIdx - aIdx
  }

  const objectById = new Map<string, any>()
  validObjects.forEach((obj) => {
    const id = String(obj?._customId || '').trim()
    if (id) objectById.set(id, obj)
  })

  const layerNameById = new Map<string, string>()
  validObjects.forEach((obj, idx) => {
    const id = String(obj?._customId || '').trim()
    if (!id) return
    layerNameById.set(id, getLayerName(obj, idx))
  })

  const isMaskCandidateForPanel = (obj: any) => {
    if (!obj || typeof obj !== 'object') return false
    if (obj?.isFrame) return false
    if (String(obj?.id || '') === 'artboard-bg') return false
    const parentGroup = (obj as any)?.group
    if (parentGroup && String(parentGroup?.type || '').toLowerCase() !== 'activeselection') return false
    return true
  }

  const inferMaskSourceId = (target: any) => {
    const explicit = String((target as any)?.objectMaskSourceId || '').trim()
    if (explicit && objectById.has(explicit)) return explicit

    if (!target?.objectMaskEnabled) return ''
    const targetId = String(target?._customId || '').trim()
    if (!targetId) return ''
    const targetIndex = stackIndex.get(targetId) ?? -1
    if (targetIndex <= 0) return ''

    const targetFrameId = String((target as any)?.parentFrameId || '').trim()
    for (let i = targetIndex - 1; i >= 0; i -= 1) {
      const candidate = validObjects[i]
      if (!candidate || candidate === target) continue
      const candidateId = String(candidate?._customId || '').trim()
      if (!candidateId) continue
      if (String((candidate as any)?.parentFrameId || '').trim() !== targetFrameId) continue
      if (!isMaskCandidateForPanel(candidate)) continue
      return candidateId
    }

    return ''
  }

  const maskSourceByTarget = new Map<string, string>()
  const maskTargetsBySource = new Map<string, string[]>()
  validObjects.forEach((obj) => {
    const targetId = String(obj?._customId || '').trim()
    if (!targetId || !obj?.objectMaskEnabled) return
    const sourceId = inferMaskSourceId(obj)
    if (!sourceId || sourceId === targetId) return
    maskSourceByTarget.set(targetId, sourceId)
    const currentTargets = maskTargetsBySource.get(sourceId) || []
    currentTargets.push(targetId)
    maskTargetsBySource.set(sourceId, currentTargets)
  })

  const frameIds = new Set(validObjects.filter(o => o?.isFrame).map(o => String(o._customId || '')).filter(Boolean))
  const frameChildrenMap = new Map<string, any[]>()

  // Group children by parent frame id
  validObjects.forEach(o => {
    if (o.parentFrameId) {
      if (!frameChildrenMap.has(o.parentFrameId)) {
        frameChildrenMap.set(o.parentFrameId, [])
      }
      frameChildrenMap.get(o.parentFrameId)!.push(o)
    }
  })

  const appendFrameChildren = (frameId: string, depth: number) => {
    const children = (frameChildrenMap.get(frameId) || []).slice().sort(byTopMostFirst)
    children.forEach((child) => {
      const childIsFrame = !!child?.isFrame
      const childItem = createLayerItem(child, depth, childIsFrame, maskSourceByTarget, maskTargetsBySource, layerNameById)
      if (childIsFrame) {
        const nestedChildren = frameChildrenMap.get(child._customId) || []
        childItem.childCount = nestedChildren.length
      }
      items.push(childItem)

      if (childIsFrame && isFrameExpanded(child._customId)) {
        appendFrameChildren(String(child._customId), depth + 1)
      }
    })
  }

  // Top-level objects: objects with no valid parent frame (or orphaned parent id).
  const topLevelObjects = validObjects
    .filter((o) => {
      const parentId = String(o?.parentFrameId || '')
      return !parentId || !frameIds.has(parentId)
    })
    .slice()
    .sort(byTopMostFirst)

  topLevelObjects.forEach((obj) => {
    const isFrame = !!obj?.isFrame
    const item = createLayerItem(obj, 0, isFrame, maskSourceByTarget, maskTargetsBySource, layerNameById)
    if (isFrame) {
      const children = frameChildrenMap.get(obj._customId) || []
      item.childCount = children.length
    }
    items.push(item)

    if (isFrame && isFrameExpanded(obj._customId)) {
      appendFrameChildren(String(obj._customId), 1)
    }
  })

  return items
})

const createLayerItem = (
  obj: any,
  depth: number,
  isFrame: boolean,
  maskSourceByTarget: Map<string, string>,
  maskTargetsBySource: Map<string, string[]>,
  layerNameById: Map<string, string>
): LayerItem => {
  const id = String(obj?._customId || '').trim()
  const sourceId = (maskSourceByTarget.get(id) || '').trim()
  const sourceName = sourceId ? String(layerNameById.get(sourceId) || '').trim() : ''
  const targetIds = (maskTargetsBySource.get(id) || []).filter(Boolean)
  const targetNames = targetIds
    .map((targetId) => String(layerNameById.get(targetId) || '').trim())
    .filter(Boolean)

  return {
    obj,
    id: obj._customId,
    name: getLayerName(obj, 0),
    type: obj.type,
    depth,
    isFrame,
    isExpanded: isFrameExpanded(obj._customId),
    visible: obj.visible !== false,
    locked: obj.lockMovementX || obj.lockMovementY,
    masked: !!obj?.objectMaskEnabled,
    maskSourceName: sourceName || undefined,
    masksTargetNames: targetNames.length ? targetNames : undefined
  }
}

// Export expanded frames state to parent for persistence
defineExpose({
  expandedFrames
})
</script>

<template>
  <div class="flex flex-col h-full bg-transparent">
    <!-- Layers Header -->
    <div class="px-3 py-2 border-b border-white/5 shrink-0 flex items-center gap-2">
      <Layers class="w-3 h-3 text-zinc-500" />
      <span class="text-[10px] font-semibold uppercase text-zinc-500">Camadas</span>
    </div>

    <div class="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
      <div
        v-for="item in buildLayerTree"
        :key="item.id"
        :class="[
          'flex items-center gap-2 py-1.5 rounded-xs transition-all duration-150 group cursor-grab active:cursor-grabbing select-none border border-transparent',
          isLayerSelected(item.id)
            ? 'bg-violet-500 text-white font-medium'
            : 'hover:bg-white/5 text-zinc-400 hover:text-white',
          dragOverId === item.id && dragOverPlacement === 'before' ? 'border-t-violet-400' : '',
          dragOverId === item.id && dragOverPlacement === 'after' ? 'border-b-violet-400' : '',
          dragSourceId === item.id ? 'opacity-60' : ''
        ]"
        :style="{ paddingLeft: `${item.depth * 12 + 6}px` }"
        draggable="true"
        @click="handleLayerRowClick(item.id, $event)"
        @contextmenu.prevent.stop="handleLayerContextMenu(item.id, $event)"
        @dragstart="handleDragStart(item.id, $event)"
        @dragover="handleDragOver(item.id, $event)"
        @dragleave="handleDragLeave(item.id)"
        @drop="handleDrop(item.id, $event)"
        @dragend="handleDragEnd"
      >
        <!-- Expand/Collapse chevron for frames -->
        <button
          v-if="item.isFrame"
          @click.stop="toggleExpand(item.id)"
          class="w-4 h-4 flex items-center justify-center shrink-0 hover:bg-white/10 rounded transition-colors"
        >
          <ChevronRight v-if="!item.isExpanded" class="w-3 h-3 transition-transform" />
          <ChevronDown v-else class="w-3 h-3 transition-transform" />
        </button>
        <div v-else class="w-4 shrink-0"></div>

        <!-- Icon container -->
        <div class="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
          <Layers v-if="item.isFrame" class="w-3 h-3" />
          <Box v-else-if="item.type === 'group'" class="w-3 h-3" />
          <Type v-else-if="item.type.includes('text')" class="w-3.5 h-3.5" />
          <ImageIcon v-else-if="item.type === 'image'" class="w-3.5 h-3.5" />
          <Square v-else-if="item.type === 'rect'" class="w-3.5 h-3.5" />
          <Circle v-else-if="item.type === 'circle'" class="w-3.5 h-3.5" />
          <Triangle v-else class="w-3.5 h-3.5" />
        </div>

        <!-- Name with child count badge for frames -->
        <div class="grow min-w-0 flex items-center gap-2" @dblclick.stop="startEditing(item.obj)">
          <input
            v-if="editingId === item.id"
            v-model="editingName"
            @blur="finishEditing"
            @keyup.enter="finishEditing"
            @keyup.esc="editingId = null"
            class="w-full bg-[#1e1e1e] text-white text-[10px] px-1 py-0.5 border border-violet-500 rounded focus:outline-none"
            autoFocus
          />
          <template v-else>
            <span :class="['text-[10px] font-bold uppercase tracking-wider truncate block transition-all', isLayerSelected(item.id) ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300']">
              {{ item.name }}
            </span>
            <span v-if="item.masked" class="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-300/30 shrink-0">
              <Scan class="w-2.5 h-2.5" />
              MASCARA
            </span>
            <span v-if="item.maskSourceName" class="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-300/25 shrink-0 max-w-[120px]">
              <Link2 class="w-2.5 h-2.5 shrink-0" />
              <span class="truncate">COM {{ item.maskSourceName }}</span>
            </span>
            <span v-if="item.masksTargetNames && item.masksTargetNames.length" class="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-300/25 shrink-0 max-w-[130px]">
              <Link2 class="w-2.5 h-2.5 shrink-0" />
              <span class="truncate">
                {{ item.masksTargetNames.length === 1 ? `LIGA ${item.masksTargetNames[0]}` : `${item.masksTargetNames.length} LIGACOES` }}
              </span>
            </span>
            <!-- Child count badge for frames -->
            <span v-if="item.isFrame && item.childCount !== undefined" class="text-[8px] px-1 rounded bg-white/10 text-zinc-400 shrink-0">
              {{ item.childCount }}
            </span>
          </template>
        </div>

        <!-- Actions -->
        <div :class="['flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity', isLayerSelected(item.id) ? 'opacity-100' : '']">
          <button @click.stop="emit('toggle-visible', item.id)" class="p-1.5 hover:text-white transition-colors text-zinc-600">
            <Eye v-if="item.visible" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            <EyeOff v-else class="w-3.5 h-3.5 text-red-500" />
          </button>
          <button @click.stop="emit('toggle-lock', item.id)" class="p-1.5 hover:text-white transition-colors text-zinc-600">
            <Unlock v-if="!item.locked" class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            <Lock v-else class="w-3.5 h-3.5 text-amber-500" />
          </button>
          <button @click.stop="emit('delete', item.id)" class="p-1.5 hover:text-red-500 transition-colors text-zinc-600">
            <Trash2 class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>
      </div>

      <div v-if="buildLayerTree.length === 0" class="flex flex-col items-center justify-center py-20 opacity-20">
        <Layers class="w-10 h-10 mb-3 text-zinc-600" />
        <p class="text-[9px] uppercase tracking-[0.3em] font-black text-zinc-600">Nenhuma Camada</p>
      </div>
    </div>

    <!-- Move Actions -->
    <div class="px-3 py-4 border-t border-zinc-800 flex items-center gap-2 bg-[#09090b]">
      <button @click="selectedId && emit('move-up', selectedId)" :disabled="!selectedId" class="flex-1 h-8 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] border border-zinc-700 rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm">
        <ArrowUp class="w-3 h-3" /> Subir
      </button>
      <button @click="selectedId && emit('move-down', selectedId)" :disabled="!selectedId" class="flex-1 h-8 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] border border-zinc-700 rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-30 transition-all active:scale-95 shadow-sm">
        <ArrowDown class="w-3 h-3" /> Descer
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
</style>

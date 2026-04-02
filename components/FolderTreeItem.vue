<script setup lang="ts">
import { Folder, ChevronRight, ChevronDown, MoreVertical } from 'lucide-vue-next'

interface Folder {
  id: string
  name: string
  children?: Folder[]
  [key: string]: any
}

interface Props {
  folder: Folder
  level: number
  isActive: boolean
  isExpanded: boolean
  projectCount: number
  isEditing: boolean
  editingName: string
  activeFolderId?: string | null
  editingFolderId?: string | null
  expandedFolders?: Set<string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [folderId: string]
  toggle: [folderId: string]
  contextMenu: [event: MouseEvent, folderId: string]
  saveEdit: []
  cancelEdit: []
  updateName: [name: string]
  dropOnFolder: [folderId: string, event: DragEvent]
}>()

const hasChildren = computed(() => props.folder.children && props.folder.children.length > 0)

// Helper to check if a child folder is active
const isChildActive = (childId: string): boolean => {
  return props.activeFolderId === childId
}

// Helper to check if a child folder is expanded
const isChildExpanded = (childId: string): boolean => {
  return props.expandedFolders?.has(childId) || false
}

// Helper to check if a child folder is being edited
const isChildEditing = (childId: string): boolean => {
  return props.editingFolderId === childId
}
</script>

<template>
  <div class="folder-item">
    <div
      :class="[
        'flex items-center gap-2 h-9 px-2 cursor-pointer transition-all group relative rounded-lg border border-transparent',
        isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'hover:bg-slate-50 text-slate-600'
      ]"
      :style="{ paddingLeft: `${level * 14 + 8}px` }"
      @click="emit('select', folder.id)"
      @contextmenu="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      @dragover="(e: DragEvent) => e.preventDefault()"
      @drop="emit('dropOnFolder', folder.id, $event)"
    >
      <!-- Expand/Collapse chevron -->
      <button
        v-if="hasChildren"
        class="p-0.5 hover:bg-slate-100 rounded-md transition-all"
        @click.stop="emit('toggle', folder.id)"
      >
        <ChevronRight v-if="!isExpanded" class="w-3.5 h-3.5 text-slate-400" />
        <ChevronDown v-else class="w-3.5 h-3.5 text-slate-400" />
      </button>
      <span v-else class="w-4.5"></span>

      <!-- Folder icon -->
      <Folder :class="['w-[18px] h-[18px] shrink-0', isActive ? 'fill-indigo-400 text-indigo-500' : 'text-slate-400']" />

      <!-- Folder name -->
      <input
        v-if="isEditing"
        :value="editingName"
        @input="emit('updateName', ($event.target as HTMLInputElement).value)"
        @click.stop
        @keyup.enter="emit('saveEdit')"
        @keyup.escape="emit('cancelEdit')"
        @blur="emit('saveEdit')"
        class="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-2 py-1 text-[13px] focus:outline-none focus:border-indigo-400 text-slate-800 transition-all"
        autofocus
      />
      <span v-else class="flex-1 min-w-0 truncate text-[13px] font-medium">{{ folder.name }}</span>

      <!-- Project count badge -->
      <span v-if="projectCount > 0" class="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
        {{ projectCount }}
      </span>

      <!-- More options button -->
      <button
        class="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded-lg transition-all shrink-0"
        @click.stop="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      >
        <MoreVertical class="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>

    <!-- Render children -->
    <div v-if="hasChildren && isExpanded" class="folder-children">
      <FolderTreeItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :level="level + 1"
        :is-active="isChildActive(child.id)"
        :is-expanded="isChildExpanded(child.id)"
        :project-count="child.projectCount || 0"
        :is-editing="isChildEditing(child.id)"
        :editing-name="editingName"
        :active-folder-id="activeFolderId"
        :editing-folder-id="editingFolderId"
        :expanded-folders="expandedFolders"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @context-menu="emit('contextMenu', $event, child.id)"
        @update-name="emit('updateName', $event)"
        @drop-on-folder="(folderId, event) => emit('dropOnFolder', folderId, event)"
        @save-edit="emit('saveEdit')"
        @cancel-edit="emit('cancelEdit')"
      />
    </div>
  </div>
</template>

<style scoped>
.folder-children {
  position: relative;
}

.folder-item {
  user-select: none;
}
</style>

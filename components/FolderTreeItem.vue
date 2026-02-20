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
        'folder-row flex items-center gap-2 h-9 px-3 cursor-pointer transition-all group relative rounded-lg',
        isActive ? 'is-active' : ''
      ]"
      :style="{ paddingLeft: `${level * 16 + 12}px` }"
      @click="emit('select', folder.id)"
      @contextmenu="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      @dragover="(e: DragEvent) => e.preventDefault()"
      @drop="emit('dropOnFolder', folder.id, $event)"
    >
      <!-- Expand/Collapse chevron -->
      <button
        v-if="hasChildren"
        class="folder-toggle p-1 rounded-md transition-all"
        @click.stop="emit('toggle', folder.id)"
      >
        <ChevronRight v-if="!isExpanded" class="w-3.5 h-3.5 folder-chevron" />
        <ChevronDown v-else class="w-3.5 h-3.5 folder-chevron" />
      </button>
      <span v-else class="w-5.5"></span>

      <!-- Folder icon -->
      <Folder class="w-4 h-4 shrink-0 folder-icon" />

      <!-- Folder name -->
      <input
        v-if="isEditing"
        :value="editingName"
        @input="emit('updateName', ($event.target as HTMLInputElement).value)"
        @click.stop
        @keyup.enter="emit('saveEdit')"
        @keyup.escape="emit('cancelEdit')"
        @blur="emit('saveEdit')"
        class="folder-edit-input flex-1 min-w-0 rounded-lg px-2 py-1 text-xs focus:outline-none transition-all"
        autofocus
      />
      <span v-else class="flex-1 min-w-0 truncate text-xs font-medium">{{ folder.name }}</span>

      <!-- Project count badge -->
      <span v-if="projectCount > 0" class="folder-count text-[10px] px-1.5 py-0.5 rounded">
        {{ projectCount }}
      </span>

      <!-- More options button -->
      <button
        class="folder-more-btn opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
        @click.stop="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      >
        <MoreVertical class="w-3.5 h-3.5 folder-chevron" />
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
        :project-count="0"
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

.folder-row {
  color: #7d6d5c;
}

.folder-row:hover {
  background: rgba(179, 38, 30, 0.08);
  color: var(--dash-text, #2f2419);
}

.folder-row.is-active {
  background: var(--dash-accent-soft, #fde9e4);
  color: var(--dash-text, #2f2419);
}

.folder-row.is-active:hover {
  background: var(--dash-accent-soft-hover, #f9d8d2);
}

.folder-toggle:hover,
.folder-more-btn:hover {
  background: rgba(179, 38, 30, 0.12);
}

.folder-chevron {
  color: #8d7a66;
}

.folder-row.is-active .folder-chevron {
  color: #8a2f25;
}

.folder-icon {
  color: #8d7a66;
  fill: transparent;
  transition: color 0.2s ease, fill 0.2s ease;
}

.folder-row.is-active .folder-icon {
  color: #b3261e;
  fill: rgba(179, 38, 30, 0.12);
}

.folder-edit-input {
  background: #fffdf9;
  border: 1px solid var(--dash-border, #e7d8c3);
  color: var(--dash-text, #2f2419);
}

.folder-edit-input:focus {
  border-color: #b53a2b;
  box-shadow: 0 0 0 3px rgba(181, 58, 43, 0.14);
}

.folder-count {
  color: #8d7a66;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(231, 216, 195, 0.85);
}

.folder-row.is-active .folder-count {
  color: #7a1d19;
  background: rgba(255, 255, 255, 0.9);
}
</style>

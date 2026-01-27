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
        'flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-colors group relative',
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
      ]"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="emit('select', folder.id)"
      @contextmenu="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      @dragover="(e: DragEvent) => e.preventDefault()"
      @drop="emit('dropOnFolder', folder.id, $event)"
    >
      <!-- Expand/Collapse chevron -->
      <button
        v-if="hasChildren"
        class="p-0.5 hover:bg-muted rounded transition-colors"
        @click.stop="emit('toggle', folder.id)"
      >
        <ChevronRight v-if="!isExpanded" class="w-3 h-3 text-muted-foreground" />
        <ChevronDown v-else class="w-3 h-3 text-muted-foreground" />
      </button>
      <span v-else class="w-4"></span>

      <!-- Folder icon -->
      <Folder :class="['w-4 h-4 flex-shrink-0', isActive ? 'fill-primary text-primary' : 'text-muted-foreground']" />

      <!-- Folder name -->
      <input
        v-if="isEditing"
        :value="editingName"
        @input="emit('updateName', ($event.target as HTMLInputElement).value)"
        @click.stop
        @keyup.enter="emit('saveEdit')"
        @keyup.escape="emit('cancelEdit')"
        @blur="emit('saveEdit')"
        class="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        autofocus
      />
      <span v-else class="flex-1 min-w-0 truncate text-sm">{{ folder.name }}</span>

      <!-- Project count badge -->
      <span v-if="projectCount > 0" class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
        {{ projectCount }}
      </span>

      <!-- More options button -->
      <button
        class="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
        @click.stop="(e: MouseEvent) => emit('contextMenu', e, folder.id)"
      >
        <MoreVertical class="w-3 h-3 text-muted-foreground" />
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
        @drop-on-folder="emit('dropOnFolder', $event, child.id)"
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

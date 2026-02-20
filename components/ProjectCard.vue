<script setup lang="ts">
import { Star, MoreVertical, Edit2, Trash2, Clock } from 'lucide-vue-next'

interface Project {
  id: string
  title: string
  thumbnail: string
  editedAt: Date
  isFavorite: boolean
  folderId: string | null
}

interface Props {
  project: Project
  viewMode: 'grid' | 'list'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  open: [projectId: string]
  toggleFavorite: [projectId: string]
  delete: [projectId: string]
}>()

const showMenu = ref(false)
const isHovered = ref(false)

const formatDistanceToNow = (date: Date) => {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMins = Math.floor(diffInMs / 60000)
  const diffInHours = Math.floor(diffInMs / 3600000)
  const diffInDays = Math.floor(diffInMs / 86400000)

  if (diffInMins < 1) return 'Agora'
  if (diffInMins < 60) return `${diffInMins}m atrás`
  if (diffInHours < 24) return `${diffInHours}h atrás`
  if (diffInDays < 7) return `${diffInDays}d atrás`
  return date.toLocaleDateString('pt-BR')
}

const handleMenuAction = (action: 'favorite' | 'delete') => {
  if (action === 'favorite') {
    emit('toggleFavorite', props.project.id)
  } else if (action === 'delete') {
    emit('delete', props.project.id)
  }
  showMenu.value = false
}
</script>

<template>
  <!-- Grid View -->
  <div
    v-if="viewMode === 'grid'"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="emit('open', project.id)"
    class="project-card group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300"
    :class="[
      'bg-card/60 backdrop-blur-xl border border-border/50',
      'hover:shadow-xl hover:-translate-y-1 hover:border-primary/30'
    ]"
  >
    <!-- Thumbnail -->
    <div class="aspect-[4/3] overflow-hidden bg-muted/50 relative">
      <img
        :src="project.thumbnail"
        :alt="project.title"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      <!-- Overlay (visible on hover) -->
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <button class="px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-900 rounded-xl font-medium shadow-lg hover:bg-white transition-all hover:scale-105">
          Abrir projeto
        </button>
      </div>

      <!-- Favorite Badge -->
      <button
        @click.stop="emit('toggleFavorite', project.id)"
        class="absolute top-3 right-3 p-2 rounded-xl transition-all duration-200"
        :class="[
          'backdrop-blur-sm',
          project.isFavorite
            ? 'bg-yellow-500/90 text-white'
            : 'bg-black/20 text-white/70 hover:bg-black/30 hover:text-white'
        ]"
      >
        <Star
          class="w-4 h-4"
          :class="{ 'fill-current': project.isFavorite }"
        />
      </button>
    </div>

    <!-- Info -->
    <div class="p-4">
      <h3 class="font-semibold text-sm mb-1 truncate">{{ project.title }}</h3>
      <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock class="w-3 h-3" />
        <span>{{ formatDistanceToNow(project.editedAt) }}</span>
      </div>
    </div>
  </div>

  <!-- List View -->
  <div
    v-else
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click="emit('open', project.id)"
    class="project-card-list group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200"
    :class="[
      'bg-card/60 backdrop-blur-sm border border-border/50',
      'hover:bg-card/80 hover:border-primary/30'
    ]"
  >
    <!-- Thumbnail -->
    <div class="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50">
      <img
        :src="project.thumbnail"
        :alt="project.title"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <h3 class="font-medium text-sm truncate">{{ project.title }}</h3>
      <p class="text-xs text-muted-foreground">{{ formatDistanceToNow(project.editedAt) }}</p>
    </div>

    <!-- Favorite Button -->
    <button
      @click.stop="emit('toggleFavorite', project.id)"
      class="p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
      :class="[
        project.isFavorite
          ? 'bg-yellow-500/20 text-yellow-500'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
      ]"
    >
      <Star
        class="w-4 h-4"
        :class="{ 'fill-current': project.isFavorite }"
      />
    </button>

    <!-- Actions Menu -->
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        @click.stop="emit('delete', project.id)"
        class="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Excluir"
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-card {
  animation: fadeIn 0.3s ease-out;
}

.project-card-list {
  animation: slideIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

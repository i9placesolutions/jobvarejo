<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useStyleReferences, type StyleReference } from '~/composables/useStyleReferences'
import { Upload, Trash2, Sparkles, X, Tag } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'generate', payload: { prompt: string; size: string; title: string; subtitle: string; tagFilter: string }): void
}>()

const {
  items,
  isLoading,
  isUploading,
  error,
  allTags,
  loadReferences,
  uploadReference,
  deleteReference,
} = useStyleReferences()

const fileInputRef = ref<HTMLInputElement | null>(null)
const showGenerateForm = ref(false)
const generatePrompt = ref('')
const generateTitle = ref('')
const generateSubtitle = ref('')
const generateSize = ref('1080x1920')
const generateTagFilter = ref('')

onMounted(() => {
  loadReferences()
})

const handleFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  for (let i = 0; i < Math.min(files.length, 5); i++) {
    const file = files[i]
    if (!file || !file.type.startsWith('image/')) continue
    try {
      await uploadReference(file, { displayName: file.name })
    } catch (err) {
      // error handled by composable
    }
  }

  // Reset input
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const handleDelete = async (id: string) => {
  if (!confirm('Remover esta inspiracao?')) return
  await deleteReference(id).catch(() => {})
}

const handleGenerate = () => {
  if (!generatePrompt.value.trim()) return
  emit('generate', {
    prompt: generatePrompt.value.trim(),
    size: generateSize.value,
    title: generateTitle.value.trim(),
    subtitle: generateSubtitle.value.trim(),
    tagFilter: generateTagFilter.value.trim(),
  })
}

const SIZES = [
  { value: '1080x1920', label: 'Stories (9:16)' },
  { value: '1080x1080', label: 'Post (1:1)' },
  { value: '1920x1080', label: 'Banner (16:9)' },
  { value: '1080x1350', label: 'Feed (4:5)' },
]
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header + Upload -->
    <div class="px-3 pt-3 pb-2 shrink-0 space-y-2">
      <!-- Upload Button -->
      <button
        @click="fileInputRef?.click()"
        :disabled="isUploading"
        class="w-full h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all
               bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:border-violet-500/50
               disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload :size="14" />
        {{ isUploading ? 'Enviando...' : 'Enviar Inspiracao' }}
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- Generate Button -->
      <button
        @click="showGenerateForm = !showGenerateForm"
        class="w-full h-9 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all
               bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/25 hover:border-fuchsia-500/50"
      >
        <Sparkles :size="14" />
        Gerar Arte Institucional
      </button>
    </div>

    <!-- Generate Form (collapsible) -->
    <div v-if="showGenerateForm" class="px-3 pb-3 space-y-2 border-b border-white/5 shrink-0 animate-in slide-in-from-top-2 duration-200">
      <div>
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">O que criar</label>
        <textarea
          v-model="generatePrompt"
          placeholder="Ex: Arte de Natal para supermercado com tema festivo..."
          class="w-full h-16 bg-[#2a2a2a]/60 border border-white/10 rounded-md text-[11px] text-zinc-100 px-2.5 py-2
                 focus:outline-none focus:border-violet-500/50 placeholder:text-zinc-600 resize-none"
        />
      </div>
      <div>
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">Titulo (opcional)</label>
        <input
          v-model="generateTitle"
          placeholder="FELIZ NATAL"
          class="w-full h-7 bg-[#2a2a2a]/60 border border-white/10 rounded-md text-[11px] text-zinc-100 px-2.5
                 focus:outline-none focus:border-violet-500/50 placeholder:text-zinc-600"
        />
      </div>
      <div>
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">Subtitulo (opcional)</label>
        <input
          v-model="generateSubtitle"
          placeholder="De toda equipe do supermercado X"
          class="w-full h-7 bg-[#2a2a2a]/60 border border-white/10 rounded-md text-[11px] text-zinc-100 px-2.5
                 focus:outline-none focus:border-violet-500/50 placeholder:text-zinc-600"
        />
      </div>
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">Formato</label>
          <select
            v-model="generateSize"
            class="w-full h-7 bg-[#2a2a2a]/60 border border-white/10 rounded-md text-[11px] text-zinc-100 px-2
                   focus:outline-none focus:border-violet-500/50"
          >
            <option v-for="s in SIZES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 block">Estilo de</label>
          <select
            v-model="generateTagFilter"
            class="w-full h-7 bg-[#2a2a2a]/60 border border-white/10 rounded-md text-[11px] text-zinc-100 px-2
                   focus:outline-none focus:border-violet-500/50"
          >
            <option value="">Todas inspiracoes</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </div>
      </div>
      <button
        @click="handleGenerate"
        :disabled="!generatePrompt.trim()"
        class="w-full h-8 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all
               bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white hover:from-fuchsia-500 hover:to-violet-500
               disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-fuchsia-500/20"
      >
        <Sparkles :size="13" />
        Gerar Agora
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="mx-3 mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md text-[10px] text-red-300 flex items-start gap-2">
      <X :size="12" class="shrink-0 mt-0.5 cursor-pointer" @click="error = null" />
      {{ error }}
    </div>

    <!-- Gallery -->
    <div class="flex-1 overflow-y-auto custom-scrollbar px-2 py-2">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <div class="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>

      <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-8 text-center px-4">
        <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <Sparkles :size="20" class="text-zinc-600" />
        </div>
        <p class="text-[11px] text-zinc-500 leading-relaxed">
          Envie imagens que voce gosta como inspiracao.<br />
          A IA vai aprender seu estilo e criar artes baseadas nele.
        </p>
      </div>

      <div v-else class="grid grid-cols-2 gap-1.5">
        <div
          v-for="item in items"
          :key="item.id"
          class="group relative aspect-[3/4] rounded-lg overflow-hidden bg-[#2a2a2a] border border-white/5 hover:border-violet-500/30 transition-all cursor-pointer"
        >
          <img
            v-if="item.url"
            :src="item.url"
            :alt="item.displayName || 'Inspiracao'"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- Tags -->
            <div class="absolute bottom-7 left-1.5 right-1.5 flex flex-wrap gap-0.5">
              <span
                v-for="tag in (item.tags || []).slice(0, 3)"
                :key="tag"
                class="px-1 py-0.5 bg-violet-500/30 rounded text-[8px] text-violet-200 font-medium"
              >{{ tag }}</span>
            </div>
            <!-- Delete -->
            <button
              @click.stop="handleDelete(item.id)"
              class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <Trash2 :size="11" />
            </button>
            <!-- Name -->
            <div class="absolute bottom-1.5 left-1.5 right-1.5">
              <span class="text-[9px] text-white/80 truncate block">{{ item.displayName || 'Sem nome' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer: count -->
    <div v-if="items.length > 0" class="px-3 py-1.5 border-t border-white/5 shrink-0">
      <span class="text-[9px] text-zinc-600">{{ items.length }} inspiracao(oes)</span>
    </div>
  </div>
</template>

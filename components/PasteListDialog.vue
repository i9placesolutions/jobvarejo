<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from './ui/Button.vue'
import { Upload, X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  activePasteTab: string
  pasteListText: string
  pastedImage: string | null
  isAnalyzingImage: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:activePasteTab', value: string): void
  (e: 'update:pasteListText', value: string): void
  (e: 'update:pastedImage', value: string | null): void
  (e: 'update:isAnalyzingImage', value: boolean): void
  (e: 'submit'): void
}>()

const listImageInput = ref<HTMLInputElement | null>(null)

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const tab = computed({
  get: () => props.activePasteTab,
  set: (v: string) => emit('update:activePasteTab', v)
})

const listText = computed({
  get: () => props.pasteListText,
  set: (v: string) => emit('update:pasteListText', v)
})

const image = computed({
  get: () => props.pastedImage,
  set: (v: string | null) => emit('update:pastedImage', v)
})

const analyzing = computed({
  get: () => props.isAnalyzingImage,
  set: (v: boolean) => emit('update:isAnalyzingImage', v)
})

const triggerListImageUpload = () => {
  listImageInput.value?.click()
}

const handleListImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    image.value = (e.target?.result as string) || null
  }
  reader.readAsDataURL(file)
}

const analyzeImageWithAI = () => {
  analyzing.value = true
  setTimeout(() => {
    analyzing.value = false
    listText.value = 'Picanha Bovina - 69.90\nCerveja Heineken - 5.99\nCarvão 5kg - 15.00'
    tab.value = 'text'
  }, 2000)
}

const handleImagePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.indexOf('image') === -1) continue
    const blob = item.getAsFile()
    if (!blob) continue
    const reader = new FileReader()
    reader.onload = (e) => {
      image.value = (e.target?.result as string) || null
      tab.value = 'image'
    }
    reader.readAsDataURL(blob)
  }
}
</script>

<template>
  <UiDialog v-model="open" title="Importar Lista de Produtos" @close="open = false" width="500px">
    <template #default>
      <div class="space-y-4 py-3" @paste="handleImagePaste">
        <div class="flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
          <button
            @click="tab = 'text'"
            :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', tab === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
          >
            Texto/Lista
          </button>
          <button
            @click="tab = 'image'"
            :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', tab === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
          >
            Imagem
          </button>
        </div>

        <div v-if="tab === 'text'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Cole a lista de produtos</label>
            <textarea
              v-model="listText"
              rows="8"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
              placeholder="Ex:\nPicanha - 69.90\nCerveja Heineken - 5.99\nCarvão 5kg - 15.00"
            />
            <p class="text-[10px] text-muted-foreground">
              Formato flexível: nome - preço, nome preço, ou com ponto/vírgula.
            </p>
          </div>
        </div>

        <div v-else class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div
            v-if="!image"
            class="relative border-2 border-dashed border-violet-400/40 rounded-2xl p-6 bg-gradient-to-br from-violet-500/5 to-pink-500/5 hover:border-violet-400/70 hover:bg-violet-500/10 transition-all duration-300 cursor-pointer group flex flex-col items-center gap-3"
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
              <img :src="image" class="max-w-full max-h-full object-contain shadow-2xl" />
              <button @click="image = null" class="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all">
                <X class="w-4 h-4" />
              </button>
            </div>
            <Button class="w-full mt-2" :disabled="analyzing" @click="analyzeImageWithAI">
              <span v-if="analyzing" class="flex items-center gap-2"><div class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> Analisando...</span>
              <span v-else>Extrair Produtos com IA</span>
            </Button>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full pt-2">
        <Button variant="ghost" class="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground" @click="open = false">Cancelar</Button>
        <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-6 h-9 text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all" :disabled="!pasteListText && activePasteTab === 'text'" @click="emit('submit')">Adicionar ao Palco</Button>
      </div>
    </template>
  </UiDialog>
</template>

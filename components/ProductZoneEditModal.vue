<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import { Trash2, Plus, Image as ImageIcon, Check, Link2, X } from 'lucide-vue-next'

export type ZoneEditItem = {
  id: string
  name: string
  imageUrl: string | null
  priceLabel: string
}

const props = defineProps<{
  modelValue: boolean
  items: ZoneEditItem[]
  zoneName?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update-name', id: string, name: string): void
  (e: 'replace-image-url', id: string, url: string): void
  (e: 'remove-item', id: string): void
  (e: 'add-items'): void
}>()

// Drafts locais: flush do nome no blur/enter evita disparar atualizacao a cada tecla
const nameDraft = ref<Record<string, string>>({})
const imageUrlDraft = ref<Record<string, string>>({})
const imageEditingId = ref<string | null>(null)

watch(
  () => props.items,
  (next) => {
    const nextNames: Record<string, string> = {}
    const nextUrls: Record<string, string> = {}
    next.forEach((item) => {
      nextNames[item.id] = nameDraft.value[item.id] ?? item.name ?? ''
      nextUrls[item.id] = imageUrlDraft.value[item.id] ?? item.imageUrl ?? ''
    })
    nameDraft.value = nextNames
    imageUrlDraft.value = nextUrls
  },
  { immediate: true, deep: true }
)

watch(
  () => props.modelValue,
  (open) => {
    if (open) imageEditingId.value = null
  }
)

const totalLabel = computed(() => {
  const n = props.items.length
  if (n === 0) return 'Nenhum item'
  if (n === 1) return '1 item'
  return `${n} itens`
})

const dialogTitle = computed(() => `Editar ${props.zoneName || 'zona de produtos'}`)

const commitName = (id: string) => {
  const next = String(nameDraft.value[id] ?? '').trim()
  const current = props.items.find((i) => i.id === id)
  if (!current) return
  if (next === (current.name || '').trim()) return
  emit('update-name', id, next)
}

const startEditImage = async (id: string) => {
  imageEditingId.value = id
  await nextTick()
  const el = document.getElementById(`zone-edit-image-input-${id}`) as HTMLInputElement | null
  el?.focus()
  el?.select()
}

const cancelEditImage = (id: string) => {
  const current = props.items.find((i) => i.id === id)
  imageUrlDraft.value[id] = current?.imageUrl ?? ''
  imageEditingId.value = null
}

const commitImage = (id: string) => {
  const next = String(imageUrlDraft.value[id] ?? '').trim()
  if (!next) {
    cancelEditImage(id)
    return
  }
  const current = props.items.find((i) => i.id === id)
  if (!current || next === (current.imageUrl || '')) {
    imageEditingId.value = null
    return
  }
  emit('replace-image-url', id, next)
  imageEditingId.value = null
}

const handleClose = () => emit('update:modelValue', false)

const onNameEnter = (ev: KeyboardEvent) => {
  const el = ev.target as HTMLInputElement | null
  el?.blur()
}

const onImageError = (ev: Event) => {
  const img = ev.target as HTMLImageElement | null
  if (img) img.style.opacity = '0.3'
}
</script>

<template>
  <Dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="640px"
    content-class="p-0"
    @update:model-value="(v) => emit('update:modelValue', !!v)"
  >
    <div class="flex flex-col">
      <!-- Subtitle / counter -->
      <p class="px-6 pt-4 text-[11px] text-zinc-400">
        {{ totalLabel }} — altere nome, troque a imagem ou remova itens. O visual da zona é preservado.
      </p>

      <!-- List -->
      <div class="max-h-[55vh] overflow-y-auto px-6 py-4">
        <div
          v-if="items.length === 0"
          class="flex flex-col items-center justify-center gap-3 py-12 text-center"
        >
          <ImageIcon class="h-10 w-10 text-zinc-600" />
          <p class="text-sm text-zinc-400">A zona está vazia.</p>
          <Button size="sm" variant="default" @click="emit('add-items')">
            <Plus class="mr-1 h-3.5 w-3.5" />
            Adicionar produtos
          </Button>
        </div>

        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="item in items"
            :key="item.id"
            class="group flex items-start gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-3 transition-colors hover:border-white/15"
          >
            <!-- Thumbnail -->
            <div
              class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/8 bg-zinc-950"
            >
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                :alt="item.name"
                class="h-full w-full object-contain"
                loading="lazy"
                @error="onImageError"
              />
              <ImageIcon v-else class="h-5 w-5 text-zinc-600" />
            </div>

            <!-- Fields -->
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <input
                v-model="nameDraft[item.id]"
                type="text"
                class="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none transition-colors focus:border-emerald-400/40"
                placeholder="Nome do produto"
                @blur="commitName(item.id)"
                @keydown.enter.prevent="onNameEnter($event)"
              />

              <div class="flex items-center gap-2">
                <span
                  v-if="item.priceLabel"
                  class="inline-flex shrink-0 items-center rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300"
                  title="Para editar o preço, feche este modal e clique no preço no canvas"
                >
                  {{ item.priceLabel }}
                </span>

                <div
                  v-if="imageEditingId === item.id"
                  class="flex flex-1 items-center gap-1.5"
                >
                  <input
                    :id="`zone-edit-image-input-${item.id}`"
                    v-model="imageUrlDraft[item.id]"
                    type="url"
                    class="min-w-0 flex-1 rounded border border-emerald-400/40 bg-black/40 px-2 py-1 text-[11px] text-white outline-none"
                    placeholder="https://..."
                    @keydown.enter.prevent="commitImage(item.id)"
                    @keydown.escape.prevent="cancelEditImage(item.id)"
                  />
                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 transition-colors hover:bg-emerald-500/25"
                    title="Aplicar"
                    @click="commitImage(item.id)"
                  >
                    <Check class="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                    title="Cancelar"
                    @click="cancelEditImage(item.id)"
                  >
                    <X class="h-3 w-3" />
                  </button>
                </div>
                <button
                  v-else
                  type="button"
                  class="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                  @click="startEditImage(item.id)"
                >
                  <Link2 class="h-3 w-3" />
                  Trocar imagem
                </button>
              </div>
            </div>

            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/8 text-zinc-400 opacity-70 transition-all hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 hover:opacity-100 group-hover:opacity-100"
              title="Remover item"
              @click="emit('remove-item', item.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <Button
        v-if="items.length > 0"
        size="sm"
        variant="secondary"
        class="mr-auto"
        @click="emit('add-items')"
      >
        <Plus class="mr-1 h-3.5 w-3.5" />
        Adicionar mais
      </Button>
      <Button size="sm" variant="default" @click="handleClose">
        Concluir
      </Button>
    </template>
  </Dialog>
</template>

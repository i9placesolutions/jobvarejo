<script setup lang="ts">
import type { LabelTemplate } from '~/types/label-template'
import LabelTemplateMiniEditor from './LabelTemplateMiniEditor.vue'

const props = defineProps<{
  templates: LabelTemplate[]
  selectedTemplateId?: string
  canSaveFromSelection?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-from-selection', name: string): void
  (e: 'create-default', name: string): void
  (e: 'edit-selection'): void
  (e: 'update-from-selection', templateId: string): void
  (e: 'insert-to-canvas', templateId: string): void
  (e: 'update-template', templateId: string, updates: { group: any; previewDataUrl?: string; name?: string }): void
  (e: 'duplicate', templateId: string): void
  (e: 'delete', templateId: string): void
  (e: 'apply-to-zone', templateId?: string): void
  (e: 'set-splash-image', templateId: string, file: File): void
}>()

const name = ref('Etiqueta')
const pendingDeleteId = ref<string | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)
const imageTargetId = ref<string | null>(null)
const editingTemplateId = ref<string | null>(null)

const openImagePicker = (templateId: string) => {
  imageTargetId.value = templateId
  fileInput.value?.click()
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const templateId = imageTargetId.value
  if (file && templateId) emit('set-splash-image', templateId, file)
  // reset for selecting the same file again
  if (input) input.value = ''
  imageTargetId.value = null
}
</script>

<template>
  <div class="space-y-4">
    <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="onFileChange" />

    <div class="flex items-center justify-between">
      <div class="text-xs text-zinc-400 leading-snug">
        Use estes modelos para padronizar a etiqueta de preco das ofertas.
        Para editar uma etiqueta que ja existe no produto: duplo clique no produto, depois duplo clique na etiqueta.
      </div>
      <button class="text-xs text-zinc-300 hover:text-white" @click="emit('close')">Fechar</button>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all"
        :class="canSaveFromSelection ? 'border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20' : 'border-zinc-700 text-zinc-500 cursor-not-allowed'"
        :disabled="!canSaveFromSelection"
        @click="emit('edit-selection')"
        title="Selecione um produto (ou a etiqueta) no canvas para habilitar"
      >
        Editar Etiqueta Selecionada
      </button>
      <span class="text-[10px] text-zinc-500">Selecione um produto no canvas para habilitar</span>
    </div>

    <div class="flex items-end gap-2">
      <div class="flex-1">
        <label class="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Novo Modelo</label>
        <input
          v-model="name"
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
          placeholder="Ex: Etiqueta Neon"
        />
      </div>
      <button
        class="h-8.5 px-3 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all"
        :class="canSaveFromSelection ? 'border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20' : 'border-zinc-700 text-zinc-500 cursor-not-allowed'"
        :disabled="!canSaveFromSelection"
        @click="emit('create-from-selection', name)"
        title="Selecione uma etiqueta (grupo) no canvas para salvar como modelo"
      >
        Salvar da Selecao
      </button>
      <button
        class="h-8.5 px-3 rounded-lg border border-zinc-700 bg-zinc-800/60 text-xs font-bold uppercase tracking-widest text-zinc-200 hover:bg-zinc-700 transition-all"
        @click="emit('create-default', name)"
        title="Cria um modelo padrao (mesmo sem selecao)"
      >
        Criar Padrao
      </button>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors"
        @click="emit('apply-to-zone', undefined)"
      >
        Usar Padrao (Sem modelo)
      </button>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Modelos</span>
        <span class="text-[10px] text-zinc-500">{{ templates.length }}</span>
      </div>

      <div v-if="templates.length === 0" class="p-4 border border-white/5 rounded-xl text-xs text-zinc-500">
        Nenhum modelo ainda. Selecione uma etiqueta no canvas e clique em "Salvar da Selecao".
      </div>

      <div v-else class="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="p-3 rounded-xl border flex items-center justify-between gap-3"
          :class="(tpl.id === selectedTemplateId) ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/5 bg-zinc-900/30'"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div v-if="tpl.previewDataUrl" class="w-20 h-10 rounded-lg overflow-hidden border border-white/10 bg-black/20 shrink-0">
              <img :src="tpl.previewDataUrl" class="w-full h-full object-contain" />
            </div>
            <div v-else class="w-20 h-10 rounded-lg overflow-hidden border border-white/10 bg-black/20 shrink-0 flex items-center justify-center text-[9px] text-zinc-500">
              Sem preview
            </div>
            <div class="min-w-0">
              <div class="text-xs font-semibold text-white truncate">
                {{ tpl.name }}
                <span v-if="tpl.isBuiltIn" class="ml-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Padrao</span>
              </div>
              <div class="text-[10px] text-zinc-500 truncate">Atualizado: {{ new Date(tpl.updatedAt).toLocaleString() }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              @click="emit('apply-to-zone', tpl.id)"
            >
              Aplicar na Zona
            </button>
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              @click="emit('insert-to-canvas', tpl.id)"
              title="Insere este modelo no canvas para voce editar e depois salvar/atualizar"
            >
              Inserir
            </button>
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              @click="editingTemplateId = tpl.id"
              title="Abre o mini editor no modal"
            >
              Editar
            </button>
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              @click="openImagePicker(tpl.id)"
              title="Usar uma imagem como fundo do splash"
            >
              Splash Imagem
            </button>
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              :disabled="!canSaveFromSelection"
              @click="emit('update-from-selection', tpl.id)"
              title="Atualiza este modelo com base na etiqueta atualmente selecionada no canvas"
            >
              Atualizar
            </button>
            <button
              class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200"
              @click="emit('duplicate', tpl.id)"
            >
              Duplicar
            </button>
            <button
              v-if="!tpl.isBuiltIn"
              class="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[10px] text-red-300"
              @click="pendingDeleteId = tpl.id"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="editingTemplateId" class="p-4 rounded-2xl border border-white/10 bg-zinc-950/30 max-h-[60vh] overflow-y-auto">
      <LabelTemplateMiniEditor
        :template="templates.find(t => t.id === editingTemplateId) || null"
        @close="editingTemplateId = null"
        @save="(id, updates) => { emit('update-template', id, updates); editingTemplateId = null }"
      />
    </div>

    <div v-if="pendingDeleteId" class="p-3 border border-red-500/20 bg-red-500/10 rounded-xl flex items-center justify-between gap-3">
      <div class="text-xs text-red-200">Excluir este modelo? Isso nao apaga etiquetas ja existentes no canvas.</div>
      <div class="flex items-center gap-2">
        <button class="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200" @click="pendingDeleteId = null">Cancelar</button>
        <button
          class="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-[10px] text-red-100"
          @click="emit('delete', pendingDeleteId); pendingDeleteId = null"
        >
          Excluir
        </button>
      </div>
    </div>
  </div>
</template>

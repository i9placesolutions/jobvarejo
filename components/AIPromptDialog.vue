<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'
import { Sparkles, Wand2 } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  aiPrompt: string
  processing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:aiPrompt', value: string): void
  (e: 'generate'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const prompt = computed({
  get: () => props.aiPrompt,
  set: (v: string) => emit('update:aiPrompt', v)
})
</script>

<template>
  <UiDialog v-model="open" title="Assistente Criativo" @close="open = false" width="460px">
    <template #default>
      <div class="space-y-5 py-3">
        <div class="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div class="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Sparkles class="w-4 h-4 text-violet-300" />
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-violet-200">Descreva seu design</p>
            <p class="text-[11px] text-violet-100/80">A IA vai montar uma base visual inicial</p>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prompt Criativo</label>
          <textarea
            v-model="prompt"
            rows="4"
            class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
            placeholder="Ex: Encarte de supermercado com destaque para ofertas de fim de semana..."
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button @click="prompt = 'Encarte de Supermercado, cores vibrantes, estilo varejo popular'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Varejo Popular</button>
          <button @click="prompt = 'Banner minimalista de eletrônicos, cores dark, neon azul'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Tech Dark</button>
          <button @click="prompt = 'Folheto de padaria, tons pastéis, estilo artesanal'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Artesanal</button>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <button @click="open = false" class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Fechar</button>
        <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-10 text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-violet-500/20 active:scale-95 transition-all" :disabled="!aiPrompt || processing" @click="emit('generate')">
          <Wand2 class="w-4 h-4 mr-2" />
          Gerar
        </Button>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
/**
 * Modal de Layout Estrutural do Produto
 * Replica o escolher-layout-produto-v2 do QROfertas
 * Permite configurar o layout estrutural dos boxes de produto (inteligente vs padrao)
 */

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { flyer, updateFlyer } = useBuilderFlyer()
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)

// Box modes (Padrao vs Inteligente)
const boxModes = [
  { id: 'standard', label: 'Padrao', desc: 'Layout fixo e uniforme' },
  { id: 'smart', label: 'Inteligente', desc: 'Adapta conforme conteudo' },
]

// Layouts de produto (ordem dos elementos no card)
const productLayouts = [
  { id: 'nome-imagem-preco', label: 'Nome → Imagem → Preco', order: ['name', 'image', 'price'] },
  { id: 'imagem-nome-preco', label: 'Imagem → Nome → Preco', order: ['image', 'name', 'price'] },
  { id: 'preco-imagem-nome', label: 'Preco → Imagem → Nome', order: ['price', 'image', 'name'] },
  { id: 'nome-preco-imagem', label: 'Nome → Preco → Imagem', order: ['name', 'price', 'image'] },
]

// Posicao da etiqueta de preco
const pricePositions = [
  { id: 'below', label: 'Abaixo da imagem' },
  { id: 'overlay-bottom', label: 'Sobre imagem (baixo)' },
  { id: 'overlay-center', label: 'Sobre imagem (centro)' },
  { id: 'overlay-top', label: 'Sobre imagem (topo)' },
]

const currentBoxMode = computed(() => fontConfig.value.box_mode || 'smart')
const currentProductLayout = computed(() => fontConfig.value.product_layout_order || ['name', 'image', 'price'])
const currentPricePosition = computed(() => fontConfig.value.price_position || 'below')

const setBoxMode = (id: string) => {
  updateFlyer({ font_config: { ...fontConfig.value, box_mode: id } })
}

const setProductLayout = (layout: typeof productLayouts[number]) => {
  updateFlyer({ font_config: { ...fontConfig.value, product_layout_order: layout.order } })
}

const setPricePosition = (id: string) => {
  updateFlyer({ font_config: { ...fontConfig.value, price_position: id } })
}

const setFc = (changes: Record<string, any>) => {
  updateFlyer({ font_config: { ...fontConfig.value, ...changes } })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 class="text-sm font-semibold text-gray-800">Layout do Produto</h3>
          <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-5">
          <!-- Box Mode -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Modo dos Boxes</label>
            <div class="grid grid-cols-2 gap-3">
              <button v-for="mode in boxModes" :key="mode.id"
                @click="setBoxMode(mode.id)"
                :class="['p-3 rounded-lg border-2 transition-all text-left',
                  currentBoxMode === mode.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50']">
                <span class="text-xs font-semibold" :class="currentBoxMode === mode.id ? 'text-emerald-700' : 'text-gray-700'">{{ mode.label }}</span>
                <p class="text-[9px] text-gray-400 mt-0.5">{{ mode.desc }}</p>
              </button>
            </div>
          </div>

          <!-- Ordem dos Elementos -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Ordem dos Elementos</label>
            <div class="space-y-2">
              <button v-for="layout in productLayouts" :key="layout.id"
                @click="setProductLayout(layout)"
                :class="['w-full p-2.5 rounded-lg border-2 transition-all text-left flex items-center gap-2',
                  JSON.stringify(currentProductLayout) === JSON.stringify(layout.order)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50']">
                <!-- Mini preview -->
                <div class="w-10 h-12 rounded bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-0.5 shrink-0 overflow-hidden">
                  <template v-for="(el, idx) in layout.order" :key="el">
                    <div v-if="el === 'name'" class="w-7 h-1 bg-gray-300 rounded" />
                    <div v-else-if="el === 'image'" class="w-5 h-3 bg-gray-200 rounded border border-gray-300" />
                    <div v-else-if="el === 'price'" class="w-6 h-1.5 bg-emerald-300 rounded" />
                  </template>
                </div>
                <span class="text-[10px] text-gray-600 font-medium">{{ layout.label }}</span>
              </button>
            </div>
          </div>

          <!-- Posicao do Preco -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Posicao da Etiqueta de Preco</label>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="pos in pricePositions" :key="pos.id"
                @click="setPricePosition(pos.id)"
                :class="['py-2 px-2 rounded-lg text-[10px] font-medium border transition-colors text-center',
                  currentPricePosition === pos.id
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100']">
                {{ pos.label }}
              </button>
            </div>
          </div>

          <!-- Toggles extras -->
          <div class="space-y-2.5 border-t border-gray-200 pt-4">
            <label class="flex items-center justify-between gap-2 cursor-pointer">
              <span class="text-[11px] text-gray-500">Nome em 2 colunas</span>
              <button type="button" @click="setFc({ name_two_columns: !(fontConfig.name_two_columns ?? false) })"
                :class="['w-8 h-4 rounded-full transition-colors', fontConfig.name_two_columns ? 'bg-emerald-500' : 'bg-gray-300']">
                <span :class="['block w-3 h-3 rounded-full bg-white shadow transition-transform', fontConfig.name_two_columns ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </label>
            <label class="flex items-center justify-between gap-2 cursor-pointer">
              <span class="text-[11px] text-gray-500">Imagem com borda</span>
              <button type="button" @click="setFc({ image_border: !(fontConfig.image_border ?? false) })"
                :class="['w-8 h-4 rounded-full transition-colors', fontConfig.image_border ? 'bg-emerald-500' : 'bg-gray-300']">
                <span :class="['block w-3 h-3 rounded-full bg-white shadow transition-transform', fontConfig.image_border ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end px-4 py-3 border-t border-gray-200">
          <button @click="emit('close')" class="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500">Fechar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

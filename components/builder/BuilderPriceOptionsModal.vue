<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { BuilderPriceMode } from '~/types/builder'

const props = defineProps<{
  currentMode: BuilderPriceMode
}>()

const emit = defineEmits<{
  select: [mode: BuilderPriceMode, applyAll: boolean]
  close: []
}>()

const applyAll = ref(false)
const setAsDefault = ref(false)

interface PriceModeOption {
  value: BuilderPriceMode
  label: string
  description: string
  isDefault?: boolean
}

const options: PriceModeOption[] = [
  {
    value: 'simple',
    label: 'Preco Simples',
    description: 'Mostra apenas o preco de oferta do produto.',
    isDefault: true,
  },
  {
    value: 'from_to',
    label: 'Preco Normal e Preco de Oferta',
    description: 'Mostra o preco original riscado + preco de oferta. Opcionalmente mostra % de desconto.',
  },
  {
    value: 'x_per_y',
    label: 'Preco X por Y',
    description: 'Mostra a quantidade que o cliente leva por um determinado preco. Ex: "3 Kilos Por R$15,88"',
  },
  {
    value: 'take_pay',
    label: 'Preco Leve X Pague Y',
    description: 'Mostra quantas unidades o cliente leva ao pagar por Y. Ex: "Leve 3 Pague 2"',
  },
  {
    value: 'installment',
    label: 'Preco A Vista e Parcelado',
    description: 'Mostra o preco a vista e o valor das parcelas, com opcao de "Sem Juros".',
  },
  {
    value: 'symbolic',
    label: 'Preco Simbolico (Moedas/Notas)',
    description: 'Mostra moedas ou notas reais no lugar dos valores. Ideal para produtos abaixo de R$5.',
  },
  {
    value: 'club_price',
    label: 'Preco Clube / Fidelizacao',
    description: 'Mostra o preco normal e o preco de clube/fidelizacao com nome customizavel.',
  },
  {
    value: 'anticipation',
    label: 'Antecipacao de Ofertas',
    description: 'Mostra um texto personalizado no lugar do preco. Ex: "Preco Especial", "Venha Conferir".',
  },
  {
    value: 'none',
    label: 'Sem Etiqueta',
    description: 'Nao mostra nenhum preco. O produto aparece so com imagem e nome.',
  },
]

const handleSelect = (mode: BuilderPriceMode) => {
  emit('select', mode, applyAll.value)
}

const handleOverlayClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    @click="handleOverlayClick"
  >
    <div class="w-full max-w-lg max-h-[85vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <h2 class="text-sm font-semibold text-white">Opcoes de Preco</h2>
        <button
          @click="$emit('close')"
          class="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Checkboxes -->
      <div class="px-5 py-3 border-b border-white/5 space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="applyAll"
            type="checkbox"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b] text-emerald-500 accent-emerald-500"
          />
          <span class="text-[11px] text-zinc-300">Aplicar em todos os produtos do encarte</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="setAsDefault"
            type="checkbox"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b] text-emerald-500 accent-emerald-500"
          />
          <span class="text-[11px] text-zinc-300">Definir como Padrao da conta</span>
        </label>
      </div>

      <!-- Options list -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        <button
          v-for="opt in options"
          :key="opt.value"
          @click="handleSelect(opt.value)"
          class="w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left"
          :class="[
            currentMode === opt.value
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-white/5 bg-[#09090b]/50 hover:border-white/10 hover:bg-[#09090b]/80'
          ]"
        >
          <!-- Radio indicator -->
          <div class="mt-0.5 shrink-0">
            <div
              class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
              :class="currentMode === opt.value ? 'border-emerald-500' : 'border-zinc-600'"
            >
              <div
                v-if="currentMode === opt.value"
                class="w-2 h-2 rounded-full bg-emerald-500"
              />
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-white">{{ opt.label }}</span>
              <span
                v-if="opt.isDefault"
                class="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300"
              >PADRAO</span>
            </div>
            <p class="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{{ opt.description }}</p>
          </div>

          <!-- Preview -->
          <div class="shrink-0 w-[80px] flex items-center justify-center">
            <!-- Simple preview -->
            <div v-if="opt.value === 'simple'" class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-1">
              <span class="text-[7px] font-bold">R$</span>
              <span class="text-sm font-extrabold">15</span>
              <span class="text-[8px] font-bold">,88</span>
            </div>

            <!-- From/To preview -->
            <div v-else-if="opt.value === 'from_to'" class="flex flex-col items-center gap-0.5">
              <span class="text-[8px] text-zinc-400 line-through">R$40,00</span>
              <div class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-0.5">
                <span class="text-[6px] font-bold">R$</span>
                <span class="text-[11px] font-extrabold">20</span>
                <span class="text-[7px] font-bold">,00</span>
              </div>
            </div>

            <!-- X per Y preview -->
            <div v-else-if="opt.value === 'x_per_y'" class="flex flex-col items-center gap-0.5">
              <span class="text-[8px] text-zinc-300 font-semibold">3 Kilos</span>
              <div class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-0.5">
                <span class="text-[6px] font-bold">R$</span>
                <span class="text-[11px] font-extrabold">15</span>
                <span class="text-[7px] font-bold">,88</span>
              </div>
            </div>

            <!-- Take/Pay preview -->
            <div v-else-if="opt.value === 'take_pay'" class="flex flex-col items-center gap-0.5">
              <span class="text-[7px] text-white font-bold bg-red-600 rounded px-1 py-0.5">Leve 3 Pague 2</span>
              <div class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-0.5">
                <span class="text-[6px] font-bold">R$</span>
                <span class="text-[11px] font-extrabold">40</span>
                <span class="text-[7px] font-bold">,00</span>
              </div>
            </div>

            <!-- Installment preview -->
            <div v-else-if="opt.value === 'installment'" class="flex flex-col items-center gap-0.5">
              <span class="text-[7px] text-zinc-300 font-semibold">10X de</span>
              <div class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-0.5">
                <span class="text-[6px] font-bold">R$</span>
                <span class="text-[11px] font-extrabold">153</span>
                <span class="text-[7px] font-bold">,90</span>
              </div>
              <span class="text-[7px] text-red-400 font-bold">Sem Juros</span>
            </div>

            <!-- Symbolic preview -->
            <div v-else-if="opt.value === 'symbolic'" class="flex items-center gap-0.5">
              <div class="w-5 h-5 rounded-full bg-yellow-400 border border-yellow-600 flex items-center justify-center">
                <span class="text-[6px] font-extrabold text-yellow-900">R$1</span>
              </div>
              <div class="w-5 h-5 rounded-full bg-yellow-400 border border-yellow-600 flex items-center justify-center">
                <span class="text-[6px] font-extrabold text-yellow-900">R$1</span>
              </div>
            </div>

            <!-- Club price preview -->
            <div v-else-if="opt.value === 'club_price'" class="flex flex-col items-center gap-0.5">
              <span class="text-[7px] text-red-400 font-bold">Preco Clube</span>
              <div class="flex items-baseline gap-0.5 bg-red-600 text-white rounded-md px-1.5 py-0.5">
                <span class="text-[6px] font-bold">R$</span>
                <span class="text-[11px] font-extrabold">15</span>
                <span class="text-[7px] font-bold">,88</span>
              </div>
            </div>

            <!-- Anticipation preview -->
            <div v-else-if="opt.value === 'anticipation'" class="flex flex-col items-center gap-0.5">
              <span class="text-[7px] text-zinc-400">Preco</span>
              <div class="bg-red-600 text-white rounded-md px-2 py-1">
                <span class="text-[9px] font-bold">Especial</span>
              </div>
            </div>

            <!-- None preview -->
            <div v-else-if="opt.value === 'none'" class="text-[9px] text-zinc-600 italic">
              —
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

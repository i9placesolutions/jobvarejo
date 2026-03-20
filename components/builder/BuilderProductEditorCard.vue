<script setup lang="ts">
import {
  GripVertical,
  X,
  ImagePlus,
  Loader2,
  Settings2,
} from 'lucide-vue-next'
import type { BuilderFlyerProduct, BuilderPriceMode, BuilderProductUnit } from '~/types/builder'

const props = defineProps<{
  product: BuilderFlyerProduct
  index: number
}>()

const { updateProduct, removeProduct } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const showPriceModal = ref(false)

// Price mode options (all 9)
const priceModes: { value: BuilderPriceMode; label: string }[] = [
  { value: 'simple', label: 'Preco Simples' },
  { value: 'from_to', label: 'De / Por' },
  { value: 'x_per_y', label: 'X por Y (Qtd)' },
  { value: 'take_pay', label: 'Leve / Pague' },
  { value: 'installment', label: 'Parcelado' },
  { value: 'symbolic', label: 'Simbolico' },
  { value: 'club_price', label: 'Preco Clube' },
  { value: 'anticipation', label: 'Antecipacao' },
  { value: 'none', label: 'Sem Etiqueta' },
]

// Unit options
const unitOptions: BuilderProductUnit[] = [
  'UN', 'KG', 'G', 'L', 'ML', 'PCT', 'CX', 'DZ', 'BD', 'FD', 'SC',
]

// Quantity unit options for x_per_y
const quantityUnitOptions = [
  'Kilos', 'Unidades', 'Litros', 'Pacotes', 'Caixas', 'Duzias',
]

const update = (fields: Partial<BuilderFlyerProduct>) => {
  updateProduct(props.index, fields)
}

const handleImageClick = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !tenant.value) return

  isUploading.value = true
  try {
    const tenantId = tenant.value.id
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = `builder/${tenantId}/products/${filename}`
    const contentType = file.type || 'image/jpeg'

    const body = await file.arrayBuffer()

    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: new Uint8Array(body),
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    })

    const config = useRuntimeConfig().public.wasabi || {} as any
    const endpoint = config.endpoint || 's3.wasabisys.com'
    const bucket = config.bucket || 'jobvarejo'
    const publicUrl = `https://${endpoint}/${bucket}/${key}`

    update({ custom_image: publicUrl })
  } catch (err) {
    console.error('[BuilderProductEditorCard] Upload error:', err)
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

const handlePriceModeChange = (e: Event) => {
  const mode = (e.target as HTMLSelectElement).value as BuilderPriceMode
  update({ price_mode: mode })
}

const handleUnitChange = (e: Event) => {
  const unit = (e.target as HTMLSelectElement).value as BuilderProductUnit
  update({ unit })
}

const handleNameInput = (e: Event) => {
  update({ custom_name: (e.target as HTMLInputElement).value || null })
}

const handleOfferPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ offer_price: val ? Number(val) : null })
}

const handleOriginalPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ original_price: val ? Number(val) : null })
}

const handleTakeQuantityInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ take_quantity: val ? Number(val) : null })
}

const handlePayQuantityInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ pay_quantity: val ? Number(val) : null })
}

const handleInstallmentCountInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ installment_count: val ? Number(val) : null })
}

const handleInstallmentPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ installment_price: val ? Number(val) : null })
}

const handleClubNameInput = (e: Event) => {
  update({ club_name: (e.target as HTMLInputElement).value || null })
}

const handleAnticipationTextInput = (e: Event) => {
  update({ anticipation_text: (e.target as HTMLInputElement).value || null })
}

const handleQuantityUnitChange = (e: Event) => {
  update({ quantity_unit: (e.target as HTMLSelectElement).value || null })
}

const handleObservationInput = (e: Event) => {
  update({ observation: (e.target as HTMLTextAreaElement).value || null })
}

const handleHighlightToggle = () => {
  update({ is_highlight: !props.product.is_highlight })
}

const handleAdultToggle = () => {
  update({ is_adult: !props.product.is_adult })
}

const handleNoInterestToggle = () => {
  update({ no_interest: !props.product.no_interest })
}

const handleShowDiscountToggle = () => {
  update({ show_discount: !props.product.show_discount })
}

const handleRemove = () => {
  removeProduct(props.index)
}

const handlePriceModeSelected = (mode: BuilderPriceMode, applyAll: boolean) => {
  if (applyAll) {
    // Emit to parent or handle batch update
    // For now, just update current product
    update({ price_mode: mode })
  } else {
    update({ price_mode: mode })
  }
  showPriceModal.value = false
}

// CSS classes reused
const inputClass = 'w-full bg-[#09090b]/50 text-[11px] text-white placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors'
const labelClass = 'text-[10px] text-zinc-500 block mb-0.5'
const priceInputClass = 'w-full bg-[#09090b]/50 text-[11px] text-emerald-400 placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors'
</script>

<template>
  <div class="w-[220px] bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden relative group">
    <!-- Delete button (top-right) -->
    <button
      @click="handleRemove"
      class="absolute top-2 right-2 z-10 p-1 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300
        opacity-0 group-hover:opacity-100 transition-all"
      title="Remover produto"
    >
      <X class="w-3.5 h-3.5" />
    </button>

    <!-- Drag handle -->
    <div class="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors">
      <GripVertical class="w-4 h-4" />
    </div>

    <!-- Image area -->
    <button
      @click="handleImageClick"
      class="w-full h-[100px] bg-[#09090b]/50 border-y border-white/5 flex items-center justify-center overflow-hidden
        hover:bg-[#09090b]/70 transition-colors relative"
    >
      <img
        v-if="product.custom_image"
        :src="product.custom_image"
        :alt="product.custom_name || 'Produto'"
        class="w-full h-full object-contain"
      />
      <div v-else-if="isUploading" class="flex flex-col items-center gap-1 text-zinc-500">
        <Loader2 class="w-5 h-5 animate-spin" />
        <span class="text-[10px]">Enviando...</span>
      </div>
      <div v-else class="flex flex-col items-center gap-1 text-zinc-500 hover:text-emerald-400 transition-colors">
        <ImagePlus class="w-5 h-5" />
        <span class="text-[10px]">Adicionar imagem</span>
      </div>
    </button>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- Form fields -->
    <div class="p-2.5 space-y-2">
      <!-- Position indicator -->
      <span class="text-[10px] text-zinc-600">#{{ index + 1 }}</span>

      <!-- Product name -->
      <input
        :value="product.custom_name || ''"
        @input="handleNameInput"
        placeholder="Nome do produto"
        :class="inputClass"
      />

      <!-- Price mode selector with gear icon -->
      <div class="flex gap-1.5">
        <select
          :value="product.price_mode"
          @change="handlePriceModeChange"
          class="flex-1 bg-[#09090b]/50 text-[11px] text-white outline-none
            border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors
            appearance-none cursor-pointer"
        >
          <option
            v-for="mode in priceModes"
            :key="mode.value"
            :value="mode.value"
            class="bg-[#1a1a1a] text-white"
          >
            {{ mode.label }}
          </option>
        </select>
        <button
          @click="showPriceModal = true"
          class="p-1.5 rounded-md bg-[#09090b]/50 border border-white/5 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
          title="Opcoes de preco"
        >
          <Settings2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- ═══════ Dynamic fields per price mode ═══════ -->

      <!-- simple -->
      <div v-if="product.price_mode === 'simple'" class="space-y-1.5">
        <div>
          <label :class="labelClass">Preco Oferta</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
      </div>

      <!-- from_to -->
      <div v-else-if="product.price_mode === 'from_to'" class="space-y-1.5">
        <div>
          <label :class="labelClass">De (preco normal)</label>
          <input
            :value="product.original_price ?? ''"
            @input="handleOriginalPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            class="w-full bg-[#09090b]/50 text-[11px] text-zinc-400 placeholder-zinc-600 outline-none
              border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors line-through"
          />
        </div>
        <div>
          <label :class="labelClass">Por (preco oferta)</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="product.show_discount"
            @change="handleShowDiscountToggle"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b]/50 text-emerald-500 accent-emerald-500"
          />
          <span class="text-[10px] text-zinc-400">Mostrar % desconto</span>
        </label>
      </div>

      <!-- x_per_y -->
      <div v-else-if="product.price_mode === 'x_per_y'" class="space-y-1.5">
        <div class="flex gap-1.5">
          <div class="flex-1">
            <label :class="labelClass">Quantidade</label>
            <input
              :value="product.take_quantity ?? ''"
              @input="handleTakeQuantityInput"
              placeholder="3"
              type="number"
              min="1"
              :class="inputClass"
            />
          </div>
          <div class="flex-1">
            <label :class="labelClass">Unidade</label>
            <select
              :value="product.quantity_unit || 'Kilos'"
              @change="handleQuantityUnitChange"
              class="w-full bg-[#09090b]/50 text-[11px] text-white outline-none
                border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors
                appearance-none cursor-pointer"
            >
              <option
                v-for="qu in quantityUnitOptions"
                :key="qu"
                :value="qu"
                class="bg-[#1a1a1a] text-white"
              >{{ qu }}</option>
            </select>
          </div>
        </div>
        <div>
          <label :class="labelClass">Preco unitario</label>
          <input
            :value="product.original_price ?? ''"
            @input="handleOriginalPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            class="w-full bg-[#09090b]/50 text-[11px] text-zinc-400 placeholder-zinc-600 outline-none
              border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors"
          />
        </div>
        <div>
          <label :class="labelClass">Preco total oferta</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
      </div>

      <!-- take_pay -->
      <div v-else-if="product.price_mode === 'take_pay'" class="space-y-1.5">
        <div class="flex gap-1.5">
          <div class="flex-1">
            <label :class="labelClass">Leve</label>
            <input
              :value="product.take_quantity ?? ''"
              @input="handleTakeQuantityInput"
              placeholder="3"
              type="number"
              min="1"
              :class="inputClass"
            />
          </div>
          <div class="flex-1">
            <label :class="labelClass">Pague</label>
            <input
              :value="product.pay_quantity ?? ''"
              @input="handlePayQuantityInput"
              placeholder="2"
              type="number"
              min="1"
              :class="inputClass"
            />
          </div>
        </div>
        <div>
          <label :class="labelClass">Preco unitario</label>
          <input
            :value="product.original_price ?? ''"
            @input="handleOriginalPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            class="w-full bg-[#09090b]/50 text-[11px] text-zinc-400 placeholder-zinc-600 outline-none
              border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors"
          />
        </div>
        <div>
          <label :class="labelClass">Preco oferta</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
      </div>

      <!-- installment -->
      <div v-else-if="product.price_mode === 'installment'" class="space-y-1.5">
        <div>
          <label :class="labelClass">Preco a vista</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
        <div class="flex gap-1.5">
          <div class="flex-1">
            <label :class="labelClass">Parcelas</label>
            <input
              :value="product.installment_count ?? ''"
              @input="handleInstallmentCountInput"
              placeholder="10"
              type="number"
              min="1"
              max="48"
              :class="inputClass"
            />
          </div>
          <div class="flex-1">
            <label :class="labelClass">Valor parcela</label>
            <input
              :value="product.installment_price ?? ''"
              @input="handleInstallmentPriceInput"
              placeholder="0,00"
              type="number"
              step="0.01"
              min="0"
              :class="priceInputClass"
            />
          </div>
        </div>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="product.no_interest"
            @change="handleNoInterestToggle"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b]/50 text-emerald-500 accent-emerald-500"
          />
          <span class="text-[10px] text-zinc-400">Sem Juros</span>
        </label>
      </div>

      <!-- symbolic -->
      <div v-else-if="product.price_mode === 'symbolic'" class="space-y-1.5">
        <div>
          <label :class="labelClass">Preco (para moedas/notas)</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
        <p class="text-[9px] text-zinc-600 leading-tight">
          O valor determina quais moedas/notas serao exibidas no selo.
        </p>
      </div>

      <!-- club_price -->
      <div v-else-if="product.price_mode === 'club_price'" class="space-y-1.5">
        <div>
          <label :class="labelClass">Nome do programa</label>
          <input
            :value="product.club_name || ''"
            @input="handleClubNameInput"
            placeholder="Preco Clube"
            :class="inputClass"
          />
        </div>
        <div>
          <label :class="labelClass">Preco normal</label>
          <input
            :value="product.original_price ?? ''"
            @input="handleOriginalPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            class="w-full bg-[#09090b]/50 text-[11px] text-zinc-400 placeholder-zinc-600 outline-none
              border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors line-through"
          />
        </div>
        <div>
          <label :class="labelClass">Preco clube</label>
          <input
            :value="product.offer_price ?? ''"
            @input="handleOfferPriceInput"
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            :class="priceInputClass"
          />
        </div>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="product.show_discount"
            @change="handleShowDiscountToggle"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b]/50 text-emerald-500 accent-emerald-500"
          />
          <span class="text-[10px] text-zinc-400">Mostrar % desconto</span>
        </label>
      </div>

      <!-- anticipation -->
      <div v-else-if="product.price_mode === 'anticipation'" class="space-y-1.5">
        <div>
          <label :class="labelClass">Texto do selo</label>
          <input
            :value="product.anticipation_text || ''"
            @input="handleAnticipationTextInput"
            placeholder="Preco Especial"
            :class="inputClass"
          />
        </div>
      </div>

      <!-- none: no price fields -->
      <div v-else-if="product.price_mode === 'none'" class="py-1">
        <p class="text-[10px] text-zinc-600 italic">Sem etiqueta de preco</p>
      </div>

      <!-- Unit selector (shown for modes that need it) -->
      <div v-if="!['anticipation', 'none', 'symbolic', 'installment'].includes(product.price_mode)">
        <label :class="labelClass">Unidade</label>
        <select
          :value="product.unit"
          @change="handleUnitChange"
          class="w-full bg-[#09090b]/50 text-[11px] text-white outline-none
            border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors
            appearance-none cursor-pointer"
        >
          <option
            v-for="u in unitOptions"
            :key="u"
            :value="u"
            class="bg-[#1a1a1a] text-white"
          >
            {{ u }}
          </option>
        </select>
      </div>

      <!-- Observation -->
      <div>
        <label :class="labelClass">Observacao</label>
        <textarea
          :value="product.observation || ''"
          @input="handleObservationInput"
          placeholder="Ex: Valido ate 30/03"
          rows="2"
          class="w-full bg-[#09090b]/50 text-[11px] text-white placeholder-zinc-600 outline-none
            border border-white/5 focus:border-emerald-500/50 rounded-md px-2 py-1.5 transition-colors resize-none"
        />
      </div>

      <!-- Toggle row: highlight + adult -->
      <div class="flex items-center justify-between gap-2 pt-1">
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="product.is_highlight"
            @change="handleHighlightToggle"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b]/50 text-emerald-500
              focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer accent-emerald-500"
          />
          <span class="text-[10px] text-zinc-400">Destaque</span>
        </label>

        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            :checked="product.is_adult"
            @change="handleAdultToggle"
            class="w-3.5 h-3.5 rounded border-white/10 bg-[#09090b]/50 text-emerald-500
              focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer accent-emerald-500"
          />
          <span class="text-[10px] text-zinc-400">+18</span>
        </label>
      </div>
    </div>

    <!-- Price Options Modal -->
    <BuilderPriceOptionsModal
      v-if="showPriceModal"
      :current-mode="product.price_mode"
      @select="handlePriceModeSelected"
      @close="showPriceModal = false"
    />
  </div>
</template>

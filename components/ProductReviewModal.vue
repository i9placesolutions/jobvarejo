<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { Sparkles, X, Check, AlertCircle, Loader2, Search, Upload, FolderOpen } from 'lucide-vue-next'
import { useProductProcessor, type SmartProduct } from '../composables/useProductProcessor'
import type { LabelTemplate } from '~/types/label-template'

const props = defineProps<{
    modelValue: boolean
    initialProducts?: SmartProduct[]
    showImportMode?: boolean
    existingCount?: number
    labelTemplates?: LabelTemplate[]
    initialLabelTemplateId?: string
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
    (e: 'import', products: SmartProduct[], opts?: { mode?: 'replace' | 'append'; labelTemplateId?: string }): void
}>()

const textInput = ref('')
const step = ref<'input' | 'review'>('input')
const listFileInput = ref<HTMLInputElement | null>(null)
const importMode = ref<'replace' | 'append'>('replace')

const LIST_FILE_ACCEPT = 'image/*,.csv,.tsv,.xlsx,.xls,.pdf,text/plain'

// Composable
const { 
    products, 
    isParsing, 
    parsingError, 
    parseText, 
    parseFile,
    processProductImage, 
    processAllImages, 
    removeProduct 
} = useProductProcessor()

const resolveProductIndex = (p: any) => {
    const id = p?.id
    if (id === null || id === undefined) return -1
    return (products.value || []).findIndex((x: any) => x?.id === id)
}

// Watcher to reset state when opening
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        importMode.value = 'replace'
        if (props.initialProducts && props.initialProducts.length > 0) {
            // Load external products directly into review mode
            products.value = [...props.initialProducts]
            step.value = 'review'
        } else if (products.value.length === 0) {
            step.value = 'input'
            textInput.value = ''
        }
    }
})

const handleParse = async () => {
    if (!textInput.value.trim()) return;
    
    await parseText(textInput.value);
    
    if (products.value.length > 0) {
        step.value = 'review';
        // Process all images automatically
        await processAllImages();
    }
}

const triggerFilePicker = () => {
    listFileInput.value?.click()
}

const handleFileSelected = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    await parseFile(file)

    if (products.value.length > 0) {
        step.value = 'review'
        await processAllImages()
    }
}

const handleDropFile = async (event: DragEvent) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    await parseFile(file)
    if (products.value.length > 0) {
        step.value = 'review'
        await processAllImages()
    }
}

const handleImport = () => {
    // Filter only valid products? Or import all?
    // Provide a clean list to parent
    emit('import', JSON.parse(JSON.stringify(products.value)), {
        mode: importMode.value,
        labelTemplateId: selectedLabelTemplateId.value || undefined
    });
    emit('update:modelValue', false);
    
    // Reset for next time?
    // products.value = []; 
    // step.value = 'input';
}

const showAssetPicker = ref(false)
const isLoadingAssets = ref(false)
const assets = ref<any[]>([])
const assetSearch = ref('')
const selectedProductIndex = ref<number | null>(null)
const showLabelPreview = ref(false)

const reviewSearch = ref('')
const selectedLabelTemplateId = ref<string>('')

watch(
    () => props.modelValue,
    (open) => {
        if (!open) return
        selectedLabelTemplateId.value = String(props.initialLabelTemplateId || '')
        reviewSearch.value = ''
    }
)

const labelTemplateList = computed(() => {
    const list = Array.isArray(props.labelTemplates) ? props.labelTemplates : []
    return list
        .filter(Boolean)
        .slice()
        .sort((a: any, b: any) => {
            const ab = !!a?.isBuiltIn
            const bb = !!b?.isBuiltIn
            if (ab !== bb) return ab ? -1 : 1
            return String(a?.name || '').localeCompare(String(b?.name || ''))
        })
})

const selectedLabelTemplate = computed(() => {
    const id = String(selectedLabelTemplateId.value || '')
    if (!id) return null
    return labelTemplateList.value.find(t => String(t.id) === id) || null
})

const normalizeText = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const filteredAssets = computed(() => {
    if (!assetSearch.value.trim()) return assets.value
    const query = normalizeText(assetSearch.value)
    return assets.value.filter((item) => normalizeText(item.name || '').includes(query))
})

const fetchAssets = async () => {
    isLoadingAssets.value = true
    try {
        const data = await $fetch('/api/assets')
        if (data && Array.isArray(data)) {
            assets.value = data
        }
    } catch (error) {
        console.error('Falha ao buscar assets:', error)
    } finally {
        isLoadingAssets.value = false
    }
}

const openAssetPicker = async (index: number) => {
    selectedProductIndex.value = index
    showAssetPicker.value = true
    if (!assets.value.length) {
        await fetchAssets()
    }
}

const handleAssetSelect = (asset: any) => {
    if (selectedProductIndex.value === null) return
    const product = products.value[selectedProductIndex.value]
    if (!product) return
    product.imageUrl = asset.url
    product.status = 'done'
    product.error = undefined
    showAssetPicker.value = false
    selectedProductIndex.value = null
}

const handleImageUpload = (event: Event, index: number) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const product = products.value[index]
    if (!product) return

    product.imageUrl = URL.createObjectURL(file)
    product.status = 'done'
    product.error = undefined
    input.value = ''
}

const getStatusColor = (status: string) => {
    switch(status) {
        case 'done': return 'text-green-500';
        case 'processing': return 'text-blue-500';
        case 'error': return 'text-red-500';
        default: return 'text-zinc-500';
    }
}

const filteredProducts = computed(() => {
    const list = products.value || []
    const q = normalizeText(String(reviewSearch.value || '').trim())
    if (!q) return list
    return list.filter((p: any) => {
        const hay = normalizeText(`${p?.name || ''} ${p?.brand || ''} ${p?.price || ''} ${p?.pricePack || ''} ${p?.priceUnit || ''} ${p?.priceSpecial || ''} ${p?.priceSpecialUnit || ''} ${p?.specialCondition || ''} ${p?.priceWholesale || ''}`)
        return hay.includes(q)
    })
})
</script>

<template>
    <Dialog 
        :model-value="modelValue" 
        @update:model-value="$emit('update:modelValue', $event)" 
        title="Importação Inteligente"
        width="800px"
    >
        <div class="flex flex-col gap-4 min-h-100">
            
            <!-- STEP 1: INPUT -->
            <div v-if="step === 'input'" class="flex flex-col gap-4 flex-1">
                <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3 text-blue-200 text-xs">
                    <Sparkles class="w-5 h-5 shrink-0" />
                    <p>Cole sua lista de produtos ou envie um arquivo (CSV/Excel/PDF/imagem). A IA identifica preços unitário/atacado e busca imagens automaticamente.</p>
                </div>

                <!-- File Upload / Drop -->
                <div
                    class="border border-dashed border-zinc-700 rounded-lg p-4 bg-zinc-900/40 hover:bg-zinc-900/60 transition-colors"
                    @dragover.prevent
                    @drop.prevent="handleDropFile"
                >
                    <input
                        ref="listFileInput"
                        type="file"
                        class="hidden"
                        :accept="LIST_FILE_ACCEPT"
                        @change="handleFileSelected"
                    />
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-zinc-200">Importar por arquivo</div>
                            <div class="text-[10px] text-zinc-500 truncate">Arraste e solte aqui ou clique em “Escolher arquivo”</div>
                        </div>
                        <Button variant="ghost" size="sm" class="shrink-0" @click="triggerFilePicker" :disabled="isParsing">
                            <Upload class="w-3.5 h-3.5 mr-2" />
                            Escolher arquivo
                        </Button>
                    </div>
                    <div class="mt-2 text-[10px] text-zinc-500">Suporta: imagem, CSV, Excel, PDF, TXT</div>
                </div>

                <textarea 
                    v-model="textInput"
                    placeholder="Ex: Arroz Tio João 5kg R$ 29,90, Feijão Camil 1kg 8,90..."
                    class="flex-1 w-full bg-zinc-800 border-zinc-700 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-blue-500"
                ></textarea>

                <div class="flex justify-end pt-2">
                    <Button @click="handleParse" :disabled="isParsing || !textInput.trim()">
                        <template v-if="isParsing">
                            <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                            Analisando...
                        </template>
                        <template v-else>
                            Processar Lista
                        </template>
                    </Button>
                </div>

                <p v-if="parsingError" class="text-red-400 text-xs">{{ parsingError }}</p>
            </div>

            <!-- STEP 2: REVIEW -->
            <div v-else class="flex flex-col gap-4 flex-1 h-full overflow-hidden">
                <!-- Review Header / Controls -->
                <div class="p-3 rounded-lg border border-white/10 bg-zinc-900/40">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-xs font-semibold text-zinc-100 truncate">Revisão dos produtos</div>
                            <div class="text-[10px] text-zinc-500">
                                Mostrando <span class="text-zinc-300 font-medium">{{ filteredProducts.length }}</span> de
                                <span class="text-zinc-300 font-medium">{{ products.length }}</span>
                            </div>
                        </div>
                        <div class="w-70 max-w-[45%]">
                            <Input v-model="reviewSearch" placeholder="Buscar (nome, marca, preço...)" class="h-9 text-sm" />
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div v-if="props.showImportMode" class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-white/10 bg-black/20">
                            <div class="min-w-0">
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Modo</div>
                                <div class="text-[10px] text-zinc-500 truncate">
                                    Zona tem <span class="text-zinc-300 font-medium">{{ Math.max(0, Number(props.existingCount || 0)) }}</span> itens
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <button
                                    type="button"
                                    class="h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all"
                                    :class="importMode === 'replace' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    @click="importMode = 'replace'"
                                    title="Remove os produtos atuais da zona e recria a grade"
                                >
                                    Substituir
                                </button>
                                <button
                                    type="button"
                                    class="h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all"
                                    :class="importMode === 'append' ? 'bg-white/10 text-white border-white/15' : 'text-zinc-400 border-white/5 hover:bg-white/5'"
                                    @click="importMode = 'append'"
                                    title="Adiciona ao que já existe e reorganiza a grade"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-white/10 bg-black/20">
                            <div class="min-w-0">
                                <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Etiqueta</div>
                                <div class="text-[10px] text-zinc-500 truncate">
                                    Modelo aplicado aos novos cards
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <img
                                    v-if="selectedLabelTemplate?.previewDataUrl"
                                    :src="selectedLabelTemplate.previewDataUrl"
                                    alt="preview"
                                    class="w-16 h-6.5 object-contain rounded bg-zinc-800/60 border border-zinc-700 cursor-pointer hover:border-zinc-500 transition-colors"
                                    @click="showLabelPreview = true"
                                />
                                <select
                                    class="h-8 bg-transparent border border-zinc-700 rounded px-2 text-xs text-zinc-200 focus:outline-none min-w-45"
                                    :value="selectedLabelTemplateId"
                                    @change="selectedLabelTemplateId = String(($event.target as HTMLSelectElement).value || '')"
                                >
                                    <option value="">(usar padrão da zona)</option>
                                    <option v-for="tpl in labelTemplateList" :key="tpl.id" :value="tpl.id">
                                        {{ tpl.name }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="overflow-y-auto custom-scrollbar flex-1 border border-zinc-800 rounded-lg bg-zinc-900/50">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-zinc-800 text-zinc-400 sticky top-0 z-10">
                            <tr>
                                <th class="p-3 w-15">Img</th>
                                <th class="p-3">Produto</th>
                                <th class="p-3 w-80">Preços (Und | Emb | +Esp | Esp)</th>
                                <th class="p-3 w-20">Status</th>
                                <th class="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-zinc-800">
                            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-white/5 group">
                                <!-- Image Column -->
                                <td class="p-2">
                                    <div class="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700 relative">
                                        <img v-if="product.imageUrl" :src="product.imageUrl" class="w-full h-full object-contain" />
                                        <Loader2 v-else-if="product.status === 'processing'" class="w-4 h-4 text-blue-500 animate-spin" />
                                        <AlertCircle v-else-if="product.status === 'error'" class="w-4 h-4 text-red-500" />
                                        <div v-else class="text-zinc-600 font-xs">?</div>
                                        <input
                                            :id="`image-upload-${product.id}`"
                                            type="file"
                                            class="hidden"
                                            accept="image/*"
                                            @change="handleImageUpload($event, resolveProductIndex(product))"
                                        />

                                        <div class="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                            <button
                                                class="bg-black/60 text-white rounded p-1"
                                                title="Selecionar do Storage"
                                                @click.stop="openAssetPicker(resolveProductIndex(product))"
                                            >
                                                <FolderOpen class="w-3 h-3" />
                                            </button>
                                        </div>
                                        
                                        <!-- Hover Action to Retry -->
                                        <div 
                                            v-if="!product.imageUrl && product.status !== 'processing'" 
                                            class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer z-10"
                                            @click="processProductImage(resolveProductIndex(product))"
                                            title="Buscar Imagem"
                                        >
                                            <Search class="w-3 h-3 text-white" />
                                        </div>
                                        <label
                                            :for="`image-upload-${product.id}`"
                                            class="absolute top-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 cursor-pointer z-20"
                                            title="Enviar Imagem"
                                        >
                                            <Upload class="w-3 h-3" />
                                        </label>
                                    </div>
                                </td>
                                
                                <!-- Name Input -->
                                <td class="p-2">
                                    <input 
                                        v-model="product.name" 
                                        class="w-full bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-medium placeholder-zinc-600"
                                        placeholder="Nome do Produto"
                                    />
                                    <input 
                                        v-model="product.brand" 
                                        class="w-full bg-transparent border-none text-zinc-500 focus:ring-0 p-0 text-[10px]"
                                        placeholder="Marca (opcional)"
                                    />
                                </td>

                                <!-- Price Input -->
                                <td class="p-2">
                                    <!-- ===== PREÇOS PRINCIPAIS ===== -->
                                    <div class="space-y-1">
                                        <!-- Preço Unitário (Principal) -->
                                        <div class="flex items-center text-zinc-400 gap-1">
                                            <span class="text-[9px] uppercase text-zinc-500">Und</span>
                                            <input
                                                v-model="product.priceUnit"
                                                class="w-full bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-white text-xs focus:outline-none focus:border-blue-500"
                                                placeholder="0,00"
                                            />
                                            <span class="text-[9px] uppercase text-zinc-500">Emb</span>
                                            <input
                                                v-model="product.pricePack"
                                                class="w-full bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-white text-xs focus:outline-none focus:border-blue-500"
                                                placeholder="0,00"
                                            />
                                        </div>

                                        <!-- Preços Especiais/Promocionais -->
                                        <div class="flex items-center text-green-400 gap-1">
                                            <span class="text-[9px] uppercase text-green-500">+Esp</span>
                                            <input
                                                v-model="product.priceSpecialUnit"
                                                class="w-full bg-transparent border border-green-900/50 rounded px-1 py-0.5 text-green-300 text-xs focus:outline-none focus:border-green-500"
                                                placeholder="0,00"
                                            />
                                            <span class="text-[9px] uppercase text-green-500">Esp</span>
                                            <input
                                                v-model="product.priceSpecial"
                                                class="w-full bg-transparent border border-green-900/50 rounded px-1 py-0.5 text-green-300 text-xs focus:outline-none focus:border-green-500"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    <!-- ===== METADATA DE EMBALAGEM ===== -->
                                    <div class="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
                                        <span class="uppercase">Emb</span>
                                        <input
                                            :value="product.packageLabel ?? ''"
                                            @input="e => product.packageLabel = String((e.target as any).value || '').toUpperCase()"
                                            class="w-10 bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-zinc-200 focus:outline-none"
                                            placeholder="FD"
                                        />
                                        <span class="uppercase">C/</span>
                                        <input
                                            type="number"
                                            :value="product.packQuantity ?? ''"
                                            @input="e => { const v = Number((e.target as any).value); product.packQuantity = Number.isFinite(v) && v > 0 ? v : null }"
                                            class="w-14 bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-zinc-200 focus:outline-none"
                                            placeholder="12"
                                        />
                                        <input
                                            :value="product.packUnit ?? ''"
                                            @input="e => product.packUnit = String((e.target as any).value || '').toUpperCase()"
                                            class="w-10 bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-zinc-200 focus:outline-none"
                                            placeholder="UN"
                                        />
                                    </div>

                                    <!-- ===== CONDIÇÃO ESPECIAL ===== -->
                                    <div class="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                                        <span class="uppercase">Condição</span>
                                        <input
                                            :value="product.specialCondition ?? ''"
                                            @input="e => product.specialCondition = String((e.target as any).value || '')"
                                            class="flex-1 bg-transparent border border-zinc-800 rounded px-1 py-0.5 text-zinc-200 focus:outline-none"
                                            placeholder="ACIMA DE 36 UN."
                                        />
                                    </div>

                                    <!-- ===== PREÇO LEGADO (opcional, colapsado) ===== -->
                                    <details class="mt-1">
                                        <summary class="text-[9px] text-zinc-600 cursor-pointer hover:text-zinc-400">Legado</summary>
                                        <div class="mt-1 flex items-center gap-1 text-[10px] text-zinc-600">
                                            <span>R$</span>
                                            <input
                                                :value="product.price ?? ''"
                                                @input="e => product.price = String((e.target as any).value || '')"
                                                class="w-full bg-transparent border border-zinc-800/50 rounded px-1 py-0.5 text-zinc-500 focus:outline-none"
                                                placeholder="0,00"
                                            />
                                            <span class="uppercase">Atac.</span>
                                            <input
                                                type="number"
                                                :value="product.wholesaleTrigger ?? ''"
                                                @input="e => { const v = Number((e.target as any).value); product.wholesaleTrigger = Number.isFinite(v) && v > 0 ? v : null }"
                                                class="w-10 bg-transparent border border-zinc-800/50 rounded px-1 py-0.5 text-zinc-500 focus:outline-none"
                                                placeholder="10"
                                            />
                                            <input
                                                :value="product.wholesaleTriggerUnit ?? ''"
                                                @input="e => product.wholesaleTriggerUnit = String((e.target as any).value || '').toUpperCase()"
                                                class="w-8 bg-transparent border border-zinc-800/50 rounded px-1 py-0.5 text-zinc-500 focus:outline-none"
                                                placeholder="FD"
                                            />
                                            <span>R$</span>
                                            <input
                                                :value="product.priceWholesale ?? ''"
                                                @input="e => product.priceWholesale = String((e.target as any).value || '')"
                                                class="w-full bg-transparent border border-zinc-800/50 rounded px-1 py-0.5 text-zinc-500 focus:outline-none"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </details>
                                </td>
                                
                                <!-- Status -->
                                <td class="p-2">
                                    <span :class="['text-[10px] font-medium uppercase', getStatusColor(product.status)]">
                                        {{ product.status }}
                                    </span>
                                </td>

                                <!-- Actions -->
                                <td class="p-2 text-right">
                                    <button @click="removeProduct(resolveProductIndex(product))" class="text-zinc-500 hover:text-red-400 p-1">
                                        <X class="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="flex justify-between items-center pt-2 border-t border-white/5">
                    <button @click="step = 'input'" class="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
                         <X class="w-3 h-3" /> Voltar
                    </button>
                    <div class="flex gap-2">
                        <Button variant="ghost" size="sm" @click="processAllImages">
                            <Search class="w-3.5 h-3.5 mr-2" />
                            Reprocessar Imagens
                        </Button>
                        <Button 
                            size="sm" 
                            @click="handleImport" 
                            class="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="products.some(p => p.status === 'processing')"
                        >
                            <Loader2 v-if="products.some(p => p.status === 'processing')" class="w-3.5 h-3.5 mr-2 animate-spin" />
                            <Check v-else class="w-3.5 h-3.5 mr-2" />
                            Importar {{ products.length }} Produtos
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    </Dialog>

    <Dialog v-model="showAssetPicker" title="Selecionar imagem" width="720px">
        <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
                <Input v-model="assetSearch" placeholder="Buscar no storage" class="flex-1" />
                <Button variant="ghost" size="sm" @click="fetchAssets" :disabled="isLoadingAssets">
                    <Loader2 v-if="isLoadingAssets" class="w-3.5 h-3.5 animate-spin" />
                    <span v-else>Atualizar</span>
                </Button>
            </div>

            <div class="max-h-90 overflow-y-auto custom-scrollbar border border-zinc-800 rounded-lg bg-zinc-900/50 p-3">
                <div v-if="isLoadingAssets" class="text-xs text-zinc-500">Carregando imagens...</div>
                <div v-else-if="!filteredAssets.length" class="text-xs text-zinc-500">Nenhuma imagem encontrada.</div>
                <div v-else class="grid grid-cols-3 gap-2">
                    <button
                        v-for="asset in filteredAssets"
                        :key="asset.id"
                        class="aspect-square bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700 hover:border-zinc-500 transition-all text-left"
                        @click="handleAssetSelect(asset)"
                    >
                        <img :src="asset.url" crossorigin="anonymous" class="w-full h-full object-cover" />
                    </button>
                </div>
            </div>
        </div>
    </Dialog>

    <!-- Label Preview Fullscreen Modal -->
    <Dialog v-model="showLabelPreview" title="Preview da Etiqueta" fullscreen>
        <div class="flex flex-col items-center justify-center w-full h-full">
            <img
                v-if="selectedLabelTemplate?.previewDataUrl"
                :src="selectedLabelTemplate.previewDataUrl"
                alt="Preview em tela cheia"
                class="max-w-full max-h-full object-contain"
            />
            <div v-else class="text-zinc-500 text-sm">Nenhuma etiqueta selecionada</div>
        </div>
    </Dialog>
</template>

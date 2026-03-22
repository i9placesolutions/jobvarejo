<script setup lang="ts">
import { Building2, Phone, MessageCircle, Instagram, Facebook, Globe, MapPin, CreditCard, Hash, Tag, Camera, Loader2, Check, Upload, Image, RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-vue-next'
import type { BuilderFlyerDefaults } from '~/types/builder'

definePageMeta({
  layout: 'builder',
  middleware: 'builder-auth',
})

const auth = useBuilderAuth()

// ── State ──────────────────────────────────────────────────────────────────────
const isLoading = ref(true)
const isSaving = ref(false)
const isUploading = ref(false)
const showSuccess = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  phone: '',
  phone2: '',
  whatsapp: '',
  instagram: '',
  facebook: '',
  website: '',
  address: '',
  payment_notes: '',
  cep: '',
  slogan: '',
  segment1: '',
  logo: '' as string | null,
})

// ── Flyer defaults (visibility, footer, payments, logo position) ────────────
const defaults = reactive<BuilderFlyerDefaults>({
  show_logo: true,
  show_company_name: true,
  show_slogan: false,
  show_phone: true,
  show_whatsapp: true,
  show_phone_label: true,
  show_payment_methods: false,
  show_payment_notes: false,
  show_address: true,
  show_instagram: true,
  show_facebook: false,
  show_website: false,
  logo_size: 80,
  logo_x: 50,
  logo_y: 50,
  payment_methods: ['pix', 'dinheiro', 'visa', 'mastercard', 'elo'],
  footer_layout: 'classico',
  footer_bg: null,
  footer_text_color: null,
  footer_primary: null,
  footer_secondary: null,
})

const segmentOptions = [
  'Supermercado',
  'Açougue',
  'Padaria',
  'Hortifruti',
  'Distribuidora',
  'Farmácia',
  'Pet Shop',
  'Material de Construção',
  'Outro',
]

const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', color: '#32BCAD' },
  { id: 'dinheiro', label: 'Dinheiro', color: '#2d6a4f' },
  { id: 'visa', label: 'Visa', color: '#1A1F71' },
  { id: 'mastercard', label: 'Mastercard', color: '#EB001B' },
  { id: 'elo', label: 'Elo', color: '#000' },
  { id: 'hipercard', label: 'Hipercard', color: '#822124' },
  { id: 'amex', label: 'American Express', color: '#016FD0' },
  { id: 'alelo', label: 'Alelo', color: '#00965E' },
  { id: 'sodexo', label: 'Sodexo', color: '#ED1C24' },
  { id: 'ticket', label: 'Ticket', color: '#DC0032' },
  { id: 'vr', label: 'VR', color: '#003399' },
  { id: 'greencard', label: 'GreenCard', color: '#006837' },
  { id: 'ben', label: 'Ben', color: '#FF6900' },
  { id: 'goodcard', label: 'GoodCard', color: '#0066B3' },
  { id: 'cabal', label: 'Cabal', color: '#00529B' },
  { id: 'banescard', label: 'Banescard', color: '#003366' },
]

const FOOTER_LAYOUTS = [
  { id: 'classico', label: 'Classico', desc: 'Tradicional' },
  { id: 'moderno', label: 'Moderno', desc: 'Clean e arredondado' },
  { id: 'elegante', label: 'Elegante', desc: 'Sofisticado' },
  { id: 'banner', label: 'Banner', desc: 'Impacto maximo' },
]

// ── Collapsible sections ────────────────────────────────────────────────────
const openSections = reactive<Record<string, boolean>>({
  identity: true,
  contact: true,
  address: false,
  social: false,
  payment: false,
  visibility: true,
  footer: false,
})

const toggleSection = (key: string) => {
  openSections[key] = !openSections[key]
}

// ── Payment methods ─────────────────────────────────────────────────────────
const isPaymentSelected = (id: string) => {
  return (defaults.payment_methods || []).includes(id)
}

const togglePayment = (id: string) => {
  const current = defaults.payment_methods || []
  if (current.includes(id)) {
    defaults.payment_methods = current.filter(x => x !== id)
  } else {
    defaults.payment_methods = [...current, id]
  }
}

// ── Pre-fill from tenant ───────────────────────────────────────────────────────
const populateForm = () => {
  const tenant = auth.tenant.value
  if (!tenant) return
  form.name = tenant.name || ''
  form.phone = tenant.phone || ''
  form.phone2 = tenant.phone2 || ''
  form.whatsapp = tenant.whatsapp || ''
  form.instagram = tenant.instagram || ''
  form.facebook = tenant.facebook || ''
  form.website = tenant.website || ''
  form.address = tenant.address || ''
  form.payment_notes = tenant.payment_notes || ''
  form.cep = tenant.cep || ''
  form.slogan = tenant.slogan || ''
  form.segment1 = tenant.segment1 || ''
  form.logo = tenant.logo || null

  // Load flyer defaults
  const fd = tenant.flyer_defaults
  if (fd) {
    defaults.show_logo = fd.show_logo ?? true
    defaults.show_company_name = fd.show_company_name ?? true
    defaults.show_slogan = fd.show_slogan ?? false
    defaults.show_phone = fd.show_phone ?? true
    defaults.show_whatsapp = fd.show_whatsapp ?? true
    defaults.show_phone_label = fd.show_phone_label ?? true
    defaults.show_payment_methods = fd.show_payment_methods ?? false
    defaults.show_payment_notes = fd.show_payment_notes ?? false
    defaults.show_address = fd.show_address ?? true
    defaults.show_instagram = fd.show_instagram ?? true
    defaults.show_facebook = fd.show_facebook ?? false
    defaults.show_website = fd.show_website ?? false
    defaults.logo_size = fd.logo_size ?? 80
    defaults.logo_x = fd.logo_x ?? 50
    defaults.logo_y = fd.logo_y ?? 50
    defaults.payment_methods = fd.payment_methods ?? ['pix', 'dinheiro', 'visa', 'mastercard', 'elo']
    defaults.footer_layout = fd.footer_layout ?? 'classico'
    defaults.footer_bg = fd.footer_bg ?? null
    defaults.footer_text_color = fd.footer_text_color ?? null
    defaults.footer_primary = fd.footer_primary ?? null
    defaults.footer_secondary = fd.footer_secondary ?? null
  }
}

// ── Logo Preview URL ───────────────────────────────────────────────────────────
const logoPreviewUrl = computed(() => {
  if (!form.logo) return null
  if (form.logo.startsWith('http') || form.logo.startsWith('/api/')) return form.logo
  return `/api/storage/p?key=${encodeURIComponent(form.logo)}`
})

// ── Logo upload ────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleLogoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Por favor, selecione uma imagem valida.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'A imagem deve ter no maximo 5MB.'
    return
  }

  const tenantId = auth.tenant.value?.id
  if (!tenantId) return

  isUploading.value = true
  errorMessage.value = ''

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `logo_${Date.now()}.${ext}`
    const key = `builder/${tenantId}/logo/${filename}`
    const contentType = file.type || 'image/png'

    const buffer = await file.arrayBuffer()

    const result = await $fetch<{ key: string }>(`/api/builder/storage/upload`, {
      method: 'POST',
      query: { key, contentType },
      body: buffer,
      headers: {
        'Content-Type': contentType,
      },
    })

    if (result.key) {
      form.logo = result.key
    }
  } catch (err: any) {
    console.error('Erro no upload:', err)
    errorMessage.value = 'Erro ao enviar imagem. Tente novamente.'
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// ── Save profile ───────────────────────────────────────────────────────────────
const saveProfile = async () => {
  if (isSaving.value) return

  if (!form.name.trim()) {
    errorMessage.value = 'O nome da empresa e obrigatorio.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  showSuccess.value = false

  try {
    const flyerDefaults: BuilderFlyerDefaults = { ...defaults }

    await $fetch('/api/builder/profile', {
      method: 'PUT',
      body: {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        phone2: form.phone2.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        website: form.website.trim() || null,
        address: form.address.trim() || null,
        payment_notes: form.payment_notes.trim() || null,
        cep: form.cep.trim() || null,
        slogan: form.slogan.trim() || null,
        segment1: form.segment1 || null,
        logo: form.logo || null,
        flyer_defaults: flyerDefaults,
      },
    })

    auth.updateProfile({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      phone2: form.phone2.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      instagram: form.instagram.trim() || null,
      facebook: form.facebook.trim() || null,
      website: form.website.trim() || null,
      address: form.address.trim() || null,
      payment_notes: form.payment_notes.trim() || null,
      cep: form.cep.trim() || null,
      slogan: form.slogan.trim() || null,
      segment1: form.segment1 || null,
      logo: form.logo || null,
      flyer_defaults: flyerDefaults,
    })

    showSuccess.value = true
    setTimeout(() => { showSuccess.value = false }, 3000)
  } catch (err: any) {
    console.error('Erro ao salvar perfil:', err)
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Erro ao salvar perfil. Tente novamente.'
  } finally {
    isSaving.value = false
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────
onMounted(() => {
  if (auth.tenant.value) {
    populateForm()
    isLoading.value = false
  } else {
    const stop = watch(() => auth.tenant.value, (val) => {
      if (val) {
        populateForm()
        isLoading.value = false
        stop()
      }
    }, { immediate: true })
    setTimeout(() => {
      if (isLoading.value) {
        populateForm()
        isLoading.value = false
      }
    }, 3000)
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white tracking-tight">Minha Empresa</h1>
      <p class="text-sm text-zinc-500 mt-1">Dados e configuracoes padrao para seus encartes</p>
    </div>

    <!-- Sync explanation -->
    <div class="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
      <div class="flex items-start gap-3">
        <RefreshCw class="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm text-zinc-300 leading-relaxed">
            Tudo que voce configurar aqui sera o padrao para novos encartes.
            Nome, logo, telefone, redes sociais, formas de pagamento e layout do rodape
            — tudo ja vem preenchido automaticamente.
          </p>
          <p class="text-xs text-zinc-500 mt-1.5">
            Voce ainda pode personalizar cada encarte individualmente na aba "Empresa" do editor.
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-6">
      <div v-for="i in 4" :key="i" class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6 animate-pulse">
        <div class="h-4 bg-white/5 rounded w-24 mb-4"></div>
        <div class="h-12 bg-white/5 rounded-xl"></div>
      </div>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="saveProfile" class="space-y-4">
      <!-- Success Toast -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showSuccess" class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl backdrop-blur-sm">
          <div class="flex items-center gap-3">
            <div class="shrink-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check class="w-3.5 h-3.5 text-white" />
            </div>
            <p class="text-sm font-medium text-emerald-400">Salvo! Novos encartes ja usarao essas configuracoes.</p>
          </div>
        </div>
      </Transition>

      <!-- Error Message -->
      <div v-if="errorMessage" class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
        <p class="text-sm text-red-400">{{ errorMessage }}</p>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- LOGO E IDENTIDADE                                                       -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button
          type="button"
          @click="toggleSection('identity')"
          class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors"
        >
          <div class="flex items-center gap-3">
            <Building2 class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Logo e Identidade</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.identity ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.identity" class="px-5 pb-5 space-y-5 border-t border-white/5">
          <!-- Logo -->
          <div class="flex items-start gap-5 pt-5">
            <div
              @click="triggerFileInput"
              class="relative w-20 h-20 bg-[#09090b]/50 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group overflow-hidden shrink-0"
            >
              <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="Logo" class="w-full h-full object-contain rounded-xl" />
              <div v-else class="text-zinc-600 group-hover:text-emerald-400 transition-colors">
                <Image class="w-7 h-7" />
              </div>
              <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <Camera class="w-4 h-4 text-white" />
              </div>
              <div v-if="isUploading" class="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                <Loader2 class="w-5 h-5 text-emerald-400 animate-spin" />
              </div>
            </div>

            <div class="flex-1">
              <p class="text-sm text-zinc-300 mb-0.5">Logo da empresa</p>
              <p class="text-xs text-zinc-600 mb-2">PNG ou JPG, fundo transparente recomendado</p>
              <button
                type="button"
                @click="triggerFileInput"
                :disabled="isUploading"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <Upload class="w-3 h-3" />
                {{ isUploading ? 'Enviando...' : (logoPreviewUrl ? 'Trocar' : 'Enviar') }}
              </button>
            </div>

            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleLogoUpload" />
          </div>

          <!-- Logo position & size -->
          <div v-if="logoPreviewUrl" class="bg-[#09090b]/30 rounded-lg p-3 space-y-3">
            <p class="text-[10px] text-zinc-500 font-medium">Posicao e tamanho da logo na capa</p>
            <!-- Size -->
            <label class="block">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-zinc-500">Tamanho</span>
                <span class="text-[10px] text-zinc-400 tabular-nums">{{ defaults.logo_size }}px</span>
              </div>
              <input type="range" min="30" max="400" step="5" v-model.number="defaults.logo_size" class="w-full accent-emerald-500 h-1" />
            </label>
            <!-- X position -->
            <label class="block">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-zinc-500">Horizontal</span>
                <span class="text-[10px] text-zinc-400 tabular-nums">{{ defaults.logo_x }}%</span>
              </div>
              <input type="range" min="0" max="100" step="1" v-model.number="defaults.logo_x" class="w-full accent-emerald-500 h-1" />
            </label>
            <!-- Y position -->
            <label class="block">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-zinc-500">Vertical</span>
                <span class="text-[10px] text-zinc-400 tabular-nums">{{ defaults.logo_y }}%</span>
              </div>
              <input type="range" min="0" max="100" step="1" v-model.number="defaults.logo_y" class="w-full accent-emerald-500 h-1" />
            </label>
            <!-- Quick presets -->
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="pos in [
                  { label: '↖', x: 15, y: 25 },
                  { label: '↑', x: 50, y: 20 },
                  { label: '↗', x: 85, y: 25 },
                  { label: '←', x: 15, y: 50 },
                  { label: '•', x: 50, y: 50 },
                  { label: '→', x: 85, y: 50 },
                  { label: '↙', x: 15, y: 80 },
                  { label: '↓', x: 50, y: 80 },
                  { label: '↘', x: 85, y: 80 },
                ]"
                :key="pos.label"
                type="button"
                @click="defaults.logo_x = pos.x; defaults.logo_y = pos.y"
                class="w-full h-7 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] transition-colors flex items-center justify-center"
                :class="defaults.logo_x === pos.x && defaults.logo_y === pos.y ? 'ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400' : ''"
              >
                {{ pos.label }}
              </button>
            </div>
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-name">
              Nome da empresa *
            </label>
            <div class="relative group">
              <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-name" v-model="form.name" type="text" placeholder="Supermercado Exemplo" required
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Slogan -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-slogan">Slogan</label>
            <div class="relative group">
              <Tag class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-slogan" v-model="form.slogan" type="text" placeholder="O melhor preco da regiao"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Segment -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-segment">Segmento</label>
            <div class="relative group">
              <Tag class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400 pointer-events-none" />
              <select
                id="profile-segment" v-model="form.segment1"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="" class="bg-[#09090b] text-zinc-400">Selecione um segmento</option>
                <option v-for="opt in segmentOptions" :key="opt" :value="opt" class="bg-[#09090b] text-white">{{ opt }}</option>
              </select>
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- CONTATO                                                                 -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('contact')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <Phone class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Contato</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.contact ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.contact" class="px-5 pb-5 space-y-4 border-t border-white/5 pt-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-phone">Telefone</label>
              <div class="relative group">
                <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                <input id="profile-phone" v-model="form.phone" type="tel" placeholder="(11) 3333-4444"
                  class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-phone2">Telefone 2</label>
              <div class="relative group">
                <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                <input id="profile-phone2" v-model="form.phone2" type="tel" placeholder="(11) 4444-5555"
                  class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-whatsapp">WhatsApp</label>
            <div class="relative group">
              <MessageCircle class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input id="profile-whatsapp" v-model="form.whatsapp" type="tel" placeholder="(11) 99999-9999"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- ENDERECO                                                                -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('address')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <MapPin class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Endereco</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.address ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.address" class="px-5 pb-5 space-y-4 border-t border-white/5 pt-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-address">Endereco completo</label>
            <div class="relative group">
              <MapPin class="absolute left-4 top-3.5 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <textarea id="profile-address" v-model="form.address" rows="2" placeholder="Rua Exemplo, 123 - Centro, Sao Paulo - SP"
                class="w-full pl-11 pr-4 py-3 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              ></textarea>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 max-w-xs">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-cep">CEP</label>
            <div class="relative group">
              <Hash class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input id="profile-cep" v-model="form.cep" type="text" placeholder="01001-000" maxlength="9"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- REDES SOCIAIS                                                           -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('social')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <Instagram class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Redes Sociais e Site</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.social ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.social" class="px-5 pb-5 space-y-4 border-t border-white/5 pt-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-instagram">Instagram</label>
            <div class="relative group">
              <Instagram class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input id="profile-instagram" v-model="form.instagram" type="text" placeholder="@suaempresa"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-facebook">Facebook</label>
            <div class="relative group">
              <Facebook class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input id="profile-facebook" v-model="form.facebook" type="text" placeholder="facebook.com/suaempresa"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-website">Website</label>
            <div class="relative group">
              <Globe class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input id="profile-website" v-model="form.website" type="url" placeholder="https://www.suaempresa.com.br"
                class="w-full h-11 pl-11 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- PAGAMENTO                                                               -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('payment')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <CreditCard class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Pagamento</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.payment ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.payment" class="px-5 pb-5 space-y-4 border-t border-white/5 pt-5">
          <!-- Payment notes -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-payment">Observacoes de pagamento</label>
            <div class="relative group">
              <CreditCard class="absolute left-4 top-3.5 w-4 h-4 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <textarea id="profile-payment" v-model="form.payment_notes" rows="2" placeholder="Aceitamos: Pix, Cartoes de Credito e Debito, Dinheiro..."
                class="w-full pl-11 pr-4 py-3 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Payment methods / bandeiras -->
          <div>
            <p class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1 mb-3">Bandeiras aceitas</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                v-for="pm in PAYMENT_OPTIONS"
                :key="pm.id"
                type="button"
                @click="togglePayment(pm.id)"
                class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-left"
                :class="isPaymentSelected(pm.id) ? 'bg-white/10 ring-1 ring-emerald-500/30' : 'bg-white/2 opacity-40 hover:opacity-70'"
              >
                <div class="w-3 h-3 rounded-sm flex items-center justify-center shrink-0"
                  :class="isPaymentSelected(pm.id) ? 'bg-emerald-600' : 'bg-white/10'"
                >
                  <Check v-if="isPaymentSelected(pm.id)" class="w-2 h-2 text-white" />
                </div>
                <span class="text-[11px] font-medium" :class="isPaymentSelected(pm.id) ? 'text-white' : 'text-zinc-400'">{{ pm.label }}</span>
              </button>
            </div>
            <div class="flex gap-3 mt-2">
              <button type="button" @click="defaults.payment_methods = PAYMENT_OPTIONS.map(p => p.id)" class="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">Selecionar todas</button>
              <button type="button" @click="defaults.payment_methods = []" class="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">Limpar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- VISIBILIDADE NO ENCARTE                                                 -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('visibility')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <Eye class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Visibilidade no Encarte</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.visibility ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.visibility" class="px-5 pb-5 border-t border-white/5 pt-5">
          <p class="text-[10px] text-zinc-500 mb-4">Escolha quais informacoes aparecem por padrao nos novos encartes</p>

          <!-- Capa -->
          <p class="text-[10px] text-zinc-500 font-medium mb-2">Capa</p>
          <div class="space-y-2 mb-5">
            <div class="flex items-center justify-between">
              <span class="text-[12px] text-zinc-300">Mostrar Logo</span>
              <button type="button" role="switch" :aria-checked="defaults.show_logo" @click="defaults.show_logo = !defaults.show_logo"
                :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', defaults.show_logo ? 'bg-emerald-600' : 'bg-white/10']"
              >
                <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', defaults.show_logo ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>

          <!-- Rodape -->
          <p class="text-[10px] text-zinc-500 font-medium mb-2">Rodape</p>
          <div class="space-y-2">
            <div v-for="opt in [
              { key: 'show_phone', label: 'Telefone' },
              { key: 'show_whatsapp', label: 'WhatsApp' },
              { key: 'show_phone_label', label: 'Legenda telefones' },
              { key: 'show_company_name', label: 'Nome da Empresa' },
              { key: 'show_slogan', label: 'Slogan' },
              { key: 'show_payment_methods', label: 'Formas de pagamento' },
              { key: 'show_payment_notes', label: 'Obs. pagamento' },
              { key: 'show_address', label: 'Endereco' },
              { key: 'show_instagram', label: 'Instagram' },
              { key: 'show_facebook', label: 'Facebook' },
              { key: 'show_website', label: 'Website' },
            ]" :key="opt.key" class="flex items-center justify-between">
              <span class="text-[12px] text-zinc-300">{{ opt.label }}</span>
              <button type="button" role="switch" :aria-checked="(defaults as any)[opt.key]" @click="(defaults as any)[opt.key] = !(defaults as any)[opt.key]"
                :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', (defaults as any)[opt.key] ? 'bg-emerald-600' : 'bg-white/10']"
              >
                <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (defaults as any)[opt.key] ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- LAYOUT DO RODAPE                                                        -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden">
        <button type="button" @click="toggleSection('footer')" class="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
          <div class="flex items-center gap-3">
            <CreditCard class="w-4 h-4 text-emerald-400" />
            <h2 class="text-sm font-semibold text-white">Layout do Rodape</h2>
          </div>
          <ChevronDown class="w-4 h-4 text-zinc-500 transition-transform" :class="openSections.footer ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.footer" class="px-5 pb-5 space-y-4 border-t border-white/5 pt-5">
          <!-- Footer layout presets -->
          <div>
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Estilo</p>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="fl in FOOTER_LAYOUTS"
                :key="fl.id"
                type="button"
                @click="defaults.footer_layout = fl.id"
                class="flex flex-col items-start p-3 rounded-lg border transition-all text-left"
                :class="(defaults.footer_layout || 'classico') === fl.id
                  ? 'border-emerald-500/50 bg-emerald-600/10 ring-1 ring-emerald-500/20'
                  : 'border-white/5 bg-white/2 hover:bg-white/5'"
              >
                <span class="text-[11px] font-semibold" :class="(defaults.footer_layout || 'classico') === fl.id ? 'text-emerald-400' : 'text-zinc-300'">{{ fl.label }}</span>
                <span class="text-[9px] text-zinc-600">{{ fl.desc }}</span>
              </button>
            </div>
          </div>

          <!-- Footer colors -->
          <div>
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Cores do Rodape</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="block">
                <span class="text-[10px] text-zinc-500 block mb-1">Fundo</span>
                <input type="color" :value="defaults.footer_bg || '#1a1a1a'" @input="defaults.footer_bg = ($event.target as HTMLInputElement).value" class="w-full h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[10px] text-zinc-500 block mb-1">Texto</span>
                <input type="color" :value="defaults.footer_text_color || '#ffffff'" @input="defaults.footer_text_color = ($event.target as HTMLInputElement).value" class="w-full h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[10px] text-zinc-500 block mb-1">Primaria</span>
                <input type="color" :value="defaults.footer_primary || '#e85d04'" @input="defaults.footer_primary = ($event.target as HTMLInputElement).value" class="w-full h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[10px] text-zinc-500 block mb-1">Secundaria</span>
                <input type="color" :value="defaults.footer_secondary || '#f48c06'" @input="defaults.footer_secondary = ($event.target as HTMLInputElement).value" class="w-full h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              </label>
            </div>
            <button type="button" @click="defaults.footer_bg = null; defaults.footer_primary = null; defaults.footer_secondary = null; defaults.footer_text_color = null" class="text-[10px] text-zinc-500 hover:text-zinc-300 mt-2 transition-colors">
              Resetar cores do tema
            </button>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex items-center justify-end gap-4 pt-4 pb-8">
        <button
          type="submit"
          :disabled="isSaving"
          class="inline-flex items-center justify-center gap-2 h-12 px-8 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          <span>{{ isSaving ? 'Salvando...' : 'Salvar configuracoes' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { Building2, Phone, MessageCircle, Instagram, Facebook, Globe, MapPin, CreditCard, Hash, Tag, Camera, Loader2, Check, Upload, Image } from 'lucide-vue-next'

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
}

// ── Logo Preview URL ───────────────────────────────────────────────────────────
const logoPreviewUrl = computed(() => {
  if (!form.logo) return null
  // If it's already a full URL or a proxy URL, use as-is
  if (form.logo.startsWith('http') || form.logo.startsWith('/api/')) return form.logo
  // Otherwise build a proxy URL from the storage key
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

  // Validate
  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Por favor, selecione uma imagem válida.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'A imagem deve ter no máximo 5MB.'
    return
  }

  const tenantId = auth.tenant.value?.id
  if (!tenantId) return

  isUploading.value = true
  errorMessage.value = ''

  try {
    // Build upload key
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `logo_${Date.now()}.${ext}`
    const key = `builder/${tenantId}/logo/${filename}`
    const contentType = file.type || 'image/png'

    // Read file as ArrayBuffer for raw body upload
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
    // Reset input so same file can be selected again
    if (input) input.value = ''
  }
}

// ── Save profile ───────────────────────────────────────────────────────────────
const saveProfile = async () => {
  if (isSaving.value) return

  if (!form.name.trim()) {
    errorMessage.value = 'O nome da empresa é obrigatório.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  showSuccess.value = false

  try {
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
      },
    })

    // Update local auth state
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
  // Small delay to ensure tenant data is loaded
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
    // Timeout fallback
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
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-white tracking-tight">Minha Empresa</h1>
      <p class="text-sm text-zinc-500 mt-1">Atualize as informações da sua empresa</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-6">
      <div v-for="i in 4" :key="i" class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6 animate-pulse">
        <div class="h-4 bg-white/5 rounded w-24 mb-4"></div>
        <div class="h-12 bg-white/5 rounded-xl"></div>
      </div>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="saveProfile" class="space-y-8">
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
            <div class="flex-shrink-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check class="w-3.5 h-3.5 text-white" />
            </div>
            <p class="text-sm font-medium text-emerald-400">Perfil atualizado com sucesso!</p>
          </div>
        </div>
      </Transition>

      <!-- Error Message -->
      <div v-if="errorMessage" class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
        <p class="text-sm text-red-400">{{ errorMessage }}</p>
      </div>

      <!-- Logo Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">Logo</h2>
        <div class="flex items-center gap-6">
          <!-- Logo Preview -->
          <div
            @click="triggerFileInput"
            class="relative w-24 h-24 bg-[#09090b]/50 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group overflow-hidden"
          >
            <img
              v-if="logoPreviewUrl"
              :src="logoPreviewUrl"
              alt="Logo"
              class="w-full h-full object-contain rounded-xl"
            />
            <div v-else class="flex flex-col items-center gap-1.5 text-zinc-600 group-hover:text-emerald-400 transition-colors">
              <Image class="w-8 h-8" />
            </div>
            <!-- Upload overlay -->
            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
              <Camera class="w-5 h-5 text-white" />
            </div>
            <!-- Uploading spinner -->
            <div v-if="isUploading" class="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
              <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
            </div>
          </div>

          <div class="flex-1">
            <p class="text-sm text-zinc-300 mb-1">Logo da empresa</p>
            <p class="text-xs text-zinc-500 mb-3">PNG, JPG ou WebP. Máximo 5MB.</p>
            <button
              type="button"
              @click="triggerFileInput"
              :disabled="isUploading"
              class="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload class="w-3.5 h-3.5" />
              {{ isUploading ? 'Enviando...' : 'Enviar imagem' }}
            </button>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            @change="handleLogoUpload"
          />
        </div>
      </div>

      <!-- Company Info Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-5">Informações básicas</h2>
        <div class="space-y-5">
          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-name">
              Nome da empresa *
            </label>
            <div class="relative group">
              <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-name"
                v-model="form.name"
                type="text"
                placeholder="Supermercado Exemplo"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
              />
            </div>
          </div>

          <!-- Slogan -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-slogan">
              Slogan
            </label>
            <div class="relative group">
              <Tag class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-slogan"
                v-model="form.slogan"
                type="text"
                placeholder="O melhor preço da região"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Segment -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-segment">
              Segmento
            </label>
            <div class="relative group">
              <Tag class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400 pointer-events-none" />
              <select
                id="profile-segment"
                v-model="form.segment1"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
              >
                <option value="" class="bg-[#09090b] text-zinc-400">Selecione um segmento</option>
                <option
                  v-for="opt in segmentOptions"
                  :key="opt"
                  :value="opt"
                  class="bg-[#09090b] text-white"
                >
                  {{ opt }}
                </option>
              </select>
              <!-- Custom dropdown arrow -->
              <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-5">Contato</h2>
        <div class="space-y-5">
          <!-- Phone -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-phone">
                Telefone
              </label>
              <div class="relative group">
                <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                <input
                  id="profile-phone"
                  v-model="form.phone"
                  type="tel"
                  placeholder="(11) 3333-4444"
                  class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-phone2">
                Telefone 2
              </label>
              <div class="relative group">
                <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                <input
                  id="profile-phone2"
                  v-model="form.phone2"
                  type="tel"
                  placeholder="(11) 4444-5555"
                  class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          <!-- WhatsApp -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-whatsapp">
              WhatsApp
            </label>
            <div class="relative group">
              <MessageCircle class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-whatsapp"
                v-model="form.whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Social / Web Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-5">Redes sociais e site</h2>
        <div class="space-y-5">
          <!-- Instagram -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-instagram">
              Instagram
            </label>
            <div class="relative group">
              <Instagram class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-instagram"
                v-model="form.instagram"
                type="text"
                placeholder="@suaempresa"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Facebook -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-facebook">
              Facebook
            </label>
            <div class="relative group">
              <Facebook class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-facebook"
                v-model="form.facebook"
                type="text"
                placeholder="facebook.com/suaempresa"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Website -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-website">
              Website
            </label>
            <div class="relative group">
              <Globe class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-website"
                v-model="form.website"
                type="url"
                placeholder="https://www.suaempresa.com.br"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Address Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-5">Endereço</h2>
        <div class="space-y-5">
          <!-- Address -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-address">
              Endereço completo
            </label>
            <div class="relative group">
              <MapPin class="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <textarea
                id="profile-address"
                v-model="form.address"
                rows="2"
                placeholder="Rua Exemplo, 123 - Centro, São Paulo - SP"
                class="w-full pl-12 pr-4 py-3 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <!-- CEP -->
          <div class="flex flex-col gap-1.5 max-w-xs">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-cep">
              CEP
            </label>
            <div class="relative group">
              <Hash class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="profile-cep"
                v-model="form.cep"
                type="text"
                placeholder="01001-000"
                maxlength="9"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Notes Section -->
      <div class="bg-[#18181b]/80 border border-white/5 rounded-xl p-6">
        <h2 class="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-5">Pagamento</h2>
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="profile-payment">
            Formas de pagamento / Observações
          </label>
          <div class="relative group">
            <CreditCard class="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
            <textarea
              id="profile-payment"
              v-model="form.payment_notes"
              rows="3"
              placeholder="Aceitamos: Pix, Cartões de Crédito e Débito, Dinheiro..."
              class="w-full pl-12 pr-4 py-3 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex items-center justify-end gap-4 pt-2 pb-8">
        <button
          type="submit"
          :disabled="isSaving"
          class="inline-flex items-center justify-center gap-2 h-12 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          <Check v-else class="w-4 h-4" />
          <span>{{ isSaving ? 'Salvando...' : 'Salvar alterações' }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

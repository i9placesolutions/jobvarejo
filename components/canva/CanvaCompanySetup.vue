<script setup lang="ts">
import {
  Building2, Upload, Check, AlertTriangle, X,
  Loader2, Image, Phone, MapPin, Instagram, Save
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  tenant: {
    id: string
    name: string
    logo: string | null
    address: string | null
    whatsapp: string | null
    phone: string | null
    instagram: string | null
  }
  missingFields: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const auth = useBuilderAuth()

// Estado do formulário
const form = reactive({
  logo: '' as string | null,
  address: '',
  whatsapp: '',
  phone: '',
  instagram: ''
})

const isSaving = ref(false)
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Resolve URL de imagem (padrão do projeto)
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// URL de preview da logo
const logoPreview = computed(() => resolveImageUrl(form.logo))

// Verifica se um campo está faltando
const isMissing = (field: string): boolean => props.missingFields.includes(field)

// Verifica se um campo já está preenchido
const isFilled = (field: string): boolean => {
  switch (field) {
    case 'logo': return !!form.logo
    case 'address': return !!form.address?.trim()
    case 'whatsapp': return !!form.whatsapp?.trim()
    case 'phone': return !!form.phone?.trim()
    case 'instagram': return !!form.instagram?.trim()
    default: return false
  }
}

// Classe de borda condicional: amber se faltando e vazio, normal caso contrário
const fieldBorderClass = (field: string): string => {
  if (isMissing(field) && !isFilled(field)) {
    return 'border-amber-500/50 focus:border-amber-400'
  }
  if (isFilled(field)) {
    return 'border-emerald-500/30 focus:border-emerald-400'
  }
  return 'border-white/5 focus:border-violet-500/50'
}

// Máscara de WhatsApp: (XX) X.XXXX-XXXX
const formatWhatsapp = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}.${digits.slice(3)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}.${digits.slice(3, 7)}-${digits.slice(7)}`
}

const onWhatsappInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  form.whatsapp = formatWhatsapp(target.value)
}

// Máscara de telefone: (XX) XXXX-XXXX ou (XX) X.XXXX-XXXX
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}.${digits.slice(3, 7)}-${digits.slice(7)}`
}

const onPhoneInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  form.phone = formatPhone(target.value)
}

// Upload de logo
const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  try {
    const timestamp = Date.now()
    const key = `builder/${props.tenant.id}/logo-${timestamp}.webp`
    const formData = new FormData()
    formData.append('file', file)

    const res = await $fetch<{ key: string }>(`/api/builder/storage/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: formData
    })

    form.logo = res.key || key
  } catch (err) {
    console.error('Erro ao enviar logo:', err)
  } finally {
    isUploading.value = false
    // Limpa o input para permitir reenvio do mesmo arquivo
    if (target) target.value = ''
  }
}

// Salvar dados
const handleSave = async () => {
  isSaving.value = true
  try {
    const payload: Record<string, string | null> = {}

    if (form.logo) payload.logo = form.logo
    if (form.address?.trim()) payload.address = form.address.trim()
    if (form.whatsapp?.trim()) payload.whatsapp = form.whatsapp.trim()
    if (form.phone?.trim()) payload.phone = form.phone.trim()
    if (form.instagram?.trim()) payload.instagram = form.instagram.trim()

    await $fetch('/api/builder/profile', {
      method: 'PUT',
      body: payload
    })

    // Atualiza estado local do auth
    auth.updateProfile(payload)

    emit('saved')
  } catch (err) {
    console.error('Erro ao salvar perfil:', err)
  } finally {
    isSaving.value = false
  }
}

const handleClose = () => {
  emit('close')
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') handleClose()
}

// Sincroniza o formulário quando o modal abre
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.logo = props.tenant.logo
    form.address = props.tenant.address || ''
    form.whatsapp = props.tenant.whatsapp ? formatWhatsapp(props.tenant.whatsapp) : ''
    form.phone = props.tenant.phone ? formatPhone(props.tenant.phone) : ''
    form.instagram = props.tenant.instagram || ''
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// Campos obrigatórios para exibir alerta
const requiredFieldLabels: Record<string, string> = {
  logo: 'Logo da empresa',
  address: 'Endereço',
  whatsapp: 'WhatsApp'
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleClose" />

        <div class="relative bg-[#18181b] rounded-2xl border border-white/5 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Building2 class="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 class="text-sm font-semibold text-white">Complete os dados da sua empresa</h2>
                <p class="text-[11px] text-zinc-500 mt-0.5">Esses dados serão usados automaticamente nos seus designs</p>
              </div>
            </div>
            <button @click="handleClose" class="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Alerta de campos faltantes -->
          <div v-if="missingFields.length > 0" class="px-5 pt-4 shrink-0">
            <div class="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p class="text-[11px] text-amber-300 font-medium">Campos obrigatórios faltando:</p>
                <div class="flex flex-wrap gap-1.5 mt-1">
                  <span
                    v-for="field in missingFields"
                    :key="field"
                    class="text-[10px] text-amber-400/80 bg-amber-500/10 rounded px-1.5 py-0.5"
                  >
                    {{ requiredFieldLabels[field] || field }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <!-- Logo -->
            <div>
              <div class="flex items-center gap-2 mb-2">
                <label class="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Image class="w-3.5 h-3.5 text-zinc-500" />
                  Logo da empresa
                </label>
                <Check v-if="isFilled('logo')" class="w-3.5 h-3.5 text-emerald-400" />
                <AlertTriangle v-else-if="isMissing('logo')" class="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div class="flex items-center gap-4">
                <!-- Preview -->
                <div
                  class="w-20 h-20 rounded-xl border-2 flex items-center justify-center overflow-hidden shrink-0 transition-colors"
                  :class="isFilled('logo') ? 'border-emerald-500/30 bg-emerald-500/5' : isMissing('logo') ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5'"
                >
                  <img
                    v-if="logoPreview"
                    :src="logoPreview"
                    alt="Logo"
                    class="w-full h-full object-contain"
                  />
                  <Image v-else class="w-8 h-8 text-zinc-600" />
                </div>
                <!-- Upload -->
                <div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="handleFileChange"
                  />
                  <button
                    @click="triggerUpload"
                    :disabled="isUploading"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all
                      bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 hover:text-violet-200
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Loader2 v-if="isUploading" class="w-3.5 h-3.5 animate-spin" />
                    <Upload v-else class="w-3.5 h-3.5" />
                    {{ isUploading ? 'Enviando...' : 'Enviar Logo' }}
                  </button>
                  <p class="text-[10px] text-zinc-600 mt-1">PNG, JPG ou WebP</p>
                </div>
              </div>
            </div>

            <!-- Endereço -->
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <label class="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <MapPin class="w-3.5 h-3.5 text-zinc-500" />
                  Endereço
                </label>
                <Check v-if="isFilled('address')" class="w-3.5 h-3.5 text-emerald-400" />
                <AlertTriangle v-else-if="isMissing('address')" class="w-3.5 h-3.5 text-amber-400" />
              </div>
              <input
                v-model="form.address"
                type="text"
                placeholder="Rua, número, bairro - Cidade/UF"
                class="w-full bg-[#09090b]/50 text-[12px] text-white placeholder-zinc-600 outline-none
                  border rounded-lg px-3 py-2.5 transition-colors"
                :class="fieldBorderClass('address')"
              />
            </div>

            <!-- WhatsApp -->
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <label class="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Phone class="w-3.5 h-3.5 text-zinc-500" />
                  WhatsApp
                </label>
                <Check v-if="isFilled('whatsapp')" class="w-3.5 h-3.5 text-emerald-400" />
                <AlertTriangle v-else-if="isMissing('whatsapp')" class="w-3.5 h-3.5 text-amber-400" />
              </div>
              <input
                :value="form.whatsapp"
                @input="onWhatsappInput"
                type="text"
                placeholder="(XX) X.XXXX-XXXX"
                class="w-full bg-[#09090b]/50 text-[12px] text-white placeholder-zinc-600 outline-none
                  border rounded-lg px-3 py-2.5 transition-colors"
                :class="fieldBorderClass('whatsapp')"
              />
            </div>

            <!-- Telefone (opcional) -->
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <label class="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Phone class="w-3.5 h-3.5 text-zinc-500" />
                  Telefone
                  <span class="text-[10px] text-zinc-600 font-normal">(opcional)</span>
                </label>
                <Check v-if="isFilled('phone')" class="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <input
                :value="form.phone"
                @input="onPhoneInput"
                type="text"
                placeholder="(XX) XXXX-XXXX"
                class="w-full bg-[#09090b]/50 text-[12px] text-white placeholder-zinc-600 outline-none
                  border-white/5 focus:border-violet-500/50 border rounded-lg px-3 py-2.5 transition-colors"
                :class="isFilled('phone') ? 'border-emerald-500/30 focus:border-emerald-400' : ''"
              />
            </div>

            <!-- Instagram (opcional) -->
            <div>
              <div class="flex items-center gap-2 mb-1.5">
                <label class="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Instagram class="w-3.5 h-3.5 text-zinc-500" />
                  Instagram
                  <span class="text-[10px] text-zinc-600 font-normal">(opcional)</span>
                </label>
                <Check v-if="isFilled('instagram')" class="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-zinc-500">@</span>
                <input
                  v-model="form.instagram"
                  type="text"
                  placeholder="seuinstagram"
                  class="w-full bg-[#09090b]/50 text-[12px] text-white placeholder-zinc-600 outline-none
                    border-white/5 focus:border-violet-500/50 border rounded-lg pl-7 pr-3 py-2.5 transition-colors"
                  :class="isFilled('instagram') ? 'border-emerald-500/30 focus:border-emerald-400' : ''"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5 shrink-0">
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="handleSave"
              :disabled="isSaving"
              class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all
                bg-violet-600 hover:bg-violet-500 text-white
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
              <Save v-else class="w-3.5 h-3.5" />
              {{ isSaving ? 'Salvando...' : 'Salvar e continuar' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

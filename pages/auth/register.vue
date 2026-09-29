<script setup lang="ts">
import {
  Eye, EyeOff, Mail, MessageCircle, Lock, User, ArrowRight, ArrowLeft,
  Sparkles, Check, Crown, Building2, MapPin, Instagram, UploadCloud,
  LayoutTemplate, WandSparkles, Radio, Loader2, Store
} from 'lucide-vue-next'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

definePageMeta({
  layout: 'auth',
})

const auth = useAuth()
const route = useRoute()

// Multi-step Wizard State: 1 = Conta, 2 = Dados da Empresa, 3 = Escolha de Serviços
const currentStep = ref(1)

// Step 1: Conta
const name = ref('')
const email = ref('')
const whatsapp = ref('')
const { onInput: maskWhatsAppInput } = useBrazilWhatsAppMask(whatsapp)
const whatsappCode = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

// Step 2: Dados da Empresa
const companyName = ref('')
const logoUrl = ref('')
const companyInstagram = ref('')
const companyWhatsApp = ref('')
const { onInput: maskCompanyWhatsAppInput } = useBrazilWhatsAppMask(companyWhatsApp)
const companyAddress = ref('')
const isUploadingLogo = ref(false)
const logoInputRef = ref<HTMLInputElement | null>(null)

// Step 3: Escolha dos Serviços
const selectedModules = ref<string[]>(['encartes', 'cartazes', 'radio'])

const toggleModule = (id: string) => {
  if (selectedModules.value.includes(id)) {
    if (selectedModules.value.length > 1) {
      selectedModules.value = selectedModules.value.filter(m => m !== id)
    }
  } else {
    selectedModules.value.push(id)
  }
}

const selectAllModules = () => {
  selectedModules.value = ['encartes', 'cartazes', 'radio']
}

// Global UI State
const isLoading = ref(false)
const isRequestingWhatsAppCode = ref(false)
const isWhatsAppCodeSent = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isFirstUser = ref(false)
const isTrialSignup = computed(() => true) // 15 dias de teste grátis ativo para todos os cadastros comuns

watch(whatsapp, () => {
  isWhatsAppCodeSent.value = false
  whatsappCode.value = ''
})

// Auto sync company name and whatsapp if empty
watch(name, (val) => {
  if (!companyName.value.trim()) {
    companyName.value = val
  }
})
watch(whatsapp, (val) => {
  if (!companyWhatsApp.value.trim()) {
    companyWhatsApp.value = val
  }
})

// Check if this will be the first user (super admin)
const checkFirstUser = async () => {
  try {
    const response = await $fetch<{ isFirstUser?: boolean }>('/api/auth/first-user')
    isFirstUser.value = Boolean(response?.isFirstUser)
  } catch (e) {
    console.error('Error checking first user:', e)
  }
}

onMounted(() => {
  checkFirstUser()
})

// Password strength indicator
const passwordStrength = computed(() => {
  if (!password.value) return 0
  let strength = 0
  if (password.value.length >= 8) strength++
  if (password.value.length >= 12) strength++
  if (/[a-z]/.test(password.value) && /[A-Z]/.test(password.value)) strength++
  if (/\d/.test(password.value)) strength++
  if (/[^a-zA-Z0-9]/.test(password.value)) strength++
  return strength
})

const passwordStrengthLabel = computed(() => {
  if (passwordStrength.value === 0) return ''
  if (passwordStrength.value <= 2) return 'Fraca'
  if (passwordStrength.value <= 3) return 'Média'
  return 'Forte'
})

const passwordStrengthColor = computed(() => {
  if (passwordStrength.value <= 2) return 'bg-red-500'
  if (passwordStrength.value <= 3) return 'bg-yellow-500'
  return 'bg-green-500'
})

const requestWhatsAppCode = async () => {
  if (isLoading.value || isRequestingWhatsAppCode.value) return
  errorMessage.value = ''
  successMessage.value = ''

  if (!name.value.trim() || !email.value.trim()) {
    errorMessage.value = 'Informe seu nome e o e-mail de recuperação antes de confirmar o WhatsApp.'
    return
  }

  const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp.value)
  if (!normalizedWhatsApp) {
    errorMessage.value = 'Informe um WhatsApp válido com DDD, por exemplo (11) 99999-9999.'
    return
  }

  isRequestingWhatsAppCode.value = true
  try {
    await $fetch('/api/auth/whatsapp-code', {
      method: 'POST',
      body: {
        purpose: 'register',
        email: email.value,
        whatsapp: normalizedWhatsApp
      }
    })
    whatsappCode.value = ''
    isWhatsAppCodeSent.value = true
    successMessage.value = 'Código enviado para seu WhatsApp. Ele vale por 10 minutos.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Não foi possível enviar o código pelo WhatsApp.'
  } finally {
    isRequestingWhatsAppCode.value = false
  }
}

// Logo upload handler
const triggerLogoSelect = () => {
  logoInputRef.value?.click()
}

const handleLogoUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Selecione uma imagem válida para a logo (PNG, JPG, SVG).'
    return
  }

  isUploadingLogo.value = true
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await $fetch<any>('/api/brands/upload', {
      method: 'POST',
      body: formData
    })
    logoUrl.value = String(response?.key || response?.url || response?.canonicalUrl || '').trim()
    successMessage.value = 'Logo enviada com sucesso!'
  } catch (err: any) {
    errorMessage.value = String(err?.data?.statusMessage || err?.message || 'Não foi possível carregar o arquivo da logo.')
  } finally {
    isUploadingLogo.value = false
    input.value = ''
  }
}

// Navigation between steps
const goToStep2 = () => {
  errorMessage.value = ''
  if (!name.value.trim()) {
    errorMessage.value = 'Informe seu nome completo.'
    return
  }
  if (!email.value.trim()) {
    errorMessage.value = 'Informe seu e-mail.'
    return
  }
  if (!whatsapp.value.trim() || !normalizeBrazilWhatsApp(whatsapp.value)) {
    errorMessage.value = 'Informe seu WhatsApp com DDD.'
    return
  }
  if (!isWhatsAppCodeSent.value || !/^\d{6}$/.test(whatsappCode.value.trim())) {
    errorMessage.value = 'Confirme o código de 6 dígitos enviado para seu WhatsApp.'
    return
  }
  if (password.value.length < 8) {
    errorMessage.value = 'A senha deve ter no mínimo 8 caracteres.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'As senhas não coincidem.'
    return
  }

  if (!companyName.value.trim()) companyName.value = name.value
  if (!companyWhatsApp.value.trim()) companyWhatsApp.value = whatsapp.value

  currentStep.value = 2
}

const goToStep3 = () => {
  errorMessage.value = ''
  if (!companyName.value.trim()) {
    errorMessage.value = 'Informe o nome da sua empresa / loja.'
    return
  }
  if (!companyAddress.value.trim()) {
    errorMessage.value = 'Informe o endereço da empresa.'
    return
  }
  currentStep.value = 3
}

const handleFinalSubmit = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (selectedModules.value.length === 0) {
    errorMessage.value = 'Selecione ao menos um serviço para começar seu teste.'
    return
  }

  isLoading.value = true
  try {
    await auth.signUp(
      email.value,
      password.value,
      name.value,
      whatsapp.value,
      whatsappCode.value,
      {
        companyName: companyName.value.trim() || name.value.trim(),
        logoUrl: logoUrl.value.trim(),
        instagram: companyInstagram.value.trim().replace(/^@+/, ''),
        address: companyAddress.value.trim(),
        selectedModules: selectedModules.value,
        autoLogin: true
      }
    )

    successMessage.value = '🎉 Cadastro concluído! Seus 15 dias de teste grátis já estão liberados.'

    setTimeout(() => {
      navigateTo('/', { replace: true })
    }, 1500)
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao criar conta. Tente novamente.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-xl mx-auto py-6">
    <!-- Main Card -->
    <div class="bg-white/95 border border-[#d7e4f1] rounded-[24px] p-6 sm:p-10 shadow-[0_22px_56px_rgba(26,68,113,.11)] relative overflow-hidden">
      <div class="absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r from-[#173d70] via-[#2160b4] to-[#4b8fc8]" aria-hidden="true"></div>

      <!-- Header with steps indicator -->
      <div class="text-center mb-8 relative z-10">
        <div class="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mb-4 border border-blue-200">
          <Sparkles class="w-7 h-7 text-blue-600" />
        </div>
        <h1 class="text-2xl font-bold text-[#173d70] tracking-tight">Comece seus 15 dias grátis</h1>
        <p class="text-xs text-slate-500 mt-1">Acesso imediato sem cartão de crédito</p>

        <!-- Progress Steps -->
        <div class="flex items-center justify-center gap-2 mt-6">
          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                currentStep === 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : currentStep > 1 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              ]"
            >
              <Check v-if="currentStep > 1" class="w-4 h-4" />
              <span v-else>1</span>
            </span>
            <span :class="['text-xs font-semibold', currentStep === 1 ? 'text-blue-700' : 'text-slate-400']">Conta</span>
          </div>

          <div class="w-8 h-0.5" :class="currentStep > 1 ? 'bg-emerald-500' : 'bg-slate-200'"></div>

          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                currentStep === 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : currentStep > 2 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              ]"
            >
              <Check v-if="currentStep > 2" class="w-4 h-4" />
              <span v-else>2</span>
            </span>
            <span :class="['text-xs font-semibold', currentStep === 2 ? 'text-blue-700' : 'text-slate-400']">Empresa</span>
          </div>

          <div class="w-8 h-0.5" :class="currentStep > 2 ? 'bg-emerald-500' : 'bg-slate-200'"></div>

          <div class="flex items-center gap-2">
            <span
              :class="[
                'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
                currentStep === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-100 text-slate-400'
              ]"
            >
              3
            </span>
            <span :class="['text-xs font-semibold', currentStep === 3 ? 'text-blue-700' : 'text-slate-400']">Serviços</span>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div v-if="errorMessage" class="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium text-center">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium text-center flex items-center justify-center gap-2">
        <Check class="w-4 h-4 text-emerald-600 shrink-0" />
        {{ successMessage }}
      </div>

      <!-- STEP 1: CONTA -->
      <div v-if="currentStep === 1" class="space-y-4">
        <!-- First User - Super Admin Banner -->
        <div v-if="isFirstUser" class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <div class="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white shrink-0">
            <Crown class="w-4 h-4" />
          </div>
          <div>
            <p class="text-xs font-bold text-amber-800">Primeiro Usuário (Administrador)</p>
            <p class="text-[11px] text-amber-700">Esta conta será o super administrador do sistema.</p>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="name">Seu Nome Completo</label>
          <div class="relative">
            <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="name"
              v-model="name"
              type="text"
              placeholder="Ex: Rafael Mendes"
              class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="email">E-mail</label>
          <div class="relative">
            <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="seu@email.com"
              class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="whatsapp">WhatsApp para Acesso</label>
          <div class="relative">
            <MessageCircle class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="whatsapp"
              :value="whatsapp"
              @input="maskWhatsAppInput"
              type="tel"
              placeholder="(11) 99999-9999"
              class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <button
          type="button"
          :disabled="isRequestingWhatsAppCode"
          class="w-full h-9 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
          @click="requestWhatsAppCode"
        >
          {{ isRequestingWhatsAppCode ? 'Enviando código...' : isWhatsAppCodeSent ? 'Reenviar código WhatsApp' : 'Confirmar número por WhatsApp' }}
        </button>

        <div v-if="isWhatsAppCodeSent" class="flex flex-col gap-1.5 pt-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="whatsapp-code">Código de 6 dígitos</label>
          <input
            id="whatsapp-code"
            v-model="whatsappCode"
            type="text"
            maxlength="6"
            placeholder="000000"
            class="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg tracking-[0.3em] font-mono text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            required
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="password">Senha</label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Mínimo 8 dígitos"
                class="w-full h-11 pl-10 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="confirmPassword">Confirmar Senha</label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Repita a senha"
                class="w-full h-11 pl-10 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                required
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="w-full h-12 mt-6 bg-[#173d70] hover:bg-[#14325c] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 transition-all cursor-pointer"
          @click="goToStep2"
        >
          Próximo: Dados da Empresa
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

      <!-- STEP 2: DADOS DA EMPRESA -->
      <div v-else-if="currentStep === 2" class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="companyName">Nome da Empresa / Loja</label>
          <div class="relative">
            <Building2 class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="companyName"
              v-model="companyName"
              type="text"
              placeholder="Ex: Supermercado Aliança"
              class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <!-- Logo Upload -->
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Logo da Empresa</label>
          <div class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="logoUrl" :src="logoUrl.startsWith('http') || logoUrl.startsWith('/api/') ? logoUrl : `/api/storage/p?key=${encodeURIComponent(logoUrl)}`" alt="Logo" class="w-full h-full object-contain p-1" />
              <Store v-else class="w-6 h-6 text-slate-300" />
            </div>
            <div class="flex-1">
              <p class="text-xs text-slate-600 font-medium">Logotipo para encartes e cartazes</p>
              <p class="text-[10px] text-slate-400 mt-0.5">PNG, JPG ou SVG com fundo transparente recomendado</p>
              <button
                type="button"
                :disabled="isUploadingLogo"
                class="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                @click="triggerLogoSelect"
              >
                <Loader2 v-if="isUploadingLogo" class="w-3.5 h-3.5 animate-spin" />
                <UploadCloud v-else class="w-3.5 h-3.5 text-blue-600" />
                {{ logoUrl ? 'Trocar Logo' : 'Fazer Upload da Logo' }}
              </button>
              <input ref="logoInputRef" type="file" accept="image/*" class="hidden" @change="handleLogoUpload" />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="companyWhatsApp">WhatsApp Comercial</label>
            <div class="relative">
              <MessageCircle class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="companyWhatsApp"
                :value="companyWhatsApp"
                @input="maskCompanyWhatsAppInput"
                type="tel"
                placeholder="(11) 99999-9999"
                class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="companyInstagram">Instagram da Loja</label>
            <div class="relative">
              <Instagram class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="companyInstagram"
                v-model="companyInstagram"
                type="text"
                placeholder="@suaempresa"
                class="w-full h-11 pl-10 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500" for="companyAddress">Endereço Completo</label>
          <div class="relative">
            <MapPin class="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <textarea
              id="companyAddress"
              v-model="companyAddress"
              rows="2"
              placeholder="Rua, Número, Bairro, Cidade - UF"
              class="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
              required
            ></textarea>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-4">
          <button
            type="button"
            class="h-12 px-4 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            @click="currentStep = 1"
          >
            <ArrowLeft class="w-4 h-4" />
            Voltar
          </button>
          <button
            type="button"
            class="flex-1 h-12 bg-[#173d70] hover:bg-[#14325c] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 transition-all cursor-pointer"
            @click="goToStep3"
          >
            Próximo: Escolha de Serviços
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- STEP 3: ESCOLHA DE SERVIÇOS (15 DIAS GRÁTIS) -->
      <div v-else-if="currentStep === 3" class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs font-bold text-slate-700">Selecione os módulos que deseja testar:</p>
          <button
            type="button"
            class="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
            @click="selectAllModules"
          >
            Selecionar todos (Recomendado)
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <!-- Módulo: Encartes -->
          <div
            :class="[
              'p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4',
              selectedModules.includes('encartes')
                ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            ]"
            @click="toggleModule('encartes')"
          >
            <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <LayoutTemplate class="w-5 h-5" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-800">Encartes Digitais & Edição Rápida</h3>
                <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">15 dias grátis</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Criação ágil de encartes de ofertas para WhatsApp e redes com modelos prontos e preços automáticos.</p>
            </div>
            <div :class="['w-5 h-5 rounded-md border flex items-center justify-center mt-1 shrink-0', selectedModules.includes('encartes') ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white']">
              <Check v-if="selectedModules.includes('encartes')" class="w-3.5 h-3.5" />
            </div>
          </div>

          <!-- Módulo: Cartazes -->
          <div
            :class="[
              'p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4',
              selectedModules.includes('cartazes')
                ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            ]"
            @click="toggleModule('cartazes')"
          >
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <WandSparkles class="w-5 h-5" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-800">Cartazes de Oferta (Ponto de Venda)</h3>
                <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">15 dias grátis</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Cartazista digital para impressão direta em A3, A4 e A5 com designs profissionais de supermercado.</p>
            </div>
            <div :class="['w-5 h-5 rounded-md border flex items-center justify-center mt-1 shrink-0', selectedModules.includes('cartazes') ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white']">
              <Check v-if="selectedModules.includes('cartazes')" class="w-3.5 h-3.5" />
            </div>
          </div>

          <!-- Módulo: Rádio Indoor -->
          <div
            :class="[
              'p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4',
              selectedModules.includes('radio')
                ? 'border-purple-500 bg-purple-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300'
            ]"
            @click="toggleModule('radio')"
          >
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
              <Radio class="w-5 h-5" />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-800">Rádio Indoor do Estabelecimento</h3>
                <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">15 dias grátis</span>
              </div>
              <p class="text-xs text-slate-500 mt-1">Transmissão contínua com playlists comerciais, vinhetas automáticas e gerador de áudio e locução.</p>
            </div>
            <div :class="['w-5 h-5 rounded-md border flex items-center justify-center mt-1 shrink-0', selectedModules.includes('radio') ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white']">
              <Check v-if="selectedModules.includes('radio')" class="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center gap-3">
          <Sparkles class="w-5 h-5 text-blue-600 shrink-0" />
          <p class="text-xs text-blue-900 leading-tight">
            <strong>15 dias de teste grátis garantidos</strong> nos módulos marcados. Você poderá atualizar seus dados e gerenciar planos direto no painel do cliente.
          </p>
        </div>

        <div class="flex items-center gap-3 pt-4">
          <button
            type="button"
            class="h-12 px-4 border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            @click="currentStep = 2"
          >
            <ArrowLeft class="w-4 h-4" />
            Voltar
          </button>
          <button
            type="button"
            :disabled="isLoading"
            class="flex-1 h-12 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
            @click="handleFinalSubmit"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <span v-else class="flex items-center gap-2">
              Concluir Cadastro e Liberar 15 Dias Grátis
              <ArrowRight class="w-4 h-4" />
            </span>
          </button>
        </div>
      </div>

      <!-- Sign In Link -->
      <p class="text-center text-xs text-slate-400 mt-6">
        Já tem uma conta?
        <NuxtLink to="/auth/login" class="text-blue-600 hover:text-blue-700 font-bold transition-colors">
          Fazer login
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

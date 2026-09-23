<script setup lang="ts">
import { Eye, EyeOff, Mail, MessageCircle, Lock, User, ArrowRight, Sparkles, Check, Crown } from 'lucide-vue-next'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

definePageMeta({
  layout: 'auth',
})

const auth = useAuth()
const route = useRoute()

// Form state
const name = ref('')
const email = ref('')
const whatsapp = ref('')
const { onInput: maskWhatsAppInput } = useBrazilWhatsAppMask(whatsapp)
const whatsappCode = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const isRequestingWhatsAppCode = ref(false)
const isWhatsAppCodeSent = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isFirstUser = ref(false)
const BUSINESS_PROFILE_ONBOARDING_KEY = 'jobvarejo:business-profile-onboarding-pending'
const isTrialSignup = computed(() => String(route.query.trial || '') === '15')

watch(whatsapp, () => {
  isWhatsAppCodeSent.value = false
  whatsappCode.value = ''
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

// Check on mount
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

  return strength // 0-5
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
    successMessage.value = 'Código solicitado. Confira seu WhatsApp; ele vale por 10 minutos.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Não foi possível enviar o código pelo WhatsApp.'
  } finally {
    isRequestingWhatsAppCode.value = false
  }
}

const handleRegister = async () => {
  // Validation
  if (!name.value || !email.value || !whatsapp.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
    return
  }

  if (!isWhatsAppCodeSent.value || !/^\d{6}$/.test(whatsappCode.value.trim())) {
    errorMessage.value = 'Confirme seu WhatsApp com o código enviado antes de criar a conta.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'As senhas não coincidem'
    return
  }

  if (password.value.length < 8) {
    errorMessage.value = 'A senha deve ter no mínimo 8 caracteres'
    return
  }

  if (!normalizeBrazilWhatsApp(whatsapp.value)) {
    errorMessage.value = 'Informe um WhatsApp válido com DDD.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await auth.signUp(email.value, password.value, name.value, whatsapp.value, whatsappCode.value)

    // Success message based on first user
    if (isFirstUser.value) {
      successMessage.value = 'Conta de Super Admin criada com sucesso! Você será o administrador principal.'
    } else {
      successMessage.value = 'Conta criada com sucesso! Faça login para continuar.'
    }

    // Clear form
    name.value = ''
    email.value = ''
    whatsapp.value = ''
    whatsappCode.value = ''
    password.value = ''
    confirmPassword.value = ''
    isWhatsAppCodeSent.value = false

    // O primeiro login leva o usuário diretamente ao cadastro comercial, que
    // será reutilizado nos próximos encartes da edição rápida.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BUSINESS_PROFILE_ONBOARDING_KEY, '1')
    }

    // Redirect to login after 2 seconds
    setTimeout(() => {
      navigateTo('/auth/login')
    }, 2500)
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao criar conta. Tente novamente.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <!-- Card -->
    <div class="w-full">
      <!-- Main Card -->
      <div class="bg-white border border-slate-200 rounded-[2rem] p-8 sm:p-10 shadow-xl shadow-black/5 relative overflow-hidden">

        <!-- Decoration light -->
        <div class="absolute -top-32 -left-32 w-64 h-64 bg-indigo-100/60 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-64 h-64 bg-violet-100/40 rounded-full blur-[80px] pointer-events-none"></div>

        <!-- Logo & Header -->
        <div class="text-center mb-10 relative z-10">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-5 border border-indigo-200 relative group">
            <div class="absolute inset-0 bg-indigo-100 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Sparkles class="w-8 h-8 text-indigo-500 relative z-10" />
          </div>
          <h1 class="text-2xl font-bold mb-2 text-slate-800 tracking-tight">Crie sua conta</h1>
          <p class="text-sm font-medium text-slate-400">
            {{ isTrialSignup ? 'Seu teste de 15 dias começa agora' : 'Comece sua jornada criativa' }}
          </p>
        </div>

        <div v-if="isTrialSignup" class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p class="text-sm font-semibold text-orange-700 text-center">15 dias grátis — sem cartão de crédito</p>
        </div>

        <!-- First User - Super Admin Banner -->
        <div v-if="isFirstUser" class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown class="w-4 h-4 text-white" />
            </div>
            <div class="text-left">
              <p class="text-sm font-semibold text-amber-700">Primeiro Usuário - Super Admin</p>
              <p class="text-xs text-amber-600/70">Você será o administrador principal do sistema</p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <p class="text-sm text-green-700">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-5 relative z-10">
          <!-- Name Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="name">
              Nome completo
            </label>
            <div class="relative group">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                id="name"
                v-model="name"
                type="text"
                autocomplete="name"
                placeholder="Seu nome"
                class="w-full h-12 pl-12 pr-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                :class="{ 'border-red-400 focus:border-red-400 focus:ring-red-100': errorMessage }"
                required
              />
            </div>
          </div>

          <!-- Email Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="email">
              E-mail para recuperação
            </label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="w-full h-12 pl-12 pr-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                :class="{ 'border-red-400 focus:border-red-400 focus:ring-red-100': errorMessage }"
                required
              />
            </div>
          </div>

          <!-- WhatsApp identity and one-time number confirmation -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="whatsapp">
              WhatsApp para entrar
            </label>
            <div class="relative group">
              <MessageCircle class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                id="whatsapp"
                :value="whatsapp"
                @input="maskWhatsAppInput"
                type="tel"
                inputmode="tel"
                autocomplete="tel"
                placeholder="(11) 99999-9999"
                class="w-full h-12 pl-12 pr-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                :class="{ 'border-red-400 focus:border-red-400 focus:ring-red-100': errorMessage }"
                required
              />
            </div>
            <p class="ml-1 text-[10px] text-slate-400">Confirmaremos o número uma vez; sua senha atual continuará sendo usada no login.</p>
          </div>

          <button
            type="button"
            :disabled="isLoading || isRequestingWhatsAppCode"
            class="w-full h-10 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-wait transition-colors"
            @click="requestWhatsAppCode"
          >
            {{ isRequestingWhatsAppCode ? 'Enviando código...' : isWhatsAppCodeSent ? 'Reenviar código pelo WhatsApp' : 'Confirmar WhatsApp' }}
          </button>

          <div v-if="isWhatsAppCodeSent" class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="whatsapp-code">
              Código de confirmação
            </label>
            <input
              id="whatsapp-code"
              v-model="whatsappCode"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              placeholder="6 dígitos"
              class="w-full h-12 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-center text-lg tracking-[0.35em] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              required
            />
          </div>

          <!-- Password Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="password">
              Senha
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                :class="{ 'border-red-400 focus:border-red-400 focus:ring-red-100': errorMessage }"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Password Strength Indicator -->
            <div v-if="password" class="mt-1">
              <div class="flex gap-1 mb-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors duration-300"
                  :class="i <= passwordStrength ? passwordStrengthColor : 'bg-slate-200'"
                ></div>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-[10px] text-slate-400">Mínimo 8 caracteres (A-Z, a-z, 0-9).</p>
                <span class="text-[10px] font-bold uppercase" :class="passwordStrength <= 2 ? 'text-red-500' : passwordStrength <= 3 ? 'text-yellow-500' : 'text-green-500'">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
            </div>
          </div>

          <!-- Confirm Password Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="confirmPassword">
              Confirmar senha
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                :class="{ 'border-red-400 focus:border-red-400 focus:ring-red-100': errorMessage && confirmPassword !== password }"
                required
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                tabindex="-1"
              >
                <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Terms Checkbox -->
          <div class="flex items-start gap-3 mt-4 pt-2">
            <input
              id="terms"
              type="checkbox"
              required
              class="mt-0.5 w-4 h-4 rounded border-slate-300 bg-slate-50 text-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors"
            />
            <label for="terms" class="text-xs text-slate-500 leading-tight">
              Eu concordo com os
              <NuxtLink to="/terms" class="text-slate-700 font-medium hover:text-indigo-600 hover:underline underline-offset-4 transition-colors">Termos de Uso</NuxtLink>
              e
              <NuxtLink to="/privacy" class="text-slate-700 font-medium hover:text-indigo-600 hover:underline underline-offset-4 transition-colors">Política de Privacidade</NuxtLink>
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full h-12 mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 border border-indigo-500/20 group hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span v-if="isLoading">Criando conta...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Criar conta
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Sign In Link -->
        <p class="text-center text-sm text-slate-400 mt-6">
          Já tem uma conta?
          <NuxtLink
            to="/auth/login"
            class="text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
          >
            Fazer login
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Gratuito para começar</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <span>Sem cartão de crédito</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped overrides if needed */
</style>

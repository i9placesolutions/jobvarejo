<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, Building2, ArrowRight, FileText, Check, Phone } from 'lucide-vue-next'

definePageMeta({
  layout: 'builder-auth',
  middleware: 'builder-auth',
})

const auth = useBuilderAuth()

const companyName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Password strength
const passwordStrength = computed(() => {
  if (!password.value) return 0
  let s = 0
  if (password.value.length >= 8) s++
  if (password.value.length >= 12) s++
  if (/[a-z]/.test(password.value) && /[A-Z]/.test(password.value)) s++
  if (/\d/.test(password.value)) s++
  if (/[^a-zA-Z0-9]/.test(password.value)) s++
  return s
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

const handleRegister = async () => {
  if (!companyName.value || !email.value || !password.value || !confirmPassword.value) {
    errorMessage.value = 'Por favor, preencha todos os campos obrigatórios'
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

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await auth.signUp(email.value, password.value, companyName.value, {
      phone: phone.value || undefined,
      whatsapp: phone.value || undefined
    })

    successMessage.value = 'Conta criada com sucesso! Faça login para continuar.'
    companyName.value = ''
    email.value = ''
    phone.value = ''
    password.value = ''
    confirmPassword.value = ''

    setTimeout(() => {
      navigateTo('/builder/login')
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
    <div class="w-full">
      <div class="bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-4xl p-8 sm:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <!-- Decoration light -->
        <div class="absolute -top-32 -left-32 w-64 h-64 bg-emerald-600/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-64 h-64 bg-teal-600/10 rounded-full blur-[80px] pointer-events-none"></div>

        <!-- Logo & Header -->
        <div class="text-center mb-8 relative z-10">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-emerald-600/20 to-teal-600/20 backdrop-blur-md rounded-2xl mb-5 border border-white/10 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative group">
            <div class="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <FileText class="w-8 h-8 text-emerald-300 relative z-10" />
          </div>
          <h1 class="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-linear-to-r from-white to-zinc-400 tracking-tight">Crie sua conta</h1>
          <p class="text-sm font-medium text-zinc-500">
            Comece a criar encartes profissionais grátis
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <p class="text-sm text-green-400">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-4 relative z-10">
          <!-- Company Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="builder-name">
              Nome da empresa *
            </label>
            <div class="relative group">
              <Building2 class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="builder-name"
                v-model="companyName"
                type="text"
                autocomplete="organization"
                placeholder="Supermercado Exemplo"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
              />
            </div>
          </div>

          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="builder-email">
              E-mail *
            </label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="builder-email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="contato@empresa.com"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
              />
            </div>
          </div>

          <!-- Phone (optional) -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="builder-phone">
              Telefone / WhatsApp
            </label>
            <div class="relative group">
              <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="builder-phone"
                v-model="phone"
                type="tel"
                autocomplete="tel"
                placeholder="(11) 99999-9999"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="builder-password">
              Senha *
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="builder-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Password Strength -->
            <div v-if="password" class="mt-1">
              <div class="flex gap-1 mb-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors duration-300"
                  :class="i <= passwordStrength ? passwordStrengthColor : 'bg-white/10'"
                ></div>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-[10px] text-zinc-500">Mínimo 8 caracteres</p>
                <span class="text-[10px] font-bold uppercase" :class="passwordStrength <= 2 ? 'text-red-400' : passwordStrength <= 3 ? 'text-yellow-400' : 'text-green-400'">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="builder-confirm-password">
              Confirmar senha *
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
              <input
                id="builder-confirm-password"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                required
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                tabindex="-1"
              >
                <EyeOff v-if="showConfirmPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Terms -->
          <div class="flex items-start gap-3 mt-4 pt-2">
            <input
              id="builder-terms"
              type="checkbox"
              required
              class="mt-0.5 w-4 h-4 rounded border-white/10 bg-[#09090b]/50 text-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-colors"
            />
            <label for="builder-terms" class="text-xs text-zinc-400 leading-tight">
              Eu concordo com os
              <NuxtLink to="/terms" class="text-zinc-300 font-medium hover:text-white hover:underline underline-offset-4 transition-colors">Termos de Uso</NuxtLink>
              e
              <NuxtLink to="/privacy" class="text-zinc-300 font-medium hover:text-white hover:underline underline-offset-4 transition-colors">Política de Privacidade</NuxtLink>
            </label>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full h-12 mt-4 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 group hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span v-if="isLoading">Criando conta...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Criar conta grátis
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Sign In Link -->
        <p class="text-center text-sm text-zinc-400 mt-6">
          Já tem uma conta?
          <NuxtLink
            to="/builder/login"
            class="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Fazer login
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
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

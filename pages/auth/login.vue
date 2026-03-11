<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

// Auth composable
const auth = useAuth()

// Form state
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const isRedirecting = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (isLoading.value || isRedirecting.value) {
    return
  }

  if (!email.value || !password.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await auth.signIn(email.value, password.value)

    // Avoid overlapping Nuxt navigations if the user submits twice.
    isRedirecting.value = true
    await navigateTo('/', { replace: true })
  } catch (error: any) {
    isRedirecting.value = false
    errorMessage.value = error.message || 'Erro ao fazer login. Verifique suas credenciais.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="w-full">
    <!-- Glass Card -->
    <div class="w-full">
      <!-- Main Glass Card -->
      <div class="bg-[#18181b]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        <!-- Decoration light -->
        <div class="absolute -top-32 -right-32 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-[80px] pointer-events-none"></div>

        <!-- Logo & Header -->
        <div class="text-center mb-10 relative z-10">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 backdrop-blur-md rounded-2xl mb-5 border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.15)] relative group">
            <div class="absolute inset-0 bg-violet-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Sparkles class="w-8 h-8 text-violet-300 relative z-10" />
          </div>
          <h1 class="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 tracking-tight">Bem-vindo de volta</h1>
          <p class="text-sm font-medium text-zinc-500">
            Entre na sua conta para continuar
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5 relative z-10">
          <!-- Email Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="email">
              E-mail
            </label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-violet-400" />
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                :class="{ 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20': errorMessage }"
                required
              />
            </div>
          </div>

          <!-- Password Input -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="password">
              Senha
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-violet-400" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                :class="{ 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20': errorMessage }"
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
          </div>

          <!-- Forgot Password Link -->
          <div class="flex justify-end pt-1">
            <NuxtLink
              to="/auth/forgot-password"
              class="text-[13px] text-zinc-400 hover:text-white transition-colors font-medium hover:underline decoration-white/20 underline-offset-4"
            >
              Esqueceu sua senha?
            </NuxtLink>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full h-12 mt-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_25px_rgba(139,92,246,0.4)] border border-violet-400/20 group hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span v-if="isLoading">Entrando...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Entrar no JobVarejo
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Sign Up Link -->
        <p class="text-center text-sm text-zinc-400 mt-6">
          Não tem uma conta?
          <NuxtLink
            to="/auth/register"
            class="text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Criar conta
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Conexão segura</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <span>Dados protegidos</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card entry animation handled seamlessly */
</style>

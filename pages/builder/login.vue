<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, ArrowRight, FileText } from 'lucide-vue-next'

definePageMeta({
  layout: 'builder-auth',
  middleware: 'builder-auth',
})

const auth = useBuilderAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const isRedirecting = ref(false)
const errorMessage = ref('')

const handleLogin = async () => {
  if (isLoading.value || isRedirecting.value) return

  if (!email.value || !password.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await auth.signIn(email.value, password.value)
    isRedirecting.value = true
    // Redirect admin users to admin builder area
    const destination = result?.tenant?._isAdmin ? '/admin/builder' : '/builder'
    await navigateTo(destination, { replace: true })
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
    <div class="w-full">
      <div class="bg-white border border-slate-200 rounded-4xl p-8 sm:p-10 shadow-xl shadow-black/5 relative overflow-hidden">
        <!-- Decoration light -->
        <div class="absolute -top-32 -right-32 w-64 h-64 bg-emerald-100/60 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute -bottom-32 -left-32 w-64 h-64 bg-teal-100/40 rounded-full blur-[80px] pointer-events-none"></div>

        <!-- Logo & Header -->
        <div class="text-center mb-10 relative z-10">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-2xl mb-5 border border-emerald-200 relative group">
            <div class="absolute inset-0 bg-emerald-100 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <FileText class="w-8 h-8 text-emerald-600 relative z-10" />
          </div>
          <h1 class="text-2xl font-bold mb-2 text-slate-800 tracking-tight">Bem-vindo de volta</h1>
          <p class="text-sm font-medium text-slate-400">
            Entre na sua conta para criar seus encartes
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5 relative z-10">
          <!-- Email -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="builder-email">
              E-mail
            </label>
            <div class="relative group">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
              <input
                id="builder-email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="w-full h-12 pl-12 pr-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                :class="{ 'border-red-400': errorMessage }"
                required
              />
            </div>
          </div>

          <!-- Password -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1" for="builder-password">
              Senha
            </label>
            <div class="relative group">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors group-focus-within:text-emerald-500" />
              <input
                id="builder-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full h-12 pl-12 pr-12 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                :class="{ 'border-red-400': errorMessage }"
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
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full h-12 mt-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-emerald-500/15 hover:shadow-xl hover:shadow-emerald-500/25 border border-emerald-500/20 group hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span v-if="isLoading">Entrando...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Entrar
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Sign Up Link -->
        <p class="text-center text-sm text-slate-400 mt-6">
          Não tem uma conta?
          <NuxtLink
            to="/builder/register"
            class="text-emerald-600 hover:text-emerald-500 font-medium transition-colors"
          >
            Criar conta grátis
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Conexão segura</span>
        </div>
        <div class="flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <span>100% gratuito</span>
        </div>
      </div>
    </div>
  </div>
</template>

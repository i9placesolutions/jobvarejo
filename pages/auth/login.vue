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
const errorMessage = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await auth.signIn(email.value, password.value)

    // Redirect to dashboard
    await navigateTo('/')
  } catch (error: any) {
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
      <div class="glass-card">
        <!-- Logo & Header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-violet-500/20 backdrop-blur-sm rounded-xl mb-3 border border-violet-500/30 shadow-lg">
            <Sparkles class="w-7 h-7 text-violet-400" />
          </div>
          <h1 class="text-xl font-bold mb-1 text-white">Bem-vindo de volta</h1>
          <p class="text-sm text-zinc-400">
            Entre na sua conta para continuar
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Email Input -->
          <div class="form-group">
            <label class="form-label text-zinc-300" for="email">
              E-mail
            </label>
            <div class="relative">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-violet-400" />
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="input-field pl-12"
                :class="{ 'border-red-500': errorMessage }"
                required
              />
            </div>
          </div>

          <!-- Password Input -->
          <div class="form-group">
            <label class="form-label text-zinc-300" for="password">
              Senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-violet-400" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="input-field pl-12 pr-12"
                :class="{ 'border-red-500': errorMessage }"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Forgot Password Link -->
          <div class="flex justify-end">
            <NuxtLink
              to="/auth/forgot-password"
              class="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Esqueceu ou quer trocar sua senha?
            </NuxtLink>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary w-full group"
          >
            <span v-if="isLoading">Entrando...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Entrar
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
/* Glassmorphism Card */
.glass-card {
  background: rgba(30, 30, 30, 0.9);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: cardEntry 0.5s ease-out;
}

/* Entry Animation */
@keyframes cardEntry {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Form Group */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
}

/* Input Field */
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(44, 44, 44, 0.8);
  backdrop-filter: blur(4px);
  border: 1px solid #3f3f46;
  border-radius: 0.75rem;
  color: white;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.input-field::placeholder {
  color: #71717a;
}

.input-field:hover {
  background: rgba(60, 60, 60, 0.8);
  border-color: #52525b;
}

.input-field:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
}

.input-field.border-red-500 {
  border-color: #ef4444;
}

/* Primary Button */
.btn-primary {
  position: relative;
  padding: 0.875rem 1.5rem;
  background: #7c3aed;
  color: white;
  border-radius: 0.75rem;
  font-weight: 600;
  box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3);
  transition: all 0.2s;
  overflow: hidden;
}

.btn-primary:hover {
  box-shadow: 0 20px 25px -5px rgba(124, 58, 237, 0.3);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.5), 0 0 0 4px rgba(124, 58, 237, 0.2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: translateY(0);
}

.btn-primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.2), transparent);
  border-radius: 0.75rem;
  opacity: 0;
  transition: opacity 0.3s;
}

.btn-primary:hover::before {
  opacity: 1;
}
</style>

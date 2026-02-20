<script setup lang="ts">
import { Mail, ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

// Form state
const email = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const debugResetUrl = ref('')

const handleSubmit = async () => {
  if (!email.value) {
    errorMessage.value = 'Por favor, insira seu e-mail'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  debugResetUrl.value = ''

  try {
    const response = await $fetch<any>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value }
    })

    successMessage.value = 'Se existir uma conta com este e-mail, você receberá instruções de recuperação.'
    debugResetUrl.value = String(response?.debugResetUrl || '')
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao enviar e-mail. Verifique o endereço digitado.'
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
          <h1 class="text-xl font-bold mb-1 text-white">Recuperar senha</h1>
          <p class="text-sm text-zinc-400">
            Digite seu e-mail e enviaremos instruções
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-green-400 font-medium">Solicitação recebida!</p>
              <p class="text-sm text-green-400">{{ successMessage }}</p>
              <a
                v-if="debugResetUrl"
                :href="debugResetUrl"
                class="text-xs text-violet-300 hover:text-violet-200 underline mt-2 inline-block"
              >
                Abrir link de reset (modo desenvolvimento)
              </a>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Forgot Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
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

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary w-full group"
          >
            <span v-if="isLoading">Enviando...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Enviar instruções
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Tips -->
        <div v-if="!successMessage" class="mt-6 p-4 bg-[#2c2c2c]/50 rounded-xl border border-white/5">
          <h3 class="text-sm font-semibold mb-2 text-white flex items-center gap-2">
            <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Dicas
          </h3>
          <ul class="text-xs text-zinc-400 space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="text-violet-400 mt-0.5">•</span>
              <span>Verifique sua caixa de entrada e pasta de spam</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-violet-400 mt-0.5">•</span>
              <span>O link expira em alguns minutos</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-violet-400 mt-0.5">•</span>
              <span>Se não receber, tente novamente em alguns minutos</span>
            </li>
          </ul>
        </div>

        <!-- Back to Login Link -->
        <div class="mt-6 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors group"
          >
            <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar para o login
          </NuxtLink>
        </div>
      </div>

      <!-- Help Text -->
      <div class="mt-6 text-center">
        <p class="text-sm text-zinc-400">
          Precisa de ajuda?
          <a href="mailto:support@studio.pro" class="text-violet-400 hover:text-violet-300 font-medium transition-colors">
            Entre em contato
          </a>
        </p>
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

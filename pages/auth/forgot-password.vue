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
    <div class="w-full">
      <!-- Main Card -->
      <div class="glass-card">
        <!-- Logo & Header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-xl mb-3 border border-indigo-200">
            <Sparkles class="w-7 h-7 text-indigo-500" />
          </div>
          <h1 class="text-xl font-bold mb-1 text-slate-800">Recuperar senha</h1>
          <p class="text-sm text-slate-400">
            Digite seu e-mail e enviaremos instruções
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-green-700 font-medium">Solicitação recebida!</p>
              <p class="text-sm text-green-600">{{ successMessage }}</p>
              <a
                v-if="debugResetUrl"
                :href="debugResetUrl"
                class="text-xs text-indigo-600 hover:text-indigo-500 underline mt-2 inline-block"
              >
                Abrir link de reset (modo desenvolvimento)
              </a>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Forgot Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Email Input -->
          <div class="form-group">
            <label class="form-label text-slate-600" for="email">
              E-mail
            </label>
            <div class="relative">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 transition-colors peer-focus:text-indigo-500" />
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="input-field pl-12"
                :class="{ 'border-red-400': errorMessage }"
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
        <div v-if="!successMessage" class="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h3 class="text-sm font-semibold mb-2 text-slate-700 flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Dicas
          </h3>
          <ul class="text-xs text-slate-500 space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="text-indigo-500 mt-0.5">•</span>
              <span>Verifique sua caixa de entrada e pasta de spam</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-indigo-500 mt-0.5">•</span>
              <span>O link expira em alguns minutos</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-indigo-500 mt-0.5">•</span>
              <span>Se não receber, tente novamente em alguns minutos</span>
            </li>
          </ul>
        </div>

        <!-- Back to Login Link -->
        <div class="mt-6 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors group"
          >
            <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar para o login
          </NuxtLink>
        </div>
      </div>

      <!-- Help Text -->
      <div class="mt-6 text-center">
        <p class="text-sm text-slate-400">
          Precisa de ajuda?
          <a href="mailto:support@studio.pro" class="text-indigo-600 hover:text-indigo-500 font-medium transition-colors">
            Entre em contato
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card */
.glass-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.06);
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
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  color: #1e293b;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.input-field::placeholder {
  color: #94a3b8;
}

.input-field:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.input-field:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  background: #ffffff;
}

.input-field.border-red-400 {
  border-color: #f87171;
}

/* Primary Button */
.btn-primary {
  position: relative;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: white;
  border-radius: 0.75rem;
  font-weight: 600;
  box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.2);
  transition: all 0.2s;
  overflow: hidden;
}

.btn-primary:hover {
  box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.25);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.15);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4), 0 0 0 4px rgba(99, 102, 241, 0.15);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: translateY(0);
}
</style>

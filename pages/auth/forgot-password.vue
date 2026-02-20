<script setup lang="ts">
import { Mail, ArrowLeft, ArrowRight, Check } from 'lucide-vue-next'

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
          <h1 class="text-2xl font-extrabold mb-1 tracking-tight text-[#2a2117]">Recuperar senha</h1>
          <p class="text-sm text-[#756453]">
            Digite seu e-mail e enviaremos instruções
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="alert-box alert-success mb-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-[#0f6a46] font-semibold">Solicitação recebida!</p>
              <p class="text-sm text-[#0f6a46]">{{ successMessage }}</p>
              <a
                v-if="debugResetUrl"
                :href="debugResetUrl"
                class="text-xs text-[#8f1e19] hover:text-[#6f1714] underline mt-2 inline-block font-semibold"
              >
                Abrir link de reset (modo desenvolvimento)
              </a>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="alert-box alert-error mb-4">
          <p class="text-sm text-[#8f1e19] text-center font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Forgot Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Email Input -->
          <div class="form-group">
            <label class="form-label" for="email">
              E-mail
            </label>
            <div class="relative">
              <Mail class="input-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors peer-focus:text-[#b3261e]" />
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
        <div v-if="!successMessage" class="tip-card mt-6 p-4 rounded-xl">
          <h3 class="text-sm font-semibold mb-2 text-[#2a2117] flex items-center gap-2">
            <svg class="w-4 h-4 text-[#b3261e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Dicas
          </h3>
          <ul class="text-xs text-[#735f4f] space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="text-[#b3261e] mt-0.5">•</span>
              <span>Verifique sua caixa de entrada e pasta de spam</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-[#b3261e] mt-0.5">•</span>
              <span>O link expira em alguns minutos</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-[#b3261e] mt-0.5">•</span>
              <span>Se não receber, tente novamente em alguns minutos</span>
            </li>
          </ul>
        </div>

        <!-- Back to Login Link -->
        <div class="mt-6 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-[#6f5f4f] hover:text-[#2f2419] transition-colors group font-medium"
          >
            <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar para o login
          </NuxtLink>
        </div>
      </div>

      <!-- Help Text -->
      <div class="mt-6 text-center">
        <p class="text-sm text-[#7c6959]">
          Precisa de ajuda?
          <a href="mailto:atendimento@jobvarejo.com.br" class="text-[#9c2f24] hover:text-[#7e241b] font-semibold transition-colors">
            Entre em contato
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(175deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 248, 238, 0.96) 100%);
  backdrop-filter: blur(14px);
  border: 1px solid #e8d8bc;
  border-radius: 1.35rem;
  padding: 1.65rem;
  box-shadow: 0 24px 50px -28px rgba(58, 32, 14, 0.38), 0 16px 30px -18px rgba(179, 38, 30, 0.22);
  animation: cardEntry 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.glass-card::before {
  content: '';
  position: absolute;
  left: 1.1rem;
  right: 1.1rem;
  top: 0;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, #d1831f, #b3261e 55%, #d1831f);
  opacity: 0.78;
}

.glass-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 1.35rem;
  border: 1px solid rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

@keyframes cardEntry {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #4b3d30;
  letter-spacing: 0.01em;
}

.input-field {
  width: 100%;
  padding-top: 0.78rem;
  padding-bottom: 0.78rem;
  background: linear-gradient(180deg, #fffcf8 0%, #fff9f1 100%);
  border: 1px solid #dcc7a8;
  border-radius: 0.75rem;
  color: #2f2419;
  font-size: 0.875rem;
  transition: all 0.22s ease;
}

.input-field::placeholder {
  color: #9f8b74;
}

.input-field:hover {
  background: #fffdf9;
  border-color: #cdb18a;
}

.input-field:focus {
  outline: none;
  border-color: #b53a2b;
  box-shadow: 0 0 0 3px rgba(181, 58, 43, 0.2);
}

.input-field.border-red-500 {
  border-color: #dc4d45;
  box-shadow: 0 0 0 2px rgba(220, 77, 69, 0.14);
}

.input-icon {
  color: #9c866e;
  pointer-events: none;
}

.tip-card {
  background: linear-gradient(180deg, rgba(255, 249, 236, 0.9) 0%, rgba(255, 244, 219, 0.72) 100%);
  border: 1px solid #ead5b5;
}

.alert-box {
  border-radius: 0.85rem;
  padding: 0.8rem 0.9rem;
}

.alert-success {
  background: linear-gradient(180deg, rgba(229, 252, 242, 0.9) 0%, rgba(213, 247, 233, 0.75) 100%);
  border: 1px solid rgba(24, 163, 105, 0.28);
}

.alert-error {
  background: linear-gradient(180deg, rgba(255, 236, 233, 0.88) 0%, rgba(255, 232, 228, 0.7) 100%);
  border: 1px solid rgba(220, 77, 69, 0.32);
}

.btn-primary {
  position: relative;
  padding: 0.9rem 1.5rem;
  background: linear-gradient(135deg, #b3261e 0%, #cf4a2b 100%);
  color: white;
  border-radius: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 14px 24px -12px rgba(179, 38, 30, 0.52);
  transition: all 0.22s ease;
  overflow: hidden;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #9f2119 0%, #be4226 100%);
  box-shadow: 0 20px 28px -12px rgba(159, 33, 25, 0.48);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px -3px rgba(179, 38, 30, 0.25);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(181, 58, 43, 0.35), 0 0 0 4px rgba(181, 58, 43, 0.14);
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
  background: linear-gradient(110deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 72%);
  border-radius: 0.75rem;
  opacity: 0;
  transition: opacity 0.3s;
}

.btn-primary:hover::before {
  opacity: 1;
}
</style>

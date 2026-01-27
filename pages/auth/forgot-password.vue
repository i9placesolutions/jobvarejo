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

// Supabase auth
const supabase = useSupabase()

const handleSubmit = async () => {
  if (!email.value) {
    errorMessage.value = 'Por favor, insira seu e-mail'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) throw error

    successMessage.value = 'E-mail de recuperação enviado! Verifique sua caixa de entrada.'
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao enviar e-mail. Verifique o endereço digitado.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Animated Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <!-- Gradient orbs -->
      <div class="absolute top-1/4 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
      <div class="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"></div>
    </div>

    <!-- Glass Card -->
    <div class="w-full max-w-md relative z-10">
      <!-- Main Glass Card -->
      <div class="glass-card">
        <!-- Logo & Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-primary/10 backdrop-blur-sm rounded-2xl mb-4 border border-primary/20 shadow-lg">
            <Sparkles class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Recuperar senha</h1>
          <p class="text-sm text-muted-foreground">
            Digite seu e-mail e enviaremos instruções para redefinir sua senha
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-green-600 dark:text-green-400 font-medium">E-mail enviado!</p>
              <p class="text-sm text-green-600 dark:text-green-400 mt-1">{{ successMessage }}</p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm">
          <p class="text-sm text-destructive text-center">{{ errorMessage }}</p>
        </div>

        <!-- Forgot Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Email Input -->
          <div class="form-group">
            <label class="form-label" for="email">
              E-mail
            </label>
            <div class="relative">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors peer-focus:text-primary" />
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                class="input-field pl-12"
                :class="{ 'border-destructive': errorMessage }"
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
        <div v-if="!successMessage" class="mt-6 p-4 bg-muted/30 rounded-xl border border-border/50">
          <h3 class="text-sm font-semibold mb-2 flex items-center gap-2">
            <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Dicas
          </h3>
          <ul class="text-xs text-muted-foreground space-y-1.5">
            <li class="flex items-start gap-2">
              <span class="text-primary mt-0.5">•</span>
              <span>Verifique sua caixa de entrada e pasta de spam</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary mt-0.5">•</span>
              <span>O link expira em 24 horas</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary mt-0.5">•</span>
              <span>Se não receber, tente novamente em alguns minutos</span>
            </li>
          </ul>
        </div>

        <!-- Back to Login Link -->
        <div class="mt-8 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar para o login
          </NuxtLink>
        </div>
      </div>

      <!-- Help Text -->
      <div class="mt-6 text-center">
        <p class="text-sm text-muted-foreground">
          Precisa de ajuda?
          <a href="mailto:support@studio.pro" class="text-primary hover:text-primary/80 font-medium transition-colors">
            Entre em contato
          </a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../assets/css/main.css";

/* Glassmorphism Card */
.glass-card {
  @apply relative bg-card/60 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl;
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
  @apply space-y-2;
}

.form-label {
  @apply text-sm font-medium text-foreground;
}

/* Input Field */
.input-field {
  @apply w-full px-4 py-3 bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl;
  @apply text-foreground placeholder:text-muted-foreground;
  @apply focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50;
  @apply transition-all duration-200;
}

.input-field:hover {
  @apply bg-background/70 border-border/70;
}

/* Primary Button */
.btn-primary {
  @apply relative px-6 py-3.5 bg-primary text-primary-foreground rounded-xl;
  @apply font-semibold shadow-lg shadow-primary/25;
  @apply hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5;
  @apply active:translate-y-0 active:shadow-md;
  @apply focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2;
  @apply disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0;
  @apply transition-all duration-200;
}

.btn-primary::before {
  content: '';
  @apply absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-xl;
  @apply opacity-0 hover:opacity-100 transition-opacity duration-300;
}
</style>

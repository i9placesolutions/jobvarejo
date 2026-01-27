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
          <h1 class="text-2xl font-bold mb-2">Bem-vindo de volta</h1>
          <p class="text-sm text-muted-foreground">
            Entre na sua conta para continuar criando
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm">
          <p class="text-sm text-destructive text-center">{{ errorMessage }}</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
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

          <!-- Password Input -->
          <div class="form-group">
            <label class="form-label" for="password">
              Senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors peer-focus:text-primary" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="input-field pl-12 pr-12"
                :class="{ 'border-destructive': errorMessage }"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
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
              class="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Esqueceu sua senha?
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
        <p class="text-center text-sm text-muted-foreground mt-8">
          Não tem uma conta?
          <NuxtLink
            to="/auth/register"
            class="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Criar conta
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
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

/* Social Login Button */
.btn-social {
  @apply flex items-center justify-center gap-2 px-4 py-2.5;
  @apply bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl;
  @apply text-sm font-medium text-foreground;
  @apply hover:bg-background/80 hover:border-border;
  @apply hover:-translate-y-0.5 active:translate-y-0;
  @apply transition-all duration-200;
}
</style>

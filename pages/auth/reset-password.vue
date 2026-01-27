<script setup lang="ts">
import { Eye, EyeOff, Lock, Check, ArrowRight, Sparkles } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

// Form state
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

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
  if (passwordStrength.value <= 2) return 'bg-destructive'
  if (passwordStrength.value <= 3) return 'bg-yellow-500'
  return 'bg-green-500'
})

// Supabase auth
const supabase = useSupabase()

const handleResetPassword = async () => {
  // Validation
  if (!password.value || !confirmPassword.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
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
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    })

    if (error) throw error

    successMessage.value = 'Senha redefinida com sucesso! Você pode fazer login agora.'

    // Clear form
    password.value = ''
    confirmPassword.value = ''

    // Redirect to login after 2 seconds
    setTimeout(() => {
      navigateTo('/auth/login')
    }, 2000)
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao redefinir senha. Tente novamente.'
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
            <Lock class="w-8 h-8 text-primary" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Redefinir senha</h1>
          <p class="text-sm text-muted-foreground">
            Crie sua nova senha abaixo
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-green-600 dark:text-green-400 font-medium">Sucesso!</p>
              <p class="text-sm text-green-600 dark:text-green-400 mt-1">{{ successMessage }}</p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm">
          <p class="text-sm text-destructive text-center">{{ errorMessage }}</p>
        </div>

        <!-- Reset Password Form -->
        <form @submit.prevent="handleResetPassword" class="space-y-5">
          <!-- Password Input -->
          <div class="form-group">
            <label class="form-label" for="password">
              Nova senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors peer-focus:text-primary" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
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

            <!-- Password Strength Indicator -->
            <div v-if="password" class="mt-2">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-muted-foreground">Força da senha</span>
                <span class="text-xs font-medium" :class="passwordStrength <= 2 ? 'text-destructive' : passwordStrength <= 3 ? 'text-yellow-500' : 'text-green-500'">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
              <div class="flex gap-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors duration-300"
                  :class="i <= passwordStrength ? passwordStrengthColor : 'bg-muted'"
                ></div>
              </div>
              <p class="text-xs text-muted-foreground mt-2">
                Mínimo 8 caracteres. Recomendado: maiúsculas, minúsculas, números e símbolos.
              </p>
            </div>
          </div>

          <!-- Confirm Password Input -->
          <div class="form-group">
            <label class="form-label" for="confirmPassword">
              Confirmar nova senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors peer-focus:text-primary" />
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="input-field pl-12 pr-12"
                :class="{ 'border-destructive': errorMessage && confirmPassword !== password }"
                required
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabindex="-1"
              >
                <EyeOff v-if="showConfirmPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>

            <!-- Password Match Indicator -->
            <div v-if="confirmPassword" class="mt-2">
              <div class="flex items-center gap-2 text-xs">
                <div
                  class="w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300"
                  :class="password === confirmPassword ? 'bg-green-500' : 'bg-destructive'"
                >
                  <Check v-if="password === confirmPassword" class="w-3 h-3 text-white" />
                </div>
                <span :class="password === confirmPassword ? 'text-green-600 dark:text-green-400' : 'text-destructive'">
                  {{ password === confirmPassword ? 'As senhas coincidem' : 'As senhas não coincidem' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || password !== confirmPassword"
            class="btn-primary w-full group"
          >
            <span v-if="isLoading">Redefinindo...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Redefinir senha
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Back to Login Link -->
        <div class="mt-8 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
            Voltar para o login
          </NuxtLink>
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
</style>

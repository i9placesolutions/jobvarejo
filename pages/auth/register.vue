<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, Check, Crown } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

const supabase = useSupabase()

// Form state
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const isFirstUser = ref(false)

// Check if this will be the first user (super admin)
const checkFirstUser = async () => {
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (!error && count !== null) {
      isFirstUser.value = count === 0
    }
  } catch (e) {
    console.error('Error checking first user:', e)
  }
}

// Check on mount
onMounted(() => {
  checkFirstUser()
})

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

const handleRegister = async () => {
  // Validation
  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
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
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          name: name.value,
        },
      },
    })

    if (error) throw error

    // Success message based on first user
    if (isFirstUser.value) {
      successMessage.value = 'Conta de Super Admin criada com sucesso! Você será o administrador principal.'
    } else {
      successMessage.value = 'Conta criada com sucesso! Faça login para continuar.'
    }

    // Clear form
    name.value = ''
    email.value = ''
    password.value = ''
    confirmPassword.value = ''

    // Redirect to login after 2 seconds
    setTimeout(() => {
      navigateTo('/auth/login')
    }, 2500)
  } catch (error: any) {
    errorMessage.value = error.message || 'Erro ao criar conta. Tente novamente.'
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
          <h1 class="text-2xl font-bold mb-2">Crie sua conta</h1>
          <p class="text-sm text-muted-foreground">
            Comece sua jornada criativa hoje
          </p>
        </div>

        <!-- First User - Super Admin Banner -->
        <div v-if="isFirstUser" class="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl backdrop-blur-sm">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown class="w-5 h-5 text-white" />
            </div>
            <div class="text-left">
              <p class="text-sm font-semibold text-amber-600 dark:text-amber-400">Primeiro Usuário - Super Admin</p>
              <p class="text-xs text-amber-600/70 dark:text-amber-400/70">Você será o administrador principal do sistema</p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <p class="text-sm text-green-600 dark:text-green-400">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm">
          <p class="text-sm text-destructive text-center">{{ errorMessage }}</p>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-5">
          <!-- Name Input -->
          <div class="form-group">
            <label class="form-label" for="name">
              Nome completo
            </label>
            <div class="relative">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors peer-focus:text-primary" />
              <input
                id="name"
                v-model="name"
                type="text"
                autocomplete="name"
                placeholder="Seu nome"
                class="input-field pl-12"
                :class="{ 'border-destructive': errorMessage }"
                required
              />
            </div>
          </div>

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
              Confirmar senha
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
          </div>

          <!-- Terms Checkbox -->
          <div class="flex items-start gap-3">
            <input
              id="terms"
              type="checkbox"
              required
              class="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label for="terms" class="text-sm text-muted-foreground leading-tight">
              Eu concordo com os
              <NuxtLink to="/terms" class="text-primary hover:underline">Termos de Uso</NuxtLink>
              e
              <NuxtLink to="/privacy" class="text-primary hover:underline">Política de Privacidade</NuxtLink>
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="btn-primary w-full group"
          >
            <span v-if="isLoading">Criando conta...</span>
            <span v-else class="flex items-center justify-center gap-2">
              Criar conta
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </form>

        <!-- Sign In Link -->
        <p class="text-center text-sm text-muted-foreground mt-8">
          Já tem uma conta?
          <NuxtLink
            to="/auth/login"
            class="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Fazer login
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
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

<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, Check, Crown } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

const auth = useAuth()

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
    const response = await $fetch<{ isFirstUser?: boolean }>('/api/auth/first-user')
    isFirstUser.value = Boolean(response?.isFirstUser)
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
  if (passwordStrength.value <= 2) return 'bg-red-500'
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
    await auth.signUp(email.value, password.value, name.value)

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
          <h1 class="text-xl font-bold mb-1 text-white">Crie sua conta</h1>
          <p class="text-sm text-zinc-400">
            Comece sua jornada criativa
          </p>
        </div>

        <!-- First User - Super Admin Banner -->
        <div v-if="isFirstUser" class="mb-4 p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg backdrop-blur-sm">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown class="w-4 h-4 text-white" />
            </div>
            <div class="text-left">
              <p class="text-sm font-semibold text-amber-400">Primeiro Usuário - Super Admin</p>
              <p class="text-xs text-amber-400/70">Você será o administrador principal do sistema</p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <p class="text-sm text-green-400">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-4">
          <!-- Name Input -->
          <div class="form-group">
            <label class="form-label text-zinc-300" for="name">
              Nome completo
            </label>
            <div class="relative">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-violet-400" />
              <input
                id="name"
                v-model="name"
                type="text"
                autocomplete="name"
                placeholder="Seu nome"
                class="input-field pl-12"
                :class="{ 'border-red-500': errorMessage }"
                required
              />
            </div>
          </div>

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
                autocomplete="new-password"
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

            <!-- Password Strength Indicator -->
            <div v-if="password" class="mt-2">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-zinc-500">Força da senha</span>
                <span class="text-xs font-medium" :class="passwordStrength <= 2 ? 'text-red-400' : passwordStrength <= 3 ? 'text-yellow-400' : 'text-green-400'">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
              <div class="flex gap-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors duration-300"
                  :class="i <= passwordStrength ? passwordStrengthColor : 'bg-zinc-700'"
                ></div>
              </div>
              <p class="text-xs text-zinc-500 mt-2">
                Mínimo 8 caracteres. Recomendado: maiúsculas, minúsculas, números e símbolos.
              </p>
            </div>
          </div>

          <!-- Confirm Password Input -->
          <div class="form-group">
            <label class="form-label text-zinc-300" for="confirmPassword">
              Confirmar senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-violet-400" />
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="••••••••"
                class="input-field pl-12 pr-12"
                :class="{ 'border-red-500': errorMessage && confirmPassword !== password }"
                required
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors p-1"
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
              class="mt-1 w-4 h-4 rounded border-zinc-600 bg-[#2c2c2c] text-violet-600 focus:ring-2 focus:ring-violet-500/30"
            />
            <label for="terms" class="text-sm text-zinc-400 leading-tight">
              Eu concordo com os
              <NuxtLink to="/terms" class="text-violet-400 hover:underline">Termos de Uso</NuxtLink>
              e
              <NuxtLink to="/privacy" class="text-violet-400 hover:underline">Política de Privacidade</NuxtLink>
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
        <p class="text-center text-sm text-zinc-400 mt-6">
          Já tem uma conta?
          <NuxtLink
            to="/auth/login"
            class="text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Fazer login
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
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

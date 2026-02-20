<script setup lang="ts">
import { Eye, EyeOff, Lock, Check, ArrowRight, ArrowLeft } from 'lucide-vue-next'

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
const route = useRoute()
const resetToken = computed(() => String(route.query.token || '').trim())

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
  if (!resetToken.value) {
    errorMessage.value = 'Token de recuperação ausente ou inválido.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: {
        token: resetToken.value,
        password: password.value
      }
    })

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
  <div class="w-full">
    <!-- Glass Card -->
    <div class="w-full">
      <!-- Main Glass Card -->
      <div class="glass-card">
        <!-- Logo & Header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-14 h-14 bg-[#fdf2d6] backdrop-blur-sm rounded-xl mb-3 border border-[#e5d4a1] shadow-lg overflow-hidden">
            <img
              src="/logo.png"
              alt="Job Varejo"
              class="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <h1 class="text-xl font-bold mb-1 text-zinc-900">Redefinir senha</h1>
          <p class="text-sm text-zinc-400">
            Crie sua nova senha abaixo
          </p>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-sm">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <div>
              <p class="text-sm text-green-400 font-medium">Sucesso!</p>
              <p class="text-sm text-green-400">{{ successMessage }}</p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
          <p class="text-sm text-red-400 text-center">{{ errorMessage }}</p>
        </div>

        <!-- Reset Password Form -->
        <form @submit.prevent="handleResetPassword" class="space-y-4">
          <!-- Password Input -->
          <div class="form-group">
            <label class="form-label text-zinc-700" for="password">
              Nova senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-[#b3261e]" />
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
                class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors p-1"
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
            <label class="form-label text-zinc-700" for="confirmPassword">
              Confirmar nova senha
            </label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors peer-focus:text-[#b3261e]" />
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
                class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors p-1"
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
                  :class="password === confirmPassword ? 'bg-green-500' : 'bg-red-500'"
                >
                  <Check v-if="password === confirmPassword" class="w-3 h-3 text-white" />
                </div>
                <span :class="password === confirmPassword ? 'text-green-400' : 'text-red-400'">
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
        <div class="mt-6 text-center">
          <NuxtLink
            to="/auth/login"
            class="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
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
/* Glassmorphism Card */
.glass-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid #e8dfcf;
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 20px 45px -18px rgba(17, 17, 17, 0.18);
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
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  background: #f8f8f8;
    border: 1px solid #dadada;
  border-radius: 0.75rem;
  color: #18181b;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.input-field::placeholder {
  color: #71717a;
}

.input-field:hover {
  background: #ffffff;
  border-color: #c9c9c9;
}

.input-field:focus {
  outline: none;
  border-color: rgba(179, 38, 30, 0.5);
  box-shadow: 0 0 0 2px rgba(179, 38, 30, 0.16);
}

.input-field.border-red-500 {
  border-color: #ef4444;
}

/* Primary Button */
.btn-primary {
  position: relative;
  padding: 0.875rem 1.5rem;
  background: #b3261e;
  color: white;
  border-radius: 0.75rem;
  font-weight: 600;
  box-shadow: 0 10px 20px -8px rgba(179, 38, 30, 0.45);
  transition: all 0.2s;
  overflow: hidden;
}

.btn-primary:hover {
  background: #9f221b;
  box-shadow: 0 20px 28px -10px rgba(179, 38, 30, 0.38);
  transform: translateY(-2px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 4px 10px -3px rgba(179, 38, 30, 0.25);
}

.btn-primary:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(179, 38, 30, 0.45), 0 0 0 4px rgba(179, 38, 30, 0.16);
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

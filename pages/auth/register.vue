<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check, Crown } from 'lucide-vue-next'

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
  if (passwordStrength.value <= 2) return 'bg-[#d95c4f]'
  if (passwordStrength.value <= 3) return 'bg-[#cf9a3e]'
  return 'bg-[#27a06f]'
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
          <h1 class="text-2xl font-extrabold mb-1 tracking-tight text-[#2a2117]">Crie sua conta</h1>
          <p class="text-sm text-[#756453]">
            Comece sua jornada criativa
          </p>
        </div>

        <!-- First User - Super Admin Banner -->
        <div v-if="isFirstUser" class="alert-box alert-premium mb-4">
          <div class="flex items-center gap-3">
            <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-900/25">
              <Crown class="w-4 h-4 text-white" />
            </div>
            <div class="text-left">
              <p class="text-sm font-semibold text-[#7c3d00]">Primeiro Usuário - Super Admin</p>
              <p class="text-xs text-[#9a5b1e]">Você será o administrador principal do sistema</p>
            </div>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="alert-box alert-success mb-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-white" />
            </div>
            <p class="text-sm text-[#0f6a46] font-medium">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="alert-box alert-error mb-4">
          <p class="text-sm text-[#8f1e19] text-center font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-4">
          <!-- Name Input -->
          <div class="form-group">
            <label class="form-label" for="name">
              Nome completo
            </label>
            <div class="relative">
              <User class="input-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors peer-focus:text-[#b3261e]" />
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

          <!-- Password Input -->
          <div class="form-group">
            <label class="form-label" for="password">
              Senha
            </label>
            <div class="relative">
              <Lock class="input-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors peer-focus:text-[#b3261e]" />
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
                class="input-action absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>

            <!-- Password Strength Indicator -->
            <div v-if="password" class="mt-2">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs text-[#7a6756]">Força da senha</span>
                <span class="text-xs font-semibold" :class="passwordStrength <= 2 ? 'text-[#b53a2b]' : passwordStrength <= 3 ? 'text-[#b0691b]' : 'text-[#0f6a46]'">
                  {{ passwordStrengthLabel }}
                </span>
              </div>
              <div class="flex gap-1">
                <div
                  v-for="i in 5"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors duration-300"
                  :class="i <= passwordStrength ? passwordStrengthColor : 'bg-[#d5c4a8]'"
                ></div>
              </div>
              <p class="text-xs text-[#7a6756] mt-2">
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
              <Lock class="input-icon absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors peer-focus:text-[#b3261e]" />
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
                class="input-action absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1"
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
              class="mt-1 w-4 h-4 rounded border-[#c9b395] bg-white text-[#b3261e] focus:ring-2 focus:ring-[#b3261e]/30"
            />
            <label for="terms" class="text-sm text-[#746250] leading-tight">
              Eu concordo com os
              <NuxtLink to="/terms" class="text-[#9c2f24] hover:text-[#7e241b] font-semibold">Termos de Uso</NuxtLink>
              e
              <NuxtLink to="/privacy" class="text-[#9c2f24] hover:text-[#7e241b] font-semibold">Política de Privacidade</NuxtLink>
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
        <p class="text-center text-sm text-[#7c6959] mt-6">
          Já tem uma conta?
          <NuxtLink
            to="/auth/login"
            class="text-[#9c2f24] hover:text-[#7e241b] font-semibold transition-colors"
          >
            Fazer login
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-[#6f5f4f]">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
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

.input-action {
  color: #8c7660;
}

.input-action:hover {
  color: #493526;
}

.alert-box {
  border-radius: 0.85rem;
  padding: 0.8rem 0.9rem;
}

.alert-premium {
  background: linear-gradient(180deg, rgba(255, 244, 221, 0.88) 0%, rgba(255, 236, 201, 0.72) 100%);
  border: 1px solid rgba(208, 133, 33, 0.35);
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

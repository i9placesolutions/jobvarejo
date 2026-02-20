<script setup lang="ts">
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-vue-next'

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
  <div class="w-full">
    <!-- Glass Card -->
    <div class="w-full">
      <!-- Main Glass Card -->
      <div class="glass-card">
        <!-- Logo & Header -->
        <div class="text-center mb-6">
          <img
            src="/logo.png"
            alt="Job Varejo"
            class="logo-image mx-auto mb-4 w-full max-w-[220px] h-auto object-contain"
            loading="eager"
          />
          <h1 class="text-2xl font-extrabold mb-1 tracking-tight text-[#2a2117]">Bem-vindo de volta</h1>
          <p class="text-sm text-[#756453]">
            Entre na sua conta para continuar
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="alert-box alert-error mb-4">
          <p class="text-sm text-[#8f1e19] text-center font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
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
                autocomplete="current-password"
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
          </div>

          <!-- Forgot Password Link -->
          <div class="flex justify-end">
            <NuxtLink
              to="/auth/forgot-password"
              class="text-sm text-[#9c2f24] hover:text-[#7e241b] transition-colors font-semibold"
            >
              Esqueceu ou quer trocar sua senha?
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
        <p class="text-center text-sm text-[#7c6959] mt-6">
          Não tem uma conta?
          <NuxtLink
            to="/auth/register"
            class="text-[#9c2f24] hover:text-[#7e241b] font-semibold transition-colors"
          >
            Criar conta
          </NuxtLink>
        </p>
      </div>

      <!-- Trust Badges -->
      <div class="mt-4 flex items-center justify-center gap-4 text-xs text-[#6f5f4f]">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
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

.logo-image {
  filter: drop-shadow(0 12px 18px rgba(86, 54, 24, 0.18));
}

.alert-box {
  border-radius: 0.85rem;
  padding: 0.8rem 0.9rem;
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

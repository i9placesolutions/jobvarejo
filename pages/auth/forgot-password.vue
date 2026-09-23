<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Lock, MessageCircle, Phone } from 'lucide-vue-next'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

definePageMeta({
  layout: 'auth',
})

const step = ref<'phone' | 'verify' | 'done'>('phone')
const whatsapp = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const { onInput: maskWhatsAppInput } = useBrazilWhatsAppMask(whatsapp)

const passwordStrength = computed(() => {
  if (!password.value) return 0
  let strength = 0
  if (password.value.length >= 8) strength++
  if (password.value.length >= 12) strength++
  if (/[a-z]/.test(password.value) && /[A-Z]/.test(password.value)) strength++
  if (/\d/.test(password.value)) strength++
  if (/[^a-zA-Z0-9]/.test(password.value)) strength++
  return strength
})

const passwordStrengthLabel = computed(() => {
  if (passwordStrength.value <= 2) return 'Fraca'
  if (passwordStrength.value <= 3) return 'Média'
  return 'Forte'
})

const passwordStrengthColor = computed(() => {
  if (passwordStrength.value <= 2) return 'bg-red-500'
  if (passwordStrength.value <= 3) return 'bg-yellow-500'
  return 'bg-green-500'
})

const normalizeCodeInput = () => {
  code.value = code.value.replace(/\D/g, '').slice(0, 6)
}

const requestCode = async () => {
  const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp.value)
  if (!normalizedWhatsApp) {
    errorMessage.value = 'Informe um WhatsApp brasileiro válido com DDD.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch<{ message?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { whatsapp: normalizedWhatsApp }
    })
    successMessage.value = response?.message || 'Se este WhatsApp estiver vinculado à conta, enviaremos um código.'
    step.value = 'verify'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Não foi possível solicitar o código. Tente novamente.'
  } finally {
    isLoading.value = false
  }
}

const resetPassword = async () => {
  const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp.value)
  if (!normalizedWhatsApp || !/^\d{6}$/.test(code.value.trim())) {
    errorMessage.value = 'Informe o código de seis dígitos recebido no WhatsApp.'
    return
  }
  if (password.value.length < 8 || password.value.length > 256) {
    errorMessage.value = 'A nova senha deve ter entre 8 e 256 caracteres.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'As senhas não coincidem.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch<{ message?: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: {
        whatsapp: normalizedWhatsApp,
        code: code.value.trim(),
        password: password.value
      }
    })
    successMessage.value = response?.message || 'Senha redefinida. Entre com WhatsApp e sua nova senha.'
    code.value = ''
    password.value = ''
    confirmPassword.value = ''
    step.value = 'done'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Código inválido ou expirado. Solicite outro pelo WhatsApp.'
  } finally {
    isLoading.value = false
  }
}

const changeWhatsApp = () => {
  step.value = 'phone'
  code.value = ''
  password.value = ''
  confirmPassword.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}
</script>

<template>
  <div class="w-full">
    <section class="recovery-card" aria-labelledby="recovery-title">
      <header class="text-center mb-6">
        <div class="icon-badge">
          <MessageCircle v-if="step === 'phone'" class="w-7 h-7 text-indigo-500" />
          <KeyRound v-else-if="step === 'verify'" class="w-7 h-7 text-indigo-500" />
          <Check v-else class="w-7 h-7 text-green-600" />
        </div>
        <h1 id="recovery-title" class="text-xl font-bold mb-1 text-slate-800">
          {{ step === 'done' ? 'Senha redefinida' : 'Recuperar senha pelo WhatsApp' }}
        </h1>
        <p class="text-sm text-slate-500">
          <template v-if="step === 'phone'">Informe o WhatsApp já verificado na sua conta.</template>
          <template v-else-if="step === 'verify'">Confirme o código recebido e escolha uma nova senha.</template>
          <template v-else>Agora você pode entrar com WhatsApp e sua nova senha.</template>
        </p>
      </header>

      <div v-if="successMessage" class="notice notice--success" role="status" aria-live="polite">
        <Check class="w-5 h-5 shrink-0" />
        <p>{{ successMessage }}</p>
      </div>

      <div v-if="errorMessage" class="notice notice--error" role="alert" aria-live="assertive">
        <p>{{ errorMessage }}</p>
      </div>

      <form v-if="step === 'phone'" class="space-y-4" @submit.prevent="requestCode">
        <div class="form-group">
          <label class="form-label" for="whatsapp">WhatsApp da conta</label>
          <div class="relative">
            <Phone class="field-icon" />
            <input
              id="whatsapp"
              :value="whatsapp"
              type="tel"
              inputmode="tel"
              autocomplete="tel-national"
              placeholder="(64) 99999-9999"
              class="input-field pl-12"
              :class="{ 'border-red-400': errorMessage }"
              maxlength="16"
              required
              @input="maskWhatsAppInput"
            />
          </div>
        </div>

        <button type="submit" :disabled="isLoading" class="btn-primary w-full group">
          <span v-if="isLoading">Enviando código...</span>
          <span v-else class="flex items-center justify-center gap-2">
            Receber código no WhatsApp
            <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
        </button>

        <p class="text-xs text-center text-slate-500">
          Por segurança, o código só é enviado para um WhatsApp já vinculado e verificado nesta conta.
        </p>
      </form>

      <form v-else-if="step === 'verify'" class="space-y-4" @submit.prevent="resetPassword">
        <div class="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800">
          <div class="flex items-center gap-2 font-medium">
            <Phone class="w-4 h-4" />
            {{ whatsapp }}
          </div>
          <button type="button" class="mt-1 text-xs font-semibold underline" @click="changeWhatsApp">
            Trocar número
          </button>
        </div>

        <div class="form-group">
          <label class="form-label" for="whatsapp-code">Código do WhatsApp</label>
          <div class="relative">
            <KeyRound class="field-icon" />
            <input
              id="whatsapp-code"
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="000000"
              class="input-field pl-12 tracking-[0.3em]"
              maxlength="6"
              pattern="[0-9]{6}"
              required
              @input="normalizeCodeInput"
            />
          </div>
          <p class="text-xs text-slate-500">O código expira em 10 minutos e permite até 5 tentativas.</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="new-password">Nova senha</label>
          <div class="relative">
            <Lock class="field-icon" />
            <input
              id="new-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              class="input-field pl-12 pr-12"
              minlength="8"
              maxlength="256"
              required
            />
            <button type="button" class="visibility-button" :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>
          <div v-if="password" class="mt-2">
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs text-slate-400">Força da senha</span>
              <span class="text-xs font-medium" :class="passwordStrength <= 2 ? 'text-red-500' : passwordStrength <= 3 ? 'text-yellow-600' : 'text-green-600'">
                {{ passwordStrengthLabel }}
              </span>
            </div>
            <div class="flex gap-1">
              <div v-for="i in 5" :key="i" class="h-1 flex-1 rounded-full" :class="i <= passwordStrength ? passwordStrengthColor : 'bg-slate-200'"></div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="confirm-password">Confirmar nova senha</label>
          <div class="relative">
            <Lock class="field-icon" />
            <input
              id="confirm-password"
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              placeholder="Digite a nova senha novamente"
              class="input-field pl-12 pr-12"
              minlength="8"
              maxlength="256"
              required
            />
            <button type="button" class="visibility-button" :aria-label="showConfirmPassword ? 'Ocultar confirmação' : 'Mostrar confirmação'" @click="showConfirmPassword = !showConfirmPassword">
              <EyeOff v-if="showConfirmPassword" class="w-5 h-5" />
              <Eye v-else class="w-5 h-5" />
            </button>
          </div>
        </div>

        <button type="submit" :disabled="isLoading || code.length !== 6 || !password || password !== confirmPassword" class="btn-primary w-full group">
          <span v-if="isLoading">Redefinindo...</span>
          <span v-else class="flex items-center justify-center gap-2">
            Redefinir senha
            <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </span>
        </button>

        <button type="button" :disabled="isLoading" class="w-full py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50" @click="requestCode">
          Enviar outro código pelo WhatsApp
        </button>
      </form>

      <div v-else class="space-y-4">
        <NuxtLink to="/auth/login" class="btn-primary flex w-full items-center justify-center gap-2">
          Ir para o login
          <ArrowRight class="w-4 h-4" />
        </NuxtLink>
      </div>

      <div class="mt-6 text-center">
        <NuxtLink to="/auth/login" class="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-800">
          <ArrowLeft class="w-4 h-4" />
          Voltar para o login
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.recovery-card {
  width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.06);
  animation: cardEntry 0.35s ease-out;
}

.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 0.75rem;
  border: 1px solid #c7d2fe;
  border-radius: 0.875rem;
  background: #eef2ff;
}

.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-label { color: #475569; font-size: 0.875rem; font-weight: 600; }
.field-icon { position: absolute; left: 1rem; top: 50%; width: 1.25rem; height: 1.25rem; transform: translateY(-50%); color: #94a3b8; }

.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #f8fafc;
  color: #1e293b;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.input-field.pl-12 { padding-left: 3rem; }
.input-field.pr-12 { padding-right: 3rem; }
.input-field::placeholder { color: #94a3b8; }
.input-field:focus { outline: none; border-color: rgba(99, 102, 241, 0.6); box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); background: #fff; }

.visibility-button { position: absolute; right: 0.75rem; top: 50%; display: inline-flex; transform: translateY(-50%); padding: 0.25rem; color: #64748b; }
.notice { display: flex; gap: 0.65rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.75rem; border: 1px solid; border-radius: 0.75rem; font-size: 0.875rem; }
.notice--success { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
.notice--error { border-color: #fecaca; background: #fef2f2; color: #dc2626; }

.btn-primary {
  position: relative;
  overflow: hidden;
  padding: 0.875rem 1.5rem;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 15px 20px -5px rgba(99, 102, 241, 0.25); }
.btn-primary:disabled { cursor: not-allowed; opacity: 0.55; transform: none; }

@keyframes cardEntry {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

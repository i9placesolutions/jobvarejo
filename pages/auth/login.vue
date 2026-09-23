<script setup lang="ts">
import { Eye, EyeOff, MessageCircle, Lock, ArrowRight, ShieldCheck } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

// Auth composable
const auth = useAuth()

// Form state
const whatsapp = ref('')
const { onInput: maskWhatsAppInput } = useBrazilWhatsAppMask(whatsapp)
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const isRedirecting = ref(false)
const errorMessage = ref('')
const BUSINESS_PROFILE_ONBOARDING_KEY = 'jobvarejo:business-profile-onboarding-pending'

const handleLogin = async () => {
  if (isLoading.value || isRedirecting.value) {
    return
  }

  if (!whatsapp.value || !password.value) {
    errorMessage.value = 'Por favor, preencha todos os campos'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    await auth.signIn(whatsapp.value, password.value)

    // Avoid overlapping Nuxt navigations if the user submits twice.
    isRedirecting.value = true
    const shouldOpenBusinessProfile = typeof window !== 'undefined'
      && window.localStorage.getItem(BUSINESS_PROFILE_ONBOARDING_KEY) === '1'
    if (shouldOpenBusinessProfile) {
      window.localStorage.removeItem(BUSINESS_PROFILE_ONBOARDING_KEY)
      await navigateTo('/business-profile?onboarding=1&returnTo=/', { replace: true })
      return
    }
    await navigateTo('/', { replace: true })
  } catch (error: any) {
    isRedirecting.value = false
    errorMessage.value = error.message || 'Erro ao fazer login. Verifique suas credenciais.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-card" aria-labelledby="login-title">
      <div class="login-card__glow" aria-hidden="true"></div>

      <header class="login-card__header">
        <span class="login-card__icon" aria-hidden="true">
          <ShieldCheck class="h-6 w-6" />
        </span>
        <p class="login-card__eyebrow">Acesso seguro</p>
        <h1 id="login-title">Bem-vindo de volta</h1>
        <p class="login-card__subtitle">Entre na sua conta para continuar</p>
      </header>

      <div v-if="errorMessage" class="login-alert" role="alert" aria-live="polite">
        {{ errorMessage }}
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="login-field">
          <label class="login-label" for="whatsapp">WhatsApp</label>
          <div class="login-input-wrap">
            <MessageCircle class="login-input-icon h-5 w-5" aria-hidden="true" />
            <input
              id="whatsapp"
              :value="whatsapp"
              @input="maskWhatsAppInput"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="(11) 99999-9999"
              class="login-input"
              :class="{ 'login-input--error': errorMessage }"
              :aria-invalid="Boolean(errorMessage)"
              required
            >
          </div>
        </div>

        <div class="login-field">
          <label class="login-label" for="password">Senha</label>
          <div class="login-input-wrap">
            <Lock class="login-input-icon h-5 w-5" aria-hidden="true" />
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              class="login-input login-input--password"
              :class="{ 'login-input--error': errorMessage }"
              :aria-invalid="Boolean(errorMessage)"
              required
            >
            <button
              type="button"
              class="login-password-toggle"
              :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div class="login-forgot-row">
          <NuxtLink to="/auth/forgot-password" class="login-link login-link--muted">
            Esqueceu sua senha?
          </NuxtLink>
        </div>

        <button type="submit" :disabled="isLoading || isRedirecting" class="login-submit">
          <span v-if="isLoading">Entrando...</span>
          <span v-else class="login-submit__content">
            Entrar no JobVarejo
            <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      </form>

      <p class="login-signup">
        Não tem uma conta?
        <NuxtLink to="/auth/register" class="login-link">Criar conta</NuxtLink>
      </p>
      <p class="login-migrate">
        Conta antiga?
        <NuxtLink to="/auth/link-whatsapp" class="login-link">Vincular WhatsApp</NuxtLink>
      </p>
    </section>

    <div class="login-trust" aria-label="Segurança da conta">
      <span class="login-trust__item"><span class="login-trust__status"></span>Conexão segura</span>
      <span class="login-trust__item"><ShieldCheck class="h-4 w-4" aria-hidden="true" />Dados protegidos</span>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  --login-navy: #173d70;
  --login-blue: #2160b4;
  --login-ink: #172b45;
  --login-muted: #60758f;
  --login-line: #d7e4f1;
  width: 100%;
  color: var(--login-ink);
}

.login-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 34px 38px 30px;
  border: 1px solid var(--login-line);
  border-radius: 22px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 22px 56px rgba(26, 68, 113, .11), 0 3px 10px rgba(26, 68, 113, .035);
  backdrop-filter: blur(16px);
  animation: login-card-entry .35s ease-out both;
}

.login-card::before {
  position: absolute;
  z-index: -1;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #173d70, #2160b4 68%, #4b8fc8);
  content: '';
}

.login-card__glow {
  position: absolute;
  z-index: -1;
  top: -154px;
  right: -122px;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(58, 131, 213, .11), transparent 70%);
  pointer-events: none;
}

.login-card__header {
  position: relative;
  margin-bottom: 28px;
  text-align: center;
}

.login-card__icon {
  display: inline-grid;
  width: 54px;
  height: 54px;
  margin-bottom: 16px;
  place-items: center;
  color: var(--login-blue);
  border: 1px solid #c8dcf4;
  border-radius: 16px;
  background: #eaf3ff;
}

.login-card__eyebrow {
  margin: 0 0 7px;
  color: var(--login-blue);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.login-card__header h1 {
  margin: 0;
  color: var(--login-navy);
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -.045em;
  line-height: 1.2;
}

.login-card__subtitle {
  margin: 9px 0 0;
  color: var(--login-muted);
  font-size: 13px;
  line-height: 1.55;
}

.login-alert {
  margin: 0 0 18px;
  padding: 11px 13px;
  color: #a83232;
  border: 1px solid #f0c8c8;
  border-radius: 10px;
  background: #fff6f5;
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
}

.login-form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 17px;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.login-label {
  padding-left: 3px;
  color: #526d8c;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .11em;
  text-transform: uppercase;
}

.login-input-wrap { position: relative; }

.login-input-icon {
  position: absolute;
  top: 50%;
  left: 15px;
  color: #7890ad;
  transform: translateY(-50%);
  pointer-events: none;
}

.login-input-wrap:focus-within .login-input-icon { color: var(--login-blue); }

.login-input {
  width: 100%;
  height: 50px;
  padding: 0 15px 0 46px;
  color: var(--login-ink);
  border: 1px solid var(--login-line);
  border-radius: 11px;
  outline: none;
  background: #f8fbff;
  font: inherit;
  font-size: 13px;
  transition: background-color .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.login-input::placeholder { color: #91a3b9; }
.login-input:hover { border-color: #b9cde4; background: #fff; }

.login-input:focus {
  border-color: var(--login-blue);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(33, 96, 180, .13);
}

.login-input--password { padding-right: 48px; }

.login-input--error,
.login-input--error:focus {
  border-color: #dc7777;
  box-shadow: 0 0 0 3px rgba(220, 119, 119, .12);
}

.login-password-toggle {
  position: absolute;
  top: 50%;
  right: 8px;
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  color: #7890ad;
  border: 0;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  transform: translateY(-50%);
  transition: color .18s ease, background-color .18s ease, box-shadow .18s ease;
}

.login-password-toggle:hover { color: var(--login-blue); background: #eaf3ff; }
.login-password-toggle:focus-visible,
.login-link:focus-visible,
.login-submit:focus-visible { outline: 3px solid rgba(33, 96, 180, .28); outline-offset: 3px; }

.login-forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -4px;
}

.login-link {
  color: var(--login-blue);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  transition: color .18s ease;
}

.login-link:hover { color: #173d70; text-decoration: underline; text-underline-offset: 3px; }
.login-link--muted { color: #627b99; font-weight: 600; }

.login-submit {
  display: flex;
  width: 100%;
  min-height: 50px;
  margin-top: 1px;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 1px solid rgba(23, 61, 112, .1);
  border-radius: 11px;
  background: linear-gradient(100deg, #173d70, #2160b4);
  box-shadow: 0 9px 20px rgba(33, 96, 180, .19);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  transition: transform .18s ease, background-color .18s ease, box-shadow .18s ease, opacity .18s ease;
}

.login-submit:hover:not(:disabled) {
  background: linear-gradient(100deg, #14345f, #1b4f96);
  box-shadow: 0 12px 24px rgba(33, 96, 180, .24);
  transform: translateY(-1px);
}

.login-submit:active:not(:disabled) { transform: translateY(0); }
.login-submit:disabled { cursor: wait; opacity: .66; }

.login-submit__content { display: inline-flex; align-items: center; justify-content: center; gap: 9px; }
.login-submit__content svg { transition: transform .18s ease; }
.login-submit:hover .login-submit__content svg { transform: translateX(3px); }

.login-signup {
  margin: 22px 0 0;
  color: var(--login-muted);
  font-size: 12px;
  text-align: center;
}

.login-signup .login-link { margin-left: 3px; }

.login-migrate {
  margin: 9px 0 0;
  color: #8294aa;
  font-size: 11px;
  text-align: center;
}

.login-migrate .login-link { margin-left: 3px; font-size: 11px; }

.login-trust {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 17px;
  color: #60758f;
  font-size: 11px;
}

.login-trust__item { display: inline-flex; align-items: center; gap: 7px; }
.login-trust__item svg { color: #7390b2; }
.login-trust__status { width: 7px; height: 7px; border-radius: 50%; background: #42a879; }

@keyframes login-card-entry {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 520px) {
  .login-card { padding: 28px 22px 25px; border-radius: 19px; }
  .login-card__header { margin-bottom: 23px; }
  .login-card__header h1 { font-size: 24px; }
  .login-trust { gap: 12px; font-size: 10px; }
}

@media (max-height: 800px) {
  .login-card { padding: 26px clamp(20px, 5vw, 30px) 22px; }
  .login-card__header { margin-bottom: 16px; }
  .login-card__icon { width: 46px; height: 46px; margin-bottom: 8px; border-radius: 14px; }
  .login-card__eyebrow { margin-bottom: 5px; }
  .login-card__subtitle { margin-top: 6px; font-size: 12px; }
  .login-form { gap: 12px; }
  .login-field { gap: 5px; }
  .login-input,
  .login-submit { min-height: 46px; height: 46px; }
  .login-signup { margin-top: 12px; }
  .login-migrate { margin-top: 5px; }
  .login-trust { margin-top: 10px; }
}

@media (max-height: 560px) {
  .login-card { padding-top: 12px; padding-bottom: 14px; }
  .login-card__header { margin-bottom: 10px; }
  .login-card__icon { display: none; }
  .login-card__subtitle { margin-top: 3px; }
  .login-form { gap: 8px; }
  .login-input,
  .login-submit { min-height: 40px; height: 40px; }
  .login-signup { margin-top: 6px; }
  .login-migrate { margin-top: 3px; }
  .login-trust { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .login-card { animation: none; }
  .login-input,
  .login-password-toggle,
  .login-link,
  .login-submit { transition: none; }
}
</style>

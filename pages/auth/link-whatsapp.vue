<script setup lang="ts">
import { ArrowLeft, ArrowRight, Lock, Mail, MessageCircle, ShieldCheck } from 'lucide-vue-next'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

definePageMeta({
  layout: 'auth'
})

const email = ref('')
const password = ref('')
const whatsapp = ref('')
const { onInput: maskWhatsAppInput } = useBrazilWhatsAppMask(whatsapp)
const whatsappCode = ref('')
const isCodeSent = ref(false)
const isRequestingCode = ref(false)
const isLoading = ref(false)
const isLinked = ref(false)
const errorMessage = ref('')

watch(whatsapp, () => {
  isCodeSent.value = false
  whatsappCode.value = ''
})

const requestCode = async () => {
  if (isRequestingCode.value || isLoading.value) return
  errorMessage.value = ''

  const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp.value)
  if (!email.value.trim() || !password.value || !normalizedWhatsApp) {
    errorMessage.value = 'Informe o e-mail, a senha atual e um WhatsApp válido com DDD.'
    return
  }

  isRequestingCode.value = true
  try {
    await $fetch('/api/auth/whatsapp-code', {
      method: 'POST',
      body: {
        purpose: 'link',
        email: email.value,
        password: password.value,
        whatsapp: normalizedWhatsApp
      }
    })
    whatsappCode.value = ''
    isCodeSent.value = true
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Não foi possível enviar o código pelo WhatsApp.'
  } finally {
    isRequestingCode.value = false
  }
}

const linkWhatsApp = async () => {
  if (isLoading.value || isLinked.value) return
  errorMessage.value = ''

  const normalizedWhatsApp = normalizeBrazilWhatsApp(whatsapp.value)
  if (!email.value.trim() || !password.value || !normalizedWhatsApp || !/^\d{6}$/.test(whatsappCode.value.trim())) {
    errorMessage.value = 'Confira seus dados e informe o código de seis dígitos enviado ao WhatsApp.'
    return
  }

  isLoading.value = true
  try {
    await $fetch('/api/auth/link-whatsapp', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        whatsapp: normalizedWhatsApp,
        whatsapp_code: whatsappCode.value.trim()
      }
    })
    isLinked.value = true
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.message || 'Não foi possível vincular este WhatsApp.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md px-1 py-4 sm:py-6">
    <section class="overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 shadow-[0_22px_56px_rgba(26,68,113,.11)]">
      <div class="h-1 bg-gradient-to-r from-[#173d70] via-[#2160b4] to-[#4b8fc8]"></div>

      <div class="p-6 sm:p-8">
        <header class="mb-6 text-center">
          <span class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-blue-200 bg-blue-50 text-[#2160b4]">
            <ShieldCheck class="h-6 w-6" aria-hidden="true" />
          </span>
          <p class="mb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2160b4]">Migração segura da conta</p>
          <h1 class="text-2xl font-bold tracking-tight text-[#173d70]">Vincule seu WhatsApp</h1>
          <p class="mt-2 text-sm leading-relaxed text-slate-500">
            Confirme sua conta com o e-mail e a senha atuais. Sua senha será mantida; depois você entrará com WhatsApp + senha.
          </p>
        </header>

        <div v-if="isLinked" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center" role="status">
          <p class="text-sm font-semibold text-emerald-800">WhatsApp confirmado e vinculado à sua conta.</p>
          <NuxtLink to="/auth/login" class="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#173d70] px-4 text-sm font-semibold text-white hover:bg-[#2160b4]">
            Entrar com WhatsApp <ArrowRight class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
        </div>

        <template v-else>
          <div v-if="errorMessage" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center text-sm text-red-700" role="alert" aria-live="polite">
            {{ errorMessage }}
          </div>

          <form class="space-y-4" @submit.prevent="linkWhatsApp">
            <label class="block space-y-1.5">
              <span class="block pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">E-mail atual da conta</span>
              <span class="relative block">
                <Mail class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input v-model="email" type="email" autocomplete="username" required placeholder="seu@email.com" class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
              </span>
            </label>

            <label class="block space-y-1.5">
              <span class="block pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Senha atual</span>
              <span class="relative block">
                <Lock class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input v-model="password" type="password" autocomplete="current-password" required placeholder="Sua senha atual" class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
              </span>
            </label>

            <label class="block space-y-1.5">
              <span class="block pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Novo identificador de WhatsApp</span>
              <span class="relative block">
                <MessageCircle class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input :value="whatsapp" @input="maskWhatsAppInput" type="tel" inputmode="tel" autocomplete="tel" required placeholder="(11) 99999-9999" class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
              </span>
            </label>

            <button type="button" :disabled="isRequestingCode || isLoading" class="min-h-10 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-[#2160b4] transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-50" @click="requestCode">
              {{ isRequestingCode ? 'Enviando código...' : isCodeSent ? 'Reenviar código pelo WhatsApp' : 'Enviar código de confirmação' }}
            </button>

            <label class="block space-y-1.5">
              <span class="block pl-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Código de seis dígitos</span>
              <input v-model="whatsappCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required placeholder="000000" class="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-center text-lg tracking-[.35em] text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100">
              <span class="block text-xs text-slate-500">Se o código chegou, digite-o aqui. Ele expira em 10 minutos e só pode ser usado uma vez.</span>
            </label>

            <button type="submit" :disabled="isLoading || !/^\d{6}$/.test(whatsappCode.trim())" class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#173d70] to-[#2160b4] text-sm font-bold text-white shadow-lg shadow-blue-900/10 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              {{ isLoading ? 'Confirmando...' : 'Vincular e manter minha senha' }}
              <ArrowRight v-if="!isLoading" class="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </template>

        <NuxtLink to="/auth/login" class="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-[#2160b4]">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" /> Voltar ao login
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

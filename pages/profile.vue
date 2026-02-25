<script setup lang="ts">
import { Sparkles, LayoutGrid, User, Mail, Shield, CalendarDays, LogOut, RefreshCw } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false,
})

const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()

const profile = ref<any>(null)
const isLoading = ref(true)
const loadError = ref('')
const profileLoadedAt = ref<string | null>(null)

const displayName = computed(() => {
  const profileName = String(profile.value?.name || '').trim()
  if (profileName) return profileName
  const authName = String(auth.user.value?.user_metadata?.name || '').trim()
  if (authName) return authName
  const email = String(profile.value?.email || auth.user.value?.email || '').trim()
  return (email.split('@')[0] || 'Usuario').trim()
})

const displayEmail = computed(() => {
  return String(profile.value?.email || auth.user.value?.email || 'Sem e-mail')
})

const displayRole = computed(() => {
  return String(profile.value?.role || auth.user.value?.role || 'user')
})

const avatarUrl = computed(() => String(profile.value?.avatar_url || auth.user.value?.user_metadata?.avatar_url || '').trim())
const avatarInitial = computed(() => displayName.value.charAt(0)?.toUpperCase() || 'U')

const formatDate = (value: string | null | undefined, withTime = false): string => {
  if (!value) return 'Nao informado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nao informado'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date)
}

const joinedAt = computed(() => formatDate(profile.value?.created_at))
const refreshedAt = computed(() => formatDate(profileLoadedAt.value, true))

const handleSignOut = async () => {
  await auth.signOut()
}

const loadProfile = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    await auth.getSession()
    const headers = await getApiAuthHeaders()
    profile.value = await $fetch('/api/profile', { headers })
    profileLoadedAt.value = new Date().toISOString()
  } catch (error: any) {
    loadError.value = String(error?.data?.statusMessage || error?.message || 'Nao foi possivel carregar seu perfil.')
  } finally {
    isLoading.value = false
  }
}

watch(
  () => auth.user.value?.id || null,
  async (userId) => {
    if (!userId) {
      profile.value = null
      isLoading.value = false
      loadError.value = 'Sessao nao encontrada.'
      return
    }
    await loadProfile()
  },
  { immediate: true },
)
</script>

<template>
  <div class="dashboard-root h-screen overflow-hidden bg-[#09090d] text-white flex flex-col">
    <header class="dashboard-header h-14 px-6 border-b border-white/12 bg-[#15141d]/95 flex items-center justify-between shrink-0 backdrop-blur-sm sticky top-0 z-30">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center border border-violet-400/35 bg-linear-to-br from-violet-500/35 to-fuchsia-500/20 shadow-[0_10px_20px_-10px_rgba(168,85,247,0.45)]">
          <Sparkles class="w-4 h-4 text-violet-200" />
        </div>
        <span class="text-sm font-semibold tracking-wide text-white">Studio PRO</span>
      </div>

      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-linear-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
          <span v-else>{{ avatarInitial }}</span>
        </div>
      </div>
    </header>

    <div class="relative z-10 flex-1 flex overflow-hidden min-h-0">
      <aside class="w-64 h-full min-h-0 border-r border-white/12 bg-[#13131d]/95 flex flex-col shrink-0 backdrop-blur overflow-hidden">
        <div class="h-12 px-3 border-b border-white/12 flex items-center gap-2 shrink-0">
          <div class="w-7 h-7 bg-linear-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <span class="text-xs font-medium text-white truncate">{{ displayName }}</span>
        </div>

        <div class="p-2 border-b border-white/12">
          <button
            @click="navigateTo('/')"
            class="w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 mb-1 border border-transparent text-zinc-300 hover:text-white hover:bg-white/5"
            aria-label="Abrir dashboard"
          >
            <LayoutGrid class="w-4 h-4" />
            Dashboard
          </button>
          <button
            class="w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 border border-white/20 text-white bg-white/10"
            aria-current="page"
            aria-label="Tela de perfil"
          >
            <User class="w-4 h-4" />
            Meu Perfil
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-3">
          <div class="rounded-xl border border-white/10 bg-white/5 p-3">
            <p class="text-[10px] uppercase tracking-[0.14em] text-zinc-500 mb-2">Conta</p>
            <p class="text-xs text-zinc-200 leading-relaxed">
              Gerencie os dados da sua conta e acompanhe as informacoes do acesso atual.
            </p>
          </div>
        </div>

        <div class="p-3 border-t border-white/5 shrink-0 mt-auto">
          <button
            @click="handleSignOut"
            class="w-full h-9 px-3 bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
            title="Sair"
          >
            <LogOut class="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto bg-[#09090d] px-6 py-6">
        <div class="max-w-5xl mx-auto">
          <p class="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium mb-2">Conta</p>
          <h1 class="text-[1.95rem] leading-tight font-medium text-white mb-1 tracking-tight">Meu Perfil</h1>
          <p class="text-xs text-zinc-400 leading-relaxed">Dados principais da sua conta no sistema.</p>

          <div v-if="isLoading" class="mt-6 grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-[#171727] p-5 animate-pulse">
              <div class="w-20 h-20 rounded-full bg-white/10 mb-4"></div>
              <div class="h-4 w-40 bg-white/10 rounded mb-2"></div>
              <div class="h-3 w-56 bg-white/10 rounded"></div>
            </div>
            <div class="rounded-2xl border border-white/10 bg-[#171727] p-5 animate-pulse">
              <div class="h-4 w-32 bg-white/10 rounded mb-4"></div>
              <div class="space-y-3">
                <div class="h-3 w-full bg-white/10 rounded"></div>
                <div class="h-3 w-full bg-white/10 rounded"></div>
                <div class="h-3 w-3/4 bg-white/10 rounded"></div>
              </div>
            </div>
          </div>

          <div v-else-if="loadError" class="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5">
            <p class="text-sm text-red-200 mb-3">{{ loadError }}</p>
            <button
              type="button"
              @click="loadProfile"
              class="h-9 px-4 rounded-lg bg-red-500/25 hover:bg-red-500/35 text-red-100 text-xs font-medium inline-flex items-center gap-2 transition-all"
            >
              <RefreshCw class="w-4 h-4" />
              Tentar novamente
            </button>
          </div>

          <div v-else class="mt-6 grid gap-4 md:grid-cols-3">
            <section class="md:col-span-1 rounded-2xl border border-white/10 bg-[#171727] p-5">
              <div class="w-20 h-20 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-semibold text-white overflow-hidden mb-4">
                <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
                <span v-else>{{ avatarInitial }}</span>
              </div>
              <p class="text-lg font-semibold text-white">{{ displayName }}</p>
              <p class="text-xs text-zinc-400 mt-1">{{ displayEmail }}</p>
              <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <Shield class="w-3.5 h-3.5 text-zinc-300" />
                <span class="text-[11px] uppercase tracking-wide text-zinc-300">{{ displayRole }}</span>
              </div>
            </section>

            <section class="md:col-span-2 rounded-2xl border border-white/10 bg-[#171727] p-5">
              <p class="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mb-4">Informacoes da conta</p>
              <div class="space-y-3">
                <div class="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                  <User class="w-4 h-4 text-zinc-400" />
                  <div>
                    <p class="text-[11px] text-zinc-500">Nome</p>
                    <p class="text-sm text-zinc-100">{{ displayName }}</p>
                  </div>
                </div>
                <div class="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                  <Mail class="w-4 h-4 text-zinc-400" />
                  <div>
                    <p class="text-[11px] text-zinc-500">E-mail</p>
                    <p class="text-sm text-zinc-100">{{ displayEmail }}</p>
                  </div>
                </div>
                <div class="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3">
                  <CalendarDays class="w-4 h-4 text-zinc-400" />
                  <div>
                    <p class="text-[11px] text-zinc-500">Cadastro</p>
                    <p class="text-sm text-zinc-100">{{ joinedAt }}</p>
                  </div>
                </div>
              </div>
              <p class="text-[11px] text-zinc-500 mt-4">Atualizado em {{ refreshedAt }}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-root {
  background:
    radial-gradient(circle at 16% 8%, rgba(168, 85, 247, 0.09), transparent 38%),
    radial-gradient(circle at 82% 14%, rgba(129, 140, 248, 0.06), transparent 36%),
    #09090d;
}

.dashboard-root::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(130deg, rgba(255, 255, 255, 0.03) 0.5px, transparent 0.5px) 0 0 / 48px 48px,
    linear-gradient(240deg, rgba(255, 255, 255, 0.02) 0.5px, transparent 0.5px) 0 0 / 96px 96px;
  opacity: 0.35;
}

button:focus-visible {
  outline: 1px solid rgba(167, 139, 250, 0.7);
  outline-offset: 2px;
}
</style>

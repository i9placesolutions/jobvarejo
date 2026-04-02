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
  <div class="dashboard-root h-screen w-screen overflow-hidden p-3 md:p-5 flex flex-col">
    <!-- Floating Glassmorphism Window -->
    <div class="flex-1 w-full h-full max-w-[1920px] mx-auto overflow-hidden bg-white backdrop-blur-3xl border border-slate-200 rounded-[2rem] shadow-xl shadow-black/5 flex flex-col relative z-20 ring-1 ring-slate-100">
      <header class="dashboard-header h-16 px-8 border-b border-slate-200 bg-transparent flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center border border-violet-400/40 bg-linear-to-br from-violet-500/40 to-fuchsia-500/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <Sparkles class="w-4 h-4 text-violet-100" />
          </div>
          <span class="text-base font-bold tracking-tight text-slate-800 drop-shadow-sm">Studio PRO</span>
      </div>

      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-linear-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
          <span v-else>{{ avatarInitial }}</span>
        </div>
      </div>
    </header>

      <div class="dashboard-layout relative flex-1 flex overflow-hidden min-h-0">
        <aside class="w-72 h-full min-h-0 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 overflow-hidden relative z-10 transition-all duration-300 backdrop-blur-md">
          <div class="h-12 px-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <div class="w-7 h-7 bg-linear-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden">
            <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
            <span v-else>{{ avatarInitial }}</span>
          </div>
          <span class="text-xs font-medium text-slate-800 truncate">{{ displayName }}</span>
        </div>

        <div class="p-2 border-b border-slate-200">
          <button
            @click="navigateTo('/')"
            class="w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 mb-1 border border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            aria-label="Abrir dashboard"
          >
            <LayoutGrid class="w-4 h-4" />
            Dashboard
          </button>
          <button
            class="w-full h-9 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-2.5 border border-slate-200 text-slate-800 bg-slate-100"
            aria-current="page"
            aria-label="Tela de perfil"
          >
            <User class="w-4 h-4" />
            Meu Perfil
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-3">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p class="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-2">Conta</p>
            <p class="text-xs text-slate-600 leading-relaxed">
              Gerencie os dados da sua conta e acompanhe as informacoes do acesso atual.
            </p>
          </div>
        </div>

        <div class="p-3 border-t border-slate-200 shrink-0 mt-auto">
          <button
            @click="handleSignOut"
            class="w-full h-9 px-3 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
            title="Sair"
          >
            <LogOut class="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

        <!-- Section Title -->
        <main class="dashboard-main flex-1 overflow-y-auto bg-transparent px-8 pt-8 pb-4 relative z-10">
          <div class="max-w-5xl mx-auto">
            <p class="text-[11px] uppercase tracking-[0.2em] text-indigo-500 font-semibold mb-2 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Conta
            </p>
            <h1 class="text-4xl leading-tight font-bold text-slate-800 mb-2 tracking-tight drop-shadow-sm">Meu Perfil</h1>
          <p class="text-xs text-slate-500 leading-relaxed">Dados principais da sua conta no sistema.</p>

          <div v-if="isLoading" class="mt-6 grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
              <div class="w-20 h-20 rounded-full bg-slate-100 mb-4"></div>
              <div class="h-4 w-40 bg-slate-100 rounded mb-2"></div>
              <div class="h-3 w-56 bg-slate-100 rounded"></div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-5 animate-pulse">
              <div class="h-4 w-32 bg-slate-100 rounded mb-4"></div>
              <div class="space-y-3">
                <div class="h-3 w-full bg-slate-100 rounded"></div>
                <div class="h-3 w-full bg-slate-100 rounded"></div>
                <div class="h-3 w-3/4 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>

          <div v-else-if="loadError" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p class="text-sm text-red-600 mb-3">{{ loadError }}</p>
            <button
              type="button"
              @click="loadProfile"
              class="h-9 px-4 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-medium inline-flex items-center gap-2 transition-all"
            >
              <RefreshCw class="w-4 h-4" />
              Tentar novamente
            </button>
          </div>

          <div v-else class="mt-6 grid gap-4 md:grid-cols-3">
            <section class="md:col-span-1 rounded-2xl border border-slate-200 bg-white backdrop-blur-sm p-5 shadow-xs">
              <div class="w-20 h-20 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-semibold text-white overflow-hidden mb-4">
                <img v-if="avatarUrl" :src="avatarUrl" :alt="displayName" class="w-full h-full object-cover" />
                <span v-else>{{ avatarInitial }}</span>
              </div>
              <p class="text-lg font-semibold text-slate-800">{{ displayName }}</p>
              <p class="text-xs text-slate-500 mt-1">{{ displayEmail }}</p>
              <div class="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <Shield class="w-3.5 h-3.5 text-slate-600" />
                <span class="text-[11px] uppercase tracking-wide text-slate-600">{{ displayRole }}</span>
              </div>
            </section>

            <section class="md:col-span-2 rounded-2xl border border-slate-200 bg-white backdrop-blur-sm p-5 shadow-xs">
              <p class="text-[11px] uppercase tracking-[0.14em] text-slate-400 mb-4">Informacoes da conta</p>
              <div class="space-y-3">
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                  <User class="w-4 h-4 text-slate-400" />
                  <div>
                    <p class="text-[11px] text-slate-400">Nome</p>
                    <p class="text-sm text-slate-700">{{ displayName }}</p>
                  </div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                  <Mail class="w-4 h-4 text-slate-400" />
                  <div>
                    <p class="text-[11px] text-slate-400">E-mail</p>
                    <p class="text-sm text-slate-700">{{ displayEmail }}</p>
                  </div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
                  <CalendarDays class="w-4 h-4 text-slate-400" />
                  <div>
                    <p class="text-[11px] text-slate-400">Cadastro</p>
                    <p class="text-sm text-slate-700">{{ joinedAt }}</p>
                  </div>
                </div>
              </div>
              <p class="text-[11px] text-slate-400 mt-4">Atualizado em {{ refreshedAt }}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
    </div> <!-- End of Floating Glassmorphism Window -->
  </div>
</template>

<style scoped>
.dashboard-root {
  background: #f8f9fb;
}

button:focus-visible {
  outline: 1px solid rgba(99, 102, 241, 0.7);
  outline-offset: 2px;
}
</style>

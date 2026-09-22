<script setup lang="ts">
import {
  Check,
  ExternalLink,
  FileAudio,
  LoaderCircle,
  LockKeyhole,
  Mic2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type Voice = {
  id: string
  name: string
  description?: string | null
  gender: 'female' | 'male'
  stationId?: string | null
  sampleContentType?: string
  sampleSizeBytes?: number
  consentStatus?: string
  status?: string
  sampleUrl?: string | null
  createdAt?: string | null
  cloneReady?: boolean
}

const voices = ref<Voice[]>([])
const provider = ref<{ configured: boolean; ttsConfigured: boolean; webhookConfigured: boolean }>({
  configured: false,
  ttsConfigured: false,
  webhookConfigured: false
})
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const sampleFile = ref<File | null>(null)
const form = reactive({
  name: '',
  description: '',
  gender: 'female',
  consentConfirmed: false,
  shareAllStations: true
})

const formatSize = (bytes: number | undefined) => {
  const value = Number(bytes || 0)
  if (!value) return '—'
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const loadVoices = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/musicgpt/voices', { headers })
    voices.value = Array.isArray(data?.items) ? data.items : []
    provider.value = data?.provider || provider.value
  } catch (cause: any) {
    error.value = String(cause?.data?.statusMessage || cause?.data?.message || cause?.message || 'Falha ao carregar o banco de vozes')
  } finally {
    isLoading.value = false
  }
}

const onFileChange = (event: Event) => {
  sampleFile.value = (event.target as HTMLInputElement).files?.[0] || null
}

const saveVoice = async () => {
  error.value = null
  notice.value = null
  if (!form.name.trim() || !sampleFile.value) {
    error.value = 'Informe o nome e envie uma amostra de áudio.'
    return
  }
  if (!form.consentConfirmed) {
    error.value = 'Confirme que existe autorização para clonar esta voz.'
    return
  }
  if (sampleFile.value.size > 25 * 1024 * 1024) {
    error.value = 'A amostra precisa ter no máximo 25 MB.'
    return
  }
  isSaving.value = true
  try {
    const body = new FormData()
    body.append('name', form.name.trim())
    body.append('description', form.description.trim())
    body.append('gender', form.gender)
    body.append('consentConfirmed', 'true')
    body.append('shareAllStations', String(form.shareAllStations))
    body.append('file', sampleFile.value)
    const headers = await getApiAuthHeaders()
    await $fetch('/api/admin/musicgpt/voices', { method: 'POST', body, headers })
    form.name = ''
    form.description = ''
    form.consentConfirmed = false
    sampleFile.value = null
    const input = document.querySelector<HTMLInputElement>('#musicgpt-voice-sample')
    if (input) input.value = ''
    notice.value = 'Voz cadastrada e liberada para as lojas da conta.'
    await loadVoices()
  } catch (cause: any) {
    error.value = String(cause?.data?.statusMessage || cause?.data?.message || cause?.message || 'Não foi possível salvar a voz')
  } finally {
    isSaving.value = false
  }
}

const revokeVoice = async (voice: Voice) => {
  if (!voice.id || voice.status === 'revoked') return
  error.value = null
  notice.value = null
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/musicgpt/voices/${encodeURIComponent(voice.id)}`, {
      method: 'PATCH',
      body: { action: 'revoke' },
      headers
    })
    notice.value = `A voz “${voice.name}” foi revogada e não será usada em novas locuções.`
    await loadVoices()
  } catch (cause: any) {
    error.value = String(cause?.data?.statusMessage || cause?.data?.message || cause?.message || 'Não foi possível revogar a voz')
  }
}

onMounted(loadVoices)
</script>

<template>
  <AdminWorkspaceShell active-nav="musicgpt">
    <div class="admin-page">
      <div class="admin-page__inner">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="rounded-xl border border-[color:var(--jv-line)] bg-[color:var(--jv-sky)] p-3 text-[color:var(--jv-blue)]">
              <Mic2 class="h-6 w-6" />
            </div>
            <div>
              <p class="admin-page__eyebrow">Configuração · MusicGPT</p>
              <h1 class="admin-page__title">Banco de vozes</h1>
              <p class="admin-page__lead">
                A amostra pode ter trilha: o servidor isola a fala no clip de clone. Off/locução usam só a voz clonada; jingle/música pedem trilha nova ao MusicGPT.
              </p>
            </div>
          </div>
          <div
            class="admin-badge"
            :class="provider.configured && provider.ttsConfigured ? 'admin-badge--ok' : 'admin-badge--warn'"
          >
            <span
              class="mr-1.5 h-2 w-2 rounded-full"
              :class="provider.configured && provider.ttsConfigured ? 'bg-emerald-500' : 'bg-amber-500'"
            />
            {{ provider.configured && provider.ttsConfigured ? 'MusicGPT pronto para locuções' : 'Configure o MusicGPT no servidor' }}
          </div>
        </div>

        <div v-if="error" class="admin-alert admin-alert--error mt-7"><X class="mt-0.5 h-4 w-4 shrink-0" />{{ error }}</div>
        <div v-if="notice" class="admin-alert admin-alert--success mt-7"><Check class="mt-0.5 h-4 w-4 shrink-0" />{{ notice }}</div>

        <div class="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section class="admin-card admin-card--pad">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-[color:var(--jv-navy)]">Adicionar voz clonada</h2>
                <p class="mt-1 text-xs leading-5 text-[color:var(--jv-muted)]">
                  Pode enviar locução com fundo musical: isolamos a fala para o clone. A trilha do produto final é gerada pelo MusicGPT.
                </p>
              </div>
              <FileAudio class="h-5 w-5 text-[color:var(--jv-blue)]" />
            </div>
            <div class="mt-5 space-y-4">
              <label class="block text-xs font-semibold text-[color:var(--jv-muted)]">
                Nome da voz
                <input v-model="form.name" class="admin-input mt-1.5" placeholder="Ex.: Voz principal do JobVarejo" />
              </label>
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="block text-xs font-semibold text-[color:var(--jv-muted)]">
                  Gênero
                  <select v-model="form.gender" class="admin-select mt-1.5">
                    <option value="female">Feminina</option>
                    <option value="male">Masculina</option>
                  </select>
                </label>
                <label class="block text-xs font-semibold text-[color:var(--jv-muted)]">
                  Amostra
                  <input
                    id="musicgpt-voice-sample"
                    type="file"
                    accept="audio/*"
                    class="admin-input mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-[color:var(--jv-sky)] file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--jv-blue)]"
                    @change="onFileChange"
                  />
                </label>
              </div>
              <label class="block text-xs font-semibold text-[color:var(--jv-muted)]">
                Descrição (opcional)
                <input v-model="form.description" class="admin-input mt-1.5" placeholder="Ex.: tom comercial e energético" />
              </label>
              <label class="admin-alert admin-alert--warning !items-start gap-2 text-xs">
                <input v-model="form.consentConfirmed" type="checkbox" class="mt-0.5 accent-[color:var(--jv-blue)]" />
                <span>Confirmo que tenho autorização da pessoa representada na amostra para criar e usar esta voz clonada no JobVarejo.</span>
              </label>
              <label class="flex items-start gap-2 text-xs leading-5 text-[color:var(--jv-muted)]">
                <input v-model="form.shareAllStations" type="checkbox" class="mt-0.5 accent-[color:var(--jv-blue)]" />
                <span>Disponibilizar para todas as lojas da conta.</span>
              </label>
              <button class="admin-btn admin-btn--primary w-full" :disabled="isSaving" @click="saveVoice">
                <LoaderCircle v-if="isSaving" class="h-4 w-4 animate-spin" />
                <Sparkles v-else class="h-4 w-4" />
                {{ isSaving ? 'Salvando…' : 'Salvar no banco de vozes' }}
              </button>
            </div>
            <div class="mt-5 flex items-start gap-2 text-[11px] leading-5 text-[color:var(--jv-muted)]">
              <LockKeyhole class="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--jv-blue)]" />
              A amostra é privada no Wasabi. O servidor gera apenas uma URL temporária quando o MusicGPT precisa sintetizar a locução.
            </div>
          </section>

          <section class="admin-card admin-card--pad">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-[color:var(--jv-navy)]">Vozes cadastradas</h2>
                <p class="mt-1 text-xs text-[color:var(--jv-muted)]">{{ voices.length }} voz(es) no banco deste administrador</p>
              </div>
              <button class="admin-btn admin-btn--secondary !min-h-9 !px-2.5" title="Atualizar" @click="loadVoices">
                <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
              </button>
            </div>

            <div v-if="isLoading && !voices.length" class="flex min-h-48 items-center justify-center text-sm text-[color:var(--jv-muted)]">
              <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />Carregando banco…
            </div>
            <div v-else-if="voices.length" class="mt-5 space-y-3">
              <article v-for="voice in voices" :key="voice.id" class="rounded-xl border border-[color:var(--jv-line)] bg-[#f7fbff] p-3">
                <div class="flex items-start gap-3">
                  <div class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--jv-sky)] text-[color:var(--jv-blue)]">
                    <Mic2 class="h-5 w-5" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <strong class="truncate text-sm text-[color:var(--jv-navy)]">{{ voice.name }}</strong>
                      <span class="admin-badge" :class="voice.status === 'active' ? 'admin-badge--ok' : 'admin-badge--danger'">
                        {{ voice.status === 'active' ? 'Ativa' : 'Revogada' }}
                      </span>
                      <span v-if="voice.cloneReady" class="admin-badge admin-badge--info">Clone pronto</span>
                      <span v-else-if="voice.status === 'active'" class="admin-badge admin-badge--warn">Clip pendente</span>
                    </div>
                    <p class="mt-1 text-xs text-[color:var(--jv-muted)]">
                      {{ voice.gender === 'male' ? 'Masculina' : 'Feminina' }} · {{ voice.stationId ? 'Loja específica' : 'Todas as lojas' }} · {{ formatSize(voice.sampleSizeBytes) }}
                    </p>
                    <p v-if="voice.description" class="mt-1 truncate text-xs text-slate-500">{{ voice.description }}</p>
                  </div>
                </div>
                <div v-if="voice.status === 'active'" class="mt-3 flex flex-wrap items-center gap-2">
                  <audio v-if="voice.sampleUrl" :src="voice.sampleUrl" controls preload="none" class="h-8 min-w-0 flex-1" />
                  <button class="admin-btn admin-btn--danger !min-h-8 !text-xs" @click="revokeVoice(voice)">
                    <ShieldCheck class="h-3.5 w-3.5" /> Revogar
                  </button>
                </div>
              </article>
            </div>
            <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-[color:var(--jv-muted)]">
              <Mic2 class="h-8 w-8 text-slate-300" />
              <span>Nenhuma voz cadastrada ainda.</span>
            </div>
            <NuxtLink to="/radio-indoor" class="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--jv-blue)] hover:underline">
              <ExternalLink class="h-3.5 w-3.5" /> Ver como o usuário escolhe a voz
            </NuxtLink>
          </section>
        </div>
      </div>
    </div>
  </AdminWorkspaceShell>
</template>

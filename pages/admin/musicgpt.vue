<script setup lang="ts">
import {
  ArrowLeft,
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
  <div class="min-h-screen bg-[#0c0b12] text-zinc-100">
    <div class="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <NuxtLink to="/admin/builder" class="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft class="h-4 w-4" /> Voltar ao painel Admin
          </NuxtLink>
          <div class="mt-8 flex items-start gap-3">
            <div class="rounded-xl border border-violet-400/25 bg-violet-400/10 p-3 text-violet-200"><Mic2 class="h-6 w-6" /></div>
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">MusicGPT</p>
              <h1 class="mt-1 text-3xl font-semibold tracking-tight">Banco de vozes</h1>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Cadastre aqui as vozes autorizadas. Use amostra só de fala (~20–60s), sem música de fundo — o servidor gera um clip de ~18s otimizado para o MusicGPT clonar de verdade.</p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 rounded-full border px-3 py-2 text-xs" :class="provider.configured && provider.ttsConfigured ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'">
          <span class="h-2 w-2 rounded-full" :class="provider.configured && provider.ttsConfigured ? 'bg-emerald-300' : 'bg-amber-300'" />
          {{ provider.configured && provider.ttsConfigured ? 'MusicGPT pronto para locuções' : 'Configure o MusicGPT no servidor' }}
        </div>
      </div>

      <div v-if="error" class="mt-7 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200"><X class="mt-0.5 h-4 w-4 shrink-0" />{{ error }}</div>
      <div v-if="notice" class="mt-7 flex items-start gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-200"><Check class="mt-0.5 h-4 w-4 shrink-0" />{{ notice }}</div>

      <div class="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section class="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3">
            <div><h2 class="font-medium text-white">Adicionar voz clonada</h2><p class="mt-1 text-xs leading-5 text-zinc-500">Preferência: uma pessoa falando sozinha, ambiente quieto, MP3/WAV. Evite vinheta com música — o MusicGPT recomenda amostra sem trilha.</p></div>
            <FileAudio class="h-5 w-5 text-violet-300" />
          </div>
          <div class="mt-5 space-y-4">
            <label class="block text-xs text-zinc-400">Nome da voz<input v-model="form.name" class="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none ring-violet-400/40 focus:ring-2" placeholder="Ex.: Voz principal do JobVarejo" /></label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-xs text-zinc-400">Gênero<select v-model="form.gender" class="mt-1.5 w-full rounded-lg border border-white/10 bg-[#15131d] px-3 py-2.5 text-sm text-white outline-none ring-violet-400/40 focus:ring-2"><option value="female">Feminina</option><option value="male">Masculina</option></select></label>
              <label class="block text-xs text-zinc-400">Amostra<input id="musicgpt-voice-sample" type="file" accept="audio/*" class="mt-1.5 block w-full rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-2 text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-violet-400/15 file:px-2 file:py-1.5 file:text-xs file:text-violet-200" @change="onFileChange" /></label>
            </div>
            <label class="block text-xs text-zinc-400">Descrição (opcional)<input v-model="form.description" class="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none ring-violet-400/40 focus:ring-2" placeholder="Ex.: tom comercial e energético" /></label>
            <label class="flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-zinc-300"><input v-model="form.consentConfirmed" type="checkbox" class="mt-1 accent-violet-400" /><span>Confirmo que tenho autorização da pessoa representada na amostra para criar e usar esta voz clonada no JobVarejo.</span></label>
            <label class="flex items-start gap-2 text-xs leading-5 text-zinc-400"><input v-model="form.shareAllStations" type="checkbox" class="mt-1 accent-violet-400" /><span>Disponibilizar para todas as lojas da conta.</span></label>
            <button class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isSaving" @click="saveVoice"><LoaderCircle v-if="isSaving" class="h-4 w-4 animate-spin" /><Sparkles v-else class="h-4 w-4" /> {{ isSaving ? 'Salvando…' : 'Salvar no banco de vozes' }}</button>
          </div>
          <div class="mt-5 flex items-start gap-2 text-[11px] leading-5 text-zinc-500"><LockKeyhole class="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />A amostra é privada no Wasabi. O servidor gera apenas uma URL temporária quando o MusicGPT precisa sintetizar a locução.</div>
        </section>

        <section class="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div class="flex items-start justify-between gap-3"><div><h2 class="font-medium text-white">Vozes cadastradas</h2><p class="mt-1 text-xs text-zinc-500">{{ voices.length }} voz(es) no banco deste administrador</p></div><button class="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:border-white/20 hover:text-white" title="Atualizar" @click="loadVoices"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" /></button></div>
          <div v-if="isLoading && !voices.length" class="flex min-h-48 items-center justify-center text-sm text-zinc-500"><LoaderCircle class="mr-2 h-4 w-4 animate-spin" />Carregando banco…</div>
          <div v-else-if="voices.length" class="mt-5 space-y-3">
            <article v-for="voice in voices" :key="voice.id" class="rounded-xl border border-white/8 bg-black/15 p-3">
              <div class="flex items-start gap-3"><div class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-400/10 text-violet-200"><Mic2 class="h-5 w-5" /></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><strong class="truncate text-sm text-white">{{ voice.name }}</strong><span class="rounded-full border px-2 py-0.5 text-[10px]" :class="voice.status === 'active' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-red-400/20 bg-red-400/10 text-red-200'">{{ voice.status === 'active' ? 'Ativa' : 'Revogada' }}</span><span v-if="voice.cloneReady" class="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] text-sky-200">Clone pronto</span><span v-else-if="voice.status === 'active'" class="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">Clip pendente</span></div><p class="mt-1 text-xs text-zinc-500">{{ voice.gender === 'male' ? 'Masculina' : 'Feminina' }} · {{ voice.stationId ? 'Loja específica' : 'Todas as lojas' }} · {{ formatSize(voice.sampleSizeBytes) }}</p><p v-if="voice.description" class="mt-1 truncate text-xs text-zinc-400">{{ voice.description }}</p></div></div>
              <div v-if="voice.status === 'active'" class="mt-3 flex flex-wrap items-center gap-2"><audio v-if="voice.sampleUrl" :src="voice.sampleUrl" controls preload="none" class="h-8 min-w-0 flex-1" /><button class="inline-flex items-center gap-1.5 rounded-md border border-red-300/15 px-2.5 py-1.5 text-xs text-red-200 transition hover:bg-red-300/10" @click="revokeVoice(voice)"><ShieldCheck class="h-3.5 w-3.5" /> Revogar</button></div>
            </article>
          </div>
          <div v-else class="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500"><Mic2 class="h-8 w-8 text-zinc-600" /><span>Nenhuma voz cadastrada ainda.</span></div>
          <NuxtLink to="/radio-indoor" class="mt-5 inline-flex items-center gap-1.5 text-xs text-violet-300 transition hover:text-violet-200"><ExternalLink class="h-3.5 w-3.5" /> Ver como o usuário escolhe a voz</NuxtLink>
        </section>
      </div>
    </div>
  </div>
</template>

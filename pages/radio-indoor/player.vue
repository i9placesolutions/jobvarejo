<script setup lang="ts">
import {
  ChevronLeft, ChevronRight, Disc3, Headphones, LoaderCircle, LockKeyhole,
  Pause, Play, Radio, RefreshCw, Volume2
} from 'lucide-vue-next'
import type { RadioTrack } from '~/composables/useRadioIndoor'

definePageMeta({ layout: false, ssr: false })

const radio = useRadioIndoor()
const route = useRoute()
const TOKEN_STORAGE_KEY = 'jobvarejo:radio-indoor-player-token'

const tokenInput = ref('')
const playerToken = ref('')
const currentTrack = ref<RadioTrack | null>(null)
const isPlaying = ref(false)
const isLoadingTrack = ref(false)
const isBootstrapping = ref(false)
const progress = ref(0)
const duration = ref(0)
const volume = ref(0.9)
const notice = ref<string | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
let refreshTimer: ReturnType<typeof setInterval> | null = null
let lastSignature = ''

const queue = computed<RadioTrack[]>(() => Array.isArray(radio.playerData.value?.queue) ? radio.playerData.value.queue : [])
const station = computed(() => radio.playerData.value?.station || null)
const schedule = computed(() => radio.playerData.value?.schedule || null)
const playerMeta = computed(() => radio.playerData.value?.player || null)
const currentIndex = computed(() => queue.value.findIndex((track) => track.id === currentTrack.value?.id))

const showNotice = (text: string) => {
  notice.value = text
  window.setTimeout(() => { if (notice.value === text) notice.value = null }, 4500)
}

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const playTrack = async (track: RadioTrack) => {
  if (!track?.audioUrl) return
  isLoadingTrack.value = true
  currentTrack.value = track
  await nextTick()
  try {
    audioRef.value?.load()
    await audioRef.value?.play()
    isPlaying.value = true
    void radio.recordPlayed(track, {
      playerToken: playerToken.value,
      source: 'kiosk-player',
      playlistId: track.playlistId || undefined,
      completed: false
    })
    await radio.prefetchQueue(queue.value.slice(Math.max(0, currentIndex.value), currentIndex.value + 4))
  } catch {
    showNotice('Toque em play para iniciar o áudio neste navegador.')
  } finally {
    isLoadingTrack.value = false
  }
}

const togglePlay = async () => {
  if (!currentTrack.value && queue.value[0]) {
    await playTrack(queue.value[0])
    return
  }
  if (!audioRef.value) return
  if (audioRef.value.paused) {
    await audioRef.value.play().catch(() => showNotice('Não foi possível retomar a reprodução.'))
  } else {
    audioRef.value.pause()
  }
}

const playNext = async () => {
  const next = queue.value[currentIndex.value + 1] || queue.value[0]
  if (currentTrack.value) {
    void radio.recordPlayed(currentTrack.value, {
      playerToken: playerToken.value,
      source: 'kiosk-player',
      completed: true,
      durationMs: Math.round((audioRef.value?.currentTime || 0) * 1000)
    })
  }
  if (next) await playTrack(next)
}

const playPrevious = async () => {
  const previous = queue.value[currentIndex.value - 1] || queue.value[queue.value.length - 1]
  if (previous) await playTrack(previous)
}

const onTimeUpdate = () => {
  if (!audioRef.value) return
  progress.value = audioRef.value.currentTime
  duration.value = Number.isFinite(audioRef.value.duration) ? audioRef.value.duration : 0
}

const seek = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (audioRef.value) audioRef.value.currentTime = value
  progress.value = value
}

const refreshQueue = async (force = false) => {
  if (!playerToken.value) return
  try {
    const previousId = currentTrack.value?.id
    const wasPlaying = isPlaying.value
    await radio.loadPlayer({ playerToken: playerToken.value })
    const signature = [
      schedule.value?.id || '',
      schedule.value?.startTime || '',
      schedule.value?.endTime || '',
      queue.value.map((track) => track.id).join(',')
    ].join('|')
    if (!force && signature === lastSignature) return
    lastSignature = signature
    await radio.prefetchQueue(queue.value)
    if (previousId) {
      const stillThere = queue.value.find((track) => track.id === previousId)
      if (stillThere) {
        currentTrack.value = stillThere
        if (wasPlaying && audioRef.value?.paused) await audioRef.value.play().catch(() => undefined)
        return
      }
    }
    if (!currentTrack.value && queue.value[0]) currentTrack.value = queue.value[0]
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || error?.statusMessage || 'Token inválido ou player pausado.')
  }
}

const connect = async (rawToken?: string) => {
  const token = String(rawToken || tokenInput.value || '').trim()
  if (!token) {
    showNotice('Cole o token do player gerado em Equipe e players.')
    return
  }
  isBootstrapping.value = true
  try {
    playerToken.value = token
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    await radio.registerCache()
    await refreshQueue(true)
    if (queue.value[0]) await playTrack(queue.value[0])
    showNotice(`Conectado: ${station.value?.name || playerMeta.value?.name || 'loja'}`)
  } catch (error: any) {
    playerToken.value = ''
    showNotice(error?.data?.statusMessage || 'Não foi possível autenticar o player.')
  } finally {
    isBootstrapping.value = false
  }
}

const disconnect = () => {
  audioRef.value?.pause()
  playerToken.value = ''
  currentTrack.value = null
  radio.playerData.value = null
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

onMounted(() => {
  const fromQuery = String(route.query.token || route.query.playerToken || '').trim()
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  tokenInput.value = fromQuery || stored
  if (tokenInput.value) void connect(tokenInput.value)
  refreshTimer = setInterval(() => { void refreshQueue(false) }, 60_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  audioRef.value?.pause()
})
</script>

<template>
  <div class="kiosk">
    <header class="kiosk-top">
      <div class="brand"><Radio :size="20" /><div><strong>JobVarejo</strong><span>Player kiosk</span></div></div>
      <div v-if="playerToken" class="live-pill"><i></i>{{ station?.name || 'Loja' }} · {{ schedule?.programName || 'Catálogo' }}</div>
      <button v-if="playerToken" class="ghost" @click="disconnect">Trocar token</button>
    </header>

    <section v-if="!playerToken" class="gate">
      <div class="gate-card">
        <LockKeyhole :size="28" />
        <h1>Player da loja</h1>
        <p>Cole o token gerado em <strong>Equipe e players</strong>. Não precisa de login nesta tela.</p>
        <textarea v-model="tokenInput" rows="3" placeholder="jv_radio_…" spellcheck="false" />
        <button class="primary" :disabled="isBootstrapping" @click="connect()">
          <LoaderCircle v-if="isBootstrapping" class="spin" :size="16" />
          <Headphones v-else :size="16" />
          Conectar player
        </button>
      </div>
    </section>

    <template v-else>
      <section class="now">
        <div class="cover">
          <img v-if="currentTrack?.thumbnailUrl" :src="currentTrack.thumbnailUrl" :alt="currentTrack.title || ''" />
          <Disc3 v-else :size="64" />
        </div>
        <div class="meta">
          <span class="eyebrow">{{ playerMeta?.name || 'Player' }}</span>
          <h1>{{ currentTrack?.title || 'Aguardando fila' }}</h1>
          <p>{{ currentTrack?.artist || 'A programação entra automaticamente pela agenda' }}</p>
          <div class="controls">
            <button @click="playPrevious"><ChevronLeft :size="22" /></button>
            <button class="play" :disabled="isLoadingTrack" @click="togglePlay">
              <LoaderCircle v-if="isLoadingTrack" class="spin" :size="22" />
              <Pause v-else-if="isPlaying" :size="22" fill="currentColor" />
              <Play v-else :size="22" fill="currentColor" />
            </button>
            <button @click="playNext"><ChevronRight :size="22" /></button>
            <button class="ghost refresh" title="Atualizar fila" @click="refreshQueue(true)"><RefreshCw :size="16" /></button>
          </div>
          <div class="progress">
            <span>{{ formatDuration(progress) }}</span>
            <input type="range" min="0" :max="duration || 1" step="0.1" :value="progress" @input="seek" />
            <span>{{ formatDuration(duration) }}</span>
          </div>
          <div class="volume">
            <Volume2 :size="16" />
            <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="audioRef && (audioRef.volume = volume)" />
          </div>
        </div>
      </section>

      <section class="queue">
        <h2>Próximas faixas</h2>
        <button v-for="track in queue.slice(0, 12)" :key="track.id" class="queue-row" :class="{ active: track.id === currentTrack?.id }" @click="playTrack(track)">
          <div class="mini">
            <img v-if="track.thumbnailUrl" :src="track.thumbnailUrl" :alt="track.title" />
            <Disc3 v-else :size="18" />
          </div>
          <span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
        </button>
        <p v-if="!queue.length" class="empty">Nenhuma faixa na fila. Publique uma agenda com playlist no painel.</p>
      </section>
    </template>

    <p v-if="notice" class="toast">{{ notice }}</p>
    <audio
      ref="audioRef"
      :src="currentTrack?.audioUrl || undefined"
      preload="auto"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onTimeUpdate"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="playNext"
      @error="showNotice('Falha ao ler esta faixa.')"
    />
  </div>
</template>

<style scoped>
.kiosk { min-height:100vh; padding:24px 28px 48px; color:#efeaf8; background:radial-gradient(circle at top left,#2a1a45,#0d0c12 48%); font-family:Inter,system-ui,sans-serif; }
.kiosk-top { display:flex; align-items:center; gap:16px; margin-bottom:28px; }
.brand { display:flex; align-items:center; gap:10px; }
.brand strong,.brand span { display:block; }
.brand strong { font-size:13px; }
.brand span { color:#9b94ab; font-size:11px; }
.live-pill { margin-left:auto; display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; background:rgba(88,210,140,.1); border:1px solid rgba(88,210,140,.25); color:#9ee4b8; font-size:12px; }
.live-pill i { width:7px; height:7px; border-radius:50%; background:#57d48a; box-shadow:0 0 10px #57d48a; }
.gate { min-height:70vh; display:grid; place-items:center; }
.gate-card { width:min(420px,100%); padding:28px; border-radius:18px; background:rgba(20,18,30,.88); border:1px solid rgba(255,255,255,.08); display:grid; gap:14px; }
.gate-card h1 { margin:0; font-size:28px; letter-spacing:-.04em; }
.gate-card p { margin:0; color:#a69fb6; font-size:13px; line-height:1.5; }
.gate-card textarea,.ghost,button.primary { font:inherit; }
.gate-card textarea { width:100%; border-radius:10px; border:1px solid rgba(255,255,255,.12); background:#12101a; color:#efeaf8; padding:12px; resize:vertical; }
button.primary,.ghost { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:10px; cursor:pointer; }
button.primary { border:0; background:linear-gradient(135deg,#8b5cf6,#6d3fd6); color:#fff; padding:12px 16px; font-weight:600; }
.ghost { border:1px solid rgba(255,255,255,.12); background:transparent; color:#d6d0e4; padding:8px 12px; }
.now { display:grid; grid-template-columns:280px 1fr; gap:28px; align-items:center; margin-bottom:36px; }
.cover { aspect-ratio:1; border-radius:22px; overflow:hidden; background:linear-gradient(145deg,#3b2668,#17141f); display:grid; place-items:center; color:#b794f6; }
.cover img { width:100%; height:100%; object-fit:cover; }
.meta .eyebrow { color:#9b94ab; font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
.meta h1 { margin:8px 0 6px; font-size:36px; letter-spacing:-.045em; }
.meta p { margin:0 0 18px; color:#a69fb6; }
.controls { display:flex; align-items:center; gap:10px; }
.controls button { width:44px; height:44px; border-radius:999px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#fff; display:grid; place-items:center; cursor:pointer; }
.controls .play { width:58px; height:58px; background:#8b5cf6; border:0; }
.controls .refresh { width:auto; padding:0 12px; border-radius:10px; }
.progress,.volume { display:flex; align-items:center; gap:10px; margin-top:14px; color:#9b94ab; font-size:11px; }
.progress input,.volume input { flex:1; }
.queue h2 { margin:0 0 12px; font-size:14px; color:#cfc7e0; }
.queue-row { width:100%; display:flex; align-items:center; gap:12px; padding:10px 12px; margin-bottom:8px; border-radius:12px; border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.02); color:#fff; text-align:left; cursor:pointer; }
.queue-row.active,.queue-row:hover { border-color:rgba(139,92,246,.45); background:rgba(139,92,246,.1); }
.mini { width:40px; height:40px; border-radius:8px; overflow:hidden; display:grid; place-items:center; background:#1b1726; color:#b794f6; flex:0 0 auto; }
.mini img { width:100%; height:100%; object-fit:cover; }
.queue-row span { min-width:0; }
.queue-row strong,.queue-row small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.queue-row small { color:#9089a2; margin-top:3px; font-size:11px; }
.empty { color:#9089a2; font-size:13px; }
.toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); padding:10px 14px; border-radius:999px; background:rgba(20,18,30,.95); border:1px solid rgba(255,255,255,.1); font-size:12px; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:800px) {
  .now { grid-template-columns:1fr; }
  .cover { width:min(280px,100%); margin:0 auto; }
  .kiosk { padding:18px 16px 40px; }
  .meta h1 { font-size:28px; }
}
</style>

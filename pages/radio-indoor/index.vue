<script setup lang="ts">
import {
  Album, CalendarClock, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Copy, Disc3, Download, Headphones, ListMusic, LoaderCircle, LockKeyhole, Menu,
  Mic2, MonitorPlay, Moon, Pause, Play, Plus, Radio, RefreshCw, Search, Send, Settings2, ShieldCheck, Store,
  Sparkles, Sun, UserPlus, Users, Volume2, X, Zap
} from 'lucide-vue-next'
import type { RadioTrack } from '~/composables/useRadioIndoor'

definePageMeta({ layout: false, middleware: 'auth', ssr: false })

const radio = useRadioIndoor()
const activeView = ref<'home' | 'catalog' | 'programs' | 'agenda' | 'voices' | 'requests' | 'team'>('home')
const query = ref('')
const activeGenre = ref('Todos')
const activeArtist = ref('Todos')
const activeAlbum = ref('Todos')
const catalogViewMode = ref<'tracks' | 'albums'>('tracks')
const selectedPlaylistId = ref('')
const currentTrack = ref<RadioTrack | null>(null)
const isPlaying = ref(false)
const isLoadingTrack = ref(false)
const audioRef = ref<HTMLAudioElement | null>(null)
const previewAudioRef = ref<HTMLAudioElement | null>(null)
const previewRequest = ref<any | null>(null)
const progress = ref(0)
const duration = ref(0)
const volume = ref(0.86)
const radioTheme = ref<'dark' | 'light'>('dark')
const RADIO_THEME_STORAGE_KEY = 'jobvarejo:radio-indoor-theme'
const showMobileNav = ref(false)
const showStationForm = ref(false)
const notice = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
const isImporting = ref(false)
const isCreatingStation = ref(false)
const isSubmittingRequest = ref(false)
const requestForm = reactive({ kind: 'jingle', title: '', brief: '', style: '', lyrics: '', voiceProfileId: '', gender: 'female' })
const playlistForm = reactive({ name: '', description: '' })
const programForm = reactive({ name: '', description: '', timezone: 'America/Sao_Paulo' })
const scheduleForm = reactive({ programId: '', startTime: '08:00', endTime: '18:00', daysOfWeek: [1, 2, 3, 4, 5] as number[] })
const blockForm = reactive({ programId: '', playlistId: '', label: '', blockType: 'playlist', targetCount: 20 })
const stationForm = reactive({ name: '', timezone: 'America/Sao_Paulo' })
const memberForm = reactive({ name: '', email: '', password: '', accessLevel: 'operator', stationIds: [] as string[] })
const playerForm = reactive({ name: '' })
const isCreatingMember = ref(false)
const isCreatingPlayer = ref(false)
const createdPlayerToken = ref('')
const downloadingRequestId = ref<string | null>(null)
const requestPlaylistId = ref('')
const addingRequestId = ref<string | null>(null)
let requestPollTimer: ReturnType<typeof setInterval> | null = null
let playerRefreshTimer: ReturnType<typeof setInterval> | null = null
let lastScheduleSignature = ''

const genres = computed(() => {
  const fromApi = Array.isArray(radio.facets.value?.genres) ? radio.facets.value.genres.map((item: any) => String(item.genre)) : []
  const fromTracks = radio.catalog.value.map((track) => String(track.genre || '')).filter(Boolean)
  return ['Todos', ...Array.from(new Set([...fromApi, ...fromTracks])).filter((item) => item !== 'Todos')]
})

const artists = computed(() => {
  const fromFacets = Array.isArray(radio.facets.value?.artists) ? radio.facets.value.artists : []
  const fromTracks = radio.catalog.value.map((track) => track.artist).filter(Boolean)
  const combined = Array.from(new Set([...fromFacets, ...fromTracks])).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return ['Todos', ...combined]
})

const albums = computed(() => {
  let list = Array.isArray(radio.facets.value?.albums) ? [...radio.facets.value.albums] : []
  if (activeArtist.value !== 'Todos') {
    list = list.filter((item) => item.artist?.toLowerCase() === activeArtist.value.toLowerCase())
  }
  const names = Array.from(new Set(list.map((item) => item.album).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return ['Todos', ...names]
})

const filteredCatalog = computed(() => radio.catalog.value.filter((track) => {
  const needle = query.value.trim().toLowerCase()
  const matchesText = !needle || [track.title, track.artist, track.album].some((value) => String(value || '').toLowerCase().includes(needle))
  const matchesGenre = activeGenre.value === 'Todos' || track.genre === activeGenre.value
  const matchesArtist = activeArtist.value === 'Todos' || track.artist === activeArtist.value
  const matchesAlbum = activeAlbum.value === 'Todos' || track.album?.toLowerCase() === activeAlbum.value.toLowerCase()
  return matchesText && matchesGenre && matchesArtist && matchesAlbum
}))
const playlists = computed(() => Array.isArray(radio.bootstrap.value?.playlists) ? radio.bootstrap.value.playlists : [])
const stations = computed(() => Array.isArray(radio.stations.value) ? radio.stations.value : [])
const voices = computed(() => Array.isArray(radio.voices.value) ? radio.voices.value : [])
const programs = computed(() => Array.isArray(radio.bootstrap.value?.programs) ? radio.bootstrap.value.programs : [])
const schedules = computed(() => Array.isArray(radio.bootstrap.value?.schedules) ? radio.bootstrap.value.schedules : [])
const queue = computed<RadioTrack[]>(() => Array.isArray(radio.playerData.value?.queue) ? radio.playerData.value.queue : [])
const currentIndex = computed(() => queue.value.findIndex((track) => track.id === currentTrack.value?.id))
const activeSchedule = computed(() => radio.playerData.value?.schedule || null)
const summary = computed(() => radio.bootstrap.value?.summary || { total: 0, ready: 0, genres: 0, artists: 0 })
const station = computed(() => radio.bootstrap.value?.station || radio.playerData.value?.station || null)
const musicGpt = computed(() => radio.bootstrap.value?.musicGpt || { configured: false, ttsConfigured: false, webhookConfigured: false })
const access = computed(() => radio.bootstrap.value?.access || { level: station.value?.accessLevel || 'player', canManageUsers: false, canEditProgramming: false })
const canManageUsers = computed(() => Boolean(access.value.canManageUsers))
const canEditProgramming = computed(() => Boolean(access.value.canEditProgramming))
const roleLabel = computed(() => ({ owner: 'Proprietário', manager: 'Gerente', editor: 'Editor de programação', operator: 'Operador', player: 'Player' } as Record<string, string>)[String(access.value.level)] || 'Player')
const accessLevels = [
  { id: 'manager', label: 'Gerente', description: 'Configura loja, equipe e agenda' },
  { id: 'editor', label: 'Editor de programação', description: 'Monta playlists e programas' },
  { id: 'operator', label: 'Operador', description: 'Opera o player e solicita áudios' },
  { id: 'player', label: 'Player', description: 'Somente reprodução nesta loja' }
]
const selectedStationId = computed({
  get: () => radio.selectedStationId.value,
  set: (value: string) => { radio.selectedStationId.value = value }
})

const showNotice = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
  notice.value = { text, type }
  window.setTimeout(() => { if (notice.value?.text === text) notice.value = null }, 5000)
}

const setView = (view: string) => {
  if (['home', 'catalog', 'programs', 'agenda', 'voices', 'requests', 'team'].includes(view)) activeView.value = view as typeof activeView.value
}

const loadAll = async () => {
  try {
    await radio.loadBootstrap()
    await Promise.all([radio.loadCatalog(), radio.loadPlayer(), radio.loadRequests(), radio.loadVoices(), radio.loadMembers()])
    if (!memberForm.stationIds.length && selectedStationId.value) memberForm.stationIds = [selectedStationId.value]
    if (!requestPlaylistId.value && playlists.value[0]?.id) requestPlaylistId.value = String(playlists.value[0].id)
    if (!selectedPlaylistId.value && playlists.value[0]?.id) selectedPlaylistId.value = String(playlists.value[0].id)
    const firstTrack = queue.value[0] || radio.catalog.value[0]
    if (firstTrack && !currentTrack.value) currentTrack.value = firstTrack
    await radio.registerCache()
    await radio.prefetchQueue(queue.value)
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || error?.statusMessage || 'Não foi possível carregar a Rádio Indoor', 'error')
  }
}

const changeStation = async () => {
  if (!selectedStationId.value) return
  audioRef.value?.pause()
  currentTrack.value = null
  progress.value = 0
  duration.value = 0
  isPlaying.value = false
  try {
    await radio.switchStation(selectedStationId.value)
    await radio.loadMembers()
    memberForm.stationIds = [selectedStationId.value]
    const firstTrack = queue.value[0] || radio.catalog.value[0]
    if (firstTrack) currentTrack.value = firstTrack
    await radio.prefetchQueue(queue.value)
    showNotice(`Loja ativa: ${station.value?.name || 'selecionada'}.`, 'success')
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Não foi possível trocar de loja', 'error')
  }
}

const createStation = async () => {
  if (!stationForm.name.trim()) return
  isCreatingStation.value = true
  try {
    const result = await radio.create({ action: 'create_station', ...stationForm })
    stationForm.name = ''
    showStationForm.value = false
    if (result?.station?.id) {
      selectedStationId.value = String(result.station.id)
      await Promise.all([radio.loadCatalog({ stationId: selectedStationId.value }), radio.loadRequests(), radio.loadMembers()])
      const firstTrack = queue.value[0] || radio.catalog.value[0]
      if (firstTrack) currentTrack.value = firstTrack
      await radio.prefetchQueue(queue.value)
    }
    showNotice('Loja criada. A programação dela começa separada das demais.', 'success')
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Não foi possível criar a loja', 'error')
  } finally {
    isCreatingStation.value = false
  }
}

const refreshCatalog = async () => {
  try {
    await radio.loadCatalog({
      q: query.value || undefined,
      genre: activeGenre.value === 'Todos' ? undefined : activeGenre.value,
      artist: activeArtist.value === 'Todos' ? undefined : activeArtist.value,
      album: activeAlbum.value === 'Todos' ? undefined : activeAlbum.value
    })
    await radio.loadPlayer()
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Falha ao atualizar catálogo', 'error')
  }
}

const onArtistChange = async () => {
  activeAlbum.value = 'Todos'
  await refreshCatalog()
}

const onAlbumChange = async () => {
  await refreshCatalog()
}

const selectGenre = async (genre: string) => {
  activeGenre.value = genre
  activeAlbum.value = 'Todos'
  await refreshCatalog()
}

const playTrack = async (track: RadioTrack) => {
  if (!track.audioUrl) {
    showNotice('Esta faixa ainda não possui áudio pronto no Wasabi.', 'info')
    return
  }
  currentTrack.value = track
  isLoadingTrack.value = true
  await nextTick()
  try {
    audioRef.value?.load()
    await audioRef.value?.play()
    isPlaying.value = true
    void radio.prefetchQueue(queue.value.slice(Math.max(0, currentIndex.value + 1), currentIndex.value + 4))
  } catch {
    showNotice('O navegador bloqueou a reprodução automática. Clique em play novamente.', 'info')
    isPlaying.value = false
  } finally {
    isLoadingTrack.value = false
  }
}

const togglePlay = async () => {
  if (!currentTrack.value) {
    const firstTrack = queue.value[0] || filteredCatalog.value[0]
    if (firstTrack) await playTrack(firstTrack)
    return
  }
  if (!audioRef.value) return
  if (audioRef.value.paused) {
    try { await audioRef.value.play(); isPlaying.value = true } catch { /* usuário pode clicar novamente */ }
  } else {
    audioRef.value.pause()
    isPlaying.value = false
  }
}

const playNext = async () => {
  const next = queue.value[currentIndex.value + 1] || queue.value[0] || filteredCatalog.value[0]
  if (next) await playTrack(next)
}

const playPrevious = async () => {
  const previous = queue.value[currentIndex.value - 1] || queue.value[queue.value.length - 1] || filteredCatalog.value[0]
  if (previous) await playTrack(previous)
}

const addToPlaylist = async (track: RadioTrack) => {
  if (!selectedPlaylistId.value) {
    showNotice('Escolha uma playlist no filtro “Adicionar a” para guardar esta faixa.', 'info')
    return
  }
  try {
    await radio.create({ action: 'add_track', playlistId: selectedPlaylistId.value, trackId: track.id, position: 99999 })
    showNotice(`“${track.title}” adicionada à playlist.`, 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Não foi possível adicionar a faixa', 'error') }
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

const formatDuration = (value: number | null | undefined) => {
  const seconds = Math.max(0, Math.round(Number(value || 0) / (value && value > 1000 ? 1000 : 1)))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const importCatalog = async () => {
  isImporting.value = true
  try {
    const result = await $fetch<any>('/api/radio-indoor/import', { method: 'POST', body: { stationId: selectedStationId.value || undefined } })
    showNotice(`${result.imported || 0} músicas prontas na playlist ${result.playlistId ? 'importada' : ''}.`, 'success')
    await loadAll()
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || error?.statusMessage || 'Falha ao importar o catálogo do Wasabi', 'error')
  } finally { isImporting.value = false }
}

const createPlaylist = async () => {
  if (!playlistForm.name.trim()) return
  try {
    await radio.create({ action: 'create_playlist', ...playlistForm })
    playlistForm.name = ''; playlistForm.description = ''
    showNotice('Playlist criada.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Falha ao criar playlist', 'error') }
}

const createProgram = async () => {
  if (!programForm.name.trim()) return
  try {
    const result = await radio.create({ action: 'create_program', ...programForm })
    programForm.name = ''; programForm.description = ''
    if (!scheduleForm.programId) scheduleForm.programId = result?.program?.id || ''
    if (!blockForm.programId) blockForm.programId = result?.program?.id || ''
    showNotice('Programa criado. Adicione os blocos abaixo.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Falha ao criar programa', 'error') }
}

const createBlock = async () => {
  if (!blockForm.programId || !blockForm.label.trim()) return
  try {
    await radio.create({ action: 'create_block', ...blockForm, targetCount: Number(blockForm.targetCount) })
    blockForm.label = ''
    showNotice('Bloco adicionado ao programa.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Falha ao adicionar bloco', 'error') }
}

const toggleDay = (day: number) => {
  scheduleForm.daysOfWeek = scheduleForm.daysOfWeek.includes(day)
    ? scheduleForm.daysOfWeek.filter((item) => item !== day)
    : [...scheduleForm.daysOfWeek, day].sort((a, b) => a - b)
}

const createSchedule = async () => {
  if (!scheduleForm.programId || !scheduleForm.daysOfWeek.length) return
  try {
    await radio.create({ action: 'create_schedule', ...scheduleForm })
    showNotice('Horário publicado na agenda.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Falha ao salvar agenda', 'error') }
}

const toggleStationStatus = async () => {
  if (!canManageUsers.value) return
  const next = station.value?.status === 'active' ? 'paused' : 'active'
  try {
    await radio.create({ action: 'toggle_station', status: next })
    showNotice(next === 'active' ? 'Loja no ar.' : 'Loja pausada (modo de teste).', 'success')
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Não foi possível alterar o status da loja', 'error')
  }
}

const toggleScheduleEnabled = async (schedule: any) => {
  if (!canManageUsers.value && !canEditProgramming.value) return
  try {
    await radio.create({
      action: 'toggle_schedule',
      scheduleId: schedule.id,
      enabled: !schedule.enabled
    })
    showNotice(schedule.enabled ? 'Horário pausado.' : 'Horário reativado.', 'success')
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Não foi possível pausar o horário', 'error')
  }
}

const addRequestToPlaylist = async (item: any) => {
  const trackId = String(item?.catalogTrackId || '').trim()
  const playlistId = String(requestPlaylistId.value || selectedPlaylistId.value || '').trim()
  if (!trackId) {
    showNotice('Este áudio ainda não entrou no catálogo.', 'info')
    return
  }
  if (!playlistId) {
    showNotice('Escolha uma playlist abaixo para colocar o áudio na grade.', 'info')
    return
  }
  addingRequestId.value = String(item.id)
  try {
    await radio.create({ action: 'add_track', playlistId, trackId, position: 99999 })
    showNotice(`“${item.title}” adicionada à playlist.`, 'success')
    await radio.loadPlayer()
  } catch (error: any) {
    showNotice(error?.data?.statusMessage || 'Não foi possível adicionar à playlist', 'error')
  } finally {
    addingRequestId.value = null
  }
}

const refreshPlayerQueue = async (force = false) => {
  try {
    const previousId = currentTrack.value?.id
    const wasPlaying = isPlaying.value
    await radio.loadPlayer()
    const signature = [
      radio.playerData.value?.schedule?.id || '',
      radio.playerData.value?.schedule?.startTime || '',
      radio.playerData.value?.schedule?.endTime || '',
      queue.value.map((track) => track.id).join(',')
    ].join('|')
    if (!force && signature === lastScheduleSignature) return
    lastScheduleSignature = signature
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
  } catch {
    // Falha silenciosa: a faixa atual continua no buffer do <audio>.
  }
}

const submitRequest = async () => {
  if (!requestForm.brief.trim()) return
  isSubmittingRequest.value = true
  try {
    const result = await $fetch<any>('/api/radio-indoor/ai/request', { method: 'POST', body: { ...requestForm, stationId: selectedStationId.value || undefined } })
    requestForm.title = ''; requestForm.brief = ''; requestForm.lyrics = ''
    const accepted = Boolean(result?.provider?.accepted)
    const configured = Boolean(result?.provider?.configured)
    const message = String(result?.provider?.message || (
      !configured
        ? 'Solicitação guardada. Configure o MusicGPT para envio automático.'
        : accepted
          ? 'Solicitação enviada ao MusicGPT.'
          : 'Solicitação salva, mas ainda sem envio ao MusicGPT.'
    ))
    showNotice(message, accepted ? 'success' : configured ? 'info' : 'info')
    await radio.loadRequests()
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Falha ao criar solicitação', 'error') }
  finally { isSubmittingRequest.value = false }
}

const useVoiceInRequest = (voice: any) => {
  requestForm.voiceProfileId = String(voice?.id || '')
  requestForm.gender = voice?.gender === 'male' ? 'male' : 'female'
  // Clone só entra no TTS (off/locução). Jingle/música geram trilha no MusicAI.
  if (requestForm.kind === 'jingle' || requestForm.kind === 'music') {
    requestForm.kind = 'off'
  }
  activeView.value = 'requests'
  showNotice(`Voz “${voice?.name || 'selecionada'}” pronta para off/locução (clone). Trilha de jingle/música o MusicGPT cria à parte.`, 'success')
}

const refreshRequest = async (requestId: string, silent = false) => {
  try {
    const result = await $fetch('/api/radio-indoor/ai/refresh', { method: 'POST', body: { requestId } })
    if (!silent) {
      await radio.loadRequests()
      showNotice('Status da solicitação atualizado.', 'success')
    }
    return result
  } catch (error: any) {
    if (!silent) showNotice(error?.data?.statusMessage || 'Não foi possível consultar o MusicGPT', 'error')
    return null
  }
}

const listenRequestPreview = async (item: any) => {
  if (!item?.audioUrl) {
    showNotice('O áudio ainda não está pronto para prévia.', 'info')
    return
  }
  previewRequest.value = item
  await nextTick()
  try {
    previewAudioRef.value?.load()
    await previewAudioRef.value?.play()
  } catch {
    showNotice('Clique no play da prévia para iniciar o áudio.', 'info')
  }
}

const closeRequestPreview = () => {
  previewAudioRef.value?.pause()
  previewRequest.value = null
}

const downloadRequestAudio = async (item: any) => {
  if (!item?.downloadUrl || downloadingRequestId.value) return
  downloadingRequestId.value = String(item.id)
  try {
    const response = await fetch(item.downloadUrl, { credentials: 'include' })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Faça login novamente para baixar o áudio.')
      throw new Error(`Não foi possível baixar o áudio (${response.status}).`)
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('audio/')) throw new Error('A resposta não é um arquivo de áudio. Verifique sua sessão e tente novamente.')
    const blob = await response.blob()
    if (!blob.size) throw new Error('O arquivo de áudio veio vazio.')
    const extension = contentType.includes('webm') ? 'webm' : contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3'
    const safeTitle = String(item.title || 'audio-jobvarejo')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'audio-jobvarejo'
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `${safeTitle}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    showNotice('Download iniciado.', 'success')
  } catch (error: any) {
    showNotice(error?.message || 'Não foi possível baixar o áudio.', 'error')
  } finally {
    downloadingRequestId.value = null
  }
}

const refreshPendingRequests = async () => {
  const pending = radio.requests.value.filter((item: any) =>
    item?.providerTaskId && !['ready', 'failed', 'cancelled'].includes(String(item.status))
  )
  if (!pending.length) return
  const results = await Promise.allSettled(pending.map((item: any) => refreshRequest(String(item.id), true)))
  if (results.some((result) => result.status === 'fulfilled' && result.value)) await radio.loadRequests()
}

const createMember = async () => {
  if (!memberForm.name.trim() || !memberForm.email.trim()) return
  isCreatingMember.value = true
  try {
    await radio.createMember({ ...memberForm, stationIds: memberForm.stationIds.length ? memberForm.stationIds : [selectedStationId.value] })
    memberForm.name = ''; memberForm.email = ''; memberForm.password = ''
    showNotice('Usuário cadastrado e vinculado às lojas selecionadas.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Não foi possível cadastrar o usuário', 'error') }
  finally { isCreatingMember.value = false }
}

const updateMember = async (member: any) => {
  try {
    await radio.createMember({ action: 'update', stationId: selectedStationId.value, memberId: member.id, accessLevel: member.accessLevel })
    showNotice('Nível de acesso atualizado.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Não foi possível atualizar o acesso', 'error'); await radio.loadMembers() }
}

const createPlayer = async () => {
  if (!playerForm.name.trim()) return
  isCreatingPlayer.value = true
  try {
    const result = await radio.createPlayer({ name: playerForm.name })
    createdPlayerToken.value = String(result?.token || '')
    playerForm.name = ''
    showNotice('Player criado. Copie o token antes de fechar esta tela.', 'success')
  } catch (error: any) { showNotice(error?.data?.statusMessage || 'Não foi possível criar o player', 'error') }
  finally { isCreatingPlayer.value = false }
}

const copyPlayerToken = async () => {
  if (!createdPlayerToken.value) return
  try { await navigator.clipboard.writeText(createdPlayerToken.value); showNotice('Token copiado.', 'success') } catch { showNotice('Selecione e copie o token manualmente.', 'info') }
}

const openKioskWithToken = () => {
  if (!createdPlayerToken.value) return
  const url = `/radio-indoor/player?token=${encodeURIComponent(createdPlayerToken.value)}`
  window.open(url, '_blank', 'noopener')
}

const toggleRadioTheme = () => {
  radioTheme.value = radioTheme.value === 'dark' ? 'light' : 'dark'
}

if (import.meta.client) {
  watch(radioTheme, (value) => {
    window.localStorage.setItem(RADIO_THEME_STORAGE_KEY, value)
  })
}

onMounted(() => {
  const storedTheme = window.localStorage.getItem(RADIO_THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') radioTheme.value = storedTheme
  void loadAll().then(() => {
    lastScheduleSignature = [
      radio.playerData.value?.schedule?.id || '',
      radio.playerData.value?.schedule?.startTime || '',
      radio.playerData.value?.schedule?.endTime || '',
      queue.value.map((track) => track.id).join(',')
    ].join('|')
  })
  // Sem webhook configurado, consulta tarefas pendentes periodicamente para
  // que o usuário não precise recarregar a página ou clicar em cada item.
  requestPollTimer = setInterval(() => { void refreshPendingRequests() }, 15_000)
  // Recarrega a fila quando a agenda muda de janela (ex.: 08:00 → 18:00).
  playerRefreshTimer = setInterval(() => { void refreshPlayerQueue(false) }, 60_000)
})
onBeforeUnmount(() => {
  if (requestPollTimer) clearInterval(requestPollTimer)
  if (playerRefreshTimer) clearInterval(playerRefreshTimer)
  audioRef.value?.pause()
  previewAudioRef.value?.pause()
})
</script>

<template>
  <div class="radio-app" :class="{ 'theme-light': radioTheme === 'light' }">
    <aside class="radio-sidebar" :class="{ 'is-open': showMobileNav }">
      <div class="brand-lockup">
        <div class="brand-mark"><Radio :size="22" /></div>
        <div><strong>JobVarejo</strong><span>Rádio Indoor</span></div>
      </div>
      <button class="close-nav mobile-only" aria-label="Fechar menu" @click="showMobileNav = false"><X :size="20" /></button>
      <nav class="main-nav" aria-label="Rádio Indoor">
        <button v-for="item in [
          { id: 'home', label: 'Visão geral', icon: Radio },
          { id: 'catalog', label: 'Músicas', icon: Disc3 },
          { id: 'programs', label: 'Programas', icon: ListMusic },
          { id: 'agenda', label: 'Agenda', icon: CalendarClock },
          { id: 'voices', label: 'Banco de vozes', icon: Mic2 },
          { id: 'requests', label: 'Gerar áudio', icon: Sparkles },
          ...(canManageUsers ? [{ id: 'team', label: 'Equipe e players', icon: Users }] : [])
        ]" :key="item.id" class="nav-item" :class="{ active: activeView === item.id }" @click="setView(item.id); showMobileNav = false">
          <component :is="item.icon" :size="18" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <NuxtLink to="/" class="nav-item"><ChevronLeft :size="18" /><span>Todas as soluções</span></NuxtLink>
        <div class="private-badge"><LockKeyhole :size="14" /><span>Player interno protegido</span></div>
        <div class="cache-badge" :class="{ ready: radio.cacheReady.value }"><Zap :size="14" /><span>{{ radio.cacheReady.value ? 'Cache offline ativo' : 'Ativando cache...' }}</span></div>
      </div>
    </aside>

    <main class="radio-main">
      <header class="topbar">
        <button class="menu-button mobile-only" aria-label="Abrir menu" @click="showMobileNav = true"><Menu :size="22" /></button>
        <div class="crumb"><span>Rádio Indoor</span><ChevronRight :size="14" /><b>{{ activeView === 'home' ? 'Visão geral' : activeView === 'catalog' ? 'Músicas' : activeView === 'programs' ? 'Programas' : activeView === 'agenda' ? 'Agenda' : activeView === 'voices' ? 'Banco de vozes' : activeView === 'requests' ? 'Gerar áudio' : 'Equipe e players' }}</b></div>
        <div class="topbar-actions"><div class="station-switcher"><Store :size="15" /><label class="sr-only" for="radio-station-select">Loja ativa</label><select id="radio-station-select" v-model="selectedStationId" @change="changeStation"><option v-for="item in stations" :key="item.id" :value="item.id">{{ item.name }}</option></select><button class="station-add" title="Adicionar loja" @click="showStationForm = !showStationForm"><Plus :size="15" /></button></div><button v-if="canManageUsers" class="station-status clickable" :class="{ live: station?.status === 'active' }" :title="station?.status === 'active' ? 'Pausar loja' : 'Colocar no ar'" @click="toggleStationStatus"><i></i>{{ station?.status === 'active' ? 'No ar' : 'Modo de teste' }}</button><span v-else class="station-status" :class="{ live: station?.status === 'active' }"><i></i>{{ station?.status === 'active' ? 'No ar' : 'Modo de teste' }}</span><button class="icon-button theme-toggle" :aria-label="radioTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'" :aria-pressed="radioTheme === 'light'" :title="radioTheme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'" @click="toggleRadioTheme"><Sun v-if="radioTheme === 'dark'" :size="17" /><Moon v-else :size="17" /></button><button class="icon-button" title="Ajuda"><CircleHelp :size="18" /></button></div>
      </header>

      <div v-if="showStationForm" class="station-create-panel"><div class="station-create-copy"><Store :size="18" /><div><strong>Adicionar uma loja</strong><span>Catálogo pode ser compartilhado; programação e agenda ficam separadas.</span></div></div><div class="station-create-fields"><input v-model="stationForm.name" placeholder="Nome da loja (ex.: Loja Centro)" @keyup.enter="createStation" /><input v-model="stationForm.timezone" placeholder="Fuso horário" /><button class="button primary" :disabled="isCreatingStation" @click="createStation"><LoaderCircle v-if="isCreatingStation" class="spin" :size="15" /><Plus v-else :size="15" /> Criar loja</button></div></div>

      <div v-if="notice" class="notice" :class="notice.type"><Check v-if="notice.type === 'success'" :size="16" /><CircleHelp v-else :size="16" /><span>{{ notice.text }}</span><button @click="notice = null"><X :size="14" /></button></div>

      <section v-if="radio.setupRequired.value" class="setup-card">
        <div class="setup-icon"><Settings2 :size="22" /></div><div><strong>Banco da Rádio Indoor precisa da migração</strong><p>Execute <code>database/radio_indoor_migration.sql</code> no PostgreSQL e recarregue esta tela.</p></div><button class="button secondary" @click="loadAll"><RefreshCw :size="16" /> Verificar novamente</button>
      </section>

      <template v-if="activeView === 'home'">
        <section class="hero-panel">
          <div class="hero-copy"><div class="eyebrow"><span class="eyebrow-dot"></span> Sua programação, simplificada</div><h1>Som que acompanha<br /><em>cada venda.</em></h1><p>Organize gêneros, artistas e anos. Monte programas com blocos e deixe a rádio tocar sozinha na loja.</p><div class="hero-actions"><button class="button primary" @click="activeView = 'catalog'"><Play :size="16" fill="currentColor" /> Abrir player</button><button class="button ghost" @click="activeView = 'programs'"><Plus :size="16" /> Criar programa</button></div></div>
          <div class="hero-art"><div class="orb orb-one"></div><div class="orb orb-two"></div><div class="equalizer"><span v-for="n in 18" :key="n" :style="{ height: `${18 + ((n * 17) % 58)}px`, animationDelay: `${n * 0.08}s` }"></span></div><div class="hero-disc"><Disc3 :size="110" stroke-width="1" /><div class="disc-center"></div></div></div>
        </section>
        <section class="stats-row"><div class="stat-card"><div class="stat-icon purple"><Disc3 :size="18" /></div><span>Faixas prontas</span><strong>{{ summary.ready || 0 }}</strong><small>de {{ summary.total || 0 }} no catálogo</small></div><div class="stat-card"><div class="stat-icon orange"><Album :size="18" /></div><span>Gêneros</span><strong>{{ summary.genres || 0 }}</strong><small>para variar o clima</small></div><div class="stat-card"><div class="stat-icon teal"><Mic2 :size="18" /></div><span>Solicitações</span><strong>{{ radio.requests.value.length }}</strong><small>jingles e locuções</small></div><div class="stat-card"><div class="stat-icon pink"><CalendarClock :size="18" /></div><span>Agenda ativa</span><strong>{{ schedules.filter((item: any) => item.enabled).length }}</strong><small>horários programados</small></div></section>
        <section class="section-block"><div class="section-heading"><div><span class="eyebrow muted">ESCOLHA UM CLIMA</span><h2>Explore seu catálogo</h2></div><button class="text-button" @click="activeView = 'catalog'">Ver tudo <ChevronRight :size="15" /></button></div><div class="genre-grid"><button v-for="genre in genres.slice(0, 8)" :key="genre" class="genre-card" @click="activeGenre = genre; activeView = 'catalog'; void refreshCatalog()"><span class="genre-glow"></span><Disc3 :size="22" /><strong>{{ genre }}</strong><small>{{ radio.catalog.value.filter((track) => genre === 'Todos' || track.genre === genre).length }} faixas</small></button></div></section>
        <section class="section-block"><div class="section-heading"><div><span class="eyebrow muted">ADICIONADAS RECENTEMENTE</span><h2>Continue ouvindo</h2></div><button class="text-button" @click="activeView = 'catalog'">Abrir biblioteca <ChevronRight :size="15" /></button></div><div class="track-row"> <button v-for="track in radio.catalog.value.slice(0, 6)" :key="track.id" class="track-mini" @click="playTrack(track)"><div class="cover small"><img v-if="track.thumbnailUrl" :src="track.thumbnailUrl" :alt="track.title" loading="lazy" /><Disc3 v-else :size="24" /></div><span><strong>{{ track.title }}</strong><small>{{ track.artist }} · {{ track.releaseYear || '—' }}</small></span><Play :size="15" class="mini-play" /></button></div></section>
      </template>

      <template v-else-if="activeView === 'catalog'">
        <section class="page-heading"><div><span class="eyebrow muted">BIBLIOTECA PRIVADA</span><h1>Escolha o que toca</h1><p>Filtre por gênero, artista ou procure uma faixa. O áudio fica protegido no Wasabi.</p></div><button class="button secondary" :disabled="isImporting" @click="importCatalog"><LoaderCircle v-if="isImporting" class="spin" :size="16" /><Download v-else :size="16" /> Importar catálogo</button></section>
        <div class="filter-bar">
          <div class="search-box">
            <Search :size="17" />
            <input v-model="query" placeholder="Buscar música, artista ou álbum" @keyup.enter="refreshCatalog" />
            <button v-if="query" @click="query = ''; void refreshCatalog()"><X :size="14" /></button>
          </div>
          <select v-model="activeArtist" title="Filtrar por artista" @change="onArtistChange">
            <option value="Todos">Todos os artistas ({{ artists.length - 1 }})</option>
            <option v-for="artist in artists.filter(a => a !== 'Todos')" :key="artist" :value="artist">{{ artist }}</option>
          </select>
          <select v-model="activeAlbum" title="Filtrar por álbum" @change="onAlbumChange">
            <option value="Todos">Todos os álbuns ({{ albums.length - 1 }})</option>
            <option v-for="album in albums.filter(a => a !== 'Todos')" :key="album" :value="album">{{ album }}</option>
          </select>
          <select v-model="selectedPlaylistId" class="playlist-select">
            <option value="">Adicionar a…</option>
            <option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">{{ playlist.name }}</option>
          </select>
        </div>
        <div class="chip-row">
          <button v-for="genre in genres" :key="genre" class="chip" :class="{ selected: activeGenre === genre }" @click="selectGenre(genre)">{{ genre }}</button>
        </div>
        <div class="catalog-grid">
          <button v-for="track in filteredCatalog" :key="track.id" class="track-card" @click="playTrack(track)">
            <div class="cover">
              <img v-if="track.thumbnailUrl" :src="track.thumbnailUrl" :alt="track.title" loading="lazy" @error="(e) => ((e.target as HTMLElement).style.display = 'none')" />
              <div class="cover-placeholder"><Disc3 :size="38" /></div>
              <span class="play-overlay"><Play :size="22" fill="currentColor" /></span>
              <span class="track-add" title="Adicionar à playlist" @click.stop="addToPlaylist(track)"><Plus :size="16" /></span>
            </div>
            <div class="track-info">
              <strong>{{ track.title }}</strong>
              <span>{{ track.artist }}</span>
              <small v-if="track.album" class="track-album-badge">{{ track.album }}</small>
              <small>{{ track.genre }} <b>·</b> {{ track.releaseYear || 'Ano não informado' }}</small>
            </div>
          </button>
          <div v-if="!filteredCatalog.length" class="empty-state">
            <Disc3 :size="30" />
            <strong>Nenhuma faixa encontrada</strong>
            <p>Importe o catálogo enviado para o Wasabi ou ajuste os filtros.</p>
            <button class="button primary" @click="importCatalog">Importar agora</button>
          </div>
        </div>
      </template>

      <template v-else-if="activeView === 'programs'">
        <section class="page-heading"><div><span class="eyebrow muted">AUTOMAÇÃO</span><h1>Programas sem complicação</h1><p>Um programa é uma sequência de blocos. Escolha uma playlist, defina a quantidade e pronto.</p></div></section>
        <div class="workspace-grid"><section class="editor-card"><div class="card-title"><div><h3>Novo programa</h3><p>Ex.: Manhã Sertaneja, Almoço da Loja</p></div><ListMusic :size="20" /></div><div class="form-grid"><label>Nome<input v-model="programForm.name" placeholder="Nome do programa" /></label><label>Fuso horário<input v-model="programForm.timezone" /></label><label class="full">Descrição<textarea v-model="programForm.description" rows="2" placeholder="Como este programa deve soar?"></textarea></label></div><button class="button primary" @click="createProgram"><Plus :size="16" /> Criar programa</button></section><section class="editor-card"><div class="card-title"><div><h3>Adicionar bloco</h3><p>Blocos determinam a ordem do conteúdo</p></div><Zap :size="20" /></div><div class="form-grid"><label>Programa<select v-model="blockForm.programId"><option value="">Selecione</option><option v-for="program in programs" :key="program.id" :value="program.id">{{ program.name }}</option></select></label><label>Tipo<select v-model="blockForm.blockType"><option value="playlist">Playlist</option><option value="music">Música</option><option value="jingle">Vinheta</option><option value="clock">Hora certa</option></select></label><label class="full">Rótulo<input v-model="blockForm.label" placeholder="Músicas principais" /></label><label>Playlist<select v-model="blockForm.playlistId"><option value="">Catálogo geral</option><option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">{{ playlist.name }}</option></select></label><label>Quantidade<input v-model.number="blockForm.targetCount" type="number" min="1" max="500" /></label></div><button class="button secondary" @click="createBlock"><Plus :size="16" /> Adicionar bloco</button></section></div>
        <section class="list-card"><div class="card-title"><div><h3>Seus programas</h3><p>{{ programs.length }} programa(s) configurado(s)</p></div></div><div v-if="programs.length" class="program-list"><article v-for="program in programs" :key="program.id" class="program-row"><div class="program-icon"><ListMusic :size="19" /></div><div class="program-main"><strong>{{ program.name }}</strong><span>{{ program.description || 'Sem descrição' }}</span></div><div class="program-blocks"><span v-for="block in (program.blocks || []).slice(0, 4)" :key="block.id" class="block-pill">{{ block.label }}</span><span v-if="(program.blocks || []).length > 4" class="block-pill more">+{{ program.blocks.length - 4 }}</span></div><span class="status-pill" :class="program.status">{{ program.status === 'active' ? 'Ativo' : 'Rascunho' }}</span></article></div><div v-else class="empty-inline"><ListMusic :size="24" /> Crie seu primeiro programa acima.</div></section>
      </template>

      <template v-else-if="activeView === 'agenda'">
        <section class="page-heading"><div><span class="eyebrow muted">GRADE DA RÁDIO</span><h1>Quando cada programa entra</h1><p>Escolha dias e horários. A estação calcula o programa ativo no player.</p></div></section>
        <div class="workspace-grid"><section class="editor-card"><div class="card-title"><div><h3>Novo horário</h3><p>Você pode criar blocos que atravessam a meia-noite.</p></div><Clock3 :size="20" /></div><label>Programa<select v-model="scheduleForm.programId"><option value="">Selecione</option><option v-for="program in programs" :key="program.id" :value="program.id">{{ program.name }}</option></select></label><div class="time-grid"><label>Início<input v-model="scheduleForm.startTime" type="time" /></label><label>Fim<input v-model="scheduleForm.endTime" type="time" /></label></div><div class="days"><span>Repetir em</span><button v-for="day in [{ id: 0, label: 'D' }, { id: 1, label: 'S' }, { id: 2, label: 'T' }, { id: 3, label: 'Q' }, { id: 4, label: 'Q' }, { id: 5, label: 'S' }, { id: 6, label: 'S' }]" :key="day.id" :class="{ selected: scheduleForm.daysOfWeek.includes(day.id) }" @click="toggleDay(day.id)">{{ day.label }}</button></div><button class="button primary" @click="createSchedule"><CalendarClock :size="16" /> Publicar horário</button></section><section class="editor-card schedule-help"><div class="help-art"><CalendarClock :size="34" /></div><h3>Como funciona</h3><p>O player interno verifica a agenda no fuso da estação e monta a fila automaticamente. Se não houver horário ativo, ele usa o catálogo geral.</p><div class="help-line"><Check :size="15" /> Pode pausar sem apagar</div><div class="help-line"><Check :size="15" /> Cache local mantém até 45 min</div><div class="help-line"><Check :size="15" /> Histórico de reprodução</div></section></div>
        <section class="list-card"><div class="card-title"><div><h3>Agenda publicada</h3><p>{{ schedules.length }} horário(s)</p></div><button class="icon-button" title="Atualizar fila do player" @click="refreshPlayerQueue(true)"><RefreshCw :size="17" /></button></div><div v-if="schedules.length" class="schedule-list"><article v-for="schedule in schedules" :key="schedule.id" class="schedule-row"><div class="schedule-time"><strong>{{ schedule.start_time }}</strong><span>até {{ schedule.end_time }}</span></div><div class="schedule-days"><span v-for="day in (schedule.days_of_week || [])" :key="day">{{ ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][Number(day)] }}</span></div><div class="schedule-program"><CalendarClock :size="15" /><strong>{{ programs.find((program: any) => program.id === schedule.program_id)?.name || 'Programa' }}</strong></div><button v-if="canManageUsers || canEditProgramming" class="status-pill clickable" :class="{ paused: !schedule.enabled }" @click="toggleScheduleEnabled(schedule)">{{ schedule.enabled ? 'Ativo' : 'Pausado' }}</button><span v-else class="status-pill" :class="{ paused: !schedule.enabled }">{{ schedule.enabled ? 'Ativo' : 'Pausado' }}</span></article></div><div v-else class="empty-inline"><CalendarClock :size="24" /> Publique um horário para o player escolher a programação.</div></section>
      </template>

      <template v-else-if="activeView === 'voices'">
        <section class="page-heading"><div><span class="eyebrow muted">BANCO DE VOZES</span><h1>Vozes do JobVarejo</h1><p>As vozes clonadas são cadastradas pelo administrador no painel do MusicGPT. Aqui você escolhe uma voz liberada para criar offs e locuções.</p></div><div class="provider-state" :class="{ connected: musicGpt.configured }"><span></span>{{ musicGpt.configured ? 'MusicGPT conectado' : 'Integração aguardando chave' }}</div></section>
        <section class="setup-card voice-admin-note"><div class="setup-icon"><LockKeyhole :size="20" /></div><div><strong>Cadastro protegido no painel Admin</strong><p>O upload da amostra, a confirmação de consentimento e a revogação ficam restritos ao administrador. Os usuários da loja só podem ouvir a prévia e selecionar uma voz autorizada.</p></div></section>
        <section class="list-card"><div class="card-title"><div><h3>Vozes disponíveis</h3><p>{{ voices.length }} voz(es) liberada(s) para {{ station?.name || 'esta loja' }}</p></div><button class="icon-button" title="Atualizar" @click="radio.loadVoices"><RefreshCw :size="17" /></button></div><div v-if="voices.length" class="voice-list"><article v-for="voice in voices" :key="voice.id" class="voice-row"><div class="voice-avatar"><Mic2 :size="17" /></div><div class="voice-main"><strong>{{ voice.name }}</strong><span>{{ voice.gender === 'male' ? 'Masculina' : 'Feminina' }} · {{ voice.stationId ? 'Loja atual' : 'Todas as lojas' }}</span><small v-if="voice.description">{{ voice.description }}</small></div><audio v-if="voice.sampleUrl" :src="voice.sampleUrl" controls preload="none"></audio><button class="button ghost voice-use" @click="useVoiceInRequest(voice)"><Sparkles :size="14" /> Usar na locução</button></article></div><div v-else class="empty-inline"><Mic2 :size="24" /> Nenhuma voz autorizada cadastrada.</div></section>
      </template>

      <template v-else-if="activeView === 'requests'">
        <section class="page-heading"><div><span class="eyebrow muted">MUSICGPT</span><h1>Gere áudio para a rádio</h1><p>Crie jingles, músicas, offs e locuções. A solicitação fica registrada e o retorno aparece aqui quando o provedor concluir.</p></div><div class="provider-state" :class="{ connected: musicGpt.configured && musicGpt.webhookConfigured }"><span></span>{{ musicGpt.configured ? (musicGpt.webhookConfigured ? 'MusicGPT + webhook prontos' : 'MusicGPT sem webhook') : 'Integração aguardando chave' }}</div></section>
        <div class="workspace-grid"><section class="editor-card request-editor"><div class="card-title"><div><h3>Nova solicitação</h3><p>Jingle, off, locução ou música original</p></div><Sparkles :size="20" /></div><div class="kind-tabs"><button v-for="kind in [{ id: 'jingle', label: 'Jingle', icon: Zap }, { id: 'off', label: 'Off', icon: Mic2 }, { id: 'voice', label: 'Locução', icon: Headphones }, { id: 'music', label: 'Música', icon: Disc3 }]" :key="kind.id" :class="{ selected: requestForm.kind === kind.id }" @click="requestForm.kind = kind.id"><component :is="kind.icon" :size="16" />{{ kind.label }}</button></div><div class="form-grid"><label>Título<input v-model="requestForm.title" placeholder="Ex.: Oferta de fim de semana" /></label><label>Estilo<input v-model="requestForm.style" placeholder="Energético, sertanejo, jovem..." /></label><label class="full">Briefing<textarea v-model="requestForm.brief" rows="4" placeholder="Conte o que deve ser dito ou criado, público, duração e clima..."></textarea></label><label class="full">Texto/lyrics (opcional)<textarea v-model="requestForm.lyrics" rows="3" placeholder="Texto exato para locução ou letra"></textarea></label><label v-if="requestForm.kind === 'off' || requestForm.kind === 'voice'" class="full">Banco de voz<select v-model="requestForm.voiceProfileId"><option value="">Selecione uma voz liberada</option><option v-for="voice in voices" :key="voice.id" :value="voice.id">{{ voice.name }} · {{ voice.gender === 'male' ? 'Masculina' : 'Feminina' }}</option></select><small class="field-help">As vozes são cadastradas somente pelo administrador no painel MusicGPT.</small></label><label v-if="requestForm.kind === 'off' || requestForm.kind === 'voice'">Gênero da voz<select v-model="requestForm.gender"><option value="female">Feminina</option><option value="male">Masculina</option></select></label></div><button class="button primary" :disabled="isSubmittingRequest" @click="submitRequest"><LoaderCircle v-if="isSubmittingRequest" class="spin" :size="16" /><Send v-else :size="16" /> Enviar solicitação</button><p v-if="!musicGpt.configured" class="inline-note"><Settings2 :size="14" /> O pedido será salvo agora e enviado assim que <code>MUSICGPT_API_KEY</code> estiver configurada.</p></section><section class="editor-card request-guide"><div class="guide-gradient"><Sparkles :size="24" /></div><h3>Uma fila para cada ideia</h3><p>O pedido nasce com status e histórico. Quando o webhook do MusicGPT entregar o áudio, ele fica pronto para entrar em uma playlist.</p><div class="guide-step"><b>1</b><span>Descreva o áudio</span></div><div class="guide-step"><b>2</b><span>Escolha uma voz liberada</span></div><div class="guide-step"><b>3</b><span>Você escolhe onde tocar</span></div></section></div>
        <section v-if="previewRequest" class="request-preview"><div class="request-preview-copy"><strong>Prévia independente</strong><span>{{ previewRequest.title }}</span></div><audio ref="previewAudioRef" :src="previewRequest.audioUrl" controls preload="metadata"></audio><button class="icon-button" title="Fechar prévia" @click="closeRequestPreview"><X :size="16" /></button></section>
        <section class="list-card"><div class="card-title"><div><h3>Solicitações recentes</h3><p>Ouça, baixe ou coloque na playlist sem alterar o que está no ar</p></div><div class="request-playlist-pick"><label class="sr-only" for="request-playlist-select">Playlist destino</label><select id="request-playlist-select" v-model="requestPlaylistId"><option value="">Playlist destino…</option><option v-for="playlist in playlists" :key="playlist.id" :value="playlist.id">{{ playlist.name }}</option></select><button class="icon-button" title="Atualizar" @click="radio.loadRequests"><RefreshCw :size="17" /></button></div></div><div v-if="radio.requests.value.length" class="request-list"><article v-for="item in radio.requests.value" :key="item.id" class="request-row"><div class="request-kind" :class="item.kind"><Sparkles :size="17" /></div><div class="request-main"><strong>{{ item.title }}</strong><span>{{ item.error && item.status === 'failed' ? item.error : item.brief }}</span></div><div v-if="item.status === 'ready' && item.audioUrl" class="request-actions"><button class="request-action preview" title="Ouvir prévia sem entrar no ar" @click.stop="listenRequestPreview(item)"><Play :size="13" /> Ouvir</button><button class="request-action download" :disabled="downloadingRequestId === item.id" title="Baixar áudio" @click.stop="downloadRequestAudio(item)"><LoaderCircle v-if="downloadingRequestId === item.id" class="spin" :size="13" /><Download v-else :size="13" /> {{ downloadingRequestId === item.id ? 'Baixando' : 'Baixar' }}</button><button v-if="canEditProgramming || canManageUsers" class="request-action playlist" :disabled="addingRequestId === item.id || !item.catalogTrackId" title="Adicionar à playlist da grade" @click.stop="addRequestToPlaylist(item)"><LoaderCircle v-if="addingRequestId === item.id" class="spin" :size="13" /><ListMusic v-else :size="13" /> Na playlist</button></div><span class="request-status" :class="item.status"><i></i>{{ item.status === 'ready' ? 'Pronto' : item.status === 'processing' ? 'Processando' : item.status === 'failed' ? 'Falhou' : 'Na fila' }}</span><button v-if="item.providerTaskId && item.status !== 'ready' && item.status !== 'failed'" class="request-refresh" title="Consultar MusicGPT" @click="refreshRequest(item.id)"><RefreshCw :size="14" /></button></article></div><div v-else class="empty-inline"><Sparkles :size="24" /> Suas solicitações aparecerão aqui.</div></section>
      </template>

      <template v-else-if="activeView === 'team'">
        <section class="page-heading"><div><span class="eyebrow muted">CONTROLE DE ACESSO</span><h1>Equipe e players</h1><p>Cadastre usuários por loja, escolha o que cada um pode fazer e crie players simultâneos para as filiais.</p></div><div class="provider-state connected"><ShieldCheck :size="15" /><span></span>{{ roleLabel }}</div></section>
        <section v-if="!canManageUsers" class="setup-card"><div class="setup-icon"><LockKeyhole :size="22" /></div><div><strong>Seu acesso é somente operacional</strong><p>Peça ao proprietário ou gerente para alterar seu nível nesta loja.</p></div></section>
        <template v-else>
          <div class="workspace-grid">
            <section class="editor-card"><div class="card-title"><div><h3>Cadastrar usuário</h3><p>Um usuário pode ser ligado a mais de uma loja.</p></div><UserPlus :size="20" /></div><div class="form-grid"><label>Nome<input v-model="memberForm.name" placeholder="Nome do usuário" /></label><label>E-mail<input v-model="memberForm.email" type="email" placeholder="usuario@empresa.com" /></label><label>Senha inicial<input v-model="memberForm.password" type="password" placeholder="Mínimo de 8 caracteres" /></label><label>Nível<select v-model="memberForm.accessLevel"><option v-for="level in accessLevels" :key="level.id" :value="level.id">{{ level.label }}</option></select></label></div><div class="store-checks"><span>Vincular às lojas</span><label v-for="item in stations" :key="item.id"><input v-model="memberForm.stationIds" type="checkbox" :value="item.id" /> {{ item.name }}</label></div><button class="button primary" :disabled="isCreatingMember" @click="createMember"><LoaderCircle v-if="isCreatingMember" class="spin" :size="16" /><UserPlus v-else :size="16" /> Cadastrar usuário</button></section>
            <section class="editor-card"><div class="card-title"><div><h3>Novo player simultâneo</h3><p>Crie um token para cada computador ou filial.</p></div><MonitorPlay :size="20" /></div><label>Nome do player<input v-model="playerForm.name" placeholder="Ex.: Caixa Loja Centro" /></label><button class="button secondary" :disabled="isCreatingPlayer" @click="createPlayer"><LoaderCircle v-if="isCreatingPlayer" class="spin" :size="16" /><MonitorPlay v-else :size="16" /> Criar player</button><div v-if="createdPlayerToken" class="player-token-box"><strong>Token gerado — copie agora</strong><textarea readonly :value="createdPlayerToken"></textarea><button class="button ghost" @click="copyPlayerToken"><Copy :size="15" /> Copiar token</button><button class="button primary" @click="openKioskWithToken"><MonitorPlay :size="15" /> Abrir player kiosk</button><small>O token identifica esta loja e não será mostrado novamente. Use em <code>/radio-indoor/player</code>.</small></div></section>
          </div>
          <section class="list-card"><div class="card-title"><div><h3>Usuários desta loja</h3><p>{{ radio.members.value.length }} membro(s) com acesso a {{ station?.name || 'esta loja' }}</p></div><button class="icon-button" title="Atualizar" @click="radio.loadMembers"><RefreshCw :size="17" /></button></div><div v-if="radio.members.value.length" class="member-list"><article v-for="member in radio.members.value" :key="member.id" class="member-row"><div class="member-avatar"><Users :size="17" /></div><div class="member-main"><strong>{{ member.name }}</strong><span>{{ member.email }}</span></div><select v-if="!member.isOwner" v-model="member.accessLevel" aria-label="Nível de acesso" @change="updateMember(member)"><option v-for="level in accessLevels" :key="level.id" :value="level.id">{{ level.label }}</option></select><span v-else class="status-pill">Proprietário</span><span class="member-status" :class="member.status">{{ member.status === 'active' ? 'Ativo' : member.status }}</span></article></div><div v-else class="empty-inline"><Users :size="24" /> Nenhum usuário adicional nesta loja.</div></section>
          <section class="list-card"><div class="card-title"><div><h3>Players cadastrados</h3><p>{{ radio.players.value.length }} player(s) para tocar simultaneamente</p></div></div><div v-if="radio.players.value.length" class="member-list"><article v-for="player in radio.players.value" :key="player.id" class="member-row"><div class="member-avatar player"><MonitorPlay :size="17" /></div><div class="member-main"><strong>{{ player.name }}</strong><span>Token terminado em {{ player.tokenHint || '—' }} · {{ player.lastSeenAt ? 'visto recentemente' : 'ainda não conectado' }}</span></div><span class="member-status" :class="player.status">{{ player.status === 'active' ? 'Ativo' : player.status }}</span></article></div><div v-else class="empty-inline"><MonitorPlay :size="24" /> Crie um player para cada ponto de reprodução.</div></section>
        </template>
      </template>
    </main>

    <div class="player-dock" :class="{ expanded: currentTrack }">
      <div class="player-track"><div class="cover player-cover"><img v-if="currentTrack?.thumbnailUrl" :src="currentTrack.thumbnailUrl" :alt="currentTrack.title" /><Disc3 v-else :size="25" /></div><div class="now-playing"><strong>{{ currentTrack?.title || 'Escolha uma faixa para começar' }}</strong><span>{{ currentTrack?.artist || 'Seu player interno está pronto' }}</span></div></div><div class="player-controls"><div class="control-buttons"><button title="Anterior" @click="playPrevious"><ChevronLeft :size="18" /></button><button class="play-button" :disabled="isLoadingTrack" title="Reproduzir" @click="togglePlay"><LoaderCircle v-if="isLoadingTrack" class="spin" :size="19" /><Pause v-else-if="isPlaying" :size="19" fill="currentColor" /><Play v-else :size="19" fill="currentColor" /></button><button title="Próxima" @click="playNext"><ChevronRight :size="18" /></button></div><div class="progress-line"><span>{{ formatDuration(progress * 1000) }}</span><input type="range" min="0" :max="duration || 1" step="0.1" :value="progress" aria-label="Progresso da faixa" @input="seek" /><span>{{ formatDuration(duration * 1000) }}</span></div></div><div class="player-tools"><Volume2 :size="17" /><input v-model.number="volume" type="range" min="0" max="1" step="0.01" aria-label="Volume" @input="audioRef && (audioRef.volume = volume)" /><span class="cache-indicator"><i></i> cache</span></div><audio ref="audioRef" :src="currentTrack?.audioUrl || undefined" preload="auto" @timeupdate="onTimeUpdate" @loadedmetadata="onTimeUpdate" @play="isPlaying = true" @pause="isPlaying = false" @ended="playNext" @error="showNotice('Não foi possível ler esta faixa no navegador.', 'error')"></audio>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');
:global(body) { margin: 0; background: #0b0b12; color: #f7f7fb; font-family: 'Space Grotesk', system-ui, sans-serif; }
:global(*) { box-sizing: border-box; }
.radio-app { min-height: 100vh; background: radial-gradient(circle at 20% -10%, rgba(88, 49, 185, .24), transparent 35%), #0b0b12; display: flex; padding-bottom: 104px; }
.radio-sidebar { width: 244px; background: rgba(13, 13, 22, .92); border-right: 1px solid rgba(255,255,255,.07); padding: 26px 16px 22px; display: flex; flex-direction: column; position: fixed; inset: 0 auto 0 0; z-index: 20; }
.brand-lockup { display:flex; align-items:center; gap: 11px; padding: 2px 10px 34px; }.brand-mark { width: 38px; height:38px; border-radius: 12px; display:grid; place-items:center; color:white; background: linear-gradient(135deg,#9b66ff,#6538da); box-shadow:0 6px 25px rgba(121,71,242,.38); }.brand-lockup strong { display:block; font-size:15px; letter-spacing:-.02em; }.brand-lockup span { display:block; color:#88869c; font-size:10px; text-transform:uppercase; letter-spacing:.13em; margin-top:3px; }
.main-nav { display:grid; gap: 6px; }.nav-item { border:0; background:transparent; color:#9795a8; display:flex; align-items:center; gap:12px; padding:12px 13px; border-radius:10px; text-align:left; font:500 13px inherit; cursor:pointer; transition:.18s; }.nav-item:hover { background:rgba(255,255,255,.05); color:#fff; }.nav-item.active { color:#fff; background:linear-gradient(90deg,rgba(126,76,238,.3),rgba(126,76,238,.08)); box-shadow:inset 2px 0 #a478ff; }.sidebar-bottom { margin-top:auto; display:grid; gap:8px; }.private-badge,.cache-badge { display:flex; align-items:center; gap:7px; color:#8e8ca1; font-size:10px; padding:9px 10px; border:1px solid rgba(255,255,255,.06); border-radius:9px; }.cache-badge.ready { color:#73d8a1; border-color:rgba(82,203,139,.2); background:rgba(72,194,127,.05); }
.radio-main { width:calc(100% - 244px); margin-left:244px; padding:0 42px 50px; max-width:1550px; }.topbar { height:76px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,.06); }.crumb { display:flex; align-items:center; gap:8px; color:#77758b; font-size:12px; }.crumb b { color:#c8c6d5; font-weight:600; }.topbar-actions { display:flex; align-items:center; gap:14px; }.station-status { color:#9c99ad; display:flex; gap:7px; align-items:center; font-size:11px; }.station-status i,.request-status i,.cache-indicator i { width:7px; height:7px; border-radius:50%; background:#878394; display:block; }.station-status.live i { background:#55d993; box-shadow:0 0 0 4px rgba(85,217,147,.12); }.icon-button { border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); color:#aaa7bb; width:34px; height:34px; border-radius:9px; display:grid; place-items:center; cursor:pointer; }.icon-button:hover { color:#fff; border-color:rgba(255,255,255,.16); }.mobile-only { display:none; }
.notice { margin:16px 0 -2px; display:flex; align-items:center; gap:9px; padding:11px 14px; border-radius:10px; font-size:12px; border:1px solid rgba(255,255,255,.1); }.notice.success { color:#8ce4b4; background:rgba(71,194,126,.09); border-color:rgba(71,194,126,.2); }.notice.error { color:#ff9b9b; background:rgba(235,86,86,.09); border-color:rgba(235,86,86,.2); }.notice.info { color:#c3a8ff; background:rgba(135,84,245,.09); border-color:rgba(135,84,245,.2); }.notice span { flex:1; }.notice button { border:0; background:transparent; color:inherit; cursor:pointer; }
.setup-card { margin-top:22px; display:flex; align-items:center; gap:14px; padding:15px 18px; border:1px solid rgba(237,174,84,.3); background:rgba(237,174,84,.07); border-radius:12px; color:#ffd18c; }.setup-card p { color:#bfa77f; font-size:12px; margin:4px 0 0; }.setup-card code,.inline-note code { color:#f7ce8d; }.setup-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:10px; background:rgba(237,174,84,.12); }.setup-card .button { margin-left:auto; }
.hero-panel { min-height:320px; margin:30px 0 28px; border:1px solid rgba(255,255,255,.08); overflow:hidden; border-radius:20px; background:linear-gradient(108deg,rgba(67,35,135,.72),rgba(23,20,48,.78) 48%,rgba(17,16,29,.9)); display:flex; position:relative; }.hero-copy { padding:43px 0 38px 43px; max-width:58%; position:relative; z-index:2; }.eyebrow { color:#c19eff; font-size:10px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; display:flex; align-items:center; gap:8px; }.eyebrow.muted { color:#77738a; }.eyebrow-dot { width:7px; height:7px; border-radius:50%; background:#c79bff; box-shadow:0 0 0 5px rgba(199,155,255,.13); }.hero-copy h1 { font-size:42px; line-height:1.08; letter-spacing:-.05em; margin:15px 0 13px; font-weight:700; }.hero-copy h1 em { color:#bd8dff; font-style:normal; }.hero-copy p { color:#bbb6ce; max-width:475px; font-size:13px; line-height:1.7; margin:0; }.hero-actions { display:flex; gap:10px; margin-top:24px; }.button { border:0; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 15px; color:white; font:600 12px inherit; cursor:pointer; transition:.18s; }.button:disabled { opacity:.5; cursor:wait; }.button.primary { background:#8a5cf2; box-shadow:0 8px 20px rgba(113,65,216,.26); }.button.primary:hover { background:#9b70fa; transform:translateY(-1px); }.button.secondary { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.05); color:#e0ddeb; }.button.secondary:hover { background:rgba(255,255,255,.09); }.button.ghost { background:transparent; border:1px solid rgba(255,255,255,.15); color:#d4cfe2; }.hero-art { flex:1; position:relative; overflow:hidden; }.orb { position:absolute; border-radius:50%; filter:blur(1px); }.orb-one { width:260px; height:260px; right:-40px; top:-65px; background:radial-gradient(circle,rgba(167,91,255,.45),transparent 68%); }.orb-two { width:190px; height:190px; right:125px; bottom:-85px; background:radial-gradient(circle,rgba(47,218,199,.23),transparent 67%); }.equalizer { position:absolute; right:43px; bottom:54px; height:70px; display:flex; align-items:end; gap:5px; opacity:.6; }.equalizer span { width:4px; background:linear-gradient(#c79dff,#68dcce); border-radius:3px; animation:eq 1.7s ease-in-out infinite alternate; }.hero-disc { position:absolute; right:74px; top:50px; width:142px; height:142px; border:1px solid rgba(255,255,255,.16); border-radius:50%; display:grid; place-items:center; color:rgba(218,193,255,.5); transform:rotate(-16deg); box-shadow:0 0 50px rgba(166,104,255,.2); }.disc-center { width:12px; height:12px; border-radius:50%; background:#9c6af3; border:3px solid rgba(255,255,255,.4); }@keyframes eq { to { transform:scaleY(.38); } }
.stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }.stat-card { min-height:113px; padding:16px; border:1px solid rgba(255,255,255,.075); background:rgba(21,20,31,.75); border-radius:13px; position:relative; }.stat-card span { display:block; color:#9895a7; font-size:11px; margin:2px 0 7px; }.stat-card strong { font-size:25px; letter-spacing:-.05em; }.stat-card small { display:block; color:#6e6b7f; font-size:10px; margin-top:4px; }.stat-icon { width:30px; height:30px; display:grid; place-items:center; border-radius:8px; margin-bottom:10px; }.stat-icon.purple { color:#c29dff; background:rgba(142,89,242,.14); }.stat-icon.orange { color:#ffc286; background:rgba(235,143,67,.13); }.stat-icon.teal { color:#7de4d6; background:rgba(74,200,182,.12); }.stat-icon.pink { color:#ffa1c8; background:rgba(238,88,147,.12); }
.section-block { margin-top:38px; }.section-heading { display:flex; align-items:end; justify-content:space-between; margin-bottom:16px; }.section-heading h2,.page-heading h1 { margin:7px 0 0; letter-spacing:-.045em; font-size:24px; }.text-button { border:0; background:none; color:#a783f3; font:600 11px inherit; display:flex; align-items:center; gap:4px; cursor:pointer; }.genre-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:9px; }.genre-card { min-height:108px; position:relative; overflow:hidden; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:linear-gradient(145deg,rgba(88,55,144,.38),rgba(24,23,35,.84)); color:#d6c9f3; display:flex; flex-direction:column; align-items:flex-start; justify-content:end; padding:13px; text-align:left; cursor:pointer; transition:.2s; }.genre-card:nth-child(3n) { background:linear-gradient(145deg,rgba(126,77,49,.35),rgba(24,23,35,.84)); color:#f0c598; }.genre-card:nth-child(4n) { background:linear-gradient(145deg,rgba(37,116,105,.32),rgba(24,23,35,.84)); color:#99e1d6; }.genre-card:hover { border-color:rgba(177,135,255,.55); transform:translateY(-3px); }.genre-card strong { color:#f4f1fb; font-size:12px; margin-top:20px; }.genre-card small { color:#918a9f; font-size:9px; margin-top:3px; }.genre-glow { position:absolute; width:90px; height:90px; background:currentColor; filter:blur(32px); opacity:.11; right:-20px; top:-20px; }.track-row { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; }.track-mini { display:flex; align-items:center; gap:10px; padding:8px; min-width:0; border:1px solid rgba(255,255,255,.07); border-radius:11px; background:rgba(20,19,29,.75); color:#fff; text-align:left; cursor:pointer; }.track-mini:hover { border-color:rgba(167,121,255,.45); background:rgba(37,28,55,.75); }.cover { aspect-ratio:1; border-radius:11px; overflow:hidden; position:relative; background:linear-gradient(135deg,#3f2768,#181622); display:grid; place-items:center; color:#b084f7; flex:0 0 auto; }.cover.small { width:48px; height:48px; border-radius:8px; }.cover img { width:100%; height:100%; object-fit:cover; display:block; }.track-mini > span:not(.mini-play) { min-width:0; }.track-mini strong,.track-mini small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.track-mini strong { font-size:11px; }.track-mini small { color:#8e899e; font-size:10px; margin-top:4px; }.mini-play { margin-left:auto; color:#9e77ec; opacity:.6; }
.page-heading { display:flex; justify-content:space-between; align-items:end; gap:20px; padding:38px 0 24px; }.page-heading h1 { font-size:31px; }.page-heading p { color:#9692a5; max-width:590px; font-size:12px; line-height:1.65; margin:9px 0 0; }.filter-bar { display:flex; gap:10px; margin-bottom:13px; }.search-box { height:42px; border:1px solid rgba(255,255,255,.1); background:rgba(22,21,32,.85); border-radius:9px; display:flex; align-items:center; padding:0 12px; gap:9px; flex:1; color:#878398; }.search-box input { background:none; border:0; outline:none; color:white; flex:1; font:12px inherit; }.search-box input::placeholder { color:#777387; }.search-box button { background:none; border:0; color:#888399; cursor:pointer; }.filter-bar select,.form-grid select,.form-grid input,.form-grid textarea,.editor-card > label select,.editor-card > label input { color:#e8e4f0; background:#171622; border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px 11px; font:12px inherit; outline:none; width:100%; }.filter-bar select { min-width:200px; }.chip-row { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:20px; }.chip { border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.025); color:#9691a5; padding:7px 12px; border-radius:99px; cursor:pointer; font:500 11px inherit; }.chip.selected,.chip:hover { color:#e6d9ff; border-color:rgba(153,109,237,.55); background:rgba(126,76,228,.15); }.catalog-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }.track-card { border:0; background:none; color:white; text-align:left; cursor:pointer; min-width:0; }.track-card .cover { box-shadow:0 8px 20px rgba(0,0,0,.22); }.track-card:hover .cover { box-shadow:0 8px 26px rgba(117,72,210,.34); }.play-overlay { opacity:0; position:absolute; inset:0; display:grid; place-items:center; color:white; background:rgba(19,13,32,.42); transition:.2s; }.track-card:hover .play-overlay { opacity:1; }.track-add { position:absolute; right:8px; bottom:8px; width:28px; height:28px; display:grid; place-items:center; border-radius:8px; color:#fff; background:rgba(12,10,20,.72); border:1px solid rgba(255,255,255,.2); opacity:0; transition:.2s; }.track-card:hover .track-add { opacity:1; }.track-add:hover { background:#8a5cf2; }.cover-placeholder { width:100%; height:100%; display:grid; place-items:center; }.track-info { padding:9px 3px 0; }.track-info strong,.track-info span,.track-info small { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.track-info strong { font-size:12px; }.track-info span { color:#aaa5b7; font-size:10px; margin-top:5px; }.track-info small { color:#777387; font-size:9px; margin-top:5px; }.track-album-badge { color:#c084fc !important; font-size:10px !important; margin-top:3px !important; font-weight:500; }.track-info b { color:#a479f2; margin:0 2px; }.empty-state { grid-column:1/-1; min-height:250px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#8e8a9e; border:1px dashed rgba(255,255,255,.1); border-radius:14px; }.empty-state strong { color:#d9d5e2; font-size:14px; }.empty-state p { margin:0 0 12px; font-size:11px; }
.workspace-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:14px; }.editor-card,.list-card { border:1px solid rgba(255,255,255,.08); border-radius:14px; background:rgba(21,20,31,.78); padding:20px; }.card-title { display:flex; align-items:start; justify-content:space-between; gap:14px; margin-bottom:17px; color:#a781ed; }.card-title h3 { color:#eeeaf4; font-size:14px; margin:0; }.card-title p { color:#777386; font-size:10px; margin:5px 0 0; }.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:17px; }.form-grid label,.editor-card > label { color:#9e99aa; font-size:10px; display:grid; gap:6px; }.form-grid .full { grid-column:1/-1; }.form-grid textarea { resize:vertical; min-height:70px; }.editor-card .button { margin-top:3px; }.list-card { margin-top:14px; }.program-list,.schedule-list,.request-list { display:grid; gap:8px; }.program-row,.schedule-row,.request-row { min-height:62px; display:flex; align-items:center; gap:12px; padding:10px 11px; border:1px solid rgba(255,255,255,.06); background:rgba(255,255,255,.018); border-radius:10px; }.program-icon,.request-kind { width:34px; height:34px; display:grid; place-items:center; border-radius:9px; flex:0 0 auto; color:#b58af7; background:rgba(128,75,223,.13); }.program-main,.request-main { min-width:150px; flex:1; }.program-main strong,.request-main strong { display:block; color:#ebe7f2; font-size:12px; }.program-main span,.request-main span { display:block; color:#7e7a8e; font-size:10px; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.program-blocks { display:flex; flex-wrap:wrap; gap:5px; max-width:42%; }.block-pill { color:#b8a6d9; border:1px solid rgba(151,103,229,.22); background:rgba(123,74,213,.09); padding:4px 7px; border-radius:5px; font-size:9px; }.block-pill.more { color:#878190; border-color:rgba(255,255,255,.09); background:none; }.status-pill,.request-status { flex:0 0 auto; color:#78dba8; background:rgba(75,192,128,.1); border:1px solid rgba(75,192,128,.2); border-radius:99px; padding:5px 8px; font-size:9px; }.status-pill.draft { color:#c6a8ef; background:rgba(130,80,220,.1); border-color:rgba(130,80,220,.2); }.status-pill.paused { color:#e5b57e; background:rgba(221,158,83,.1); border-color:rgba(221,158,83,.2); }.empty-inline { min-height:90px; display:flex; align-items:center; justify-content:center; gap:8px; color:#767183; font-size:11px; }.time-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0 17px; }.editor-card > label { margin-bottom:12px; }.days { display:flex; gap:6px; align-items:center; margin-bottom:20px; }.days > span { color:#8c8798; font-size:10px; margin-right:auto; }.days button { width:27px; height:27px; border-radius:50%; border:1px solid rgba(255,255,255,.11); background:rgba(255,255,255,.025); color:#8e899c; font:600 10px inherit; cursor:pointer; }.days button.selected { background:#8a5cf2; border-color:#a77eff; color:white; }.schedule-help { background:linear-gradient(145deg,rgba(44,32,73,.7),rgba(21,20,31,.8)); }.help-art { color:#bb91f9; width:52px; height:52px; display:grid; place-items:center; border-radius:14px; background:rgba(153,102,242,.13); margin-bottom:16px; }.schedule-help h3,.request-guide h3 { margin:0; font-size:15px; }.schedule-help p,.request-guide p { color:#9993aa; font-size:11px; line-height:1.7; }.help-line { display:flex; align-items:center; gap:7px; color:#bdb7c8; font-size:10px; margin-top:11px; }.help-line svg { color:#76d6a5; }.schedule-time { width:80px; }.schedule-time strong { display:block; font-size:13px; }.schedule-time span { display:block; color:#7d788b; font-size:9px; margin-top:3px; }.schedule-days { display:flex; gap:4px; }.schedule-days span { width:20px; height:20px; display:grid; place-items:center; border-radius:50%; background:rgba(136,85,229,.17); color:#c9adf3; font-size:9px; }.schedule-program { display:flex; align-items:center; gap:7px; color:#aaa3b7; flex:1; font-size:11px; }.schedule-program svg { color:#a17be5; }.provider-state { align-self:center; display:flex; align-items:center; gap:7px; color:#e6b37a; font-size:10px; padding:8px 11px; border-radius:99px; border:1px solid rgba(226,164,91,.22); background:rgba(226,164,91,.07); }.provider-state span { width:7px; height:7px; border-radius:50%; background:#e4a15a; }.provider-state.connected { color:#7cdaa6; border-color:rgba(78,204,133,.2); background:rgba(78,204,133,.07); }.provider-state.connected span { background:#62d895; }.kind-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:17px; }.kind-tabs button { display:flex; align-items:center; justify-content:center; gap:5px; border:1px solid rgba(255,255,255,.08); color:#9690a3; background:rgba(255,255,255,.025); border-radius:8px; padding:8px 4px; font:600 10px inherit; cursor:pointer; }.kind-tabs button.selected { color:#e3d5ff; background:rgba(125,74,224,.16); border-color:rgba(157,112,236,.48); }.inline-note { display:flex; align-items:center; gap:6px; color:#888395; font-size:10px; margin:13px 0 0; }.field-help { color:#777386; font-size:9px; line-height:1.4; }.request-guide { background:linear-gradient(145deg,rgba(53,30,93,.55),rgba(22,20,34,.85)); }.guide-gradient { width:48px; height:48px; border-radius:13px; color:#d1adff; display:grid; place-items:center; background:linear-gradient(135deg,#7b48dc,#35b8a8); margin-bottom:18px; }.guide-step { display:flex; align-items:center; gap:10px; margin-top:15px; color:#c3bece; font-size:11px; }.guide-step b { width:22px; height:22px; display:grid; place-items:center; border-radius:50%; color:#c19cff; background:rgba(145,92,234,.16); font-size:10px; }.request-kind.off { color:#f3b277; background:rgba(238,157,84,.12); }.request-kind.voice { color:#79ddd0; background:rgba(67,193,177,.12); }.request-kind.music { color:#dc91bd; background:rgba(214,80,147,.12); }.request-status { display:flex; align-items:center; gap:5px; color:#d8b17d; background:rgba(218,155,81,.09); border-color:rgba(218,155,81,.2); }.request-status i { background:#d8a261; }.request-status.ready { color:#7edba7; background:rgba(72,195,128,.1); border-color:rgba(72,195,128,.2); }.request-status.ready i { background:#64d595; }.request-status.failed { color:#ff9898; background:rgba(237,82,82,.1); border-color:rgba(237,82,82,.2); }.request-status.failed i { background:#ed6a6a; }
/* Keep request cards inside the viewport when a generated brief is long. */
.radio-app { width:100%; max-width:100vw; overflow-x:hidden; }
.radio-main { min-width:0; }
.request-list,.request-row { min-width:0; max-width:100%; }
.request-row { overflow:hidden; }
.request-main { min-width:0; overflow:hidden; }
.request-main strong,.request-main span { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.request-status { flex:0 1 auto; min-width:0; max-width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.request-refresh { flex:0 0 auto; }
.request-actions { display:flex; align-items:center; gap:6px; flex:0 0 auto; }
.request-action { display:inline-flex; align-items:center; gap:4px; border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:6px 8px; color:#cfc8dc; background:rgba(255,255,255,.035); font:600 9px inherit; text-decoration:none; cursor:pointer; white-space:nowrap; }
.request-action.preview { color:#d8c2ff; border-color:rgba(157,112,236,.3); background:rgba(125,74,224,.12); }
.request-action.download { color:#a9e7c3; border-color:rgba(72,195,128,.24); background:rgba(72,195,128,.08); }
.request-action:hover { filter:brightness(1.18); }
.request-preview { display:flex; align-items:center; gap:12px; margin:0 0 14px; padding:12px 14px; border:1px solid rgba(157,112,236,.28); border-radius:12px; background:linear-gradient(110deg,rgba(65,41,113,.25),rgba(21,20,31,.8)); }
.request-preview-copy { min-width:150px; flex:1; }
.request-preview-copy strong,.request-preview-copy span { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.request-preview-copy strong { color:#e9ddff; font-size:11px; }
.request-preview-copy span { color:#a29aaa; font-size:10px; margin-top:4px; }
.request-preview audio { width:min(420px, 48%); height:34px; }

.store-checks { display:flex; align-items:center; flex-wrap:wrap; gap:7px; margin:-2px 0 16px; color:#858092; font-size:10px; }.store-checks > span { width:100%; color:#9e99aa; }.store-checks label { display:flex; align-items:center; gap:5px; padding:7px 9px; border:1px solid rgba(255,255,255,.08); border-radius:8px; color:#c8c2d2; cursor:pointer; }.store-checks input { accent-color:#9565ee; }.player-token-box { margin-top:16px; padding:12px; border:1px solid rgba(111,218,169,.23); background:rgba(70,181,125,.07); border-radius:10px; }.player-token-box strong,.player-token-box small { display:block; }.player-token-box strong { color:#a3e6c3; font-size:11px; }.player-token-box textarea { width:100%; min-height:58px; resize:none; margin:9px 0; color:#d9f7e5; background:#12251d; border:1px solid rgba(111,218,169,.25); border-radius:7px; padding:8px; font:10px ui-monospace,monospace; }.player-token-box .button { margin:0 8px 7px 0; }.player-token-box small { color:#85b79d; font-size:9px; }.player-token-box code { font-size:9px; color:#b7f0d0; }
.status-pill.clickable,.station-status.clickable { cursor:pointer; border:0; font:inherit; }
.status-pill.clickable:hover,.station-status.clickable:hover { filter:brightness(1.12); }
.request-playlist-pick { display:flex; align-items:center; gap:8px; }
.request-playlist-pick select { min-width:160px; max-width:220px; color:#d9d4e4; background:#171622; border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:7px 8px; font:10px inherit; }
.request-action.playlist { color:#9fd7ff; background:rgba(70,150,210,.1); border-color:rgba(70,150,210,.22); }.member-list { display:grid; gap:8px; }.member-row { display:flex; align-items:center; gap:10px; min-height:58px; padding:9px 11px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.018); }.member-avatar { width:32px; height:32px; display:grid; place-items:center; flex:0 0 auto; border-radius:9px; color:#c09af5; background:rgba(128,75,223,.14); }.member-avatar.player { color:#7cddd1; background:rgba(67,193,177,.12); }.member-main { min-width:0; flex:1; }.member-main strong,.member-main span { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.member-main strong { color:#ebe7f2; font-size:11px; }.member-main span { color:#7e7a8e; font-size:9px; margin-top:4px; }.member-row select { width:auto; min-width:142px; color:#d9d4e4; background:#171622; border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:7px 8px; font:10px inherit; }.member-status { flex:0 0 auto; color:#7edba7; background:rgba(72,195,128,.09); border:1px solid rgba(72,195,128,.18); border-radius:99px; padding:5px 8px; font-size:9px; }.member-status.paused,.member-status.suspended { color:#e3b177; background:rgba(219,157,81,.09); border-color:rgba(219,157,81,.18); }.member-status.revoked { color:#ff9a9a; background:rgba(237,82,82,.09); border-color:rgba(237,82,82,.18); }

.voice-admin-note { margin:0 0 14px; border-color:rgba(160,124,239,.25); background:linear-gradient(110deg,rgba(76,46,133,.24),rgba(21,20,31,.78)); }.voice-admin-note p { max-width:720px; color:#aaa3b6; font-size:11px; line-height:1.65; margin:5px 0 0; }.voice-list { display:grid; gap:8px; }.voice-row { display:flex; align-items:center; gap:10px; min-height:66px; padding:10px 11px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.018); }.voice-avatar { width:35px; height:35px; display:grid; place-items:center; flex:0 0 auto; border-radius:10px; color:#d0a9ff; background:rgba(128,75,223,.15); }.voice-main { min-width:130px; flex:1; }.voice-main strong,.voice-main span,.voice-main small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }.voice-main strong { color:#ebe7f2; font-size:12px; }.voice-main span { color:#8b8597; font-size:9px; margin-top:4px; }.voice-main small { color:#aaa3b5; font-size:9px; margin-top:4px; }.voice-row audio { width:210px; height:32px; }.voice-use { margin:0; white-space:nowrap; }.voice-row .button.ghost { color:#cbb4f7; border-color:rgba(157,112,236,.28); background:rgba(125,74,224,.09); }.voice-row .button.ghost:hover { background:rgba(125,74,224,.2); }
.player-dock { position:fixed; z-index:30; left:244px; right:0; bottom:0; min-height:83px; background:rgba(15,14,24,.96); backdrop-filter:blur(22px); border-top:1px solid rgba(255,255,255,.1); display:grid; grid-template-columns:1.05fr 1.3fr 1fr; align-items:center; gap:22px; padding:11px 38px; }.player-track { display:flex; align-items:center; gap:11px; min-width:0; }.player-cover { width:52px; height:52px; border-radius:9px; color:#b48cf7; }.now-playing { min-width:0; }.now-playing strong,.now-playing span { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.now-playing strong { font-size:12px; }.now-playing span { color:#878294; font-size:10px; margin-top:5px; }.player-controls { min-width:0; }.control-buttons { display:flex; justify-content:center; align-items:center; gap:13px; }.control-buttons button { border:0; background:none; color:#aaa5b8; cursor:pointer; display:grid; place-items:center; }.control-buttons button:hover { color:white; }.control-buttons .play-button { width:32px; height:32px; border-radius:50%; color:white; background:#8759ee; box-shadow:0 5px 15px rgba(120,74,222,.38); }.progress-line { display:flex; align-items:center; gap:8px; margin-top:7px; color:#777284; font-size:9px; }.progress-line input,.player-tools input { accent-color:#9468f2; height:3px; flex:1; min-width:0; }.player-tools { display:flex; align-items:center; justify-content:flex-end; gap:9px; color:#888496; }.player-tools input { max-width:92px; }.cache-indicator { display:flex; align-items:center; gap:5px; color:#6dbd93; font-size:9px; margin-left:10px; }.cache-indicator i { width:6px; height:6px; background:#60ce91; }.player-dock audio { display:none; }.spin { animation:spin 1s linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
@media (max-width:1100px) { .radio-main { padding:0 25px 50px; }.genre-grid { grid-template-columns:repeat(4,1fr); }.catalog-grid { grid-template-columns:repeat(4,1fr); }.player-dock { padding:11px 22px; }.player-tools { display:none; }.player-dock { grid-template-columns:1fr 1.3fr; }.hero-copy h1 { font-size:36px; } }
@media (max-width:760px) { .mobile-only { display:grid; }.radio-sidebar { transform:translateX(-100%); transition:.22s; box-shadow:15px 0 40px rgba(0,0,0,.35); }.radio-sidebar.is-open { transform:none; }.close-nav { position:absolute; right:12px; top:18px; border:0; background:none; color:#aaa; }.radio-main { width:100%; margin-left:0; padding:0 15px 45px; }.topbar { height:62px; gap:12px; }.menu-button { border:0; background:none; color:#c8c3d1; place-items:center; }.crumb { flex:1; }.topbar-actions .icon-button { display:none; }.hero-panel { min-height:430px; margin-top:18px; }.hero-copy { max-width:100%; padding:30px 25px; }.hero-copy h1 { font-size:36px; }.hero-art { position:absolute; inset:auto 0 0; height:170px; opacity:.7; }.hero-disc { right:30px; top:5px; transform:scale(.75) rotate(-16deg); }.equalizer { right:24px; bottom:21px; }.stats-row { grid-template-columns:repeat(2,1fr); gap:8px; }.stat-card { min-height:105px; padding:13px; }.section-block { margin-top:29px; }.genre-grid { grid-template-columns:repeat(2,1fr); }.genre-card { min-height:95px; }.track-row { grid-template-columns:1fr; }.page-heading { display:block; padding:25px 0 19px; }.page-heading h1 { font-size:27px; }.page-heading .button,.provider-state { margin-top:17px; }.filter-bar { display:block; }.filter-bar select { width:100%; margin-top:8px; }.catalog-grid { grid-template-columns:repeat(2,1fr); gap:13px 10px; }.workspace-grid { grid-template-columns:1fr; }.form-grid { grid-template-columns:1fr; }.form-grid .full { grid-column:auto; }.program-blocks { display:none; }.program-row,.schedule-row,.request-row { gap:8px; }.request-actions { order:4; width:100%; }.request-action { flex:1; justify-content:center; }.request-preview { align-items:stretch; flex-wrap:wrap; }.request-preview-copy { flex-basis:calc(100% - 30px); }.request-preview audio { width:100%; }.schedule-days { display:none; }.schedule-program { min-width:0; }.schedule-program strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.player-dock { left:0; min-height:80px; padding:9px 12px; grid-template-columns:1fr auto; gap:10px; }.player-cover { width:44px; height:44px; }.now-playing strong { font-size:11px; }.player-controls { grid-column:1/-1; grid-row:2; }.player-dock { padding-bottom:8px; }.control-buttons { position:absolute; right:13px; top:15px; }.control-buttons button:not(.play-button) { display:none; }.progress-line { margin-top:4px; }.radio-app { padding-bottom:140px; }.setup-card { align-items:flex-start; flex-wrap:wrap; }.setup-card .button { margin-left:52px; }.section-heading h2 { font-size:20px; } }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }.station-switcher { display:flex; align-items:center; gap:7px; min-width:0; color:#bca2f3; padding:5px 7px 5px 9px; border:1px solid rgba(168,125,245,.24); background:rgba(116,70,207,.08); border-radius:9px; }.station-switcher select { max-width:190px; min-width:90px; color:#eeeaf8; background:transparent; border:0; outline:0; font:600 11px inherit; cursor:pointer; }.station-switcher option { color:#201c2c; background:#fff; }.station-add { width:24px; height:24px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.13); border-radius:7px; background:rgba(255,255,255,.06); color:#d8c7fa; cursor:pointer; }.station-add:hover { background:#8a5cf2; color:#fff; }.station-create-panel { display:flex; align-items:center; justify-content:space-between; gap:18px; margin:18px 0 -2px; padding:14px 16px; border:1px solid rgba(166,125,244,.24); border-radius:12px; background:linear-gradient(105deg,rgba(71,39,128,.28),rgba(20,19,30,.78)); }.station-create-copy { display:flex; align-items:center; gap:10px; color:#c9b0f4; min-width:220px; }.station-create-copy strong,.station-create-copy span { display:block; }.station-create-copy strong { color:#eee8fb; font-size:12px; }.station-create-copy span { color:#8e899e; font-size:10px; margin-top:4px; }.station-create-fields { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex:1; }.station-create-fields input { color:#e8e4f0; background:#171622; border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px 11px; font:12px inherit; outline:none; min-width:150px; }.station-create-fields .button { white-space:nowrap; margin:0; }
@media (max-width:760px) { .topbar-actions { gap:6px; }.station-switcher { max-width:158px; padding-left:7px; }.station-switcher select { max-width:105px; }.station-status { display:none; }.station-create-panel { display:block; padding:13px; }.station-create-copy { min-width:0; margin-bottom:12px; }.station-create-fields { display:grid; grid-template-columns:1fr; }.station-create-fields input { min-width:0; width:100%; } }

/* The Radio Indoor theme is local to this page and does not alter JobVarejo globally. */
.radio-app.theme-light {
  color-scheme: light;
  color: #272438;
  background: radial-gradient(circle at 18% -12%, rgba(132, 91, 224, .16), transparent 35%), #f5f6fb;
}
.radio-app.theme-light .radio-sidebar { background: rgba(255,255,255,.94); border-right-color: rgba(50,42,77,.1); box-shadow: 12px 0 32px rgba(52,43,83,.05); }
.radio-app.theme-light .brand-lockup strong { color:#29243b; }
.radio-app.theme-light .brand-lockup span { color:#8b8799; }
.radio-app.theme-light .nav-item { color:#706b80; }
.radio-app.theme-light .nav-item:hover { color:#3c3155; background:rgba(116,76,190,.08); }
.radio-app.theme-light .nav-item.active { color:#493470; background:linear-gradient(90deg,rgba(126,76,238,.16),rgba(126,76,238,.04)); box-shadow:inset 2px 0 #7950d5; }
.radio-app.theme-light .private-badge,.radio-app.theme-light .cache-badge { color:#7d788c; border-color:rgba(50,42,77,.1); background:rgba(246,246,251,.8); }
.radio-app.theme-light .cache-badge.ready { color:#318e62; border-color:rgba(55,166,107,.22); background:rgba(55,166,107,.08); }
.radio-app.theme-light .topbar { border-bottom-color:rgba(50,42,77,.1); }
.radio-app.theme-light .crumb { color:#8b8698; }
.radio-app.theme-light .crumb b { color:#433b54; }
.radio-app.theme-light .station-status { color:#777286; }
.radio-app.theme-light .station-switcher { color:#6646a7; border-color:rgba(111,77,205,.2); background:rgba(126,76,238,.07); }
.radio-app.theme-light .station-switcher select { color:#4b3a69; }
.radio-app.theme-light .station-switcher option { color:#2b2638; background:#fff; }
.radio-app.theme-light .station-add { color:#6241a7; border-color:rgba(83,62,131,.15); background:rgba(255,255,255,.75); }
.radio-app.theme-light .station-add:hover { color:#fff; background:#7d50d8; }
.radio-app.theme-light .icon-button { color:#706b80; border-color:rgba(50,42,77,.14); background:rgba(255,255,255,.72); }
.radio-app.theme-light .icon-button:hover { color:#4d3577; border-color:rgba(111,77,205,.35); background:#fff; }
.radio-app.theme-light .theme-toggle { color:#6950a7; }
.radio-app .topbar-actions .theme-toggle { display:grid; }
.radio-app.theme-light .notice { border-color:rgba(75,61,111,.16); }
.radio-app.theme-light .notice.success { color:#26794f; background:rgba(55,166,107,.1); border-color:rgba(55,166,107,.22); }
.radio-app.theme-light .notice.error { color:#ae3e46; background:rgba(211,69,79,.09); border-color:rgba(211,69,79,.2); }
.radio-app.theme-light .notice.info { color:#6843a7; background:rgba(126,76,238,.09); border-color:rgba(126,76,238,.2); }
.radio-app.theme-light .setup-card { color:#8b5b1e; border-color:rgba(214,145,48,.3); background:rgba(242,183,81,.13); }
.radio-app.theme-light .setup-card p { color:#8e7653; }
.radio-app.theme-light .setup-card code,.radio-app.theme-light .inline-note code { color:#8b5b1e; }
.radio-app.theme-light .setup-icon { background:rgba(214,145,48,.15); }
.radio-app.theme-light .hero-panel { border-color:rgba(104,75,160,.18); background:linear-gradient(108deg,#e9e1fb,#fbfaff 50%,#eaf7f5); box-shadow:0 18px 42px rgba(76,57,122,.11); }
.radio-app.theme-light .eyebrow { color:#7045b6; }
.radio-app.theme-light .eyebrow.muted { color:#8a8498; }
.radio-app.theme-light .eyebrow-dot { background:#8c5ce0; box-shadow:0 0 0 5px rgba(140,92,224,.13); }
.radio-app.theme-light .hero-copy h1 { color:#29243d; }
.radio-app.theme-light .hero-copy h1 em { color:#7045b6; }
.radio-app.theme-light .hero-copy p { color:#655f73; }
.radio-app.theme-light .hero-disc { color:rgba(111,77,180,.42); border-color:rgba(93,66,148,.2); box-shadow:0 0 50px rgba(128,87,218,.16); }
.radio-app.theme-light .disc-center { background:#8a5edb; border-color:rgba(255,255,255,.75); }
.radio-app.theme-light .button.secondary { color:#554c68; border-color:rgba(68,55,103,.18); background:rgba(255,255,255,.72); }
.radio-app.theme-light .button.secondary:hover { background:#fff; }
.radio-app.theme-light .button.ghost { color:#624598; border-color:rgba(101,69,162,.25); background:rgba(255,255,255,.42); }
.radio-app.theme-light .button.ghost:hover { background:rgba(126,76,238,.1); }
.radio-app.theme-light .stat-card,.radio-app.theme-light .editor-card,.radio-app.theme-light .list-card { border-color:rgba(62,51,94,.12); background:rgba(255,255,255,.84); box-shadow:0 12px 28px rgba(58,46,93,.06); }
.radio-app.theme-light .stat-card span { color:#777184; }
.radio-app.theme-light .stat-card strong { color:#2b263b; }
.radio-app.theme-light .stat-card small { color:#918b9d; }
.radio-app.theme-light .stat-icon.purple { color:#7750c7; background:rgba(126,76,238,.12); }
.radio-app.theme-light .stat-icon.orange { color:#b66a23; background:rgba(235,143,67,.14); }
.radio-app.theme-light .stat-icon.teal { color:#238a7d; background:rgba(74,200,182,.14); }
.radio-app.theme-light .stat-icon.pink { color:#bd477b; background:rgba(238,88,147,.13); }
.radio-app.theme-light .section-heading h2,.radio-app.theme-light .page-heading h1 { color:#2d283d; }
.radio-app.theme-light .text-button { color:#7049b4; }
.radio-app.theme-light .genre-card { border-color:rgba(77,58,117,.14); background:linear-gradient(145deg,rgba(222,211,248,.92),rgba(247,246,252,.96)); color:#6f4ca9; }
.radio-app.theme-light .genre-card:nth-child(3n) { background:linear-gradient(145deg,rgba(249,228,204,.94),rgba(250,248,247,.96)); color:#a56732; }
.radio-app.theme-light .genre-card:nth-child(4n) { background:linear-gradient(145deg,rgba(207,240,234,.94),rgba(247,251,250,.96)); color:#287e75; }
.radio-app.theme-light .genre-card:hover { border-color:rgba(126,76,238,.45); }
.radio-app.theme-light .genre-card strong { color:#393047; }
.radio-app.theme-light .genre-card small { color:#8a8495; }
.radio-app.theme-light .track-mini { color:#2e293e; border-color:rgba(65,52,98,.13); background:rgba(255,255,255,.8); }
.radio-app.theme-light .track-mini:hover { border-color:rgba(126,76,238,.35); background:#fff; }
.radio-app.theme-light .cover { color:#7750c7; background:linear-gradient(135deg,#ded2f4,#f3effb); }
.radio-app.theme-light .track-mini strong,.radio-app.theme-light .track-info strong { color:#332d42; }
.radio-app.theme-light .track-mini small,.radio-app.theme-light .track-info span { color:#777184; }
.radio-app.theme-light .mini-play { color:#7852c6; }
.radio-app.theme-light .page-heading p { color:#706a7c; }
.radio-app.theme-light .search-box { color:#827c90; border-color:rgba(60,49,91,.14); background:rgba(255,255,255,.88); }
.radio-app.theme-light .search-box input { color:#302a40; }
.radio-app.theme-light .search-box input::placeholder { color:#9a94a5; }
.radio-app.theme-light .search-box button { color:#817a90; }
.radio-app.theme-light .filter-bar select,.radio-app.theme-light .form-grid select,.radio-app.theme-light .form-grid input,.radio-app.theme-light .form-grid textarea,.radio-app.theme-light .editor-card > label select,.radio-app.theme-light .editor-card > label input,.radio-app.theme-light .station-create-fields input { color:#302a40; background:#fff; border-color:rgba(60,49,91,.16); }
.radio-app.theme-light .filter-bar select option,.radio-app.theme-light .form-grid select option,.radio-app.theme-light .member-row select option { color:#302a40; background:#fff; }
.radio-app.theme-light .chip { color:#777184; border-color:rgba(60,49,91,.13); background:rgba(255,255,255,.65); }
.radio-app.theme-light .chip.selected,.radio-app.theme-light .chip:hover { color:#5c3b98; border-color:rgba(126,76,238,.35); background:rgba(126,76,238,.11); }
.radio-app.theme-light .track-card { color:#302a40; }
.radio-app.theme-light .track-card .cover { border-color:rgba(60,49,91,.1); background:linear-gradient(135deg,#ddd2f5,#f5f2fb); }
.radio-app.theme-light .play-overlay { color:#fff; background:rgba(65,42,108,.42); }
.radio-app.theme-light .track-add { color:#fff; background:rgba(78,55,120,.68); border-color:rgba(255,255,255,.6); }
.radio-app.theme-light .track-info small { color:#8b8595; }
.radio-app.theme-light .track-info b { color:#754cc0; }
.radio-app.theme-light .empty-state,.radio-app.theme-light .empty-inline { color:#8a8495; border-color:rgba(60,49,91,.16); }
.radio-app.theme-light .empty-state strong { color:#453c53; }
.radio-app.theme-light .card-title { color:#7049b4; }
.radio-app.theme-light .card-title h3 { color:#393144; }
.radio-app.theme-light .card-title p,.radio-app.theme-light .field-help { color:#858093; }
.radio-app.theme-light .form-grid label,.radio-app.theme-light .editor-card > label { color:#6f687b; }
.radio-app.theme-light .program-row,.radio-app.theme-light .schedule-row,.radio-app.theme-light .request-row,.radio-app.theme-light .member-row,.radio-app.theme-light .voice-row { border-color:rgba(60,49,91,.11); background:rgba(248,248,252,.9); }
.radio-app.theme-light .program-icon,.radio-app.theme-light .request-kind,.radio-app.theme-light .member-avatar,.radio-app.theme-light .voice-avatar { color:#704ab6; background:rgba(126,76,238,.12); }
.radio-app.theme-light .member-avatar.player { color:#267e75; background:rgba(67,193,177,.13); }
.radio-app.theme-light .program-main strong,.radio-app.theme-light .request-main strong,.radio-app.theme-light .member-main strong,.radio-app.theme-light .voice-main strong { color:#3b3449; }
.radio-app.theme-light .program-main span,.radio-app.theme-light .request-main span,.radio-app.theme-light .member-main span,.radio-app.theme-light .voice-main span { color:#80798c; }
.radio-app.theme-light .block-pill { color:#6d4c9f; border-color:rgba(126,76,238,.22); background:rgba(126,76,238,.08); }
.radio-app.theme-light .block-pill.more { color:#898294; border-color:rgba(60,49,91,.12); }
.radio-app.theme-light .status-pill,.radio-app.theme-light .request-status { color:#2d8b5d; background:rgba(55,166,107,.1); border-color:rgba(55,166,107,.22); }
.radio-app.theme-light .status-pill.draft { color:#7049aa; background:rgba(126,76,238,.1); border-color:rgba(126,76,238,.2); }
.radio-app.theme-light .status-pill.paused,.radio-app.theme-light .member-status.paused,.radio-app.theme-light .member-status.suspended { color:#9a6121; background:rgba(219,157,81,.11); border-color:rgba(219,157,81,.22); }
.radio-app.theme-light .request-status { color:#9a6121; background:rgba(218,155,81,.1); border-color:rgba(218,155,81,.22); }
.radio-app.theme-light .request-status.ready,.radio-app.theme-light .member-status { color:#2d8b5d; background:rgba(55,166,107,.1); border-color:rgba(55,166,107,.2); }
.radio-app.theme-light .request-status.failed,.radio-app.theme-light .member-status.revoked { color:#ad3f49; background:rgba(211,69,79,.1); border-color:rgba(211,69,79,.2); }
.radio-app.theme-light .days > span,.radio-app.theme-light .schedule-time span { color:#80798d; }
.radio-app.theme-light .days button { color:#7e778b; border-color:rgba(60,49,91,.14); background:rgba(255,255,255,.7); }
.radio-app.theme-light .days button.selected { color:#fff; background:#7e52d7; border-color:#936be5; }
.radio-app.theme-light .schedule-help,.radio-app.theme-light .request-guide,.radio-app.theme-light .voice-admin-note { background:linear-gradient(145deg,rgba(236,227,252,.9),rgba(255,255,255,.85)); }
.radio-app.theme-light .schedule-help p,.radio-app.theme-light .request-guide p,.radio-app.theme-light .voice-admin-note p { color:#6f687b; }
.radio-app.theme-light .help-art { color:#714ab6; background:rgba(126,76,238,.13); }
.radio-app.theme-light .help-line,.radio-app.theme-light .guide-step { color:#625b70; }
.radio-app.theme-light .schedule-days span { color:#6e4aa1; background:rgba(126,76,238,.14); }
.radio-app.theme-light .schedule-program { color:#6c6578; }
.radio-app.theme-light .provider-state { color:#9a6121; border-color:rgba(219,157,81,.25); background:rgba(219,157,81,.1); }
.radio-app.theme-light .provider-state.connected { color:#2d8b5d; border-color:rgba(55,166,107,.22); background:rgba(55,166,107,.1); }
.radio-app.theme-light .kind-tabs button { color:#777184; border-color:rgba(60,49,91,.13); background:rgba(255,255,255,.65); }
.radio-app.theme-light .kind-tabs button.selected { color:#5d3e98; background:rgba(126,76,238,.11); border-color:rgba(126,76,238,.35); }
.radio-app.theme-light .inline-note { color:#7b7488; }
.radio-app.theme-light .request-action { color:#665e75; border-color:rgba(60,49,91,.14); background:rgba(255,255,255,.72); }
.radio-app.theme-light .request-action.preview { color:#65449f; border-color:rgba(126,76,238,.25); background:rgba(126,76,238,.1); }
.radio-app.theme-light .request-action.download { color:#2d8b5d; border-color:rgba(55,166,107,.22); background:rgba(55,166,107,.09); }
.radio-app.theme-light .request-preview { border-color:rgba(126,76,238,.24); background:linear-gradient(110deg,rgba(236,227,252,.82),rgba(255,255,255,.88)); }
.radio-app.theme-light .request-preview-copy strong { color:#4d3673; }
.radio-app.theme-light .request-preview-copy span { color:#7e778b; }
.radio-app.theme-light .store-checks { color:#7b7488; }
.radio-app.theme-light .store-checks > span { color:#6f687b; }
.radio-app.theme-light .store-checks label { color:#665e75; border-color:rgba(60,49,91,.13); background:rgba(255,255,255,.68); }
.radio-app.theme-light .player-token-box { border-color:rgba(55,166,107,.25); background:rgba(55,166,107,.08); }
.radio-app.theme-light .player-token-box strong { color:#26794f; }
.radio-app.theme-light .player-token-box textarea { color:#286344; background:#effaf3; border-color:rgba(55,166,107,.25); }
.radio-app.theme-light .player-token-box small { color:#5c8e72; }
.radio-app.theme-light .member-row select { color:#40374e; background:#fff; border-color:rgba(60,49,91,.15); }
.radio-app.theme-light .voice-main small { color:#777184; }
.radio-app.theme-light .voice-row .button.ghost { color:#64459e; border-color:rgba(126,76,238,.25); background:rgba(126,76,238,.08); }
.radio-app.theme-light .player-dock { color:#2f293e; background:rgba(255,255,255,.96); border-top-color:rgba(50,42,77,.14); box-shadow:0 -12px 32px rgba(54,43,87,.1); }
.radio-app.theme-light .now-playing strong { color:#373044; }
.radio-app.theme-light .now-playing span,.radio-app.theme-light .progress-line,.radio-app.theme-light .player-tools { color:#7d768a; }
.radio-app.theme-light .control-buttons button { color:#746d80; }
.radio-app.theme-light .control-buttons button:hover { color:#4d3677; }
.radio-app.theme-light .control-buttons .play-button { color:#fff; background:#7f53d7; }
.radio-app.theme-light .cache-indicator { color:#39855f; }
.radio-app.theme-light .request-refresh { color:#6e657d; }
</style>

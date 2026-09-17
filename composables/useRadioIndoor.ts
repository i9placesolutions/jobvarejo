export interface RadioTrack {
  id: string
  title: string
  artist: string
  album?: string | null
  releaseYear?: number | null
  genre?: string
  durationMs?: number | null
  audioUrl?: string | null
  thumbnailUrl?: string | null
  storageKey?: string | null
  [key: string]: any
}

export interface RadioAlbum {
  album: string
  artist: string
  genre: string
  releaseYear?: number | null
  trackCount: number
  thumbnailKey?: string | null
  thumbnailUrl?: string | null
  sampleTrackId?: string | null
}

export const useRadioIndoor = () => {
  const bootstrap = useState<any | null>('radio-indoor-bootstrap', () => null)
  const stations = useState<any[]>('radio-indoor-stations', () => [])
  const selectedStationId = useState<string>('radio-indoor-selected-station-id', () => '')
  const catalog = useState<RadioTrack[]>('radio-indoor-catalog', () => [])
  const albums = useState<RadioAlbum[]>('radio-indoor-albums', () => [])
  const facets = useState<any>('radio-indoor-facets', () => ({ genres: [], artists: [], albums: [] }))
  const playerData = useState<any | null>('radio-indoor-player', () => null)
  const requests = useState<any[]>('radio-indoor-requests', () => [])
  const voices = useState<any[]>('radio-indoor-voices', () => [])
  const members = useState<any[]>('radio-indoor-members', () => [])
  const players = useState<any[]>('radio-indoor-players', () => [])
  const loading = useState('radio-indoor-loading', () => false)
  const setupRequired = useState('radio-indoor-setup-required', () => false)
  const cacheReady = useState('radio-indoor-cache-ready', () => false)

  const registerCache = async () => {
    if (!import.meta.client || !('serviceWorker' in navigator)) return false
    try {
      // O proxy de áudio fica em /api; o worker usa escopo raiz, mas filtra
      // estritamente os dois caminhos de mídia e não toca no editor.
      await navigator.serviceWorker.register('/radio-indoor-sw.js', { scope: '/' })
      cacheReady.value = true
      return true
    } catch (error) {
      console.warn('[radio-indoor] cache local indisponível', error)
      return false
    }
  }

  const loadBootstrap = async (stationId?: string) => {
    loading.value = true
    try {
      const requestedStationId = stationId || selectedStationId.value || undefined
      const data = await $fetch<any>('/api/radio-indoor', { query: requestedStationId ? { stationId: requestedStationId } : undefined })
      bootstrap.value = data
      stations.value = Array.isArray(data?.stations) ? data.stations : []
      if (data?.station?.id) selectedStationId.value = String(data.station.id)
      setupRequired.value = Boolean(data?.setupRequired)
      if (Array.isArray(data?.requests)) requests.value = data.requests
      return data
    } finally {
      loading.value = false
    }
  }

  const loadCatalog = async (filters: Record<string, any> = {}) => {
    const query = { ...filters, ...(filters.stationId || selectedStationId.value ? { stationId: filters.stationId || selectedStationId.value } : {}) }
    const data = await $fetch<any>('/api/radio-indoor/catalog', { query })
    catalog.value = Array.isArray(data?.items) ? data.items : []
    if (Array.isArray(data?.albums)) albums.value = data.albums
    if (data?.facets) facets.value = data.facets
    setupRequired.value = Boolean(data?.setupRequired)
    return data
  }

  const loadAlbums = async (filters: Record<string, any> = {}) => {
    const query = {
      ...filters,
      view: 'albums',
      limit: filters.limit || 300,
      ...(filters.stationId || selectedStationId.value ? { stationId: filters.stationId || selectedStationId.value } : {})
    }
    const data = await $fetch<any>('/api/radio-indoor/catalog', { query })
    albums.value = Array.isArray(data?.albums) ? data.albums : []
    return data
  }

  const loadPlayer = async () => {
    const data = await $fetch<any>('/api/radio-indoor/player', { query: selectedStationId.value ? { stationId: selectedStationId.value } : undefined })
    playerData.value = data
    return data
  }

  const loadRequests = async () => {
    const data = await $fetch<any>('/api/radio-indoor/requests', { query: selectedStationId.value ? { stationId: selectedStationId.value } : undefined })
    requests.value = Array.isArray(data?.items) ? data.items : []
    return data
  }

  const loadVoices = async () => {
    const data = await $fetch<any>('/api/radio-indoor/voices', {
      query: selectedStationId.value ? { stationId: selectedStationId.value } : undefined
    })
    voices.value = Array.isArray(data?.items) ? data.items : []
    return data
  }

  const revokeVoice = async (voiceId: string) => {
    const result = await $fetch<any>(`/api/radio-indoor/voices/${encodeURIComponent(voiceId)}`, {
      method: 'PATCH',
      body: { action: 'revoke' }
    })
    await loadVoices()
    return result
  }

  const loadMembers = async () => {
    if (!selectedStationId.value) return { success: true, members: [], players: [] }
    try {
      const data = await $fetch<any>('/api/radio-indoor/members', { query: { stationId: selectedStationId.value } })
      members.value = Array.isArray(data?.members) ? data.members : []
      players.value = Array.isArray(data?.players) ? data.players : []
      return data
    } catch (error: any) {
      // Usuários sem permissão de gestão ainda podem tocar a rádio.
      if (Number(error?.statusCode || error?.response?.status || error?.data?.statusCode) === 403) {
        members.value = []
        players.value = []
        return { success: false, forbidden: true, members: [], players: [] }
      }
      throw error
    }
  }

  const createMember = async (payload: Record<string, any>) => {
    const result = await $fetch<any>('/api/radio-indoor/members', {
      method: 'POST',
      body: { ...payload, stationId: payload.stationId || selectedStationId.value }
    })
    await loadMembers()
    return result
  }

  const createPlayer = async (payload: Record<string, any>) => {
    const result = await $fetch<any>('/api/radio-indoor/players', {
      method: 'POST',
      body: { ...payload, stationId: payload.stationId || selectedStationId.value }
    })
    await loadMembers()
    return result
  }

  const prefetchTrack = async (track: RadioTrack | null | undefined) => {
    if (!import.meta.client || !track?.audioUrl) return
    try {
      // `cache=1` asks the service worker to store the complete response so a
      // later range request can be served if the store loses connectivity.
      await fetch(`${track.audioUrl}${track.audioUrl.includes('?') ? '&' : '?'}cache=1`, {
        credentials: 'include',
        cache: 'no-store'
      })
    } catch {
      // The current track keeps playing from the media buffer when prefetch fails.
    }
  }

  const prefetchQueue = async (tracks: RadioTrack[]) => {
    for (const track of tracks.slice(0, 3)) await prefetchTrack(track)
  }

  const recordPlayed = async (track: RadioTrack, extra: Record<string, any> = {}) => {
    try {
      await $fetch('/api/radio-indoor/player/played', {
        method: 'POST',
        body: { trackId: track.id, ...(selectedStationId.value ? { stationId: selectedStationId.value } : {}), ...extra }
      })
    } catch {
      // Histórico é secundário ao playback; não interromper a rádio por ele.
    }
  }

  const create = async (payload: Record<string, any>) => {
    const body = payload.action === 'create_station'
      ? payload
      : { ...payload, ...(payload.stationId || selectedStationId.value ? { stationId: payload.stationId || selectedStationId.value } : {}) }
    const result = await $fetch<any>('/api/radio-indoor', { method: 'POST', body })
    if (payload.action === 'create_station' && result?.station?.id) selectedStationId.value = String(result.station.id)
    await Promise.allSettled([loadBootstrap(), loadPlayer(), loadVoices()])
    return result
  }

  const switchStation = async (stationId: string) => {
    if (!stationId) return
    selectedStationId.value = stationId
    await Promise.all([loadBootstrap(stationId), loadCatalog({ stationId }), loadPlayer(), loadRequests(), loadVoices(), loadMembers()])
  }

  return {
    bootstrap,
    stations,
    selectedStationId,
    catalog,
    facets,
    playerData,
    requests,
    voices,
    members,
    players,
    loading,
    setupRequired,
    cacheReady,
    registerCache,
    loadBootstrap,
    loadCatalog,
    loadPlayer,
    loadRequests,
    loadVoices,
    loadMembers,
    createMember,
    createPlayer,
    revokeVoice,
    switchStation,
    prefetchTrack,
    prefetchQueue,
    recordPlayed,
    create
  }
}

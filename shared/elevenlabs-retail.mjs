const API = 'https://api.elevenlabs.io'
export const ELEVEN_RETAIL_MODEL = 'eleven_v3'
export const ELEVEN_RETAIL_OUTPUT = 'mp3_44100_128'
export const ELEVEN_MUSIC_MODEL = 'music_v2_5'

export function retailSpeechText(text) {
  const script = String(text || '').trim()
  if (!script) throw Error('O roteiro da locução está vazio.')
  return `[excited] ${script}`
}

export function elevenCloneName(profileId, name, sampleSha256) {
  return `JobVarejo ${String(name || 'Locutor').trim()} ${profileId} ${String(sampleSha256 || '').slice(0, 12)}`.slice(0, 120)
}

async function responseError(response, action) {
  let detail = ''
  try { const body = await response.json(); detail = String(typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail || body?.message || '')).slice(0, 250) } catch {}
  return Error(`${action} falhou na ElevenLabs (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`)
}

export async function findElevenClone(apiKey, name, fetcher = fetch) {
  const url = new URL('/v2/voices', API)
  url.searchParams.set('search', name)
  url.searchParams.set('voice_type', 'personal')
  url.searchParams.set('page_size', '100')
  const response = await fetcher(url, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw await responseError(response, 'Consulta de vozes')
  const payload = await response.json()
  const matches = (Array.isArray(payload.voices) ? payload.voices : []).filter(voice => voice.name === name && typeof voice.voice_id === 'string')
  if (matches.length > 1) throw Error('Há clones duplicados na ElevenLabs com o mesmo identificador. Revise a conta antes de gerar.')
  return matches[0]?.voice_id || null
}

export async function createElevenClone({ apiKey, name, sample, filename = 'voice.mp3', mimeType = 'audio/mpeg', fetcher = fetch, beforeCreate = async () => {} }) {
  const existing = await findElevenClone(apiKey, name, fetcher)
  if (existing) return { voiceId: existing, created: false }
  const subscription = await fetcher(new URL('/v1/user/subscription', API), { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(20_000) })
  if (!subscription.ok) throw await responseError(subscription, 'Consulta do plano')
  if ((await subscription.json()).can_use_instant_voice_cloning !== true) throw Error('A conta ElevenLabs ainda não permite clonagem instantânea. Ative esse recurso no plano antes de gerar.')
  await beforeCreate()
  const form = new FormData()
  form.set('name', name)
  form.append('files', new Blob([sample], { type: mimeType }), filename)
  form.set('remove_background_noise', 'false')
  const response = await fetcher(new URL('/v1/voices/add', API), {
    method: 'POST', headers: { 'xi-api-key': apiKey }, body: form, signal: AbortSignal.timeout(90_000)
  })
  if (!response.ok) throw await responseError(response, 'Criação do clone')
  const payload = await response.json()
  if (typeof payload.voice_id !== 'string' || !payload.voice_id) throw Error('ElevenLabs não retornou o ID do clone. Confira a conta antes de repetir.')
  return { voiceId: payload.voice_id, created: true, requiresVerification: payload.requires_verification === true }
}

export async function createRetailSpeech({ apiKey, voiceId, text, fetcher = fetch }) {
  if (!apiKey || !voiceId) throw Error('A voz ElevenLabs não está configurada.')
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, API)
  url.searchParams.set('output_format', ELEVEN_RETAIL_OUTPUT)
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: retailSpeechText(text),
      model_id: ELEVEN_RETAIL_MODEL,
      language_code: 'pt',
      voice_settings: { stability: 0.5 }
    }),
    signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok) throw await responseError(response, 'Locução')
  const type = String(response.headers.get('content-type') || '').toLowerCase()
  if (type && !type.includes('audio/')) throw Error('ElevenLabs retornou um conteúdo que não é áudio.')
  const size = Number(response.headers.get('content-length') || 0)
  if (size > 25 * 1024 * 1024) throw Error('ElevenLabs retornou áudio maior que 25 MB.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw Error('ElevenLabs retornou áudio vazio ou maior que 25 MB.')
  return { bytes, requestId: response.headers.get('request-id') || response.headers.get('x-request-id') || null }
}

export async function createRetailMusic({ apiKey, kind, brief, style, lyrics, fetcher = fetch }) {
  if (!apiKey) throw Error('A ElevenLabs não está configurada.')
  if (!['jingle', 'music'].includes(kind)) throw Error('Tipo de música inválido.')
  const lengthMs = kind === 'jingle' ? 15000 : 60000
  const prompt = [
    kind === 'jingle' ? 'Jingle original e curto para rádio indoor de varejo brasileiro.' : 'Música original para rádio indoor de varejo brasileiro.',
    `Ideia: ${String(brief || '').trim()}`,
    style ? `Estilo: ${String(style).trim()}` : '',
    lyrics ? `Letra em português brasileiro a cantar: ${String(lyrics).trim()}` : 'Sem letra fornecida.'
  ].filter(Boolean).join('\n')
  if (prompt.length > 4100) throw Error('A descrição e a letra excedem o limite de 4.100 caracteres da ElevenLabs.')
  const url = new URL('/v1/music', API)
  url.searchParams.set('output_format', 'mp3_48000_192')
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ prompt, music_length_ms: lengthMs, model_id: ELEVEN_MUSIC_MODEL, force_instrumental: kind === 'music' && !lyrics }),
    signal: AbortSignal.timeout(180_000)
  })
  if (!response.ok) throw await responseError(response, 'Geração musical')
  const type = String(response.headers.get('content-type') || '').toLowerCase()
  if (type && !type.includes('audio/')) throw Error('ElevenLabs retornou um conteúdo que não é áudio.')
  const size = Number(response.headers.get('content-length') || 0)
  if (size > 40 * 1024 * 1024) throw Error('ElevenLabs retornou áudio maior que 40 MB.')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 40 * 1024 * 1024) throw Error('ElevenLabs retornou áudio vazio ou maior que 40 MB.')
  return { bytes, songId: response.headers.get('song-id') || null, requestId: response.headers.get('request-id') || response.headers.get('x-request-id') || null }
}

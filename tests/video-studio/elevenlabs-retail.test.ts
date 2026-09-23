import { describe, expect, it, vi } from 'vitest'
import { createElevenClone, createRetailSpeech, elevenCloneName } from '../../shared/elevenlabs-retail.mjs'

describe('locução ElevenLabs', () => {
  it('clona a amostra original sem isolamento e recupera a mesma voz pelo nome', async () => {
    const sample = Buffer.from('sample-bytes')
    const name = elevenCloneName('profile-id', 'Jorge', 'abcdef0123456789')
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname === '/v2/voices') return Response.json({ voices: [] })
      if (url.pathname === '/v1/user/subscription') return Response.json({ can_use_instant_voice_cloning: true })
      expect(url.pathname).toBe('/v1/voices/add')
      const headers = options?.headers as Record<string, string>
      const body = options?.body as FormData
      expect(headers['xi-api-key']).toBe('test-key')
      expect(body.get('name')).toBe(name)
      expect(body.get('remove_background_noise')).toBe('false')
      expect(body.getAll('files')).toHaveLength(1)
      expect(Buffer.from(await (body.get('files') as File).arrayBuffer())).toEqual(sample)
      return Response.json({ voice_id: 'jorge-id', requires_verification: false })
    })
    const result = await createElevenClone({ apiKey: 'test-key', name, sample, filename: 'Jorge.mp3', fetcher })
    expect(result).toEqual({ voiceId: 'jorge-id', created: true, requiresVerification: false })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('não envia a amostra quando a conta não permite clonagem', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => new URL(String(input)).pathname === '/v2/voices'
      ? Response.json({ voices: [] })
      : Response.json({ can_use_instant_voice_cloning: false }))
    await expect(createElevenClone({ apiKey: 'test-key', name: 'Jorge', sample: Buffer.from('x'), fetcher }))
      .rejects.toThrow('não permite clonagem')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('usa Eleven v3 em português com direção animada e preserva o áudio retornado', async () => {
    const bytes = Buffer.from('audio-bytes')
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.pathname).toBe('/v1/text-to-speech/jorge-id')
      expect(url.searchParams.get('output_format')).toBe('mp3_44100_128')
      const body = JSON.parse(String(options?.body))
      expect(body).toMatchObject({ model_id: 'eleven_v3', language_code: 'pt', voice_settings: { stability: 0.5 } })
      expect(body.text).toBe('[excited] Atenção! É Quarta Suína!')
      return new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'request-id': 'receipt-id' } })
    })
    const result = await createRetailSpeech({ apiKey: 'test-key', voiceId: 'jorge-id', text: 'Atenção! É Quarta Suína!', fetcher })
    expect(result).toEqual({ bytes, requestId: 'receipt-id' })
  })
})

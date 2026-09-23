import { describe, expect, it, vi } from 'vitest'
import { createRetailMusic } from '../../shared/elevenlabs-retail.mjs'

describe('música da Rádio Indoor na ElevenLabs', () => {
  it('envia jingle com letra e guarda os identificadores retornados', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, options?: RequestInit) => {
      const url = new URL(String(input))
      expect(url.pathname).toBe('/v1/music')
      expect(url.searchParams.get('output_format')).toBe('mp3_48000_192')
      expect((options?.headers as Record<string, string>)['xi-api-key']).toBe('test-key')
      const body = JSON.parse(String(options?.body))
      expect(body).toMatchObject({ model_id: 'music_v2_5', music_length_ms: 15000, force_instrumental: false })
      expect(body.prompt).toContain('Oferta da semana')
      expect(body.prompt).toContain('Venha comprar')
      return new Response(Buffer.from('music-bytes'), { headers: { 'content-type': 'audio/mpeg', 'song-id': 'song-1', 'request-id': 'request-1' } })
    })
    const result = await createRetailMusic({ apiKey: 'test-key', kind: 'jingle', brief: 'Oferta da semana', style: 'animado', lyrics: 'Venha comprar', fetcher })
    expect(result).toEqual({ bytes: Buffer.from('music-bytes'), songId: 'song-1', requestId: 'request-1' })
  })

  it('pede instrumental para música sem letra e rejeita resposta que não é áudio', async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, options?: RequestInit) => {
      expect(JSON.parse(String(options?.body))).toMatchObject({ music_length_ms: 60000, force_instrumental: true })
      return Response.json({ error: 'unavailable' })
    })
    await expect(createRetailMusic({ apiKey: 'test-key', kind: 'music', brief: 'Música ambiente', style: null, lyrics: null, fetcher })).rejects.toThrow('não é áudio')
  })
})

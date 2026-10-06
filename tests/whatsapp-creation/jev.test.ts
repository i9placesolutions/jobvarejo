import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasBriefFields, shouldConsultJev, suggestJevRoute } from '../../server/utils/whatsapp-creation/jev'

const actions = [
  'update', 'choose_header', 'approve_data', 'approve_images', 'approve_script',
  'approve_preview', 'more_headers', 'status', 'cancel', 'new_order', 'cancel_and_start_new'
] as const

const validPayload = (choice: string, confidence = 0.96) => ({
  answers: {
    action: {
      type: 'choice',
      choice,
      confidence,
      probabilities: Object.fromEntries(actions.map(action => [action, action === choice ? confidence : (1 - confidence) / (actions.length - 1)]))
    }
  }
})

const mockResponse = (payload: unknown, ok = true) => ({ ok, json: async () => payload })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('suggestJevRoute', () => {
  it('reserva Jev para mensagens ambíguas e preserva pedidos completos', () => {
    const complete = { action: 'update' as const, kind: 'encarte' as const, theme: 'Hortifruti', formats: ['stories'], validity: '05/10/2026' }
    expect(hasBriefFields(complete)).toBe(true)
    expect(shouldConsultJev(complete, 'Quero encarte Hortifruti para Story em 05/10/2026')).toBe(false)
    expect(shouldConsultJev({ action: 'status' }, '1')).toBe(false)
    expect(shouldConsultJev({ action: 'status' }, 'Confirmado')).toBe(false)
    expect(shouldConsultJev({ action: 'update' }, 'Talvez mudar a campanha')).toBe(true)
  })
  it('returns a typed suggestion when Jev gives a confident, phase-compatible choice', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key')
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(validPayload('choose_header')))
    vi.stubGlobal('fetch', fetchMock)

    await expect(suggestJevRoute({ text: '2', phase: 'header', kind: 'encarte' }))
      .resolves.toEqual({ action: 'choose_header', confidence: 0.96 })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer test-openrouter-key' } })
  })

  it('returns null for low confidence or an action that does not match the current phase', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse(validPayload('status', 0.62)))
      .mockResolvedValueOnce(mockResponse(validPayload('approve_preview'))))

    await expect(suggestJevRoute({ text: 'Pode aprovar', phase: 'header', kind: 'encarte' })).resolves.toBeNull()
    await expect(suggestJevRoute({ text: 'Pode aprovar', phase: 'header', kind: 'encarte' })).resolves.toBeNull()
  })

  it('returns null on missing credentials, HTTP/network failures, or an invalid answer shape', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(suggestJevRoute({ text: 'Status?', phase: 'collecting' })).resolves.toBeNull()
    expect(fetch).not.toHaveBeenCalled()

    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse({}, false))
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockResponse({ answers: { action: { type: 'choice', choice: 'unknown', confidence: 0.99, probabilities: {} } } }))
    vi.stubGlobal('fetch', fetchMock)
    const input = { text: 'Status?', phase: 'collecting' as const }
    await expect(suggestJevRoute(input)).resolves.toBeNull()
    await expect(suggestJevRoute(input)).resolves.toBeNull()
    await expect(suggestJevRoute(input)).resolves.toBeNull()
  })

  it('sends only the bounded routing context and keeps IDs and credentials out of the payload', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key')
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(validPayload('update')))
    vi.stubGlobal('fetch', fetchMock)
    const longMessage = `tema ${'a'.repeat(1400)}`

    await suggestJevRoute({ text: longMessage, phase: 'collecting', kind: 'encarte' })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = String(request.body)
    const parsed = JSON.parse(body)
    expect(Object.keys(parsed).sort()).toEqual(['model', 'questions', 'state'])
    expect(parsed.state).toEqual({ customer_message: longMessage.slice(0, 1200), current_phase: 'collecting', current_kind: 'encarte' })
    expect(body).not.toContain('test-openrouter-key')
    expect(body).not.toMatch(/accountId|orderId|sender|clientId|\bid\b/i)
  })
})

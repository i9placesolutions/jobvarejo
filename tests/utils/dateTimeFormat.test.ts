import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatHistoryDateTime, formatHistoryRelative } from '~/utils/dateTimeFormat'

describe('formatHistoryDateTime', () => {
  it('formata ISO em pt-BR DD/MM/YYYY HH:MM:SS', () => {
    const out = formatHistoryDateTime('2026-04-30T14:30:45.000Z')
    // Resultado depende do TZ local; testa formato basico
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(out).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('data invalida retorna o valor original', () => {
    expect(formatHistoryDateTime('not-a-date')).toBe('not-a-date')
    expect(formatHistoryDateTime('')).toBe('')
  })
})

describe('formatHistoryRelative', () => {
  // Mock Date.now para testes deterministas
  const FIXED_NOW = new Date('2026-04-30T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('< 60s: "agora mesmo"', () => {
    const date = new Date(FIXED_NOW - 30_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('agora mesmo')
  })

  it('< 60min: "N min atras"', () => {
    const date = new Date(FIXED_NOW - 5 * 60_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('5 min atras')
  })

  it('< 24h: "Nh atras"', () => {
    const date = new Date(FIXED_NOW - 3 * 3600_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('3h atras')
  })

  it('1 dia: "ontem"', () => {
    const date = new Date(FIXED_NOW - 25 * 3600_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('ontem')
  })

  it('< 30 dias: "N dias atras"', () => {
    const date = new Date(FIXED_NOW - 5 * 24 * 3600_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('5 dias atras')
  })

  it('1 mes: "1 mes atras"', () => {
    const date = new Date(FIXED_NOW - 35 * 24 * 3600_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('1 mes atras')
  })

  it('30+ dias: "N meses atras"', () => {
    const date = new Date(FIXED_NOW - 90 * 24 * 3600_000).toISOString()
    expect(formatHistoryRelative(date)).toBe('3 meses atras')
  })

  it('data invalida retorna ""', () => {
    expect(formatHistoryRelative('not-a-date')).toBe('')
    expect(formatHistoryRelative('')).toBe('')
  })
})

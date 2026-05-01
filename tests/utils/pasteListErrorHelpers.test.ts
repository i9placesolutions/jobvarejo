import { describe, it, expect } from 'vitest'
import {
  getPasteHttpStatus,
  getPasteRetryAfterMs,
  isPasteRateLimitError,
  isTransientPasteError
} from '~/utils/pasteListErrorHelpers'

describe('getPasteHttpStatus', () => {
  it('le statusCode (Nuxt $fetch)', () => {
    expect(getPasteHttpStatus({ statusCode: 429 })).toBe(429)
  })

  it('le status (fetch nativo)', () => {
    expect(getPasteHttpStatus({ status: 503 })).toBe(503)
  })

  it('le response.status (alguns SDKs)', () => {
    expect(getPasteHttpStatus({ response: { status: 502 } })).toBe(502)
  })

  it('le data.statusCode', () => {
    expect(getPasteHttpStatus({ data: { statusCode: 404 } })).toBe(404)
  })

  it('prioriza statusCode > status > response.status', () => {
    const err = {
      statusCode: 429,
      status: 503,
      response: { status: 504 }
    }
    expect(getPasteHttpStatus(err)).toBe(429)
  })

  it('null/undefined/sem status → 0', () => {
    expect(getPasteHttpStatus(null)).toBe(0)
    expect(getPasteHttpStatus(undefined)).toBe(0)
    expect(getPasteHttpStatus({})).toBe(0)
    expect(getPasteHttpStatus(new Error('boom'))).toBe(0)
  })

  it('valor nao-numerico → 0', () => {
    expect(getPasteHttpStatus({ statusCode: 'abc' })).toBe(0)
  })
})

describe('getPasteRetryAfterMs', () => {
  it('Headers DOM com Retry-After (case insensitive via fallback)', () => {
    const headers = { get: (k: string) => k.toLowerCase() === 'retry-after' ? '5' : null }
    const err = { response: { headers } }
    expect(getPasteRetryAfterMs(err)).toBe(5000)
  })

  it('headers como objeto plain (lowercase key)', () => {
    const err = { response: { headers: { 'retry-after': '3' } } }
    expect(getPasteRetryAfterMs(err)).toBe(3000)
  })

  it('headers como objeto plain (Pascal-Case key)', () => {
    const err = { response: { headers: { 'Retry-After': '7' } } }
    expect(getPasteRetryAfterMs(err)).toBe(7000)
  })

  it('valor decimal: clampa em 500ms minimo', () => {
    const err = { response: { headers: { 'retry-after': '0.1' } } }
    expect(getPasteRetryAfterMs(err)).toBe(500)
  })

  it('valor 0/negativo → 0', () => {
    expect(getPasteRetryAfterMs({ response: { headers: { 'retry-after': '0' } } })).toBe(0)
    expect(getPasteRetryAfterMs({ response: { headers: { 'retry-after': '-5' } } })).toBe(0)
  })

  it('header ausente → 0', () => {
    expect(getPasteRetryAfterMs({ response: { headers: {} } })).toBe(0)
    expect(getPasteRetryAfterMs({})).toBe(0)
    expect(getPasteRetryAfterMs(null)).toBe(0)
  })

  it('header invalido (texto) → 0', () => {
    expect(getPasteRetryAfterMs({ response: { headers: { 'retry-after': 'not-a-number' } } })).toBe(0)
  })

  it('arredonda para inteiro', () => {
    const err = { response: { headers: { 'retry-after': '2.4567' } } }
    expect(getPasteRetryAfterMs(err)).toBe(2457)
  })

  it('Headers.get throw e absorvido (retorna 0)', () => {
    const headers = { get: () => { throw new Error('header access denied') } }
    const err = { response: { headers } }
    expect(getPasteRetryAfterMs(err)).toBe(0)
  })
})

describe('isPasteRateLimitError', () => {
  it('429 → true', () => {
    expect(isPasteRateLimitError({ statusCode: 429 })).toBe(true)
    expect(isPasteRateLimitError({ status: 429 })).toBe(true)
  })

  it('outros codigos → false', () => {
    expect(isPasteRateLimitError({ statusCode: 503 })).toBe(false)
    expect(isPasteRateLimitError({ statusCode: 200 })).toBe(false)
    expect(isPasteRateLimitError({})).toBe(false)
    expect(isPasteRateLimitError(null)).toBe(false)
  })
})

describe('isTransientPasteError', () => {
  it('502/503/504 → true', () => {
    expect(isTransientPasteError({ statusCode: 502 })).toBe(true)
    expect(isTransientPasteError({ statusCode: 503 })).toBe(true)
    expect(isTransientPasteError({ statusCode: 504 })).toBe(true)
  })

  it('4xx (exceto 429) → false', () => {
    expect(isTransientPasteError({ statusCode: 400 })).toBe(false)
    expect(isTransientPasteError({ statusCode: 404 })).toBe(false)
    expect(isTransientPasteError({ statusCode: 429 })).toBe(false) // rate limit nao e transient
  })

  it('500/501 (nao 502/503/504) → false', () => {
    expect(isTransientPasteError({ statusCode: 500 })).toBe(false)
    expect(isTransientPasteError({ statusCode: 501 })).toBe(false)
  })

  it('status 0 + mensagem de rede conhecida → true', () => {
    expect(isTransientPasteError({ message: 'Failed to fetch' })).toBe(true)
    expect(isTransientPasteError({ message: 'NetworkError when attempting to fetch' })).toBe(true)
    expect(isTransientPasteError({ message: 'Network changed' })).toBe(true)
    expect(isTransientPasteError({ message: '<no response>' })).toBe(true)
    expect(isTransientPasteError({ message: 'Load failed' })).toBe(true)
  })

  it('status 0 + mensagem desconhecida → false', () => {
    expect(isTransientPasteError({ message: 'Some validation error' })).toBe(false)
    expect(isTransientPasteError({})).toBe(false)
  })

  it('le mensagem de err.cause/err.statusMessage/err.data', () => {
    expect(isTransientPasteError({ statusMessage: 'failed to fetch' })).toBe(true)
    expect(isTransientPasteError({ cause: { message: 'load failed' } })).toBe(true)
    expect(isTransientPasteError({ data: { message: 'networkerror' } })).toBe(true)
  })
})

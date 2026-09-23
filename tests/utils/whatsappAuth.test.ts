import { describe, expect, it } from 'vitest'
import { hashWhatsAppCode } from '~/server/utils/auth-whatsapp'
import { isUazapiSendRejected } from '~/server/utils/uazapi'
import { formatBrazilWhatsApp, normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

describe('formatBrazilWhatsApp', () => {
  it('aplica máscara de celular e telefone fixo enquanto digita', () => {
    expect(formatBrazilWhatsApp('11987654321')).toBe('(11) 98765-4321')
    expect(formatBrazilWhatsApp('1133334444')).toBe('(11) 3333-4444')
    expect(formatBrazilWhatsApp('+55 (21) 98765-4321')).toBe('(21) 98765-4321')
  })

  it('limita a entrada a DDD e número nacional', () => {
    expect(formatBrazilWhatsApp('11987654321999')).toBe('(11) 98765-4321')
    expect(formatBrazilWhatsApp('')).toBe('')
  })
})

describe('normalizeBrazilWhatsApp', () => {
  it('normaliza números brasileiros com DDD para E.164', () => {
    expect(normalizeBrazilWhatsApp('(11) 99999-9999')).toBe('+5511999999999')
    expect(normalizeBrazilWhatsApp('55 21 98765-4321')).toBe('+5521987654321')
    expect(normalizeBrazilWhatsApp('+55 (21) 98765-4321')).toBe('+5521987654321')
  })

  it('rejeita números incompletos, DDD inválido e outros países', () => {
    expect(normalizeBrazilWhatsApp('99999-9999')).toBe('')
    expect(normalizeBrazilWhatsApp('(10) 99999-9999')).toBe('')
    expect(normalizeBrazilWhatsApp('+1 (212) 555-1212')).toBe('')
  })
})

describe('hashWhatsAppCode', () => {
  it('usa HMAC estável e separa propósito, número e código', () => {
    const secret = 'unit-test-secret'
    const expected = hashWhatsAppCode(secret, '+5511999999999', 'register', '123456')

    expect(expected).toHaveLength(64)
    expect(hashWhatsAppCode(secret, '+5511999999999', 'register', '123456')).toBe(expected)
    expect(hashWhatsAppCode(secret, '+5511999999999', 'link', '123456')).not.toBe(expected)
    expect(hashWhatsAppCode(secret, '+5511999999999', 'password_reset', '123456')).not.toBe(expected)
    expect(hashWhatsAppCode(secret, '+556435132144', 'register', '123456')).not.toBe(expected)
    expect(hashWhatsAppCode(secret, '+5511999999999', 'register', '654321')).not.toBe(expected)
  })
})

describe('isUazapiSendRejected', () => {
  it('aceita respostas HTTP 2xx válidas sem exigir um único formato de sucesso', () => {
    expect(isUazapiSendRejected({ response: { status: 'success' } })).toBe(false)
    expect(isUazapiSendRejected({ status: 'success', messageId: 'provider-id' })).toBe(false)
    expect(isUazapiSendRejected({ id: 'provider-id' })).toBe(false)
    expect(isUazapiSendRejected(null)).toBe(false)
  })

  it('reconhece rejeições explícitas da API', () => {
    expect(isUazapiSendRejected({ success: false })).toBe(true)
    expect(isUazapiSendRejected({ error: 'send rejected' })).toBe(true)
    expect(isUazapiSendRejected({ response: { status: 'not-sent' } })).toBe(true)
  })
})

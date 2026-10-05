import type { H3Event } from 'h3'
import catalog from '../../shared/whatsapp-admin/operations.json'
import { assertSafeExternalHttpUrl } from './url-safety'
import { isUazapiSendRejected } from './uazapi'
import { normalizeWhatsAppVoice } from './whatsapp-admin-audio'

export const whatsappOperations = catalog.operations
export const whatsappApiVersion = catalog.version
export const whatsappSuperAdminOperations = new Set(['updateWebhook', 'disconnectInstance', 'resetInstance', 'deleteInstance', 'updateProxyConfig', 'updateChatwootConfig'])
export const whatsappEvents = ['connection', 'history', 'messages', 'messages_update', 'newsletter_messages', 'status_posts', 'call', 'contacts', 'presence', 'groups', 'labels', 'chats', 'chat_labels', 'sender']

const activeStreams = new Map<string, number>()
export const reserveWhatsAppStream = (userId: string) => {
  const count = activeStreams.get(userId) || 0
  const total = [...activeStreams.values()].reduce((sum, value) => sum + value, 0)
  if (count >= 3 || total >= 24) throw createError({ statusCode: 429, statusMessage: 'Limite de conexões simultâneas do WhatsApp. Feche outras abas.' })
  activeStreams.set(userId, count + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const next = (activeStreams.get(userId) || 1) - 1
    if (next > 0) activeStreams.set(userId, next)
    else activeStreams.delete(userId)
  }
}

// Uma única origem/instância, definida no servidor; o cliente nunca escolhe credenciais.
export const whatsappAdminConfig = () => {
  const raw = String(process.env.JOBVAREJO_UAZAPI_URL || '').trim()
  const token = String(process.env.JOBVAREJO_UAZAPI_INSTANCE_TOKEN || '').trim()
  const adminToken = String(process.env.JOBVAREJO_UAZAPI_ADMIN_TOKEN || '').trim()
  if (!raw || !token) throw createError({ statusCode: 503, statusMessage: 'Configure a instância JobVarejo do WhatsApp no servidor.' })
  let base: URL
  try { base = new URL(assertSafeExternalHttpUrl(raw, { maxLength: 512 })) } catch {
    throw createError({ statusCode: 503, statusMessage: 'Endereço da instância WhatsApp inválido.' })
  }
  const allowed = String(process.env.JOBVAREJO_UAZAPI_ALLOWED_HOST || '').trim().toLowerCase()
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !(base.hostname === 'uazapi.com' || base.hostname.endsWith('.uazapi.com') || base.hostname === allowed)) {
    throw createError({ statusCode: 503, statusMessage: 'Endereço da instância WhatsApp não autorizado.' })
  }
  return { base: base.toString().replace(/\/+$/, ''), token, adminToken }
}

const secretKey = /token|authorization|api[_-]?key|secret|password|send_?payload|^proxy$/i
export const sanitizeWhatsApp = (value: unknown, secrets: string[] = []): any => {
  if (Array.isArray(value)) return value.map(item => sanitizeWhatsApp(item, secrets))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKey.test(key)).map(([key, item]) => [key, sanitizeWhatsApp(item, secrets)]))
  if (typeof value === 'string') {
    let clean = secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join('[protegido]'), value)
    clean = clean.replace(/([?&](?:[^=&\s]*(?:token|secret|password|api[_-]?key|authorization)[^=&\s]*)=)[^&#\s]+/gi, '$1[protegido]')
    clean = clean.replace(/(https?:\/\/)[^/\s@]+:[^/\s@]+@/gi, '$1[protegido]@')
    return clean
  }
  return value
}

export const assertWhatsAppSameOrigin = (event: H3Event) => {
  const origin = getHeader(event, 'origin')
  if (getHeader(event, 'sec-fetch-site') === 'cross-site') throw createError({ statusCode: 403, statusMessage: 'Origem não autorizada.' })
  if (!origin) return // Clientes de serviço autenticados não enviam Origin.
  const host = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host')
  try {
    if (new URL(origin).host !== host) throw new Error('origin')
  } catch { throw createError({ statusCode: 403, statusMessage: 'Origem não autorizada.' }) }
}

export const getWhatsAppOperation = (id: string) => {
  const operation = whatsappOperations.find(item => item.id === id)
  if (!operation || operation.id === 'subscribeSSE') throw createError({ statusCode: 400, statusMessage: 'Operação WhatsApp não permitida.' })
  return operation
}

export const validateWhatsAppSchema = (value: any, schema: any, field = 'body', depth = 0): void => {
  if (depth > 20) throw createError({ statusCode: 400, statusMessage: 'Estrutura demasiado profunda.' })
  const fail = () => { throw createError({ statusCode: 400, statusMessage: `Campo inválido: ${field.slice(0,120)}` }) }
  if (value === null && schema.nullable) return
  if (schema.oneOf || schema.anyOf) {
    const variants = schema.oneOf || schema.anyOf
    const matches = variants.filter((variant: any) => {
      try { validateWhatsAppSchema(value, variant, field, depth + 1); return true } catch { return false }
    }).length
    if (schema.oneOf ? matches !== 1 : matches < 1) fail()
  }
  for (const variant of schema.allOf || []) validateWhatsAppSchema(value, variant, field, depth + 1)
  if (schema.enum && !schema.enum.includes(value)) fail()
  if (schema.type === 'null' && value !== null) fail()
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail()
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail()
    for (const item of value) validateWhatsAppSchema(item, schema.items || {}, field, depth + 1)
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value)) fail()
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail()
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail()
  else if (schema.type === 'string' && typeof value !== 'string') fail()
  // Ramos de oneOf/anyOf podem restringir propriedades sem repetir type: object.
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) if (!Object.hasOwn(value, required) || value[required] === undefined) fail()
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.hasOwn(value, key)) validateWhatsAppSchema(value[key], child, `${field}.${key}`, depth + 1)
  }
  if (typeof value === 'string') {
    if ((schema.minLength !== undefined && value.length < schema.minLength) || (schema.maxLength !== undefined && value.length > schema.maxLength)) fail()
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail()
  }
  if (Array.isArray(value) && ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems))) fail()
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) fail()
}

export const buildWhatsAppRequest = (operation: ReturnType<typeof getWhatsAppOperation>, input: any, base: string) => {
  let path = operation.path
  const query = new URLSearchParams()
  const body = input.body ?? {}
  for (const parameter of operation.parameters as any[]) {
    const source = parameter.in === 'path' ? input.pathParams : input.query
    const value = source?.[parameter.name]
    if (parameter.required && (value === undefined || value === '')) throw createError({ statusCode: 400, statusMessage: `Parâmetro obrigatório: ${parameter.name}` })
    if (value === undefined) continue
    validateWhatsAppSchema(value, parameter.schema, parameter.name)
    if (parameter.in === 'path') {
      if (value === '.' || value === '..') throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(value)))
    }
    if (parameter.in === 'query') query.set(parameter.name, String(value))
  }
  // Nenhum header ou parâmetro de autenticação informado pelo navegador é encaminhado.
  if (operation.method !== 'GET') validateWhatsAppSchema(body, operation.bodySchema)
  if (JSON.stringify(body).length > 18_000_000) throw createError({ statusCode: 413, statusMessage: 'Arquivo acima do limite de 12 MB.' })
  return { url: `${base}${path}${query.size ? `?${query}` : ''}`, body: operation.method === 'GET' ? undefined : JSON.stringify(body) }
}

const readWhatsAppJson = async (response: Response) => {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 24_000_000) throw createError({ statusCode: 413, statusMessage: 'Resposta WhatsApp acima do limite. Reduza a paginação ou o arquivo.' })
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { await reader.cancel().catch(() => {}) }
}

export const callWhatsApp = async (operationId: string, input: any = {}, role = 'admin') => {
  const operation = getWhatsAppOperation(operationId)
  const config = whatsappAdminConfig()
  if (whatsappSuperAdminOperations.has(operationId) && role !== 'super_admin') throw createError({ statusCode: 403, statusMessage: 'Esta configuração exige super administrador.' })
  if (operation.adminTokenRequired && (role !== 'super_admin' || !config.adminToken)) throw createError({ statusCode: 403, statusMessage: 'Esta função exige super administrador e credencial administrativa do servidor UAZAPI.' })
  if (operationId === 'sendMedia') {
    validateWhatsAppSchema(input.body || {}, operation.bodySchema)
    input = { ...input, body: await normalizeWhatsAppVoice(input.body) }
  }
  const request = buildWhatsAppRequest(operation, input, config.base)
  try {
    const response = await fetch(request.url, {
      method: operation.method, headers: { 'content-type': 'application/json', [operation.adminTokenRequired ? 'admintoken' : 'token']: operation.adminTokenRequired ? config.adminToken : config.token },
      body: request.body, redirect: 'error', signal: AbortSignal.timeout(45_000)
    })
    if (!response.ok) throw createError({ statusCode: response.status >= 500 ? 502 : response.status, statusMessage: `UAZAPI recusou a operação (HTTP ${response.status}).` })
    const result = await readWhatsAppJson(response)
    if (isUazapiSendRejected(result)) throw createError({ statusCode: 502, statusMessage: 'UAZAPI informou falha na operação.' })
    return sanitizeWhatsApp(result, [config.token, config.adminToken])
  } catch (error: any) {
    if (error?.statusCode) throw error
    // URLs, tokens e payloads privados não aparecem em erros ou logs.
    throw createError({ statusCode: 502, statusMessage: 'Não foi possível concluir a operação na UAZAPI. Consulte o histórico antes de reenviar.' })
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder } from '../../shared/whatsapp-creation'
import { newConversationState } from '../../server/utils/whatsapp-creation/conversation'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  tx: vi.fn(),
  resolveAccount: vi.fn(),
  sign: vi.fn(),
  headers: vi.fn()
}))

vi.mock('../../server/utils/postgres', () => ({
  pgQuery: mocks.query,
  pgTx: mocks.tx
}))
vi.mock('../../server/utils/whatsapp-creation/access', () => ({ resolveWhatsAppAccount: mocks.resolveAccount }))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({
  validateProviderEvent: vi.fn(),
  signOwnedArtifact: mocks.sign,
  authenticateCreationProvider: vi.fn()
}))
vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({ listCreationHeaders: mocks.headers }))

const {
  acknowledgeCreationOutbound,
  assertCreationAccess,
  beginCreationOrder,
  claimCreationOutbound,
  queueCreationSend,
  receiveCreationReceipt
} = await import('../../server/utils/whatsapp-creation/repository')

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherOwnerId = '22222222-2222-4222-8222-222222222222'
const oldOrderId = '33333333-3333-4333-8333-333333333333'
const conversationId = '44444444-4444-4444-8444-444444444444'
const eventId = '55555555-5555-4555-8555-555555555555'
const outboxId = '66666666-6666-4666-8666-666666666666'
const leaseToken = 'lease-token-123'

function account(id = ownerId, role: 'user' | 'editor' = 'user', editorPermissions: any = {}) {
  return { ok: true, senderPhone: '+5511999999999', businessProfile: {}, user: {
    id, actorId: id, accountId: id, email: 'owner@example.test', role, editorPermissions, user_metadata: { name: 'Rafa' }
  } }
}

function deliveredState(orderId = oldOrderId) {
  const order = createOrder({
    id: orderId,
    identity: { accountId: ownerId, normalizedSender: '+5511999999999' },
    kind: 'encarte', theme: 'Fecha Mês', formats: [{ id: 'stories', width: 1080, height: 1920 }],
    division: 'single', products: []
  })
  return { ...newConversationState(), phase: 'delivered' as const, draft: { ...newConversationState().draft, kind: 'encarte' as const, theme: 'Fecha Mês', formats: ['stories'] }, order }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('JOBVAREJO_UAZAPI_INSTANCE_ID', 'instance-test')
  mocks.resolveAccount.mockResolvedValue(account())
  mocks.sign.mockResolvedValue('https://signed.test/file')
  mocks.headers.mockResolvedValue({ headers: [], hasMore: false, missingTheme: true })
})

describe('persistência e propriedade da criação WhatsApp', () => {
  it('grava o índice de cada imagem para preservar a ordem de envio', async () => {
    const calls: any[][] = []
    const client = { query: vi.fn(async (_sql: string, params: any[]) => { calls.push(params); return { rows: [] } }) }
    await queueCreationSend(client as any, conversationId, ownerId, oldOrderId, newConversationState(), [
      { type: 'image', text: '1', key: 'headers/1.png' },
      { type: 'image', text: '2', key: 'headers/2.png' },
      { type: 'image', text: '3', key: 'headers/3.png' }
    ], 'batch')
    expect(calls.map(params => JSON.parse(params[5]).sendIndex)).toEqual([0, 1, 2])
    expect(calls.map(params => JSON.parse(params[5]).text)).toEqual(['1', '2', '3'])
  })

  it('grava receipt recebido antes do ACK e conclui o ACK como entregue', async () => {
    const ledger = new Set<string>()
    const calls: string[] = []
    let outboxStatus = 'sending'
    const client = { query: vi.fn(async (query: string, params: any[] = []) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      calls.push(sql)
      if (sql.startsWith('INSERT INTO public.whatsapp_creation_receipts')) {
        ledger.add(String(params[2]))
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_outbox b SET status=\'delivered\'')) {
        return { rows: [], rowCount: 0 }
      }
      if (sql.startsWith('SELECT * FROM public.whatsapp_creation_outbox') || sql.startsWith('SELECT b.*,c.instance_id,c.sender_phone FROM public.whatsapp_creation_outbox')) {
        return { rows: [{ id: outboxId, status: outboxStatus, order_id: oldOrderId, owner_id: ownerId, instance_id: 'instance-test', sender_phone: '+5511999999999' }] }
      }
      if (sql.startsWith('SELECT message_id FROM public.whatsapp_creation_receipts')) {
        return { rows: ledger.has(String(params[2])) ? [{ message_id: params[2] }] : [] }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_outbox SET status=')) {
        outboxStatus = String(params[2])
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_orders')) return { rows: [], rowCount: 1 }
      throw new Error(`Unexpected SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))

    const receipt = await receiveCreationReceipt({
      type: 'ReadReceipt', state: 'delivered',
      event: { IsGroup: false, IsFromMe: true, chatid: '5511999999999@s.whatsapp.net', MessageIDs: ['provider-message-1'] }
    })
    expect(receipt).toMatchObject({ ok: true, receipts: 0 })
    expect(ledger.has('provider-message-1')).toBe(true)

    const ack = await acknowledgeCreationOutbound(outboxId, leaseToken, false, { messageid: 'provider-message-1' })
    expect(ack).toMatchObject({ ok: true, status: 'delivered', providerMessageId: 'provider-message-1' })
    expect(outboxStatus).toBe('delivered')
    const ledgerInsert = calls.findIndex(sql => sql.startsWith('INSERT INTO public.whatsapp_creation_receipts'))
    const ackLedgerRead = calls.reduce((last, sql, index) => sql.startsWith('SELECT message_id FROM public.whatsapp_creation_receipts') ? index : last, -1)
    expect(ledgerInsert).toBeGreaterThanOrEqual(0)
    expect(ackLedgerRead).toBeGreaterThan(ledgerInsert)
  })

  it('cria novo pedido com ID e owner novos sem alterar o pedido concluído anterior', async () => {
    let currentOrderId = oldOrderId
    const existingState = deliveredState()
    let insertedOrderId = ''
    const statements: Array<{ sql: string; params: any[] }> = []
    const client = { query: vi.fn(async (query: string, params: any[] = []) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      statements.push({ sql, params })
      if (sql.startsWith('SELECT e.id event_id')) {
        const selectedState = currentOrderId === oldOrderId ? existingState : newConversationState()
        return { rows: [{ event_id: eventId, payload: {}, conversation_id: conversationId, owner_id: ownerId,
          sender_phone: '+5511999999999', current_order_id: currentOrderId, state: selectedState }] }
      }
      if (sql.startsWith('SELECT id FROM public.whatsapp_creation_conversations')) return { rows: [{ id: conversationId }] }
      if (sql.startsWith('INSERT INTO public.whatsapp_creation_orders')) {
        insertedOrderId = String(params[0])
        expect(insertedOrderId).not.toBe(oldOrderId)
        expect(params[2]).toBe(ownerId)
        return { rows: [{ id: insertedOrderId }] }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_conversations SET current_order_id=')) {
        expect(params[2]).toBe(ownerId)
        currentOrderId = String(params[1])
        return { rows: [{ id: conversationId }], rowCount: 1 }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))
    mocks.resolveAccount.mockResolvedValue(account())

    const result = await beginCreationOrder(eventId, leaseToken)

    expect(insertedOrderId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(result).toMatchObject({ current_order_id: insertedOrderId, owner_id: ownerId, state: { phase: 'collecting' } })
    expect(currentOrderId).toBe(insertedOrderId)
    expect(statements.some(({ sql }) => sql.startsWith('DELETE FROM public.whatsapp_creation_orders'))).toBe(false)
    expect(statements.some(({ sql, params }) => sql.startsWith('UPDATE public.whatsapp_creation_orders') && params[0] === oldOrderId)).toBe(false)
    expect(statements.filter(({ sql }) => sql.startsWith('INSERT INTO public.whatsapp_creation_orders'))).toHaveLength(1)
  })

  it('cancela um pedido ativo e cria um único pedido vazio por evento, sem afetar envios já iniciados', async () => {
    const active: any = deliveredState()
    active.phase = 'data'
    active.order = createOrder({
      id: oldOrderId,
      identity: { accountId: ownerId, normalizedSender: '+5511999999999' },
      kind: 'encarte', theme: 'Fecha Mês', formats: [{ id: 'stories', width: 1080, height: 1920 }],
      division: 'single', products: []
    })
    active.draft = { ...active.draft, products: [], validity: undefined }
    let currentOrderId = oldOrderId
    const states = new Map<string, any>([[oldOrderId, active]])
    const statements: Array<{ sql: string; params: any[] }> = []
    let inserted = 0
    const client = { query: vi.fn(async (query: string, params: any[] = []) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      statements.push({ sql, params })
      if (sql.startsWith('SELECT e.id event_id')) return { rows: [{ event_id: eventId, payload: {}, conversation_id: conversationId, owner_id: ownerId,
        sender_phone: '+5511999999999', current_order_id: currentOrderId, state: states.get(currentOrderId) }] }
      if (sql.startsWith('SELECT id FROM public.whatsapp_creation_conversations')) return { rows: [{ id: conversationId }] }
      if (sql.startsWith('UPDATE public.whatsapp_creation_orders SET state=')) {
        states.set(String(params[0]), JSON.parse(String(params[2])))
        return { rows: [], rowCount: 1 }
      }
      if (sql.startsWith("UPDATE public.whatsapp_creation_outbox SET status='failed'")) return { rows: [], rowCount: 2 }
      if (sql.startsWith("UPDATE public.whatsapp_creation_theme_requests SET status='cancelled'")) return { rows: [], rowCount: 0 }
      if (sql.startsWith('INSERT INTO public.whatsapp_creation_orders')) {
        inserted++
        const id = String(params[0]); states.set(id, JSON.parse(String(params[4])))
        return { rows: [{ id }] }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_conversations SET current_order_id=')) {
        expect(params[3]).toBe(oldOrderId)
        currentOrderId = String(params[1])
        return { rows: [{ id: conversationId }], rowCount: 1 }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))

    const first = await beginCreationOrder(eventId, leaseToken, 'encarte', { cancelCurrent: true })
    const retry = await beginCreationOrder(eventId, leaseToken, 'encarte', { cancelCurrent: true })

    expect(first.current_order_id).toBe(currentOrderId)
    expect(retry.current_order_id).toBe(first.current_order_id)
    expect(retry.state.startedByEventId).toBe(eventId)
    expect(inserted).toBe(1)
    expect(states.get(oldOrderId)?.phase).toBe('cancelled')
    expect(states.get(oldOrderId)?.runtime).toBeUndefined()
    expect(statements.some(({ sql }) => sql.includes("status='pending'"))).toBe(true)
    expect(statements.some(({ sql }) => /status IN \('accepted','delivered','sending'\)/i.test(sql))).toBe(false)
  })

  it('mantém criação do Estúdio disponível para a conta e bloqueia envio após revogar create do editor', async () => {
    expect(() => assertCreationAccess(account(ownerId, 'user').user as any, 'studio')).not.toThrow()

    const state = { ...newConversationState(), draft: { ...newConversationState().draft, kind: 'encarte' as const } }
    let denial = ''
    const client = { query: vi.fn(async (query: string) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      if (sql.startsWith('UPDATE public.whatsapp_creation_outbox SET status=\'uncertain\'')) return { rows: [], rowCount: 0 }
      if (sql.startsWith("UPDATE public.whatsapp_creation_ingress SET status='uncertain'")) return { rows: [], rowCount: 0 }
      if (sql.startsWith('SELECT * FROM public.whatsapp_creation_ingress WHERE status=\'pending\'')) return { rows: [] }
      if (sql.startsWith('SELECT b.*,c.sender_phone,o.state FROM public.whatsapp_creation_outbox')) {
        return { rows: [{
          id: outboxId, status: 'pending', owner_id: ownerId, conversation_id: conversationId,
          order_id: oldOrderId, sender_phone: '+5511999999999', payload: { type: 'text', text: 'review' }, state
        }] }
      }
      if (sql.startsWith('UPDATE public.whatsapp_creation_outbox SET status=\'failed\',error=\'account_permission_changed\'')) {
        denial = 'account_permission_changed'
        return { rows: [], rowCount: 1 }
      }
      throw new Error(`Unexpected SQL: ${sql}`)
    }) }
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(client))
    mocks.resolveAccount.mockResolvedValue(account(ownerId, 'editor', { encartes: { view: true } }))

    const result = await claimCreationOutbound()

    expect(result).toMatchObject({ ok: true, claimed: false })
    expect(denial).toBe('account_permission_changed')
    expect(mocks.sign).not.toHaveBeenCalled()
  })
})

describe('envio de encarte já salvo na conta', () => {
  const projectId = 'aaaaaaaa-0000-4000-8000-000000000001'
  const key = `whatsapp-creation/${ownerId}/account-projects/${projectId}/${'a'.repeat(40)}.png`
  const chosenState = () => ({ ...newConversationState(), accountProject: { projectId, projectName: 'Açougue' } })
  const item = (overrides: Record<string, unknown> = {}) => ({ type: 'image' as const, text: '', key, purpose: 'account_project' as const, accountProjectId: projectId, scope: 'account_project' as const, formatId: 'pagina-1', ...overrides })

  it('só enfileira PNG do projeto escolhido, na pasta do dono', async () => {
    const client = { query: vi.fn(async () => ({ rows: [] })) }
    await queueCreationSend(client as any, conversationId, ownerId, oldOrderId, chosenState(), [item(), item({ type: 'document' })], 'ok')
    expect(client.query).toHaveBeenCalledTimes(2)
    for (const bad of [
      item({ key: `whatsapp-creation/${otherOwnerId}/account-projects/${projectId}/${'a'.repeat(40)}.png` }),
      item({ accountProjectId: 'bbbbbbbb-0000-4000-8000-000000000002', key: `whatsapp-creation/${ownerId}/account-projects/bbbbbbbb-0000-4000-8000-000000000002/x.png` }),
      item({ key: `projects/${ownerId}/${projectId}/thumb.png` }),
      item({ type: 'video' })
    ]) {
      await expect(queueCreationSend(client as any, conversationId, ownerId, oldOrderId, chosenState(), [bad as any], 'bad')).rejects.toMatchObject({ statusCode: 409 })
    }
    await expect(queueCreationSend(client as any, conversationId, ownerId, oldOrderId, newConversationState(), [item()], 'none')).rejects.toMatchObject({ statusCode: 409 })
  })

  function outboxClient(payload: Record<string, unknown>, failures: string[]) {
    return { query: vi.fn(async (query: string) => {
      const sql = query.replace(/\s+/g, ' ').trim()
      if (sql.startsWith("UPDATE public.whatsapp_creation_outbox SET status='uncertain'")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("UPDATE public.whatsapp_creation_ingress SET status='uncertain'")) return { rows: [], rowCount: 0 }
      if (sql.startsWith("SELECT * FROM public.whatsapp_creation_ingress WHERE status='pending'")) return { rows: [] }
      if (sql.startsWith('SELECT b.*,c.sender_phone,o.state FROM public.whatsapp_creation_outbox')) {
        return { rows: [{ id: outboxId, status: 'pending', owner_id: ownerId, conversation_id: conversationId, order_id: oldOrderId, sender_phone: '+5511999999999', payload, state: chosenState() }] }
      }
      if (sql.startsWith("UPDATE public.whatsapp_creation_outbox SET status='failed'")) { failures.push(sql); return { rows: [], rowCount: 1 } }
      if (sql.startsWith("UPDATE public.whatsapp_creation_outbox SET status='sending'")) return { rows: [], rowCount: 1 }
      throw new Error(`Unexpected SQL: ${sql}`)
    }) }
  }

  it('revalida o dono do projeto ao enviar e usa a permissão de encartes mesmo sem tipo no rascunho', async () => {
    const failures: string[] = []
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(outboxClient(item({ type: 'document' }), failures)))
    mocks.query.mockResolvedValue({ rows: [{ id: projectId, name: 'Açougue' }] })
    const result: any = await claimCreationOutbound()
    expect(failures).toEqual([])
    expect(mocks.query.mock.calls[0]![1]).toEqual([projectId, ownerId])
    expect(mocks.sign).toHaveBeenCalledWith(key, ownerId, undefined)
    expect(result.send.body).toMatchObject({ type: 'document', file: 'https://signed.test/file', docName: 'encarte-pagina-1.png' })
  })

  it('falha o envio quando o projeto não pertence mais à conta', async () => {
    const failures: string[] = []
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(outboxClient(item(), failures)))
    mocks.query.mockResolvedValue({ rows: [] })
    const result = await claimCreationOutbound()
    expect(result).toMatchObject({ ok: true, claimed: false })
    expect(failures[0]).toContain("error='account_project_unavailable'")
    expect(mocks.sign).not.toHaveBeenCalled()
  })

  it('não usa a permissão de encartes para envio comum sem tipo', async () => {
    const failures: string[] = []
    mocks.tx.mockImplementation(async (callback: (client: any) => unknown) => callback(outboxClient({ type: 'text', text: 'oi' }, failures)))
    const result = await claimCreationOutbound()
    expect(result).toMatchObject({ ok: true, claimed: false })
    expect(failures[0]).toContain("error='account_permission_changed'")
  })
})

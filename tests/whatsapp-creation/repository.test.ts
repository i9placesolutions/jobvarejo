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
        return { rows: [], rowCount: 1 }
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

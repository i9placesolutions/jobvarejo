import { createServer, type Server } from 'node:http'
import * as h3 from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { owner } from './fixtures'
vi.mock('../../server/utils/auth-db', () => ({ getProfileById: async () => ({ id: owner, is_active: true, role: 'super_admin' }) }))
vi.mock('../../server/utils/work-design/repository', () => ({ workDatabaseReady: async () => true }))
vi.mock('../../server/utils/work-design/tools', () => ({
  workDesignTools: [{ name: 'list_pending_design_jobs', inputSchema: { type: 'object', properties: {} } }],
  callWorkDesignTool: async (account: string) => ({ content: [{ type: 'text', text: JSON.stringify({ account, pending: [] }) }] })
}))
let server: Server, base: string
const token = 'work-only-test-credential-not-real-'.repeat(2)
beforeAll(async () => {
  for (const name of ['defineEventHandler', 'setResponseHeader', 'setResponseStatus', 'getHeader', 'readBody', 'createError'] as const)
    vi.stubGlobal(name, h3[name])
  vi.stubEnv('WORK_DESIGN_ENABLED', 'true'); vi.stubEnv('WORK_DESIGN_PILOT_IDS', owner)
  vi.stubEnv('WORK_DESIGN_WORKER_OWNER_ID', owner); vi.stubEnv('WORK_DESIGN_WORKER_TOKEN', token)
  vi.stubEnv('WORK_DESIGN_N8N_TOKEN', 'n8n-only-not-the-work-token-'.repeat(2))
  const handler = (await import('../../server/api/work-design/mcp')).default
  server = createServer(h3.toNodeListener(h3.createApp().use('/mcp', handler)))
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${(server.address() as any).port}/mcp`
})
afterAll(async () => { await new Promise<void>(done => server.close(() => done())); vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const post = (body: any, headers: Record<string, string> = {}) => fetch(base, { method: 'POST', headers: {
  'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body) })
describe('transporte MCP HTTP com autenticação real do piloto (perfil/fila simulados)', () => {
  it('inicializa, descobre e chama ferramenta com conta determinada pelo servidor', async () => {
    const init = await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })).json() as any
    expect(init.result.protocolVersion).toBe('2025-11-25')
    const list = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json() as any
    expect(list.result.tools[0].name).toBe('list_pending_design_jobs')
    const call = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_pending_design_jobs', arguments: {} } })).json() as any
    expect(JSON.parse(call.result.content[0].text).account).toBe(owner)
  })
  it('não aceita token n8n, credencial errada, origem estranha ou protocolo desconhecido', async () => {
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
    expect((await post(request, { Authorization: 'Bearer incorrect' })).status).toBe(401)
    expect((await post(request, { Authorization: 'Bearer ' + 'n8n-only-not-the-work-token-'.repeat(2) })).status).toBe(401)
    expect((await post(request, { Origin: 'https://attacker.invalid' })).status).toBe(403)
    expect((await post(request, { 'MCP-Protocol-Version': 'invalid' })).status).toBe(400)
  })
  it('recusa métodos/formatos indevidos e aceita notificação sem corpo de resposta', async () => {
    const wrong = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'other_tool' } })).json() as any
    expect(wrong.error.code).toBe(-32602)
    const notification = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(notification.status).toBe(202); expect(await notification.text()).toBe('')
    expect((await fetch(base, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(405)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountProjectSummary } from '../../server/utils/whatsapp-creation/account-projects'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  headers: vi.fn(),
  productCandidates: vi.fn(),
  storageBytes: vi.fn(),
  productReview: vi.fn()
}))

vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query, pgTx: vi.fn() }))
vi.mock('../../server/utils/whatsapp-creation/catalog', () => ({
  listCreationHeaders: mocks.headers,
  listProductCandidates: mocks.productCandidates
}))
vi.mock('../../server/utils/whatsapp-creation/media', () => ({ ownedStorageBytes: mocks.storageBytes }))
vi.mock('../../server/utils/whatsapp-creation/product-review', () => ({ createProductReviewBoards: mocks.productReview }))

const {
  accountProjectChoiceNumber, isAccountProjectRequest, listAccountProjects, ownedThumbnailKey,
  parseAccountProjectQuery, selectAccountProjects, findOwnedAccountProject
} = await import('../../server/utils/whatsapp-creation/account-projects')
const { advanceConversation, newConversationState, normalizeConversationIntent } = await import('../../server/utils/whatsapp-creation/conversation')

const ownerId = '11111111-1111-4111-8111-111111111111'
const otherOwnerId = '22222222-2222-4222-8222-222222222222'
const orderId = '33333333-3333-4333-8333-333333333333'
const now = new Date('2026-10-06T15:00:00-03:00')

const project = (id: string, name: string, updatedAt: string, extra: { thumbnailKey?: string } = {}): AccountProjectSummary => ({
  id, name, updatedAt, themes: [], pageNames: [], pageCount: 1, ...extra
})
const acougue = project('aaaaaaaa-0000-4000-8000-000000000001', 'Açougue de Primeira', '2026-10-04T12:00:00.000Z', { thumbnailKey: `projects/${ownerId}/a/thumb.png` })
const tercaQuarta = project('aaaaaaaa-0000-4000-8000-000000000002', 'Terça e Quarta Verde', '2026-10-05T18:00:00.000Z', { thumbnailKey: `projects/${ownerId}/b/thumb.png` })
const fimDeSemana = project('aaaaaaaa-0000-4000-8000-000000000003', 'Fim de Semana', '2026-10-06T10:00:00.000Z')
const tercaAntigo = project('aaaaaaaa-0000-4000-8000-000000000004', 'Terça Verde', '2026-09-20T10:00:00.000Z')

function input(state = newConversationState(), text: string, list = vi.fn(async (_accountId: string) => [fimDeSemana, tercaQuarta, acougue, tercaAntigo])) {
  return { state, proposal: { action: 'update' as const }, text, accountId: ownerId, sender: '+5511999999999', orderId, name: 'Rafa', listAccountProjects: list }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
})

describe('intenção “encarte que já está na conta”', () => {
  it.each([
    'me manda o encarte de terça e quarta que fiz ontem',
    'quero aquele encarte do açougue que está na minha conta',
    'manda o último encarte',
    'Me envia o tabloide que eu fiz hoje',
    'cadê meus encartes? quero o de fim de semana'
  ])('reconhece “%s”', text => {
    expect(isAccountProjectRequest(text)).toBe(true)
  })

  it.each([
    'faz um encarte de açougue para o fim de semana',
    'quero um encarte novo de hortifruti',
    'manda a imagem',
    'arroz 19,90 e feijão 8,99',
    'cria outro encarte igual aquele'
  ])('não confunde “%s” com busca na conta', text => {
    expect(isAccountProjectRequest(text)).toBe(false)
  })

  it('extrai termos, data e recência sem inventar filtros', () => {
    expect(parseAccountProjectQuery('me manda o encarte de terça e quarta que fiz ontem', now)).toEqual({
      terms: ['terca', 'quarta'], latest: false, dateRange: { from: '2026-10-05', to: '2026-10-05', label: 'ontem' }
    })
    expect(parseAccountProjectQuery('manda o último encarte', now)).toEqual({ terms: [], latest: true })
    expect(parseAccountProjectQuery('quero aquele encarte do açougue que está na minha conta', now).terms).toEqual(['acougue'])
  })

  it('normaliza a ação do modelo e recusa account_project em pedido de criação', () => {
    const state = newConversationState()
    expect(normalizeConversationIntent({ action: 'update' }, 'manda o último encarte', state).action).toBe('account_project')
    expect(normalizeConversationIntent({ action: 'account_project' }, 'faz um encarte novo de açougue', state).action).toBe('update')
  })
})

describe('seleção dos encartes da conta', () => {
  const all = [fimDeSemana, tercaQuarta, acougue, tercaAntigo]

  it('usa direto quando um único encarte combina com o pedido', () => {
    expect(selectAccountProjects(all, parseAccountProjectQuery('quero aquele encarte do açougue que está na minha conta', now))).toEqual({ kind: 'direct', project: acougue })
    expect(selectAccountProjects(all, parseAccountProjectQuery('me manda o encarte de terça e quarta que fiz ontem', now))).toEqual({ kind: 'direct', project: tercaQuarta })
    expect(selectAccountProjects(all, parseAccountProjectQuery('manda o último encarte', now))).toEqual({ kind: 'direct', project: fimDeSemana })
  })

  it('pede para escolher quando há vários candidatos', () => {
    const selection = selectAccountProjects(all, parseAccountProjectQuery('manda o encarte da terça que está na minha conta', now))
    expect(selection).toMatchObject({ kind: 'choose', unmatched: false })
    expect(selection.kind === 'choose' && selection.projects.map(item => item.id)).toEqual([tercaQuarta.id, tercaAntigo.id])
  })

  it('mostra os mais recentes quando nada combina e informa conta vazia', () => {
    expect(selectAccountProjects(all, parseAccountProjectQuery('quero o encarte de páscoa que fiz', now))).toMatchObject({ kind: 'choose', unmatched: true })
    expect(selectAccountProjects([], parseAccountProjectQuery('manda o último encarte', now))).toEqual({ kind: 'empty' })
  })

  it('entende a escolha numerada, por ordinal ou pelo nome', () => {
    const choices = [tercaQuarta, acougue, fimDeSemana].map(item => ({ projectId: item.id, name: item.name }))
    expect(accountProjectChoiceNumber('2', choices)).toBe(2)
    expect(accountProjectChoiceNumber('o segundo', choices)).toBe(2)
    expect(accountProjectChoiceNumber('opção 3', choices)).toBe(3)
    expect(accountProjectChoiceNumber('o do açougue', choices)).toBe(2)
    expect(accountProjectChoiceNumber('9', choices)).toBeUndefined()
    expect(accountProjectChoiceNumber('arroz 19,90', choices)).toBeUndefined()
  })
})

describe('busca restrita ao dono', () => {
  it('lista só projetos do próprio usuário que não são modelos', async () => {
    mocks.query.mockResolvedValue({ rows: [{
      id: acougue.id, name: 'Açougue', created_at: '2026-10-04T12:00:00Z', updated_at: '2026-10-04T12:00:00Z',
      preview_url: `projects/${otherOwnerId}/x/preview.png`, category: 'Açougue', pages: [{ name: 'Página 1', theme: 'Carnes', thumbnail: `/api/storage/p?key=projects/${ownerId}/${acougue.id}/thumb.png` }]
    }] })
    const projects = await listAccountProjects(ownerId)
    const [sql, params] = mocks.query.mock.calls[0]!
    expect(sql).toMatch(/where project\.user_id = \$1 and coalesce\(project\.is_template, false\) = false/)
    expect(sql).toMatch(/order by project\.updated_at desc/)
    expect(params).toEqual([ownerId])
    expect(projects[0]).toMatchObject({ id: acougue.id, themes: ['Açougue', 'Carnes'], thumbnailKey: `projects/${ownerId}/${acougue.id}/thumb.png` })
  })

  it('não aceita miniatura de outra conta', () => {
    expect(ownedThumbnailKey(ownerId, [`/api/storage/p?key=projects/${otherOwnerId}/p/thumb.png`, `projects/${otherOwnerId}/p/x.png`])).toBeUndefined()
    expect(ownedThumbnailKey(ownerId, [`whatsapp-creation/${ownerId}/o/r1/a.png`])).toBe(`whatsapp-creation/${ownerId}/o/r1/a.png`)
  })

  it('confirma o dono ao buscar um projeto por id', async () => {
    mocks.query.mockResolvedValue({ rows: [] })
    expect(await findOwnedAccountProject(ownerId, 'not-a-uuid')).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()
    expect(await findOwnedAccountProject(ownerId, acougue.id)).toBeNull()
    expect(mocks.query.mock.calls[0]![1]).toEqual([acougue.id, ownerId])
  })
})

describe('conversa', () => {
  it('com um encarte claro agenda o envio e guarda o projectId', async () => {
    const list = vi.fn(async (_accountId: string) => [fimDeSemana, tercaQuarta, acougue])
    const result = await advanceConversation(input(newConversationState(), 'quero aquele encarte do açougue que está na minha conta', list))
    expect(list).toHaveBeenCalledWith(ownerId)
    expect(result.generate).toBe(false)
    expect(result.accountProjectJob).toMatchObject({ projectId: acougue.id })
    expect(result.state.accountProject).toMatchObject({ projectId: acougue.id, projectName: acougue.name, job: { projectId: acougue.id, token: result.accountProjectJob!.token } })
    expect(result.state.phase).toBe('collecting')
    expect(result.state.draft).toEqual(newConversationState().draft)
    expect(result.send).toEqual([expect.objectContaining({ type: 'text', scope: 'account_project', text: expect.stringContaining('Açougue de Primeira') })])
  })

  it('com vários candidatos manda miniaturas numeradas e aceita a escolha', async () => {
    const first = await advanceConversation(input(newConversationState(), 'manda o encarte da terça que está na minha conta'))
    expect(first.accountProjectJob).toBeUndefined()
    expect(first.state.accountProject).toMatchObject({ awaitingChoice: true, choices: [{ projectId: tercaQuarta.id }, { projectId: tercaAntigo.id }] })
    expect(first.send.filter(item => item.type === 'image')).toEqual([
      expect.objectContaining({ key: tercaQuarta.thumbnailKey, text: expect.stringMatching(/^1 — Terça e Quarta Verde/), purpose: 'review', accountProjectId: tercaQuarta.id, scope: 'account_project' })
    ])
    expect(first.send).toContainEqual(expect.objectContaining({ type: 'text', text: expect.stringMatching(/^2 — Terça Verde/) }))
    const second = await advanceConversation(input(first.state, 'o segundo'))
    expect(second.accountProjectJob).toMatchObject({ projectId: tercaAntigo.id })
    expect(second.state.accountProject).toMatchObject({ projectId: tercaAntigo.id, awaitingChoice: false })
  })

  it('não entrega projeto escolhido que não está mais entre os do dono', async () => {
    const state = newConversationState()
    state.accountProject = { awaitingChoice: true, choices: [{ projectId: 'bbbbbbbb-0000-4000-8000-000000000009', name: 'De outra conta' }] }
    const result = await advanceConversation(input(state, '1'))
    expect(result.accountProjectJob).toBeUndefined()
    expect(result.state.accountProject?.job).toBeUndefined()
    expect(result.send[0]!.text).toMatch(/não está mais disponível/)
  })

  it('mensagem que não escolhe encerra a espera pela escolha', async () => {
    const state = newConversationState()
    state.accountProject = { awaitingChoice: true, choices: [{ projectId: acougue.id, name: acougue.name }] }
    const result = await advanceConversation(input(state, 'oi'))
    expect(result.state.accountProject?.awaitingChoice).toBe(false)
    expect(result.accountProjectJob).toBeUndefined()
  })

  it('não agenda outro envio enquanto o anterior está em andamento', async () => {
    const first = await advanceConversation(input(newConversationState(), 'manda o último encarte'))
    const second = await advanceConversation(input(first.state, 'manda o último encarte'))
    expect(second.accountProjectJob).toBeUndefined()
    expect(second.state.accountProject?.job?.token).toBe(first.accountProjectJob!.token)
  })

  it('avisa quando a conta não tem encartes', async () => {
    const result = await advanceConversation(input(newConversationState(), 'manda o último encarte', vi.fn(async () => [])))
    expect(result.accountProjectJob).toBeUndefined()
    expect(result.send[0]!.text).toMatch(/não encontrei encartes salvos/)
  })

  it('o novo pedido lembra o último encarte escolhido', async () => {
    const state = { ...newConversationState(), phase: 'delivered' as const }
    state.accountProject = { projectId: acougue.id, projectName: acougue.name }
    const result = await advanceConversation({ ...input(state, 'quero começar outro pedido'), proposal: { action: 'new_order' } })
    expect(result.state.accountProject).toEqual({ projectId: acougue.id, projectName: acougue.name })
  })
})

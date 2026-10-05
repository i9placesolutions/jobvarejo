import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ user: vi.fn(), query: vi.fn(), getQuery: vi.fn() }))
vi.mock('../../server/utils/art-studio', () => ({
  artUser: mocks.user,
  artDatabaseError: (error: unknown) => { throw error }
}))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', mocks.getQuery)

const { default: handler } = await import('../../server/api/art-studio/templates/index.get')

describe('GET /api/art-studio/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ id: 'user-1' })
    mocks.getQuery.mockReturnValue({})
  })

  it('retorna somente as linhas persistidas e mantém a autorização atual', async () => {
    const rows = [{ id: 'persisted-template', name: 'Arte real' }]
    mocks.query.mockResolvedValue({ rows })

    const response = await handler({} as any)

    expect(response).toEqual({ templates: rows, databaseReady: true })
    expect(mocks.user).toHaveBeenCalledWith({}, false)
    expect(mocks.query).toHaveBeenCalledOnce()
  })

  it('não injeta modelos locais quando a tabela ainda não existe', async () => {
    mocks.query.mockRejectedValue(Object.assign(new Error('relation missing'), { code: '42P01' }))

    const response = await handler({} as any)

    expect(response).toEqual({ templates: [], databaseReady: false })
    expect(mocks.user).toHaveBeenCalledWith({}, false)
    expect(mocks.query).toHaveBeenCalledOnce()
  })

  it('mantém o controle de acesso administrativo da consulta', async () => {
    mocks.getQuery.mockReturnValue({ admin: '1' })
    mocks.query.mockResolvedValue({ rows: [] })

    await handler({} as any)

    expect(mocks.user).toHaveBeenCalledWith({}, true)
    expect(mocks.query.mock.calls[0]?.[1]).toEqual([true])
  })
})

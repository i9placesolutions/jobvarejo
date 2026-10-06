import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), limit: vi.fn(), getQuery: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: mocks.auth }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: mocks.limit }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', mocks.getQuery)
vi.stubGlobal('createError', (value: any) => Object.assign(new Error(value.statusMessage), value))

const { default: handler } = await import('../../server/api/label-templates.get')

const realisticCatalog = () => Array.from({ length: 5 }, (_, index) => ({
  id: `label-${index}`,
  user_id: 'account-a',
  name: `Etiqueta ${index}`,
  kind: 'price',
  group: { type: 'group', objects: Array.from({ length: 12 }, (_, objectIndex) => ({ type: 'text', text: `Campo ${objectIndex}`, fontSize: 48 })) },
  preview_data_url: `data:image/png;base64,${'A'.repeat(600_000)}`,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z'
}))

describe('GET /api/label-templates catálogo leve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ id: 'account-a' })
    mocks.limit.mockResolvedValue(undefined)
    mocks.getQuery.mockReturnValue({})
    mocks.query.mockResolvedValue({ rows: [] })
  })

  it('mantém a resposta completa e a precedência pessoal sobre global sem filtros', async () => {
    const result = await handler({} as any)
    const [sql, params] = mocks.query.mock.calls[0]!

    expect(result).toEqual({ success: true, templates: [], complete: true })
    expect(sql).toContain('preview_data_url')
    expect(sql).toContain('"group"')
    expect(sql).toContain('where (user_id = $1 or user_id is null)')
    expect(sql).toContain('case when user_id = $1 then 0 else 1 end')
    expect(sql).toContain('limit 501')
    expect(params).toEqual(['account-a'])
  })

  it('filtra até 500 IDs por parâmetro e ignora qualquer escopo vindo da query', async () => {
    const requestedIds = ['built-in-text', ...Array.from({ length: 520 }, (_, index) => `id-${index}`)]
    mocks.getQuery.mockReturnValue({ ids: requestedIds, userId: 'account-b' })

    await handler({} as any)
    const [sql, params] = mocks.query.mock.calls[0]!

    expect(sql).toContain('coalesce(template_key, id) = any($2::text[])')
    expect(sql).toContain('where (user_id = $1 or user_id is null)')
    expect(sql).not.toContain('account-b')
    expect(params[0]).toBe('account-a')
    expect(params[1]).toHaveLength(500)
    expect(params[1][0]).toBe('built-in-text')
    expect(sql).not.toContain('built-in-text')
  })

  it('sinaliza catálogo truncado e retorna no máximo 500 linhas', async () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ id: `label-${index}` }))
    mocks.query.mockResolvedValue({ rows })

    const result = await handler({} as any)
    const [sql] = mocks.query.mock.calls[0]!

    expect(sql).toContain('limit 501')
    expect((result as any).templates).toHaveLength(500)
    expect((result as any).templates[499].id).toBe('label-499')
    expect((result as any).complete).toBe(false)
  })

  it('considera completa uma consulta filtrada válida', async () => {
    mocks.getQuery.mockReturnValue({ ids: 'built-in-text,label-a' })
    mocks.query.mockResolvedValue({ rows: [{ id: 'built-in-text' }, { id: 'label-a' }] })

    const result = await handler({} as any)

    expect(result).toEqual({
      success: true,
      templates: [{ id: 'built-in-text' }, { id: 'label-a' }],
      complete: true
    })
    expect(mocks.query.mock.calls[0]![0]).toContain('limit 501')
  })

  it('usa ID da linha como filtro no fallback de schema sem template_key', async () => {
    mocks.getQuery.mockReturnValue({ ids: 'label-a,label-b' })
    mocks.query
      .mockRejectedValueOnce(Object.assign(new Error('column template_key does not exist'), { code: '42703' }))
      .mockResolvedValueOnce({ rows: [{ id: 'label-a' }] })

    const result = await handler({} as any)
    const [sql, params] = mocks.query.mock.calls[1]!

    expect(result).toMatchObject({ missingCatalogScope: true, templates: [{ id: 'label-a' }] })
    expect(sql).toContain('where (user_id = $1 or user_id is null)')
    expect(sql).toContain('and id = any($2::text[])')
    expect(params).toEqual(['account-a', ['label-a', 'label-b']])
  })

  it('omite preview na consulta e reduz um catálogo de 3 MB para IDs usados', async () => {
    const fixture = realisticCatalog()
    mocks.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('null::text as preview_data_url')
        ? fixture.map((row) => ({ ...row, preview_data_url: null }))
        : fixture
    }))

    mocks.getQuery.mockReturnValue({})
    const full = await handler({} as any)
    mocks.getQuery.mockReturnValue({ ids: fixture.map((item) => item.id), preview: '0' })
    const lightweight = await handler({} as any)
    const fullBytes = Buffer.byteLength(JSON.stringify(full))
    const lightweightBytes = Buffer.byteLength(JSON.stringify(lightweight))
    const [lightSql] = mocks.query.mock.calls[1]!

    expect(lightSql).toContain('null::text as preview_data_url')
    expect(lightSql).toContain('coalesce(template_key, id) = any($2::text[])')
    expect(lightweightBytes).toBeLessThan(fullBytes - 2_900_000)
    expect((lightweight as any).templates.every((item: any) => item.preview_data_url === null)).toBe(true)
  })

  it('summary=1 retorna apenas metadados e sempre exige autenticação', async () => {
    mocks.getQuery.mockReturnValue({ summary: '1' })
    await handler({} as any)
    const [sql] = mocks.query.mock.calls[0]!

    expect(sql).not.toContain('"group"')
    expect(sql).not.toContain('preview_data_url')
    expect(sql).toContain('select id, name, kind, created_at, updated_at')

    vi.clearAllMocks()
    mocks.auth.mockRejectedValue(new Error('unauthenticated'))
    await expect(handler({} as any)).rejects.toThrow('unauthenticated')
    expect(mocks.query).not.toHaveBeenCalled()
  })
})

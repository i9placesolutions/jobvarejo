import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  ensureProjectTemplateColumn: vi.fn(async () => undefined)
}))

vi.mock('~/server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('~/server/utils/project-templates', () => ({ ensureProjectTemplateColumn: mocks.ensureProjectTemplateColumn }))

import { syncLegacyFlyerTemplateCategories } from '../../server/utils/flyer-template-categories'

const legacyInsertCount = () => mocks.query.mock.calls.filter(([sql]) =>
  String(sql).includes('insert into public.flyer_template_categories')
).length

afterEach(() => {
  vi.useRealTimers()
  mocks.query.mockReset().mockResolvedValue({ rows: [] })
  mocks.ensureProjectTemplateColumn.mockClear()
})

describe('syncLegacyFlyerTemplateCategories', () => {
  it('deduplica chamadas concorrentes por conta e evita o sync repetido no TTL', async () => {
    const userId = 'user-sync-cache'

    await Promise.all([
      syncLegacyFlyerTemplateCategories(userId),
      syncLegacyFlyerTemplateCategories(userId),
      syncLegacyFlyerTemplateCategories(userId)
    ])
    expect(legacyInsertCount()).toBe(2)

    await syncLegacyFlyerTemplateCategories(userId)
    expect(legacyInsertCount()).toBe(2)

    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 60_001)
    await syncLegacyFlyerTemplateCategories(userId)
    expect(legacyInsertCount()).toBe(4)
  })

  it('libera a sincronização em erro para a chamada seguinte tentar novamente', async () => {
    const userId = 'user-sync-retry'
    let shouldFail = true
    mocks.query.mockImplementation(async (sql: unknown) => {
      if (shouldFail && String(sql).includes('insert into public.flyer_template_categories')) {
        shouldFail = false
        throw new Error('transient database error')
      }
      return { rows: [] }
    })

    await expect(syncLegacyFlyerTemplateCategories(userId)).rejects.toThrow('transient database error')
    await expect(syncLegacyFlyerTemplateCategories(userId)).resolves.toBeUndefined()
    expect(legacyInsertCount()).toBe(3)
  })
})

import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ query: vi.fn(), params: { scope: 'asset' } }))
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: async () => ({ id: '11111111-1111-4111-8111-111111111111' }) }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query, pgOneOrNull: vi.fn() }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', () => mocks.params)
vi.stubGlobal('createError', createError)
const { default: handler } = await import('../../server/api/folders.get')
const db = new PGlite()
beforeAll(async () => {
  await db.exec(`create table folders(id integer primary key, user_id uuid, icon text, order_index integer default 0, created_at timestamp default now());
    create table asset_folders(folder_id integer, user_id uuid, asset_key text);`)
  await db.query(`insert into folders(id,user_id,icon) values (1,$1,'asset-folder'),(2,$1,'project-folder'),(3,$1,'folder'),(4,$2,'asset-folder'),(5,$1,'folder')`, [owner, other])
  await db.query(`insert into asset_folders select f,$1,'image-' || n from generate_series(1,3) f cross join generate_series(1,200) n`, [owner])
  await db.query(`insert into asset_folders values(5,$1,'other-owner')`, [other])
  mocks.query.mockImplementation((sql, params) => db.query(sql, params))
})
afterAll(() => db.close())

it('devolve cada pasta uma vez mesmo com centenas de imagens, mantendo a ordem', async () => {
  mocks.params.scope = 'asset'
  const result = await handler({} as any) as any[]
  expect(result.map(row => row.id)).toEqual([1, 2, 3])
  // A consulta anterior multiplicava cada pasta pelas 200 imagens vinculadas.
  const baseline = await db.query(`select f.* from folders f left join asset_folders af on af.folder_id=f.id and af.user_id=$1 where f.user_id=$1 and (f.icon='asset-folder' or af.folder_id is not null)`, [owner])
  expect(baseline.rows).toHaveLength(600)
  expect(result).toHaveLength(3)
})
it('mantém pastas explícitas de projetos e ignora vínculos de outro usuário', async () => {
  mocks.params.scope = 'project'
  const result = await handler({} as any) as any[]
  expect(result.map(row => row.id)).toEqual([2, 5])
})
it('mantém a listagem sem filtro isolada pelo usuário', async () => {
  mocks.params.scope = 'all'
  const result = await handler({} as any) as any[]
  expect(result.map(row => row.id)).toEqual([1, 2, 3, 5])
})

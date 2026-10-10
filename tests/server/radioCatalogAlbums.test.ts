import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createError } from 'h3'
const mocks = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: async () => ({ id: 'owner' }) }))
vi.mock('../../server/utils/postgres', () => ({ pgQuery: mocks.query }))
vi.mock('../../server/utils/rate-limit', () => ({ enforceRateLimit: vi.fn() }))
vi.mock('../../server/utils/radio-access', () => ({ requireRadioStationAccess: async () => ({ ownerUserId: 'owner', station: { id: 'station' } }) }))
vi.mock('../../server/utils/radio-indoor', () => ({
  positiveInt: (value: any, fallback: number) => value ? Number(value) : fallback,
  radioTableErrorResponse: () => null, serializeTrack: (track: unknown) => track
}))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', () => ({ view: 'albums' }))
vi.stubGlobal('createError', createError)
const { default: handler } = await import('../../server/api/radio-indoor/catalog.get')
const db = new PGlite()
beforeAll(async () => {
  await db.exec(`create table radio_catalog_tracks(id uuid, user_id text, title text, album text, artist text, genre text, release_year integer, thumbnail_key text, status text);
    insert into radio_catalog_tracks values('11111111-1111-4111-8111-111111111111','owner','Faixa','Álbum','Artista','Pop',2025,null,'ready'),
    ('22222222-2222-4222-8222-222222222222','other','Outra','Privado','Artista','Pop',2025,null,'ready');`)
  mocks.query.mockImplementation((sql, params) => db.query(sql, params))
})
afterAll(() => db.close())
it('reproduz o erro de min(uuid) da consulta antiga', async () => {
  await expect(db.query('select min(id) from radio_catalog_tracks')).rejects.toMatchObject({ code: '42883' })
})
it('agrupa álbuns com UUID sem erro SQL e mantém isolamento por proprietário', async () => {
  await expect(handler({} as any)).resolves.toMatchObject({ success: true, total: 1, albums: [
    { album: 'Álbum', trackCount: 1, sampleTrackId: '11111111-1111-4111-8111-111111111111' }
  ] })
})

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { BUILDER_COUNT_TABLES, buildBuilderCountsQuery } from '../../server/utils/builder-counts'

const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
beforeAll(async () => {
  for (const table of Object.values(BUILDER_COUNT_TABLES)) {
    await db.exec(`create table public.${table}(id serial primary key, user_id uuid, is_active boolean default true)`)
  }
  await db.exec(`insert into builder_themes(is_active) values(true),(false)`)
  await db.query('insert into radio_voice_profiles(user_id) values($1),($1),($2)', [owner, other])
})
afterAll(() => db.close())

describe('contagens administrativas sem carregar cadastros', () => {
  it('mantém os totais de ativos/inativos e restringe vozes ao usuário', async () => {
    const { rows } = await db.query<any>(buildBuilderCountsQuery(new Set(Object.values(BUILDER_COUNT_TABLES))), [owner])
    expect(rows[0]).toMatchObject({ themes: 2, models: 0, radioVoices: 2 })
    expect(Object.keys(rows[0])).toHaveLength(12)
    const otherRows = await db.query<any>(buildBuilderCountsQuery(new Set(Object.values(BUILDER_COUNT_TABLES))), [other])
    expect(otherRows.rows[0].radioVoices).toBe(1)
  })
  it('preserva os módulos disponíveis em instalação parcial', async () => {
    const { rows } = await db.query<any>(buildBuilderCountsQuery(new Set(['builder_themes'])), [owner])
    expect(rows[0]).toMatchObject({ themes: 2, models: null, radioVoices: 0 })
  })
  it('não incorpora identificadores fora da lista fixa', async () => {
    const sql = buildBuilderCountsQuery(new Set(['builder_themes', 'profiles', 'injection; drop table profiles']))
    const { rows } = await db.query<any>(sql, [owner])
    expect(rows[0].themes).toBe(2)
    expect(sql).not.toContain('drop table')
  })
})

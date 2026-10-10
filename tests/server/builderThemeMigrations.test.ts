import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const migrations = ['builder_theme_formats_migration.sql', 'builder_theme_composition_migration.sql']
  .map(name => readFileSync(new URL(`../../database/${name}`, import.meta.url), 'utf8'))

it('atualiza temas legados de forma idempotente e preserva campos e configurações existentes', async () => {
  const db = new PGlite()
  try {
    await db.exec('create table builder_themes (id integer primary key, name text, css_config jsonb)')
    await db.exec(`insert into builder_themes values (1, 'Tema original', '{"color":"red"}')`)
    for (const sql of migrations) await db.exec(sql)
    expect((await db.query('select * from builder_themes')).rows).toEqual([
      { id: 1, name: 'Tema original', css_config: { color: 'red' }, model_ids: [], composition: {} }
    ])
    const model = '11111111-1111-4111-8111-111111111111'
    await db.query('update builder_themes set model_ids = $1::uuid[], composition = $2::jsonb', [[model], JSON.stringify({ logo: { x: 25 } })])
    for (const sql of migrations) await db.exec(sql)
    expect((await db.query<any>('select * from builder_themes')).rows[0]).toMatchObject({
      name: 'Tema original', css_config: { color: 'red' }, model_ids: [model], composition: { logo: { x: 25 } }
    })
    await db.exec(`insert into builder_themes(id, name) values(2, 'Novo')`)
    expect((await db.query<any>('select model_ids, composition from builder_themes where id = 2')).rows[0]).toEqual({ model_ids: [], composition: {} })
  } finally { await db.close() }
})

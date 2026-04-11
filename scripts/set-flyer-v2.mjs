#!/usr/bin/env node
// Seta font_config.card_layout_version='v2' no flyer de teste.
// Uso: node scripts/set-flyer-v2.mjs [flyerId]
import 'dotenv/config'
import pg from 'pg'

const flyerId = process.argv[2] || 'c9285b1f-e601-4e92-877e-2fe4fdb7a6a1'
const url = process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('POSTGRES_DATABASE_URL nao encontrada no .env')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
const res = await client.query(
  `UPDATE public.builder_flyers
     SET font_config = jsonb_set(
       coalesce(font_config, '{}'::jsonb),
       '{card_layout_version}',
       '"v2"'::jsonb
     )
     WHERE id = $1::uuid
     RETURNING id, font_config`,
  [flyerId],
)
console.log(JSON.stringify(res.rows, null, 2))
await client.end()

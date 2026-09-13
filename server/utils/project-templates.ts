import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null
const REQUIRED_TEMPLATE_COLUMNS = ['is_template', 'template_config']

export const isMissingTemplateColumnError = (error: any): boolean => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42703' && message.includes('is_template')
}

export const ensureProjectTemplateColumn = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    // As migrações são aplicadas fora do caminho de requisição. Executar
    // ALTER TABLE e CREATE INDEX IF NOT EXISTS ao abrir o primeiro projeto
    // fazia a galeria esperar por DDL e locks do catálogo em todo restart.
    // Consulte primeiro o esquema leve; mantenha o reparo legado apenas para
    // instalações antigas que ainda não receberam a migração.
    const { rows } = await pgQuery<{ column_name: string }>(`
      select column_name
        from information_schema.columns
       where table_schema = 'public'
         and table_name = 'projects'
         and column_name = any($1::text[])
    `, [REQUIRED_TEMPLATE_COLUMNS])
    const existingColumns = new Set(rows.map((row) => String(row.column_name || '').trim()))
    if (REQUIRED_TEMPLATE_COLUMNS.every((column) => existingColumns.has(column))) {
      return
    }

    await pgQuery(`
      alter table public.projects
        add column if not exists is_template boolean not null default false
    `)
    await pgQuery(`
      alter table public.projects
        add column if not exists template_config jsonb
    `)
    await pgQuery(`
      create index if not exists idx_projects_user_template
        on public.projects (user_id, is_template)
        where is_template = true
    `)
    await pgQuery(`
      create index if not exists idx_projects_user_template_category
        on public.projects (
          user_id,
          lower(btrim(template_config ->> 'category'))
        )
        where coalesce(is_template, false) = true
          and nullif(btrim(template_config ->> 'category'), '') is not null
    `)
    await pgQuery(`
      create index if not exists idx_projects_user_template_subcategory
        on public.projects (
          user_id,
          lower(btrim(template_config ->> 'subcategory'))
        )
        where coalesce(is_template, false) = true
          and nullif(btrim(template_config ->> 'subcategory'), '') is not null
    `)
  })().catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

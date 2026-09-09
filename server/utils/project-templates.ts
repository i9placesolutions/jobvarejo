import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null

export const isMissingTemplateColumnError = (error: any): boolean => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42703' && message.includes('is_template')
}

export const ensureProjectTemplateColumn = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
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
  })().catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

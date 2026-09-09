import { ensureProjectTemplateColumn } from './project-templates'
import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null

/**
 * Mantém o catálogo de categorias disponível inclusive em instalações que
 * ainda não aplicaram a migration. A migration continua sendo a fonte de
 * verdade para deploy; este guard evita que a tela fique sem funcionar.
 */
export const ensureFlyerTemplateCategoriesTable = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    await pgQuery(`
      create table if not exists public.flyer_template_categories (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        name text not null,
        normalized_name text not null,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        constraint flyer_template_categories_name_length
          check (char_length(name) between 1 and 60),
        constraint flyer_template_categories_normalized_name_length
          check (char_length(normalized_name) between 1 and 60),
        constraint flyer_template_categories_user_normalized_name_key
          unique (user_id, normalized_name)
      )
    `)
    await pgQuery(`
      create index if not exists idx_flyer_template_categories_user_name
        on public.flyer_template_categories (user_id, name)
    `)
  })().catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

/**
 * Categorias salvas antes da existência do catálogo continuam selecionáveis.
 * O INSERT é idempotente pela chave normalizada de cada usuário.
 */
export const syncLegacyFlyerTemplateCategories = async (userId: string): Promise<void> => {
  await ensureProjectTemplateColumn()
  await ensureFlyerTemplateCategoriesTable()

  await pgQuery(`
    insert into public.flyer_template_categories (user_id, name, normalized_name)
    select $1, legacy.name, legacy.normalized_name
    from (
      select distinct on (normalized_name)
        name,
        normalized_name
      from (
        select
          btrim(regexp_replace(template_config ->> 'category', '[[:space:]]+', ' ', 'g')) as name,
          lower(btrim(regexp_replace(template_config ->> 'category', '[[:space:]]+', ' ', 'g'))) as normalized_name
        from public.projects
        where user_id = $1
          and coalesce(is_template, false) = true
          and jsonb_typeof(template_config -> 'category') = 'string'
      ) extracted
      where char_length(name) between 1 and 60
      order by normalized_name, name
    ) legacy
    on conflict (user_id, normalized_name) do nothing
  `, [userId])
}

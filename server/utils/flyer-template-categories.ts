import { ensureProjectTemplateColumn } from './project-templates'
import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null

/**
 * Mantém o catálogo de categorias disponível inclusive em instalações que
 * ainda não aplicaram a migration. A migration continua sendo a fonte de
 * verdade para deploy; este guard evita que a tela fique sem funcionar.
 *
 * `parent_id` diferencia categoria principal (nulo) de subcategoria. A
 * unicidade considera o pai: "Semana especial" pode existir em Hortifruti e
 * em Açougue sem misturar os filtros.
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
        parent_id uuid references public.flyer_template_categories(id) on delete cascade,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now()),
        constraint flyer_template_categories_name_length
          check (char_length(name) between 1 and 60),
        constraint flyer_template_categories_normalized_name_length
          check (char_length(normalized_name) between 1 and 60)
      )
    `)
    await pgQuery(`
      alter table public.flyer_template_categories
        add column if not exists parent_id uuid
    `)
    await pgQuery(`
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'flyer_template_categories_parent_id_fkey'
            and conrelid = 'public.flyer_template_categories'::regclass
        ) then
          alter table public.flyer_template_categories
            add constraint flyer_template_categories_parent_id_fkey
            foreign key (parent_id)
            references public.flyer_template_categories(id)
            on delete cascade;
        end if;
      end $$;
    `)
    await pgQuery(`
      alter table public.flyer_template_categories
        drop constraint if exists flyer_template_categories_user_normalized_name_key
    `)
    await pgQuery(`
      drop index if exists public.flyer_template_categories_user_normalized_name_key
    `)
    await pgQuery(`
      create index if not exists idx_flyer_template_categories_user_name
        on public.flyer_template_categories (user_id, name)
    `)
    await pgQuery(`
      create index if not exists idx_flyer_template_categories_user_parent
        on public.flyer_template_categories (user_id, parent_id, name)
    `)
    await pgQuery(`
      create unique index if not exists idx_flyer_template_categories_root_name
        on public.flyer_template_categories (user_id, normalized_name)
        where parent_id is null
    `)
    await pgQuery(`
      create unique index if not exists idx_flyer_template_categories_child_name
        on public.flyer_template_categories (user_id, parent_id, normalized_name)
        where parent_id is not null
    `)
  })().catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

/**
 * Categorias salvas antes da existência do catálogo continuam selecionáveis.
 * O INSERT é idempotente pela chave normalizada dentro de cada nível.
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
    on conflict do nothing
  `, [userId])

  // Modelos novos podem ter uma subcategoria. Ela é importada depois das
  // principais para garantir que a referência pai já exista.
  await pgQuery(`
    with legacy as (
      select distinct on (main_normalized_name, sub_normalized_name)
        main_name,
        main_normalized_name,
        sub_name,
        sub_normalized_name
      from (
        select
          btrim(regexp_replace(template_config ->> 'category', '[[:space:]]+', ' ', 'g')) as main_name,
          lower(btrim(regexp_replace(template_config ->> 'category', '[[:space:]]+', ' ', 'g'))) as main_normalized_name,
          btrim(regexp_replace(template_config ->> 'subcategory', '[[:space:]]+', ' ', 'g')) as sub_name,
          lower(btrim(regexp_replace(template_config ->> 'subcategory', '[[:space:]]+', ' ', 'g'))) as sub_normalized_name
        from public.projects
        where user_id = $1
          and coalesce(is_template, false) = true
          and jsonb_typeof(template_config -> 'category') = 'string'
          and jsonb_typeof(template_config -> 'subcategory') = 'string'
      ) extracted
      where char_length(main_name) between 1 and 60
        and char_length(sub_name) between 1 and 60
      order by main_normalized_name, sub_normalized_name, sub_name
    )
    insert into public.flyer_template_categories (user_id, name, normalized_name, parent_id)
    select $1, legacy.sub_name, legacy.sub_normalized_name, parent.id
    from legacy
    join public.flyer_template_categories parent
      on parent.user_id = $1
     and parent.parent_id is null
     and parent.normalized_name = legacy.main_normalized_name
    on conflict do nothing
  `, [userId])
}

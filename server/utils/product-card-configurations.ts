import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null

/**
 * Mantem a tela utilizavel em instalacoes que ainda nao aplicaram a migration.
 * A migration continua sendo a fonte de verdade do deploy.
 */
export const ensureProductCardConfigurationsTable = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise

  ensurePromise = pgQuery(`
    create table if not exists public.product_card_configurations (
      user_id uuid primary key references public.profiles(id) on delete cascade,
      configuration jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default timezone('utc', now())
    )
  `).then(() => undefined).catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

import { pgQuery } from './postgres'

let ensurePromise: Promise<void> | null = null

/**
 * Keeps the account-level structure table available for installations that
 * have not run the SQL migration yet. The migration remains the deployable
 * source of truth; this guard keeps local preview and first boot resilient.
 */
export const ensureProductZoneStructuresTable = async (): Promise<void> => {
  if (ensurePromise) return ensurePromise

  ensurePromise = pgQuery(`
    create table if not exists public.product_zone_structures (
      user_id uuid primary key references public.profiles(id) on delete cascade,
      structures jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default timezone('utc', now())
    )
  `).then(() => undefined).catch((error) => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

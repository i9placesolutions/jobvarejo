import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'
import { pgOneOrNull, pgQuery, pgTx } from '../postgres'
import { normalizeBusinessProfile } from '../../../utils/businessProfile'
import type { WorkJob, WorkRequest } from '../../../shared/work-design'
import { assertWorkImageKey } from './storage'
import { assertWorkSeal } from './elements'

export const publicWorkJob = (job: WorkJob) => {
  const { lease_token, lease_until, owner_id, source_snapshot, ...publicJob } = job
  return publicJob
}
export async function workDatabaseReady() {
  return Boolean((await pgOneOrNull<{ ready: string | null }>("select to_regclass('public.work_design_jobs') as ready"))?.ready)
}
export async function createWorkJob(owner: string, request: WorkRequest, key: string) {
  await assertWorkSeal(owner, request.sealKey)
  for (const product of request.products) if (product.imageKey) assertWorkImageKey(product.imageKey, owner)
  const profile = await pgOneOrNull<{ business_profile: unknown }>('select business_profile from public.profiles where id=$1', [owner])
  const business = normalizeBusinessProfile(profile?.business_profile)
  let source: any = null
  if (request.sourceProjectId) {
    // Reutilização copia só da própria conta; modelos públicos entram como biblioteca visual.
    source = await pgOneOrNull('select id,canvas_data,updated_at from public.projects where id=$1 and user_id=$2', [request.sourceProjectId, owner])
    if (!source) throw createError({ statusCode: 404, statusMessage: 'Projeto de origem indisponível.' })
  }
  return pgTx(async db => {
    const inserted = await db.query<WorkJob>(`insert into public.work_design_jobs
      (id,owner_id,idempotency_key,request,business,source_revision,source_snapshot)
      values($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb) on conflict(owner_id,idempotency_key) do nothing returning *`,
      [randomUUID(), owner, key, JSON.stringify(request), JSON.stringify(business), source?.updated_at?.toISOString() || null,
        source ? JSON.stringify(source.canvas_data) : null])
    const job = inserted.rows[0] || (await db.query<WorkJob>('select * from public.work_design_jobs where owner_id=$1 and idempotency_key=$2', [owner, key])).rows[0]!
    if (JSON.stringify(job.request) !== JSON.stringify(request)) {
      // PostgreSQL jsonb reordena chaves: comparar conteúdo canônico.
      const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v
      if (JSON.stringify(canonical(job.request)) !== JSON.stringify(canonical(request)))
        throw createError({ statusCode: 409, statusMessage: 'Este identificador já foi usado em outro pedido.' })
    }
    return job
  })
}
export async function getWorkJob(owner: string, id: string) {
  const job = await pgOneOrNull<WorkJob>('select * from public.work_design_jobs where id=$1 and owner_id=$2', [id, owner])
  if (!job) throw createError({ statusCode: 404, statusMessage: 'Pedido indisponível.' })
  return job
}
export async function listWorkJobs(owner: string, pending = false) {
  return (await pgQuery<WorkJob>(`select * from public.work_design_jobs where owner_id=$1
    ${pending ? "and (status='pending' or (status in ('processing','draft') and lease_until<now()))" : ''}
    order by created_at ${pending ? 'asc' : 'desc'} limit 30`, [owner])).rows
}
export async function claimWorkJob(owner: string, id: string, revision: number) {
  const job = (await pgQuery<WorkJob>(`update public.work_design_jobs set status=case when result is null then 'processing' else 'draft' end,lease_token=$4,
    lease_until=now()+interval '15 minutes',updated_at=now() where id=$1 and owner_id=$2 and revision=$3
    and (status='pending' or (status in ('processing','draft') and lease_until<now())) returning *`, [id, owner, revision, randomUUID()])).rows[0]
  if (!job) throw createError({ statusCode: 409, statusMessage: 'Pedido reservado, alterado ou concluído.' })
  return job
}
export function assertWorkLease(job: WorkJob, revision: number, token: string, now = Date.now()) {
  const expiry = job?.lease_until ? new Date(job.lease_until).getTime() : NaN
  const sameToken = !!job?.lease_token && timingSafeEqual(createHash('sha256').update(job.lease_token).digest(), createHash('sha256').update(token).digest())
  if (!job || !['processing', 'draft'].includes(job.status) || job.revision !== revision || !sameToken ||
      !Number.isFinite(expiry) || expiry <= now)
    throw createError({ statusCode: 409, statusMessage: 'Reserva expirada ou revisão desatualizada.' })
}
export async function reviseWorkJob(owner: string, id: string, revision: number, request: WorkRequest | null) {
  if (request) await assertWorkSeal(owner, request.sealKey)
  if (request) for (const p of request.products) if (p.imageKey) assertWorkImageKey(p.imageKey, owner)
  const profile = request ? await pgOneOrNull<{ business_profile: unknown }>('select business_profile from public.profiles where id=$1', [owner]) : null
  const job = (await pgQuery<WorkJob>(`update public.work_design_jobs set revision=revision+1,
    status=$4,request=coalesce($5::jsonb,request),business=coalesce($7::jsonb,business),lease_token=null,lease_until=null,draft_layout=null,result=null,error=null,updated_at=now()
    where id=$1 and owner_id=$2 and revision=$3 and status in ('pending','processing','draft','failed')
    and ($5::jsonb is null or request->>'sourceProjectId' is not distinct from $6) returning *`,
    [id, owner, revision, request ? 'pending' : 'cancelled', request ? JSON.stringify(request) : null,
      request?.sourceProjectId || null, request ? JSON.stringify(normalizeBusinessProfile(profile?.business_profile)) : null])).rows[0]
  if (!job) throw createError({ statusCode: 409, statusMessage: 'O pedido mudou. Atualize antes de continuar.' })
  return job
}

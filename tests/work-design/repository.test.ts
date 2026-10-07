import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureJob, owner, other } from './fixtures'

let database: PGlite
vi.mock('../../server/utils/postgres', () => ({
  pgQuery: (sql: string, values: any[] = []) => database.query(sql, values),
  pgOneOrNull: async (sql: string, values: any[] = []) => (await database.query(sql, values)).rows[0] || null,
  pgTx: (run: any) => database.transaction(tx => run({ query: (sql: string, values: any[] = []) => tx.query(sql, values) }))
}))
import { assertWorkLease, claimWorkJob, createWorkJob, getWorkJob, listWorkJobs, publicWorkJob, reviseWorkJob, workDatabaseReady } from '../../server/utils/work-design/repository'

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`create table profiles(id uuid primary key,business_profile jsonb);
    create table projects(id uuid primary key,user_id uuid,name text,canvas_data jsonb,preview_url text,is_template boolean default false,template_config jsonb,updated_at timestamptz default now());`)
  await database.exec(await readFile('database/work_design_jobs_migration.sql', 'utf8'))
  await database.query('insert into profiles values($1,$2::jsonb),($3,$2::jsonb)', [owner, JSON.stringify(fixtureJob().business), other])
})
beforeEach(async () => { await database.exec('delete from work_design_jobs; delete from projects;') })
afterAll(async () => { await database.close() })

describe('fila SQL isolada Work', () => {
  it('migração é idempotente e não cria nada no runtime', async () => {
    expect(await workDatabaseReady()).toBe(true)
    await database.exec(await readFile('database/work_design_jobs_migration.sql', 'utf8'))
  })
  it('retentativa preserva um único pedido; mudança com a mesma chave é rejeitada', async () => {
    const request = fixtureJob().request, key = randomUUID()
    const first = await createWorkJob(owner, request, key), second = await createWorkJob(owner, request, key)
    expect(first.id).toBe(second.id); expect(await listWorkJobs(owner)).toHaveLength(1)
    await expect(createWorkJob(owner, { ...request, name: 'Outro' }, key)).rejects.toThrow(/identificador/)
  })
  it('conta diferente não lista, reserva, edita nem lê o pedido', async () => {
    const job = await createWorkJob(owner, fixtureJob().request, randomUUID())
    expect(await listWorkJobs(other)).toHaveLength(0)
    await expect(getWorkJob(other, job.id)).rejects.toThrow(/indisponível/)
    await expect(claimWorkJob(other, job.id, 1)).rejects.toThrow()
    await expect(reviseWorkJob(other, job.id, 1, job.request)).rejects.toThrow()
    expect(publicWorkJob(job)).not.toHaveProperty('lease_token')
    expect(publicWorkJob(job)).not.toHaveProperty('owner_id')
  })
  it('reserva exclusiva; uma nova revisão invalida o token e preserva todos os produtos', async () => {
    const job = await createWorkJob(owner, fixtureJob().request, randomUUID())
    const outcomes = await Promise.allSettled([claimWorkJob(owner, job.id, 1), claimWorkJob(owner, job.id, 1)])
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
    const lease = (outcomes.find(o => o.status === 'fulfilled') as PromiseFulfilledResult<any>).value
    const revised = await reviseWorkJob(owner, job.id, 1, { ...job.request, validity: '08 de outubro' })
    expect(revised.revision).toBe(2); expect(revised.request.products).toEqual(job.request.products)
    expect(() => assertWorkLease(revised, 1, lease.lease_token)).toThrow(/desatualizada/)
    await expect(claimWorkJob(owner, job.id, 1)).rejects.toThrow()
    expect((await claimWorkJob(owner, job.id, 2)).lease_token).not.toBe(lease.lease_token)
  })
  it('reserva vencida volta à fila com novo token; consumidor antigo perde acesso', async () => {
    const job = await createWorkJob(owner, fixtureJob().request, randomUUID())
    const old = await claimWorkJob(owner, job.id, 1)
    await database.query("update work_design_jobs set lease_until=now()-interval '1 second' where id=$1", [job.id])
    expect(await listWorkJobs(owner, true)).toHaveLength(1)
    const current = await claimWorkJob(owner, job.id, 1)
    expect(() => assertWorkLease(current, 1, old.lease_token!)).toThrow()
    expect(() => assertWorkLease(current, 1, current.lease_token!)).not.toThrow()
  })
  it('reutilização confirma a origem e nunca modifica seu conteúdo', async () => {
    const source = randomUUID(), foreign = randomUUID(), content = { pages: [{ name: 'Original', canvasDataPath: 'original.gz' }] }
    await database.query('insert into projects(id,user_id,canvas_data) values($1,$2,$3::jsonb),($4,$5,$3::jsonb)', [source, owner, JSON.stringify(content), foreign, other])
    const request = { ...fixtureJob().request, sourceProjectId: source }
    const job = await createWorkJob(owner, request, randomUUID())
    expect(job.source_snapshot).toEqual(content)
    await expect(createWorkJob(owner, { ...request, sourceProjectId: foreign }, randomUUID())).rejects.toThrow(/origem/)
    await expect(reviseWorkJob(owner, job.id, 1, { ...request, sourceProjectId: foreign })).rejects.toThrow()
    expect((await database.query<any>('select canvas_data from projects where id=$1', [source])).rows[0].canvas_data).toEqual(content)
  })
  it('cancelamento bloqueia retorno antigo; pedido concluído não pode ser reeditado', async () => {
    const job = await createWorkJob(owner, fixtureJob().request, randomUUID()), lease = await claimWorkJob(owner, job.id, 1)
    const cancelled = await reviseWorkJob(owner, job.id, 1, null)
    expect(cancelled.status).toBe('cancelled'); expect(() => assertWorkLease(cancelled, 1, lease.lease_token!)).toThrow()
    await expect(claimWorkJob(owner, job.id, 2)).rejects.toThrow()
    await database.query("update work_design_jobs set status='completed' where id=$1", [job.id])
    await expect(reviseWorkJob(owner, job.id, 2, job.request)).rejects.toThrow()
  })
})

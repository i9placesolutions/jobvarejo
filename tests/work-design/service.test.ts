import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureJob, fixtureLayout, owner } from './fixtures'
let database: PGlite
const runtime = vi.hoisted(() => ({ renderHook: null as (() => Promise<void>) | null, writes: [] as string[] }))
vi.mock('../../server/utils/postgres', () => ({
  pgQuery: (sql: string, params: any[] = []) => database.query(sql, params),
  pgOneOrNull: async (sql: string, params: any[] = []) => (await database.query(sql, params)).rows[0] || null,
  pgTx: (run: any) => database.transaction(tx => run({ query: (sql: string, params: any[] = []) => tx.query(sql, params) }))
}))
vi.mock('../../server/utils/work-design/storage', async original => ({
  ...await original<any>(), readWorkImage: async () => ({ bytes: Buffer.from('fixture'), width: 200, height: 100, dataUrl: 'data:image/png;base64,AA==' }),
  writeWorkBytes: async (key: string) => { runtime.writes.push(key) }
}))
vi.mock('../../server/utils/work-design/render', () => ({ renderWorkCanvas: async (canvas: any, products: any[]) => {
  if (runtime.renderHook) await runtime.renderHook()
  return { png: Buffer.from('render fixture'), canvas: { ...canvas, objects: [...canvas.objects,
    ...products.map(p => ({ type: 'Group', isProductCard: true, productItemId: p.id, _productData: { ...p, imageUrl: p.imageDataUrl } }))] } }
} }))
import { createWorkJob, claimWorkJob, reviseWorkJob, getWorkJob } from '../../server/utils/work-design/repository'
import { submitWorkDraft, finishWorkJob } from '../../server/utils/work-design/service'

beforeAll(async () => {
  vi.stubGlobal('useRuntimeConfig', () => ({ wasabiBucket: 'fixture', wasabiEndpoint: 'storage.invalid' }))
  database = new PGlite()
  await database.exec(`create table profiles(id uuid primary key,business_profile jsonb);
    create table projects(id uuid primary key,user_id uuid,name text,canvas_data jsonb,preview_url text,is_template boolean,template_config jsonb,updated_at timestamptz default now());`)
  await database.exec(await readFile('database/work_design_jobs_migration.sql', 'utf8'))
  await database.query('insert into profiles values($1,$2::jsonb)', [owner, JSON.stringify(fixtureJob().business)])
})
beforeEach(async () => { await database.exec('delete from work_design_jobs; delete from projects'); runtime.writes = []; runtime.renderHook = null })
afterAll(async () => { vi.unstubAllGlobals(); await database.close() })
async function leasedJob() {
  const job = await createWorkJob(owner, fixtureJob(1).request, randomUUID())
  return claimWorkJob(owner, job.id, 1)
}
describe('persistência experimental Work (renderer/storage simulados; SQL real embarcado)', () => {
  it('salva novo projeto e retentativas não duplicam nem sobrescrevem edição do painel', async () => {
    const job = await leasedJob(), layout = fixtureLayout(job)
    const result = await submitWorkDraft(owner, job.id, 1, job.lease_token!, layout)
    const stored = (await database.query<any>('select * from projects')).rows[0]
    expect(stored.id).toBe(result.projectId); expect(stored.is_template).toBe(false)
    expect(stored.canvas_data.pages).toHaveLength(2)
    expect(runtime.writes.every(k => k.startsWith(`projects/${owner}/${result.projectId}/`))).toBe(true)
    await database.query('update projects set canvas_data=$2::jsonb where id=$1', [result.projectId, JSON.stringify({ pages: [{ name: 'Edição do usuário' }] })])
    const retry = await submitWorkDraft(owner, job.id, 1, job.lease_token!, layout)
    expect(retry.projectId).toBe(result.projectId)
    expect((await database.query<any>('select canvas_data from projects')).rows[0].canvas_data.pages[0].name).toBe('Edição do usuário')
    expect((await database.query('select * from projects')).rows).toHaveLength(1)
    expect(await finishWorkJob(owner, job.id, 1, job.lease_token!)).toEqual(result)
    expect(await finishWorkJob(owner, job.id, 1, job.lease_token!)).toEqual(result)
  })
  it('revisão que muda durante render impede publicação do resultado atrasado', async () => {
    const job = await leasedJob()
    runtime.renderHook = async () => {
      runtime.renderHook = null
      await reviseWorkJob(owner, job.id, 1, { ...job.request, validity: 'Novo período' })
    }
    await expect(submitWorkDraft(owner, job.id, 1, job.lease_token!, fixtureLayout(job))).rejects.toThrow(/desatualizada/)
    expect((await database.query('select * from projects')).rows).toHaveLength(0)
    expect((await getWorkJob(owner, job.id)).request.validity).toBe('Novo período')
  })
  it('não conclui sem rascunho, não redesenha sobre rascunho e retoma rascunho de reserva vencida', async () => {
    const job = await leasedJob(), layout = fixtureLayout(job)
    await expect(finishWorkJob(owner, job.id, 1, job.lease_token!)).rejects.toThrow(/prévia/)
    const result = await submitWorkDraft(owner, job.id, 1, job.lease_token!, layout)
    const different = structuredClone(layout); different.pages[0]!.background = '#FF0000'
    await expect(submitWorkDraft(owner, job.id, 1, job.lease_token!, different)).rejects.toThrow(/rascunho/)
    await database.query("update work_design_jobs set lease_until=now()-interval '1 second' where id=$1", [job.id])
    const resumed = await claimWorkJob(owner, job.id, 1)
    expect(resumed.status).toBe('draft'); expect(resumed.result).toEqual(result)
    expect(await finishWorkJob(owner, job.id, 1, resumed.lease_token!)).toEqual(result)
  })
})

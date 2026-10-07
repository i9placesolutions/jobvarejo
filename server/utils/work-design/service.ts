import { randomUUID } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { createError } from 'h3'
import { WORK_FORMATS, type WorkLayout, type WorkResult } from '../../../shared/work-design'
import { extractStorageKeyFromRef } from '../../../utils/storageRef'
import { assertWorkLease, getWorkJob } from './repository'
import { compileWorkPage, validateWorkLayout } from './composition'
import { assertWorkImageKey, readWorkImage, writeWorkBytes } from './storage'
import { renderWorkCanvas } from './render'
import { pgTx } from '../postgres'

const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v
const equal = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
export async function submitWorkDraft(owner: string, id: string, revision: number, token: string, layout: WorkLayout) {
  const job = await getWorkJob(owner, id)
  assertWorkLease(job, revision, token)
  validateWorkLayout(job, layout)
  // Retentativa retorna o mesmo projeto; layout novo exige nova revisão.
  if (job.result) {
    if (!equal(job.draft_layout, layout)) throw createError({ statusCode: 409, statusMessage: 'Já existe rascunho. Crie uma revisão para redesenhar.' })
    return job.result
  }
  const imageCache = new Map<string, Awaited<ReturnType<typeof readWorkImage>>>()
  const image = async (ref: string) => {
    const config = useRuntimeConfig()
    const key = extractStorageKeyFromRef(ref, { bucket: String(config.wasabiBucket), endpoint: String(config.wasabiEndpoint) }) || ref
    assertWorkImageKey(key, owner)
    if (!imageCache.has(key)) imageCache.set(key, await readWorkImage(key, owner))
    return imageCache.get(key)!
  }
  const projectId = randomUUID(), pages: any[] = []
  const result: WorkResult = { projectId, quickCompatible: false, pages: [] }
  for (const [index, page] of layout.pages.entries()) {
    const compiled = await compileWorkPage(job, page, image)
    const products = await Promise.all(page.slots.map(async slot => {
      const product = job.request.products.find(p => p.id === slot.productId)!
      if (!product.imageKey) throw createError({ statusCode: 422, statusMessage: `Confirme a foto de ${product.name} antes de gerar.` })
      return { ...product, brand: '', variant: '', weight: product.unit, imageDataUrl: (await image(product.imageKey)).dataUrl,
        imageFillCount: 1, condition: job.request.conditions }
    }))
    const rendered = await renderWorkCanvas(compiled, products, page.format)
    const size = WORK_FORMATS[page.format]
    rendered.canvas.width = size.width; rendered.canvas.height = size.height
    const cards = rendered.canvas.objects.filter((o: any) => o.isProductCard)
    if (cards.length !== products.length || cards.some((c: any, i: number) => c.productItemId !== products[i]?.id))
      throw createError({ statusCode: 422, statusMessage: 'O render não preservou a lista de produtos.' })
    const frameId = compiled.objects[0]._customId
    cards.forEach((c: any) => { c.parentFrameId = frameId; if (!c._customId) c._customId = randomUUID() })
    // Conferir altura real dos campos após fontes e quebra de linhas; não reduzir silenciosamente.
    for (const field of page.fields) {
      const object = rendered.canvas.objects.find((o: any) => o._customId === `${frameId}:${field.binding}`)
      if (!object || (object.type?.toLowerCase() === 'textbox' && object.height > field.box.height + 2))
        throw createError({ statusCode: 422, statusMessage: `O campo ${field.binding} precisa de mais espaço.` })
    }
    if (page.heading) {
      const heading = rendered.canvas.objects.find((o: any) => o._customId === `${frameId}:heading`)
      if (!heading || heading.height > page.heading.box.height + 2)
        throw createError({ statusCode: 422, statusMessage: 'O título precisa de mais espaço.' })
    }
    // Externalizar bitmaps gerados pelo motor, nunca persistir data URI/presigned.
    const visit = async (objects: any[]): Promise<void> => {
      for (const object of objects) {
        if (object.type?.toLowerCase() === 'image' && String(object.src).startsWith('data:')) {
          const match = object.src.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
          if (!match) throw createError({ statusCode: 422, statusMessage: 'Imagem do render inválida.' })
          const assetKey = `projects/${owner}/${projectId}/assets/${randomUUID()}.${match[1] === 'image/jpeg' ? 'jpg' : match[1].slice(6)}`
          await writeWorkBytes(assetKey, Buffer.from(match[2], 'base64'), match[1])
          object.src = `/api/storage/p?key=${encodeURIComponent(assetKey)}`; object.__originalSrc = object.src
        }
        if (object.objects) await visit(object.objects)
      }
    }
    await visit(rendered.canvas.objects)
    // O worker usa data URI enquanto monta a foto. O fallback de reedição deve
    // apontar para a foto confirmada durável, nunca incorporar base64 no metadata.
    cards.forEach((card: any, i: number) => {
      const ref = `/api/storage/p?key=${encodeURIComponent(products[i]!.imageKey!)}`
      card.imageUrl = ref
      card._productData = { ...card._productData, imageUrl: ref }
      delete card._productData.imageDataUrl
    })
    const pageId = randomUUID(), prefix = `projects/${owner}/${projectId}/pages/${pageId}`
    const canvasKey = `${prefix}/canvas.json.gz`, previewKey = `${prefix}/preview.png`
    await writeWorkBytes(canvasKey, gzipSync(Buffer.from(JSON.stringify(rendered.canvas))), 'application/octet-stream')
    await writeWorkBytes(previewKey, rendered.png, 'image/png')
    result.pages.push({ id: pageId, format: page.format, canvasKey, previewKey, productIds: products.map(p => p.id) })
    pages.push({ id: pageId, name: `${size.label} ${index + 1}`, type: 'FREE_DESIGN', width: size.width, height: size.height,
      canvasDataPath: canvasKey, thumbnailUrl: previewKey, thumbnailPath: previewKey, canvasSavedAt: new Date().toISOString(),
      lastPersistedObjectCount: rendered.canvas.objects.length, editorMode: 'advanced' })
  }
  return pgTx(async db => {
    const current = (await db.query('select * from public.work_design_jobs where id=$1 and owner_id=$2 for update', [id, owner])).rows[0]
    assertWorkLease(current, revision, token)
    if (current.result) {
      if (!equal(current.draft_layout, layout)) throw createError({ statusCode: 409, statusMessage: 'Outro rascunho foi salvo.' })
      return current.result as WorkResult
    }
    // INSERT exclusivo: jamais atualizar projeto/modelo de origem ou resultado editado pelo usuário.
    await db.query(`insert into public.projects(id,user_id,name,canvas_data,preview_url,is_template,template_config)
      values($1,$2,$3,$4::jsonb,$5,false,$6::jsonb)`, [projectId, owner, job.request.name,
      JSON.stringify({ pages, activePageIndex: 0 }), result.pages[0]!.previewKey,
      JSON.stringify({ workDesign: { jobId: id, revision, sourceProjectId: job.request.sourceProjectId || null, sourceRevision: job.source_revision,
        quickCompatible: false, status: 'draft' } })])
    await db.query(`update public.work_design_jobs set status='draft',draft_layout=$4::jsonb,result=$5::jsonb,
      lease_until=now()+interval '15 minutes',updated_at=now() where id=$1 and owner_id=$2 and revision=$3`,
      [id, owner, revision, JSON.stringify(layout), JSON.stringify(result)])
    return result
  })
}
export async function finishWorkJob(owner: string, id: string, revision: number, token: string, error?: string) {
  return pgTx(async db => {
    const job = (await db.query('select * from public.work_design_jobs where id=$1 and owner_id=$2 for update', [id, owner])).rows[0]
    if (!job) throw createError({ statusCode: 404, statusMessage: 'Pedido indisponível.' })
    if (job.status === (error ? 'failed' : 'completed') && job.revision === revision && job.lease_token === token) return job.result
    assertWorkLease(job, revision, token)
    if (!error && !job.result) throw createError({ statusCode: 409, statusMessage: 'Salve e confira a prévia antes de concluir.' })
    await db.query('update public.work_design_jobs set status=$3,error=$4,updated_at=now() where id=$1 and owner_id=$2',
      [id, owner, error ? 'failed' : 'completed', error || null])
    return job.result
  })
}

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createError } from 'h3'
import { pgQuery, pgTx } from '../postgres'
import { getS3Client } from '../s3'
import { videoBucket } from '../video-studio/service'
import { isLegacyUserProjectKey, isStorageKeyAllowedForUser, isUserProjectKey, isValidStoragePath } from '../storage-scope'
import { isTemplateLibraryStorageKey } from '../template-library-storage'
import { resolveWhatsAppAccount } from './access'
import { assertCreationAccess, queueCreationSend } from './repository'
import { rememberConversationTurns, type ConversationSend, type ConversationState } from './conversation'
import { readFlyerPaymentIcon, renderSavedCanvasPage, resolvePublishedFlyerCatalogKey } from './render'
import { accountProjectArtifactPrefix, MAX_ACCOUNT_PROJECT_PAGES, storageKeyFromRef } from './account-projects'
import flyerCatalogKeys from '~/shared/whatsapp-creation/flyer-catalog-keys.json'

const MAX_CANVAS_BYTES = 32 * 1024 * 1024
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_EMBEDDED_BYTES = 160 * 1024 * 1024
const PUBLIC_IMAGE_PATH = /^\/(?!api\/)[A-Za-z0-9._\-/]+\.(?:png|jpe?g|webp|gif|svg)$/i

const fail = (statusCode: number, statusMessage: string): never => { throw createError({ statusCode, statusMessage }) }

const storageOptions = (): { bucket?: string; endpoint?: string } => {
  try {
    const config = useRuntimeConfig()
    return { bucket: String(config.wasabiBucket || ''), endpoint: String(config.wasabiEndpoint || '') }
  } catch {
    return {}
  }
}

const mimeFor = (key: string, contentType = ''): string => {
  if (/^image\//.test(contentType)) return contentType.split(';')[0]!.trim()
  const extension = key.split('.').pop()?.toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'webp' ? 'image/webp'
    : extension === 'gif' ? 'image/gif' : extension === 'svg' ? 'image/svg+xml' : 'image/png'
}

async function readStorageObject(key: string, limit: number): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await getS3Client().send(new GetObjectCommand({ Bucket: videoBucket(), Key: key }))
  if (Number(response.ContentLength || 0) > limit) fail(413, 'Um arquivo do encarte excede o limite permitido.')
  const bytes = Buffer.from(await response.Body!.transformToByteArray())
  if (!bytes.length || bytes.length > limit) fail(413, 'Um arquivo do encarte excede o limite permitido.')
  return { bytes, contentType: String(response.ContentType || '') }
}

/**
 * Imagem usada no encarte salvo: aceita só o que a própria conta pode ler no
 * editor (pasta do dono, bibliotecas públicas, catálogo publicado e modelos
 * administrativos). Qualquer outra origem interrompe a geração.
 */
export async function canEmbedAccountImageKey(key: string, ownerId: string): Promise<boolean> {
  if (!isValidStoragePath(key)) return false
  if (isStorageKeyAllowedForUser(key, ownerId)) return true
  if (key.startsWith(`whatsapp-creation/${ownerId}/`) || key.startsWith(`art-studio/${ownerId}/`)) return true
  if (key.startsWith('templates/') || (flyerCatalogKeys as string[]).includes(key)) return true
  return isTemplateLibraryStorageKey(key)
}

async function readPublicImage(src: string): Promise<Buffer | null> {
  const path = src.split('?')[0]!
  if (!PUBLIC_IMAGE_PATH.test(path) || path.includes('..')) return null
  for (const root of [resolve(process.cwd(), 'public'), resolve(process.cwd(), '.output/public')]) {
    const file = resolve(root, path.slice(1))
    if (!file.startsWith(root + sep) || !existsSync(file)) continue
    const bytes = await readFile(file)
    return bytes.length <= MAX_IMAGE_BYTES ? bytes : fail(413, 'Uma imagem do encarte excede o limite permitido.')
  }
  return null
}

/** Troca cada referência de imagem por data URL, validando o acesso da conta antes de ler. */
export async function embedAccountCanvasImages(canvas: any, ownerId: string): Promise<void> {
  const opts = storageOptions()
  const cache = new Map<string, string>()
  let total = 0
  const resolveSrc = async (src: string): Promise<string> => {
    const cached = cache.get(src)
    if (cached) return cached
    let dataUrl: string | undefined
    const catalogKey = resolvePublishedFlyerCatalogKey(src)
    const paymentIcon = catalogKey ? null : await readFlyerPaymentIcon(src)
    if (paymentIcon) dataUrl = `data:image/png;base64,${paymentIcon.toString('base64')}`
    if (!dataUrl && !catalogKey && src.startsWith('/') && !src.startsWith('/api/')) {
      const bytes = await readPublicImage(src)
      if (bytes) dataUrl = `data:${mimeFor(src)};base64,${bytes.toString('base64')}`
    }
    if (!dataUrl) {
      const key = catalogKey || storageKeyFromRef(src, opts)
      if (!key || !await canEmbedAccountImageKey(key, ownerId)) return fail(403, 'O encarte usa uma imagem fora do acesso desta conta.')
      const object = await readStorageObject(key, MAX_IMAGE_BYTES)
      total += object.bytes.length
      if (total > MAX_EMBEDDED_BYTES) fail(413, 'O encarte tem imagens demais para gerar agora.')
      dataUrl = `data:${mimeFor(key, object.contentType)};base64,${object.bytes.toString('base64')}`
    }
    cache.set(src, dataUrl)
    return dataUrl
  }
  const visit = async (node: any, depth = 0): Promise<void> => {
    if (!node || typeof node !== 'object' || depth > 40) return
    if (typeof node.src === 'string' && node.src.trim() && !node.src.startsWith('data:')) node.src = await resolveSrc(node.src.trim())
    for (const paint of [node.fill, node.stroke]) {
      if (paint && typeof paint === 'object' && typeof paint.source === 'string' && !paint.source.startsWith('data:')) paint.source = await resolveSrc(paint.source.trim())
    }
    for (const child of Array.isArray(node.objects) ? node.objects : []) await visit(child, depth + 1)
    if (node.clipPath) await visit(node.clipPath, depth + 1)
  }
  for (const object of Array.isArray(canvas?.objects) ? canvas.objects : []) await visit(object)
  for (const key of ['backgroundImage', 'overlayImage']) if (canvas?.[key]) await visit(canvas[key])
}

/** Canvas de uma página salva: inline ou no arquivo da pasta de projetos do próprio dono. */
export async function loadAccountPageCanvas(page: any, ownerId: string): Promise<any | null> {
  let canvas = page?.canvasData
  if (typeof canvas === 'string') { try { canvas = JSON.parse(canvas) } catch { canvas = null } }
  if ((!canvas || !Array.isArray(canvas.objects)) && page?.canvasDataPath) {
    const key = storageKeyFromRef(page.canvasDataPath, storageOptions())
    if (!key || !isValidStoragePath(key) || !(isUserProjectKey(key, ownerId) || isLegacyUserProjectKey(key, ownerId))) {
      return fail(403, 'A página do encarte está fora da pasta desta conta.')
    }
    const { bytes } = await readStorageObject(key, MAX_CANVAS_BYTES)
    const plain = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes, { maxOutputLength: MAX_CANVAS_BYTES }) : bytes
    try { canvas = JSON.parse(plain.toString('utf8')) } catch { return fail(422, 'A página salva do encarte está inválida.') }
  }
  return canvas && Array.isArray(canvas.objects) ? canvas : null
}

type DeliveryOutput = { key: string; label: string }

/** Gera e guarda um PNG por página/frame do encarte salvo do dono. */
async function renderAccountProject(ownerId: string, projectId: string): Promise<{ name: string; outputs: DeliveryOutput[]; truncated: boolean }> {
  const project = (await pgQuery<any>(`select id, name, canvas_data from public.projects
    where id = $1 and user_id = $2 and coalesce(is_template, false) = false limit 1`, [projectId, ownerId])).rows[0]
  if (!project) return fail(404, 'O encarte não está mais disponível nesta conta.')
  const source = Array.isArray(project.canvas_data) ? project.canvas_data : project.canvas_data?.pages
  const pages: any[] = Array.isArray(source) ? source : []
  const outputs: DeliveryOutput[] = []
  let truncated = false
  for (const page of pages) {
    if (outputs.length >= MAX_ACCOUNT_PROJECT_PAGES) { truncated = true; break }
    const canvas = await loadAccountPageCanvas(page, ownerId)
    if (!canvas || !canvas.objects.length) continue
    await embedAccountCanvasImages(canvas, ownerId)
    const width = Math.round(Number(page?.width || canvas.width || 0))
    const height = Math.round(Number(page?.height || canvas.height || 0))
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 32 || height < 32) continue
    const rendered = await renderSavedCanvasPage({ canvas, width, height, maxOutputs: MAX_ACCOUNT_PROJECT_PAGES - outputs.length })
    for (const result of rendered) {
      if (outputs.length >= MAX_ACCOUNT_PROJECT_PAGES) { truncated = true; break }
      const key = `${accountProjectArtifactPrefix(ownerId, projectId)}${createHash('sha256').update(result.png).digest('hex').slice(0, 40)}.png`
      await getS3Client().send(new PutObjectCommand({
        Bucket: videoBucket(), Key: key, Body: result.png, ContentType: 'image/png', CacheControl: 'private, no-store',
        Metadata: { projectid: projectId }
      }))
      outputs.push({ key, label: `pagina-${outputs.length + 1}` })
    }
  }
  if (!outputs.length) return fail(422, 'O encarte salvo não tem páginas com conteúdo.')
  return { name: String(project.name || 'Encarte'), outputs, truncated }
}

/** Mensagens finais: cada página como imagem e o mesmo PNG como arquivo (padrão de finalSends). */
export function accountProjectSends(projectId: string, outputs: readonly DeliveryOutput[]): ConversationSend[] {
  return outputs.flatMap(output => {
    const base = { text: '', key: output.key, formatId: output.label, purpose: 'account_project' as const, accountProjectId: projectId, scope: 'account_project' as const }
    return [{ ...base, type: 'image' as const }, { ...base, type: 'document' as const }]
  })
}

async function finishJob(row: any, token: string, change: (state: ConversationState) => ConversationSend[] | null, correlation: string) {
  return pgTx(async client => {
    const current = (await client.query('SELECT state FROM public.whatsapp_creation_orders WHERE id=$1 AND owner_id=$2 FOR UPDATE', [row.id, row.owner_id])).rows[0]?.state as ConversationState | undefined
    if (!current || current.accountProject?.job?.token !== token) return { ok: true, stale: true }
    const send = change(current)
    if (!send) return { ok: true, stale: true }
    rememberConversationTurns(current, send.filter(item => item.type === 'text').map(item => ({ role: 'assistant' as const, text: item.text })))
    await client.query('UPDATE public.whatsapp_creation_orders SET state=$3::jsonb,updated_at=now() WHERE id=$1 AND owner_id=$2', [row.id, row.owner_id, JSON.stringify(current)])
    await queueCreationSend(client, row.conversation_id, row.owner_id, row.id, current, send, correlation)
    return { ok: true, count: send.filter(item => item.purpose === 'account_project').length }
  })
}

/**
 * Executa a entrega agendada pela conversa (generate/encarte com o token do job).
 * Confere vínculo, permissão e dono do projeto antes de ler qualquer arquivo.
 */
export async function deliverAccountProject(row: any, token: string) {
  const state = row.state as ConversationState
  const job = state.accountProject?.job
  if (!job || job.token !== token || job.projectId !== state.accountProject?.projectId) return fail(409, 'Solicitação de envio inválida ou já concluída.')
  if (job.started) return { ok: true, pending: true }
  if (Date.parse(job.until) < Date.now()) return fail(409, 'O pedido do encarte expirou. Peça de novo pelo WhatsApp.')
  const account = await resolveWhatsAppAccount(row.sender_phone)
  if (!account.ok || account.user.id !== row.owner_id) return fail(403, 'O vínculo da conta mudou.')
  assertCreationAccess(account.user, 'encarte')
  const started = new Date().toISOString()
  const claimed = await pgQuery(`UPDATE public.whatsapp_creation_orders SET state=jsonb_set(state,'{accountProject,job,started}',to_jsonb($3::text)),updated_at=now()
    WHERE id=$1 AND owner_id=$2 AND state->'accountProject'->'job'->>'token'=$4 AND state->'accountProject'->'job'->>'started' IS NULL RETURNING id`, [row.id, row.owner_id, started, token])
  if (!claimed.rows[0]) return { ok: true, pending: true }
  const projectId = job.projectId
  try {
    const result = await renderAccountProject(row.owner_id, projectId)
    return await finishJob(row, token, current => {
      current.accountProject = { projectId, projectName: result.name, deliveredAt: new Date().toISOString() }
      return [...accountProjectSends(projectId, result.outputs), { type: 'text', scope: 'account_project', text: result.truncated
        ? `Pronto! Enviei as ${result.outputs.length} primeiras páginas do encarte “${result.name}” em qualidade original. As demais continuam no editor da sua conta.`
        : `Pronto! Esse é o encarte “${result.name}” em qualidade original, do jeito que está salvo na sua conta.` }]
    }, `account-project:${row.id}:${token}`)
  } catch (error: any) {
    console.error('[whatsapp-creation:account-project-failed]', JSON.stringify({ orderId: row.id, projectId, statusCode: Number(error?.statusCode || 500), reason: String(error?.statusMessage || error?.name || 'unknown').slice(0, 200) }))
    await finishJob(row, token, current => {
      const name = current.accountProject?.projectName || 'esse encarte'
      current.accountProject = { ...current.accountProject, job: undefined }
      return [{ type: 'text', scope: 'account_project', text: Number(error?.statusCode) === 404
        ? `Não encontrei mais o encarte “${name}” na sua conta. Quer que eu procure outro?`
        : `Não consegui gerar o encarte “${name}” agora. Ele continua salvo na sua conta; quer que eu tente de novo?` }]
    }, `account-project-error:${row.id}:${token}`).catch(() => undefined)
    throw error
  }
}

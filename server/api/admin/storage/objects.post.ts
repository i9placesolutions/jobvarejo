import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { gzipSync } from 'node:zlib'
import { getS3Client } from '../../../../server/utils/s3'
import { requireSuperAdminUser } from '../../../../server/utils/auth'
import { enforceRateLimit } from '../../../../server/utils/rate-limit'
import {
  ADMIN_STORAGE_MAX_OBJECTS,
  ADMIN_STORAGE_MAX_TEXT_BYTES,
  adminStorageBucket,
  assertAdminStorageKey,
  assertAdminStorageObjectDoesNotExist,
  assertNotServerManaged,
  backupAdminStorageObject,
  copyAdminStorageObject,
  deleteAdminStorageObject,
  deleteAdminStorageObjects,
  hasAdminStoragePrefixObjects,
  listPrefixObjects,
  putAdminStorageObject,
  readAdminStorageText,
  setAdminStorageObjectText
} from '../../../../server/utils/admin-storage-manager'

const normalizeEtag = (value: unknown) => String(value || '').trim().replace(/^W\//, '').replace(/^"|"$/g, '')
const isJsonKey = (key: string) => /\.json(?:\.gz)?$/i.test(key)
const assertTextSize = (content: unknown): string => {
  if (typeof content !== 'string') throw createError({ statusCode: 400, statusMessage: 'O conteúdo precisa ser texto.' })
  if (Buffer.byteLength(content, 'utf8') > ADMIN_STORAGE_MAX_TEXT_BYTES) throw createError({ statusCode: 413, statusMessage: 'Arquivos de texto estão limitados a 1 MiB.' })
  return content
}
const validateJson = (key: string, content: string) => {
  if (!isJsonKey(key)) return
  try { JSON.parse(content) }
  catch { throw createError({ statusCode: 400, statusMessage: 'O conteúdo não é um JSON válido.' }) }
}
const errorMessage = (error: any) => String(error?.message || error?.statusMessage || 'Falha no Storage').slice(0, 300)
const partialFailure = (summary: string, details: Record<string, unknown>) => createError({
  statusCode: 500,
  statusMessage: summary,
  data: { partial: true, ...details }
})
const contentTypeForKey = (key: string) => isJsonKey(key) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8'
const runWithConcurrency = async <T, R>(items: T[], concurrency: number, task: (item: T, index: number) => Promise<R>) => {
  const results: Array<R | undefined> = new Array(items.length)
  const failures: Array<{ index: number; error: any }> = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= items.length) return
      const item = items[index]
      if (item === undefined) return
      try { results[index] = await task(item, index) }
      catch (error) { failures.push({ index, error }) }
    }
  })
  await Promise.all(workers)
  return { results, failures }
}
const ensurePutDidNotRace = (error: any) => {
  if (Number(error?.$metadata?.httpStatusCode) === 412 || error?.name === 'PreconditionFailed') {
    throw createError({ statusCode: 409, statusMessage: 'O arquivo foi alterado por outra operação. Atualize e tente novamente.' })
  }
  throw error
}

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-storage-mutate:${user.id}`, 30, 60_000)
  const body = await readBody(event)
  const action = String(body?.action || '')
  const bucket = adminStorageBucket()
  const s3 = getS3Client()

  if (action === 'create-folder') {
    const key = assertAdminStorageKey(body?.key, { allowFolder: true })
    if (!key.endsWith('/')) throw createError({ statusCode: 400, statusMessage: 'A pasta precisa terminar com /.' })
    assertNotServerManaged(key)
    if (await hasAdminStoragePrefixObjects(s3, bucket, key)) throw createError({ statusCode: 409, statusMessage: 'Já existe conteúdo nesse caminho.' })
    try {
      await putAdminStorageObject(s3, bucket, key, Buffer.alloc(0), 'application/x-directory')
    } catch (error: any) { ensurePutDidNotRace(error) }
    return { ok: true, key }
  }

  if (action === 'create-file') {
    const key = assertAdminStorageKey(body?.key)
    assertNotServerManaged(key)
    const content = assertTextSize(body?.content)
    validateJson(key, content)
    try {
      const textBytes = Buffer.from(content, 'utf8')
      await putAdminStorageObject(s3, bucket, key, key.toLowerCase().endsWith('.json.gz') ? gzipSync(textBytes) : textBytes, contentTypeForKey(key))
    } catch (error: any) { ensurePutDidNotRace(error) }
    return { ok: true, key }
  }

  if (action === 'save-file') {
    const key = assertAdminStorageKey(body?.key)
    assertNotServerManaged(key)
    const content = assertTextSize(body?.content)
    validateJson(key, content)
    const etag = String(body?.etag || '').trim()
    if (!etag) throw createError({ statusCode: 428, statusMessage: 'Atualize o arquivo e envie o ETag para evitar sobrescrever alterações recentes.' })
    const current = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    if (normalizeEtag(current.ETag) !== normalizeEtag(etag)) throw createError({ statusCode: 409, statusMessage: 'O arquivo foi alterado desde a leitura. Recarregue antes de salvar.' })
    const original = await readAdminStorageText(s3, bucket, key, current.ContentLength)
    const backupKey = await backupAdminStorageObject(s3, bucket, key, current.ETag || undefined)
    try {
      await setAdminStorageObjectText(s3, bucket, key, content, current, original.wasGzip, current.ETag || etag)
    } catch (error: any) {
      if (Number(error?.$metadata?.httpStatusCode) === 412 || error?.name === 'PreconditionFailed') {
        throw createError({ statusCode: 409, statusMessage: 'O arquivo mudou antes do salvamento; backup preservado.', data: { key, backupKey } })
      }
      throw partialFailure('O arquivo não foi salvo; o backup foi preservado.', { key, backupKey, phase: 'save', error: errorMessage(error) })
    }
    return { ok: true, key, backupKey }
  }

  if (action === 'move') {
    const kind = body?.kind === 'folder' ? 'folder' : body?.kind === 'file' ? 'file' : null
    if (!kind) throw createError({ statusCode: 400, statusMessage: 'Informe kind como file ou folder.' })
    const sourceKey = assertAdminStorageKey(body?.sourceKey, { allowFolder: kind === 'folder' })
    const destinationKey = assertAdminStorageKey(body?.destinationKey, { allowFolder: kind === 'folder' })
    if ((kind === 'folder') !== sourceKey.endsWith('/') || (kind === 'folder') !== destinationKey.endsWith('/')) {
      throw createError({ statusCode: 400, statusMessage: 'A barra final da chave precisa corresponder ao tipo da operação.' })
    }
    if (sourceKey === destinationKey || (kind === 'folder' && destinationKey.startsWith(sourceKey))) {
      throw createError({ statusCode: 400, statusMessage: 'O destino não pode ser igual à origem nem ficar dentro dela.' })
    }
    assertNotServerManaged(sourceKey)
    assertNotServerManaged(destinationKey)

    if (kind === 'file') {
      const source = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: sourceKey }))
      if (!source.ETag) throw createError({ statusCode: 409, statusMessage: 'A origem não tem ETag; recarregue antes de mover.' })
      await assertAdminStorageObjectDoesNotExist(s3, bucket, destinationKey)
      const backupKey = await backupAdminStorageObject(s3, bucket, sourceKey, source.ETag || undefined)
      try {
        await copyAdminStorageObject(s3, bucket, sourceKey, destinationKey, source.ETag || undefined)
      } catch (error: any) {
        throw partialFailure('A cópia falhou; o original e o backup continuam disponíveis.', { sourceKey, destinationKey, backupKey, phase: 'copy', copied: false, deleted: false, error: errorMessage(error) })
      }
      try {
        await deleteAdminStorageObject(s3, bucket, sourceKey, source.ETag || undefined)
      } catch (error: any) {
        throw partialFailure('A cópia foi criada, mas a origem não foi excluída.', { sourceKey, destinationKey, backupKey, phase: 'delete-source', copied: true, deleted: false, error: errorMessage(error) })
      }
      return { ok: true, sourceKey, destinationKey, backupKey }
    }

    const objects = await listPrefixObjects(s3, bucket, sourceKey, ADMIN_STORAGE_MAX_OBJECTS)
    if (!objects.length) throw createError({ statusCode: 404, statusMessage: 'Pasta vazia ou não encontrada.' })
    if (objects.some(item => !item.etag)) throw createError({ statusCode: 409, statusMessage: 'Alguns objetos não têm ETag para proteger a movimentação. Atualize e tente novamente.' })
    const targets = objects.map(item => ({ ...item, destinationKey: `${destinationKey}${item.key.slice(sourceKey.length)}` }))
    if (await hasAdminStoragePrefixObjects(s3, bucket, destinationKey)) throw createError({ statusCode: 409, statusMessage: 'A pasta de destino já contém objetos.' })
    for (const item of objects) assertNotServerManaged(item.key)
    const backupRun = await runWithConcurrency(objects, 4, async item => ({ sourceKey: item.key, backupKey: await backupAdminStorageObject(s3, bucket, item.key, item.etag) }))
    const backups = backupRun.results.filter((item): item is { sourceKey: string; backupKey: string } => Boolean(item))
    if (backupRun.failures.length) {
      throw partialFailure('Falha durante os backups; nenhum objeto de origem foi movido ou excluído.', { sourceKey, destinationKey, phase: 'backup', backups, failures: backupRun.failures.map(f => ({ key: objects[f.index]?.key || 'desconhecido', error: errorMessage(f.error) })), limit: ADMIN_STORAGE_MAX_OBJECTS })
    }
    const copied: string[] = []
    const copyRun = await runWithConcurrency(targets, 4, async item => {
      await copyAdminStorageObject(s3, bucket, item.key, item.destinationKey, item.etag)
      return item.destinationKey
    })
    copied.push(...copyRun.results.filter((item): item is string => Boolean(item)))
    if (copyRun.failures.length) {
      throw partialFailure('Falha durante a cópia; os originais e backups foram mantidos. Revise as cópias parciais no destino.', { sourceKey, destinationKey, phase: 'copy', backups, copied, failures: copyRun.failures.map(f => ({ key: targets[f.index]?.key || 'desconhecido', error: errorMessage(f.error) })), limit: ADMIN_STORAGE_MAX_OBJECTS })
    }
    try {
      const deleted = await deleteAdminStorageObjects(s3, bucket, objects)
      if (deleted.errors.length || deleted.deleted.length !== objects.length) {
        throw partialFailure('A cópia foi concluída, mas a exclusão da origem ficou parcial.', { sourceKey, destinationKey, phase: 'delete-source', backups, copied, deleted: deleted.deleted, errors: deleted.errors })
      }
      if (await hasAdminStoragePrefixObjects(s3, bucket, sourceKey)) {
        throw partialFailure('Novos objetos apareceram na origem durante a movimentação; revise a pasta antes de repetir.', { sourceKey, destinationKey, phase: 'verify-source', backups, copied })
      }
    } catch (error: any) {
      if (error?.statusCode) throw error
      throw partialFailure('A cópia foi concluída, mas a exclusão da origem falhou.', { sourceKey, destinationKey, phase: 'delete-source', backups, copied, error: errorMessage(error) })
    }
    return { ok: true, sourceKey, destinationKey, moved: objects.length, backups, limit: ADMIN_STORAGE_MAX_OBJECTS }
  }

  if (action === 'delete') {
    const kind = body?.kind === 'folder' ? 'folder' : body?.kind === 'file' ? 'file' : null
    if (!kind) throw createError({ statusCode: 400, statusMessage: 'Informe kind como file ou folder.' })
    if (body?.confirm !== true) throw createError({ statusCode: 400, statusMessage: 'Confirme a exclusão com confirm: true.' })
    const key = assertAdminStorageKey(body?.key, { allowFolder: kind === 'folder' })
    if ((kind === 'folder') !== key.endsWith('/')) throw createError({ statusCode: 400, statusMessage: 'A barra final da chave precisa corresponder ao tipo da operação.' })
    assertNotServerManaged(key)
    const objects = kind === 'folder'
      ? await listPrefixObjects(s3, bucket, key, ADMIN_STORAGE_MAX_OBJECTS)
      : [{ key, etag: (await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ETag }]
    if (!objects.length) throw createError({ statusCode: 404, statusMessage: 'Pasta não encontrada ou vazia.' })
    if (objects.some(item => !item.etag)) throw createError({ statusCode: 409, statusMessage: 'Alguns objetos não têm ETag para proteger a exclusão. Atualize e tente novamente.' })
    for (const item of objects) assertNotServerManaged(item.key)
    const backupRun = await runWithConcurrency(objects, 4, async item => ({ sourceKey: item.key, backupKey: await backupAdminStorageObject(s3, bucket, item.key, item.etag) }))
    const backups = backupRun.results.filter((item): item is { sourceKey: string; backupKey: string } => Boolean(item))
    if (backupRun.failures.length) {
      throw partialFailure('Falha durante os backups; os objetos originais não foram excluídos.', { key, phase: 'backup', backups, failures: backupRun.failures.map(f => ({ key: objects[f.index]?.key || 'desconhecido', error: errorMessage(f.error) })), limit: ADMIN_STORAGE_MAX_OBJECTS })
    }
    if (kind === 'file') {
      const object = objects[0]
      if (!object) throw createError({ statusCode: 404, statusMessage: 'Arquivo não encontrado.' })
      try { await deleteAdminStorageObject(s3, bucket, key, object.etag) }
      catch (error: any) { throw partialFailure('Backup criado, mas o arquivo original não foi excluído.', { key, backups, phase: 'delete', error: errorMessage(error) }) }
      return { ok: true, deleted: 1, backups }
    }
    try {
      const result = await deleteAdminStorageObjects(s3, bucket, objects)
      if (result.errors.length || result.deleted.length !== objects.length) {
        throw partialFailure('A exclusão ficou parcial; backups foram preservados.', { key, backups, phase: 'delete', deleted: result.deleted, errors: result.errors })
      }
      if (await hasAdminStoragePrefixObjects(s3, bucket, key)) {
        throw partialFailure('Novos objetos apareceram na pasta durante a exclusão; revise antes de repetir.', { key, phase: 'verify-folder', backups, deleted: result.deleted })
      }
      return { ok: true, deleted: result.deleted.length, backups, limit: ADMIN_STORAGE_MAX_OBJECTS }
    } catch (error: any) {
      if (error?.statusCode) throw error
      throw partialFailure('A exclusão falhou; backups foram preservados.', { key, backups, phase: 'delete', error: errorMessage(error) })
    }
  }

  throw createError({ statusCode: 400, statusMessage: 'Ação de Storage desconhecida.' })
})

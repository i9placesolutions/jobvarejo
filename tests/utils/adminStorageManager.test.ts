import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { gunzipSync, gzipSync } from 'node:zlib'
import {
  assertAdminStorageKey,
  assertAdminStorageObjectDoesNotExist,
  backupAdminStorageObject,
  copyAdminStorageObject,
  hasAdminStoragePrefixObjects,
  putAdminStorageObject,
  readAdminStorageText,
  setAdminStorageObjectText
} from '../../server/utils/admin-storage-manager'

const fakeCreateError = (options: { statusCode?: number; statusMessage?: string }) => Object.assign(new Error(options.statusMessage), options)

describe('admin storage manager', () => {
  beforeEach(() => vi.stubGlobal('createError', fakeCreateError))

  it('permite somente as quatro raízes e bloqueia traversal e backups internos', () => {
    expect(assertAdminStorageKey('projects/user/file.json')).toBe('projects/user/file.json')
    expect(assertAdminStorageKey('uploads/file .txt')).toBe('uploads/file .txt')
    expect(assertAdminStorageKey('logo/folder/', { allowFolder: true })).toBe('logo/folder/')
    for (const key of ['../../outside', 'projects/../outside', 'projects//user/x', 'admin-storage-backups/x', 'builder/x']) {
      expect(() => assertAdminStorageKey(key, { allowFolder: true })).toThrow()
    }
  })

  it('recusa criação sobre chave existente e usa IfNoneMatch para proteger a gravação contra corrida', async () => {
    const existingS3 = { send: vi.fn().mockResolvedValue({ ETag: '"old"' }) } as any
    await expect(assertAdminStorageObjectDoesNotExist(existingS3, 'bucket', 'uploads/x.png')).rejects.toMatchObject({ statusCode: 409 })

    const s3 = { send: vi.fn().mockResolvedValue({ ETag: '"new"' }) } as any
    await putAdminStorageObject(s3, 'bucket', 'uploads/x.png', Buffer.from('image'), 'image/png')
    const command = s3.send.mock.calls[0][0] as PutObjectCommand
    expect(command.input.IfNoneMatch).toBe('*')
    expect(command.input.ACL).toBe('public-read')
  })

  it('faz cópia de backup com ETag e ACL privada e preserva ACL pública ao copiar para raiz pública', async () => {
    const s3 = { send: vi.fn().mockResolvedValue({ ETag: '"copy"' }) } as any
    await backupAdminStorageObject(s3, 'bucket', 'uploads/a.txt', '"source"')
    const backupCopy = s3.send.mock.calls[0][0] as CopyObjectCommand
    expect(backupCopy.input.MetadataDirective).toBe('COPY')
    expect(backupCopy.input.CopySourceIfMatch).toBe('"source"')
    expect(backupCopy.input.IfNoneMatch).toBe('*')
    expect(backupCopy.input.ACL).toBeUndefined()
    expect(backupCopy.input.Key).toMatch(/^admin-storage-backups\//)

    await copyAdminStorageObject(s3, 'bucket', 'projects/user/a.png', 'imagens/a.png', '"etag"')
    const moveCopy = s3.send.mock.calls[1][0] as CopyObjectCommand
    expect(moveCopy.input.ACL).toBe('public-read')
    expect(moveCopy.input.CopySourceIfMatch).toBe('"etag"')
    expect(moveCopy.input.IfNoneMatch).toBe('*')
  })

  it('trata 404 do HeadObject como chave livre', async () => {
    const s3 = { send: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } })) } as any
    await expect(assertAdminStorageObjectDoesNotExist(s3, 'bucket', 'logo/new.png')).resolves.toBeUndefined()
    expect(s3.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand)
  })

  it('detecta pasta existente sem impor o limite da operação em lote', async () => {
    const s3 = { send: vi.fn().mockResolvedValue({ Contents: [{ Key: 'uploads/pasta/a' }], IsTruncated: true }) } as any
    await expect(hasAdminStoragePrefixObjects(s3, 'bucket', 'uploads/pasta/')).resolves.toBe(true)
    const command = s3.send.mock.calls[0][0] as ListObjectsV2Command
    expect(command.input.MaxKeys).toBe(1)
  })

  it('lê e salva JSON compactado preservando gzip e ETag', async () => {
    const original = gzipSync(Buffer.from('{"title":"antes"}'))
    const s3 = { send: vi.fn().mockResolvedValueOnce({
      Body: { transformToByteArray: async () => original },
      ETag: '"old"',
      ContentType: 'application/json'
    }).mockResolvedValueOnce({}) } as any
    const read = await readAdminStorageText(s3, 'bucket', 'projects/u/p/page.json', original.length)
    expect(read.content).toBe('{"title":"antes"}')
    expect(read.wasGzip).toBe(true)
    await setAdminStorageObjectText(s3, 'bucket', 'projects/u/p/page.json', '{"title":"depois"}', { ContentType: 'application/json' }, true, '"old"')
    const saved = s3.send.mock.calls[1][0] as PutObjectCommand
    expect(saved.input.IfMatch).toBe('"old"')
    expect(gunzipSync(saved.input.Body as Buffer).toString('utf8')).toBe('{"title":"depois"}')
  })
})

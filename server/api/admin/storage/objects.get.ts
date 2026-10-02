import { getS3Client } from '../../../../server/utils/s3'
import { requireSuperAdminUser } from '../../../../server/utils/auth'
import { enforceRateLimit } from '../../../../server/utils/rate-limit'
import { ADMIN_STORAGE_ROOTS, adminStorageBucket, assertAdminStoragePrefix, listAdminStorageTree } from '../../../../server/utils/admin-storage-manager'

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-storage-list:${user.id}`, 120, 60_000)
  const query = getQuery(event)
  const prefix = assertAdminStoragePrefix(query.prefix)
  const token = String(query.token || '').trim() || undefined

  if (!prefix) {
    return {
      prefix: '',
      folders: ADMIN_STORAGE_ROOTS.map(key => ({ key, name: key.slice(0, -1) })),
      files: [],
      nextToken: null
    }
  }

  return listAdminStorageTree(getS3Client(), adminStorageBucket(), prefix, token)
})

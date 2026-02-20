import { ListBucketsCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '~/server/utils/s3'
import { requireAdminUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `test-buckets:${user.id}`, 20, 60_000)
  if (process.env.NODE_ENV !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  try {
    const s3Client = getS3Client()
    const config = useRuntimeConfig()

    // List all buckets
    const result = await s3Client.send(new ListBucketsCommand({}))

    return {
      success: true,
      endpoint: config.wasabiEndpoint,
      buckets: result.Buckets?.map(b => ({
        name: b.Name,
        creationDate: b.CreationDate
      })) || []
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      name: error.name,
      code: error.$metadata?.httpStatusCode
    }
  }
})

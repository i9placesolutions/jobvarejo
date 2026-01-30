import { ListBucketsCommand } from '@aws-sdk/client-s3'
import { getS3Client } from '~/server/utils/s3'

export default defineEventHandler(async (event) => {
  try {
    const s3Client = getS3Client()
    const config = useRuntimeConfig()

    // List all buckets
    const result = await s3Client.send(new ListBucketsCommand({}))

    return {
      success: true,
      endpoint: config.contaboEndpoint,
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

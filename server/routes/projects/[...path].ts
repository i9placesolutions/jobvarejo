/**
 * Proxy route for project images stored in Contabo Storage
 * Since buckets are public, this redirects to the actual storage URL
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path')

  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  // Build Contabo Storage public URL
  const endpoint = process.env.CONTABO_ENDPOINT || 'usc1.contabostorage.com'
  const bucket = process.env.CONTABO_BUCKET || 'jobupload'
  const publicUrl = `https://${endpoint}/${bucket}/projects/${path}`

  console.log('[Image Proxy] Redirecting to:', publicUrl)

  // Fetch from public Contabo Storage
  try {
    const response = await fetch(publicUrl)

    if (!response.ok) {
      console.error('[Image Proxy] Failed:', response.status, publicUrl)
      throw createError({
        statusCode: response.status,
        statusMessage: 'Image not found'
      })
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()

    // Set appropriate headers for caching
    setResponseHeaders(event, {
      'Content-Type': response.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable', // 1 year cache
    })

    return imageBuffer
  } catch (error: any) {
    console.error('[Image Proxy] Error:', error.message)

    // Return 404 with more info
    throw createError({
      statusCode: 404,
      statusMessage: `Image not found: ${path}`
    })
  }
})

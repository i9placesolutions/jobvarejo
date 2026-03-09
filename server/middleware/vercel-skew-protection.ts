export default defineEventHandler((event) => {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID
  const skewProtectionEnabled =
    process.env.VERCEL === '1' &&
    process.env.VERCEL_SKEW_PROTECTION_ENABLED === '1'

  if (!skewProtectionEnabled || !deploymentId) {
    return
  }

  if (event.method !== 'GET' && event.method !== 'HEAD') {
    return
  }

  const secFetchDest = getRequestHeader(event, 'sec-fetch-dest')
  const accept = getRequestHeader(event, 'accept') || ''
  const isDocumentRequest =
    secFetchDest === 'document' ||
    (!secFetchDest && accept.includes('text/html'))

  if (!isDocumentRequest) {
    return
  }

  if (getCookie(event, '__vdpl') === deploymentId) {
    return
  }

  // Pin subsequent asset requests to the same Vercel deployment as the HTML.
  setCookie(event, '__vdpl', deploymentId, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  })
})

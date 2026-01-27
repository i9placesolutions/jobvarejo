// Define public routes that don't require authentication
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]

// Helper to parse cookies (works on both client and server)
const getCookie = (name: string, cookieHeader?: string): string | null => {
  const cookies = cookieHeader || (process.client ? document.cookie : '')
  if (!cookies) return null

  const cookieArray = cookies.split(';').map(c => c.trim())
  const found = cookieArray.find(c => c.startsWith(`${name}=`))
  return found ? found.split('=')[1] : null
}

export default defineNuxtRouteMiddleware((to) => {
  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => to.path.startsWith(route))
  if (isPublicRoute) {
    return
  }

  // Check auth cookie
  // On server, we need to use useRequestEvent to access cookies
  let isAuthenticated = false

  if (import.meta.server) {
    // Server-side: use request event
    const event = useRequestEvent()
    const cookieHeader = event?.node?.req?.headers?.cookie
    isAuthenticated = getCookie('authenticated', cookieHeader) === 'true'
  } else {
    // Client-side: use document.cookie
    isAuthenticated = getCookie('authenticated') === 'true'
  }

  if (!isAuthenticated) {
    return navigateTo('/auth/login')
  }
})

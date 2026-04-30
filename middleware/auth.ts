// Define public routes that don't require authentication
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => to.path.startsWith(route))
  if (isPublicRoute) {
    return
  }

  // This app runs protected pages as client-side routes.
  // Server-side checks here can be inconsistent without SSR auth helpers.
  if (import.meta.server) {
    return
  }

  const auth = useAuth()

  // Skip the round-trip if we already have a valid authenticated session in memory
  if (!auth.isAuthenticated.value || !auth.user.value) {
    await auth.getSession()
  }

  if (!auth.isAuthenticated.value) {
    // For /admin/builder/* routes, also accept builder admin sessions
    if (to.path.startsWith('/admin/builder')) {
      const builderAuth = useBuilderAuth()
      if (!builderAuth.isAuthenticated.value) {
        await builderAuth.getSession()
      }
      if (builderAuth.isAuthenticated.value) {
        return // builder admin session is valid, let admin middleware check role
      }
    }
    return navigateTo('/auth/login', { replace: true })
  }
})

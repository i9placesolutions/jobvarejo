// Rotas públicas (sem autenticação)
const publicRoutes = [
  '/landing',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/terms',
  '/privacy',
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow public routes
  const isPublicRoute = publicRoutes.some(route => to.path === route || to.path.startsWith(`${route}/`))
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
    // Visitantes na home vão para a landing; demais rotas protegidas → login
    if (to.path === '/' || to.path === '') {
      return navigateTo('/landing', { replace: true })
    }
    return navigateTo('/auth/login', { replace: true })
  }
})

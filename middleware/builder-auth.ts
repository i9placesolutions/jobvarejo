// Builder routes that don't require authentication
const publicBuilderRoutes = [
  '/builder/login',
  '/builder/register',
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Only handle /builder/* routes
  if (!to.path.startsWith('/builder')) return

  const isPublicRoute = publicBuilderRoutes.some(route => to.path.startsWith(route))
  if (isPublicRoute) return

  if (import.meta.server) return

  const auth = useBuilderAuth()

  if (!auth.isAuthenticated.value || !auth.tenant.value) {
    await auth.getSession()
  }

  if (!auth.isAuthenticated.value) {
    return navigateTo('/builder/login')
  }
})

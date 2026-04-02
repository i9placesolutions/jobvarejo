// Builder routes that don't require authentication
const publicBuilderRoutes = [
  '/builder/login',
  '/builder/register',
]

export default defineNuxtRouteMiddleware(async (to) => {
  // Handle /builder/* and /canva/* routes
  const isBuilderRoute = to.path.startsWith('/builder')
  const isCanvaRoute = to.path.startsWith('/canva')
  if (!isBuilderRoute && !isCanvaRoute) return

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

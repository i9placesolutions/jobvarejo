// Builder routes that don't require authentication
const publicBuilderRoutes = [
  '/builder/login',
  '/builder/register',
]

const sharedSaaSRoutes = ['/quick-editor', '/business-profile']

export default defineNuxtRouteMiddleware(async (to) => {
  // Handle /builder/* and /canva/* routes
  const isBuilderRoute = to.path.startsWith('/builder')
  const isCanvaRoute = to.path.startsWith('/canva')
  const isSharedSaaSRoute = sharedSaaSRoutes.some(route => to.path.startsWith(route))
  if (!isBuilderRoute && !isCanvaRoute && !isSharedSaaSRoute) return

  const isPublicRoute = publicBuilderRoutes.some(route => to.path.startsWith(route))
  if (isPublicRoute) return

  if (import.meta.server) return

  const auth = useBuilderAuth()
  const shouldForceSessionRefresh = isCanvaRoute

  if (shouldForceSessionRefresh || !auth.isAuthenticated.value || !auth.tenant.value) {
    await auth.getSession()
  }

  if (!auth.isAuthenticated.value) {
    // Preservar destino original para redirecionar apos login
    const redirect = isCanvaRoute ? to.fullPath : undefined
    const loginPath = isSharedSaaSRoute ? '/auth/login' : '/builder/login'
    return navigateTo({
      path: loginPath,
      query: redirect ? { redirect } : undefined,
    })
  }
})

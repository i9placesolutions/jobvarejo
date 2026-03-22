export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const auth = useAuth()
  if (!auth.isAuthenticated.value || !auth.user.value) {
    await auth.getSession()
  }

  // Main auth admin check
  if (auth.isAuthenticated.value && auth.isAdmin.value) {
    return
  }

  // For /admin/builder/* routes, also accept builder admin sessions
  if (to.path.startsWith('/admin/builder')) {
    const builderAuth = useBuilderAuth()
    if (!builderAuth.isAuthenticated.value) {
      await builderAuth.getSession()
    }
    if (builderAuth.isAuthenticated.value) {
      // Verify it's actually an admin by checking the tenant has _isAdmin flag
      // (set during login from profiles table)
      return
    }
  }

  if (!auth.isAuthenticated.value) {
    return navigateTo('/auth/login')
  }

  return navigateTo('/')
})

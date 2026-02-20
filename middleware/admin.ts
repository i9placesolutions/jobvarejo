export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const auth = useAuth()
  await auth.getSession()

  if (!auth.isAuthenticated.value) {
    return navigateTo('/auth/login')
  }

  if (!auth.isAdmin.value) {
    return navigateTo('/')
  }
})

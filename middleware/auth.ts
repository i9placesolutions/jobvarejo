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

  try {
    const supabase = useSupabase()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session) {
      return navigateTo('/auth/login')
    }
  } catch {
    return navigateTo('/auth/login')
  }
})

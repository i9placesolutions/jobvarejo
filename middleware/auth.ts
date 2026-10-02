import { shouldPromptBusinessProfileOnboarding } from '~/utils/businessProfile'

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

  const path = to.path
  const role = auth.user.value?.role
  if (role === 'user') {
    const permitted = path === '/' || path === '/quick-editor' || path === '/business-profile' ||
      path === '/profile' || path.startsWith('/videos') || path.startsWith('/cartazista') ||
      path.startsWith('/radio-indoor') || path === '/plans' || path === '/billing' ||
      (path.startsWith('/editor/') && String(to.query.quick || '') === '1')
    if (!permitted) return navigateTo('/', { replace: true })

    if (path !== '/business-profile') {
      let shouldOnboard = true
      try {
        const profile = await $fetch<{ business_profile?: unknown }>('/api/profile?self=1')
        shouldOnboard = shouldPromptBusinessProfileOnboarding(role, profile?.business_profile)
      } catch {
        // Fail closed for offer creation when the persisted profile is unknown.
      }
      if (shouldOnboard) {
        return navigateTo({
          path: '/business-profile',
          query: { onboarding: '1', returnTo: to.fullPath || '/' }
        }, { replace: true })
      }
    }
  }
  if (role === 'editor') {
    if (path.startsWith('/admin/')) return navigateTo('/', { replace: true })
    const area = path.startsWith('/videos') ? 'videos'
      : path.startsWith('/cartazista') ? 'cartazes'
        : path.startsWith('/art-studio') ? 'artes'
          : path.startsWith('/radio-indoor') ? 'radio'
            : path.startsWith('/builder') ? 'builder'
              : path === '/business-profile' ? 'loja'
                : ['/quick-editor', '/flyer-templates', '/label-templates', '/card-configurations', '/zone-structures'].includes(path) || path.startsWith('/editor/') ? 'encartes' : null
    if (area && !auth.can(area)) return navigateTo('/', { replace: true })
    if (!area && path !== '/' && path !== '/profile') return navigateTo('/', { replace: true })
  }
})

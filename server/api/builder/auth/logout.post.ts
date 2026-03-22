export default defineEventHandler(async (event) => {
  // Clear cookies on both paths (/ for new sessions, /builder for legacy)
  deleteCookie(event, 'builder-access-token', { path: '/' })
  deleteCookie(event, 'builder-authenticated', { path: '/' })
  deleteCookie(event, 'builder-access-token', { path: '/builder' })
  deleteCookie(event, 'builder-authenticated', { path: '/builder' })

  return { ok: true }
})

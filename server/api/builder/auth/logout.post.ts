export default defineEventHandler(async (event) => {
  deleteCookie(event, 'builder-access-token', { path: '/builder' })
  deleteCookie(event, 'builder-authenticated', { path: '/builder' })

  return { ok: true }
})

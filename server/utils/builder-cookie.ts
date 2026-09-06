import type { H3Event } from 'h3'
import { getAuthCookieOptions } from './auth-cookie'

export const setBuilderAuthCookies = (event: H3Event, token: string, expiresIn: number) => {
  const base = getAuthCookieOptions(event, expiresIn)

  setCookie(event, 'builder-access-token', token, {
    ...base,
    httpOnly: true,
  })

  setCookie(event, 'builder-authenticated', 'true', {
    ...base,
    httpOnly: false,
  })
}

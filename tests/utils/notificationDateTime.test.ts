import { describe, expect, it } from 'vitest'
import { formatNotificationDateTime } from '../../utils/notificationDateTime'

describe('formatNotificationDateTime', () => {
  it('uses Brazilian date and time in Sao Paulo, including a UTC day boundary', () => {
    expect(formatNotificationDateTime('2026-10-02T00:30:00.000Z')).toBe('01/10/2026 às 21:30')
    expect(formatNotificationDateTime('2026-10-02T12:34:00.000Z')).toBe('02/10/2026 às 09:34')
  })

  it('does not present an invalid timestamp as a current event', () => {
    expect(formatNotificationDateTime('')).toBe('Data indisponível')
  })
})

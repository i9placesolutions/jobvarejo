import { describe, expect, it } from 'vitest'
import { activeLocalSchedule } from '../../server/utils/radio-indoor'

const mondayNight = {
  id: 'night',
  timezone: 'America/Sao_Paulo',
  days_of_week: [1],
  start_time: '22:00:00',
  end_time: '02:00:00',
  priority: 100,
  starts_on: null,
  ends_on: null
}

describe('programação local da Rádio Indoor', () => {
  it('toca continuamente quando início e fim são 00:00 em todos os dias', () => {
    const allDay = { ...mondayNight, id: 'all-day', days_of_week: [0, 1, 2, 3, 4, 5, 6], start_time: '00:00', end_time: '00:00' }
    expect(activeLocalSchedule([allDay], new Date('2026-09-21T03:00:00Z'))?.id).toBe('all-day')
    expect(activeLocalSchedule([allDay], new Date('2026-09-22T02:59:00Z'))?.id).toBe('all-day')
    expect(activeLocalSchedule([allDay], new Date('2026-09-27T15:00:00Z'))?.id).toBe('all-day')
  })
  it('dá preferência a uma programação própria sobre a grade base', () => {
    const base = { ...mondayNight, id: 'base', days_of_week: [0, 1, 2, 3, 4, 5, 6], start_time: '00:00', end_time: '00:00', priority: 10_000 }
    const custom = { ...mondayNight, id: 'custom', start_time: '08:00', end_time: '18:00', priority: 100 }
    expect(activeLocalSchedule([base, custom], new Date('2026-09-21T14:00:00Z'))?.id).toBe('custom')
    expect(activeLocalSchedule([base, custom], new Date('2026-09-21T23:00:00Z'))?.id).toBe('base')
  })
  it('mantém o programa de segunda durante a madrugada de terça', () => {
    expect(activeLocalSchedule([mondayNight], new Date('2026-09-22T04:30:00Z'))?.id).toBe('night')
    expect(activeLocalSchedule([mondayNight], new Date('2026-09-22T05:00:00Z'))).toBeNull()
  })

  it('aplica datas de início e fim ao dia em que o bloco começa', () => {
    const schedule = { ...mondayNight, starts_on: '2026-09-21', ends_on: '2026-09-21' }
    expect(activeLocalSchedule([schedule], new Date('2026-09-22T04:30:00Z'))?.id).toBe('night')
    expect(activeLocalSchedule([schedule], new Date('2026-09-29T04:30:00Z'))).toBeNull()
    expect(activeLocalSchedule([{ ...schedule, starts_on: new Date('2026-09-21T00:00:00Z'), ends_on: new Date('2026-09-21T00:00:00Z') }], new Date('2026-09-22T04:30:00Z'))?.id).toBe('night')
  })

  it('usa a menor prioridade entre horários simultâneos', () => {
    const now = new Date('2026-09-21T14:00:00Z')
    const schedules = [
      { ...mondayNight, id: 'second', start_time: '08:00', end_time: '18:00', priority: 200 },
      { ...mondayNight, id: 'first', start_time: '08:00', end_time: '18:00', priority: 10 }
    ]
    expect(activeLocalSchedule(schedules, now)?.id).toBe('first')
  })
})

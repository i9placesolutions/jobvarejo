import { describe, it, expect, vi } from 'vitest'
import { scheduleIdleWork } from '~/utils/idleSchedule'

describe('scheduleIdleWork', () => {
  it('SSR (window undefined): executa imediatamente', () => {
    // No vitest node env, window e' undefined por default
    const work = vi.fn()
    scheduleIdleWork(work)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('com requestIdleCallback: agenda via rIC com timeout', () => {
    const ricFn = vi.fn((cb: any) => cb())
    const fakeWindow: any = {
      requestIdleCallback: ricFn,
      setTimeout: vi.fn()
    }
    ;(globalThis as any).window = fakeWindow

    try {
      const work = vi.fn()
      scheduleIdleWork(work, 5000)
      expect(ricFn).toHaveBeenCalledTimes(1)
      expect(ricFn.mock.calls[0]?.[1]).toEqual({ timeout: 5000 })
      expect(work).toHaveBeenCalledTimes(1)
    } finally {
      delete (globalThis as any).window
    }
  })

  it('sem requestIdleCallback: cai em setTimeout com min(1200, timeoutMs)', () => {
    const setTimeoutFn = vi.fn((cb: any) => cb())
    const fakeWindow: any = {
      setTimeout: setTimeoutFn
    }
    ;(globalThis as any).window = fakeWindow

    try {
      const work = vi.fn()
      scheduleIdleWork(work, 5000)
      expect(setTimeoutFn).toHaveBeenCalledTimes(1)
      // Math.min(1200, 5000) = 1200
      expect(setTimeoutFn.mock.calls[0]?.[1]).toBe(1200)
      expect(work).toHaveBeenCalledTimes(1)
    } finally {
      delete (globalThis as any).window
    }
  })

  it('timeoutMs < 1200 usa o valor passado', () => {
    const setTimeoutFn = vi.fn()
    const fakeWindow: any = {
      setTimeout: setTimeoutFn
    }
    ;(globalThis as any).window = fakeWindow

    try {
      scheduleIdleWork(() => {}, 800)
      expect(setTimeoutFn.mock.calls[0]?.[1]).toBe(800)
    } finally {
      delete (globalThis as any).window
    }
  })

  it('default timeoutMs e 2200', () => {
    const ricFn = vi.fn()
    ;(globalThis as any).window = { requestIdleCallback: ricFn }
    try {
      scheduleIdleWork(() => {})
      expect(ricFn.mock.calls[0]?.[1]).toEqual({ timeout: 2200 })
    } finally {
      delete (globalThis as any).window
    }
  })

  it('rIC nao-funcao: pula para setTimeout', () => {
    const setTimeoutFn = vi.fn()
    ;(globalThis as any).window = {
      requestIdleCallback: 'not-a-function',
      setTimeout: setTimeoutFn
    }
    try {
      scheduleIdleWork(() => {})
      expect(setTimeoutFn).toHaveBeenCalledTimes(1)
    } finally {
      delete (globalThis as any).window
    }
  })
})

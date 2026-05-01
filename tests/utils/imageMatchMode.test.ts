import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PASTE_IMAGE_MATCH_MODE,
  resolveImageMatchMode
} from '~/utils/imageMatchMode'

describe('DEFAULT_PASTE_IMAGE_MATCH_MODE', () => {
  it('default e "precise" (conservador)', () => {
    expect(DEFAULT_PASTE_IMAGE_MATCH_MODE).toBe('precise')
  })
})

describe('resolveImageMatchMode', () => {
  it('"fast" → "fast"', () => {
    expect(resolveImageMatchMode('fast')).toBe('fast')
  })

  it('"precise" → "precise"', () => {
    expect(resolveImageMatchMode('precise')).toBe('precise')
  })

  it('case-insensitive: FAST/Fast/fAsT → "fast"', () => {
    expect(resolveImageMatchMode('FAST')).toBe('fast')
    expect(resolveImageMatchMode('Fast')).toBe('fast')
    expect(resolveImageMatchMode('fAsT')).toBe('fast')
  })

  it('vazio/null/undefined → "precise" (default)', () => {
    expect(resolveImageMatchMode(undefined)).toBe('precise')
    expect(resolveImageMatchMode('')).toBe('precise')
    expect(resolveImageMatchMode(null as any)).toBe('precise')
  })

  it('valores invalidos caem em "precise"', () => {
    expect(resolveImageMatchMode('xyz')).toBe('precise')
    expect(resolveImageMatchMode('quick')).toBe('precise')
    expect(resolveImageMatchMode('PRECISE')).toBe('precise')
  })

  it('whitespace nao e' + ' fast (apenas comparacao exata depois de lowercase)', () => {
    expect(resolveImageMatchMode(' fast ')).toBe('precise')
  })
})

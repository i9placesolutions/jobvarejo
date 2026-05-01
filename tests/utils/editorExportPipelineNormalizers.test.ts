import { describe, it, expect } from 'vitest'
import {
  normalizeExportImageFormat,
  normalizeExportQualityPreset
} from '~/utils/editorExportPipeline'

describe('normalizeExportImageFormat', () => {
  it('jpg → jpg', () => {
    expect(normalizeExportImageFormat('jpg')).toBe('jpg')
  })

  it('jpeg → jpg (sinonimo)', () => {
    expect(normalizeExportImageFormat('jpeg')).toBe('jpg')
  })

  it('png → png', () => {
    expect(normalizeExportImageFormat('png')).toBe('png')
  })

  it('valores desconhecidos caem em png', () => {
    expect(normalizeExportImageFormat('webp')).toBe('png')
    expect(normalizeExportImageFormat('gif')).toBe('png')
    expect(normalizeExportImageFormat('')).toBe('png')
  })

  it('null/undefined caem em png', () => {
    expect(normalizeExportImageFormat(null as any)).toBe('png')
    expect(normalizeExportImageFormat(undefined as any)).toBe('png')
  })

  it('case-sensitive: JPG nao e reconhecido (cai em png)', () => {
    // Comportamento atual: comparacao usa String() === literal exato
    expect(normalizeExportImageFormat('JPG')).toBe('png')
    expect(normalizeExportImageFormat('JPEG')).toBe('png')
  })
})

describe('normalizeExportQualityPreset', () => {
  it('print-300 → print-300', () => {
    expect(normalizeExportQualityPreset('print-300')).toBe('print-300')
  })

  it('ultra-600 → ultra-600 (default)', () => {
    expect(normalizeExportQualityPreset('ultra-600')).toBe('ultra-600')
  })

  it('valores desconhecidos caem em ultra-600 (default high-quality)', () => {
    expect(normalizeExportQualityPreset('low')).toBe('ultra-600')
    expect(normalizeExportQualityPreset('')).toBe('ultra-600')
    expect(normalizeExportQualityPreset('print')).toBe('ultra-600')
  })

  it('null/undefined caem em ultra-600', () => {
    expect(normalizeExportQualityPreset(null as any)).toBe('ultra-600')
    expect(normalizeExportQualityPreset(undefined as any)).toBe('ultra-600')
  })
})

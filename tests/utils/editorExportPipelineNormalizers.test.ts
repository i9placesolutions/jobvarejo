import { describe, it, expect } from 'vitest'
import {
  normalizeExportImageFormat,
  normalizeExportQualityPreset,
  HIGH_RES_EXPORT_SCALE,
  HIGH_RES_EXPORT_QUALITY,
  EXPORT_COLOR_SATURATION,
  EXPORT_COLOR_CONTRAST,
  EXPORT_COLOR_BRIGHTNESS,
  DEFAULT_EXPORT_QUALITY_PRESET,
  DEFAULT_MULTI_FILE_MODE
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

describe('export constantes', () => {
  it('HIGH_RES_EXPORT_SCALE = 6 (suficiente para 300dpi)', () => {
    expect(HIGH_RES_EXPORT_SCALE).toBe(6)
  })

  it('HIGH_RES_EXPORT_QUALITY = 1 (max para JPG)', () => {
    expect(HIGH_RES_EXPORT_QUALITY).toBe(1)
  })

  it('EXPORT_COLOR_SATURATION e maior que 1 (boost de cor)', () => {
    expect(EXPORT_COLOR_SATURATION).toBe(1.12)
    expect(EXPORT_COLOR_SATURATION).toBeGreaterThan(1)
  })

  it('EXPORT_COLOR_CONTRAST e maior que 1', () => {
    expect(EXPORT_COLOR_CONTRAST).toBe(1.08)
    expect(EXPORT_COLOR_CONTRAST).toBeGreaterThan(1)
  })

  it('EXPORT_COLOR_BRIGHTNESS e levemente maior que 1', () => {
    expect(EXPORT_COLOR_BRIGHTNESS).toBe(1.02)
    expect(EXPORT_COLOR_BRIGHTNESS).toBeGreaterThan(1)
  })

  it('DEFAULT_EXPORT_QUALITY_PRESET = ultra-600', () => {
    expect(DEFAULT_EXPORT_QUALITY_PRESET).toBe('ultra-600')
  })

  it('DEFAULT_MULTI_FILE_MODE = zip', () => {
    expect(DEFAULT_MULTI_FILE_MODE).toBe('zip')
  })
})

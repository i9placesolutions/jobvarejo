import { describe, it, expect } from 'vitest'
import { parseViewSettings, serializeViewSettings, VIEW_SETTINGS_STORAGE_KEY } from '~/utils/viewSettings'
import type { ViewSettings } from '~/utils/viewSettings'

describe('VIEW_SETTINGS_STORAGE_KEY', () => {
  it('e versionada (:v1) e prefixada (editor:)', () => {
    expect(VIEW_SETTINGS_STORAGE_KEY).toBe('editor:viewSettings:v1')
    expect(VIEW_SETTINGS_STORAGE_KEY).toMatch(/^editor:/)
    expect(VIEW_SETTINGS_STORAGE_KEY).toMatch(/:v\d+$/)
  })
})

const fullSettings: ViewSettings = {
  viewShowGrid: true,
  viewShowRulers: false,
  viewShowGuides: true,
  snapToObjects: true,
  snapToGuides: false,
  snapToGrid: true,
  gridSize: 20
}

describe('parseViewSettings', () => {
  it('null/undefined/vazio retornam {}', () => {
    expect(parseViewSettings(null)).toEqual({})
    expect(parseViewSettings(undefined)).toEqual({})
    expect(parseViewSettings('')).toEqual({})
  })

  it('JSON invalido: {} (silencia falha)', () => {
    expect(parseViewSettings('not-json')).toEqual({})
    expect(parseViewSettings('{invalid')).toEqual({})
  })

  it('parse completo', () => {
    expect(parseViewSettings(JSON.stringify(fullSettings))).toEqual(fullSettings)
  })

  it('parcial: somente campos validos sao incluidos', () => {
    expect(parseViewSettings(JSON.stringify({
      viewShowGrid: true,
      gridSize: 30
    }))).toEqual({ viewShowGrid: true, gridSize: 30 })
  })

  it('REGRESSAO: boolean campos rejeitam numero/string', () => {
    expect(parseViewSettings(JSON.stringify({
      viewShowGrid: 1,           // number, nao boolean
      viewShowRulers: 'true',    // string, nao boolean
      snapToGrid: false           // valido
    }))).toEqual({ snapToGrid: false })
  })

  it('gridSize: NaN/0/negativo descartado', () => {
    expect(parseViewSettings(JSON.stringify({ gridSize: NaN }))).toEqual({})
    expect(parseViewSettings(JSON.stringify({ gridSize: 0 }))).toEqual({})
    expect(parseViewSettings(JSON.stringify({ gridSize: -10 }))).toEqual({})
  })

  it('gridSize: arredondado', () => {
    expect(parseViewSettings(JSON.stringify({ gridSize: 19.7 }))).toEqual({ gridSize: 20 })
  })

  it('JSON com campos extras ignora silenciosamente', () => {
    expect(parseViewSettings(JSON.stringify({
      viewShowGrid: true,
      campoNaoEsperado: 'foo'
    }))).toEqual({ viewShowGrid: true })
  })
})

describe('serializeViewSettings', () => {
  it('serializa em ordem estavel', () => {
    const json = serializeViewSettings(fullSettings)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(fullSettings)
  })

  it('roundtrip parse(serialize) = original', () => {
    const json = serializeViewSettings(fullSettings)
    expect(parseViewSettings(json)).toEqual(fullSettings)
  })

  it('mesma entrada gera mesma saida (estabilidade)', () => {
    expect(serializeViewSettings(fullSettings)).toBe(serializeViewSettings(fullSettings))
  })
})

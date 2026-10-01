import { describe, expect, it } from 'vitest'
import { Textbox } from 'fabric/node'
import { normalizeFabricTextStylesForSerialization } from '../../utils/fabricTextStyleSerialization'

describe('normalizeFabricTextStylesForSerialization', () => {
  it('removes style records with only undefined values from nested text objects', () => {
    const text = {
      styles: {
        0: {
          0: { fill: undefined, fontSize: undefined },
          1: { fill: '#f00', fontSize: undefined }
        },
        1: { 0: { stroke: undefined } }
      }
    }
    const group = { getObjects: () => [text] }

    normalizeFabricTextStylesForSerialization([group])

    expect(text.styles).toEqual({ 0: { 1: { fill: '#f00' } } })
  })

  it('prevents Fabric Textbox.toObject from crashing on an undefined-only character style', () => {
    const textbox = new Textbox('abc')
    textbox.styles = { 0: { 0: { fill: undefined } } }

    expect(() => textbox.toObject()).toThrow(TypeError)

    normalizeFabricTextStylesForSerialization([textbox])

    expect(() => textbox.toObject()).not.toThrow()
    expect(textbox.styles).toEqual({})
  })

  it('preserves Fabric style extras that its range comparator ignores', () => {
    const textbox = new Textbox('abc')
    textbox.styles = { 0: { 0: { charSpacing: 0, opacity: 0 } } } as any

    expect(() => textbox.toObject()).toThrow(TypeError)

    normalizeFabricTextStylesForSerialization([textbox])

    const serialized = textbox.toObject() as any
    expect(serialized.styles).toEqual([
      { start: 0, end: 1, style: { charSpacing: 0, opacity: 0, deltaY: 0 } }
    ])
    expect(textbox.styles[0]?.[0]).toEqual({ charSpacing: 0, opacity: 0, deltaY: 0 })
  })

  it('removes pre-existing empty character style records as inert data', () => {
    const text = { styles: { 0: { 0: {} } } }

    normalizeFabricTextStylesForSerialization([text])

    expect(text.styles).toEqual({})
  })

  it('preserves defined falsy and null style values', () => {
    const text = { styles: { 0: { 0: { fill: null, underline: false, fontSize: 0 } } } }

    normalizeFabricTextStylesForSerialization([text])

    expect(text.styles).toEqual({ 0: { 0: { fill: null, underline: false, fontSize: 0 } } })
  })

  it('does not change an already valid style map on repeated calls', () => {
    const text = { styles: { 0: { 0: { fill: '#000' } } } }

    normalizeFabricTextStylesForSerialization([text])
    const normalized = structuredClone(text.styles)
    normalizeFabricTextStylesForSerialization([text])

    expect(text.styles).toEqual(normalized)
  })
})

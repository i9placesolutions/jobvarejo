import { describe, it, expect } from 'vitest'
import {
  isTrackableImageSrc,
  collectTrackableImageSrcCounts
} from '~/utils/canvasImageTracking'

describe('isTrackableImageSrc', () => {
  it('vazio/null/undefined → false', () => {
    expect(isTrackableImageSrc(null)).toBe(false)
    expect(isTrackableImageSrc(undefined)).toBe(false)
    expect(isTrackableImageSrc('')).toBe(false)
    expect(isTrackableImageSrc('   ')).toBe(false)
  })

  it('data URL → false', () => {
    expect(isTrackableImageSrc('data:image/png;base64,abc')).toBe(false)
    expect(isTrackableImageSrc('data:image/svg+xml,...')).toBe(false)
  })

  it('blob URL → false', () => {
    expect(isTrackableImageSrc('blob:http://localhost/abc-123')).toBe(false)
  })

  it('https remote URL → true', () => {
    expect(isTrackableImageSrc('https://example.com/foo.png')).toBe(true)
  })

  it('http remote URL → true', () => {
    expect(isTrackableImageSrc('http://example.com/foo.png')).toBe(true)
  })

  it('relative URL → true', () => {
    expect(isTrackableImageSrc('/api/storage/p?key=foo')).toBe(true)
  })

  it('trim aplicado', () => {
    expect(isTrackableImageSrc('  https://example.com/x.png  ')).toBe(true)
    expect(isTrackableImageSrc('  data:abc  ')).toBe(false)
  })
})

describe('collectTrackableImageSrcCounts', () => {
  it('canvasData null/undefined: Map vazio', () => {
    expect(collectTrackableImageSrcCounts(null).size).toBe(0)
    expect(collectTrackableImageSrcCounts(undefined).size).toBe(0)
  })

  it('canvasData sem objects: Map vazio', () => {
    expect(collectTrackableImageSrcCounts({}).size).toBe(0)
    expect(collectTrackableImageSrcCounts({ version: '5.3.0' }).size).toBe(0)
  })

  it('1 imagem trackable: count=1', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [{ type: 'image', src: 'https://example.com/a.png' }]
    })
    expect(r.get('https://example.com/a.png')).toBe(1)
    expect(r.size).toBe(1)
  })

  it('mesma URL N vezes: count=N', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [
        { type: 'image', src: 'https://example.com/a.png' },
        { type: 'image', src: 'https://example.com/a.png' },
        { type: 'image', src: 'https://example.com/a.png' }
      ]
    })
    expect(r.get('https://example.com/a.png')).toBe(3)
  })

  it('data: e blob: URLs ignoradas', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [
        { type: 'image', src: 'data:image/png;base64,abc' },
        { type: 'image', src: 'blob:abc' },
        { type: 'image', src: 'https://example.com/ok.png' }
      ]
    })
    expect(r.size).toBe(1)
    expect(r.get('https://example.com/ok.png')).toBe(1)
  })

  it('le __originalSrc quando src ausente', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [{ type: 'image', __originalSrc: 'https://example.com/orig.png' }]
    })
    expect(r.get('https://example.com/orig.png')).toBe(1)
  })

  it('non-image nodes ignorados', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [
        { type: 'rect' },
        { type: 'text', src: 'https://example.com/x.png' }, // type wrong
        { type: 'image', src: 'https://example.com/ok.png' }
      ]
    })
    expect(r.size).toBe(1)
  })

  it('desce em groups aninhados (objects)', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [
        {
          type: 'group',
          objects: [
            { type: 'image', src: 'https://a.com/1.png' },
            {
              type: 'group',
              objects: [{ type: 'image', src: 'https://a.com/2.png' }]
            }
          ]
        }
      ]
    })
    expect(r.size).toBe(2)
  })

  it('desce em clipPath', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [{
        type: 'group',
        clipPath: {
          type: 'image',
          src: 'https://a.com/clip.png'
        }
      }]
    })
    expect(r.get('https://a.com/clip.png')).toBe(1)
  })

  it('referencias circulares nao causam loop infinito', () => {
    const obj: any = { type: 'image', src: 'https://a.com/x.png' }
    obj.self = obj
    expect(() => collectTrackableImageSrcCounts({ objects: [obj] })).not.toThrow()
  })

  it('case-insensitive em type=Image', () => {
    const r = collectTrackableImageSrcCounts({
      objects: [{ type: 'IMAGE', src: 'https://example.com/x.png' }]
    })
    expect(r.size).toBe(1)
  })
})

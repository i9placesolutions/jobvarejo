import { describe, expect, it } from 'vitest'
import { Group, Rect, Shadow } from 'fabric'
import { installGroupClipCacheGuard } from '../../utils/fabricGroupClipCache'

describe('cache isolado de grupos recortados', () => {
  it('mantém o recorte isolado mesmo quando um filho desenha sombra', () => {
    const group = new Group([
      new Rect({ width: 80, height: 40, shadow: new Shadow({ offsetX: 3, offsetY: 3 }) })
    ], { clipPath: new Rect({ width: 80, height: 40 }), objectCaching: false })
    installGroupClipCacheGuard(Group)
    expect(group.shouldCache()).toBe(true)
    expect(group.ownCaching).toBe(true)
    group.set('clipPath', undefined)
    expect(group.shouldCache()).toBe(false)
  })

  it('é idempotente e preserva grupos sem máscara', () => {
    installGroupClipCacheGuard(Group)
    const patched = Group.prototype.shouldCache
    installGroupClipCacheGuard(Group)
    expect(Group.prototype.shouldCache).toBe(patched)
    expect(new Group([], { objectCaching: false }).shouldCache()).toBe(false)
  })
})

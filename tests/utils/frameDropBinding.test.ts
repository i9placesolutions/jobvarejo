import { describe, expect, it } from 'vitest'
import { resolveFrameParentAfterDrop } from '~/utils/frameDropBinding'

describe('resolveFrameParentAfterDrop', () => {
  it('mantém o Frame atual quando o objeto é arrastado para fora dele', () => {
    expect(resolveFrameParentAfterDrop('frame-a', true, null)).toBe('frame-a')
  })

  it('transfere o vínculo quando o objeto é solto dentro de outro Frame', () => {
    expect(resolveFrameParentAfterDrop('frame-a', true, 'frame-b')).toBe('frame-b')
  })

  it('vincula um objeto sem Frame ao Frame sob o drop', () => {
    expect(resolveFrameParentAfterDrop(undefined, false, 'frame-b')).toBe('frame-b')
  })

  it('descarta somente um vínculo que já não aponta para um Frame existente', () => {
    expect(resolveFrameParentAfterDrop('frame-removido', false, null)).toBeUndefined()
  })
})

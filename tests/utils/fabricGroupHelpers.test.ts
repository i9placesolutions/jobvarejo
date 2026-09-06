import { describe, expect, it } from 'vitest'
import {
  disableFabricGroupAutoLayout,
  refreshFabricGroupBounds
} from '~/utils/fabricGroupHelpers'

describe('fabricGroupHelpers', () => {
  it('desativa o layout automatico sem perder o metodo original', () => {
    const calls: any[] = []
    const originalPerformLayout = function (this: any, context: any) {
      calls.push({ context, receiver: this })
    }
    const layoutManager: any = { performLayout: originalPerformLayout }
    const group: any = {
      layoutManager,
      set(props: any) { Object.assign(this, props) }
    }

    disableFabricGroupAutoLayout(group)

    expect(layoutManager.performLayout).not.toBe(originalPerformLayout)
    expect(layoutManager.__jobvarejoOriginalPerformLayout).toBe(originalPerformLayout)
    expect(group.objectCaching).toBe(false)
    expect(group.statefullCache).toBe(false)
  })

  it('recalcula bounds usando o layout original mesmo quando ele esta bloqueado', () => {
    const calls: any[] = []
    const originalPerformLayout = function (this: any, context: any) {
      calls.push({ context, receiver: this })
    }
    const layoutManager: any = { performLayout: originalPerformLayout }
    const group: any = {
      layoutManager,
      setCoordsCalls: 0,
      set(props: any) { Object.assign(this, props) },
      setCoords() { this.setCoordsCalls += 1 }
    }

    disableFabricGroupAutoLayout(group)
    expect(refreshFabricGroupBounds(group)).toBe(true)

    expect(calls).toHaveLength(1)
    expect(calls[0].receiver).toBe(layoutManager)
    expect(calls[0].context).toMatchObject({
      type: 'imperative',
      target: group,
      bubbles: false
    })
    expect(group.setCoordsCalls).toBe(1)
    expect(group.dirty).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { Rect } from 'fabric'
import { CANVAS_CUSTOM_PROPS } from '../../utils/canvasCustomProps'
import { rememberQuickDefaultColor, resolveQuickDefaultColor, setQuickTextPaint } from '../../utils/quickModeColorDefaults'
import { collectQuickEditableColorTargets } from '../../utils/quickModeNativeTools'

describe('restaurar cor no modo rápido', () => {
  it('restaura a pintura original após cor manual, transparência e reload', async () => {
    const rect = new Rect({ fill: '#facc15' })
    rememberQuickDefaultColor(rect, 'fill')
    rect.set('fill', '#ff0000')
    rememberQuickDefaultColor(rect, 'fill')
    rect.set('fill', 'transparent')
    const saved = JSON.parse(JSON.stringify((rect as any).toObject([...CANVAS_CUSTOM_PROPS])))
    const restored = await Rect.fromObject(saved)
    expect(resolveQuickDefaultColor(restored, 'fill')).toBe('#facc15')
    expect(collectQuickEditableColorTargets([restored])[0]?.objects[0]?.property).toBe('fill')
    restored.set('fill', resolveQuickDefaultColor(restored, 'fill'))
    restored.set('fill', 'transparent')
    expect(resolveQuickDefaultColor(restored, 'fill')).toBe('#facc15')
  })
  it('um texto já transparente volta a ter uma cor visível', () => {
    const text = { type: 'textbox', fill: 'transparent', styles: { 0: { 0: { fill: 'transparent', fontWeight: 900 } } }, set(key: string, value: string) { (this as any)[key] = value } }
    setQuickTextPaint(text, resolveQuickDefaultColor(text, 'fill'))
    expect(text.fill).toBe('#172033')
    expect(text.styles[0][0]).toEqual({ fontWeight: 900 })
  })
})

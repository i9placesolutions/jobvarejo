import { expect, it } from 'vitest'
import { fitResponsiveProductName } from '../../utils/productCardResponsiveTypography'
import { CANVAS_CUSTOM_PROPS } from '../../utils/canvasCustomProps'
import { readFileSync } from 'node:fs'
it('preserva o tamanho manual e a marca de edição ao salvar e recarregar', async () => {
 const title = { fontSize:31,__manualTypography:true,visible:true,set(){throw new Error('Fonte manual alterada pelo layout')} }
 fitResponsiveProductName(title,100,150)
 expect(title.fontSize).toBe(31)
 expect(CANVAS_CUSTOM_PROPS).toContain('__manualTypography')
 const source=readFileSync('components/EditorCanvas.vue','utf8');
 expect(source).toContain("if (!(title as any).__manualTypography) title.set('fontSize', nextFont)");
 expect(source).toContain("await persistQuickModeDataChange('quick-font-size')");

})

import { describe, expect, it } from 'vitest'
import { doesProjectPatchChangeContent } from '~/utils/projectEditedAt'

describe('doesProjectPatchChangeContent', () => {
  it('considera canvas, prévia, nome e configuração como edição do encarte', () => {
    expect(doesProjectPatchChangeContent({ canvas_data: [] })).toBe(true)
    expect(doesProjectPatchChangeContent({ preview_url: 'projects/a/preview.png' })).toBe(true)
    expect(doesProjectPatchChangeContent({ name: 'Ofertas de sábado' })).toBe(true)
    expect(doesProjectPatchChangeContent({ template_config: { quickValidity: {} } })).toBe(true)
    expect(doesProjectPatchChangeContent({ template_category: 'Hortifruti' })).toBe(true)
    expect(doesProjectPatchChangeContent({ template_subcategory: 'Quinta verde' })).toBe(true)
  })

  it('não altera a data de edição ao apenas abrir ou organizar o encarte', () => {
    expect(doesProjectPatchChangeContent({ last_viewed: new Date().toISOString() })).toBe(false)
    expect(doesProjectPatchChangeContent({ is_starred: true })).toBe(false)
    expect(doesProjectPatchChangeContent({ folder_id: 'folder-id' })).toBe(false)
  })
})

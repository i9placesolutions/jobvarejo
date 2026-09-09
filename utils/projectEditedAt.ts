const CONTENT_EDIT_PATCH_FIELDS = [
  'name',
  'preview_url',
  'canvas_data',
  'template_config',
  'is_template'
] as const

/**
 * `updated_at` representa a última edição do encarte, não uma simples
 * abertura, favorito ou mudança de pasta. Esse contrato é usado tanto pela
 * lista de encartes quanto pela ordenação da API.
 */
export const doesProjectPatchChangeContent = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') return false
  return CONTENT_EDIT_PATCH_FIELDS.some(field =>
    Object.prototype.hasOwnProperty.call(payload, field)
  )
}

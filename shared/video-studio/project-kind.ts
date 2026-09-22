// Compatibilidade com os modelos publicados antes da biblioteca separada.
export const VIDEO_MODEL_TITLE_PATTERN='— (Modelo de demonstração|Demonstração ilustrativa|Modelo profissional)\\s*$'
export function isVideoModel(project: {title?: string; isTemplate?: boolean}) {
  return project.isTemplate === true || new RegExp(VIDEO_MODEL_TITLE_PATTERN,'iu').test(project.title || '')
}

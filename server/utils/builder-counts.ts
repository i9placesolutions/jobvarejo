// As listagens administrativas incluem também registros inativos.
export const BUILDER_COUNT_TABLES = {
  themes: 'builder_themes',
  models: 'builder_models',
  layouts: 'builder_layouts',
  priceTagStyles: 'builder_price_tag_styles',
  badgeStyles: 'builder_badge_styles',
  fontConfigs: 'builder_font_configs',
  tenants: 'builder_tenants',
  cardTemplates: 'builder_card_templates',
  headerTemplates: 'builder_header_templates',
  footerTemplates: 'builder_footer_templates',
  segments: 'builder_segments',
  radioVoices: 'radio_voice_profiles',
} as const

export type BuilderCounts = Record<keyof typeof BUILDER_COUNT_TABLES, number | null>

export const buildBuilderCountsQuery = (availableTables: ReadonlySet<string>) => {
  // Identificadores vêm apenas desta lista fixa, nunca de parâmetros da requisição.
  const columns = Object.entries(BUILDER_COUNT_TABLES).map(([key, table]) => {
    const expression = availableTables.has(table)
      ? `(select count(*)::int from public.${table}${key === 'radioVoices' ? ' where user_id = $1::uuid' : ''})`
      // A API de vozes já retorna uma lista vazia se o módulo não foi instalado.
      : key === 'radioVoices' ? '0::int' : 'null::int'
    return `${expression} as "${key}"`
  })
  return `select ${columns.join(',\n')} where $1::uuid is not null`
}

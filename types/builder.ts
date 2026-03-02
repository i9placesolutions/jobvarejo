export type BuilderTokenStatus = 'active' | 'revoked' | 'expired'

export type BuilderAllowedField =
  | 'name'
  | 'brand'
  | 'priceUnit'
  | 'pricePack'
  | 'priceSpecialUnit'
  | 'priceSpecial'
  | 'specialCondition'
  | 'imageUrl'
  | 'packageLabel'
  | 'packQuantity'
  | 'packUnit'

export interface BuilderOptionItem {
  id: string
  name: string
}

export interface BuilderTemplateConfig {
  id: string
  name: string
  pageId: string
  zoneId: string
  labelTemplateIds: string[]
  themeIds: string[]
}

export interface BuilderConfig {
  enabled: boolean
  templates: BuilderTemplateConfig[]
  allowedFields: BuilderAllowedField[]
  maxProductsPerSubmit: number
  multiTemplateMode: boolean
}

export interface BuilderTemplateOption {
  id: string
  name: string
  pageId: string
  zoneId: string
  labelTemplateOptions: BuilderOptionItem[]
  themeOptions: BuilderOptionItem[]
}

export interface BuilderSession {
  tokenId: string
  projectId: string
  projectName: string
  expiresAt: string | null
  maxSubmissions: number | null
  submissionsCount: number
  templates: BuilderTemplateOption[]
  allowedFields: BuilderAllowedField[]
  maxProductsPerSubmit: number
}

export interface BuilderProductInput {
  id?: string
  name?: string | null
  brand?: string | null
  priceUnit?: string | null
  pricePack?: string | null
  priceSpecialUnit?: string | null
  priceSpecial?: string | null
  specialCondition?: string | null
  imageUrl?: string | null
  packageLabel?: string | null
  packQuantity?: number | null
  packUnit?: string | null
}

export interface BuilderSubmissionPayload {
  templateId: string
  products: BuilderProductInput[]
  themeId?: string | null
  labelTemplateId?: string | null
}

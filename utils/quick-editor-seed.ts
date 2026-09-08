import type { OfferValidityMode, OfferValidityScope } from './offerValidity'
import type { FlyerTemplatePresetId } from './mesDoConsumidorPreset'

export const QUICK_EDITOR_SEED_VERSION = 1
export const QUICK_EDITOR_SEED_PREFIX = 'jobvarejo:quick-seed:'

export type QuickEditorTheme = {
  id: string
  name: string
  backgroundColor: string
  cardColor: string
  textColor: string
  accentColor: string
  priceColor: string
  mutedColor: string
}

export type QuickEditorModel = {
  id: string
  name: string
}

export type QuickEditorSeed = {
  version: number
  id: string
  title: string
  startDate: string | null
  endDate: string | null
  /** Tipo de período escolhido para a validade da oferta. */
  validityMode?: OfferValidityMode
  /** Quando true, a validade também fica limitada ao estoque disponível. */
  validityWhileStocks?: boolean
  /** Abrangência comercial da oferta (todas, cidade ou loja específica). */
  offerScope?: OfferValidityScope
  formatId: string
  /** Formatos que devem receber a mesma composição inicial do modelo. */
  formatIds?: string[]
  /** Variações de layout que compartilham o mesmo tema. */
  models?: QuickEditorModel[]
  /** Receita visual nativa usada para materializar um modelo de encarte. */
  templatePresetId?: FlyerTemplatePresetId
  width: number
  height: number
  theme: QuickEditorTheme
  products: any[]
  businessProfile: Record<string, any>
  createdAt: string
}

export const getQuickEditorSeedKey = (projectId: string): string =>
  `${QUICK_EDITOR_SEED_PREFIX}${String(projectId || '').trim()}`

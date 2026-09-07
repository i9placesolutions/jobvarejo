import { computed, type Ref } from 'vue'
import type { ProductZoneStructure, ProductZoneStructureVariant } from '~/types/product-zone'

type QuickModeZoneStructure = {
  structure: ProductZoneStructure | null
  variants: ProductZoneStructureVariant[]
  selectedVariantId: string
}

type QuickEditorControlOptions = {
  productZoneUiVersion: Ref<number>
  getRuntimeProductZones: () => any[]
  getZoneChildren: (zone: any) => any[]
  /** Read-only lookup for values consumed by the sidebar render. */
  getZoneCardsForUi?: (zone: any) => any[]
  /** Read-only lookup for the recipe applied to the current product count. */
  getZoneStructureForUi?: (zone: any, productCount: number) => QuickModeZoneStructure
  getProductZoneId: (zone: any) => string
  resolveImportTargetZone: () => any | null
  setActiveProductZone: (zone: any, opts?: { syncImportTarget?: boolean }) => void
  canvas: Ref<any>
  isProcessing: Ref<boolean>
  isParsingProducts: Ref<boolean>
  addGridZone: () => Promise<any>
  openProductReviewForZone: (zone: any, opts?: { mode?: 'replace' | 'append' }) => boolean
  notifyEditorError: (message: string) => void
  refreshCanvasObjects: () => void
  refreshQuickModeUi?: () => void
}

export const useQuickEditorControls = (options: QuickEditorControlOptions) => {
  const quickModeZones = computed(() => {
    void options.productZoneUiVersion.value
    return options.getRuntimeProductZones().map((zone: any, index: number) => {
      // `getZoneChildren` also normalizes Fabric runtime flags and starts
      // image work. The sidebar is rendered while the canvas is hydrating, so
      // use the read-only lookup there to avoid mutating reactive Fabric
      // objects from inside a computed value.
      const count = (options.getZoneCardsForUi || options.getZoneChildren)(zone).length
      const structure = options.getZoneStructureForUi?.(zone, count)
      return {
        id: options.getProductZoneId(zone) || `quick-zone-${index + 1}`,
        name: String(zone?.zoneName || zone?.name || `Zona ${index + 1}`).trim(),
        count,
        structure: structure?.structure || null,
        structureVariants: structure?.variants || [],
        selectedStructureVariantId: structure?.selectedVariantId || '',
        zone
      }
    })
  })

  const quickModeTargetZoneId = computed(() => {
    const resolvedId = options.getProductZoneId(options.resolveImportTargetZone())
    return resolvedId || quickModeZones.value[0]?.id || ''
  })

  const quickModeTargetZone = computed(() => {
    const targetId = quickModeTargetZoneId.value
    return quickModeZones.value.find(item => item.id === targetId)?.zone || quickModeZones.value[0]?.zone || null
  })

  const selectQuickModeZone = (zoneId: string) => {
    const selected = quickModeZones.value.find(item => item.id === String(zoneId || '').trim())?.zone
    if (!selected) return
    options.setActiveProductZone(selected, { syncImportTarget: true })
    options.refreshCanvasObjects()
    options.refreshQuickModeUi?.()
  }

  const openQuickProductImport = async (mode: 'replace' | 'append' = 'replace') => {
    if (!options.canvas.value || options.isProcessing.value || options.isParsingProducts.value) return

    let zone = quickModeTargetZone.value
    if (!zone) {
      await options.addGridZone()
      zone = options.getRuntimeProductZones()[0] || null
    }
    if (!zone) {
      options.notifyEditorError('Não foi possível preparar uma Zona de Produtos para a lista.')
      return
    }

    options.setActiveProductZone(zone, { syncImportTarget: true })
    options.openProductReviewForZone(zone, { mode })
  }

  return {
    quickModeZones,
    quickModeTargetZoneId,
    quickModeTargetZone,
    selectQuickModeZone,
    openQuickProductImport
  }
}

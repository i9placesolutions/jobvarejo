import type {
  BuilderFlyer,
  BuilderFlyerProduct,
  BuilderTheme,
  BuilderModel,
  BuilderLayout,
  BuilderThemeCssConfig,
} from '~/types/builder'

interface BuilderFlyerState {
  flyer: BuilderFlyer | null
  products: BuilderFlyerProduct[]
  theme: BuilderTheme | null
  model: BuilderModel | null
  layout: BuilderLayout | null
  themes: BuilderTheme[]
  models: BuilderModel[]
  layouts: BuilderLayout[]
  isDirty: boolean
  isSaving: boolean
  isLoading: boolean
  zoom: number
  currentPage: number
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export const useBuilderFlyer = () => {
  const state = useState<BuilderFlyerState>('builder-flyer', () => ({
    flyer: null,
    products: [],
    theme: null,
    model: null,
    layout: null,
    themes: [],
    models: [],
    layouts: [],
    isDirty: false,
    isSaving: false,
    isLoading: false,
    zoom: 1,
    currentPage: 1,
  }))

  // ── Computed ────────────────────────────────────────────────────────────

  const flyer = computed(() => state.value.flyer)
  const products = computed(() => state.value.products)
  const theme = computed(() => state.value.theme)
  const model = computed(() => state.value.model)
  const layout = computed(() => state.value.layout)
  const themes = computed(() => state.value.themes)
  const models = computed(() => state.value.models)
  const layouts = computed(() => state.value.layouts)
  const isDirty = computed(() => state.value.isDirty)
  const isSaving = computed(() => state.value.isSaving)
  const isLoading = computed(() => state.value.isLoading)
  const zoom = computed(() => state.value.zoom)
  const currentPage = computed(() => state.value.currentPage)

  const productsPerPage = computed(() => state.value.layout?.products_per_page ?? 6)

  const totalPages = computed(() => {
    if (!state.value.products.length) return 1
    return Math.max(1, Math.ceil(state.value.products.length / productsPerPage.value))
  })

  const paginatedProducts = computed(() => {
    const perPage = productsPerPage.value
    const start = (state.value.currentPage - 1) * perPage
    return state.value.products.slice(start, start + perPage)
  })

  const highlightPositions = computed(() => state.value.layout?.highlight_positions ?? [])

  const cssVariables = computed(() => {
    const cfg: BuilderThemeCssConfig | undefined = state.value.theme?.css_config
    if (!cfg) return {} as Record<string, string>
    return {
      '--builder-primary': cfg.primaryColor || '',
      '--builder-secondary': cfg.secondaryColor || '',
      '--builder-bg': cfg.bgColor || '',
      '--builder-text': cfg.textColor || '',
      '--builder-border-radius': cfg.borderRadius || '',
      '--builder-header-bg': cfg.headerBg || '',
      '--builder-body-bg': cfg.bodyBg || '',
      '--builder-footer-bg': cfg.footerBg || '',
      '--builder-accent': cfg.accentColor || '',
    } as Record<string, string>
  })

  // ── Helpers ─────────────────────────────────────────────────────────────

  const scheduleAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      if (state.value.isDirty && !state.value.isSaving) {
        void saveFlyer()
      }
    }, 5000)
  }

  const markDirty = () => {
    state.value.isDirty = true
    scheduleAutosave()
  }

  // ── Data loading ────────────────────────────────────────────────────────

  const loadFlyer = async (id: string) => {
    state.value.isLoading = true
    try {
      const [flyerData, productsData] = await Promise.all([
        $fetch<BuilderFlyer>(`/api/builder/flyers/${id}`),
        $fetch<BuilderFlyerProduct[]>(`/api/builder/flyers/${id}/products`),
      ])

      state.value.flyer = flyerData
      state.value.products = (productsData || []).sort((a, b) => a.position - b.position)
      state.value.isDirty = false
      state.value.currentPage = 1

      // Resolve FKs
      if (flyerData.theme_id) {
        const found = state.value.themes.find(t => t.id === flyerData.theme_id)
        if (found) {
          state.value.theme = found
        } else {
          try {
            state.value.theme = await $fetch<BuilderTheme>(`/api/builder/themes/${flyerData.theme_id}`)
          } catch { /* ignore */ }
        }
      }
      if (flyerData.model_id) {
        const found = state.value.models.find(m => m.id === flyerData.model_id)
        if (found) {
          state.value.model = found
        } else {
          try {
            state.value.model = await $fetch<BuilderModel>(`/api/builder/models/${flyerData.model_id}`)
          } catch { /* ignore */ }
        }
      }
      if (flyerData.layout_id) {
        const found = state.value.layouts.find(l => l.id === flyerData.layout_id)
        if (found) {
          state.value.layout = found
        } else {
          try {
            state.value.layout = await $fetch<BuilderLayout>(`/api/builder/layouts/${flyerData.layout_id}`)
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('[useBuilderFlyer] loadFlyer error:', error)
      throw error
    } finally {
      state.value.isLoading = false
    }
  }

  const loadCatalog = async () => {
    try {
      const [themesData, modelsData, layoutsData] = await Promise.all([
        $fetch<BuilderTheme[]>('/api/builder/themes'),
        $fetch<BuilderModel[]>('/api/builder/models'),
        $fetch<BuilderLayout[]>('/api/builder/layouts'),
      ])
      state.value.themes = themesData || []
      state.value.models = modelsData || []
      state.value.layouts = layoutsData || []
    } catch (error) {
      console.error('[useBuilderFlyer] loadCatalog error:', error)
    }
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  const saveFlyer = async () => {
    if (!state.value.flyer || state.value.isSaving) return
    state.value.isSaving = true
    try {
      const id = state.value.flyer.id
      await Promise.all([
        $fetch(`/api/builder/flyers/${id}`, {
          method: 'PUT',
          body: state.value.flyer,
        }),
        $fetch(`/api/builder/flyers/${id}/products`, {
          method: 'PUT',
          body: { products: state.value.products },
        }),
      ])
      state.value.isDirty = false
    } catch (error) {
      console.error('[useBuilderFlyer] saveFlyer error:', error)
      throw error
    } finally {
      state.value.isSaving = false
    }
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  const updateFlyer = (fields: Partial<BuilderFlyer>) => {
    if (!state.value.flyer) return
    state.value.flyer = { ...state.value.flyer, ...fields }
    markDirty()
  }

  const setTheme = async (themeId: string) => {
    const found = state.value.themes.find(t => t.id === themeId)
    if (found) {
      state.value.theme = found
    } else {
      try {
        state.value.theme = await $fetch<BuilderTheme>(`/api/builder/themes/${themeId}`)
      } catch { /* ignore */ }
    }
    updateFlyer({ theme_id: themeId })
  }

  const setModel = async (modelId: string) => {
    const found = state.value.models.find(m => m.id === modelId)
    if (found) {
      state.value.model = found
    } else {
      try {
        state.value.model = await $fetch<BuilderModel>(`/api/builder/models/${modelId}`)
      } catch { /* ignore */ }
    }
    updateFlyer({ model_id: modelId })
  }

  const setLayout = async (layoutId: string) => {
    const found = state.value.layouts.find(l => l.id === layoutId)
    if (found) {
      state.value.layout = found
    } else {
      try {
        state.value.layout = await $fetch<BuilderLayout>(`/api/builder/layouts/${layoutId}`)
      } catch { /* ignore */ }
    }
    updateFlyer({ layout_id: layoutId })
    // Reset page to 1 when layout changes
    state.value.currentPage = 1
  }

  const addProduct = (product: Partial<BuilderFlyerProduct>) => {
    const newProduct = {
      id: crypto.randomUUID(),
      flyer_id: state.value.flyer?.id ?? '',
      product_id: null,
      position: state.value.products.length,
      custom_name: null,
      custom_image: null,
      offer_price: null,
      original_price: null,
      unit: 'UN' as const,
      observation: null,
      purchase_limit: null,
      price_mode: 'simple' as const,
      take_quantity: null,
      pay_quantity: null,
      installment_count: null,
      installment_price: null,
      no_interest: true,
      club_name: null,
      anticipation_text: null,
      show_discount: false,
      quantity_unit: null,
      is_highlight: false,
      is_adult: false,
      is_pinned: false,
      is_price_pinned: false,
      bg_opacity: 1,
      custom_lines: [],
      price_tag_style_id: null,
      badge_style_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...product,
    } as BuilderFlyerProduct
    state.value.products.push(newProduct)
    markDirty()
  }

  const updateProduct = (index: number, fields: Partial<BuilderFlyerProduct>) => {
    const existing = state.value.products[index]
    if (!existing) return
    state.value.products[index] = {
      ...existing,
      ...fields,
      updated_at: new Date().toISOString(),
    }
    markDirty()
  }

  const removeProduct = (index: number) => {
    if (index < 0 || index >= state.value.products.length) return
    state.value.products.splice(index, 1)
    // Reindex positions
    state.value.products.forEach((p, i) => { p.position = i })
    markDirty()
  }

  const reorderProducts = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 || fromIndex >= state.value.products.length ||
      toIndex < 0 || toIndex >= state.value.products.length ||
      fromIndex === toIndex
    ) return
    const removed = state.value.products.splice(fromIndex, 1)
    if (removed[0]) state.value.products.splice(toIndex, 0, removed[0])
    // Reindex positions
    state.value.products.forEach((p, i) => { p.position = i })
    markDirty()
  }

  const setZoom = (z: number) => {
    state.value.zoom = Math.max(0.25, Math.min(3, z))
  }

  const setCurrentPage = (page: number) => {
    state.value.currentPage = Math.max(1, Math.min(page, totalPages.value))
  }

  const cleanup = () => {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
  }

  return {
    // State
    flyer,
    products,
    theme,
    model,
    layout,
    themes,
    models,
    layouts,
    isDirty,
    isSaving,
    isLoading,
    zoom,
    currentPage,
    totalPages,
    paginatedProducts,
    productsPerPage,
    highlightPositions,
    cssVariables,

    // Actions
    loadFlyer,
    loadCatalog,
    saveFlyer,
    updateFlyer,
    setTheme,
    setModel,
    setLayout,
    addProduct,
    updateProduct,
    removeProduct,
    reorderProducts,
    setZoom,
    setCurrentPage,
    cleanup,
  }
}

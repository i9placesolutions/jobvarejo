import type {
  BuilderFlyer,
  BuilderFlyerProduct,
  BuilderTheme,
  BuilderModel,
  BuilderLayout,
  BuilderPriceTagStyle,
  BuilderCardTemplate,
  BuilderHeaderTemplate,
  BuilderFooterTemplate,
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
  priceTagStyles: BuilderPriceTagStyle[]
  cardTemplates: BuilderCardTemplate[]
  headerTemplates: BuilderHeaderTemplate[]
  footerTemplates: BuilderFooterTemplate[]
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
    priceTagStyles: [],
    cardTemplates: [],
    headerTemplates: [],
    footerTemplates: [],
    isDirty: false,
    isSaving: false,
    isLoading: false,
    zoom: 1,
    currentPage: 1,
  }))

  // ── Computed ────────────────────────────────────────────────────────────

  // Shared UI state for product editor panel
  const productEditorOpen = useState('builder-product-editor-open', () => false)

  const flyer = computed(() => state.value.flyer)
  const products = computed(() => state.value.products)
  const theme = computed(() => state.value.theme)
  const model = computed(() => state.value.model)
  const layout = computed(() => state.value.layout)
  const themes = computed(() => state.value.themes)
  const models = computed(() => state.value.models)
  const layouts = computed(() => state.value.layouts)
  const priceTagStyles = computed(() => state.value.priceTagStyles)
  const isDirty = computed(() => state.value.isDirty)
  const isSaving = computed(() => state.value.isSaving)
  const isLoading = computed(() => state.value.isLoading)
  const zoom = computed(() => state.value.zoom)
  const currentPage = computed(() => state.value.currentPage)

  // Custom override from flyer, otherwise layout default
  // Auto layout (columns=0 rows=0 or no layout) → all products on same page
  const productsPerPage = computed(() => {
    const custom = (state.value.flyer as any)?.custom_products_per_page
    if (custom && custom > 0) return custom
    const lo = state.value.layout
    // No layout or auto layout → show all products on one page
    if (!lo || (lo.columns === 0 && lo.rows === 0)) {
      return Math.max(state.value.products.length, 1)
    }
    return lo.products_per_page ?? 6
  })

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
    const fc = (state.value.flyer?.font_config || {}) as Record<string, any>
    return {
      // Variaveis do tema
      '--builder-primary': cfg.primaryColor || '',
      '--builder-secondary': cfg.secondaryColor || '',
      '--builder-bg': cfg.bgColor || '',
      '--builder-text': cfg.textColor || '',
      '--builder-border-radius': cfg.borderRadius || '',
      '--builder-header-bg': cfg.headerBg || '',
      '--builder-body-bg': cfg.bodyBg || '',
      '--builder-footer-bg': cfg.footerBg || '',
      '--builder-accent': cfg.accentColor || '',
      // Variaveis globais QROfertas (secao 12/25 da doc)
      '--margin-layout': `${fc.margin_layout ?? 10}px`,
      '--footer-height': `${fc.footer_height ?? 200}px`,
      '--footer-line-height': `${fc.footer_line_height ?? 100}px`,
      '--footer-font-size': `${fc.footer_font_size ?? 50}px`,
      '--footer-base-margin': `${fc.footer_base_margin ?? 15}px`,
      '--chip-height': `${fc.chip_height ?? 100}px`,
      '--observacao-fs': `${fc.observacao_fs ?? 20}px`,
      '--observacao-h': `${fc.observacao_h ?? 10}%`,
      '--mensagem-customizada-fontsize': `${fc.mensagem_fontsize ?? 75}px`,
      '--mensagem-customizada-height': `${fc.mensagem_height ?? 200}px`,
      '--bubble-font-size': `${fc.bubble_font_size ?? 35}px`,
      '--bubble-desconto-size': `${fc.bubble_desconto_size ?? 139}px`,
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
      const flyerRes = await $fetch<any>(`/api/builder/flyers/${id}`)

      const flyerData: BuilderFlyer = flyerRes?.flyer || flyerRes
      state.value.flyer = flyerData

      // Products may come bundled with the flyer response or from a separate endpoint
      let productsData: BuilderFlyerProduct[] = []
      if (Array.isArray(flyerRes?.products)) {
        productsData = flyerRes.products
      } else {
        try {
          const productsRes = await $fetch<any>(`/api/builder/flyers/${id}/products`)
          productsData = Array.isArray(productsRes) ? productsRes : productsRes?.products || []
        } catch { /* no products yet */ }
      }
      state.value.products = productsData.sort((a, b) => a.position - b.position)
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
      const [themesRes, modelsRes, layoutsRes, priceTagRes, cardTplRes, headerTplRes, footerTplRes] = await Promise.all([
        $fetch<any>('/api/builder/themes'),
        $fetch<any>('/api/builder/models'),
        $fetch<any>('/api/builder/layouts'),
        $fetch<any>('/api/builder/price-tag-styles').catch(() => ({ priceTagStyles: [] })),
        $fetch<any>('/api/builder/card-templates').catch((err) => { console.warn('[loadCatalog] card-templates falhou:', err.message); return { cardTemplates: [] } }),
        $fetch<any>('/api/builder/header-templates').catch(() => ({ headerTemplates: [] })),
        $fetch<any>('/api/builder/footer-templates').catch(() => ({ footerTemplates: [] })),
      ])
      state.value.themes = (Array.isArray(themesRes) ? themesRes : themesRes?.themes) || []
      state.value.models = (Array.isArray(modelsRes) ? modelsRes : modelsRes?.models) || []
      state.value.layouts = (Array.isArray(layoutsRes) ? layoutsRes : layoutsRes?.layouts) || []
      state.value.priceTagStyles = (Array.isArray(priceTagRes) ? priceTagRes : priceTagRes?.priceTagStyles) || []
      state.value.cardTemplates = (Array.isArray(cardTplRes) ? cardTplRes : cardTplRes?.cardTemplates) || []
      console.log('[loadCatalog] cardTemplates carregados:', state.value.cardTemplates.length, state.value.cardTemplates.map((t: any) => t.name))
      state.value.headerTemplates = (Array.isArray(headerTplRes) ? headerTplRes : headerTplRes?.headerTemplates) || []
      state.value.footerTemplates = (Array.isArray(footerTplRes) ? footerTplRes : footerTplRes?.footerTemplates) || []
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
    // Clear layout state when layout_id is set to null (auto mode)
    if ('layout_id' in fields && fields.layout_id === null) {
      state.value.layout = null
    }
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
      image_zoom: 100,
      image_x: 0,
      image_y: 0,
      extra_images: [],
      extra_images_layout: 'auto',
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

  const removeAllProducts = () => {
    state.value.products = []
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
    priceTagStyles,
    cardTemplates: computed(() => state.value.cardTemplates),
    headerTemplates: computed(() => state.value.headerTemplates),
    footerTemplates: computed(() => state.value.footerTemplates),
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
    removeAllProducts,
    reorderProducts,
    setZoom,
    setCurrentPage,
    cleanup,
    productEditorOpen,
  }
}

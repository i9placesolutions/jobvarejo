/**
 * useProductZone Composable
 * 
 * Gerencia o estado completo da Product Zone:
 * - Products, Splashes, Zone config, GlobalStyles
 * - Funções de atualização genéricas
 * - Seleção e manipulação
 */

import { ref, computed } from 'vue';
import type { 
  Product, 
  ProductImage, 
  Splash, 
  ProductZone, 
  GlobalStyles,
  ProductZoneState,
  LayoutPreset
} from '~/types/product-zone';
import { 
  DEFAULT_PRODUCT_ZONE, 
  DEFAULT_GLOBAL_STYLES, 
  LAYOUT_PRESETS 
} from '~/types/product-zone';
import {
  createDefaultProduct,
  createDefaultSplash,
  migrateProduct,
  migrateProductZone,
  calculateGridLayout,
  calculateProductPosition,
  calculateOptimalImageSize
} from '~/utils/product-zone-helpers';

// Estado global singleton
const products = ref<Product[]>([]);
const splashes = ref<Splash[]>([]);
const productZone = ref<ProductZone>({ ...DEFAULT_PRODUCT_ZONE });
const globalStyles = ref<GlobalStyles>({ ...DEFAULT_GLOBAL_STYLES });

// Estado de seleção
const selectedId = ref<string | number | null>(null);
const selectedType = ref<'product' | 'splash' | 'zone' | 'product-img' | 'product-name' | null>(null);
const selectedSubId = ref<string | undefined>(undefined);

// Undo/Redo stack
const historyStack = ref<string[]>([]);
const historyIndex = ref(-1);
const isHistoryAction = ref(false);

export const useProductZone = () => {
  // ==========================================================================
  // COMPUTED
  // ==========================================================================
  
  const selectedProduct = computed(() => {
    if (!selectedId.value) return null;
    if (selectedType.value === 'product' || 
        selectedType.value === 'product-img' || 
        selectedType.value === 'product-name') {
      return products.value.find(p => p.id === selectedId.value) ?? null;
    }
    return null;
  });

  const selectedSplash = computed(() => {
    if (!selectedId.value || selectedType.value !== 'splash') return null;
    return splashes.value.find(s => s.id === selectedId.value) ?? null;
  });

  const selectedImage = computed(() => {
    if (!selectedProduct.value || !selectedSubId.value) return null;
    return selectedProduct.value.images.find(img => img.id === selectedSubId.value) ?? null;
  });

  const productCount = computed(() => products.value.length);

  const gridLayout = computed(() => {
    return calculateGridLayout(productZone.value, products.value.length);
  });

  // ==========================================================================
  // CORE UPDATE FUNCTIONS
  // ==========================================================================
  
  /**
   * Atualiza uma propriedade do item selecionado (produto, splash ou zona)
   */
  const updateItemProperty = <T extends keyof Product | keyof Splash | keyof ProductZone>(
    prop: string,
    value: any
  ) => {
    saveToHistory();
    
    if (selectedType.value === 'product' || 
        selectedType.value === 'product-img' || 
        selectedType.value === 'product-name') {
      // Atualizar produto
      const index = products.value.findIndex(p => p.id === selectedId.value);
      if (index !== -1) {
        (products.value[index] as any)[prop] = value;
      }
    } else if (selectedType.value === 'splash') {
      // Atualizar splash
      const index = splashes.value.findIndex(s => s.id === selectedId.value);
      if (index !== -1) {
        (splashes.value[index] as any)[prop] = value;
      }
    } else if (selectedType.value === 'zone') {
      // Atualizar zona
      (productZone.value as any)[prop] = value;
    }
  };

  /**
   * Atualiza uma propriedade de imagem dentro de um produto
   */
  const updateProductImageProperty = (prop: keyof ProductImage, value: any) => {
    if (!selectedProduct.value || !selectedSubId.value) return;
    
    saveToHistory();
    
    const productIndex = products.value.findIndex(p => p.id === selectedId.value);
    if (productIndex === -1) return;
    
    const product = products.value[productIndex];
    if (!product || !product.images) return;
    
    const imageIndex = product.images.findIndex(
      img => img.id === selectedSubId.value
    );
    if (imageIndex === -1) return;
    
    (product.images[imageIndex] as any)[prop] = value;
  };

  /**
   * Atualiza múltiplas propriedades de um produto
   */
  const updateProduct = (productId: string | number, updates: Partial<Product>) => {
    saveToHistory();
    
    const index = products.value.findIndex(p => p.id === productId);
    if (index !== -1 && products.value[index]) {
      products.value[index] = { ...products.value[index], ...updates } as Product;
    }
  };

  /**
   * Atualiza múltiplas propriedades de um splash
   */
  const updateSplash = (splashId: string, updates: Partial<Splash>) => {
    saveToHistory();
    
    const index = splashes.value.findIndex(s => s.id === splashId);
    if (index !== -1 && splashes.value[index]) {
      splashes.value[index] = { ...splashes.value[index], ...updates } as Splash;
    }
  };

  /**
   * Atualiza a ProductZone
   */
  const updateZone = (updates: Partial<ProductZone>) => {
    saveToHistory();
    productZone.value = { ...productZone.value, ...updates };
  };

  /**
   * Atualiza GlobalStyles
   */
  const updateGlobalStyles = (updates: Partial<GlobalStyles>) => {
    saveToHistory();
    globalStyles.value = { ...globalStyles.value, ...updates };
  };

  // ==========================================================================
  // ADD/REMOVE FUNCTIONS
  // ==========================================================================
  
  /**
   * Adiciona um novo produto
   */
  const addProduct = (product: Partial<Product>): Product => {
    saveToHistory();
    
    const newProduct = createDefaultProduct(product);
    const migrated = migrateProduct(newProduct);
    
    // Calcular posição no grid
    const { cols, itemWidth, itemHeight } = gridLayout.value;
    const position = calculateProductPosition(
      productZone.value,
      products.value.length,
      cols,
      itemWidth,
      itemHeight,
      products.value.length + 1
    );
    
    migrated.x = position.x;
    migrated.y = position.y;
    migrated.width = itemWidth;
    migrated.height = itemHeight;
    migrated.colIndex = products.value.length % cols;
    migrated.rowIndex = Math.floor(products.value.length / cols);
    
    products.value.push(migrated);
    
    // Criar splash automaticamente se showPrice
    if (migrated.showPrice !== false) {
      const splash = createDefaultSplash(migrated.id, migrated.price);
      splashes.value.push(splash);
      migrated.splashId = splash.id;
    }

    // Recalcular layout para ajustar todos os itens (reflow)
    recalculateLayout();
    
    return migrated;
  };

  /**
   * Adiciona múltiplos produtos (batch)
   */
  const addProducts = (productList: Partial<Product>[]): Product[] => {
    saveToHistory();
    
    const newProducts: Product[] = [];
    const newSplashes: Splash[] = [];
    const totalCount = products.value.length + productList.length;
    const { cols, itemWidth, itemHeight } = calculateGridLayout(
      productZone.value,
      totalCount
    );
    
    productList.forEach((prod, idx) => {
      const totalIndex = products.value.length + idx;
      const newProduct = createDefaultProduct(prod);
      const migrated = migrateProduct(newProduct);
      
      const position = calculateProductPosition(
        productZone.value,
        totalIndex,
        cols,
        itemWidth,
        itemHeight,
        totalCount
      );
      
      migrated.x = position.x;
      migrated.y = position.y;
      migrated.width = itemWidth;
      migrated.height = itemHeight;
      migrated.colIndex = totalIndex % cols;
      migrated.rowIndex = Math.floor(totalIndex / cols);
      
      newProducts.push(migrated);
      
      // Criar splash
      if (migrated.showPrice !== false) {
        const splash = createDefaultSplash(migrated.id, migrated.price);
        newSplashes.push(splash);
        migrated.splashId = splash.id;
      }
    });
    
    products.value.push(...newProducts);
    splashes.value.push(...newSplashes);
    
    // Recalcular layout para organizar o grid corretamente
    recalculateLayout();
    
    return newProducts;
  };

  /**
   * Remove um produto
   */
  const removeProduct = (productId: string | number) => {
    saveToHistory();
    
    const index = products.value.findIndex(p => p.id === productId);
    if (index !== -1) {
      const product = products.value[index];
      if (!product) return;
      
      // Remover splash associado
      if (product.splashId) {
        const splashIndex = splashes.value.findIndex(s => s.id === product.splashId);
        if (splashIndex !== -1) {
          splashes.value.splice(splashIndex, 1);
        }
      }
      
      products.value.splice(index, 1);
      
      // Limpar seleção se era o selecionado
      if (selectedId.value === productId) {
        clearSelection();
      }
      
      // Recalcular posições
      recalculateLayout();
    }
  };

  /**
   * Remove múltiplos produtos
   */
  const removeProducts = (productIds: (string | number)[]) => {
    saveToHistory();
    
    productIds.forEach(id => {
      const index = products.value.findIndex(p => p.id === id);
      if (index !== -1) {
        const product = products.value[index];
        if (product && product.splashId) {
          const splashIndex = splashes.value.findIndex(s => s.id === product.splashId);
          if (splashIndex !== -1) {
            splashes.value.splice(splashIndex, 1);
          }
        }
        products.value.splice(index, 1);
      }
    });
    
    if (selectedId.value && productIds.includes(selectedId.value)) {
      clearSelection();
    }
    
    recalculateLayout();
  };

  /**
   * Limpa todos os produtos
   */
  const clearProducts = () => {
    saveToHistory();
    products.value = [];
    splashes.value = [];
    clearSelection();
  };

  // ==========================================================================
  // LAYOUT FUNCTIONS
  // ==========================================================================
  
  /**
   * Recalcula o layout de todos os produtos
   */
  const recalculateLayout = () => {
    if (products.value.length === 0) return;
    
    const { cols, itemWidth, itemHeight } = calculateGridLayout(
      productZone.value,
      products.value.length
    );

    const gridProducts = products.value.filter(product => !product.isFreeMode);

    gridProducts.forEach((product, index) => {
      
      const position = calculateProductPosition(
        productZone.value,
        index,
        cols,
        itemWidth,
        itemHeight,
        gridProducts.length
      );
      
      product.x = position.x;
      product.y = position.y;
      product.width = itemWidth;
      product.height = itemHeight;
      product.colIndex = index % cols;
      product.rowIndex = Math.floor(index / cols);
    });
  };

  /**
   * Aplica um preset de layout
   */
  const applyPreset = (presetId: string) => {
    const preset = LAYOUT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const defaultPadding = Number.isFinite(Number(preset.padding))
      ? Number(preset.padding)
      : Number(productZone.value.padding ?? DEFAULT_PRODUCT_ZONE.padding ?? 15);
    const nextPadding = Math.max(0, defaultPadding);
    const nextGapH = Math.max(0, Number.isFinite(Number(preset.gapHorizontal)) ? Number(preset.gapHorizontal) : nextPadding);
    const nextGapV = Math.max(0, Number.isFinite(Number(preset.gapVertical)) ? Number(preset.gapVertical) : nextPadding);

    updateZone({
      columns: preset.columns,
      rows: preset.rows,
      layoutDirection: preset.layoutDirection,
      cardAspectRatio: preset.cardAspectRatio,
      lastRowBehavior: preset.lastRowBehavior,
      verticalAlign: preset.verticalAlign ?? productZone.value.verticalAlign ?? DEFAULT_PRODUCT_ZONE.verticalAlign ?? 'top',
      padding: nextPadding,
      gapHorizontal: nextGapH,
      gapVertical: nextGapV,
      highlightCount: preset.highlightCount ?? 0,
      highlightPos: preset.highlightPos ?? 'first',
      highlightHeight: preset.highlightHeight ?? 1.5
    });
    
    recalculateLayout();
  };

  /**
   * Sincroniza gaps com padding
   */
  const syncGapsWithPadding = (padding: number) => {
    productZone.value.padding = padding;
    productZone.value.gapHorizontal = padding;
    productZone.value.gapVertical = padding;
    recalculateLayout();
  };

  // ==========================================================================
  // SELECTION FUNCTIONS
  // ==========================================================================
  
  const select = (id: string | number, type: typeof selectedType.value, subId?: string) => {
    selectedId.value = id;
    selectedType.value = type;
    selectedSubId.value = subId;
  };

  const selectProduct = (productId: string | number) => {
    select(productId, 'product');
  };

  const selectSplash = (splashId: string) => {
    select(splashId, 'splash');
  };

  const selectZone = () => {
    select('zone', 'zone');
  };

  const selectProductImage = (productId: string | number, imageId: string) => {
    select(productId, 'product-img', imageId);
  };

  const clearSelection = () => {
    selectedId.value = null;
    selectedType.value = null;
    selectedSubId.value = undefined;
  };

  // ==========================================================================
  // HISTORY (UNDO/REDO)
  // ==========================================================================
  
  const saveToHistory = () => {
    if (isHistoryAction.value) return;
    
    const state = JSON.stringify({
      products: products.value,
      splashes: splashes.value,
      zone: productZone.value,
      globalStyles: globalStyles.value
    });
    
    // Remove estados após o index atual (se tiver feito undo)
    if (historyIndex.value < historyStack.value.length - 1) {
      historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
    }

    // Evita snapshots idênticos consecutivos.
    if (historyStack.value.length > 0 && historyStack.value[historyStack.value.length - 1] === state) {
      historyIndex.value = historyStack.value.length - 1;
      return;
    }
    
    historyStack.value.push(state);
    historyIndex.value = historyStack.value.length - 1;
    
    // Limitar histórico
    if (historyStack.value.length > 50) {
      historyStack.value.shift();
      historyIndex.value--;
    }
  };

  const applySerializedState = (serialized: string) => {
    const state = JSON.parse(serialized);
    products.value = state.products;
    splashes.value = state.splashes;
    productZone.value = state.zone;
    globalStyles.value = state.globalStyles;
  };

  const serializeCurrentState = () => {
    return JSON.stringify({
      products: products.value,
      splashes: splashes.value,
      zone: productZone.value,
      globalStyles: globalStyles.value
    });
  };

  const undo = () => {
    if (historyIndex.value < 0) return;

    isHistoryAction.value = true;
    try {
      const historyEntry = historyStack.value[historyIndex.value];
      if (!historyEntry) return;

      // Swap current state with previous snapshot to support redo without a second stack.
      historyStack.value[historyIndex.value] = serializeCurrentState();
      historyIndex.value--;
      applySerializedState(historyEntry);
    } finally {
      isHistoryAction.value = false;
    }
  };

  const redo = () => {
    if (historyIndex.value >= historyStack.value.length - 1) return;

    isHistoryAction.value = true;
    try {
      const nextIndex = historyIndex.value + 1;
      const historyEntry = historyStack.value[nextIndex];
      if (!historyEntry) return;

      historyStack.value[nextIndex] = serializeCurrentState();
      historyIndex.value = nextIndex;
      applySerializedState(historyEntry);
    } finally {
      isHistoryAction.value = false;
    }
  };

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================
  
  /**
   * Exporta o estado completo para JSON
   */
  const exportState = (): ProductZoneState => {
    return {
      products: products.value,
      splashes: splashes.value,
      zone: productZone.value,
      globalStyles: globalStyles.value,
      selectedId: selectedId.value,
      selectedType: selectedType.value,
      selectedSubId: selectedSubId.value
    };
  };

  /**
   * Importa estado de JSON
   */
  const importState = (state: Partial<ProductZoneState>) => {
    saveToHistory();
    
    if (state.products) {
      products.value = state.products.map(p => migrateProduct(p));
    }
    if (state.splashes) {
      splashes.value = state.splashes;
    }
    if (state.zone) {
      productZone.value = migrateProductZone(state.zone);
    }
    if (state.globalStyles) {
      globalStyles.value = { ...DEFAULT_GLOBAL_STYLES, ...state.globalStyles };
    }
  };

  /**
   * Reseta para estado padrão
   */
  const reset = () => {
    saveToHistory();
    products.value = [];
    splashes.value = [];
    productZone.value = { ...DEFAULT_PRODUCT_ZONE };
    globalStyles.value = { ...DEFAULT_GLOBAL_STYLES };
    clearSelection();
  };

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================
  
  /**
   * Obtém o splash de um produto
   */
  const getSplashForProduct = (productId: string | number): Splash | null => {
    return splashes.value.find(s => s.parentId === productId) ?? null;
  };

  /**
   * Atualiza o splash de um produto
   */
  const updateProductSplash = (productId: string | number, updates: Partial<Splash>) => {
    const splash = getSplashForProduct(productId);
    if (splash) {
      updateSplash(splash.id, updates);
    }
  };

  /**
   * Calcula tamanho ótimo de imagem para um produto
   */
  const getOptimalImageSize = (product: Product) => {
    return calculateOptimalImageSize(
      productZone.value,
      products.value.length,
      !!product.name,
      !!product.limitText,
      product.width,
      product.height
    );
  };

  /**
   * Move produto para cima no z-index
   */
  const bringToFront = (productId: string | number) => {
    const maxZ = Math.max(...products.value.map(p => p.zIndex ?? 0));
    updateProduct(productId, { zIndex: maxZ + 1 });
  };

  /**
   * Move produto para baixo no z-index
   */
  const sendToBack = (productId: string | number) => {
    const minZ = Math.min(...products.value.map(p => p.zIndex ?? 0));
    updateProduct(productId, { zIndex: minZ - 1 });
  };

  // ==========================================================================
  // RETURN
  // ==========================================================================
  
  return {
    // State
    products,
    splashes,
    productZone,
    globalStyles,
    selectedId,
    selectedType,
    selectedSubId,
    
    // Computed
    selectedProduct,
    selectedSplash,
    selectedImage,
    productCount,
    gridLayout,
    
    // Core Updates
    updateItemProperty,
    updateProductImageProperty,
    updateProduct,
    updateSplash,
    updateZone,
    updateGlobalStyles,
    
    // Add/Remove
    addProduct,
    addProducts,
    removeProduct,
    removeProducts,
    clearProducts,
    
    // Layout
    recalculateLayout,
    applyPreset,
    syncGapsWithPadding,
    
    // Selection
    select,
    selectProduct,
    selectSplash,
    selectZone,
    selectProductImage,
    clearSelection,
    
    // History
    undo,
    redo,
    
    // Serialization
    exportState,
    importState,
    reset,
    
    // Utilities
    getSplashForProduct,
    updateProductSplash,
    getOptimalImageSize,
    bringToFront,
    sendToBack,
    
    // Constants
    LAYOUT_PRESETS
  };
};

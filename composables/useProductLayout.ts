/**
 * useProductLayout Composable
 * 
 * Cria e posiciona cards de produto no canvas Fabric.js
 * Integrado com os helpers de Product Zone
 */

import type { Product, ProductZone, GlobalStyles, Splash } from '~/types/product-zone';
import { 
  calculateOptimalImageSize,
  calculateGridLayout,
  calculateProductPosition,
  splitPrice,
  migrateProduct,
  createDefaultSplash
} from '~/utils/product-zone-helpers';
import { toWasabiProxyUrl } from '~/utils/storageProxy';
import { DEFAULT_PRODUCT_ZONE, DEFAULT_GLOBAL_STYLES } from '~/types/product-zone';

declare var fabric: any;

export const useProductLayout = () => {
  
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  
  const DEFAULT_CARD_WIDTH = 300;
  const DEFAULT_CARD_HEIGHT = 450;
  const DEFAULT_PADDING = 20;

  // ============================================================================
  // CREATE PRODUCT CARD
  // ============================================================================
  
  /**
   * Cria um card de produto como Fabric.Group
   * 
   * @param product - Dados do produto
   * @param x - Posição X no canvas
   * @param y - Posição Y no canvas
   * @param width - Largura do card (opcional)
   * @param height - Altura do card (opcional)
   * @param globalStyles - Estilos globais (opcional)
   * @param productCount - Quantidade total de produtos (para calculateOptimalImageSize)
   */
  const createProductCard = async (
    product: Partial<Product> | any,
    x: number,
    y: number,
    width?: number,
    height?: number,
    globalStyles?: GlobalStyles,
    productCount = 1
  ): Promise<any> => {
    // Migrar produto para formato completo
    const prod = migrateProduct(product);
    
    const cardWidth = width ?? prod.width ?? DEFAULT_CARD_WIDTH;
    const cardHeight = height ?? prod.height ?? DEFAULT_CARD_HEIGHT;
    const padding = DEFAULT_PADDING;
    const styles = globalStyles ?? DEFAULT_GLOBAL_STYLES;
    
    // Calcular tamanho ideal da imagem
    const imgSize = calculateOptimalImageSize(
      null,
      productCount,
      !!prod.name,
      !!prod.limitText,
      cardWidth,
      cardHeight
    );
    
    const zoneId = `zone_${Date.now()}`;
    
    // -------------------------------------------------------------------------
    // 1. Background
    // -------------------------------------------------------------------------
    const bgFill = styles.isProdBgTransparent ? 'transparent' : (prod.backgroundColor ?? styles.cardColor ?? '#ffffff');
    
    const bg = new fabric.Rect({
      width: cardWidth,
      height: cardHeight,
      fill: bgFill,
      stroke: styles.isProdBgTransparent ? 'transparent' : '#e5e5e5',
      strokeWidth: styles.isProdBgTransparent ? 0 : 1,
      rx: prod.borderRadius ?? styles.cardBorderRadius ?? 8,
      ry: prod.borderRadius ?? styles.cardBorderRadius ?? 8,
      originX: 'center',
      originY: 'center',
      subTargetCheck: true,
      data: { smartType: 'product-bg' }
    });

    // -------------------------------------------------------------------------
    // 2. Product Name (Top)
    // -------------------------------------------------------------------------
    const nameText = new fabric.Textbox(prod.name?.toUpperCase() ?? 'PRODUTO', {
      width: cardWidth - (padding * 2),
      fontSize: styles.prodNameSize ?? 24,
      fontFamily: styles.prodNameFont ?? 'Arial',
      fontWeight: styles.prodNameWeight ?? 'bold',
      textAlign: styles.prodNameAlign ?? 'center',
      fill: prod.nameColor ?? styles.prodNameColor ?? '#000000',
      top: -cardHeight/2 + padding,
      left: 0,
      originX: 'center',
      originY: 'top',
      splitByGrapheme: true,
      data: { 
        smartType: 'product-name',
        originalText: prod.name 
      }
    });

    // -------------------------------------------------------------------------
    // 3. Limit Badge (Below Name)
    // -------------------------------------------------------------------------
    const limitText = new fabric.Text(prod.limitText || '', {
      fontSize: styles.limitSize ?? 14,
      fontFamily: styles.limitFont ?? 'Arial',
      fill: prod.limitColor ?? styles.limitColor ?? '#ef4444',
      fontWeight: 'bold',
      top: -cardHeight/2 + padding + (nameText.height || 30) + 5,
      left: 0,
      originX: 'center',
      originY: 'top',
      visible: !!prod.limitText,
      data: { smartType: 'product-limit' }
    });

    // -------------------------------------------------------------------------
    // 4. Price Group (Bottom) - DINÂMICO: mostra apenas os preços que existem
    // -------------------------------------------------------------------------
    // ===== FUNÇÃO AUXILIAR PARA FORMATAR PREÇO =====
    const toPriceNumber = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      const str = String(value).trim();
      if (!str) return null;
      // Converter formato brasileiro "20,99" para número
      const cleaned = str.replace(/R\$\s*/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    // ===== COLETAR TODOS OS PREÇOS DISPONÍVEIS =====
    const priceObjects: any[] = [];
    const prices: Array<{ label: string; value: number; type: 'special' | 'regular' }> = [];
    let hasCondition = false;
    let conditionText = '';

    // Preço especial unitário (com desconto)
    const priceSpecialUnitNum = toPriceNumber(prod.priceSpecialUnit);
    if (priceSpecialUnitNum !== null) {
      prices.push({ label: '', value: priceSpecialUnitNum, type: 'special' });
      if (prod.specialCondition) {
        hasCondition = true;
        conditionText = prod.specialCondition;
      }
    }

    // Preço especial de embalagem
    const priceSpecialNum = toPriceNumber(prod.priceSpecial);
    if (priceSpecialNum !== null) {
      prices.push({ label: prod.packageLabel || 'CX', value: priceSpecialNum, type: 'special' });
      if (prod.specialCondition) {
        hasCondition = true;
        conditionText = prod.specialCondition;
      }
    }

    // Preço unitário regular (sem desconto)
    const priceUnitNum = toPriceNumber(prod.priceUnit);
    if (priceUnitNum !== null) {
      const hasSpecial = prices.some(p => p.type === 'special');
      prices.push({ label: hasSpecial ? '' : '', value: priceUnitNum, type: hasSpecial ? 'regular' : 'special' });
    }

    // Preço de embalagem regular
    const pricePackNum = toPriceNumber(prod.pricePack);
    if (pricePackNum !== null) {
      prices.push({ label: prod.packageLabel || 'CX', value: pricePackNum, type: 'regular' });
    }

    // Fallback para preço legado
    if (prices.length === 0) {
      const priceNum = toPriceNumber(prod.price);
      if (priceNum !== null) {
        prices.push({ label: '', value: priceNum, type: 'special' });
      }
    }

    // ===== RENDERIZAR PREÇOS DINAMICAMENTE =====
    let yOffset = 0;
    const isMultiPrice = prices.length > 1;

    prices.forEach((priceInfo, index) => {
      const priceData = splitPrice(priceInfo.value);
      const isSpecial = priceInfo.type === 'special';
      const isLast = index === prices.length - 1;

      // Cor para preço especial vs regular
      const splashColor = isSpecial
        ? (styles.splashSpecialColor ?? '#16a34a')  // verde para promoção
        : (styles.splashColor ?? '#dc2626');
      const splashTextColor = styles.splashTextColor ?? '#ffffff';
      const priceSize = isMultiPrice && isLast ? (styles.priceFontSize ?? 60) * 0.85 : (styles.priceFontSize ?? 60);

      // Se é preço regular em multi-price, usar estilo menor e sem splash grande
      if (!isSpecial && isMultiPrice) {
        // Preço regular menor, sem splash
        const regularPriceText = priceInfo.label
          ? `${priceInfo.label}: ${priceData.integer},${priceData.decimal}`
          : `${priceData.integer},${priceData.decimal}`;

        const regularText = new fabric.Text(regularPriceText, {
          fontSize: 11,
          fontFamily: styles.priceFont ?? 'Arial',
          fill: '#ffffff',
          fontWeight: 'normal',
          originX: 'center',
          originY: 'top',
          left: 0,
          top: yOffset,
          data: { smartType: 'product-price-regular' }
        });
        priceObjects.push(regularText);
        yOffset += 14;
      } else {
        // Preço principal com splash
        const splashShape = new fabric.Ellipse({
          rx: isMultiPrice ? 70 : 80,
          ry: isMultiPrice ? 45 : 50,
          fill: splashColor,
          angle: -5,
          originX: 'center',
          originY: 'center',
          data: { smartType: 'product-price-splash' }
        });

        // Currency Symbol
        const priceCurrency = new fabric.Text(styles.currencySymbol ?? 'R$', {
          fontSize: 18,
          fontFamily: styles.priceFont ?? 'Arial',
          fill: splashTextColor,
          originX: 'right',
          originY: 'bottom',
          left: -25,
          top: 0,
          data: { smartType: 'product-price-currency' }
        });

        // Main Price (Integer)
        const priceMain = new fabric.Text(priceData.integer, {
          fontSize: priceSize,
          fontFamily: styles.priceFont ?? 'Arial',
          fill: splashTextColor,
          fontWeight: 'bold',
          originX: 'right',
          originY: 'center',
          left: 8,
          top: 5,
          shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 5, offsetX: 2, offsetY: 2 }),
          data: { smartType: 'product-price-main' }
        });

        // Decimal Part
        const priceDec = new fabric.Text(`,${priceData.decimal}`, {
          fontSize: priceSize * 0.5,
          fontFamily: styles.priceFont ?? 'Arial',
          fill: splashTextColor,
          fontWeight: 'bold',
          originX: 'left',
          originY: 'center',
          left: 8,
          top: -8,
          data: { smartType: 'product-price-decimal' }
        });

        // Unit (un) - positioned UNDER the cents/decimal part
        // Must be positioned after priceDec to measure its width
        const priceUnitText = prod.unit ?? prod.priceUnit ?? 'un';
        const priceUnit = new fabric.Text(priceUnitText, {
          fontSize: 14,
          fontFamily: styles.priceFont ?? 'Arial',
          fill: splashTextColor,
          fontWeight: 'normal',
          originX: 'right',
          originY: 'center',
          left: 0, // Will be set after measuring decimal width
          top: 15, // Below the cents (same as EditorCanvas unitY offset)
          data: { smartType: 'product-price-unit' }
        });

        // Position unit at the RIGHT edge of the decimal block (same as EditorCanvas)
        const decWidth = priceDec.getScaledWidth();
        priceUnit.set({ left: 8 + decWidth });

        const splashGroup = new fabric.Group([splashShape, priceCurrency, priceMain, priceDec, priceUnit], {
          originX: 'center',
          originY: 'center',
          subTargetCheck: true,
          data: { smartType: 'product-price-splash-group' }
        });

        priceObjects.push(splashGroup);
        yOffset += 55;
      }
    });

    // ===== CONDIÇÃO ESPECIAL =====
    if (hasCondition && conditionText) {
      const conditionObj = new fabric.Text(conditionText.toUpperCase(), {
        fontSize: 10,
        fontFamily: styles.priceFont ?? 'Arial',
        fill: '#ffffff',
        fontWeight: 'normal',
        originX: 'center',
        originY: 'top',
        left: 0,
        top: yOffset,
        data: { smartType: 'product-price-condition' }
      });
      priceObjects.push(conditionObj);
    }

    // Group Price Components
    const priceGroup = new fabric.Group(priceObjects, {
      top: cardHeight/2 - 70,
      left: 0,
      originX: 'center',
      originY: 'center',
      subTargetCheck: true,
      visible: prod.showPrice !== false,
      data: { smartType: 'product-price-group' }
    });

    // -------------------------------------------------------------------------
    // 5. Product Image (Center)
    // -------------------------------------------------------------------------
    let imgObj: any = null;
    const rawImageUrl = prod.images?.[0]?.src || (product as any).imageUrl || (product as any).url || (product as any).image;
    const imageUrl = toWasabiProxyUrl(String(rawImageUrl || '').trim()) || rawImageUrl;
    
    if (imageUrl) {
      try {
        imgObj = await new Promise((resolve) => {
          fabric.Image.fromURL(imageUrl, (img: any) => {
            if (!img) { resolve(null); return; }
            
            // Scale to fit optimal size
            const scaleW = imgSize.maxWidth / (img.width || 1);
            const scaleH = imgSize.maxHeight / (img.height || 1);
            const scale = Math.min(scaleW, scaleH);
            
            img.scale(scale);
            
            img.set({
              originX: 'center',
              originY: 'center',
              top: 0,
              left: 0,
              data: { 
                smartType: 'product-image',
                productId: prod.id
              }
            });
            
            resolve(img);
          }, { crossOrigin: 'anonymous' });
        });
      } catch (err) {
        console.warn('[useProductLayout] Failed to load image:', imageUrl, err);
      }
    }

    // -------------------------------------------------------------------------
    // 6. Assemble Group
    // -------------------------------------------------------------------------
    const objects = [bg, nameText, limitText];
    if (imgObj) objects.push(imgObj);
    objects.push(priceGroup);

    const group = new fabric.Group(objects, {
      left: x,
      top: y,
      originX: 'left',
      originY: 'top',
      subTargetCheck: false, // Disable to move entire card together
      interactive: false, // Disable internal interactions
      isSmartObject: true,
      isProductCard: true,
      smartGridId: zoneId,
      // objectCaching: true (default), but ensure it's not false
      data: { 
        id: prod.id,
        productId: prod.id,
        productData: prod,
        isProductCard: true,
        smartZoneId: zoneId
      }
    });
    
    // Store dimensions for containment
    (group as any)._cardWidth = cardWidth;
    (group as any)._cardHeight = cardHeight;
    (group as any)._customId = `card_${Math.random().toString(36).substr(2, 9)}`;

    // Internal elements should NOT be selectable independently
    // The entire card group should move together as one unit
    group.getObjects().forEach((obj: any) => {
      obj.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false
      });
    });

    return group;
  };

  // ============================================================================
  // ARRANGE SMART GRID
  // ============================================================================
  
  /**
   * Organiza produtos em um grid dentro de uma zona ou no canvas
   * 
   * @param canvas - Referência ao canvas Fabric
   * @param products - Array de produtos
   * @param zone - ProductZone configuração (opcional)
   * @param globalStyles - Estilos globais (opcional)
   */
  const arrangeSmartGrid = async (
    canvas: any,
    products: any[],
    zone?: Partial<ProductZone>,
    globalStyles?: GlobalStyles
  ): Promise<any[]> => {
    if (!canvas) return [];
    
    const zoneConfig: ProductZone = {
      ...DEFAULT_PRODUCT_ZONE,
      ...zone
    };
    
    const styles = globalStyles ?? DEFAULT_GLOBAL_STYLES;
    const count = products.length;
    
    if (count === 0) return [];
    
    // Calcular layout
    const { cols, rows, itemWidth, itemHeight } = calculateGridLayout(zoneConfig, count);
    
    // Gerar Grid ID para associar todos os cards
    const gridId = `grid_${Date.now()}`;
    
    const objectsToAdd: any[] = [];

    for (let i = 0; i < count; i++) {
      const product = products[i];
      
      // Calcular posição
      const position = calculateProductPosition(
        zoneConfig,
        i,
        cols,
        itemWidth,
        itemHeight,
        count
      );
      
      // Criar card
      const card = await createProductCard(
        product,
        position.x,
        position.y,
        itemWidth,
        itemHeight,
        styles,
        count
      );
      
      // Adicionar metadados do grid
      card.set({
        smartGridId: gridId,
        gridIndex: i,
        colIndex: i % cols,
        rowIndex: Math.floor(i / cols)
      });
      
      objectsToAdd.push(card);
    }

    // Adicionar ao canvas
    objectsToAdd.forEach(obj => canvas.add(obj));
    
    canvas.requestRenderAll();
    return objectsToAdd;
  };

  // ============================================================================
  // CREATE PRODUCT ZONE (Visual Container)
  // ============================================================================
  
  /**
   * Cria uma zona visual de produtos (placeholder para grid)
   */
  const createProductZone = (
    x: number,
    y: number,
    width = 400,
    height = 600
  ): any => {
    // Background rect
    const zoneRect = new fabric.Rect({
      width,
      height,
      fill: 'transparent',
      stroke: '#404040',
      strokeWidth: 2,
      strokeDashArray: [10, 10],
      rx: 16,
      ry: 16,
      originX: 'center',
      originY: 'center'
    });

    // Title
    const title = new fabric.Text("Zona de Produtos", {
      fontSize: 24,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      fill: '#ffffff',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      top: 0
    });
    
    // Subtitle
    const subtitle = new fabric.Text("Arraste para mover", {
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fill: '#a1a1aa',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      top: 30
    });

    const group = new fabric.Group([zoneRect, title, subtitle], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      isGridZone: true,
      isProductZone: true,
      name: 'gridZone',
      subTargetCheck: false,
      hoverCursor: 'move',
      moveCursor: 'move',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      transparentCorners: false,
      cornerColor: '#8b5cf6',
      cornerStyle: 'circle',
      cornerSize: 10,
      padding: 5
    });
    
    (group as any)._customId = `zone_${Math.random().toString(36).substr(2, 9)}`;
    (group as any)._zoneWidth = width;
    (group as any)._zoneHeight = height;

    return group;
  };

  // ============================================================================
  // UPDATE CARD STYLES
  // ============================================================================
  
  /**
   * Atualiza estilos de um card existente
   */
  const updateCardStyle = (
    card: any,
    prop: string,
    value: any
  ) => {
    if (!card || !card.getObjects) return;
    
    const objects = card.getObjects();
    
    switch (prop) {
      case 'backgroundColor':
      case 'cardColor':
        const bg = objects.find((o: any) => o.data?.smartType === 'product-bg');
        if (bg) bg.set('fill', value);
        break;
        
      case 'splashColor':
        const splash = objects
          .flatMap((o: any) => o.getObjects?.() || [o])
          .find((o: any) => o.data?.smartType === 'product-price-splash');
        if (splash) splash.set('fill', value);
        break;
        
      case 'splashTextColor':
        const priceTexts = objects
          .flatMap((o: any) => o.getObjects?.() || [o])
          .filter((o: any) => ['product-price-main', 'product-price-decimal', 'product-price-unit'].includes(o.data?.smartType));
        priceTexts.forEach((t: any) => t.set('fill', value));
        break;
        
      case 'nameColor':
        const name = objects.find((o: any) => o.data?.smartType === 'product-name');
        if (name) name.set('fill', value);
        break;
        
      case 'nameFont':
        const nameFont = objects.find((o: any) => o.data?.smartType === 'product-name');
        if (nameFont) nameFont.set('fontFamily', value);
        break;
    }
    
    card.dirty = true;
  };

  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    createProductCard,
    arrangeSmartGrid,
    createProductZone,
    updateCardStyle,
    // Constants for external use
    DEFAULT_CARD_WIDTH,
    DEFAULT_CARD_HEIGHT,
    DEFAULT_PADDING
  };
};

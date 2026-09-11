import { isProductLabelTemplateCompatible } from './productLabelCompatibility'
import { resolveProductNameColor, syncProductNameColor } from './productNameColors'
type GlobalStyles = Record<string, any>
type LabelTemplate = any
type ProductZone = any
type SmartGridRunOptions = any
type ApplyLabelTemplateToZoneOptions = any
type RecalculateZoneLayoutOptions = any

import { DEFAULT_EDITOR_FONT_FAMILY } from './font-catalog'

export type EditorProductGridContext = Record<string, any>

/**
 * Reúne a lógica de cartões, etiquetas e zonas de produto do editor.
 * O canvas permanece dono do estado; este controlador recebe as dependências
 * explicitamente para manter as ações síncronas e testáveis.
 */
export const createEditorProductGridController = (ctx: EditorProductGridContext) => {
    const {
        BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID,
        BUILTIN_FARDO_SPECIAL_LABEL_TEMPLATE_ID,
        DEFAULT_PRODUCT_ZONE,
        DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT,
        FARDO_SPECIAL_PRICE_PALETTE,
        MOCK_PRODUCTS,
        activePage,
        applyAtacarejoPricingToPriceGroup,
        applyAutoOfferRuntimeLayout,
        applyCardFrameBinding,
        applyCurrentStructureRecipe,
        applyGlobalLabelTemplatesToCanvas,
        applyGlobalProductCardConfigurationToCanvas,
        applyGlobalProductZoneStructuresToCanvas,
        applyRectCornerRadiiPatch,
        applyStickerOutlinePatch,
        autoTrimFabricImageAsync,
        buildAtacarejoPriceGroupForCard,
        buildDefaultPriceGroupForCard,
        calculateGridLayout,
        canvas,
        cardHasExplicitLabelTemplateOverride,
        clamp,
        clonePriceGroupForRollback,
        cloneTemplateGroupJson,
        collectObjectsDeep,
        createDefaultProductZoneStructureMap,
        enableCardElementRotationControl,
        ensureFramesBelowContents,
        ensureLabelTemplatesReady,
        ensureProductZoneNamesDistinct,
        ensureZoneRuntimeIndex,
        extractLimitFromName,
        fabric,
        findFlyerAccent,
        findProductZoneById,
        fitProductImageIntoSlot,
        fitResponsiveProductName,
        flushPersistenceNow,
        formatPriceValue,
        getAspectRatioValue,
        getAvailablePrices,
        getCardBackgroundRect,
        getCardLimitText,
        getCardStyleOverrides,
        getCardTitleText,
        getCurrentProductZonePreviewFormat,
        getCurrentZoneObject,
        getEffectiveStylesForCard,
        getFrameById,
        getNextProductZoneName,
        getOrCreateFrameClipRect,
        getPriceGroupFromAny,
        getPriceGroupPlacementSnapshotFromCard,
        getResolvedZoneFrameId,
        getRuntimeProductZones,
        getSpecialConditionFromProduct,
        getZoneChildren,
        getZoneGlobalStyles,
        getZoneHighlightPredicate,
        getZoneMetrics,
        getZoneRect,
        getZoneStyleOverrides,
        harmonizeProductCardTypography,
        hasPersistedCardLayout,
        hasPersistedProductZoneStructure,
        hasUsableLabelTemplateCatalog,
        inferHeaderPartsForPriceTemplate,
        inferHeaderPartsFromProduct,
        inferUnitFromCard,
        inferUnitLabelFromProduct,
        instantiatePriceGroupFromTemplate,
        invalidateQuickModeUi,
        invalidateScrollbarBounds,
        invalidateZoneRuntimeIndex,
        isAtacarejoTemplateGroupJson,
        isBulkProductMutation,
        isHistoryProcessing,
        isLabelTemplateLibraryAuthoritative,
        isLightweightGlobalStyleProp,
        isLikelyPriceGroupObject,
        isLikelyProductCard,
        isLikelyProductZone,
        isMisnamedProductCardGroup,
        isMobile,
        isPriceGroupObject,
        isProcessing,
        isQuickMode,
        isRectObject,
        isRedBurstPriceGroup,
        isRichPriceTextObject,
        isStandalonePriceGroup,
        isTablet,
        isTemplateCompositionManagedPage,
        isTemplateCompositionManagedZone,
        isTextLikeObject,
        labelTemplates,
        layoutPriceGroup,
        makeCanvasObjectId,
        makeId,
        markProductImageTrimmed,
        normalizeGlobalStyles,
        normalizeLimitText,
        normalizePriceGroupPlacementInCard,
        normalizeProductCardConfiguration,
        normalizeProductCardIdentity,
        normalizeProductZoneStructureMapByPreviewFormat,
        normalizeProductZoneStructureVariantMapByPreviewFormat,
        normalizeZoneScale,
        preserveValidZoneStructureVariantSelection,
        preserveValidZoneStructureVariantSelectionsByPreviewFormat,
        productCardConfiguration,
        productCardConfigurationState,
        productNeedsAtacarejoLabel,
        productZoneState,
        productZoneStructuresState,
        refreshCanvasObjects,
        refreshManualTemplateAfterTypographyChange,
        refreshSelectedRef,
        repairLegacyProductCardImageTransforms,
        repairLooseZoneCardBindings,
        resetCardPriceGroupToDefault,
        resizeSmartObject,
        resolveAtacVariantKeyFromPrice,
        resolveProductCardColor,
        resolveProductImageRef,
        resolveProductZoneStructure,
        restoreCardPriceGroup,
        restoreMissingManualTemplateFlags,
        restoreMissingManualTemplateFlagsInCanvas,
        restoreTemplateCompositionFrameBindings,
        restoreViewportCulledObjects,
        safeAddWithUpdate,
        safeRequestRenderAll,
        saveCurrentState,
        scheduleCanvasImagesAutoTrim,
        scheduleIdleStatePersistence,
        scheduleMissingProductImageRecovery,
        scheduleZoneSnapshotRecovery,
        serializePriceGroupForTemplate,
        setCardLabelTemplateMetadata,
        setPriceGroupInteractionMode,
        setPriceOnPriceGroup,
        setRichPriceBaseFontSize,
        setRichPriceSegmentStyle,
        shouldPreserveManualTemplateVisual,
        shouldReapplyLabelStylePropAfterTemplateApply,
        stabilizePriceGroupsForPersistence,
        syncFrameClips,
        syncObjectFrameClip,
        syncZoneCardFrameBindings,
        syncZoneDerivedMetadata,
        toWasabiProxyUrl,
        trimAllCanvasImages,
        tuneRedBurstPriceGroupLayout,
        updateScrollbars,
    } = ctx

    const createSmartObject = async (
        product: any,
        x: number,
        y: number,
        width: number,
        height: number,
        gridId: string,
        labelTpl?: LabelTemplate,
        zoneStyles?: Partial<GlobalStyles>,
        labelPlacementSnapshot?: {
            left?: number;
            top?: number;
            leftRatio?: number;
            topRatio?: number;
            bottomGapRatio?: number | null;
            originX?: string;
            originY?: string;
            angle?: number;
            cardW?: number;
            cardH?: number;
        } | null
    ) => {
        // Layout Constants
        const cardHeight = height || width * 1.4; // Aspect ratio 1:1.4 (fallback)
        const halfW = width / 2;
        const halfH = cardHeight / 2;
        const baseSize = Math.min(width, cardHeight);
        const effectiveStyles = normalizeGlobalStyles(zoneStyles);
        // A preferência de etiqueta pode vir da zona, mas nunca deve forçar uma
        // etiqueta de dois preços em um produto simples (ou o inverso).
        const compatibleLabelTpl = labelTpl && (
            product?.offerFormat === 'wholesale-pack-v1'
                ? isProductLabelTemplateCompatible(product, labelTpl)
                : isAtacarejoTemplateGroupJson(labelTpl.group) === productNeedsAtacarejoLabel(product)
        ) ? labelTpl : undefined
        const initialCardBorderWidth = Math.max(0, Number(effectiveStyles.cardBorderWidth ?? 0));
        const initialCardBorderColor = initialCardBorderWidth > 0
            ? (effectiveStyles.cardBorderColor || '#000000')
            : undefined;
        const { cleanedName, extractedLimit } = extractLimitFromName(product?.name);
        const limitTextValue = normalizeLimitText(product?.limit ?? product?.limitText ?? extractedLimit);
        const persistedTitleWidth = Number((product as any)?.titleTextWidth);
        const persistedTitleWidthRatio = Number((product as any)?.titleTextWidthRatio);
        let initialTitleWidth = width - 20;
        if (Number.isFinite(persistedTitleWidthRatio) && persistedTitleWidthRatio > 0) {
            initialTitleWidth = width * persistedTitleWidthRatio;
        } else if (Number.isFinite(persistedTitleWidth) && persistedTitleWidth > 0) {
            initialTitleWidth = persistedTitleWidth;
        }
        initialTitleWidth = Math.min(Math.max(20, width), Math.max(20, initialTitleWidth));

        // All coordinates are RELATIVE to group center (0,0 = center of card)

        // 1. Background (Card container)
        const bg = new fabric.Rect({
            width: width,
            height: cardHeight,
            fill: resolveProductCardColor(effectiveStyles, false),
            rx: typeof effectiveStyles.cardBorderRadius === 'number' ? effectiveStyles.cardBorderRadius : 8,
            ry: typeof effectiveStyles.cardBorderRadius === 'number' ? effectiveStyles.cardBorderRadius : 8,
            stroke: initialCardBorderColor,
            strokeWidth: initialCardBorderWidth,
            originX: 'center',
            originY: 'center',
            left: 0,
            top: 0,
            name: 'offerBackground'
        });

        // 2. Title (Top) - positioned at top of card
        // Mantemos a mesma margem usada em resizeSmartObject (5% da altura) para que o
        // primeiro layout case com o relayout subsequente — evita o "salto" do titulo
        // e do limit logo apos a criacao do card.
        const titleMarginTop = cardHeight * 0.05;
        const titleOffsetY = typeof effectiveStyles.prodNameOffsetY === 'number' ? effectiveStyles.prodNameOffsetY : 0;
        const titleY = -halfH + titleMarginTop + titleOffsetY;
        const titleScale = typeof effectiveStyles.prodNameScale === 'number' ? effectiveStyles.prodNameScale : 1;
        const titleFontSize = Math.max(10, Math.min(baseSize * 0.22, baseSize * 0.09 * titleScale));
        const title = new fabric.Textbox(String(cleanedName || ''), {
            fontSize: titleFontSize,
            fontFamily: effectiveStyles.prodNameFont || DEFAULT_EDITOR_FONT_FAMILY,
            fontWeight: (effectiveStyles.prodNameWeight as any) ?? '900',
            fill: resolveProductNameColor(bg.fill, {}, effectiveStyles),
            textAlign: effectiveStyles.prodNameAlign || 'center',
            lineHeight: typeof effectiveStyles.prodNameLineHeight === 'number' ? effectiveStyles.prodNameLineHeight : 1.16,
            originX: 'center',
            originY: 'top',
            left: 0,
            top: titleY,
            width: initialTitleWidth,
            name: 'smart_title',
            // UX: Prevent font stretching/blurring, enforce reflow
            lockScalingY: true,
            splitByGrapheme: false
        });
        if (
            (Number.isFinite(persistedTitleWidthRatio) && persistedTitleWidthRatio > 0) ||
            (Number.isFinite(persistedTitleWidth) && persistedTitleWidth > 0)
        ) {
            (title as any).__manualTransform = true;
            (title as any).__manualTextWidth = initialTitleWidth;
            if (width > 0) {
                (title as any).__manualTextWidthRatio = Math.min(1, Math.max(0.1, initialTitleWidth / width));
                (title as any).__manualTransformCardW = width;
            }
            if (cardHeight > 0) {
                (title as any).__manualTransformCardH = cardHeight;
            }
        }
        if (typeof (title as any).initDimensions === 'function') (title as any).initDimensions();

        // 2.1 Limit (Below title) — mesma matematica do resizeSmartObject:
        // top = titleY + titleH + gap; gap = max(4, h * 0.008).
        // Cor/fonte/tamanho saem dos styles da zona (limitColor, limitFont, limitSize),
        // garantindo coerencia entre criacao e relayout.
        let limitObj: any = null;
        if (limitTextValue) {
            const titleH = (title.getScaledHeight?.() ?? title.height ?? 0);
            const gap = Math.max(4, cardHeight * 0.015);
            const limitMult = (typeof effectiveStyles.limitSize === 'number' && effectiveStyles.limitSize > 0)
                ? effectiveStyles.limitSize / 14
                : 1;
            const limitFontSize = Math.max(8, Math.min(baseSize * 0.12, baseSize * 0.045 * limitMult));
            limitObj = new fabric.Textbox(limitTextValue, {
                fontSize: limitFontSize,
                fontFamily: effectiveStyles.limitFont || effectiveStyles.prodNameFont || DEFAULT_EDITOR_FONT_FAMILY,
                fontWeight: '900',
                fill: effectiveStyles.limitColor || '#ef4444',
                textAlign: 'center',
                originX: 'center',
                originY: 'top',
                left: 0,
                top: titleY + titleH + gap,
                width: width * 0.9,
                name: 'smart_limit',
                data: { smartType: 'product-limit' },
                lockScalingY: true,
                splitByGrapheme: false
            });
            if (typeof (limitObj as any).initDimensions === 'function') (limitObj as any).initDimensions();
        }

        // 3. Product Image (Middle)
        let imgObj: any = null;
        // Resolver URL: suporta image_wasabi_key, imageUrl/image/url e Product.images[].
        const rawImgRef = resolveProductImageRef(product);
        const imageY = 0; // Centered vertically

        if (rawImgRef) {
            try {
                // Se é uma key de storage (sem http), criar URL de proxy diretamente
                let resolvedUrl: string = rawImgRef;
                if (!rawImgRef.startsWith('http') && !rawImgRef.startsWith('/api/') && !rawImgRef.startsWith('data:') && !rawImgRef.startsWith('blob:')) {
                    resolvedUrl = `/api/storage/p?key=${encodeURIComponent(rawImgRef)}`;
                } else {
                    resolvedUrl = toWasabiProxyUrl(rawImgRef) || rawImgRef;
                }

                imgObj = await fabric.Image.fromURL(resolvedUrl, { crossOrigin: 'anonymous' });

                if (imgObj) {
                    const imgW = imgObj.width || 0;
                    const imgH = imgObj.height || 0;

                    // Guard: imagem com dimensão zero ou inválida
                    if (imgW < 2 || imgH < 2) {
                        console.warn('[createSmartObject] Imagem carregada com dimensões inválidas:', imgW, imgH);
                        imgObj = null;
                    } else {
                        // Auto-trim pelo alpha visível e fit seguro no slot da imagem.
                        await autoTrimFabricImageAsync(imgObj, { preserveVisualPosition: true });
                        markProductImageTrimmed(imgObj);
                        fitProductImageIntoSlot(imgObj, {
                            width: width * 0.85,
                            height: cardHeight * 0.5,
                            left: 0,
                            top: imageY,
                            originX: 'center',
                            originY: 'center',
                            name: 'smart_image'
                        }, { maxScale: 3 });
                    }
                }
            } catch (e) {
                console.warn('[createSmartObject] Image load failed, using placeholder rect', e);
                imgObj = null;
            }
        }

        // Fallback rect if no image
        if (!imgObj) {
            imgObj = new fabric.Rect({
                width: width * 0.7,
                height: cardHeight * 0.35,
                fill: '#333',
                rx: 8, ry: 8,
                originX: 'center',
                originY: 'center',
                left: 0,
                top: imageY,
                name: 'smart_image',
                data: { smartType: 'product-image' }
            });
        }

        // 4. Price Tag (Bottom) - DINÂMICO: mostra apenas os preços que existem
        const marginBottom = cardHeight * 0.05;

        // Obter todos os preços disponíveis dinamicamente
        const availablePrices = getAvailablePrices(product);
        const priceStr = availablePrices.mainPrice
            .replace(/R\$\s*/gi, '')
            .replace(/\s+/g, '')
            .trim();

        // A unidade da etiqueta e inferida do produto: KG para itens vendidos a
        // quilo, UN/CADA para unidade e PCT/CX/FD... quando a embalagem foi
        // informada. Gramaturas numeradas (ex.: 5KG) continuam indicando pacote
        // vendido por unidade.
        const unitText = inferUnitLabelFromProduct(product);

        // Removido log de hot path (executa a cada render de card de produto).
        // Mantemos apenas o warn para preco vazio, que e sinal de dado comercial faltante.
        if (!priceStr || priceStr === '0,00') {
            console.warn('[createSmartObject] PRECO VAZIO para produto:', product.name);
        }

        // Default tag (fallback)
        const buildDefaultPriceGroup = () => {
            // Use a neutral Y; we anchor it after layout so custom templates can have different heights.
            return buildDefaultPriceGroupForCard(priceStr, width, cardHeight, 0, unitText);
        };

        let priceTagGroup: any = null;
        const buildPriceGroupFromTemplate = async (tpl: LabelTemplate | undefined | null) => {
            if (!tpl) return null;
            const pg = await instantiatePriceGroupFromTemplate(tpl);
            pg.set({ left: 0, top: 0, name: 'priceGroup' });
            setPriceOnPriceGroup(pg, priceStr, unitText);
            const isRedBurst = isRedBurstPriceGroup(pg);
            const headerParts = inferHeaderPartsFromProduct(product, 'OFERTA', {
                preferFullNameWithWeight: isRedBurst,
                splitUnitIntoDedicatedField: !isRedBurst
            });
            const headerTextObj = collectObjectsDeep(pg).find((o: any) => o?.name === 'price_header_text');
            if (headerTextObj && isTextLikeObject(headerTextObj)) {
                const defaultHeader = String(headerTextObj.text || '').trim() || 'OFERTA';
                headerTextObj.set('text', headerParts.title || defaultHeader);
                if (typeof headerTextObj.initDimensions === 'function') headerTextObj.initDimensions();
            }
            const headerUnitObj = collectObjectsDeep(pg).find((o: any) => o?.name === 'price_header_unit_text');
            if (headerUnitObj && isTextLikeObject(headerUnitObj)) {
                headerUnitObj.set('text', isRedBurst ? '' : (headerParts.unit || ''));
                headerUnitObj.set('visible', !isRedBurst && !!headerParts.unit);
                if (typeof headerUnitObj.initDimensions === 'function') headerUnitObj.initDimensions();
            }
            if (isRedBurst) tuneRedBurstPriceGroupLayout(pg);
            applyAtacarejoPricingToPriceGroup(pg, product);
            // DEBUG: verify final price text values after all price manipulations
            const debugParts = collectObjectsDeep(pg);
            const debugPriceTexts = debugParts
                .filter((o: any) => isTextLikeObject(o) && o?.name && (
                    o.name.includes('price') || o.name.includes('Price') ||
                    o.name.includes('integer') || o.name.includes('Integer') ||
                    o.name.includes('decimal') || o.name.includes('Decimal') ||
                    o.name.includes('retail') || o.name.includes('wholesale') ||
                    o.name === 'smart_price'
                ))
                .map((o: any) => `${o.name}="${o.text}" visible=${o.visible !== false}`);
            if (import.meta.dev) console.log('[buildPriceGroupFromTemplate] FINAL price state for', product?.name, ':', debugPriceTexts.join(' | '));
            return pg;
        };

        let usedLabelTemplateId = ''
        if (compatibleLabelTpl) {
            try {
                priceTagGroup = await buildPriceGroupFromTemplate(compatibleLabelTpl);
                usedLabelTemplateId = String(compatibleLabelTpl.id || '').trim()
            } catch (e) {
                console.warn('[createSmartObject] Failed to use label template, falling back', e);
                priceTagGroup = null;
            }
        }
        if (!priceTagGroup) {
            // Verificar se tem preço especial/atacado usando o novo sistema
            const availablePrices = getAvailablePrices(product);
            const hasSpecial = availablePrices.prices.some((p: any) => p.type === 'special');
            const hasMain = availablePrices.prices.some((p: any) => p.type === 'main' || p.type === 'pack');
            const hasCondition = !!availablePrices.condition;
            const hasWholesalePrice = hasSpecial && hasMain;
            // Mesmo com 1 preço, se houver condição/observação o card deve manter o template atacarejo e colapsar.
            const shouldUseAtacarejoTemplate = productNeedsAtacarejoLabel(product);
            const packageToken = String(product?.packageLabel || product?.packUnit || '').trim().toUpperCase().replace(/\s+/g, '');
            const isFardoOrPackPricing = /^(FD|FARDO|FARDOS|CX|CAIXA|CAIXAS|PCT|PACOTE|PACOTES|PACK|SIXPACK)/.test(packageToken);
            const hasExplicitFardoTiers = !!formatPriceValue(product?.priceUnit ?? product?.pricePack)
                && !!formatPriceValue(product?.priceSpecialUnit ?? product?.priceSpecial ?? product?.priceWholesale);
            const shouldUseFardoSpecialTemplate = shouldUseAtacarejoTemplate
                && hasSpecial
                && hasMain
                && isFardoOrPackPricing
                && hasExplicitFardoTiers;
            if (shouldUseAtacarejoTemplate) {
                // Prefer template-driven atacarejo (edited in Mini Editor) over hardcoded fallback.
                const preferredTemplateId = product?.offerFormat === 'wholesale-pack-v1' || shouldUseFardoSpecialTemplate
                    ? BUILTIN_FARDO_SPECIAL_LABEL_TEMPLATE_ID
                    : BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID;
                const builtInAtacTpl = labelTemplates.value.find((t: any) => String(t?.id || '') === preferredTemplateId)
                    || labelTemplates.value.find((t: any) => String(t?.id || '') === BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID);
                if (builtInAtacTpl) {
                    try {
                        priceTagGroup = await buildPriceGroupFromTemplate(builtInAtacTpl);
                        usedLabelTemplateId = String(builtInAtacTpl.id || '').trim()
                    } catch (e) {
                        console.warn('[createSmartObject] Failed to build atacarejo from template, using hardcoded fallback', e);
                    }
                }
            }
            if (!priceTagGroup) {
                priceTagGroup = shouldUseAtacarejoTemplate
                    ? buildAtacarejoPriceGroupForCard(product, width, cardHeight, 0, shouldUseFardoSpecialTemplate ? {
                        labelVariant: 'fardo-special-v1',
                        autoCollapseMissingPrices: true,
                        // A unidade exibida no fardo deve acompanhar o produto
                        // (KG, UN, CADA, PCT, CX...), sem deixar o placeholder UND
                        // vencer uma unidade inferida da descricao/gramatura.
                        displayUnit: unitText || 'UND',
                        packLineCompact: true,
                        conditionFormat: 'acima-de',
                        palette: FARDO_SPECIAL_PRICE_PALETTE
                    } : undefined)
                    : buildDefaultPriceGroup();
            }
        }

        // Fill atacarejo fields even for the default group (no-op unless the template supports it).
        applyAtacarejoPricingToPriceGroup(priceTagGroup, product);

        const layout = layoutPriceGroup(priceTagGroup, width, cardHeight);
        const hForAnchor = layout?.pillH ?? (priceTagGroup.getScaledHeight?.() ?? priceTagGroup.height ?? (cardHeight * 0.18));
        const resolvedSplashLeft = Number.isFinite(Number(labelPlacementSnapshot?.left)) ? Number(labelPlacementSnapshot?.left) : 0;
        const resolvedSplashTop = Number.isFinite(Number(labelPlacementSnapshot?.top))
            ? Number(labelPlacementSnapshot?.top)
            : (halfH - (hForAnchor / 2) - marginBottom);
        const resolvedSplashAngle = Number.isFinite(Number(labelPlacementSnapshot?.angle)) ? Number(labelPlacementSnapshot?.angle) : 0;
        priceTagGroup.set({
            originX: labelPlacementSnapshot?.originX || 'center',
            originY: labelPlacementSnapshot?.originY || 'center',
            left: resolvedSplashLeft,
            top: resolvedSplashTop,
            angle: resolvedSplashAngle
        });
        normalizePriceGroupPlacementInCard(priceTagGroup, width, cardHeight, labelPlacementSnapshot || null);

        // Labels are born grouped: the whole priceGroup moves as one object until
        // the user explicitly enters element-edit mode from the contextual toolbar.
        setPriceGroupInteractionMode(priceTagGroup, 'move');

        const isRedBurstCard = isRedBurstPriceGroup(priceTagGroup);
        if (isRedBurstCard) {
            title.set({
                visible: false,
                selectable: false,
                evented: false
            });
        }
        const alcoholBadge = await productCardConfiguration.createProductAlcoholBadgeObject(
            effectiveStyles.cardLayout?.alcoholBadgeText,
            baseSize
        );
        const groupChildren: any[] = [
            bg,
            imgObj,
            title,
            ...(limitObj ? [limitObj] : []),
            priceTagGroup,
            ...(alcoholBadge ? [alcoholBadge] : [])
        ];

        // Main Product Card Group
        // NOTE: keep title above the image in stacking order (prevents it being hidden by tall images).
        const group = new fabric.Group(groupChildren, {
            left: x,
            top: y,
            name: 'product-card',
            originX: 'center',
            originY: 'center',
            isSmartObject: true,
            smartGridId: gridId,
            excludeFromExport: false,
            // Single-click deep select: user can click directly on inner elements.
            subTargetCheck: true,
            interactive: true
        });

        // Store card dimensions for containment checking (used by object:moving handler)
        (group as any)._cardWidth = width;
        (group as any)._cardHeight = cardHeight;

        // Persist ALL pricing metadata on the card so label templates can be reapplied safely.
        // This preserves ALL price information for future use.
        (group as any).price = (product as any).price ?? null;
        (group as any).pricePack = (product as any).pricePack ?? null;
        (group as any).priceUnit = (product as any).priceUnit ?? null;
        (group as any).priceSpecial = (product as any).priceSpecial ?? null;
        (group as any).priceSpecialUnit = (product as any).priceSpecialUnit ?? null;
        (group as any).specialCondition = getSpecialConditionFromProduct(product) ?? null;
        // Wholesale (legacy)
        (group as any).priceWholesale = (product as any).priceWholesale ?? null;
        (group as any).wholesaleTrigger = (product as any).wholesaleTrigger ?? null;
        (group as any).wholesaleTriggerUnit = (product as any).wholesaleTriggerUnit ?? null;
        // Pack metadata
        (group as any).packQuantity = (product as any).packQuantity ?? null;
        (group as any).packUnit = (product as any).packUnit ?? null;
        (group as any).packageLabel = (product as any).packageLabel ?? null;
        // Unit label
        // Guardar a decisão normalizada no card corrige também projetos antigos
        // que persistiram `unit: UN` como default mesmo com "Picanha kg".
        (group as any).unit = unitText || (product as any).unit || null;
        (group as any).unitLabel = unitText;
        (group as any).limit = limitTextValue ?? null;
        setCardLabelTemplateMetadata(group, usedLabelTemplateId || undefined, false);
        // Image reference (para re-importação e review)
        (group as any).imageUrl = resolveProductImageRef(product);
        // Store original product data for reference
        // Normaliza limitText a partir de limit (fluxo de importação inteligente) ou limitText (formato Product)
        (group as any)._productData = {
            ...product,
            limitText: product.limitText || product.limit || limitTextValue || ''
        };

        // A configuracao externa e a fonte de verdade do layout interno do card.
        // Aplicamos tambem na criacao para que um card novo ja nasca no mesmo lugar
        // que os cards existentes da zona, sem depender de um segundo refresh.
        productCardConfiguration.applyProductCardConfigurationLayout(group, width, cardHeight, effectiveStyles);

        // Internal elements should be selectable for manual adjustments
        group.getObjects().forEach((obj: any) => {
            const isBackground = obj.name === 'offerBackground';
            obj.set({
                selectable: !isBackground,
                evented: !isBackground,
                hasControls: !isBackground,
                hasBorders: !isBackground
            });
            enableCardElementRotationControl(obj, !isBackground);
        });

        // Add custom ID
        (group as any)._customId = makeCanvasObjectId();
        normalizeProductCardIdentity(group, {
            zoneInstanceId: String((product as any)?.zoneInstanceId || '').trim() || null,
            reason: 'create-smart-object'
        });

        // ESSENTIAL: Force group to calculate proper coordinates and cache
        group.setCoords();
        // Keep caching OFF for product cards to avoid occasional black-flash glitches.
        group.set({
            objectCaching: false,
            statefullCache: false,
            dirty: true,
            strokeWidth: 0 // Ensure no weird borders affect layout
        });

        return group;
    }

    const simulateSmartGrid = async (
        customData: any[] = [],
        config = { margin: 10, gap: 15, orphanBehavior: 'fill' },
        zone: any = null,
        opts: SmartGridRunOptions = {}
    ) => {
        if (!canvas.value || !fabric) {
            console.error('[simulateSmartGrid] Canvas or fabric not available!');
            return;
        }
        await ensureLabelTemplatesReady();
        const mode: 'replace' | 'append' = (opts?.mode === 'append' || opts?.mode === 'replace') ? opts.mode : 'replace';
        const requestedTplId = typeof opts?.labelTemplateId === 'string' && opts.labelTemplateId.trim().length ? opts.labelTemplateId.trim() : undefined;

        // 1. Identify Target Context (Zone vs Page) and Template
        // Use the passed zone if available, otherwise try to get from active selection
        let targetZone: any = zone;
        let templateObject: any = null;

        if (!targetZone) {
            const activeObj = canvas.value.getActiveObject();
            if (activeObj) {
                // Check for product zone using isLikelyProductZone to handle both isGridZone and isProductZone
                if (isLikelyProductZone(activeObj)) {
                    targetZone = activeObj;
                } else if (activeObj.type === 'group' && !requestedTplId) {
                    templateObject = activeObj;
                }
            }
        } else {
            // Validate that the passed zone is still a valid product zone
            if (!isLikelyProductZone(targetZone)) {
                console.warn('[simulateSmartGrid] Passed zone is not a valid product zone, ignoring');
                targetZone = null;
            }
        }

        if (targetZone) ensureZoneSanity(targetZone);

        // 2. Setup Bounds
        let bounds = {
            left: 0,
            top: 0,
            width: activePage.value?.width || 1080,
            height: activePage.value?.height || 1920
        };

        // When no zone is selected, try to use the first existing Frame as bounds
        // so products are placed INSIDE the visible frame area.
        if (!targetZone) {
            const existingFrame = canvas.value.getObjects().find((o: any) => !!o?.isFrame);
            if (existingFrame) {
                const fb = existingFrame.getBoundingRect(true);
                bounds = { left: fb.left, top: fb.top, width: fb.width, height: fb.height };
            }
        }

        if (targetZone) {
            // Always refresh coords before computing bounds to prevent stale state
            if (typeof targetZone.setCoords === 'function') targetZone.setCoords();
            // Prefer persisted zone metrics to avoid drift after reload/scaling.
            let boundingRect = getZoneMetrics(targetZone) ?? targetZone.getBoundingRect(true);
            const zoneCenterX = boundingRect.left + (boundingRect.width / 2);
            const zoneCenterY = boundingRect.top + (boundingRect.height / 2);

            if (targetZone.originX !== 'center' || targetZone.originY !== 'center') {
                targetZone.set({
                    originX: 'center',
                    originY: 'center',
                    left: zoneCenterX,
                    top: zoneCenterY
                });
                targetZone.setCoords();
                boundingRect = getZoneMetrics(targetZone) ?? targetZone.getBoundingRect(true);
            }

            bounds = {
                left: boundingRect.left,
                top: boundingRect.top,
                width: boundingRect.width,
                height: boundingRect.height
            };

        }

        // 3. Prepare Data
        let products = Array.isArray(customData) && customData.length > 0 ? customData : MOCK_PRODUCTS;
        const count = products.length;
        if (count === 0) {
            console.warn('[simulateSmartGrid] No products to render!');
            return;
        }

        const existingZoneCardsAtStart = targetZone
            ? (() => {
                try {
                    return getZoneChildren(targetZone);
                } catch {
                    return [] as any[];
                }
            })()
            : [];

        // When appending into a zone, compute the existing count to place new items after it.
        let existingCount = 0;
        if (targetZone && mode === 'append') {
            existingCount = existingZoneCardsAtStart.length;
        }
        const countForLayout = targetZone ? (existingCount + count) : count;
        if (targetZone && opts.autoLayout !== false) {
            const colorStyles = getZoneGlobalStyles(targetZone)
            if (!colorStyles.templateProductPalette && !colorStyles.productPalette && !colorStyles.cardColorMode && !getZoneStyleOverrides(targetZone).cardColor && !colorStyles.isProdBgTransparent && (!colorStyles.cardColor || /^#(?:fff|ffffff)$/i.test(colorStyles.cardColor))) {
                targetZone._zoneGlobalStyles = { ...colorStyles, cardColorMode: 'auto', highlightCardColor: findFlyerAccent(canvas.value?.getObjects() || []) || '#ffffff' }
            }
            await Promise.all([productZoneStructuresState.load(), productCardConfigurationState.load()])
            applyCurrentStructureRecipe(targetZone, countForLayout)
            if (productCardConfigurationState.isLoaded.value) {
                targetZone._zoneGlobalStyles = normalizeGlobalStyles({
                    ...getZoneGlobalStyles(targetZone),
                    cardLayout: normalizeProductCardConfiguration(productCardConfigurationState.configuration.value)
                })
            }
        }

        if (targetZone) {
            products = applyAutoOfferRuntimeLayout(
                targetZone,
                products,
                existingZoneCardsAtStart,
                bounds,
                mode,
                opts
            );
        }

        // 4. Grid Configuration
        const gap = config.gap || 15;
        const margin = config.margin || 20;
        const previewFormat = getCurrentProductZonePreviewFormat();
        const structureForCount = targetZone
            ? resolveProductZoneStructure(targetZone, countForLayout, previewFormat)
            : null;
        const padding = targetZone
            ? (structureForCount?.padding ?? (typeof targetZone._zonePadding === 'number' ? targetZone._zonePadding : (typeof targetZone.padding === 'number' ? targetZone.padding : margin)))
            : margin;
        const gapX = targetZone
            ? (structureForCount?.gapHorizontal ?? (typeof targetZone.gapHorizontal === 'number' ? targetZone.gapHorizontal : gap))
            : gap;
        const gapY = targetZone
            ? (structureForCount?.gapVertical ?? (typeof targetZone.gapVertical === 'number' ? targetZone.gapVertical : gap))
            : gap;
        const lastRowBehavior = structureForCount?.lastRowBehavior || targetZone?.lastRowBehavior || config.orphanBehavior || 'fill';

        // Determine Item Size
        let itemWidth = 200;
        let itemHeight = 300;
        let cols = 1; // Default
        let layoutRows = 1;

        if (targetZone) {
            const zoneConfig: ProductZone = {
                x: bounds.left,
                y: bounds.top,
                width: bounds.width,
                height: bounds.height,
                padding,
                gapHorizontal: gapX,
                gapVertical: gapY,
                columns: structureForCount?.columns ?? (typeof targetZone.columns === 'number' ? targetZone.columns : 0),
                rows: structureForCount?.rows ?? (typeof targetZone.rows === 'number' ? targetZone.rows : 0),
                layoutDirection: structureForCount?.layoutDirection ?? targetZone.layoutDirection ?? 'horizontal',
                cardAspectRatio: structureForCount?.cardAspectRatio ?? targetZone.cardAspectRatio ?? 'fill',
                lastRowBehavior: lastRowBehavior,
                verticalAlign: structureForCount?.verticalAlign ?? targetZone.verticalAlign ?? 'stretch'
            };

            const gridLayout = calculateGridLayout(zoneConfig, countForLayout, previewFormat);
            cols = gridLayout.cols;
            layoutRows = gridLayout.rows;
            itemWidth = gridLayout.itemWidth;
            itemHeight = gridLayout.itemHeight;
        } else if (templateObject) {
            itemWidth = templateObject.getScaledWidth();
            itemHeight = templateObject.getScaledHeight();

            if (!targetZone) {
                // If strictly replacing template on page, remove it
                canvas.value.remove(templateObject);
            }
        }

        // 5. Layout Calculation
        // Effective Width
        const effectiveWidth = bounds.width - (padding * 2);

        // Calculate Cols (Default Logic if not Zone)
        if (!targetZone) {
            const maxCols = Math.floor(effectiveWidth / (itemWidth + gap));
            cols = Math.max(1, Math.min(count, maxCols));
        }

        // Batch Generation ID
        const batchGridId = `grid_${makeId()}`;
        if (!targetZone) {
            layoutRows = Math.ceil(count / cols);
        }

        const totalRows = layoutRows;
        const lastRowItemCount = countForLayout % cols || cols;

        if (targetZone) {
            const configuredColumns = structureForCount?.columns ?? targetZone.columns;
            const configuredRows = structureForCount?.rows ?? targetZone.rows;
            const hasFixedColumns = typeof configuredColumns === 'number' && configuredColumns > 0;
            targetZone._zonePadding = padding;
            targetZone.set({
                padding: 0,
                gapHorizontal: gapX,
                gapVertical: gapY,
                lastRowBehavior: lastRowBehavior,
                columns: hasFixedColumns ? configuredColumns : 0,
                rows: typeof configuredRows === 'number' && configuredRows > 0 ? configuredRows : 0,
                layoutDirection: structureForCount?.layoutDirection ?? targetZone.layoutDirection ?? 'horizontal',
                cardAspectRatio: structureForCount?.cardAspectRatio ?? targetZone.cardAspectRatio ?? 'fill',
                verticalAlign: structureForCount?.verticalAlign ?? targetZone.verticalAlign ?? 'stretch',
                // Ensure both flags are set for consistency
                isGridZone: true,
                isProductZone: true
            });
        }

        isProcessing.value = true;
        ctx.setIsBulkProductMutation(true);

        try {
            // Allow import-time override of the label template.
            const prevZoneTplId = targetZone ? String((targetZone as any)._zoneGlobalStyles?.splashTemplateId || '').trim() : '';
            const prevZoneTplIdNormalized = prevZoneTplId.length ? prevZoneTplId : undefined;
            const snapshotId = targetZone ? String((targetZone as any)?._zoneTemplateSnapshotId || '').trim() : '';
            const snapshotGroup = targetZone ? (targetZone as any)?._zoneTemplateSnapshot : null;
            const snapshotIdNormalized = snapshotId.length ? snapshotId : undefined;
            // Resolve template id from explicit import choice, zone style, or stored snapshot id.
            // Runtime should prefer the live template record and only fallback to snapshot JSON.
            const zoneTplId = requestedTplId ?? prevZoneTplIdNormalized ?? snapshotIdNormalized;
            const snapshotAvailable = !!(snapshotGroup && typeof snapshotGroup === 'object');
            // Prefer the live template (latest Mini Editor state). Use zone snapshot only as fallback.
            const liveZoneTpl = zoneTplId ? labelTemplates.value.find((t: any) => t.id === zoneTplId) : undefined;
            const canUseSnapshotFallback = !isLabelTemplateLibraryAuthoritative.value &&
                snapshotAvailable && (!requestedTplId || !zoneTplId || zoneTplId === snapshotIdNormalized);
            const zoneTpl = liveZoneTpl
                ?? (canUseSnapshotFallback
                    ? ({
                        id: zoneTplId || snapshotIdNormalized || 'zone-template-snapshot',
                        name: 'Zone Template Snapshot',
                        kind: 'priceGroup-v1',
                        group: snapshotGroup
                    } as any as LabelTemplate)
                    : undefined);
            let effectiveZoneTpl = zoneTpl;
            const getDonorTemplateFromExistingCards = () => {
                const donorCard = existingZoneCardsAtStart.find((c: any) => !!getPriceGroupFromAny(c));
                const donorPg = donorCard ? getPriceGroupFromAny(donorCard) : null;
                if (donorPg) {
                    const donorGroupJson = serializePriceGroupForTemplate(donorPg);
                    if (donorGroupJson) {
                        const donorTpl = {
                            id: 'zone-card-snapshot',
                            name: 'Zone Card Snapshot',
                            kind: 'priceGroup-v1',
                            group: donorGroupJson
                        } as any as LabelTemplate;
                        // Keep zone snapshot aligned with what is effectively being rendered.
                        const zoneSnapshotId = zoneTplId || snapshotIdNormalized || String((targetZone as any)._zoneGlobalStyles?.splashTemplateId || '').trim() || 'zone-card-snapshot';
                        (targetZone as any)._zoneTemplateSnapshotId = zoneSnapshotId;
                        (targetZone as any)._zoneTemplateSnapshot = cloneTemplateGroupJson(donorGroupJson) || donorGroupJson;
                        return donorTpl;
                    }
                }
                return null;
            };

            if (
                !isLabelTemplateLibraryAuthoritative.value &&
                targetZone &&
                !requestedTplId &&
                existingZoneCardsAtStart.length > 0 &&
                !liveZoneTpl
            ) {
                // Prefer the live library template when the zone points to one. Donor card
                // snapshots are only a fallback for legacy/metadata-less zones; otherwise a
                // replace operation can resurrect the old label after Mini Editor saves.
                const donorTpl = getDonorTemplateFromExistingCards();
                if (donorTpl) effectiveZoneTpl = donorTpl;
            } else if (
                !isLabelTemplateLibraryAuthoritative.value &&
                !effectiveZoneTpl &&
                targetZone &&
                existingZoneCardsAtStart.length > 0
            ) {
                // Last-resort source of truth when zone metadata doesn't define a usable template.
                const donorTpl = getDonorTemplateFromExistingCards();
                if (donorTpl) effectiveZoneTpl = donorTpl;
            }

            // Persist override on the zone so future imports use the same template.
            if (targetZone && requestedTplId && requestedTplId !== prevZoneTplIdNormalized) {
                const prev = getZoneGlobalStyles(targetZone);
                (targetZone as any)._zoneGlobalStyles = { ...prev, splashTemplateId: requestedTplId };
                const requestedTpl = labelTemplates.value.find((t: any) => String(t?.id || '') === String(requestedTplId));
                (targetZone as any)._zoneTemplateSnapshotId = requestedTplId;
                (targetZone as any)._zoneTemplateSnapshot = cloneTemplateGroupJson((requestedTpl as any)?.group) || null;
            }

            // If the user picked a template while appending, keep the zone consistent (apply to existing cards too).
            if (targetZone && mode === 'append' && requestedTplId && requestedTplId !== prevZoneTplIdNormalized && existingCount > 0) {
                await applyLabelTemplateToZone(targetZone, requestedTplId, {
                    applyToExisting: true,
                    requestRender: false,
                    save: false,
                    cards: existingZoneCardsAtStart,
                    forceCardTemplate: true
                });
            }

            const zoneStylesForNewCards = targetZone
                ? getZoneGlobalStyles(targetZone)
                : normalizeGlobalStyles(productZoneState.globalStyles.value);
            const donorPriceGroupPlacements = targetZone && !requestedTplId
                ? existingZoneCardsAtStart.map((card: any) => getPriceGroupPlacementSnapshotFromCard(card))
                : [];
            const fallbackDonorPriceGroupPlacement =
                donorPriceGroupPlacements.find((snapshot: any) => !!snapshot) || null;

            const promises = products.map(async (product: any, index: number) => {
                const slotIndex = existingCount + index;
                const currentRow = Math.floor(slotIndex / cols);
                const currentCol = slotIndex % cols;

                // Base Position (Relative to bounds)
                // Calculate strictly based on itemWidth/Height to fill the Zone
                let xOffset = padding + (currentCol * (itemWidth + gapX));
                const yOffset = padding + (currentRow * (itemHeight + gapY));

                // Center only if requested; "fill" will be handled by the zone relayout pass.
                if (currentRow === totalRows - 1 && lastRowItemCount < cols && lastRowBehavior === 'center') {
                    const rowWidth = (lastRowItemCount * itemWidth) + ((lastRowItemCount - 1) * gapX);
                    const totalZoneWidth = effectiveWidth;
                    const centerStart = (totalZoneWidth - rowWidth) / 2;
                    xOffset = centerStart + (currentCol * (itemWidth + gapX)) + padding;
                }

                const finalX = bounds.left + xOffset + (itemWidth / 2);
                const finalY = bounds.top + yOffset + (itemHeight / 2);

                // Generate Object
                if (templateObject) {
                      // Clone using Promise API (Fabric v6+)
                     const cloned: any = await templateObject.clone(['name', 'id', 'smartGridId', 'isSmartObject', 'originX', 'originY']);

                      // CRITICAL FIX: Preserve nested object names after clone
                      // The clone operation loses names of children inside groups (like priceGroup)
                      const fixNestedNames = (clonedObj: any, sourceObj: any) => {
                          if (!clonedObj || !sourceObj) return;

                          // Fix direct children
                          if (typeof clonedObj.getObjects === 'function' && typeof sourceObj.getObjects === 'function') {
                              const clonedChildren = clonedObj.getObjects();
                              const sourceChildren = sourceObj.getObjects();

                              clonedChildren.forEach((child: any, idx: number) => {
                                  const sourceChild = sourceChildren[idx];
                                  if (sourceChild && sourceChild.name && !child.name) {
                                      child.set('name', sourceChild.name);
                                  }

                                  // Recursively fix nested groups (Fabric v7: type is 'Group' not 'group')
                                  if (String(child.type || '').toLowerCase() === 'group' && sourceChild && String(sourceChild.type || '').toLowerCase() === 'group') {
                                      fixNestedNames(child, sourceChild);
                                  }
                              });
                          }
                      };

                      fixNestedNames(cloned, templateObject);

                          cloned.set({
                             left: finalX,
                             top: finalY,
                             smartGridId: batchGridId,
                             opacity: 1,
                             visible: true,
                             originX: 'center',
                             originY: 'center',
                             // Product cards must support inner-element targeting (image/text) consistently.
                             subTargetCheck: true,
                             interactive: true
                          });
                      const clonedName = String((cloned as any)?.name || '').trim();
                      if (!clonedName || clonedName === 'priceGroup') {
                          cloned.set('name', 'product-card');
                      }

                          // Ensure internal elements are selectable (recursive for nested groups in templates).
                          const applyInteractivityRecursively = (node: any) => {
                              if (!node) return;
                              const t = String(node?.type || '').toLowerCase();
                              const n = String(node?.name || '');
                          const isBackground =
                              n === 'offerBackground' ||
                              n === 'price_bg' ||
                              n === 'label_bg_image' ||
                              n === 'price_bg_image' ||
                              n === 'splash_image';
                          if (t === 'group' && typeof node.getObjects === 'function') {
                              if (isPriceGroupObject(node)) {
                                  setPriceGroupInteractionMode(node, 'move');
                                  return;
                              }
                              node.set({
                                      subTargetCheck: true,
                                      interactive: true,
                                      selectable: true,
                                      evented: true
                                  });
                                  (node.getObjects() || []).forEach((child: any) => applyInteractivityRecursively(child));
                                  return;
                              }
                              node.set({
                                  selectable: !isBackground,
                                  evented: !isBackground,
                                  hasControls: !isBackground,
                                  hasBorders: !isBackground
                              });
                          };
                          applyInteractivityRecursively(cloned);

                         // Data Injection Logic
                          let titleFound = false;
                          let priceFound = false;
                          const { cleanedName, extractedLimit } = extractLimitFromName(product?.name);
                          const limitTextValue = normalizeLimitText(product?.limit ?? product?.limitText ?? extractedLimit);
                          let limitFound = false;
                          const objects = typeof cloned.getObjects === 'function' ? (cloned.getObjects() || []) : [];
                          const isTextNode = (node: any) => String(node?.type || '').toLowerCase().includes('text');

                          // Determinar preço principal (dinâmico - usa os preços disponíveis)
                          const availablePrices = getAvailablePrices(product);
                          const displayPrice = availablePrices.mainPrice;

                         objects.forEach((obj: any) => {
                            if (isTextNode(obj)) {
                                if (obj.name === 'smart_title') {
                                    obj.set('text', cleanedName);
                                    titleFound = true;
                                } else if (obj.name === 'smart_price') {
                                    obj.set('text', displayPrice);
                                priceFound = true;
                            } else if (
                                obj?.name === 'smart_limit' ||
                                obj?.name === 'limitText' ||
                                obj?.name === 'product_limit' ||
                                obj?.data?.smartType === 'product-limit'
                            ) {
                                obj.set('text', limitTextValue || '');
                                if (typeof obj.initDimensions === 'function') obj.initDimensions();
                                limitFound = true;
                            }
                        }
                     });

                     // Fallback
                     if (!titleFound || !priceFound) {
                         const texts = objects.filter((o: any) => isTextNode(o));
                         if (texts.length >= 1 && !titleFound) texts[0].set('text', cleanedName);
                         if (texts.length >= 2 && !priceFound) texts[1].set('text', displayPrice);
                     }

                     // FIX: Inject unit text into nested priceGroup (price_unit_text).
                     // The clone path only injects top-level texts (smart_title, smart_price, smart_limit)
                     // but misses the unit text inside priceGroup sub-groups.
                     const unitLabel = inferUnitLabelFromProduct(product);
                     const findPriceUnitInChildren = (node: any): any => {
                         if (!node) return null;
                         if (typeof node.getObjects !== 'function') return null;
                         for (const child of node.getObjects()) {
                             if (child.name === 'price_unit_text') return child;
                             const nested = findPriceUnitInChildren(child);
                             if (nested) return nested;
                         }
                         return null;
                     };
                     for (const obj of objects) {
                         if (String(obj?.type || '').toLowerCase() === 'group' && typeof obj.getObjects === 'function') {
                             const unitTxt = findPriceUnitInChildren(obj);
                             if (unitTxt) {
                                 const templateAllowsUnit = unitTxt.visible !== false && String(unitTxt.text || '').trim().length > 0;
                                 if (templateAllowsUnit && unitLabel) {
                                     unitTxt.set({ text: unitLabel, visible: true });
                                 } else {
                                     unitTxt.set({ text: '', visible: false });
                                 }
                                 if (typeof unitTxt.initDimensions === 'function') unitTxt.initDimensions();
                             }
                         }
                     }

                     // Injetar imagem do produto no clone do template
                     const productImgRef = resolveProductImageRef(product);
                     if (productImgRef) {
                         const existingImg = objects.find((o: any) => {
                             const t = String(o?.type || '').toLowerCase();
                             const n = String(o?.name || '').toLowerCase();
                             return t === 'image' && (n === 'smart_image' || n === 'product_image' || n === 'productimage' || !n);
                         });
                         if (existingImg) {
                             try {
                                 let imgUrl = productImgRef;
                                 if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/api/') && !imgUrl.startsWith('data:') && !imgUrl.startsWith('blob:')) {
                                     imgUrl = `/api/storage/p?key=${encodeURIComponent(imgUrl)}`;
                                 } else {
                                     imgUrl = toWasabiProxyUrl(imgUrl) || imgUrl;
                                 }
                                 const newImg = await fabric.Image.fromURL(imgUrl, { crossOrigin: 'anonymous' });
                                 if (newImg && newImg.width > 2 && newImg.height > 2) {
                                      await autoTrimFabricImageAsync(newImg, { preserveVisualPosition: true });
                                      markProductImageTrimmed(newImg);
                                      const existingDisplayW = Math.abs(Number(existingImg.getScaledWidth?.() || 0));
                                     const existingDisplayH = Math.abs(Number(existingImg.getScaledHeight?.() || 0));
                                     const fallbackSlotW = Math.max(itemWidth * 0.5, Number(existingImg.width || 0) || 0, existingDisplayW || 0);
                                     const fallbackSlotH = Math.max(itemHeight * 0.4, Number(existingImg.height || 0) || 0, existingDisplayH || 0);
                                     fitProductImageIntoSlot(newImg, {
                                         width: fallbackSlotW,
                                         height: fallbackSlotH,
                                         originX: existingImg.originX || 'center',
                                         originY: existingImg.originY || 'center',
                                         left: existingImg.left || 0,
                                         top: existingImg.top || 0,
                                         name: existingImg.name || 'smart_image'
                                     }, { maxScale: 3 });
                                     // Substituir a imagem antiga pela nova
                                     const imgIndex = objects.indexOf(existingImg);
                                     cloned.remove(existingImg);
                                     if (typeof cloned.insertAt === 'function' && imgIndex >= 0) {
                                         cloned.insertAt(newImg, imgIndex);
                                     } else {
                                         safeAddWithUpdate(cloned, newImg);
                                     }
                                 }
                             } catch (imgErr) {
                                 console.warn('[template-clone] Falha ao injetar imagem do produto:', imgErr);
                             }
                         }
                     }

                     // If template doesn't include a limit object but product has a limit, create one.
                     // Posicionamento provisorio (top ~12% da altura) eh substituido pelo
                     // resizeSmartObject logo abaixo, que ancora o limit no titulo do card.
                     if (!limitFound && limitTextValue) {
                         const cardW = cloned._cardWidth ?? cloned.width ?? itemWidth;
                         const cardH = cloned._cardHeight ?? cloned.height ?? itemHeight;
                         const baseSize = Math.min(cardW || itemWidth, cardH || itemHeight);
                         const limitMult = (typeof zoneStylesForNewCards?.limitSize === 'number' && zoneStylesForNewCards.limitSize > 0)
                             ? zoneStylesForNewCards.limitSize / 14
                             : 1;
                         const limitFontSize = Math.max(8, Math.min(baseSize * 0.12, baseSize * 0.045 * limitMult));
                         const limitObj = new fabric.Textbox(limitTextValue, {
                             fontSize: limitFontSize,
                             fontFamily: zoneStylesForNewCards?.limitFont || zoneStylesForNewCards?.prodNameFont || DEFAULT_EDITOR_FONT_FAMILY,
                             fontWeight: '900',
                             fill: zoneStylesForNewCards?.limitColor || '#ef4444',
                             textAlign: 'center',
                             originX: 'center',
                             originY: 'top',
                             left: 0,
                             top: -(cardH || itemHeight) / 2 + ((cardH || itemHeight) * 0.12),
                             width: (cardW || itemWidth) * 0.9,
                             name: 'smart_limit',
                             data: { smartType: 'product-limit' },
                             lockScalingY: true,
                             splitByGrapheme: false
                         });
                         if (typeof (limitObj as any).initDimensions === 'function') (limitObj as any).initDimensions();
                         safeAddWithUpdate(cloned, limitObj);
                     }

                     // Preserve the source product on template clones. Besides keeping
                     // pricing/image metadata available for later relayouts, this lets
                     // the external card configuration resolve the +18 badge correctly.
                     (cloned as any)._productData = {
                         ...product,
                         limitText: product?.limitText || product?.limit || limitTextValue || ''
                     };
                     (cloned as any).limit = limitTextValue || null;
                     (cloned as any).imageUrl = resolveProductImageRef(product);
                     const inheritedTemplateId = String((effectiveZoneTpl as any)?.id || '').trim();
                     if (inheritedTemplateId && labelTemplates.value.some((item: any) => String(item?.id || '').trim() === inheritedTemplateId)) {
                         setCardLabelTemplateMetadata(cloned, inheritedTemplateId, false);
                     }

                     // Keep template-cloned cards aligned with current zone styles.
                     // Without this pass, replacing products can resurrect stale template colors/borders.
                     if (targetZone) {
                         try {
                             resizeSmartObject(cloned, itemWidth, itemHeight, zoneStylesForNewCards);
                         } catch (styleErr) {
                             console.warn('[replace-products] Falha ao aplicar estilos da zona no card clonado:', styleErr);
                         }
                     }

                     cloned._customId = makeCanvasObjectId();
                     cloned.excludeFromExport = false;
                     return cloned;

                         } else {
                          const labelPlacementSnapshot =
                              (targetZone && !requestedTplId)
                                  ? (donorPriceGroupPlacements[index] || fallbackDonorPriceGroupPlacement)
                                  : null;
                          return await createSmartObject(
                              product,
                              finalX,
                              finalY,
                              itemWidth,
                              itemHeight,
                              batchGridId,
                              effectiveZoneTpl,
                              zoneStylesForNewCards,
                              labelPlacementSnapshot
                          );
                    }
                });

            const smartObjects = await Promise.all(promises);

            // If we have a target zone, update it in place
            if (targetZone && canvas.value) {
                const zoneFrameId = getResolvedZoneFrameId(targetZone);

                // Get existing objects from zone (like background rect, labels)
                const existingZoneObjects = targetZone.getObjects ? targetZone.getObjects() : [];
                const existingCards = (() => {
                    try {
                        return getZoneChildren(targetZone);
                    } catch {
                        return [];
                    }
                })();

                const zoneBounds = getZoneMetrics(targetZone) ?? targetZone.getBoundingRect(true);
                const zoneRect = existingZoneObjects.find((obj: any) => obj.type === 'rect' && obj.strokeDashArray);

                // Remove previous cards from the zone only when replacing.
                if (mode === 'replace') {
                    existingCards.forEach((card: any) => canvas.value.remove(card));
                }

                // IMPORTANT: For Fabric.js groups, internal object positions are relative to the GROUP CENTER
                // The zone has originX: 'center', originY: 'center', so we need to offset by half the zone dimensions
                const zoneWidth = Number((zoneBounds as any)?.width || zoneRect?.width || 400) || 400;
                const zoneHeight = Number((zoneBounds as any)?.height || zoneRect?.height || 600) || 600;

                // CRITICAL: Clear any clipPath from the zone to prevent rendering errors
                // Product zones should not have clipPath as cards are added separately to canvas
                if (targetZone && targetZone.clipPath) {
                    targetZone.clipPath = null;
                }

                // DON'T add to zone group - add directly to canvas to avoid coordinate issues
                // This is the Figma-like behavior where elements are independent
                let maxOrder = -1;
                if (mode === 'append' && existingCards.length > 0) {
                    existingCards.forEach((c: any) => {
                        const o = Number((c as any)._zoneOrder);
                        if (Number.isFinite(o)) maxOrder = Math.max(maxOrder, o);
                    });
                    if (maxOrder < 0) maxOrder = existingCards.length - 1;
                }
                smartObjects.forEach((obj: any, idx: number) => {
                    obj.isProductCard = true;
                    obj.parentZoneId = targetZone._customId;
                    obj.parentFrameId = zoneFrameId;
                    normalizeProductCardIdentity(obj, {
                        zoneInstanceId: String(targetZone._customId || '').trim() || null,
                        reason: 'smart-grid-bind-zone'
                    });
                    obj.excludeFromExport = false;
                    obj.clipPath = null;
                    delete obj._frameClipOwner;
                    // Fresh cards must not keep stale slot metadata from previous zones/operations.
                    (obj as any)._zoneSlot = undefined;
                    // Preserve stable ordering when adding to an existing zone.
                    if (mode === 'append') {
                        (obj as any)._zoneOrder = maxOrder + 1;
                        maxOrder += 1;
                    } else {
                        (obj as any)._zoneOrder = idx;
                    }
                    // Avoid rare black-flash rendering glitches on some browsers by disabling caching on cards.
                    obj.set?.({ objectCaching: false, statefullCache: false, dirty: true });
                    canvas.value.add(obj);
                });

                // Keep frames behind all content in one pass (faster than bringToFront per card).
                ensureFramesBelowContents();

                targetZone.set({
                    isProductZone: true,
                    isGridZone: true, // Ensure both flags are set for compatibility
                    subTargetCheck: false, // Disable sub-target since cards are separate
                    selectable: true,
                    evented: true,
                    name: 'productZoneContainer',
                    lockScalingFlip: true,
                    objectCaching: false,
                    statefullCache: false
                });

                // Store zone dimensions for reference
                (targetZone as any)._zoneWidth = zoneWidth;
                (targetZone as any)._zoneHeight = zoneHeight;

                targetZone.setCoords();

                // Force Layout Recalculation to ensure alignment (centering, gaps) is perfect
                // We pass smartObjects explicitly so it doesn't have to search
                try {
                    const cache = (mode === 'append') ? [...existingCards, ...smartObjects] : smartObjects;
                    syncZoneCardFrameBindings(targetZone, cache);
                    cache.forEach((card: any) => {
                        card.__forceCardRelayout = true;
                        card.__lastCardRelayoutSignature = null;
                        card.__lastCardRelayoutAt = 0;
                    });
                    // FIX: preserveStyles evita relayout completo de cards recém-criados,
                    // o que bagunçava as etiquetas (splashes/price groups) do template.
                    recalculateZoneLayout(targetZone, cache, {
                        save: false,
                        requestRender: false,
                        trustCachedChildren: true,
                        preserveStyles: true
                    });
                    syncZoneDerivedMetadata(targetZone);
                    // FIX: Restaurar cards que possam ter sido escondidos pelo viewport culling
                    // durante a criação. Sem isso, cards ficavam invisíveis até o usuário mexer
                    // no espaçamento da zona (que dispara o mesmo restore).
                    const zoneId = String((targetZone as any)?._customId || '').trim();
                    const allObjs = canvas.value.getObjects?.() || [];
                    const zoneRelatedObjs = allObjs.filter((o: any) => {
                        if (!o) return false;
                        const boundId = String((o as any)?.parentZoneId || '').trim();
                        const slotId = String((o as any)?._zoneSlot?.zoneId || '').trim();
                        return (zoneId && boundId === zoneId) || (zoneId && slotId === zoneId);
                    });
                    restoreViewportCulledObjects(zoneRelatedObjs);
                    for (const obj of zoneRelatedObjs) {
                        if (obj && obj !== targetZone && obj.visible === false && !(obj as any).__viewportCulled) {
                            obj.visible = true;
                            obj.dirty = true;
                        }
                    }
                } catch (calcErr) {
                    console.warn('Grid layout recalc error:', calcErr);
                }

                // SUBSTITUIR PRODUTOS deve MANTER a tipografia/estilos atuais da zona.
                // Os cards novos vem do template e, sob layout manual, a tipografia da
                // zona (fonte/peso/estilo/escala, marcadas como override no painel) NAO
                // e' reaplicada automaticamente — fazendo a etiqueta "perder a fonte/
                // tamanho" ao trocar produtos (o usuario tinha que mudar a fonte e voltar
                // para reaplicar). Reaplicamos aqui os estilos da zona aos cards
                // recem-criados, com o MESMO gate de override de applyLabelTemplateToZone.
                try {
                    const zoneStylesAfterReplace = getZoneGlobalStyles(targetZone);
                    const rawZoneStylesAfterReplace = (targetZone as any)?._zoneGlobalStyles || {};
                    const labelStyleReapplyProps = [
                        'splashColor', 'accentColor', 'splashFill', 'splashTextColor', 'priceTextColor',
                        'priceCurrencyColor', 'priceFont', 'priceFontWeight', 'priceFontStyle', 'currencySymbol',
                        'priceFontSize', 'splashTextScale', 'splashStrokeWidth', 'splashRoundness', 'splashScale', 'splashOffsetY'
                    ] as Array<keyof GlobalStyles>;
                    labelStyleReapplyProps.forEach((prop) => {
                        if (!shouldReapplyLabelStylePropAfterTemplateApply(prop, rawZoneStylesAfterReplace, zoneStylesAfterReplace, targetZone)) return;
                        applyGlobalStylesToCards(zoneStylesAfterReplace, targetZone, { cards: smartObjects, prop });
                    });
                    // Overrides POR CARD (editar so um card) tambem devem sobreviver a troca.
                    for (const card of smartObjects) {
                        const cardOv = getCardStyleOverrides(card);
                        const cardProps = Object.keys(cardOv);
                        if (!cardProps.length) continue;
                        const effForCard = getEffectiveStylesForCard(card, targetZone);
                        cardProps.forEach((prop) => applyGlobalStylesToCards(effForCard, targetZone, { cards: [card], prop }));
                    }
                } catch (typoErr) {
                    console.warn('[replace-products] Falha ao reaplicar estilos da zona nos cards:', typoErr);
                }

                // Select the first created object
                if (smartObjects.length > 0) {
                    canvas.value.setActiveObject(smartObjects[0]);
                }
            } else {
                // No zone - add directly to canvas and ensure they're above the Frame
                smartObjects.forEach((obj: any) => {
                    // Ensure cards are NOT parented to any Frame (prevents clipPath hiding them)
                    obj.clipPath = null;
                    obj.parentFrameId = undefined;
                    delete obj._frameClipOwner;
                    obj.visible = true;
                    obj.opacity = 1;
                    canvas.value.add(obj);
                });
                // Ensure frames stay behind all content (products on top, frame at back)
                ensureFramesBelowContents();

                // Select the first created object
                if (smartObjects.length > 0) {
                    canvas.value.setActiveObject(smartObjects[0]);
                }

            }

        } catch (err) {
            console.error("Grid Generation Failed:", err);
        } finally {
            ctx.setIsBulkProductMutation(false);
            isProcessing.value = false;
            refreshCanvasObjects();
            if (isQuickMode.value) invalidateQuickModeUi();
            invalidateScrollbarBounds();
            updateScrollbars();
            safeRequestRenderAll();
            if (opts?.persist !== false) {
                await saveCurrentState({
                    allowEmptyOverwrite: true,
                    reason: 'simulate-smart-grid',
                    source: 'user',
                    skipCoalesce: true,
                    skipIfUnchanged: false
                });
                await flushPersistenceNow('simulate-smart-grid', { force: true });
            }
        }
    }

    const applyGlobalStylePropToCardFast = (card: any, prop: string, styles: GlobalStyles): boolean => {
        if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') return false;
        const p = String(prop || '').trim();
        if (!p || !isLightweightGlobalStyleProp(p)) return false;

        const bg = getCardBackgroundRect(card);
        const title = getCardTitleText(card);
        const limit = getCardLimitText(card);
        const priceGroup = getPriceGroupFromAny(card);
        const cardBounds = typeof card.getBoundingRect === 'function' ? card.getBoundingRect(true) : null;
        const cardW = Number(card?._cardWidth ?? card?.width ?? card?.getScaledWidth?.() ?? cardBounds?.width ?? 0) || 0;
        const cardH = Number(card?._cardHeight ?? card?.height ?? card?.getScaledHeight?.() ?? cardBounds?.height ?? 0) || 0;
        let changed = false;

        if ((['cardColor', 'cardColorMode', 'highlightCardColor', 'isProdBgTransparent'].includes(p)) && bg && String(bg?.type || '').toLowerCase() === 'rect') {
            bg.set('fill', resolveProductCardColor(styles, card._cardHighlighted === true, getCardStyleOverrides(card)));
            syncProductNameColor(card, styles);
            changed = true;
        } else if (p === 'cardBorderRadius' && bg && String(bg?.type || '').toLowerCase() === 'rect') {
            const r = Number.isFinite(Number(styles.cardBorderRadius)) ? Number(styles.cardBorderRadius) : 0;
            bg.set({ rx: r, ry: r });
            changed = true;
        } else if (p === 'cardBorderColor' && bg && String(bg?.type || '').toLowerCase() === 'rect') {
            const borderWidth = Number.isFinite(Number(styles.cardBorderWidth)) ? Math.max(0, Number(styles.cardBorderWidth)) : 0;
            if (styles.cardBorderColor) {
                bg.set('stroke', borderWidth > 0 ? styles.cardBorderColor : undefined);
                bg.set('strokeWidth', borderWidth);
            } else {
                bg.set('stroke', undefined);
                bg.set('strokeWidth', 0);
            }
            changed = true;
        } else if (p === 'cardBorderWidth' && bg && String(bg?.type || '').toLowerCase() === 'rect') {
            const borderWidth = Math.max(0, Number(styles.cardBorderWidth ?? 0));
            if (styles.cardBorderColor && borderWidth > 0) {
                bg.set('stroke', styles.cardBorderColor);
                bg.set('strokeWidth', borderWidth);
            } else {
                bg.set('stroke', undefined);
                bg.set('strokeWidth', 0);
            }
            changed = true;
        } else if (
            (p === 'prodNameColor' || p === 'prodNameFont' || p === 'prodNameWeight' || p === 'prodNameAlign' || p === 'prodNameTransform' || p === 'prodNameLineHeight') &&
            title &&
            isTextLikeObject(title)
        ) {
            if (p === 'prodNameColor') card._cardStyleOverrides = { ...getCardStyleOverrides(card), prodNameColor: styles.prodNameColor };
            syncProductNameColor(card, styles);
            if (styles.prodNameFont) title.set('fontFamily', styles.prodNameFont);
            if (styles.prodNameWeight !== undefined) title.set('fontWeight', styles.prodNameWeight as any);
            if (styles.prodNameAlign) title.set('textAlign', styles.prodNameAlign);
            if (typeof styles.prodNameLineHeight === 'number') title.set('lineHeight', styles.prodNameLineHeight);

            const rawKey = '__rawText';
            const curText = String((title as any).text ?? '');
            if (typeof (title as any)[rawKey] !== 'string') (title as any)[rawKey] = curText;
            const mode = styles.prodNameTransform ?? 'none';
            if (mode === 'none') {
                (title as any)[rawKey] = curText;
            } else {
                const baseText = String((title as any)[rawKey] ?? curText);
                const nextText = mode === 'upper'
                    ? baseText.toUpperCase()
                    : mode === 'lower'
                        ? baseText.toLowerCase()
                        : baseText;
                if (nextText !== curText) title.set('text', nextText);
            }

            if (String(title.type || '').toLowerCase() === 'textbox' && cardW > 0) {
                const manualRatio = Number((title as any).__manualTextWidthRatio);
                const manualWidth = Number((title as any).__manualTextWidth);
                const hasManualWidth = !!(title as any).__manualTransform && (
                    (Number.isFinite(manualRatio) && manualRatio > 0) ||
                    (Number.isFinite(manualWidth) && manualWidth > 0)
                );
                if (!hasManualWidth) {
                    title.set({ width: Math.max(20, cardW * 0.9) });
                }
            }
            if (typeof title.initDimensions === 'function') title.initDimensions();
            changed = true;
        } else if ((p === 'limitColor' || p === 'limitFont') && limit && isTextLikeObject(limit)) {
            if (styles.limitColor) limit.set('fill', styles.limitColor);
            if (styles.limitFont) limit.set('fontFamily', styles.limitFont);
            if (typeof limit.initDimensions === 'function') limit.initDimensions();
            changed = true;
        } else if (
            (
                p === 'splashColor' ||
                p === 'accentColor' ||
                p === 'splashFill' ||
                p === 'priceTextColor' ||
                p === 'priceCurrencyColor' ||
                p === 'splashTextColor' ||
                p === 'priceFont' ||
                p === 'priceFontWeight' ||
                p === 'priceFontStyle' ||
                p === 'splashTextScale'
        ) &&
            priceGroup &&
            String(priceGroup?.type || '').toLowerCase() === 'group' &&
            typeof priceGroup.getObjects === 'function'
        ) {
            const preserveTemplateVisual = shouldPreserveManualTemplateVisual(priceGroup);
            const parts = collectObjectsDeep(priceGroup);
            // FIX: Buscar objetos de preço por nome exato OU variantes atacarejo.
            // Cards atacarejo usam nomes como atac_retail_bg, retail_currency_text, etc.
            const priceBg = parts.find((o: any) => {
                const n = String(o?.name || '');
                return n === 'price_bg' || n === 'atac_retail_bg' || n === 'atac_wholesale_bg';
            });
            const currencyText = parts.find((o: any) => {
                const n = String(o?.name || '');
                return n === 'price_currency_text' || n === 'retail_currency_text' || n === 'wholesale_currency_text';
            });
            const priceTexts = parts.filter((o: any) => {
                const n = String(o?.name || '');
                return ['price_integer_text', 'price_decimal_text', 'price_unit_text', 'price_value_text',
                        'retail_price_text', 'retail_integer_text', 'retail_decimal_text', 'retail_unit_text',
                        'wholesale_price_text', 'wholesale_integer_text', 'wholesale_decimal_text', 'wholesale_unit_text'].includes(n);
            });

            // FIX: Aplicar cor em TODOS os bgs de preço (atacarejo tem retail + wholesale)
            const allPriceBgs = parts.filter((o: any) => {
                const n = String(o?.name || '');
                return n === 'price_bg' || n === 'atac_retail_bg' || n === 'atac_wholesale_bg';
            });
            // Aplicar cores e estilos da etiqueta — fast-path é chamado apenas por ação explícita
            // do usuário (handleUpdateGlobalStyles), então SEMPRE deve aplicar.
            if ((p === 'splashColor' || p === 'accentColor') && allPriceBgs.length > 0) {
                const accent = styles.splashColor ?? styles.accentColor;
                if (accent) allPriceBgs.forEach((bg: any) => bg.set('stroke', accent));
                changed = true;
            }
            if (p === 'splashFill' && allPriceBgs.length > 0) {
                if (styles.splashFill) allPriceBgs.forEach((bg: any) => bg.set('fill', styles.splashFill));
                changed = true;
            }
            if (p === 'priceCurrencyColor') {
                const allCurrencyTexts = parts.filter((o: any) => {
                    const n = String(o?.name || '');
                    return (n === 'price_currency_text' || n === 'retail_currency_text' || n === 'wholesale_currency_text') && isTextLikeObject(o);
                });
                // CORRECAO: DEFAULT_GLOBAL_STYLES.priceCurrencyColor = undefined significa
                // "preservar cor original do template" (ex: preto no circulo amarelo do
                // red-burst). Se o user limpar a cor (undefined), restauramos __originalFill.
                // Antes o codigo caia em fallback para priceTextColor/splashTextColor
                // silenciosamente, sobrescrevendo o design.
                if (allCurrencyTexts.length > 0) {
                    if (styles.priceCurrencyColor) {
                        allCurrencyTexts.forEach((ct: any) => {
                            ct.set('fill', styles.priceCurrencyColor);
                            if (typeof ct.initDimensions === 'function') ct.initDimensions();
                        });
                        changed = true;
                    } else if (Object.prototype.hasOwnProperty.call(styles, 'priceCurrencyColor')) {
                        // User setou explicitamente como undefined/vazio — restaurar original
                        allCurrencyTexts.forEach((ct: any) => {
                            const orig = (ct as any).__originalFill;
                            if (orig) {
                                ct.set('fill', orig);
                                if (typeof ct.initDimensions === 'function') ct.initDimensions();
                            }
                        });
                        changed = true;
                    }
                }
            }
            if (p === 'priceTextColor' || p === 'splashTextColor') {
                const nextTextColor = styles.priceTextColor ?? styles.splashTextColor;
                if (nextTextColor) {
                    priceTexts.forEach((txt: any) => {
                        if (!isTextLikeObject(txt)) return;
                        if (isRichPriceTextObject(txt)) {
                            setRichPriceSegmentStyle(txt, 'integer', { fill: nextTextColor });
                            setRichPriceSegmentStyle(txt, 'decimal', { fill: nextTextColor });
                        }
                        txt.set('fill', nextTextColor);
                        if (typeof txt.initDimensions === 'function') txt.initDimensions();
                    });
                    changed = true;
                }
            }

            if (p === 'priceFont' || p === 'priceFontWeight' || p === 'priceFontStyle' || p === 'splashTextScale') {
                const allPriceTexts = [currencyText, ...priceTexts];
                allPriceTexts.forEach((txt: any) => {
                    if (!isTextLikeObject(txt)) return;
                    if (p === 'priceFont' && styles.priceFont) {
                        if (isRichPriceTextObject(txt)) {
                            setRichPriceSegmentStyle(txt, 'integer', { fontFamily: styles.priceFont });
                            setRichPriceSegmentStyle(txt, 'decimal', { fontFamily: styles.priceFont });
                        }
                        txt.set('fontFamily', styles.priceFont);
                    }
                    if (p === 'priceFontWeight' && styles.priceFontWeight !== undefined) {
                        if (isRichPriceTextObject(txt)) {
                            setRichPriceSegmentStyle(txt, 'integer', { fontWeight: styles.priceFontWeight });
                            setRichPriceSegmentStyle(txt, 'decimal', { fontWeight: styles.priceFontWeight });
                        }
                        txt.set('fontWeight', styles.priceFontWeight as any);
                    }
                    if (p === 'priceFontStyle') {
                        if (isRichPriceTextObject(txt)) {
                            const fontStyle = styles.priceFontStyle === 'italic' ? 'italic' : 'normal';
                            setRichPriceSegmentStyle(txt, 'integer', { fontStyle });
                            setRichPriceSegmentStyle(txt, 'decimal', { fontStyle });
                        }
                        txt.set('fontStyle', styles.priceFontStyle === 'italic' ? 'italic' : 'normal');
                    }

                    const mult = typeof styles.splashTextScale === 'number' ? styles.splashTextScale : 1;
                    if (isRichPriceTextObject(txt)) {
                        const currentBase = Number((txt as any).__fontSizeBase || txt.fontSize || 0);
                        if (currentBase > 0) {
                            (txt as any).__fontSizeBase = currentBase;
                            setRichPriceBaseFontSize(txt, currentBase * mult);
                        }
                    } else if (preserveTemplateVisual) {
                        const originalFont = Number((txt as any).__originalFontSize);
                        const currentFont = Number(txt.fontSize || 0);
                        const baseFont = Number((txt as any).__fontSizeBase);
                        const fallbackBase = Number.isFinite(originalFont) && originalFont > 0
                            ? originalFont
                            : (Number.isFinite(currentFont) && currentFont > 0 ? currentFont : 0);
                        const sourceBase = Number.isFinite(baseFont) && baseFont > 0 ? baseFont : fallbackBase;
                        if (sourceBase > 0) {
                            (txt as any).__fontSizeBase = sourceBase;
                            txt.set({
                                fontSize: sourceBase * mult,
                                scaleX: 1,
                                scaleY: 1
                            });
                        }
                    } else if (typeof txt.__fontScale === 'number') {
                        if (typeof txt.__fontScaleBase !== 'number') txt.__fontScaleBase = txt.__fontScale;
                        txt.__fontScale = txt.__fontScaleBase * mult;
                    } else {
                        const currentFont = Number(txt.fontSize || 0);
                        const baseFont = Number((txt as any).__fontSizeBase);
                        const sourceBase = Number.isFinite(baseFont) && baseFont > 0
                            ? baseFont
                            : (Number.isFinite(currentFont) && currentFont > 0 ? currentFont : 0);
                        if (sourceBase > 0) {
                            (txt as any).__fontSizeBase = sourceBase;
                            txt.set({
                                fontSize: sourceBase * mult,
                                scaleX: 1,
                                scaleY: 1
                            });
                        }
                    }
                    if (typeof txt.initDimensions === 'function') txt.initDimensions();
                });

                // Propagar splashTextScale como metadado para as funções de layout.
                (priceGroup as any).__splashTextScale = typeof styles.splashTextScale === 'number' ? styles.splashTextScale : 1;

                if (preserveTemplateVisual) {
                    refreshManualTemplateAfterTypographyChange(priceGroup);
                }

                if (cardW > 0 && cardH > 0) {
                    layoutPriceGroup(priceGroup, cardW, cardH);
                }
                changed = true;
            }
        }

        // ── Fast-apply: splashScale / splashOffsetY ──
        // Reposiciona o priceGroup dentro do card SEM tocar em título, imagem ou background.
        if ((p === 'splashScale' || p === 'splashOffsetY') && priceGroup && cardW > 0 && cardH > 0) {
            const halfH = cardH / 2;
            // Usar dimensões de referência da zona se disponíveis, senão usar dimensões do card
            // Isso garante que splashScale seja proporcional ao tamanho padrão do slot, não ao card individual
            const _refH = Number((styles as any)?.__refCellH) || cardH;
            const _refW = Number((styles as any)?.__refCellW) || cardW;
            const marginBottom = cardH * 0.05;
            // Ajustes internos da etiqueta usam __manualTransform, mas não devem
            // bloquear a posição/tamanho definidos no perfil de Cards. Só um
            // movimento explícito do priceGroup inteiro fixa a âncora externa.
            const splashManual = (priceGroup as any).__manualPricePosition === true;
            const preserveTV = shouldPreserveManualTemplateVisual(priceGroup);

            // Propagar splashTextScale como metadado (garante que layoutPriceGroup o leia).
            (priceGroup as any).__splashTextScale = typeof styles.splashTextScale === 'number' ? styles.splashTextScale : 1;

            // Guardar scaleX/Y de base ANTES do layoutPriceGroup (que reseta para fitScale).
            // Para manual templates: é o fitScale * splashScale anterior.
            // Precisamos descontar o splashScale anterior para obter o fitScale puro.
            const prevScaleX = Math.abs(Number(priceGroup.scaleX)) || 1;
            const prevScaleY = Math.abs(Number(priceGroup.scaleY)) || 1;

            const layout = layoutPriceGroup(priceGroup, Math.min(cardW, _refW), Math.min(cardH, _refH));

            const rawScale = typeof styles.splashScale === 'number' ? styles.splashScale : 1;
            const rawOffsetY = typeof styles.splashOffsetY === 'number' ? styles.splashOffsetY : 0;
            const scale = rawScale;
            const offsetY = rawOffsetY * (cardH / _refH);

            priceGroup.dirty = true;

            if (layout) {
                const { pillH } = layout;
                // Após layoutPriceGroup, scaleX/Y é o fitScale (para manual) ou 1 (para standard).
                const fitScaleX = Math.abs(Number(priceGroup.scaleX)) || 1;
                const fitScaleY = Math.abs(Number(priceGroup.scaleY)) || 1;

                if (!splashManual) {
                    const newTop = halfH - ((pillH * scale) / 2) - marginBottom + offsetY;
                    // Standard: fitScale já definiu a geometria interna, aplicar zone-scale por cima.
                    const finalScaleX = preserveTV ? (fitScaleX * scale) : scale;
                    const finalScaleY = preserveTV ? (fitScaleY * scale) : scale;
                    if (preserveTV) {
                        (priceGroup as any).__originalScaleX = fitScaleX;
                        (priceGroup as any).__originalScaleY = fitScaleY;
                    }
                    priceGroup.set({
                        scaleX: finalScaleX,
                        scaleY: finalScaleY,
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: newTop
                    });
                } else {
                    const finalScaleX = preserveTV ? (fitScaleX * scale) : scale;
                    const finalScaleY = preserveTV ? (fitScaleY * scale) : scale;
                    priceGroup.set({ scaleX: finalScaleX, scaleY: finalScaleY });
                }

                normalizePriceGroupPlacementInCard(priceGroup, cardW, cardH, null);
            } else {
                // Fallback: layoutPriceGroup retornou null (splash genérico sem partes nomeadas).
                // Replicar Path B do resizeSmartObject.
                const SPLASH_REF_WIDTH = 300;
                const sizeRatio = Math.max(0.3, Math.min(3, cardW / SPLASH_REF_WIDTH));
                const sScaleX = sizeRatio * scale;
                const sScaleY = sizeRatio * scale;

                if (!splashManual) {
                    const newTop = halfH - marginBottom + offsetY;
                    priceGroup.set({
                        scaleX: sScaleX,
                        scaleY: sScaleY,
                        originX: 'center',
                        originY: 'bottom',
                        left: 0,
                        top: newTop
                    });
                } else {
                    priceGroup.set({ scaleX: sScaleX, scaleY: sScaleY });
                }
            }

            priceGroup.setCoords();
            changed = true;
        }

        // ── Fast-apply: splashRoundness ──
        // Atualiza apenas o arredondamento do price_bg SEM tocar em outros elementos.
        // IMPORTANTE: respeita templates manuais que ja tem __originalRx/__originalRy.
        if (p === 'splashRoundness' && priceGroup && typeof styles.splashRoundness === 'number') {
            if (!shouldPreserveManualTemplateVisual(priceGroup)) {
                const parts = collectObjectsDeep(priceGroup);
                const priceBg = parts.find((o: any) => {
                    const n = String(o?.name || '');
                    return n === 'price_bg' || n === 'atac_retail_bg' || n === 'atac_wholesale_bg';
                });
                if (priceBg && String(priceBg?.type || '').toLowerCase() === 'rect') {
                    const clampVal = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
                    const roundness = clampVal(styles.splashRoundness, 0, 1);
                    (priceBg as any).__roundness = roundness;
                    const hRaw = Number(priceBg.height || 0);
                    if (Number.isFinite(hRaw) && hRaw > 0) {
                        const radius = (hRaw / 2) * roundness;
                        priceBg.set({ rx: radius, ry: radius });
                    }
                    priceBg.dirty = true;
                    changed = true;
                }
            }
        }

        // ── Fast-apply: currencySymbol ──
        // Altera o texto do símbolo monetário (ex: "R$") na etiqueta de preço.
        if (p === 'currencySymbol' && priceGroup && styles.currencySymbol !== undefined) {
            const parts = collectObjectsDeep(priceGroup);
            const allCurrencyTexts = parts.filter((o: any) => {
                const n = String(o?.name || '');
                return (n === 'price_currency_text' || n === 'retail_currency_text' || n === 'wholesale_currency_text') && isTextLikeObject(o);
            });
            if (allCurrencyTexts.length > 0) {
                allCurrencyTexts.forEach((ct: any) => {
                    ct.set('text', String(styles.currencySymbol));
                    if (typeof ct.initDimensions === 'function') ct.initDimensions();
                });
                changed = true;
            }
        }

        // ── Fast-apply: priceFontSize ──
        // Altera o tamanho base da fonte do preço (inteiro recebe tamanho cheio, decimal ~60%).
        if (p === 'priceFontSize' && priceGroup && typeof styles.priceFontSize === 'number' && styles.priceFontSize > 0) {
            const parts = collectObjectsDeep(priceGroup);
            const integerTexts = parts.filter((o: any) => {
                const n = String(o?.name || '');
                return (n === 'price_integer_text' || n === 'retail_integer_text' || n === 'wholesale_integer_text') && isTextLikeObject(o);
            });
            const decimalTexts = parts.filter((o: any) => {
                const n = String(o?.name || '');
                return (n === 'price_decimal_text' || n === 'retail_decimal_text' || n === 'wholesale_decimal_text') && isTextLikeObject(o);
            });
            const richTexts = parts.filter((o: any) => isRichPriceTextObject(o));
            const baseFontSize = styles.priceFontSize;
            (priceGroup as any).__priceFontSizeOverride = baseFontSize;
            richTexts.forEach((txt: any) => {
                setRichPriceBaseFontSize(txt, baseFontSize);
                setRichPriceSegmentStyle(txt, 'integer', { fontSize: baseFontSize });
                setRichPriceSegmentStyle(txt, 'decimal', { fontSize: Math.round(baseFontSize * 0.6) });
            });
            integerTexts.forEach((txt: any) => {
                txt.set('fontSize', baseFontSize);
                if (typeof txt.initDimensions === 'function') txt.initDimensions();
            });
            decimalTexts.forEach((txt: any) => {
                txt.set('fontSize', Math.round(baseFontSize * 0.6));
                if (typeof txt.initDimensions === 'function') txt.initDimensions();
            });
            if (cardW > 0 && cardH > 0) {
                layoutPriceGroup(priceGroup, cardW, cardH);
            }
            changed = true;
        }

        // ── Fast-apply: splashStrokeWidth ──
        // Altera a largura da borda/stroke do fundo da etiqueta de preço (price_bg).
        // IMPORTANTE: respeita templates manuais (__originalStrokeWidth).
        if (p === 'splashStrokeWidth' && priceGroup && typeof styles.splashStrokeWidth === 'number') {
            if (!shouldPreserveManualTemplateVisual(priceGroup)) {
                const parts = collectObjectsDeep(priceGroup);
                const allPriceBgs = parts.filter((o: any) => {
                    const n = String(o?.name || '');
                    return n === 'price_bg' || n === 'atac_retail_bg' || n === 'atac_wholesale_bg';
                });
                if (allPriceBgs.length > 0) {
                    const strokeVal = Math.max(0, styles.splashStrokeWidth);
                    allPriceBgs.forEach((bg: any) => {
                        bg.set('strokeWidth', strokeVal);
                        (bg as any).__strokeWidth = strokeVal;
                        bg.dirty = true;
                    });
                    changed = true;
                }
            }
        }

        // ── Fast-apply: prodNameScale ──
        // Recalcula fontSize do título SEM reposicionar splash ou imagem.
        if (p === 'prodNameScale' && title && isTextLikeObject(title)) {
            fitResponsiveProductName(title, cardW, cardH, styles.prodNameScale ?? 1);
            changed = true;
        }

        // ── Fast-apply: prodNameOffsetY ──
        // Move o título verticalmente SEM tocar em splash ou imagem.
        if (p === 'prodNameOffsetY' && title && isTextLikeObject(title) && !(title as any).__manualTransform) {
            const halfH = cardH / 2;
            const _refH = Number((styles as any)?.__refCellH) || cardH;
            const marginTop = cardH * 0.05;
            const rawOffY = typeof styles.prodNameOffsetY === 'number' ? styles.prodNameOffsetY : 0;
            const titleOffsetY = rawOffY * (cardH / _refH);
            title.set({
                originX: 'center',
                originY: 'top',
                left: 0,
                top: -halfH + marginTop + titleOffsetY
            });
            title.dirty = true;
            changed = true;
        }

        return changed;
    };

    const applyGlobalStylesToCards = (styles: Partial<GlobalStyles>, zone?: any, opts: { prop?: string; cards?: any[] } = {}) => {
        const summary = { cardsTouched: 0, fastApplied: 0, fullRelayout: 0 };
        if (!canvas.value) {
            console.warn('⚠️ [applyGlobalStylesToCards] No canvas!');
            return summary;
        }
        const effectiveStyles = normalizeGlobalStyles(styles);
        let canvasObjectsCache: any[] | null = null;
        const getCanvasObjects = (): any[] => {
            if (!canvasObjectsCache) canvasObjectsCache = canvas.value?.getObjects?.() || [];
            return canvasObjectsCache || [];
        };
        const isCardCandidate = (o: any) => {
            if (!o || o.type !== 'group') return false;
            if ((o as any).excludeFromExport) return false;
            if ((o as any).isFrame) return false;
            if (isLikelyProductZone(o)) return false;
            if (String(o.name || '') === 'priceGroup') return false;
            return !!(
                o.isSmartObject ||
                o.isProductCard ||
                isLikelyProductCard(o) ||
                String((o as any).parentZoneId || '').trim().length ||
                String((o as any).smartGridId || '').trim().length ||
                (Number.isFinite((o as any)._cardWidth) && Number((o as any)._cardWidth) > 0) ||
                (Number.isFinite((o as any)._cardHeight) && Number((o as any)._cardHeight) > 0)
            );
        };

        // Product cards are top-level canvas objects by design. Avoid deep traversal to prevent
        // false positives on nested groups (e.g., priceGroup inside cards).
        let allCardsCache: any[] | null = null;
        const getAllCards = (): any[] => {
            if (!allCardsCache) allCardsCache = getCanvasObjects().filter((o: any) => isCardCandidate(o));
            return allCardsCache || [];
        };
        const dedupeCards = (arr: any[]) => {
            const map = new Map<any, any>();
            arr.forEach((c: any) => {
                const key = c?._customId ?? c?.id ?? c;
                map.set(key, c);
            });
            return Array.from(map.values());
        };
        const suppliedCards = Array.isArray(opts?.cards) ? dedupeCards(opts.cards.filter(Boolean)) : [];
        const hasStrongCardSignature = (o: any) => {
            if (!o || o.type !== 'group' || typeof o.getObjects !== 'function') return false;
            const cw = Number((o as any)?._cardWidth);
            const ch = Number((o as any)?._cardHeight);
            if (Number.isFinite(cw) && cw > 0 && Number.isFinite(ch) && ch > 0) return true;

            const children = o.getObjects() || [];
            if (!Array.isArray(children) || children.length === 0) return false;

            const hasOfferBg = children.some((c: any) => String(c?.name || '') === 'offerBackground');
            if (hasOfferBg) return true;

            const hasPriceGroup = children.some((c: any) => String(c?.type || '').toLowerCase() === 'group' && String(c?.name || '') === 'priceGroup');
            const hasImage = children.some((c: any) => String(c?.type || '').toLowerCase() === 'image');
            return hasPriceGroup && hasImage;
        };

        let list: any[] = suppliedCards.length > 0 ? suppliedCards : [];
        const zoneWarnKey = String((zone as any)?._customId || '').trim() || 'unknown-zone';
        const resolveCardsForZone = (zoneObj: any, pool: any[]) => {
            const zid = String((zoneObj as any)?._customId || '').trim();
            const zBounds = getZoneMetrics(zoneObj) ?? zoneObj.getBoundingRect(true);
            const zMargin = (() => {
                const pad = typeof (zoneObj as any)._zonePadding === 'number' ? (zoneObj as any)._zonePadding : 20;
                const base = Math.min(zBounds.width || 0, zBounds.height || 0);
                return Math.max(80, Math.min(260, pad + base * 0.14));
            })();

            const fromBinding = zid
                ? pool.filter((c: any) => String((c as any)?.parentZoneId || '').trim() === zid)
                : [];
            const fromSlot = zid
                ? pool.filter((c: any) => String((c as any)?._zoneSlot?.zoneId || '').trim() === zid)
                : [];
            const fromHeuristic = getZoneChildren(zoneObj);
            const fromIntersection = pool.filter((c: any) => {
                const center = typeof c.getCenterPoint === 'function'
                    ? c.getCenterPoint()
                    : { x: Number(c.left || 0), y: Number(c.top || 0) };
                const nearInside =
                    center.x >= (zBounds.left - zMargin) &&
                    center.x <= (zBounds.left + zBounds.width + zMargin) &&
                    center.y >= (zBounds.top - zMargin) &&
                    center.y <= (zBounds.top + zBounds.height + zMargin);
                if (nearInside) return true;
                try {
                    return typeof zoneObj.intersectsWithObject === 'function' && zoneObj.intersectsWithObject(c);
                } catch {
                    return false;
                }
            });

            return dedupeCards([...fromBinding, ...fromSlot, ...fromHeuristic, ...fromIntersection]);
        };
        if (!suppliedCards.length && zone && isLikelyProductZone(zone)) {
            const runtimeIndex = ensureZoneRuntimeIndex();
            list = runtimeIndex && !runtimeIndex.hasLegacyCandidates
                ? getZoneChildren(zone)
                : resolveCardsForZone(zone, getAllCards());

            // Multi-zone safety: never bleed a zone style into every card.
            if (!list.length) {
                const zones = getRuntimeProductZones();
                const allCards = getAllCards();
                if (!allCards.length) {
                    // Normal state: zone exists but still has no cards.
                    if (import.meta.dev) {
                        console.debug('[applyGlobalStylesToCards] Zone has no cards yet; skipping style apply');
                    }
                    return summary;
                }

                // Binding metadata can be stale after undo/reload; try one repair pass first.
                try {
                    repairLooseZoneCardBindings();
                } catch {
                    // keep safe fallback below
                }
                const refreshedObjects = canvas.value.getObjects();
                const refreshedCards = refreshedObjects.filter((o: any) => isCardCandidate(o));
                list = resolveCardsForZone(zone, refreshedCards.length ? refreshedCards : allCards);

                if (!list.length) {
                    const zid = String((zone as any)?._customId || '').trim();
                    const zBounds = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
                    const emergencyUnbound = refreshedObjects.filter((o: any) => {
                        if (!o || o.type !== 'group' || typeof o.getObjects !== 'function') return false;
                        if ((o as any).excludeFromExport || (o as any).isFrame || isLikelyProductZone(o)) return false;
                        if (isStandalonePriceGroup(o)) return false;
                        if (!hasStrongCardSignature(o)) return false;

                        const boundId = String((o as any)?.parentZoneId || '').trim();
                        const slotZoneId = String((o as any)?._zoneSlot?.zoneId || '').trim();
                        if ((boundId && boundId !== zid) || (slotZoneId && slotZoneId !== zid)) return false;
                        if (boundId || slotZoneId) return false;

                        const center = typeof o.getCenterPoint === 'function'
                            ? o.getCenterPoint()
                            : { x: Number(o.left || 0), y: Number(o.top || 0) };

                        return (
                            center.x >= zBounds.left &&
                            center.x <= (zBounds.left + zBounds.width) &&
                            center.y >= zBounds.top &&
                            center.y <= (zBounds.top + zBounds.height)
                        );
                    });

                    if (emergencyUnbound.length > 0) {
                        const zoneFrameId = getResolvedZoneFrameId(zone);
                        emergencyUnbound.forEach((card: any) => {
                            if (zid && !String((card as any)?.parentZoneId || '').trim()) {
                                (card as any).parentZoneId = zid;
                            }
                            applyCardFrameBinding(card, zoneFrameId);
                        });
                        list = dedupeCards(emergencyUnbound);
                    }
                }

                if (!list.length) {
                    // If the target zone is truly empty, skipping style-apply is expected behavior.
                    // Persisted zone styles still remain for future cards.
                    const hasZoneBoundCards = (() => {
                        const zid = String((zone as any)?._customId || '').trim();
                        if (!zid) return false;
                        const inZone = refreshedObjects.some((o: any) => {
                            if (!o || o.type !== 'group' || typeof o.getObjects !== 'function') return false;
                            if ((o as any).excludeFromExport || (o as any).isFrame || isLikelyProductZone(o)) return false;
                            if (isStandalonePriceGroup(o)) return false;

                            const boundId = String((o as any)?.parentZoneId || '').trim();
                            const slotZoneId = String((o as any)?._zoneSlot?.zoneId || '').trim();
                            return boundId === zid || slotZoneId === zid;
                        });
                        return inZone;
                    })();

                    if (!hasZoneBoundCards) {
                        const warnedMap = ((applyGlobalStylesToCards as any).__warnedZones ||= new Set<string>());
                        warnedMap.delete(zoneWarnKey);
                        if (import.meta.dev) {
                            console.debug('[applyGlobalStylesToCards] Zone has no bound cards; skipping style apply');
                        }
                        return summary;
                    }

                    if (zones.length <= 1) {
                        // Single-zone: ainda assim filtra cards que explicitamente pertencam a OUTRA
                        // zona (parentZoneId diferente do zid atual). Evita vazamento quando
                        // alguma zona "fantasma" nao foi detectada por isLikelyProductZone.
                        console.warn('⚠️ [applyGlobalStylesToCards] No cards resolved for single zone; fallback to all cards');
                        const currentZid = String((zone as any)?._customId || '').trim();
                        list = currentZid
                            ? allCards.filter((c: any) => {
                                const cardZid = String((c as any)?.parentZoneId || '').trim();
                                return !cardZid || cardZid === currentZid;
                            })
                            : allCards;
                    } else {
                        const warnedMap = ((applyGlobalStylesToCards as any).__warnedZones ||= new Set<string>());
                        if (!warnedMap.has(zoneWarnKey)) {
                            warnedMap.add(zoneWarnKey);
                            console.warn('⚠️ [applyGlobalStylesToCards] No cards resolved for zone; aborting global-style apply to avoid cross-zone pollution');
                        }
                        return summary;
                    }
                } else {
                    const warnedMap = ((applyGlobalStylesToCards as any).__warnedZones ||= new Set<string>());
                    warnedMap.delete(zoneWarnKey);
                }
            }
        } else if (!suppliedCards.length) {
            list = getAllCards();
        }

        const fastProp = String(opts?.prop || '').trim();
        const allowFastPath = !!fastProp && isLightweightGlobalStyleProp(fastProp);

        list.forEach((card: any, idx: number) => {
            try {
            if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') {
                return;
            }
            // CRITICAL: Recursively mark ALL children dirty and disable objectCaching.
            // After loadFromJSON, objectCaching defaults to true on cards/nested groups,
            // which can prevent visual updates from appearing until the cache is invalidated.
            const markDirtyRecursive = (obj: any) => {
                if (!obj) return;
                obj.dirty = true;
                if (obj.objectCaching) obj.objectCaching = false;
                if (obj.statefullCache) obj.statefullCache = false;
                if (typeof obj.getObjects === 'function') {
                    (obj.getObjects() || []).forEach((child: any) => markDirtyRecursive(child));
                }
            };

            if (allowFastPath && applyGlobalStylePropToCardFast(card, fastProp, effectiveStyles)) {
                summary.cardsTouched += 1;
                summary.fastApplied += 1;
                markDirtyRecursive(card);
                card.setCoords();
                return;
            }

            // FIX CRÍTICO: Se a prop é lightweight (cor, fonte, etc.) e o fast path falhou,
            // NÃO fazer full resizeSmartObject — isso reposiciona TODOS os elementos internos
            // e destrói o layout do card. Apenas marcar como dirty para atualizar visualmente.
            if (allowFastPath && fastProp) {
                // O fast path já tentou e falhou, mas é uma prop que não precisa de relayout.
                // Apenas atualizar dirty flags e pular.
                markDirtyRecursive(card);
                card.setCoords();
                summary.cardsTouched += 1;
                return;
            }

            // Para props que NÃO são lightweight (ex: template change), forçar relayout completo.
            if (fastProp) {
                (card as any).__forceCardRelayout = true;
            }

            const cardBounds = typeof card.getBoundingRect === 'function' ? card.getBoundingRect(true) : null;
            const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? cardBounds?.width ?? 0;
            const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? cardBounds?.height ?? 0;
            if (cardW && cardH) {
                resizeSmartObject(card, cardW, cardH, effectiveStyles);
            } else {
                // Final fallback prevents dead cards after corrupted reload states.
                resizeSmartObject(card, 180, 260, effectiveStyles);
            }
            summary.cardsTouched += 1;
            summary.fullRelayout += 1;
            // Do NOT call safeAddWithUpdate — resizeSmartObject already freezes dimensions.
            markDirtyRecursive(card);
            card.setCoords();
            } catch (err) {
                console.warn(`⚠️ [applyGlobalStylesToCards] Failed on card ${idx}`, err);
            }
        });
        return summary;
    };

    async function applyLabelTemplateToCard(card: any, templateId: string) {
        if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') return;
        const zoneId = String((card as any)?.parentZoneId || (card as any)?._zoneSlot?.zoneId || '').trim();
        const zone = zoneId ? findProductZoneById(zoneId) : null;
        const snapshotTemplateId = String((zone as any)?._zoneTemplateSnapshotId || '').trim();
        const snapshotGroup = zone ? (zone as any)?._zoneTemplateSnapshot : null;

        // Prefer the current library template. Zone snapshots are immutable fallbacks for
        // reload/race conditions; using them first makes Mini Editor updates look stale.
        let tpl: LabelTemplate | undefined = labelTemplates.value.find((t: any) => t.id === templateId);
        if (!tpl && !isLabelTemplateLibraryAuthoritative.value && snapshotGroup && typeof snapshotGroup === 'object') {
            // Fallback for reload/race conditions: use the immutable snapshot already
            // stored on the zone so cards still render when the library has not loaded.
            tpl = {
                id: String(templateId || snapshotTemplateId || 'zone-template-snapshot'),
                name: 'Zone Template Snapshot',
                kind: 'priceGroup-v1',
                group: snapshotGroup
            } as any as LabelTemplate;
        }
        if (!tpl) return;

        const objs = card.getObjects();
        const oldPg = objs.find((o: any) => o && o.type === 'group' && o.name === 'priceGroup');
        if (!oldPg) return;

        const oldParts = typeof oldPg.getObjects === 'function' ? oldPg.getObjects() : [];
        const oldPrice = oldParts.find((o: any) => o.name === 'smart_price' || o.name === 'price_value_text');
        const oldInt = oldParts.find((o: any) => o.name === 'price_integer_text');
        const oldDec = oldParts.find((o: any) => o.name === 'price_decimal_text');
        const oldCurrency = oldParts.find((o: any) => o.name === 'price_currency_text');
        const oldRetailInt = oldParts.find((o: any) => o.name === 'retail_integer_text');
        const oldRetailDec = oldParts.find((o: any) => o.name === 'retail_decimal_text');
        const oldWholesaleInt = oldParts.find((o: any) => o.name === 'wholesale_integer_text');
        const oldWholesaleDec = oldParts.find((o: any) => o.name === 'wholesale_decimal_text');
        const isVisibleNode = (obj: any): boolean => {
            if (!obj) return false;
            if (obj.visible === false) return false;
            const sx = Number(obj.scaleX ?? 1);
            const sy = Number(obj.scaleY ?? 1);
            if (!Number.isFinite(sx) || !Number.isFinite(sy)) return true;
            return sx !== 0 && sy !== 0;
        };
        const shouldReadSplitPrice = !!(
            oldInt && oldDec && (
                isVisibleNode(oldCurrency) ||
                !oldPrice ||
                !isVisibleNode(oldPrice)
            )
        );
        const hasVisibleAtacarejoTier = (
            (oldRetailInt && oldRetailDec && isVisibleNode(oldRetailInt) && isVisibleNode(oldRetailDec)) ||
            (oldWholesaleInt && oldWholesaleDec && isVisibleNode(oldWholesaleInt) && isVisibleNode(oldWholesaleDec))
        );
        const oldPriceText = shouldReadSplitPrice
            ? `${oldInt.text || '0'}${oldDec.text || ',00'}`
            : (hasVisibleAtacarejoTier ? undefined : oldPrice?.text);
        const oldCurrencyText = oldCurrency?.text;
        // Unit must come from product/card metadata. Reusing the previous label text
        // leaks sample/template values like "UN" into products that did not configure it.
        const inferredUnit = inferUnitFromCard(card);

        let newPg: any = null;
        try {
            newPg = await instantiatePriceGroupFromTemplate(tpl, {
                atacVariantKey: resolveAtacVariantKeyFromPrice(oldPriceText)
            });
            // Templates created before the mini-editor trim fix may still contain
            // transparent margins. Trim the freshly enlivened label before its
            // layout is applied to the product card.
            trimAllCanvasImages(newPg);
        } catch (err) {
            console.warn('[labelTemplates] Template inválido ao aplicar no card, fallback para padrão', err);
            await resetCardPriceGroupToDefault(card);
            return;
        }
        const preserveManualTemplateLayout = shouldPreserveManualTemplateVisual(newPg);
        if (typeof oldPriceText === 'string') setPriceOnPriceGroup(newPg, oldPriceText, typeof inferredUnit === 'string' ? inferredUnit : undefined);
        if (typeof oldCurrencyText === 'string') {
            const c = newPg.getObjects?.().find((o: any) => o.name === 'price_currency_text');
            if (c && typeof c.set === 'function') c.set('text', oldCurrencyText);
        }
        const isRedBurst = isRedBurstPriceGroup(newPg);
        const headerParts = inferHeaderPartsForPriceTemplate(card, 'OFERTA', {
            preferFullNameWithWeight: isRedBurst,
            splitUnitIntoDedicatedField: !isRedBurst
        });
        const headerTextObj = newPg.getObjects?.().find((o: any) => o.name === 'price_header_text');
        if (headerTextObj && isTextLikeObject(headerTextObj)) {
            const defaultHeader = String(headerTextObj.text || '').trim() || 'OFERTA';
            headerTextObj.set('text', headerParts.title || defaultHeader);
            if (typeof headerTextObj.initDimensions === 'function') headerTextObj.initDimensions();
        }
        const headerUnitObj = newPg.getObjects?.().find((o: any) => o.name === 'price_header_unit_text');
        if (headerUnitObj && isTextLikeObject(headerUnitObj)) {
            headerUnitObj.set('text', isRedBurst ? '' : (headerParts.unit || ''));
            headerUnitObj.set('visible', !isRedBurst && !!headerParts.unit);
            if (typeof headerUnitObj.initDimensions === 'function') headerUnitObj.initDimensions();
        }
        if (isRedBurst) tuneRedBurstPriceGroupLayout(newPg);
        // Apply wholesale/pack metadata when the template supports it (no-op otherwise).
        applyAtacarejoPricingToPriceGroup(newPg, {
            offerFormat: (card as any)._productData?.offerFormat,
            price: (card as any).price ?? (typeof oldPriceText === 'string' ? oldPriceText : null),
            pricePack: (card as any).pricePack ?? null,
            priceUnit: (card as any).priceUnit ?? null,
            priceSpecial: (card as any).priceSpecial ?? null,
            priceSpecialUnit: (card as any).priceSpecialUnit ?? null,
            specialCondition: (card as any).specialCondition ?? null,
            priceWholesale: (card as any).priceWholesale ?? null,
            wholesaleTrigger: (card as any).wholesaleTrigger ?? null,
            wholesaleTriggerUnit: (card as any).wholesaleTriggerUnit ?? null,
            packQuantity: (card as any).packQuantity ?? null,
            packUnit: (card as any).packUnit ?? null,
            packageLabel: (card as any).packageLabel ?? null,
            weight: typeof inferredUnit === 'string' ? inferredUnit : null
        });

        // A troca de modelo deve voltar a usar a posição/área definidas em Cards.
        // Só carregamos a âncora antiga quando o usuário moveu explicitamente o
        // priceGroup (marcador separado dos ajustes internos da etiqueta).
        const preserveManualPricePosition = (oldPg as any).__manualPricePosition === true;
        const desiredLeft = preserveManualPricePosition ? (oldPg.left ?? 0) : 0;
        const desiredTop = preserveManualPricePosition ? (oldPg.top ?? 0) : 0;
        const cardW = card._cardWidth ?? card.width ?? card.getScaledWidth?.() ?? 0;
        const cardH = card._cardHeight ?? card.height ?? card.getScaledHeight?.() ?? 0;
        let layout: any = null;
        if (cardW && cardH) {
            restoreMissingManualTemplateFlags(newPg);
            layout = layoutPriceGroup(newPg, cardW, cardH);
        }
        newPg.set({
            left: desiredLeft,
            top: desiredTop,
            originX: oldPg.originX ?? 'center',
            originY: oldPg.originY ?? 'center',
            angle: oldPg.angle ?? 0,
            scaleX: preserveManualTemplateLayout ? (Math.abs(Number(newPg.scaleX)) || 1) : 1,
            scaleY: preserveManualTemplateLayout ? (Math.abs(Number(newPg.scaleY)) || 1) : 1,
            name: 'priceGroup',
            subTargetCheck: false,
            interactive: true
        });
        if (preserveManualPricePosition) {
            (newPg as any).__manualPricePosition = true;
        } else {
            delete (newPg as any).__manualPricePosition;
        }
        setPriceGroupInteractionMode(newPg, 'move');

        setPriceGroupInteractionMode(oldPg, 'move');
        card.remove(oldPg);
        safeAddWithUpdate(card, newPg);

        if (cardW && cardH) {
            if (!layout) layout = layoutPriceGroup(newPg, cardW, cardH);
            if (preserveManualPricePosition && preserveManualTemplateLayout) {
                // layoutManualTemplateGroup normalizes local origin to (0,0); keep authored card anchor.
                newPg.set({ left: desiredLeft, top: desiredTop });
            } else if (!preserveManualPricePosition) {
                const marginBottom = cardH * 0.05;
                const halfH = cardH / 2;
                const hForAnchor = layout?.pillH ?? (newPg.getScaledHeight?.() ?? newPg.height ?? (cardH * 0.18));
                newPg.set({ top: halfH - (hForAnchor / 2) - marginBottom });
            }
            normalizePriceGroupPlacementInCard(newPg, cardW, cardH, {
                left: Number(newPg.left ?? desiredLeft ?? 0) || 0,
                top: Number(newPg.top ?? desiredTop ?? 0) || 0,
                cardW,
                cardH
            });
        }

        // Fabric may keep a previously rasterized cache for the card even after a
        // nested price group is replaced. Invalidate the complete card subtree so
        // the newly selected label is the one painted on the next render.
        const invalidateCardRenderTree = (obj: any): void => {
            if (!obj) return;
            try {
                if (typeof obj.set === 'function') {
                    obj.set({ dirty: true, objectCaching: false, statefullCache: false });
                } else {
                    obj.dirty = true;
                    obj.objectCaching = false;
                    obj.statefullCache = false;
                }
                if (typeof obj.setCoords === 'function') obj.setCoords();
                if (typeof obj.getObjects === 'function') {
                    obj.getObjects().forEach((child: any) => invalidateCardRenderTree(child));
                }
            } catch {
                // A partially enlivened Fabric child should never block the card
                // from being rendered or saved.
            }
        };
        invalidateCardRenderTree(card);

        const titleObj = getCardTitleText(card);
        const hasHeader = isRedBurst || (typeof newPg.getObjects === 'function' && newPg.getObjects().some((o: any) => o.name === 'price_header_text' || o.name === 'offer_header_bg'));
        if (titleObj && typeof titleObj.set === 'function') {
            titleObj.set({
                visible: !hasHeader,
                selectable: !hasHeader,
                evented: !hasHeader
            });
            if (typeof titleObj.initDimensions === 'function') titleObj.initDimensions();
        }

        // Freeze card dimensions (do NOT call safeAddWithUpdate which expands bounds)
        if (cardW && cardH) card.set({ width: cardW, height: cardH });

        // A template replacement rebuilds the nested price group after the normal
        // card relayout. Reapply the account card recipe here as the last geometry
        // step; otherwise the newly enlivened label keeps the template's authored
        // scale and can cover the image/name until the next manual edit. This path
        // is also used by the asynchronous global-label reconciliation, so the
        // corrected dimensions are what the very next persistence snapshot sees.
        if (cardW && cardH && productCardConfigurationState.isLoaded.value) {
            try {
                const cardLayout = normalizeProductCardConfiguration(productCardConfigurationState.configuration.value);
                const effectiveCardStyles = normalizeGlobalStyles({
                    ...getEffectiveStylesForCard(card, zone),
                    cardLayout
                });
                productCardConfiguration.applyProductCardConfigurationLayout(card, cardW, cardH, effectiveCardStyles);
                // Some real labels contain their own header (for example the
                // red-burst offer). Keep the card title hidden in that case; the
                // geometry recipe should not re-enable a duplicate heading.
                if (hasHeader && titleObj && typeof titleObj.set === 'function') {
                    titleObj.set({ visible: false, selectable: false, evented: false });
                }
            } catch (err) {
                console.warn('[labelTemplates] Falha ao reaplicar a estrutura do card apos trocar a etiqueta:', err);
            }
        }
        card.dirty = true;
        card.setCoords();
    }

    async function applyLabelTemplateToZone(
        zone: any,
        templateId?: string,
        options: boolean | ApplyLabelTemplateToZoneOptions = false
    ) {
        if (!canvas.value || !zone || !isLikelyProductZone(zone)) return false;
        const applyOptions = typeof options === 'boolean'
            ? { applyToExisting: options, requestRender: true, save: true, cards: undefined, forceCardTemplate: false }
            : {
                applyToExisting: !!options?.applyToExisting,
                requestRender: options?.requestRender !== false,
                save: options?.save !== false,
                cards: Array.isArray(options?.cards) ? options.cards.filter(Boolean) : undefined,
                forceCardTemplate: options?.forceCardTemplate === true
        };
        const id = templateId || undefined;
        const rawPrevZoneStyles = (
            zone && typeof (zone as any)._zoneGlobalStyles === 'object' && (zone as any)._zoneGlobalStyles !== null
        )
            ? { ...((zone as any)._zoneGlobalStyles as Partial<GlobalStyles>) }
            : {};
        const prev = getZoneGlobalStyles(zone);
        const nextZoneStyles = normalizeGlobalStyles({ ...prev, splashTemplateId: id });
        const tpl = id
            ? labelTemplates.value.find((t: any) => String(t?.id || '') === String(id))
            : null;
        const snapshot = cloneTemplateGroupJson((tpl as any)?.group);

        if (applyOptions.applyToExisting) {
            const cards = applyOptions.cards && applyOptions.cards.length > 0
                ? applyOptions.cards
                : getZoneChildren(zone);
            const rollbackMap = new Map<any, any>();
            for (const card of cards) {
                const oldPg = typeof card?.getObjects === 'function'
                    ? card.getObjects().find((o: any) => o && o.type === 'group' && o.name === 'priceGroup')
                    : null;
                const rollbackClone = oldPg ? await clonePriceGroupForRollback(oldPg) : null;
                if (rollbackClone) rollbackMap.set(card, rollbackClone);
            }
            let failedCards = 0;
            for (const card of cards) {
                try {
                    const cardTemplateId = String((card as any)?.__cardLabelTemplateId || '').trim();
                    const hasCardTemplate = !!cardTemplateId && labelTemplates.value.some((item: any) => String(item?.id || '').trim() === cardTemplateId);
                    const keepCardOverride = !applyOptions.forceCardTemplate && cardHasExplicitLabelTemplateOverride(card);
                    const templateToApply = keepCardOverride && hasCardTemplate ? cardTemplateId : id;
                    if (templateToApply) {
                        await applyLabelTemplateToCard(card, templateToApply);
                        // Cards que acompanham a zona ficam marcados como herdados;
                        // isso permite detectar e corrigir snapshots legados que
                        // carregaram uma etiqueta diferente da escolhida na zona.
                        setCardLabelTemplateMetadata(card, templateToApply, keepCardOverride);
                    } else {
                        await resetCardPriceGroupToDefault(card);
                        setCardLabelTemplateMetadata(card, undefined);
                    }
                } catch (err) {
                    failedCards += 1;
                    console.warn('[labelTemplates] Failed to apply zone template to card', err);
                }
            }
            if (failedCards > 0) {
                for (const card of cards) {
                    const rollbackPriceGroup = rollbackMap.get(card);
                    if (!rollbackPriceGroup) continue;
                    const currentPg = typeof card?.getObjects === 'function'
                        ? card.getObjects().find((o: any) => o && o.type === 'group' && o.name === 'priceGroup')
                        : null;
                    restoreCardPriceGroup(card, currentPg, rollbackPriceGroup);
                }
                if (applyOptions.requestRender) safeRequestRenderAll();
                console.warn(`[labelTemplates] Aborting zone template persistence because ${failedCards} card(s) failed`);
                return false;
            }

            (zone as any)._zoneGlobalStyles = nextZoneStyles;
            if (id) {
                (zone as any)._zoneTemplateSnapshotId = id;
                (zone as any)._zoneTemplateSnapshot = snapshot || null;
            } else {
                (zone as any)._zoneTemplateSnapshotId = undefined;
                (zone as any)._zoneTemplateSnapshot = undefined;
            }

            // Also re-apply colors/text style if the zone has global styles.
            const labelStyleProps = [
                'splashColor',
                'accentColor',
                'splashFill',
                'splashTextColor',
                'priceTextColor',
                'priceCurrencyColor',
                'priceFont',
                'priceFontWeight',
                'priceFontStyle',
                'currencySymbol',
                'priceFontSize',
                'splashTextScale',
                'splashStrokeWidth',
                'splashRoundness',
                'splashScale',
                'splashOffsetY'
            ] as Array<keyof GlobalStyles>;
            labelStyleProps.forEach((prop) => {
                if (!shouldReapplyLabelStylePropAfterTemplateApply(prop, rawPrevZoneStyles, nextZoneStyles, zone)) return;
                applyGlobalStylesToCards(nextZoneStyles, zone, { cards, prop });
            });
            // "Editar so este card": overrides POR CARD vencem a zona e sao reaplicados
            // POR ULTIMO, para o loop de estilos da zona acima nao sobrescrever o card.
            for (const card of cards) {
                const cardOv = getCardStyleOverrides(card);
                const cardProps = Object.keys(cardOv);
                if (!cardProps.length) continue;
                const effForCard = getEffectiveStylesForCard(card, zone);
                cardProps.forEach((prop) => {
                    applyGlobalStylesToCards(effForCard, zone, { cards: [card], prop });
                });
            }
        } else {
            (zone as any)._zoneGlobalStyles = nextZoneStyles;
            if (id) {
                (zone as any)._zoneTemplateSnapshotId = id;
                (zone as any)._zoneTemplateSnapshot = snapshot || null;
            } else {
                (zone as any)._zoneTemplateSnapshotId = undefined;
                (zone as any)._zoneTemplateSnapshot = undefined;
            }
        }

        if (applyOptions.requestRender) safeRequestRenderAll();
        if (applyOptions.save) await saveCurrentState();
        return true;
    }

    const ensureZoneSanity = (zone: any) => {
        if (!zone) return;
        if (!zone._customId) zone._customId = makeId();
        let needsBoundsUpdate = false;

        const snapshotLayout = (zone as any)?._zoneStateSnapshot?.zone?.layout;
        const finiteSnapshotNumber = (value: any): number | null => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const hasFiniteNumber = (value: any): boolean => Number.isFinite(Number(value));

        // A biblioteca global e a fonte de layout para zonas comuns. Em páginas
        // criadas a partir de um Modelo de encarte, a composição persistida no
        // próprio canvas vence: cada modelo/formato pode ter uma receita diferente.
        const preserveTemplateStructure =
            isTemplateCompositionManagedZone(zone) && hasPersistedProductZoneStructure(zone)
        const activePreviewFormat = getCurrentProductZonePreviewFormat();
        const structureBase = {
            padding: typeof zone._zonePadding === 'number' ? zone._zonePadding : zone.padding,
            gapHorizontal: zone.gapHorizontal,
            gapVertical: zone.gapVertical,
            role: zone.role
        };
        const configuredStructureMaps = productZoneStructuresState.structureMapsByPreviewFormat.value;
        if (
            productZoneStructuresState.isLoaded.value &&
            configuredStructureMaps &&
            typeof configuredStructureMaps === 'object' &&
            !preserveTemplateStructure
        ) {
            zone.structureByProductCountByPreviewFormat = configuredStructureMaps;
            zone.structureByProductCount = configuredStructureMaps[activePreviewFormat]
                || configuredStructureMaps[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
            zone.structureByProductCountEnabled = true;
            zone.structureVariantsByProductCountByPreviewFormat = productZoneStructuresState.structureVariantsByPreviewFormat.value;
            zone.structureVariantsByProductCount = zone.structureVariantsByProductCountByPreviewFormat[activePreviewFormat]
                || zone.structureVariantsByProductCountByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
        } else if (snapshotLayout?.structureByProductCountByPreviewFormat || snapshotLayout?.structureByProductCount) {
            const snapshotMaps = normalizeProductZoneStructureMapByPreviewFormat(
                snapshotLayout.structureByProductCountByPreviewFormat,
                structureBase,
                snapshotLayout.structureByProductCount
            );
            const snapshotVariants = normalizeProductZoneStructureVariantMapByPreviewFormat(
                snapshotLayout.structureVariantsByProductCountByPreviewFormat,
                structureBase,
                snapshotMaps,
                snapshotLayout.structureVariantsByProductCount
            );
            zone.structureByProductCountByPreviewFormat = snapshotMaps;
            zone.structureByProductCount = snapshotMaps[activePreviewFormat]
                || snapshotMaps[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
            zone.structureByProductCountEnabled = true;
            zone.structureVariantsByProductCountByPreviewFormat = snapshotVariants;
            zone.structureVariantsByProductCount = snapshotVariants[activePreviewFormat]
                || snapshotVariants[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
        }
        if (!zone.structureByProductCountByPreviewFormat || typeof zone.structureByProductCountByPreviewFormat !== 'object') {
            zone.structureByProductCountByPreviewFormat = normalizeProductZoneStructureMapByPreviewFormat(
                undefined,
                structureBase,
                zone.structureByProductCount
            );
        }
        zone.structureByProductCount = zone.structureByProductCountByPreviewFormat[activePreviewFormat]
            || zone.structureByProductCountByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT]
            || createDefaultProductZoneStructureMap(structureBase);
        zone.structureByProductCountEnabled = true;
        if (!zone.structureVariantsByProductCountByPreviewFormat || typeof zone.structureVariantsByProductCountByPreviewFormat !== 'object') {
            zone.structureVariantsByProductCountByPreviewFormat = normalizeProductZoneStructureVariantMapByPreviewFormat(
                undefined,
                structureBase,
                zone.structureByProductCountByPreviewFormat,
                zone.structureVariantsByProductCount
            );
        } else {
            zone.structureVariantsByProductCountByPreviewFormat = normalizeProductZoneStructureVariantMapByPreviewFormat(
                zone.structureVariantsByProductCountByPreviewFormat,
                zone,
                zone.structureByProductCountByPreviewFormat,
                zone.structureVariantsByProductCount
            );
        }
        zone.structureVariantsByProductCount = zone.structureVariantsByProductCountByPreviewFormat[activePreviewFormat]
            || zone.structureVariantsByProductCountByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
        if (!zone.structureVariantByProductCount || typeof zone.structureVariantByProductCount !== 'object') {
            zone.structureVariantByProductCount = {};
        }
        preserveValidZoneStructureVariantSelection(zone);
        preserveValidZoneStructureVariantSelectionsByPreviewFormat(zone);

        // A biblioteca de cards e global, mas cada zona recebe uma copia no seu
        // _zoneGlobalStyles para que o relayout normal do editor use a mesma fonte
        // de verdade ao criar ou redimensionar cards depois do boot.
        const preserveTemplateCardLayout =
            isTemplateCompositionManagedZone(zone) && hasPersistedCardLayout(zone)
        if (productCardConfigurationState.isLoaded.value && !preserveTemplateCardLayout) {
            const currentStyles = normalizeGlobalStyles((zone as any)._zoneGlobalStyles || productZoneState.globalStyles.value);
            (zone as any)._zoneGlobalStyles = normalizeGlobalStyles({
                ...currentStyles,
                cardLayout: productCardConfigurationState.configuration.value
            });
        }

        // If an older/corrupted JSON lost direct zone layout props, recover the
        // per-zone values from the canonical state snapshot before defaults run.
        if (snapshotLayout && typeof snapshotLayout === 'object') {
            const snapshotPadding = finiteSnapshotNumber(snapshotLayout.padding);
            const snapshotGapH = finiteSnapshotNumber(snapshotLayout.gapHorizontal);
            const snapshotGapV = finiteSnapshotNumber(snapshotLayout.gapVertical);

            if (!hasFiniteNumber(zone._zonePadding) && snapshotPadding !== null) {
                zone._zonePadding = Math.max(0, snapshotPadding);
            }
            if (!hasFiniteNumber(zone.gapHorizontal) && snapshotGapH !== null) {
                zone.gapHorizontal = Math.max(0, snapshotGapH);
            }
            if (!hasFiniteNumber(zone.gapVertical) && snapshotGapV !== null) {
                zone.gapVertical = Math.max(0, snapshotGapV);
            }
        }

        // CRITICAL: Product zones should NOT have clipPath as it causes rendering errors
        // Cards are added separately to canvas, not as children of the zone group
        if (zone.clipPath) {
            zone.clipPath = null;
        }

        // Keep Fabric group padding at 0 to avoid inflating the selection bounds.
        // Use `_zonePadding` for layout math instead (used by recalculateZoneLayout).
        if (typeof zone._zonePadding !== 'number') {
            const currentPad = typeof zone.padding === 'number' ? zone.padding : 0;
            // Legacy zones used `group.padding` for layout; older defaults used 5 just for selection padding.
            zone._zonePadding = currentPad >= 10 ? currentPad : 20;
        }
        if (zone.padding !== 0) {
            zone.set('padding', 0);
            needsBoundsUpdate = true;
        }

        // Preserve explicit fixed rows from the zone inspector.
        // Only coerce invalid legacy values back to auto (`0`).
        if (typeof (zone as any).rows !== 'number' || !Number.isFinite((zone as any).rows) || (zone as any).rows < 0) {
            (zone as any).rows = 0;
        } else {
            (zone as any).rows = Math.max(0, Math.round((zone as any).rows));
        }

        // CRITICAL: Initialize _zoneWidth and _zoneHeight if missing (for persistence after reload)
        // This ensures the zone dimensions are correctly restored from the inner rect or calculated bounds
        if (typeof zone._zoneWidth !== 'number' || typeof zone._zoneHeight !== 'number') {
            const rect = typeof zone.getObjects === 'function'
                ? zone.getObjects().find((o: any) => o?.type === 'rect')
                : null;
            const rectWidth = rect ? (rect.width ?? 0) * (rect.scaleX ?? 1) : 0;
            const rectHeight = rect ? (rect.height ?? 0) * (rect.scaleY ?? 1) : 0;
            const zoneScaleX = Math.abs(zone.scaleX ?? 1);
            const zoneScaleY = Math.abs(zone.scaleY ?? 1);

            if (typeof zone._zoneWidth !== 'number') {
                zone._zoneWidth = rectWidth ? rectWidth * zoneScaleX : (zone.getScaledWidth?.() ?? zone.width ?? 400);
            }
            if (typeof zone._zoneHeight !== 'number') {
                zone._zoneHeight = rectHeight ? rectHeight * zoneScaleY : (zone.getScaledHeight?.() ?? zone.height ?? 600);
            }
            console.log('🔧 [ensureZoneSanity] Initialized zone dimensions:', { _zoneWidth: zone._zoneWidth, _zoneHeight: zone._zoneHeight });
        }

        const isTouchEditor = !!(isMobile.value || isTablet.value);

        // Ensure stable interaction flags
        // NOTE: we intentionally do NOT set objectCaching/statefullCache here.
        // Those props are in CANVAS_CUSTOM_PROPS; forcing them to false on zones
        // persists the value and degrades rendering performance for all subsequent
        // loads. If a zone needs a cache refresh, call zone.set('dirty', true).
        zone.set({
            lockScalingFlip: true,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            subTargetCheck: false,
            transparentCorners: false,
            touchCornerSize: isTouchEditor ? 44 : Math.max(24, Number(zone.touchCornerSize || 24)),
            cornerSize: isTouchEditor ? 16 : 13,
            borderScaleFactor: isTouchEditor ? 2 : 1.6,
            cornerColor: '#6d28d9',
            cornerStrokeColor: '#1e1b4b',
            cornerStyle: 'circle',
            borderOpacityWhenMoving: 1,
            opacity: 1
        });

        // Normalize the inner rect scale so it always matches the group bounds while scaling.
        const rect = getZoneRect(zone);
        if (rect) {
            const sx = rect.scaleX ?? 1;
            const sy = rect.scaleY ?? 1;
            if (sx !== 1 || sy !== 1) {
                rect.set({
                    width: (rect.width ?? 0) * sx,
                    height: (rect.height ?? 0) * sy,
                    scaleX: 1,
                    scaleY: 1
                });
                needsBoundsUpdate = true;
            }
            rect.set({
                selectable: false,
                evented: false,
                strokeUniform: true,
                opacity: 1,
                visible: true,
                objectCaching: false
            });
        }

        // FIX: Do NOT call safeAddWithUpdate(zone) here — it invokes triggerLayout()
        // which recalculates the group bounding box from ALL children (rect + labels).
        // This shifts the group center away from the rect center, corrupting all
        // subsequent getZoneMetrics calculations that derive card positions.
        // Instead, manually sync group dimensions to match the rect.
        // ALWAYS sync (not just on needsBoundsUpdate) — after JSON deserialization the
        // group width/height may not match the rect if it was saved in a corrupt state.
        if (rect) {
            const rectW = Math.abs((rect.width ?? 0) * (rect.scaleX ?? 1));
            const rectH = Math.abs((rect.height ?? 0) * (rect.scaleY ?? 1));
            if (rectW > 0 && rectH > 0) {
                const metrics = getZoneMetrics(zone);
                const centerX = Number(metrics?.centerX);
                const centerY = Number(metrics?.centerY);
                const rectOffset = Math.abs(Number(rect.left || 0)) > 0.5 || Math.abs(Number(rect.top || 0)) > 0.5;
                const sizeMismatch = Math.abs((zone.width ?? 0) - rectW) > 1 || Math.abs((zone.height ?? 0) - rectH) > 1;
                if ((rectOffset || sizeMismatch) && Number.isFinite(centerX) && Number.isFinite(centerY)) {
                    zone.set({
                        originX: 'center',
                        originY: 'center',
                        left: centerX,
                        top: centerY,
                        width: rectW,
                        height: rectH,
                        scaleX: 1,
                        scaleY: 1,
                        padding: 0,
                        dirty: true
                    });
                    rect.set({
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: 0
                    });
                } else if (sizeMismatch) {
                    zone.set({ width: rectW, height: rectH, padding: 0 });
                    zone.dirty = true;
                }
            }
        } else if (needsBoundsUpdate) {
            zone.dirty = true;
        }
        // FIX: Permanently disable LayoutManager on zone groups (same as product cards).
        // Zone layout is fully managed by recalculateZoneLayout.
        const zoneLm = (zone as any).layoutManager;
        if (zoneLm && typeof zoneLm.performLayout === 'function' && zoneLm.performLayout.toString() !== '() => {}') {
            zoneLm.performLayout = () => {};
        }
        zone.setCoords();
    }

    const recalculateZoneLayout = (zone: any, cachedChildren?: any[], opts: RecalculateZoneLayoutOptions = {}) => {
        if (!zone || !canvas.value) return;
        ensureZoneSanity(zone);
        const shouldSave = opts.save !== false;
        const shouldRender = opts.requestRender !== false;
        const cachedList = Array.isArray(cachedChildren) ? cachedChildren.filter(Boolean) : [];

        // 1. Find cards in zone (Use cache if available for performance)
        const canvasObjects = canvas.value ? new Set(canvas.value.getObjects()) : null;
        const zoneIdForCachedChildren = String((zone as any)?._customId || '').trim();
        const canTrustCachedChildren = cachedList.length > 0 && cachedList.every((card: any) => {
            if (!card) return false;
            if (canvasObjects && !canvasObjects.has(card)) return false;
            const parentZoneId = String((card as any)?.parentZoneId || '').trim();
            const slotZoneId = String((card as any)?._zoneSlot?.zoneId || '').trim();
            return !!zoneIdForCachedChildren && (parentZoneId === zoneIdForCachedChildren || slotZoneId === zoneIdForCachedChildren);
        });
        const cardMap = new Map<any, any>();
        cachedList.forEach((card: any) => {
            // Ignore cached cards that were removed from canvas (stale cache)
            if (canvasObjects && !canvasObjects.has(card)) return;
            const key = card._customId ?? card.id ?? card;
            cardMap.set(key, card);
        });

        if ((!opts.trustCachedChildren && !canTrustCachedChildren) || cachedList.length === 0) {
            getZoneChildren(zone).forEach((card: any) => {
                const key = card._customId ?? card.id ?? card;
                cardMap.set(key, card);
            });
        }

        let cards = Array.from(cardMap.values());

        if (cards.length === 0) return;

        // 2. Sort by stable zone order when available, otherwise fall back to visual order.
        const hasAllOrders = cards.every((c: any) => Number.isFinite((c as any)._zoneOrder));
        if (hasAllOrders) {
            cards.sort((a: any, b: any) => ((a as any)._zoneOrder ?? 0) - ((b as any)._zoneOrder ?? 0));
        } else {
            cards.sort((a: any, b: any) => {
                const rowDiff = (a.top ?? 0) - (b.top ?? 0);
                if (Math.abs(rowDiff) > 50) return rowDiff; // Same row tolerance
                return (a.left ?? 0) - (b.left ?? 0);
            });
            cards.forEach((c: any, i: number) => ((c as any)._zoneOrder = i));
        }

        // 3. Setup Grid Vars. A zona agora usa a receita correspondente ao total
        // de cards; os campos antigos continuam apenas como fallback de leitura.
        const zoneRect = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
        const minSlotSize = 12;
        const count = cards.length;
        const previewFormat = getCurrentProductZonePreviewFormat();
        const structure = resolveProductZoneStructure(zone, count, previewFormat);
        const layoutZone = structure
            ? { ...zone, ...structure }
            : zone;

        const rawPadding = Math.max(0, Number(
            structure?.padding ?? (typeof zone._zonePadding === 'number' ? zone._zonePadding : (zone.padding ?? 20))
        ) || 0);
        const rawGapX = Math.max(0, Number(structure?.gapHorizontal ?? layoutZone.gapHorizontal ?? rawPadding) || 0);
        const rawGapY = Math.max(0, Number(structure?.gapVertical ?? layoutZone.gapVertical ?? rawPadding) || 0);
        const rawHighlightPadding = Math.max(0, Number(
            (structure as any)?.highlightPadding ?? (layoutZone as any)?.highlightPadding ?? rawPadding
        ) || 0);
        const rawHighlightGapX = Math.max(0, Number(
            (structure as any)?.highlightGapHorizontal ?? (layoutZone as any)?.highlightGapHorizontal ?? rawGapX
        ) || 0);
        const rawHighlightGapY = Math.max(0, Number(
            (structure as any)?.highlightGapVertical ?? (layoutZone as any)?.highlightGapVertical ?? rawGapY
        ) || 0);
        const getHighlightPadding = (availableWidth: number, availableHeight: number) => Math.min(
            rawHighlightPadding,
            Math.max(0, (Math.min(availableWidth, availableHeight) / 2) - 1)
        );
        const lastRowBehavior = layoutZone.lastRowBehavior || 'fill';
        const layoutDirection = layoutZone.layoutDirection || 'horizontal';
        const stylesToApply: Partial<GlobalStyles> = getZoneGlobalStyles(zone);
        const zoneFrameId = getResolvedZoneFrameId(zone);

        const zoneConfig: ProductZone = {
            x: zoneRect.left,
            y: zoneRect.top,
            width: zoneRect.width,
            height: zoneRect.height,
            padding: rawPadding,
            gapHorizontal: rawGapX,
            gapVertical: rawGapY,
            columns: typeof layoutZone.columns === 'number' ? layoutZone.columns : 0,
            rows: typeof layoutZone.rows === 'number' ? layoutZone.rows : 0,
            layoutDirection,
            cardAspectRatio: layoutZone.cardAspectRatio ?? 'fill',
            lastRowBehavior,
            verticalAlign: (layoutZone as any).verticalAlign ?? 'stretch'
        };

        const { cols: computedCols, rows: computedRows } = calculateGridLayout(zoneConfig, count, previewFormat);
        const cols = Math.max(1, Math.round(Number(computedCols) || 1));
        const rows = Math.max(1, Math.round(Number(computedRows) || 1));
        const effectiveRows = Math.max(rows, Math.ceil(count / cols));

        // Fit spacing to available area so cards never overflow the product zone.
        const fitSpacing = (colCount: number, rowCount: number) => {
            let padding = rawPadding;
            let gapX = rawGapX;
            let gapY = rawGapY;

            if (colCount > 1) {
                const maxGapForMinWidth = (zoneRect.width - (padding * 2) - (colCount * minSlotSize)) / (colCount - 1);
                gapX = clamp(gapX, 0, Math.max(0, maxGapForMinWidth));
            }
            if (rowCount > 1) {
                const maxGapForMinHeight = (zoneRect.height - (padding * 2) - (rowCount * minSlotSize)) / (rowCount - 1);
                gapY = clamp(gapY, 0, Math.max(0, maxGapForMinHeight));
            }

            const maxPadByWidth = (zoneRect.width - (colCount * minSlotSize) - ((colCount - 1) * gapX)) / 2;
            const maxPadByHeight = (zoneRect.height - (rowCount * minSlotSize) - ((rowCount - 1) * gapY)) / 2;
            const padLimit = Math.max(0, Math.min(maxPadByWidth, maxPadByHeight));
            padding = clamp(padding, 0, padLimit);

            const usableW = Math.max(2, zoneRect.width - (padding * 2));
            const usableH = Math.max(2, zoneRect.height - (padding * 2));

            if (colCount > 1) {
                const maxGapByUsableWidth = (usableW - (colCount * minSlotSize)) / (colCount - 1);
                gapX = clamp(gapX, 0, Math.max(0, maxGapByUsableWidth));
            }
            if (rowCount > 1) {
                const maxGapByUsableHeight = (usableH - (rowCount * minSlotSize)) / (rowCount - 1);
                gapY = clamp(gapY, 0, Math.max(0, maxGapByUsableHeight));
            }

            const MIN_GAP = 0;
            const MIN_PAD = 2;
            return {
                padding: Math.max(MIN_PAD, padding),
                gapX: Math.max(MIN_GAP, gapX),
                gapY: Math.max(MIN_GAP, gapY),
                usableW,
                usableH,
                startX: zoneRect.left + Math.max(MIN_PAD, padding),
                startY: zoneRect.top + Math.max(MIN_PAD, padding)
            };
        };

        const spacing = fitSpacing(cols, effectiveRows);
        const padding = spacing.padding;
        const gapX = spacing.gapX;
        const gapY = spacing.gapY;
        const usableW = spacing.usableW;
        const usableH = spacing.usableH;

        // 4. Layout Execution
        const startX = spacing.startX;
        const startY = spacing.startY;
        const maxSlotX = zoneRect.left + zoneRect.width - padding;
        const maxSlotY = zoneRect.top + zoneRect.height - padding;

        // Compute standard (non-highlight) cell dimensions as reference so that
        // price tags, Y offsets and label sizing are uniform across all cards
        // — including highlight (featured) cards that get larger slots.
        const _refCellW = (usableW - (cols - 1) * gapX) / Math.max(1, cols);
        const _refCellH = (usableH - (effectiveRows - 1) * gapY) / Math.max(1, effectiveRows);
        if (Number.isFinite(_refCellW) && _refCellW > 2 && Number.isFinite(_refCellH) && _refCellH > 2) {
            (stylesToApply as any).__refCellW = _refCellW;
            (stylesToApply as any).__refCellH = _refCellH;
        }

        const getCardAspectRatioForOrder = (order: number): string => {
            const individualRatios = (layoutZone as any)?.cardAspectRatios;
            const configured = individualRatios && typeof individualRatios === 'object'
                ? individualRatios[String(Math.max(0, Math.round(order)) + 1)]
                : null;
            return String(configured || (layoutZone as any)?.cardAspectRatio || 'fill');
        };

        const fitCardToConfiguredAspect = (
            x: number,
            y: number,
            width: number,
            height: number,
            order: number
        ) => {
            const ratio = getAspectRatioValue(getCardAspectRatioForOrder(order));
            if (!ratio || ratio <= 0 || width <= 0 || height <= 0) {
                return { x, y, width, height };
            }

            let fittedWidth = width;
            let fittedHeight = width / ratio;
            if (fittedHeight > height) {
                fittedHeight = height;
                fittedWidth = height * ratio;
            }

            let fittedX = x + (width - fittedWidth) / 2;
            const verticalAlign = String((layoutZone as any)?.verticalAlign || 'stretch').toLowerCase();
            let fittedY = y + (height - fittedHeight) / 2;
            if (verticalAlign === 'top') fittedY = y;
            if (verticalAlign === 'bottom') fittedY = y + (height - fittedHeight);

            return {
                x: fittedX,
                y: fittedY,
                width: fittedWidth,
                height: fittedHeight
            };
        };

        // Helper: resize & position a single card in its slot. Each card can have
        // its own aspect ratio without changing the neighboring cards.
        const placeCard = (card: any, x: number, y: number, w: number, h: number, order: number) => {
            card._cardHighlighted = hl.isHighlighted(card, order);
            const fitted = fitCardToConfiguredAspect(x, y, w, h, order);
            const slotW = Math.max(2, fitted.width);
            const slotH = Math.max(2, fitted.height);
            const boundedX = clamp(fitted.x, startX, Math.max(startX, maxSlotX - slotW));
            const boundedY = clamp(fitted.y, startY, Math.max(startY, maxSlotY - slotH));
            // FIX: Restore visibility for cards that were hidden by viewport culling.
            // Viewport culling can set visible=false and then clear __viewportCulled,
            // leaving cards permanently hidden.  Since we're actively placing this card
            // in a layout slot, it must be visible.
            if (card.visible === false) {
                card.set('visible', true);
                card.visible = true;
                card.dirty = true;
                delete (card as any).__viewportCulled;
                delete (card as any).__viewportCullPrevVisible;
            }
            card.parentZoneId = zone._customId;
            applyCardFrameBinding(card, zoneFrameId);
            card._zoneOrder = order;
            (card as any)._zoneSlot = { zoneId: zone._customId, left: boundedX, top: boundedY, width: slotW, height: slotH };
            const cx = boundedX + slotW / 2;
            const cy = boundedY + slotH / 2;
            // Ensure LayoutManager is disabled on card groups (resizeSmartObject also does this)
            const pcLm = (card as any).layoutManager;
            if (pcLm && pcLm.performLayout) pcLm.performLayout = () => {};

            if (card.isSmartObject || card.name?.startsWith('product-card')) {
                if (opts.skipResize) {
                    // skipResize: preserve card internal layout from JSON.
                    // Only reposition — don't touch children or saved dimensions.
                    // CRITICAL FIX: If card already has valid saved dimensions, preserve them.
                    // Overwriting with slot dimensions causes proportional mismatch because
                    // internal elements (text, images, prices) keep their old positions/sizes.
                    // Slot dimensions may differ from saved due to zone metric rounding after
                    // normalizeZoneScale / ensureZoneSanity.
                    const savedW = Number((card as any)._cardWidth) || Number(card.width) || 0;
                    const savedH = Number((card as any)._cardHeight) || Number(card.height) || 0;
                    // Guard against corrupted saved dimensions (e.g. 3000px from old bugs)
                    const dimsLookValid = savedW > 0 && savedH > 0 &&
                        savedW <= Math.max(slotW * 3, 3000) &&
                        savedH <= Math.max(slotH * 3, 3000) &&
                        savedW >= slotW * 0.1 &&
                        savedH >= slotH * 0.1;
                    if (dimsLookValid) {
                        card.set({ width: savedW, height: savedH });
                        (card as any)._cardWidth = savedW;
                        (card as any)._cardHeight = savedH;
                    } else {
                        card.set({ width: slotW, height: slotH });
                        (card as any)._cardWidth = slotW;
                        (card as any)._cardHeight = slotH;
                    }
                } else if (opts.preserveStyles) {
                    // preserveStyles: resize card proportionally but don't re-apply zone styles.
                    // If card dimensions haven't changed, skip resize entirely to preserve template layout.
                    const prevW = Number((card as any)._cardWidth) || card.width || 0;
                    const prevH = Number((card as any)._cardHeight) || card.height || 0;
                    const dimChanged = Math.abs(prevW - slotW) > 1 || Math.abs(prevH - slotH) > 1;
                    const forceRelayout = (card as any).__forceCardRelayout === true;
                    if (dimChanged || forceRelayout) {
                        try {
                            // CORRECAO A8: passar stylesToApply ao resize mesmo com preserveStyles=true.
                            // Antes passavamos undefined, o que zerava title/splash/image scales para
                            // defaults — contradizendo a intencao de "preservar" o template visual.
                            // O resizeSmartObject reaplica estilos internos mas sem tocar em zone
                            // globals que ja estao no proprio card.
                            resizeSmartObject(card, slotW, slotH, stylesToApply);
                        } catch (resizeErr) {
                            console.warn('[placeCard] resizeSmartObject (preserveStyles) failed:', resizeErr);
                        }
                    } else {
                        // Do not call card.set({ width, height }) here. In Fabric v7, even a
                        // near-identical width/height assignment can shift a group's internal
                        // coordinate system and move children such as priceGroup labels.
                        (card as any)._cardWidth = prevW || slotW;
                        (card as any)._cardHeight = prevH || slotH;
                    }
                } else {
                    try {
                        resizeSmartObject(card, slotW, slotH, stylesToApply);
                    } catch (resizeErr) {
                        console.warn('[placeCard] resizeSmartObject failed, positioning card at slot:', resizeErr);
                    }
                }
                card.set({ left: cx, top: cy, originX: 'center', originY: 'center', scaleX: 1, scaleY: 1 });
            } else {
                card.set({ left: cx, top: cy, originX: 'center', originY: 'center', scaleX: slotW / (card.width || 1), scaleY: slotH / (card.height || 1) });
            }
            card.setCoords();
        };

        // Highlight detection
        const hl = getZoneHighlightPredicate(layoutZone, cards);

        if (hl.count > 0 && hl.mult > 1) {
            // ══════════════ FEATURED LAYOUT ══════════════
            // Highlighted cards get their own COLUMN SECTION (spanning full height).
            // Normal cards fill the remaining width as a sub-grid.
            const hlCards: any[] = [];
            const normCards: any[] = [];
            cards.forEach((card, i) => {
                if (hl.isHighlighted(card, i)) hlCards.push(card);
                else normCards.push(card);
            });

            // Edge case: all cards highlighted → fall through to standard grid
            if (normCards.length > 0) {
                const rawHighlightPos = String((layoutZone as any)?.highlightPos ?? 'first').toLowerCase();
                const useHorizontalFeatured =
                    rawHighlightPos === 'top' ||
                    rawHighlightPos === 'bottom' ||
                    rawHighlightPos === 'center';

                if (useHorizontalFeatured) {
                    const normalCols = Math.max(1, (layoutZone.columns && layoutZone.columns > 0)
                        ? cols
                        : Math.max(1, Math.round(Math.sqrt(normCards.length * (usableW / Math.max(1, usableH)))))
                    );

                    const normRowCount = Math.max(1, Math.ceil(normCards.length / normalCols));
                    // Gaps já são descontados em normSectionH e normCardH; não pré-descontar para evitar contagem dupla
                    const totalGapsY = 0;
                    const totalUnitsY = normRowCount + hl.mult;
                    const unitH = (usableH - totalGapsY) / Math.max(1, totalUnitsY);

                    if (Number.isFinite(unitH) && unitH > 2) {
                        const hlSectionH = unitH * hl.mult;
                        const normSectionH = usableH - hlSectionH - gapY;
                        const normCardH = (normSectionH - (Math.max(0, normRowCount - 1) * gapY)) / Math.max(1, normRowCount);
                        const baseNormCellW = (usableW - ((normalCols - 1) * gapX)) / Math.max(1, normalCols);

                        const highlightCols = Math.max(1, Math.min(cols, hlCards.length));
                        const highlightRows = Math.max(1, Math.ceil(hlCards.length / highlightCols));
                        const highlightPadding = getHighlightPadding(usableW, hlSectionH);
                        const highlightUsableW = Math.max(2, usableW - (highlightPadding * 2));
                        const highlightUsableH = Math.max(2, hlSectionH - (highlightPadding * 2));
                        const highlightCellW = (highlightUsableW - ((highlightCols - 1) * rawHighlightGapX)) / Math.max(1, highlightCols);
                        const highlightCellH = (highlightUsableH - (Math.max(0, highlightRows - 1) * rawHighlightGapY)) / Math.max(1, highlightRows);

                        const canApplyHorizontalFeatured =
                            normSectionH > 2 &&
                            normCardH > 2 &&
                            baseNormCellW > 2 &&
                            highlightCellW > 2 &&
                            highlightCellH > 2;

                        if (canApplyHorizontalFeatured) {
                            const placeAtBottom = rawHighlightPos === 'bottom';
                            const centerHighlightRows = rawHighlightPos === 'center';

                            const hlSectionY = placeAtBottom
                                ? (startY + usableH - hlSectionH)
                                : startY;
                            const normSectionY = placeAtBottom
                                ? startY
                                : (hlSectionY + hlSectionH + gapY);
                            const highlightStartX = startX + highlightPadding;
                            const highlightStartY = hlSectionY + highlightPadding;

                            hlCards.forEach((card: any, i: number) => {
                                const row = Math.floor(i / highlightCols);
                                const col = i % highlightCols;
                                const isLastRow = row === highlightRows - 1;
                                const itemsInRow = isLastRow ? (hlCards.length % highlightCols || highlightCols) : highlightCols;
                                let cellW = highlightCellW;
                                let rowGapX = rawHighlightGapX;
                                let rowStartX = centerHighlightRows
                                    ? (highlightStartX + (highlightUsableW - ((itemsInRow * cellW) + ((itemsInRow - 1) * rowGapX))) / 2)
                                    : highlightStartX;

                                if (isLastRow && itemsInRow < highlightCols) {
                                    if (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') {
                                        cellW = (highlightUsableW - ((itemsInRow - 1) * rawHighlightGapX)) / Math.max(1, itemsInRow);
                                        rowGapX = rawHighlightGapX;
                                        rowStartX = highlightStartX;
                                    } else {
                                        const rowW = (itemsInRow * cellW) + ((itemsInRow - 1) * rowGapX);
                                        if (lastRowBehavior === 'center' || centerHighlightRows) {
                                            rowStartX = highlightStartX + (highlightUsableW - rowW) / 2;
                                        } else if (lastRowBehavior === 'left') {
                                            rowStartX = highlightStartX;
                                        }
                                    }
                                }

                                const x = rowStartX + (col * (cellW + rowGapX));
                                const y = highlightStartY + (row * (highlightCellH + rawHighlightGapY));
                                placeCard(card, x, y, cellW, highlightCellH, cards.indexOf(card));
                            });

                            normCards.forEach((card: any, i: number) => {
                                const col = i % normalCols;
                                const row = Math.floor(i / normalCols);
                                const isLastRow = row === normRowCount - 1;
                                const itemsInRow = isLastRow ? (normCards.length % normalCols || normalCols) : normalCols;

                                let cellW = baseNormCellW;
                                let rowGapX = gapX;
                                let rowStartX = startX;

                                if (isLastRow && itemsInRow < normalCols) {
                                    if (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') {
                                        cellW = (usableW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow);
                                        rowGapX = gapX;
                                        rowStartX = startX;
                                    } else {
                                        const rowW = (itemsInRow * cellW) + ((itemsInRow - 1) * rowGapX);
                                        if (lastRowBehavior === 'center') {
                                            rowStartX = startX + (usableW - rowW) / 2;
                                        }
                                        else if (lastRowBehavior === 'left') rowStartX = startX;
                                    }
                                }

                                const x = rowStartX + (col * (cellW + rowGapX));
                                const y = normSectionY + (row * (normCardH + gapY));
                                placeCard(card, x, y, cellW, normCardH, cards.indexOf(card));
                            });

                            harmonizeProductCardTypography(cards);
        if (shouldRender) safeRequestRenderAll();
                            if (shouldSave) saveCurrentState();
                            return;
                        }
                    }
                }

                const hlOnLeft = rawHighlightPos !== 'last';

                // Column distribution for normal section
                const normalCols = Math.max(1, (layoutZone.columns && layoutZone.columns > 0)
                    ? cols - 1
                    : Math.max(1, Math.round(Math.sqrt(normCards.length * (usableW / Math.max(1, usableH)))))
                );

                // Width: highlight section = hl.mult units, normal cols = 1 unit each
                // Total gaps: 1 between hl and normal + (normalCols - 1) between normal cols = normalCols gaps
                const totalGapsX = normalCols * gapX;
                const totalUnits = normalCols + hl.mult;
                const unitW = (usableW - totalGapsX) / Math.max(1, totalUnits);

                if (Number.isFinite(unitW) && unitW > 2) {
                    const hlW = unitW * hl.mult;
                    const normSectionW = usableW - hlW - gapX;

                    // Heights (each section fills full height independently)
                    const hlRowCount = hlCards.length;
                    const highlightPadding = getHighlightPadding(hlW, usableH);
                    const highlightUsableW = Math.max(2, hlW - (highlightPadding * 2));
                    const highlightUsableH = Math.max(2, usableH - (highlightPadding * 2));
                    const hlGapH = Math.max(0, hlRowCount - 1) * rawHighlightGapY;
                    const hlCardH = (highlightUsableH - hlGapH) / Math.max(1, hlRowCount);

                    const normRowCount = Math.max(1, Math.ceil(normCards.length / normalCols));
                    const normGapH = Math.max(0, normRowCount - 1) * gapY;
                    const normCardH = (usableH - normGapH) / normRowCount;
                    const baseNormCellW = (normSectionW - ((normalCols - 1) * gapX)) / Math.max(1, normalCols);

                    const canApplyFeatured =
                        normSectionW > 2 &&
                        highlightUsableW > 2 &&
                        hlCardH > 2 &&
                        normCardH > 2 &&
                        baseNormCellW > 2;

                    if (canApplyFeatured) {
                        // Position highlight cards (full-height column section)
                        const hlSectionX = hlOnLeft ? startX : (startX + usableW - hlW);
                        const highlightStartX = hlSectionX + highlightPadding;
                        const highlightStartY = startY + highlightPadding;
                        hlCards.forEach((card: any, i: number) => {
                            const y = highlightStartY + i * (hlCardH + rawHighlightGapY);
                            placeCard(card, highlightStartX, y, highlightUsableW, hlCardH, cards.indexOf(card));
                        });

                        // Position normal cards in sub-grid
                        const normSectionX = hlOnLeft ? (startX + hlW + gapX) : startX;

                        normCards.forEach((card: any, i: number) => {
                            const col = i % normalCols;
                            const row = Math.floor(i / normalCols);

                            // Last row fill
                            const isLastRow = row === normRowCount - 1;
                            const itemsInRow = isLastRow ? (normCards.length % normalCols || normalCols) : normalCols;
                            // Match standard grid semantics:
                            // - fill: keep card size, expand gaps (but clamp to avoid huge "holes" on sparse last rows)
                            // - stretch: stretch cards
                            // - center: keep card size, center row
                            let cellW = baseNormCellW;
                            let rowGapX = gapX;
                            let rowStartX = normSectionX;
                            if (isLastRow && itemsInRow < normalCols) {
                                if (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') {
                                    // "fill" in sparse last rows: prefer stretching cards instead of exploding gaps.
                                    cellW = (normSectionW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow);
                                    rowGapX = gapX;
                                    rowStartX = normSectionX;
                                }
                                const rowW = (itemsInRow * cellW) + ((itemsInRow - 1) * rowGapX);
                                const shouldCenter =
                                    lastRowBehavior === 'center';
                                if (shouldCenter) {
                                    rowStartX = normSectionX + (normSectionW - rowW) / 2;
                                } else if (lastRowBehavior === 'left') {
                                    rowStartX = normSectionX;
                                }
                            }

                            let x = rowStartX + col * (cellW + rowGapX);

                            const y = startY + row * (normCardH + gapY);
                            placeCard(card, x, y, cellW, normCardH, cards.indexOf(card));
                        });

                        harmonizeProductCardTypography(cards);
        if (shouldRender) safeRequestRenderAll();
                        if (shouldSave) saveCurrentState();
                        return;
                    }
                }
            }
        }

        // ══════════════ STANDARD GRID LAYOUT ══════════════
        // For vertical layout, compute the effective number of columns used (otherwise we can
        // end up with "empty columns" to the right when count < cols * rows).
        const gridCols = layoutDirection === 'vertical'
            ? Math.max(1, Math.ceil(count / Math.max(1, effectiveRows)))
            : cols;

        const totalGapW = (gridCols - 1) * gapX;
        const totalGapH = (effectiveRows - 1) * gapY;
        const slotW = (usableW - totalGapW) / gridCols;
        const slotH = (usableH - totalGapH) / effectiveRows;

        // Aplicar cardAspectRatio para obter dimensões reais do card.
        let itemW = slotW;
        let itemH = slotH;
        const aspectRatioStr = layoutZone.cardAspectRatio as string | undefined;
        const hasAspectConstraint = !!aspectRatioStr && aspectRatioStr !== 'auto' && aspectRatioStr !== 'fill';
        if (hasAspectConstraint) {
            const arVal = getAspectRatioValue(aspectRatioStr!);
            if (arVal && arVal > 0) {
                const hFromRatio = itemW / arVal;
                if (hFromRatio <= itemH) {
                    itemH = hFromRatio;
                } else {
                    itemW = itemH * arVal;
                }
            }
        }

        // Aplicar verticalAlign — posicionar o grid quando há espaço vertical sobrando.
        const vAlign = String((layoutZone as any).verticalAlign || 'stretch').toLowerCase();
        let gridStartY = startY;
        let gridGapY = gapY;

        if (hasAspectConstraint && itemH < slotH) {
            const totalGridH = (effectiveRows * itemH) + ((effectiveRows - 1) * gapY);
            const excessH = usableH - totalGridH;
            if (excessH > 1) {
                if (vAlign === 'center') {
                    gridStartY = startY + excessH / 2;
                } else if (vAlign === 'bottom') {
                    gridStartY = startY + excessH;
                } else if (vAlign === 'stretch') {
                    // Distribuir espaço extra entre as linhas.
                    if (effectiveRows > 1) {
                        gridGapY = gapY + excessH / (effectiveRows - 1);
                    } else {
                        gridStartY = startY + excessH / 2;
                    }
                }
                // 'top': keep gridStartY as-is.
            }
        }

        // Centralizar horizontalmente quando aspect ratio restringe a largura.
        let gridStartX = startX;
        let gridGapX = gapX;

        if (hasAspectConstraint && itemW < slotW) {
            const totalGridW = (gridCols * itemW) + ((gridCols - 1) * gapX);
            const excessW = usableW - totalGridW;
            if (excessW > 1) {
                if (gridCols > 1) {
                    gridGapX = gapX + excessW / (gridCols - 1);
                } else {
                    gridStartX = startX + excessW / 2;
                }
            }
        }

        if (!Number.isFinite(itemW) || !Number.isFinite(itemH) || itemW <= 0 || itemH <= 0) {
            return;
        }

        cards.forEach((card: any, index: number) => {
          try {
            const col = layoutDirection === 'vertical'
                ? Math.floor(index / Math.max(1, effectiveRows))
                : (index % cols);
            const row = layoutDirection === 'vertical'
                ? (index % Math.max(1, effectiveRows))
                : Math.floor(index / cols);

            // Vertical flow: last column can be incomplete (itemsInCol < effectiveRows)
            // Horizontal flow: last row can be incomplete (itemsInRow < cols)
            const isLastRow = layoutDirection !== 'vertical' && row === effectiveRows - 1;
            const itemsInRow = isLastRow ? (count % cols || cols) : cols;
            const isLastCol = layoutDirection === 'vertical' && col === (gridCols - 1);
            const itemsInCol = isLastCol ? (count % effectiveRows || effectiveRows) : effectiveRows;

            // Handle vertical "last column" alignment/fill (analogous to last-row behavior).
            if (layoutDirection === 'vertical' && isLastCol && itemsInCol < effectiveRows) {
                let colItemH = itemH;
                let colGapY = gridGapY;
                let colStartY = gridStartY;

                if ((lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') && itemsInCol >= 1) {
                    // Fill the full height by stretching items (gaps stay consistent).
                    colItemH = (usableH - ((itemsInCol - 1) * gapY)) / Math.max(1, itemsInCol);
                    colGapY = gapY;
                    colStartY = startY;
                } else if (lastRowBehavior === 'center') {
                    const colH = (itemsInCol * colItemH) + ((itemsInCol - 1) * colGapY);
                    colStartY = startY + (usableH - colH) / 2;
                } else if (lastRowBehavior === 'left') {
                    // Treat "left" as "top" for vertical flow.
                    colStartY = gridStartY;
                }

                let x = gridStartX + (col * (itemW + gridGapX));
                let y = colStartY + (row * (colItemH + colGapY));

                x = clamp(x, startX, Math.max(startX, maxSlotX - itemW));
                y = clamp(y, startY, Math.max(startY, maxSlotY - colItemH));
                placeCard(card, x, y, itemW, colItemH, index);
                return;
            }

            // Last row handling:
            // - center: keep card size, center the row
            // - fill: keep card size, expand gaps to occupy full width (preserves label/card proportions)
            // - stretch: stretch card width to occupy full width
            // - left: keep card size, align left
            let rowItemW = itemW;
            let rowGapX = gridGapX;
            let rowStartX = gridStartX;

            if (isLastRow && itemsInRow < cols) {
                if (lastRowBehavior === 'fill' || lastRowBehavior === 'stretch') {
                    // Prefer stretching cards (consistent gap) instead of creating huge gaps between items.
                    rowItemW = (usableW - ((itemsInRow - 1) * gapX)) / Math.max(1, itemsInRow);
                    rowGapX = gapX;
                    rowStartX = startX;
                } else {
                    const rowW = (itemsInRow * rowItemW) + ((itemsInRow - 1) * rowGapX);
                    const shouldCenter =
                        lastRowBehavior === 'center';
                    if (shouldCenter) rowStartX = startX + (usableW - rowW) / 2;
                    else if (lastRowBehavior === 'left') rowStartX = gridStartX;
                }
            }

            let x = rowStartX + (col * (rowItemW + rowGapX));
            let y = gridStartY + (row * (itemH + gridGapY));

            x = clamp(x, startX, Math.max(startX, maxSlotX - rowItemW));
            y = clamp(y, startY, Math.max(startY, maxSlotY - itemH));
            placeCard(card, x, y, rowItemW, itemH, index);
          } catch (err) {
            console.warn(`[recalculateZoneLayout] Failed to place card ${index}:`, err);
          }
        });

        harmonizeProductCardTypography(cards);
        if (shouldRender) safeRequestRenderAll();
        if (shouldSave) saveCurrentState();
    }

    const rehydrateCanvasZones = (
        opts: {
            relayout?: boolean;
            applyZoneStyles?: boolean;
            applyGlobalLibraries?: boolean;
            recoverZoneSnapshots?: boolean;
            legacyImageRepairMode?: 'auto' | 'force' | 'skip';
        } = {}
    ): boolean => {
        if (!canvas.value) return false;
        invalidateZoneRuntimeIndex();
        const relayout = opts.relayout !== false;
        const applyZoneStyles = opts.applyZoneStyles !== false;
        const applyGlobalLibraries = opts.applyGlobalLibraries !== false;
        const recoverZoneSnapshots = opts.recoverZoneSnapshots !== false;
        const legacyImageRepairMode = opts.legacyImageRepairMode || 'auto';

        const prevHistory = isHistoryProcessing.value;
        let repairedTemplateFrameBindings = 0;
        isHistoryProcessing.value = true;
        try {
            let objs = canvas.value.getObjects();

            // Ensure IDs exist (used for parentZoneId mapping and selection)
            objs.forEach((o: any) => {
                if (!o._customId) o._customId = makeId();
            });

            // CRITICAL: Clear clipPath from all product zones to prevent rendering errors
            // Product zones should not have clipPath as cards are added separately to canvas
            objs.forEach((o: any) => {
                if (isMisnamedProductCardGroup(o)) {
                    const currentLayerName = String((o as any)?.layerName || '').trim();
                    const repairedName = currentLayerName && currentLayerName !== 'priceGroup'
                        ? currentLayerName
                        : 'product-card';
                    o.name = repairedName;
                    if (!currentLayerName || currentLayerName === 'priceGroup') {
                        (o as any).layerName = repairedName;
                    }
                }
                if (o.clipPath && (o.isGridZone || o.isProductZone || o.name === 'gridZone' || o.name === 'productZoneContainer')) {
                    o.clipPath = null;
                }
                // CRITICAL: Ensure all remaining clipPaths have _objects initialized
                // This prevents "forEach of undefined" errors in fabric.js createClipPathLayer
                if (o.clipPath && o.clipPath._objects === undefined) {
                    o.clipPath._objects = [];
                }

                // CRITICAL: Normalize product cards to Canva-like behavior:
                // - Default: select/move the whole card (subTargetCheck OFF)
                // - Double click: enable deep select for inner elements (handled elsewhere)
                // Also supports legacy projects where flags were not serialized yet (heuristic-based detection).
                // Only normalize objects that are explicitly tagged as product cards OR have
                // strong internal signals (offerBackground, priceGroup, _cardWidth).
                // This prevents generic groups from being mutated by rehydration heuristics.
                const hasStrongCardSignals = (obj: any) => {
                    if (obj.isProductCard || obj.isSmartObject) return true;
                    const children = typeof obj.getObjects === 'function' ? obj.getObjects() : [];
                    const hasOfferBg = children.some((c: any) => String(c?.name || '') === 'offerBackground');
                    const hasPriceGroup = children.some((c: any) => String(c?.type || '').toLowerCase() === 'group' && String(c?.name || '') === 'priceGroup');
                    const hasCardDims = Number.isFinite(Number((obj as any)?._cardWidth)) && Number((obj as any)?._cardWidth) > 0;
                    return hasOfferBg || hasPriceGroup || hasCardDims;
                };
                const isCardLike =
                    (o.isProductCard || o.isSmartObject || isLikelyProductCard(o)) &&
                    o.type === 'group' &&
                    !isLikelyPriceGroupObject(o) &&
                    hasStrongCardSignals(o);
                if (isCardLike) {
                    if (!o.isProductCard && !o.isSmartObject && isLikelyProductCard(o)) {
                        o.isProductCard = true;
                        o.isSmartObject = true;
                    }

                    // Normalize origin to center for stable containment math.
                    try {
                        const cp = typeof o.getCenterPoint === 'function'
                            ? o.getCenterPoint()
                            : { x: (o.left ?? 0), y: (o.top ?? 0) };
                        if (o.originX !== 'center' || o.originY !== 'center') {
                            o.set({ originX: 'center', originY: 'center', left: cp.x, top: cp.y });
                        }
                    } catch (e) {
                        // ignore
                    }
                    // Single-click deep select: user can click directly on inner elements.
                    if (o.subTargetCheck !== true) o.subTargetCheck = true;
                    if (o.interactive !== true) o.interactive = true;
                    if (o.selectable !== true) o.selectable = true;
                    if (o.evented !== true) o.evented = true;
                    // Ensure internal elements are selectable with controls
                    if (typeof o.getObjects === 'function') {
                        o.getObjects().forEach((child: any) => {
                            const childName = String(child?.name || '');
                            const isBackground = childName === 'offerBackground'
                                || childName === 'price_bg'
                                || childName === 'label_bg_image'
                                || childName === 'price_bg_image'
                                || childName === 'splash_image';
                            child.selectable = !isBackground;
                            child.evented = !isBackground;
                            child.hasControls = !isBackground;
                            child.hasBorders = !isBackground;
                            enableCardElementRotationControl(child, !isBackground);
                        });
                        const priceGroup = o.getObjects().find((child: any) => isPriceGroupObject(child));
                        if (priceGroup) setPriceGroupInteractionMode(priceGroup, 'move');
                    }
                }
            });

            // Re-apply custom rendering patches (e.g. per-corner rounded rects) recursively.
            const patchTree = (o: any) => {
                if (!o) return;
                if (isRectObject(o) && o.cornerRadii) applyRectCornerRadiiPatch(o);
                // Re-apply sticker outline patch for images loaded from JSON
                if (String(o.type || '').toLowerCase() === 'image' && o.__stickerOutlineEnabled) {
                    applyStickerOutlinePatch(o);
                    // Images may not have their element loaded yet after loadFromJSON
                    // Schedule additional retries to ensure outline is generated
                    setTimeout(() => {
                        if (o.__stickerOutlineEnabled && !o.__stickerOutlineCache) {
                            applyStickerOutlinePatch(o);
                        }
                    }, 1500);
                    setTimeout(() => {
                        if (o.__stickerOutlineEnabled && !o.__stickerOutlineCache) {
                            applyStickerOutlinePatch(o);
                        }
                    }, 4000);
                }
                if (o.type === 'group' && typeof o.getObjects === 'function') {
                    o.getObjects().forEach((c: any) => patchTree(c));
                }
            };
            objs.forEach((o: any) => patchTree(o));

            const isFrameLike = (o: any) => {
                if (!o) return false;
                const nRaw = (o?.name ?? '').toString();
                const n = nRaw.toUpperCase();
                // Prefer explicit flag.
                if (o?.isFrame) return true;
                // Common legacy names.
                if (n === 'FRAME' || n === 'FRAMER' || /^FRAME\s+\d+\s*$/i.test(nRaw)) return true;
                // Heuristic for older saves where custom props were missing:
                // A Frame is a Rect with clipContent + Figma blue stroke.
                const stroke = (o?.stroke ?? '').toString().toLowerCase();
                const isRect = isRectObject(o) || o?.type === 'rect';
                if (isRect && (o?.clipContent === true || o?.clipContent === 1) && stroke === '#0d99ff') return true;
                return false;
            };

            // Frames: restore flags + clip behavior
            const frames = objs.filter((o: any) => isFrameLike(o));

            // Normalize default Frame names (Figma-like): Frame 1, Frame 2, ...
            // Only touch frames that were never explicitly renamed (no layerName) and have a generic name.
            let maxFrameN = 0;
            frames.forEach((f: any) => {
                const n = (f?.layerName || f?.name || '').toString();
                const m = /^Frame\s+(\d+)\s*$/i.exec(n);
                if (m) maxFrameN = Math.max(maxFrameN, Number(m[1] || 0));
            });
            const nextFrameName = () => `Frame ${++maxFrameN}`;
            frames.forEach((f: any) => {
                // CRITICAL: Always restore isFrame flag (even if missing from JSON)
                f.isFrame = true;
                if (typeof f.clipContent !== 'boolean') f.clipContent = true;

                // CRITICAL: Ensure frames always have originX='center' and originY='center'.
                // Preserve the visual center while normalizing. Changing originX/originY
                // directly shifts legacy frames on reload, which then breaks clipping and
                // parentFrameId geometry.
                if (f.originX !== 'center' || f.originY !== 'center') {
                    try {
                        const center = typeof f.getCenterPoint === 'function'
                            ? f.getCenterPoint()
                            : { x: Number(f.left || 0), y: Number(f.top || 0) };
                        f.set?.({
                            originX: 'center',
                            originY: 'center',
                            left: Number(center?.x ?? f.left ?? 0),
                            top: Number(center?.y ?? f.top ?? 0)
                        });
                    } catch {
                        f.originX = 'center';
                        f.originY = 'center';
                    }
                    f.setCoords?.();
                }

                // Normalize name: if user renamed via layerName, keep it. Otherwise ensure proper "Frame N" name.
                if (!f.layerName) {
                    const n = (f?.name || '').toString().trim();
                    const isGeneric = !n || /^frame$/i.test(n) || /^framer$/i.test(n) || /^ret(â|a)ngulo$/i.test(n);
                    const isNumbered = /^Frame\s+\d+\s*$/i.test(n);
                    if (isGeneric) {
                        // Force normalize generic names to "Frame N"
                        f.name = nextFrameName();
                        console.log(`🔄 Frame normalizado: "${n}" → "${f.name}"`);
                    } else if (!isNumbered && !/^Frame\s+\d+/.test(n)) {
                        // Custom name - leave as-is but ensure it's not empty
                        if (!f.name) f.name = nextFrameName();
                    }
                } else {
                    // User renamed - keep layerName, but also ensure name is set for display
                    if (!f.name || /^ret(â|a)ngulo$/i.test(f.name)) {
                        f.name = f.layerName;
                    }
                }

                // Ensure stroke is Figma blue if missing (helps with detection)
                if (!f.stroke || String(f.stroke).toLowerCase() !== '#0d99ff') {
                    f.stroke = '#0d99ff';
                }

                if (isRectObject(f) && f.cornerRadii) applyRectCornerRadiiPatch(f);
                getOrCreateFrameClipRect(f);
            });

            repairedTemplateFrameBindings = restoreTemplateCompositionFrameBindings(objs);
            if (repairedTemplateFrameBindings > 0) {
                console.info(
                    `[frame-clip] Restaurado o vínculo de ${repairedTemplateFrameBindings} elemento(s) de modelo ao Frame.`
                );
            }

            const frameIds = new Set<string>(frames.map((f: any) => f._customId).filter(Boolean));
            objs.forEach((o: any) => {
                if (o?.parentFrameId && !frameIds.has(o.parentFrameId)) {
                    o.parentFrameId = undefined;
                    if (o._frameClipOwner) {
                        o.clipPath = null;
                        delete o._frameClipOwner;
                    }
                }
            });

            // Um parentFrameId válido permanece mesmo que o objeto esteja fora da
            // geometria atual do Frame. Isso conserva o recorte após salvar e
            // recarregar, em vez de revelar elementos que ultrapassam a borda.

            // Re-apply clipPaths using shared frame clip rects (prevents stale deserialized clip rects).
            objs.forEach((o: any) => {
                if (o?.parentFrameId || o?._frameClipOwner) syncObjectFrameClip(o);
            });
            frames.forEach((f: any) => syncFrameClips(f));

            // Remove legacy zone rectangles from the deprecated renderer.
            // Keeping them causes duplicate/overlapping zone behaviors after spacing edits.
            const legacyZoneRects = objs.filter((o: any) =>
                o?.type === 'rect' &&
                (
                    o?.id === 'product_zone_container' ||
                    o?.name === 'product_zone_container' ||
                    (o?.isZone === true && o?.isProductZone === true)
                )
            );
            if (legacyZoneRects.length > 0) {
                legacyZoneRects.forEach((o: any) => {
                    canvas.value.remove(o);
                });
                console.log(`[rehydrateCanvasZones] Removed ${legacyZoneRects.length} legacy zone rect(s)`);
                objs = canvas.value.getObjects();
            }

            let zones = objs.filter((o: any) => o?.type === 'group' && isLikelyProductZone(o));

            if (zones.length > 0) {
                console.log(`[rehydrateCanvasZones] Detectadas ${zones.length} zona(s) de produtos:`, zones.map((z: any) => ({
                    id: z._customId,
                    name: z.name,
                    visible: z.visible,
                    left: Math.round(z.left ?? 0),
                    top: Math.round(z.top ?? 0),
                    width: Math.round(z._zoneWidth ?? z.width ?? 0),
                    height: Math.round(z._zoneHeight ?? z.height ?? 0),
                    children: typeof z.getObjects === 'function' ? z.getObjects().length : 0,
                    isGridZone: z.isGridZone,
                    isProductZone: z.isProductZone,
                    parentFrameId: z.parentFrameId
                })));
            }

            // FIX: Multiple zones per frame are fully supported — the user can have as many
            // product zones as needed. If two zones share the EXACT SAME _customId (corruption),
            // regenerate the duplicate's ID instead of removing it. This prevents zones from
            // disappearing after save/reload.
            if (zones.length > 1) {
                const seenIds = new Set<string>();
                zones.forEach((z: any) => {
                    const zid = String((z as any)._customId || '').trim();
                    if (!zid) return;
                    if (seenIds.has(zid)) {
                        // Mesmo _customId — regenerar em vez de remover
                        const oldId = z._customId;
                        z._customId = makeId();
                        seenIds.add(z._customId);
                        console.warn(`[rehydrateCanvasZones] Zona com _customId duplicado. Regenerado: ${oldId} -> ${z._customId}`);
                    } else {
                        seenIds.add(zid);
                    }
                });
            }

            restoreMissingManualTemplateFlagsInCanvas(canvas.value, 'rehydrate');

            // O marcador de página também é espelhado na zona. Assim os caminhos
            // assíncronos (watchers de biblioteca, troca de página e rehydrate)
            // continuam sabendo que essa zona pertence à composição do modelo,
            // mesmo quando a página ainda está sendo carregada.
            if (isTemplateCompositionManagedPage()) {
                if (activePage.value) activePage.value.templateCompositionManaged = true
                zones.forEach((z: any) => {
                    z.templateCompositionManaged = true
                })
            }

            zones.forEach((z: any) => {
                if (z.name === 'gridZone') z.isGridZone = true;
                if (z.name === 'productZoneContainer') z.isProductZone = true;
                if (!z.isGridZone && !z.isProductZone) z.isGridZone = true;
                if (!(z as any).zoneName) (z as any).zoneName = getNextProductZoneName(z);
                if (!(z as any).role) (z as any).role = 'grid';
                if (!(z as any).contentSource) (z as any).contentSource = 'manual';
                if (!(z as any).overflowPolicy) (z as any).overflowPolicy = 'warn';
                getResolvedZoneFrameId(z);

                // CRITICAL: Clear clipPath from zone AND all its children
                if (z.clipPath) {
                    z.clipPath = null;
                }
                if (typeof z.getObjects === 'function') {
                    z.getObjects().forEach((child: any) => {
                        if (child.clipPath) {
                            child.clipPath = null;
                        }
                    });
                }

                // Keep persisted visibility, but never show a zone whose parent frame is hidden.
                const zoneFrameId = String((z as any).parentFrameId || '').trim();
                const hiddenByFrame = !!(zoneFrameId && getFrameById(zoneFrameId)?.visible === false);
                // FIX: Force zones visible unless hidden by frame (same rationale as cards above).
                if (!hiddenByFrame) z.visible = true;
                else z.visible = false;
                if (typeof z.opacity !== 'number') z.opacity = 1;
                if (!hiddenByFrame && z.opacity === 0) z.opacity = 1;

                ensureZoneSanity(z);

                // Zones should start with no background by default.
                // Fabric defaults rect fill to black when fill is unset/undefined; we normalize using `z.backgroundColor`.
                const zr = getZoneRect(z);
                if (zr) {
                    const desired = typeof (z as any).backgroundColor === 'string' ? String((z as any).backgroundColor).trim() : '';
                    if (!desired || desired === 'transparent') {
                        zr.set('fill', 'transparent');
                    } else {
                        zr.set('fill', desired);
                    }
                }

                // Undo/redo must restore the exact snapshot geometry. Normalizing a
                // zone scale here changes its width/height and can move the whole
                // layout even though the history entry itself is valid.
                if (relayout) normalizeZoneScale(z);
                // NOTE: safeAddWithUpdate is already called inside normalizeZoneScale ->
                // applyZoneScaleToRect.  Calling it again here would recalculate group
                // bounds a second time, potentially shifting zone.left/top without
                // compensating child cards (causing them to escape the zone).
                // If scaleX/Y were already 1 (normalizeZoneScale bailed early), we still
                // need to ensure coords are fresh for getBoundingRect to work in relayout.
                z.setCoords?.();


                const rawZoneStyles = (z as any)._zoneGlobalStyles;
                const hasPersistedZoneStyles =
                    !!rawZoneStyles &&
                    typeof rawZoneStyles === 'object' &&
                    !Array.isArray(rawZoneStyles);

                // Normalizar sempre que _zoneGlobalStyles existir (mesmo parcial/vazio).
                // Objeto vazio significa "manter defaults, sem overrides" — diferente de undefined.
                if (hasPersistedZoneStyles) {
                    (z as any)._zoneGlobalStyles = normalizeGlobalStyles(rawZoneStyles as Partial<GlobalStyles>);
                }
                const zoneStyles = hasPersistedZoneStyles ? getZoneGlobalStyles(z) : null;
                if (applyZoneStyles && zoneStyles) {
                    const zoneCards = getZoneChildren(z);
                    if (zoneCards.length > 0) {
                        applyGlobalStylesToCards(zoneStyles, z);
                    } else if (import.meta.dev) {
                        console.debug('[rehydrateCanvasZones] Zone has no cards; skipping style reapply:', z._customId);
                    }
                }
                syncZoneDerivedMetadata(z);
            });

            ensureProductZoneNamesDistinct(zones);

            // ═══════════════════════════════════════════════════════════════════
            // CRITICAL FIX: Sync composable state from persisted zone data.
            // After reload the composable starts with DEFAULT_GLOBAL_STYLES / DEFAULT_PRODUCT_ZONE.
            // The real source of truth lives on the Fabric zone object (_zoneGlobalStyles + zone props).
            // Without this sync, the ProductZoneSettings UI shows stale defaults until the user
            // manually clicks the zone (which triggers refreshSelectedRef).
            // ═══════════════════════════════════════════════════════════════════
            if (zones.length > 0) {
                const resolvedZoneForSync = (() => {
                    const current = getCurrentZoneObject();
                    if (current && zones.includes(current)) return current;
                    if (zones.length === 1) return zones[0];
                    // Fallback: usar a primeira zona que tenha estilos persistidos
                    const withStyles = zones.find((z: any) => z._zoneGlobalStyles && typeof z._zoneGlobalStyles === 'object');
                    if (withStyles) return withStyles;
                    // Último fallback: primeira zona disponível (NUNCA retornar null se há zonas)
                    return zones[0];
                })();

                if (resolvedZoneForSync) {
                    const pad = typeof resolvedZoneForSync._zonePadding === 'number'
                        ? resolvedZoneForSync._zonePadding
                        : (typeof resolvedZoneForSync.padding === 'number' ? resolvedZoneForSync.padding : 20);
                    const zoneConfig: ProductZone = {
                        ...DEFAULT_PRODUCT_ZONE,
                        enabled: true,
                        name: resolvedZoneForSync.zoneName || 'Zona de Produtos',
                        columns: resolvedZoneForSync.columns || 0,
                        rows: resolvedZoneForSync.rows || 0,
                        padding: pad,
                        gapHorizontal: typeof resolvedZoneForSync.gapHorizontal === 'number' ? resolvedZoneForSync.gapHorizontal : pad,
                        gapVertical: typeof resolvedZoneForSync.gapVertical === 'number' ? resolvedZoneForSync.gapVertical : pad,
                        layoutDirection: resolvedZoneForSync.layoutDirection || 'horizontal',
                        cardAspectRatio: resolvedZoneForSync.cardAspectRatio || 'fill',
                        lastRowBehavior: resolvedZoneForSync.lastRowBehavior || 'fill',
                        verticalAlign: resolvedZoneForSync.verticalAlign || 'stretch',
                        structureByProductCountEnabled: resolvedZoneForSync.structureByProductCountEnabled !== false,
                        structureByProductCount: resolvedZoneForSync.structureByProductCount,
                        structureVariantsByProductCount: resolvedZoneForSync.structureVariantsByProductCount,
                        structureVariantByProductCount: resolvedZoneForSync.structureVariantByProductCount,
                        highlightCount: resolvedZoneForSync.highlightCount || 0,
                        highlightPos: resolvedZoneForSync.highlightPos || 'first',
                        highlightSelection: resolvedZoneForSync.highlightSelection || resolvedZoneForSync.highlightPos || 'first',
                        highlightIndexes: resolvedZoneForSync.highlightIndexes || [1],
                        highlightHeight: resolvedZoneForSync.highlightHeight || 1.5,
                        role: resolvedZoneForSync.role || 'grid',
                        contentSource: resolvedZoneForSync.contentSource || 'manual',
                        contentStatus: resolvedZoneForSync.contentStatus || 'filled',
                        overflowPolicy: resolvedZoneForSync.overflowPolicy || 'warn',
                    };
                    productZoneState.globalStyles.value = getZoneGlobalStyles(resolvedZoneForSync);
                    productZoneState.productZone.value = zoneConfig;
                }
                // NUNCA resetar para defaults quando há zonas — preservar estado existente do composable
            }


            const zonesById = new Map<string, any>();
            zones.forEach((z: any) => zonesById.set(z._customId, z));

            const cards = objs.filter((o: any) => (o?.isSmartObject || o?.isProductCard || isLikelyProductCard(o)) && o !== null && o !== undefined);

            const validZoneIds = new Set<string>(zones.map((z: any) => String(z?._customId || '').trim()).filter(Boolean));
            const hadAnyValidBinding = cards.some((c: any) => {
                const id = String(c?.parentZoneId || '').trim();
                return id && validZoneIds.has(id);
            });

            // CRITICAL: Ensure all product cards are visible and have valid properties
            cards.forEach((card: any) => {
                if (!card.isProductCard && !card.isSmartObject && isLikelyProductCard(card)) {
                    card.isProductCard = true;
                    card.isSmartObject = true;
                }
                // Keep persisted visibility, but never show cards whose frame is hidden.
                let cardFrameId = String((card as any).parentFrameId || '').trim();
                if (!cardFrameId) {
                    const zoneId = String((card as any).parentZoneId || (card as any)?._zoneSlot?.zoneId || '').trim();
                    const boundZone = zoneId ? zonesById.get(zoneId) : null;
                    const fallbackFrameId = String((boundZone as any)?.parentFrameId || '').trim();
                    if (fallbackFrameId) {
                        cardFrameId = fallbackFrameId;
                        (card as any).parentFrameId = fallbackFrameId;
                    }
                }
                const cardHiddenByFrame = !!(cardFrameId && getFrameById(cardFrameId)?.visible === false);
                // FIX: ALWAYS force visible:true for cards not hidden by frame.
                // Previously we only set visible when `typeof visible !== 'boolean'`,
                // but viewport culling could have saved cards with visible:false.
                // The __viewportCulled flag is transient (not in CANVAS_CUSTOM_PROPS),
                // so on reload we cannot distinguish culled-hidden from intentionally-hidden.
                // Product cards should ALWAYS be visible unless their parent frame is hidden.
                if (!cardHiddenByFrame) card.visible = true;
                else card.visible = false;
                if (typeof card.opacity !== 'number') card.opacity = 1;
                if (!cardHiddenByFrame && card.opacity === 0) card.opacity = 1;

                // CRITICAL: Disable objectCaching on cards after reload.
                // During creation, cards get objectCaching:false, but this prop is NOT
                // in CANVAS_CUSTOM_PROPS so it reverts to true after loadFromJSON.
                // Without this, style changes via resizeSmartObject may not render.
                card.set({ objectCaching: false, statefullCache: false, dirty: true });

                // CRITICAL: Permanently disable Fabric v7 LayoutManager on card groups.
                // Card layout is fully managed by resizeSmartObject — Fabric's auto-layout
                // only causes corruption by recalculating bounds from children at stale positions.
                const cardLm = (card as any).layoutManager;
                if (cardLm && cardLm.performLayout) cardLm.performLayout = () => {};

                // Restore saved dimensions — LayoutManager may have corrupted them
                // between loadFromJSON and this rehydrate code.
                const savedW = Number((card as any)._cardWidth) || 0;
                const savedH = Number((card as any)._cardHeight) || 0;
                if (savedW > 0 && savedH > 0) {
                    card.set({ width: savedW, height: savedH });
                }

                // Also disable caching and LayoutManager on nested groups (e.g. priceGroup)
                if (typeof card.getObjects === 'function') {
                    card.getObjects().forEach((child: any) => {
                        if (child && child.type === 'group') {
                            child.set({ objectCaching: false, statefullCache: false, dirty: true });
                            const nestedLm = (child as any).layoutManager;
                            if (nestedLm && nestedLm.performLayout) nestedLm.performLayout = () => {};
                            if (isPriceGroupObject(child)) setPriceGroupInteractionMode(child, 'move');
                        }
                    });
                }

                // Prevent random black rectangles: Fabric defaults rect fill to black when fill is unset/undefined.
                // If a card's background fill becomes invalid, restore a safe default.
                if (card.type === 'group' && typeof card.getObjects === 'function') {
                    const bg = card.getObjects().find((c: any) => c?.name === 'offerBackground' && c?.type === 'rect');
                    if (bg && (bg.fill === undefined || bg.fill === null || bg.fill === '')) {
                        bg.set('fill', 'transparent');
                    }
                }

                // Ensure the card is properly initialized
                if (typeof card.setCoords === 'function') card.setCoords();
            });


            // Auto-repair legacy/corrupted image transforms inside product cards
            // (negative scales, flips, invalid dimensions) before reflowing zone layout.
            const shouldRunLegacyImageRepair = legacyImageRepairMode !== 'skip';
            const repairStats = shouldRunLegacyImageRepair
                ? repairLegacyProductCardImageTransforms(cards, { verbose: import.meta.dev })
                : { cardsScanned: 0, imagesScanned: 0, imagesRepaired: 0 };
            if (import.meta.dev && repairStats.imagesRepaired > 0) {
                console.log('[rehydrateCanvasZones] Legacy image repair applied:', repairStats);
            }

            // CRITICAL FIX: Repair atacarejo price text names and re-apply pricing.
            // During initial creation, Fabric v7 dropped text names → setPriceOnPriceGroup
            // renamed them to `price_*` → applyAtacarejoPricingToPriceGroup couldn't find
            // `retail_*` names → retail tier was saved with empty text content.
            // This repair step fixes names and re-populates prices from stored _productData.
            cards.forEach((card: any) => {
                if (!card || card.type !== 'group' || typeof card.getObjects !== 'function') return;
                const productData = (card as any)?._productData;
                if (!productData || typeof productData !== 'object') return;

                // Find the priceGroup inside the card
                const children = card.getObjects() || [];
                const priceGroup = children.find((c: any) =>
                    c?.type === 'group' && (c?.name === 'priceGroup' || String(c?.name || '').includes('price'))
                );
                if (!priceGroup || typeof priceGroup.getObjects !== 'function') return;

                // Check if this is an atacarejo template (has atac_retail_bg)
                const pgChildren = collectObjectsDeep(priceGroup);
                const hasAtacBg = pgChildren.some((o: any) => o?.name === 'atac_retail_bg');
                if (!hasAtacBg) return;

                // Check if retail tier is missing prices (empty or just "R$")
                const retailInteger = pgChildren.find((o: any) => o?.name === 'retail_integer_text');
                const hasPriceIntNamedCorrectly = !!retailInteger;
                const retailIntText = String(retailInteger?.text || '').trim();
                const retailMissing = !hasPriceIntNamedCorrectly || !retailIntText || retailIntText === '0';

                if (retailMissing) {
                    // Re-apply atacarejo pricing from stored product data
                    try {
                        applyAtacarejoPricingToPriceGroup(priceGroup, productData);
                    } catch (e) {
                        // ignore repair failures
                    }
                }
            });

            // Repair missing parentZoneId by intersection (helps after old history/undo states)
            const cardsWithSavedParentZone = new Set<any>();
            cards.forEach((card: any) => {
                if (!card._customId) card._customId = makeId();
                if (card._cardWidth == null) card._cardWidth = card.width;
                if (card._cardHeight == null) card._cardHeight = card.height;

                // If card already has a valid parentZoneId from saved data, preserve it
                // only when the zone lives in the same frame. Older duplicated frames can
                // contain cards whose parentFrameId points at the copy while parentZoneId
                // still points at the original zone, making replacement hit the original.
                if (card.parentZoneId && zonesById.has(card.parentZoneId)) {
                    const boundZone = zonesById.get(card.parentZoneId);
                    const boundZoneFrameId = String(getResolvedZoneFrameId(boundZone) || (boundZone as any)?.parentFrameId || '').trim();
                    const currentCardFrameId = String((card as any)?.parentFrameId || '').trim();
                    if (!currentCardFrameId || !boundZoneFrameId || currentCardFrameId === boundZoneFrameId) {
                        cardsWithSavedParentZone.add(card);
                        return;
                    }
                }

                // Only repair cards that are missing parentZoneId
                card.parentZoneId = undefined;

                const center = typeof card.getCenterPoint === 'function'
                    ? card.getCenterPoint()
                    : { x: (card.left ?? 0), y: (card.top ?? 0) };

                let bestZone: any = null;
                let bestD2 = Infinity;

                for (const zone of zones) {
                    if (zone.intersectsWithObject && zone.intersectsWithObject(card)) {
                        card.parentZoneId = zone._customId;
                        bestZone = null;
                        bestD2 = Infinity;
                        break;
                    }

                    // Fallback: distance from card center to zone rect (more robust than center-to-center).
                    const zm = getZoneMetrics(zone) ?? zone.getBoundingRect(true);
                    const dx = (center.x < zm.left)
                        ? (zm.left - center.x)
                        : (center.x > (zm.left + zm.width))
                            ? (center.x - (zm.left + zm.width))
                            : 0;
                    const dy = (center.y < zm.top)
                        ? (zm.top - center.y)
                        : (center.y > (zm.top + zm.height))
                            ? (center.y - (zm.top + zm.height))
                            : 0;
                    const d2 = (dx * dx) + (dy * dy);
                    if (d2 < bestD2) {
                        bestD2 = d2;
                        bestZone = zone;
                    }
                }

                // If not intersecting any zone, attach to the nearest one only if it's reasonably close.
                if (!card.parentZoneId && bestZone) {
                    // If there's only one zone, legacy projects often lost the IDs entirely.
                    // In that case, bind every card-like group to the single zone so the layout can be reconstructed.
                    if (zones.length === 1) {
                        card.parentZoneId = bestZone._customId;
                    } else {
                        const zm = getZoneMetrics(bestZone) ?? bestZone.getBoundingRect(true);
                        const maxDim = Math.max(zm.width || 0, zm.height || 0);

                        // More aggressive repair if the project has no valid bindings at all (classic "solto" legacy state).
                        const base = hadAnyValidBinding ? 2.5 : 6.0;
                        const maxD = Math.max(200, maxDim * base);
                        if (Number.isFinite(bestD2) && bestD2 <= (maxD * maxD)) {
                            card.parentZoneId = bestZone._customId;
                        }
                    }
                }

                // Se o _zoneSlot aponta para uma zona diferente da resolvida acima,
                // invalidamos o slot para forcar recalculateZoneLayout a reatribuir um slot
                // valido. Sem isso o card ficaria posicionado no slot de uma zona que
                // ja nao e sua pai — UI diverge do JSON apos undo/redo ou reload.
                const repairedZid = String((card as any)?.parentZoneId || '').trim();
                const slotZid = String((card as any)?._zoneSlot?.zoneId || '').trim();
                if (repairedZid && slotZid && slotZid !== repairedZid) {
                    (card as any)._zoneSlot = null;
                }
                normalizeProductCardIdentity(card, {
                    zoneInstanceId: repairedZid || null,
                    reason: 'rehydrate-card'
                });
            });


            // Keep card → frame binding aligned with its zone frame.
            cards.forEach((card: any) => {
                const zoneId = String((card as any)?.parentZoneId || '').trim();
                if (!zoneId) return;
                const zone = zonesById.get(zoneId);
                if (!zone) return;
                const zoneFrameId = getResolvedZoneFrameId(zone);
                applyCardFrameBinding(card, zoneFrameId);
            });

            const zoneIdsWithCards = new Set<string>();
            cards.forEach((c: any) => {
                if (typeof c.parentZoneId === 'string') zoneIdsWithCards.add(c.parentZoneId);
            });
            zones.forEach((z: any) => {
                if (zoneIdsWithCards.has(z._customId)) z.isProductZone = true;
            });

            if (relayout) {
                zones.forEach((z: any) => {
                    if (z.isProductZone || zoneIdsWithCards.has(z._customId)) {
                        try {
                            const zoneCards = cards.filter((c: any) => String((c as any).parentZoneId || '').trim() === String(z._customId || '').trim());
                            // CRITICAL FIX: Do NOT force relayout if cards already have valid
                            // saved positions from JSON. Relaying out overwrites saved left/top/width/height
                            // with grid-computed values, destroying the exact layout the user saved.
                            // Only relayout if cards are clearly missing positions (all at 0,0 or NaN).
                            const allHavePositions = zoneCards.length > 0 && zoneCards.every((c: any) => {
                                const l = Number(c.left ?? NaN);
                                const t = Number(c.top ?? NaN);
                                return Number.isFinite(l) && Number.isFinite(t);
                            });
                            const allAtOrigin = zoneCards.length > 1 && zoneCards.every((c: any) => {
                                return Math.abs(Number(c.left ?? 0)) < 2 && Math.abs(Number(c.top ?? 0)) < 2;
                            });
                            const preserveTemplateLayout = isTemplateCompositionManagedZone(z)
                            if (allHavePositions && !allAtOrigin && (
                                preserveTemplateLayout || !productZoneStructuresState.isLoaded.value
                            )) {
                                // O modelo já salvou a posição dos cards. Preservá-la
                                // evita que a chegada da biblioteca global ou a troca
                                // de página destrua a composição visual original.
                                zoneCards.forEach((c: any) => c.setCoords?.());
                            } else {
                                // Só zonas comuns, ou cards sem posição válida, usam
                                // a receita global para reconstruir o grid.
                                recalculateZoneLayout(z, zoneCards, { skipResize: true });
                            }
                        } catch (err) {
                            console.warn('[rehydrateCanvasZones] Failed to relayout zone', err);
                        }
                    }
                });
            }

            if (recoverZoneSnapshots) {
                scheduleZoneSnapshotRecovery(zones, 'rehydrate');
            }

            // Ensure zones never sit above their cards (legacy saved designs sometimes have wrong stacking order).
            // If the zone is above the cards, it intercepts clicks and prevents selecting products individually.
            try {
                const c: any = canvas.value as any;
                if (typeof c.moveTo === 'function') {
                    zones.forEach((z: any) => {
                        const list = canvas.value!.getObjects();
                        const zoneIndex = list.indexOf(z);
                        if (zoneIndex < 0) return;

                        const zoneCardIndices: number[] = [];
                        for (let i = 0; i < list.length; i++) {
                            const o = list[i];
                            if (!o || o === z) continue;
                            const isCard = !!(o.isSmartObject || o.isProductCard || isLikelyProductCard(o));
                            if (!isCard) continue;
                            if ((o as any).parentZoneId === z._customId) zoneCardIndices.push(i);
                        }
                        if (!zoneCardIndices.length) return;

                        const minCardIndex = Math.min(...zoneCardIndices);
                        if (!Number.isFinite(minCardIndex)) return;

                        // Keep it above artboard-bg and frames.
                        const bgIndex = list.findIndex((o: any) => o?.id === 'artboard-bg');
                        let floorIndex = bgIndex >= 0 ? bgIndex + 1 : 0;
                        for (let i = 0; i < list.length; i++) {
                            if (list[i]?.isFrame) floorIndex = Math.max(floorIndex, i + 1);
                        }

                        const targetIndex = Math.max(floorIndex, minCardIndex - 1);
                        if (zoneIndex > targetIndex) c.moveTo(z, targetIndex);
                    });
                }
            } catch (e) {
                // Ignore stacking errors
            }

            // Frames sempre atrás do conteúdo (evita bloquear drag do mouse em imagens)
            if (relayout) ensureFramesBelowContents();
            if (relayout) {
                const priceLayoutRecovery = stabilizePriceGroupsForPersistence(canvas.value, 'rehydrate');
                // A recuperação acontece depois do JSON remoto ser desserializado. Sem
                // este flush, a correção só existia na memória e o próximo reload
                // voltava a receber o texto fora da etiqueta.
                if (priceLayoutRecovery.fixed > 0) {
                    scheduleIdleStatePersistence({
                        reason: 'price-layout-recovery',
                        source: 'system',
                        markUnsaved: true,
                        skipIfUnchanged: true
                    }, 240);
                }
            }
            scheduleMissingProductImageRecovery();

            // As bibliotecas externas podem chegar antes ou depois do loadFromJSON.
            // Reaplicar aqui fecha os dois caminhos sem depender da ordem entre
            // boot, carregamento do projeto e eventos de sincronizacao.
            if (applyGlobalLibraries) {
                invalidateZoneRuntimeIndex();
                applyGlobalProductZoneStructuresToCanvas('rehydrate-zone-structures');
                applyGlobalProductCardConfigurationToCanvas('rehydrate-card-configuration');
            }

            // Etiquetas precisam ser reconciliadas também no fallback offline
            // (`__labelTemplates` do próprio projeto). Antes isso ficava preso ao
            // bloco de bibliotecas globais autenticadas e cards antigos podiam
            // continuar com um grupo visual divergente após o reload.
            if (hasUsableLabelTemplateCatalog()) {
                void applyGlobalLabelTemplatesToCanvas('rehydrate-label-templates');
            }

            // Auto-trim runs asynchronously after hydration. The synchronous pixel
            // scan used to block the loading state for large product images.
            scheduleCanvasImagesAutoTrim();

            invalidateZoneRuntimeIndex();
            refreshSelectedRef();
            refreshCanvasObjects();
            safeRequestRenderAll();
        } finally {
            isHistoryProcessing.value = prevHistory;
        }

        return repairedTemplateFrameBindings > 0;
    }

    return {
        createSmartObject,
        simulateSmartGrid,
        applyGlobalStylePropToCardFast,
        applyGlobalStylesToCards,
        applyLabelTemplateToCard,
        applyLabelTemplateToZone,
        ensureZoneSanity,
        recalculateZoneLayout,
        rehydrateCanvasZones
    }
}

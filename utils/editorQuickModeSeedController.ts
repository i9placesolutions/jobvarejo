type QuickEditorSeed = any

import { DEFAULT_EDITOR_FONT_FAMILY } from './font-catalog'

export type EditorQuickModeSeedContext = Record<string, any>

/**
 * Materializa encartes rápidos e os modelos de referência sem misturar essa
 * rotina de criação com a interação diária do canvas.
 */
export const createEditorQuickModeSeedController = (ctx: EditorQuickModeSeedContext) => {
    const {
        DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT,
        MES_DO_CONSUMIDOR_ASSETS,
        MES_DO_CONSUMIDOR_COLORS,
        QUICK_EDITOR_SEED_VERSION,
        REFERENCE_FLYER_ASSETS,
        STORE_DYNAMIC_FIELDS,
        activePage,
        addFrame,
        addGridZone,
        applyQuickBusinessProfileBindings,
        canvas,
        clearQuickSeedStorage,
        configureDynamicBusinessTextObject,
        createQuickLogoSlot,
        ensureFramesBelowContents,
        ensureQuickPageThumbnail,
        ensureTemplateProductZone,
        ensureZoneSanity,
        fabric,
        fitDynamicBusinessTextObject,
        flushPersistenceNow,
        formatBusinessPaymentMethods,
        formatQuickValidity,
        getCurrentProductZonePreviewFormat,
        getDynamicBusinessTextOptions,
        getFlyerTemplateFormat,
        getFrameBounds,
        getMesDoConsumidorAssetUrl,
        getMesDoConsumidorLayout,
        getQuickBusinessProfileValue,
        getQuickLogoSlotMetrics,
        getQuickSeedStorageValue,
        getReferenceFlyerAssetUrl,
        getReferenceFlyerLayout,
        getZoneRect,
        hydrateQuickModeDataFromCanvas,
        inferOfferValidityMode,
        isCanvasDestroyed,
        isDesignLoading,
        isDynamicBusinessFieldObject,
        isFabricReady,
        isInitialDesignLoadDone,
        isLikelyProductZone,
        isProjectLoaded,
        isReferenceFlyerPresetId,
        isTemplateCompositionManagedPage,
        makeCanvasObjectId,
        makeId,
        materializeMesDoConsumidorAllTemplatePages,
        materializeTemplateSeedPage,
        normalizeGlobalStyles,
        normalizeOfferValidityMode,
        normalizeOfferValidityScope,
        productCardConfigurationState,
        productZoneStructuresState,
        project,
        quickBusinessFieldOverrides,
        quickBusinessProfile,
        quickOfferScope,
        quickSeedAppliedForProjectId,
        quickShowValidity,
        quickValidityEndDate,
        quickValidityMode,
        quickValidityStartDate,
        quickValidityWhileStocks,
        refreshCanvasObjects,
        repairQuickModeLegacyTemplatePages,
        safeRequestRenderAll,
        saveCurrentState,
        scheduleCenteredZoomToFit,
        setActiveProductZone,
        simulateSmartGrid,
        syncObjectFrameClip,
        zoomToFit,
    } = ctx

    const materializeMesDoConsumidorTemplatePage = async (
        seed: QuickEditorSeed,
        theme: Record<string, any>,
        plan: {
            modelId: string
            modelName: string
            formatId: string
            formatLabel: string
            modelIndex: number
            formatIndex: number
        }
    ): Promise<boolean> => {
        if (!canvas.value || !activePage.value || !fabric) return false

        const width = Math.max(320, Math.round(Number(activePage.value.width || seed.width || 1080)))
        const height = Math.max(320, Math.round(Number(activePage.value.height || seed.height || 1350)))
        const layout = getMesDoConsumidorLayout(plan.formatId)
        const seedId = String(seed.id || '')

        // Um modelo novo já nasce com um Frame branco vazio. Reaproveitamos esse
        // container em vez de criar outro ao lado: cada página do preset fica com
        // uma única prancheta exportável e não sobra uma área branca no canvas.
        const existingObjects = canvas.value.getObjects()
        let frame = existingObjects
            .filter((object: any) => {
                if (!object?.isFrame || object?.templateCompositionManaged || object?.quickSeedId) return false
                const frameObjectId = String(object?._customId || '').trim()
                if (!frameObjectId) return false
                return !existingObjects.some((candidate: any) => (
                    candidate !== object && String(candidate?.parentFrameId || '').trim() === frameObjectId
                ))
            })
            .slice(-1)[0] as any
        if (!frame) {
            addFrame({ width, height })
            frame = [...canvas.value.getObjects()]
                .filter((object: any) => object?.isFrame)
                .slice(-1)[0] as any
        }
        if (!frame) return false

        frame.set({ width, height, scaleX: 1, scaleY: 1 })
        frame.setCoords?.()
        canvas.value.setActiveObject(frame)

        const frameId = String(frame._customId || makeId())
        frame._customId = frameId
        frame.set({
            name: `mes-do-consumidor-background-${plan.formatId}`,
            layerName: 'Cor do fundo — altere aqui',
            // O fundo é a cor do próprio Frame: não existe bitmap vermelho no
            // modelo, então o cliente pode trocar a paleta normalmente.
            fill: MES_DO_CONSUMIDOR_COLORS.background,
            stroke: 'transparent',
            backgroundColor: MES_DO_CONSUMIDOR_COLORS.background,
            isQuickGenerated: true,
            quickSeedId: seedId,
            templateCompositionManaged: true,
            templateModelId: plan.modelId,
            templateModelName: plan.modelName,
            templateFormatId: plan.formatId,
            templateFormatLabel: plan.formatLabel,
            templateThemeId: String(theme.id || 'market-red'),
            templateThemeName: String(theme.name || 'Oferta vermelha')
        })

        const frameBounds = getFrameBounds(frame) || {
            left: Number(frame.left || 0) - width / 2,
            top: Number(frame.top || 0) - height / 2,
            width,
            height
        }
        const frameLeft = frameBounds.left
        const frameTop = frameBounds.top
        const centerX = frameLeft + width / 2

        const applyPresetMetadata = (object: any, name: string, layerName: string) => {
            object._customId = String(object?._customId || makeId())
            object.set({
                name,
                layerName,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockMovementX: false,
                lockMovementY: false,
                lockScalingX: false,
                lockScalingY: false,
                lockRotation: false,
                lockScalingFlip: true,
                objectCaching: false,
                excludeFromExport: false,
                isQuickGenerated: true,
                quickSeedId: seedId,
                templateCompositionManaged: true,
                parentFrameId: frameId
            })
            canvas.value?.add(object)
            syncObjectFrameClip(object)
            object.setCoords?.()
            return object
        }

        const addNativeRect = (
            name: string,
            layerName: string,
            box: { left: number; top: number; width: number; height: number; radius?: number },
            fill: string,
            opacity = 1
        ) => {
            const radius = Math.max(0, Number(box.radius || 0))
            const object = new fabric.Rect({
                left: box.left,
                top: box.top,
                width: Math.max(1, box.width),
                height: Math.max(1, box.height),
                originX: 'left',
                originY: 'top',
                rx: radius,
                ry: radius,
                fill,
                opacity,
                stroke: 'transparent',
                strokeWidth: 0,
                strokeUniform: true
            })
            return applyPresetMetadata(object, name, layerName)
        }

        const addImageAsset = async (opts: {
            name: string
            layerName: string
            key: string
            centerX: number
            centerY: number
            targetWidth: number
            targetHeight?: number
            opacity?: number
            angle?: number
            cover?: boolean
        }): Promise<any | null> => {
            const source = getMesDoConsumidorAssetUrl(opts.key)
            try {
                const image = await fabric.Image.fromURL(source, { crossOrigin: 'anonymous' })
                const naturalWidth = Math.max(1, Number(image.width || 1))
                const naturalHeight = Math.max(1, Number(image.height || 1))
                const scale = opts.cover && opts.targetHeight
                    ? Math.max(opts.targetWidth / naturalWidth, opts.targetHeight / naturalHeight)
                    : opts.targetWidth / naturalWidth
                image.set({
                    left: opts.centerX,
                    top: opts.centerY,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    opacity: Number.isFinite(Number(opts.opacity)) ? Number(opts.opacity) : 1,
                    angle: Number(opts.angle || 0),
                    crossOrigin: 'anonymous'
                })
                ;(image as any).__originalSrc = source
                return applyPresetMetadata(image, opts.name, opts.layerName)
            } catch (error) {
                console.warn(`[flyer-template] Não foi possível carregar ${opts.layerName}:`, error)
                return null
            }
        }

        const getFieldSample = (field: string): string => (
            STORE_DYNAMIC_FIELDS.find((item: any) => item.field === field)?.sample || 'Dado da loja'
        )
        const addDynamicText = (opts: {
            name: string
            layerName: string
            field?: string
            dataField?: 'validity'
            text: string
            left: number
            top: number
            width: number
            fontSize: number
            fontWeight?: number | string
            fill: string
            textAlign?: 'left' | 'center' | 'right'
            originX?: 'left' | 'center' | 'right'
            originY?: 'top' | 'center' | 'bottom'
            validity?: boolean
        }) => {
            const object = new fabric.Textbox(opts.text, {
                left: opts.left,
                top: opts.top,
                width: Math.max(32, opts.width),
                originX: opts.originX || 'center',
                originY: opts.originY || 'center',
                fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
                fontSize: Math.max(10, opts.fontSize),
                fontWeight: opts.fontWeight || 600,
                fill: opts.fill,
                textAlign: opts.textAlign || 'center',
                lineHeight: 1.02,
                editable: true,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockScalingX: false,
                lockScalingY: false,
                objectCaching: false,
                businessProfileField: opts.field || undefined,
                quickDataField: opts.dataField || undefined,
                quickFieldEnabled: true,
                ...(opts.validity ? {
                    quickValidityStartDate: String(seed.startDate || ''),
                    quickValidityEndDate: String(seed.endDate || ''),
                    quickValidityMode: seed.validityMode || 'while_stocks',
                    quickValidityWhileStocks: seed.validityWhileStocks !== false,
                    quickValidityDateFormat: 'numeric',
                    quickOfferScope: seed.offerScope || {}
                } : {}),
                ...getDynamicBusinessTextOptions(opts.field || opts.dataField || '')
            })
            applyPresetMetadata(object, opts.name, opts.layerName)
            configureDynamicBusinessTextObject(object, fabric)
            fitDynamicBusinessTextObject(object)
            object.setCoords?.()
            return object
        }

        const header = layout.header
        const footer = layout.footer
        const headerLeft = frameLeft + header.x * width
        const headerTop = frameTop + header.y * height
        const headerWidth = header.width * width
        const headerHeight = header.height * height
        const footerLeft = frameLeft + footer.x * width
        const footerTop = frameTop + footer.y * height
        const footerWidth = footer.width * width
        const footerHeight = footer.height * height
        const headerRadius = Math.min(headerWidth, headerHeight) * header.radius
        const footerRadius = Math.min(footerWidth, footerHeight) * footer.radius

        // Todos os amarelos são formas independentes no canvas, incluindo suas
        // sombras. Alterar, mover ou apagar uma forma não altera as demais.
        addNativeRect('mes-do-consumidor-faixa-superior', 'Forma nativa — faixa amarela superior', {
            left: frameLeft,
            top: frameTop,
            width,
            height: Math.max(8, height * layout.topBandHeight)
        }, MES_DO_CONSUMIDOR_COLORS.yellow)
        addNativeRect('mes-do-consumidor-cabecalho-sombra', 'Forma nativa — sombra do cabeçalho', {
            left: headerLeft + Math.max(6, width * 0.012),
            top: headerTop + Math.max(6, height * 0.012),
            width: headerWidth,
            height: headerHeight,
            radius: headerRadius
        }, MES_DO_CONSUMIDOR_COLORS.yellowShadow, 0.72)
        addNativeRect('mes-do-consumidor-cabecalho-amarelo', 'Forma nativa — cabeçalho amarelo', {
            left: headerLeft,
            top: headerTop,
            width: headerWidth,
            height: headerHeight,
            radius: headerRadius
        }, MES_DO_CONSUMIDOR_COLORS.yellow)
        addNativeRect('mes-do-consumidor-rodape-sombra', 'Forma nativa — sombra do rodapé', {
            left: footerLeft + Math.max(5, width * 0.01),
            top: footerTop + Math.max(5, height * 0.01),
            width: footerWidth,
            height: footerHeight,
            radius: footerRadius
        }, MES_DO_CONSUMIDOR_COLORS.yellowShadow, 0.72)
        addNativeRect('mes-do-consumidor-rodape-amarelo', 'Forma nativa — rodapé amarelo', {
            left: footerLeft,
            top: footerTop,
            width: footerWidth,
            height: footerHeight,
            radius: footerRadius
        }, MES_DO_CONSUMIDOR_COLORS.yellow)

        // Efeito transparente opcional. Ele não carrega cor de fundo e pode ser
        // removido/alterado sem mudar a base vermelha nativa.
        await addImageAsset({
            name: 'mes-do-consumidor-efeito-brilho',
            layerName: MES_DO_CONSUMIDOR_ASSETS.gloss.layerName,
            key: MES_DO_CONSUMIDOR_ASSETS.gloss.key,
            centerX,
            centerY: frameTop + height / 2,
            targetWidth: width,
            targetHeight: height,
            opacity: layout.glossOpacity,
            cover: true
        })

        const validity = layout.validity
        const validityWidth = Math.max(150, validity.width * width)
        const validityHeight = Math.max(28, validity.height * height)
        const validityCenterX = frameLeft + validity.x * width
        const validityCenterY = frameTop + validity.y * height
        addNativeRect('mes-do-consumidor-validade-base', 'Forma nativa — base da validade', {
            left: validityCenterX - validityWidth / 2,
            top: validityCenterY - validityHeight / 2,
            width: validityWidth,
            height: validityHeight,
            radius: Math.min(validityWidth, validityHeight) * validity.radius
        }, MES_DO_CONSUMIDOR_COLORS.redChip)

        // A zona é a única área livre: ela não recebe produto/card de exemplo e
        // seu guia é ocultado no export pelo pipeline padrão.
        canvas.value.setActiveObject(frame)
        await addGridZone()
        const zone = [...canvas.value.getObjects()]
            .filter((object: any) => isLikelyProductZone(object) && String(object?.parentFrameId || '').trim() === frameId)
            .slice(-1)[0] as any
        if (!zone) return false
        const zoneWidth = Math.max(120, layout.productZone.width * width)
        const zoneHeight = Math.max(140, layout.productZone.height * height)
        zone._customId = String(zone._customId || makeCanvasObjectId())
        zone.parentFrameId = frameId
        zone.isQuickGenerated = true
        zone.quickSeedId = seedId
        zone.templateCompositionManaged = true
        zone.templateModelId = plan.modelId
        zone.templateModelName = plan.modelName
        zone.templateFormatId = plan.formatId
        zone.templateFormatLabel = plan.formatLabel
        zone.templateThemeId = String(theme.id || 'market-red')
        zone.templateThemeName = String(theme.name || 'Oferta vermelha')
        zone._zoneWidth = zoneWidth
        zone._zoneHeight = zoneHeight
        zone._zoneGlobalStyles = normalizeGlobalStyles({
            ...(zone._zoneGlobalStyles || {}),
            cardColor: '#ffffff',
            cardBorderColor: MES_DO_CONSUMIDOR_COLORS.redChip,
            cardBorderWidth: 0,
            prodNameColor: MES_DO_CONSUMIDOR_COLORS.backgroundDark,
            accentColor: MES_DO_CONSUMIDOR_COLORS.redChip,
            splashColor: MES_DO_CONSUMIDOR_COLORS.redChip,
            splashFill: MES_DO_CONSUMIDOR_COLORS.redChip,
            splashTextColor: MES_DO_CONSUMIDOR_COLORS.white,
            priceTextColor: MES_DO_CONSUMIDOR_COLORS.white
        })
        zone.set({
            left: frameLeft + layout.productZone.x * width,
            top: frameTop + layout.productZone.y * height,
            width: zoneWidth,
            height: zoneHeight,
            scaleX: 1,
            scaleY: 1
        })
        const zoneRect = getZoneRect(zone)
        if (zoneRect) {
            zoneRect.set({
                left: 0,
                top: 0,
                width: zoneWidth,
                height: zoneHeight,
                rx: Math.min(zoneWidth, zoneHeight) * layout.productZone.radius,
                ry: Math.min(zoneWidth, zoneHeight) * layout.productZone.radius,
                scaleX: 1,
                scaleY: 1
            })
            zoneRect.setCoords?.()
        }
        ensureZoneSanity(zone)
        zone.setCoords?.()
        setActiveProductZone(zone, { syncImportTarget: true })

        await addImageAsset({
            name: 'mes-do-consumidor-selo-3d',
            layerName: MES_DO_CONSUMIDOR_ASSETS.seal.layerName,
            key: MES_DO_CONSUMIDOR_ASSETS.seal.key,
            centerX: frameLeft + layout.seal.x * width,
            centerY: frameTop + layout.seal.y * height,
            targetWidth: Math.max(150, layout.seal.width * width),
            angle: layout.seal.angle
        })
        for (const [index, coin] of layout.coins.entries()) {
            await addImageAsset({
                name: `mes-do-consumidor-moeda-${index + 1}`,
                layerName: `${MES_DO_CONSUMIDOR_ASSETS.discountCoin.layerName} ${index + 1}`,
                key: MES_DO_CONSUMIDOR_ASSETS.discountCoin.key,
                centerX: frameLeft + coin.x * width,
                centerY: frameTop + coin.y * height,
                targetWidth: Math.max(56, coin.width * width),
                angle: coin.angle
            })
        }

        addDynamicText({
            name: 'mes-do-consumidor-validade',
            layerName: 'Dado dinâmico — validade das ofertas',
            dataField: 'validity',
            text: getFieldSample('validity'),
            left: validityCenterX,
            top: validityCenterY,
            width: validityWidth * 0.88,
            fontSize: 20,
            fontWeight: 700,
            fill: MES_DO_CONSUMIDOR_COLORS.white,
            validity: true
        })

        const compactFooter = plan.formatId === 'stories'
        const footerNameSize = Math.max(12, Math.min(compactFooter ? 23 : 30, width * (compactFooter ? 0.022 : 0.027)))
        const footerTextSize = Math.max(10, Math.min(compactFooter ? 16 : 20, width * (compactFooter ? 0.014 : 0.017)))
        const footerLeftInset = frameLeft + width * 0.09
        const footerInfoCenter = footerLeftInset + width * 0.19
        const footerMainY = footerTop + footerHeight * 0.34
        const footerSecondaryY = footerTop + footerHeight * 0.66
        const contactWidth = Math.max(150, width * (plan.formatId === 'tv' ? 0.28 : 0.34))
        const contactHeight = Math.max(30, footerHeight * 0.43)
        const contactCenterX = frameLeft + width * (plan.formatId === 'tv' ? 0.76 : 0.73)
        const contactCenterY = footerTop + footerHeight * 0.5
        addNativeRect('mes-do-consumidor-whatsapp-base', 'Forma nativa — base do WhatsApp', {
            left: contactCenterX - contactWidth / 2,
            top: contactCenterY - contactHeight / 2,
            width: contactWidth,
            height: contactHeight,
            radius: contactHeight * 0.5
        }, MES_DO_CONSUMIDOR_COLORS.redChip)
        addDynamicText({
            name: 'mes-do-consumidor-nome-da-loja',
            layerName: 'Dado dinâmico — nome da loja',
            field: 'companyName',
            text: getFieldSample('companyName'),
            left: footerLeftInset,
            top: footerMainY,
            width: width * 0.36,
            fontSize: footerNameSize,
            fontWeight: 800,
            fill: MES_DO_CONSUMIDOR_COLORS.footerText,
            textAlign: 'left',
            originX: 'left'
        })
        addDynamicText({
            name: 'mes-do-consumidor-site',
            layerName: 'Dado dinâmico — site',
            field: 'website',
            text: getFieldSample('website'),
            left: footerInfoCenter,
            top: footerSecondaryY,
            width: width * 0.38,
            fontSize: footerTextSize,
            fontWeight: 600,
            fill: MES_DO_CONSUMIDOR_COLORS.footerText
        })
        addDynamicText({
            name: 'mes-do-consumidor-instagram',
            layerName: 'Dado dinâmico — Instagram',
            field: 'instagram',
            text: getFieldSample('instagram'),
            left: footerInfoCenter,
            top: footerMainY,
            width: width * 0.38,
            fontSize: footerTextSize,
            fontWeight: 700,
            fill: MES_DO_CONSUMIDOR_COLORS.footerText
        })
        addDynamicText({
            name: 'mes-do-consumidor-whatsapp',
            layerName: 'Dado dinâmico — WhatsApp',
            field: 'whatsapp',
            text: getFieldSample('whatsapp'),
            left: contactCenterX,
            top: contactCenterY,
            width: contactWidth * 0.86,
            fontSize: Math.max(11, Math.min(23, width * 0.02)),
            fontWeight: 800,
            fill: MES_DO_CONSUMIDOR_COLORS.white
        })

        ensureFramesBelowContents()
        refreshCanvasObjects({ immediate: true })
        zoomToFit({ persist: true })
        safeRequestRenderAll()
        await Promise.resolve(saveCurrentState({
            allowEmptyOverwrite: true,
            reason: `mes-do-consumidor-${plan.modelId}-${plan.formatId}`,
            source: 'system',
            skipCoalesce: true,
            skipIfUnchanged: false
        }))
        await flushPersistenceNow('mes-do-consumidor-all-formats', { force: true })
        return true
    }

    const materializeReferenceFlyerTemplatePage = async (
        seed: QuickEditorSeed,
        theme: Record<string, any>,
        plan: {
            modelId: string
            modelName: string
            formatId: string
            formatLabel: string
            modelIndex: number
            formatIndex: number
        }
    ): Promise<boolean> => {
        const presetId = seed.templatePresetId
        if (!isReferenceFlyerPresetId(presetId) || !canvas.value || !activePage.value || !fabric) return false

        const width = Math.max(320, Math.round(Number(activePage.value.width || seed.width || 1080)))
        const height = Math.max(320, Math.round(Number(activePage.value.height || seed.height || 1350)))
        const layout = getReferenceFlyerLayout(presetId, plan.formatId)
        const asset = REFERENCE_FLYER_ASSETS[presetId]
        const seedId = String(seed.id || '')
        const isTv = plan.formatId === 'tv'
        const isStory = plan.formatId === 'stories'

        const existingObjects = canvas.value.getObjects()
        let frame = existingObjects
            .filter((object: any) => {
                if (!object?.isFrame || object?.templateCompositionManaged || object?.quickSeedId) return false
                const frameObjectId = String(object?._customId || '').trim()
                if (!frameObjectId) return false
                return !existingObjects.some((candidate: any) => (
                    candidate !== object && String(candidate?.parentFrameId || '').trim() === frameObjectId
                ))
            })
            .slice(-1)[0] as any
        if (!frame) {
            addFrame({ width, height })
            frame = [...canvas.value.getObjects()].filter((object: any) => object?.isFrame).slice(-1)[0] as any
        }
        if (!frame) return false

        frame.set({ width, height, scaleX: 1, scaleY: 1 })
        frame.setCoords?.()
        const frameId = String(frame._customId || makeId())
        frame._customId = frameId
        frame.set({
            name: `${presetId}-background-${plan.formatId}`,
            layerName: 'Cor do fundo — altere aqui',
            fill: layout.background,
            stroke: 'transparent',
            backgroundColor: layout.background,
            isQuickGenerated: true,
            quickSeedId: seedId,
            templateCompositionManaged: true,
            templateModelId: plan.modelId,
            templateModelName: plan.modelName,
            templateFormatId: plan.formatId,
            templateFormatLabel: plan.formatLabel,
            templateThemeId: String(theme.id || presetId),
            templateThemeName: String(theme.name || plan.modelName)
        })

        const frameBounds = getFrameBounds(frame) || {
            left: Number(frame.left || 0) - width / 2,
            top: Number(frame.top || 0) - height / 2,
            width,
            height
        }
        const frameLeft = frameBounds.left
        const frameTop = frameBounds.top
        const centerX = frameLeft + width / 2

        const applyPresetMetadata = (object: any, name: string, layerName: string) => {
            object._customId = String(object?._customId || makeId())
            object.set({
                name,
                layerName,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockMovementX: false,
                lockMovementY: false,
                lockScalingX: false,
                lockScalingY: false,
                lockRotation: false,
                lockScalingFlip: true,
                objectCaching: false,
                excludeFromExport: false,
                isQuickGenerated: true,
                quickSeedId: seedId,
                templateCompositionManaged: true,
                parentFrameId: frameId
            })
            canvas.value?.add(object)
            syncObjectFrameClip(object)
            object.setCoords?.()
            return object
        }

        const addNativeRect = (
            name: string,
            layerName: string,
            box: { left: number; top: number; width: number; height: number; radius?: number },
            fill: string,
            opacity = 1,
            angle = 0
        ) => {
            const radius = Math.max(0, Number(box.radius || 0))
            return applyPresetMetadata(new fabric.Rect({
                left: box.left,
                top: box.top,
                width: Math.max(1, box.width),
                height: Math.max(1, box.height),
                originX: 'left',
                originY: 'top',
                rx: radius,
                ry: radius,
                fill,
                opacity,
                angle,
                stroke: 'transparent',
                strokeWidth: 0,
                strokeUniform: true
            }), name, layerName)
        }

        const addCircle = (name: string, layerName: string, x: number, y: number, radius: number, fill: string, opacity = 1) =>
            applyPresetMetadata(new fabric.Circle({
                left: x,
                top: y,
                radius: Math.max(2, radius),
                originX: 'center',
                originY: 'center',
                fill,
                opacity,
                stroke: 'transparent',
                strokeWidth: 0
            }), name, layerName)

        const addImageAsset = async (opts: {
            name: string
            layerName: string
            key: string
            centerX: number
            centerY: number
            targetWidth: number
            opacity?: number
            angle?: number
        }): Promise<any | null> => {
            try {
                const source = getReferenceFlyerAssetUrl(opts.key)
                const image = await fabric.Image.fromURL(source, { crossOrigin: 'anonymous' })
                const naturalWidth = Math.max(1, Number(image.width || 1))
                const scale = Math.max(1, opts.targetWidth) / naturalWidth
                image.set({
                    left: opts.centerX,
                    top: opts.centerY,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    opacity: Number.isFinite(Number(opts.opacity)) ? Number(opts.opacity) : 1,
                    angle: Number(opts.angle || 0),
                    crossOrigin: 'anonymous'
                })
                ;(image as any).__originalSrc = source
                return applyPresetMetadata(image, opts.name, opts.layerName)
            } catch (error) {
                console.warn(`[flyer-template] Não foi possível carregar ${opts.layerName}:`, error)
                return null
            }
        }

        const getFieldSample = (field: string): string => (
            STORE_DYNAMIC_FIELDS.find((item: any) => item.field === field)?.sample || 'Dado da loja'
        )
        const addText = (opts: {
            name: string
            layerName: string
            text: string
            left: number
            top: number
            width: number
            fontSize: number
            fill: string
            fontWeight?: number | string
            field?: string
            dataField?: 'validity'
            textAlign?: 'left' | 'center' | 'right'
            originX?: 'left' | 'center' | 'right'
            angle?: number
            shadow?: any
            validity?: boolean
        }) => {
            const object = new fabric.Textbox(opts.text, {
                left: opts.left,
                top: opts.top,
                width: Math.max(32, opts.width),
                originX: opts.originX || 'center',
                originY: 'center',
                fontFamily: DEFAULT_EDITOR_FONT_FAMILY,
                fontSize: Math.max(10, opts.fontSize),
                fontWeight: opts.fontWeight || 700,
                fill: opts.fill,
                shadow: opts.shadow,
                textAlign: opts.textAlign || 'center',
                lineHeight: 1.02,
                angle: Number(opts.angle || 0),
                editable: true,
                selectable: true,
                evented: true,
                hasControls: true,
                hasBorders: true,
                lockScalingX: false,
                lockScalingY: false,
                objectCaching: false,
                businessProfileField: opts.field || undefined,
                quickDataField: opts.dataField || undefined,
                quickFieldEnabled: true,
                ...(opts.validity ? {
                    quickValidityStartDate: String(seed.startDate || ''),
                    quickValidityEndDate: String(seed.endDate || ''),
                    quickValidityMode: seed.validityMode || 'while_stocks',
                    quickValidityWhileStocks: seed.validityWhileStocks !== false,
                    quickValidityDateFormat: 'numeric',
                    quickOfferScope: seed.offerScope || {}
                } : {}),
                ...getDynamicBusinessTextOptions(opts.field || opts.dataField || '')
            })
            applyPresetMetadata(object, opts.name, opts.layerName)
            configureDynamicBusinessTextObject(object, fabric)
            fitDynamicBusinessTextObject(object)
            object.setCoords?.()
            return object
        }

        // Base shapes: all colors remain directly editable in the object panel.
        addNativeRect(`${presetId}-top-strip`, 'Forma nativa — faixa superior', {
            left: frameLeft,
            top: frameTop,
            width,
            height: Math.max(8, height * (isStory ? 0.025 : 0.038))
        }, layout.accent)
        addNativeRect(`${presetId}-header-shadow`, 'Forma nativa — sombra do cabeçalho', {
            left: frameLeft + width * (isTv ? 0.04 : 0.035) + width * 0.012,
            top: frameTop + height * (isTv ? 0.08 : 0.055) + height * 0.012,
            width: width * (isTv ? 0.43 : 0.93),
            height: height * (isTv ? 0.43 : (isStory ? 0.29 : 0.31)),
            radius: Math.min(width, height) * 0.025
        }, layout.backgroundDark, 0.62)
        addNativeRect(`${presetId}-header-panel`, 'Forma nativa — painel do cabeçalho', {
            left: frameLeft + width * (isTv ? 0.04 : 0.035),
            top: frameTop + height * (isTv ? 0.08 : 0.055),
            width: width * (isTv ? 0.43 : 0.93),
            height: height * (isTv ? 0.43 : (isStory ? 0.29 : 0.31)),
            radius: Math.min(width, height) * 0.025
        }, layout.backgroundDark)

        // Diagonais e pontos são formas soltas, nunca fazem parte do fundo.
        addNativeRect(`${presetId}-diagonal-accent`, 'Forma nativa — faixa diagonal', {
            left: frameLeft + width * 0.49,
            top: frameTop + height * 0.045,
            width: width * 0.58,
            height: Math.max(20, height * 0.045),
            radius: Math.min(width, height) * 0.018
        }, layout.accent, 0.94, isTv ? -7 : -10)
        addCircle(`${presetId}-decor-circle-1`, 'Forma nativa — círculo decorativo 1', frameLeft + width * 0.07, frameTop + height * 0.44, width * 0.06, layout.accent, 0.85)
        addCircle(`${presetId}-decor-circle-2`, 'Forma nativa — círculo decorativo 2', frameLeft + width * 0.94, frameTop + height * 0.49, width * 0.045, layout.panel, 0.25)

        const titleX = frameLeft + width * (isTv ? 0.26 : 0.30)
        const titleY = frameTop + height * (isTv ? 0.19 : 0.15)
        const titleWidth = width * (isTv ? 0.31 : 0.50)
        const titleFont = Math.max(22, Math.min(isTv ? 76 : 82, width * (isStory ? 0.075 : 0.065)))
        const eyebrow = presetId === 'terca-quarta-verde'
            ? 'TERÇA & QUARTA'
            : presetId === 'segunda-da-limpeza'
                ? 'SEGUNDA DA LIMPEZA'
                : 'SEMANA DE'
        const headline = presetId === 'terca-quarta-verde' ? 'VERDE' : presetId === 'segunda-da-limpeza' ? 'LIMPEZA' : 'OFERTAS'
        addText({
            name: `${presetId}-eyebrow`,
            layerName: 'Texto editável — chamada principal',
            text: eyebrow,
            left: titleX,
            top: titleY,
            width: titleWidth,
            fontSize: Math.max(14, titleFont * 0.34),
            fill: layout.accent,
            fontWeight: 900,
            angle: isTv ? -2 : -1
        })
        addText({
            name: `${presetId}-headline`,
            layerName: 'Texto editável — título 3D',
            text: headline,
            left: titleX,
            top: titleY + titleFont * 0.66,
            width: titleWidth,
            fontSize: titleFont,
            fill: layout.text,
            fontWeight: 900,
            angle: isTv ? -2 : -1,
            shadow: typeof fabric.Shadow === 'function'
                ? new fabric.Shadow({ color: layout.backgroundDark, blur: 2, offsetX: 0, offsetY: Math.max(4, titleFont * 0.075) })
                : undefined
        })
        addText({
            name: `${presetId}-slogan`,
            layerName: 'Texto editável — slogan',
            text: presetId === 'segunda-da-limpeza' ? 'CASA LIMPA, VIDA MAIS LEVE!' : 'OFERTAS FRESCAS PARA SUA CASA',
            left: titleX,
            top: titleY + titleFont * 1.27,
            width: titleWidth,
            fontSize: Math.max(12, titleFont * 0.24),
            fill: layout.muted,
            fontWeight: 800
        })

        const logoLeft = frameLeft + width * (isTv ? 0.49 : 0.58)
        const logoTop = frameTop + height * (isTv ? 0.1 : 0.075)
        const logoWidth = width * (isTv ? 0.46 : 0.36)
        const logoHeight = height * (isTv ? 0.30 : 0.18)
        addNativeRect(`${presetId}-logo-panel`, 'Forma nativa — painel da marca', {
            left: logoLeft,
            top: logoTop,
            width: logoWidth,
            height: logoHeight,
            radius: Math.min(width, height) * 0.02
        }, layout.panel)
        addText({
            name: `${presetId}-company-name`,
            layerName: 'Dado dinâmico — nome da loja',
            field: 'companyName',
            text: getFieldSample('companyName'),
            left: logoLeft + logoWidth / 2,
            top: logoTop + logoHeight * 0.40,
            width: logoWidth * 0.88,
            fontSize: Math.max(13, Math.min(30, width * 0.026)),
            fill: layout.panelText,
            fontWeight: 900
        })
        addText({
            name: `${presetId}-slogan-dynamic`,
            layerName: 'Dado dinâmico — slogan da loja',
            field: 'slogan',
            text: getFieldSample('slogan'),
            left: logoLeft + logoWidth / 2,
            top: logoTop + logoHeight * 0.72,
            width: logoWidth * 0.9,
            fontSize: Math.max(10, Math.min(17, width * 0.015)),
            fill: layout.panelText,
            fontWeight: 600
        })
        addText({
            name: `${presetId}-phone-header`,
            layerName: 'Dado dinâmico — telefone',
            field: 'phone',
            text: getFieldSample('phone'),
            left: logoLeft + logoWidth / 2,
            top: logoTop + logoHeight * 0.91,
            width: logoWidth * 0.9,
            fontSize: Math.max(10, Math.min(17, width * 0.015)),
            fill: layout.panelText,
            fontWeight: 800
        })

        // O elemento raster é um ornamento independente; o fundo não está dentro dele.
        await addImageAsset({
            name: `${presetId}-hero-asset`,
            layerName: asset.hero.layerName,
            key: asset.hero.key,
            centerX: frameLeft + layout.hero.x * width,
            centerY: frameTop + layout.hero.y * height,
            targetWidth: Math.max(110, layout.hero.width * width),
            opacity: layout.hero.opacity,
            angle: layout.hero.angle
        })
        if (presetId === 'segunda-da-limpeza') {
            const cleaner = REFERENCE_FLYER_ASSETS['segunda-da-limpeza'].person
            await addImageAsset({
                name: `${presetId}-cleaner-asset`,
                layerName: cleaner.layerName,
                key: cleaner.key,
                centerX: frameLeft + width * 0.87,
                centerY: frameTop + height * 0.235,
                targetWidth: Math.max(150, width * 0.32),
                opacity: 1,
                angle: 0
            })
        }

        const validityWidth = Math.max(180, width * (isTv ? 0.40 : 0.76))
        const validityHeight = Math.max(30, height * (isStory ? 0.045 : 0.052))
        const validityCenterX = frameLeft + width * (isTv ? 0.27 : 0.50)
        const validityCenterY = frameTop + height * (isTv ? 0.49 : 0.385)
        addNativeRect(`${presetId}-validity-base`, 'Forma nativa — base da validade', {
            left: validityCenterX - validityWidth / 2,
            top: validityCenterY - validityHeight / 2,
            width: validityWidth,
            height: validityHeight,
            radius: validityHeight * 0.5
        }, layout.accent)
        addText({
            name: `${presetId}-validity`,
            layerName: 'Dado dinâmico — validade das ofertas',
            dataField: 'validity',
            validity: true,
            text: getFieldSample('validity'),
            left: validityCenterX,
            top: validityCenterY,
            width: validityWidth * 0.92,
            fontSize: 20,
            fill: layout.panelText,
            fontWeight: 900
        })

        // A zona nasce vazia: os produtos entram depois na edição rápida.
        canvas.value.setActiveObject(frame)
        await addGridZone()
        const zone = [...canvas.value.getObjects()]
            .filter((object: any) => isLikelyProductZone(object) && String(object?.parentFrameId || '').trim() === frameId)
            .slice(-1)[0] as any
        if (!zone) return false
        const zoneWidth = Math.max(120, layout.productZone.width * width)
        const zoneHeight = Math.max(140, layout.productZone.height * height)
        zone._customId = String(zone._customId || makeCanvasObjectId())
        zone.parentFrameId = frameId
        zone.isQuickGenerated = true
        zone.quickSeedId = seedId
        zone.templateCompositionManaged = true
        zone.templateModelId = plan.modelId
        zone.templateModelName = plan.modelName
        zone.templateFormatId = plan.formatId
        zone.templateFormatLabel = plan.formatLabel
        zone.templateThemeId = String(theme.id || presetId)
        zone.templateThemeName = String(theme.name || plan.modelName)
        zone._zoneWidth = zoneWidth
        zone._zoneHeight = zoneHeight
        zone._zoneGlobalStyles = normalizeGlobalStyles({
            ...(zone._zoneGlobalStyles || {}),
            cardColor: layout.panel,
            cardBorderColor: layout.accent,
            cardBorderWidth: presetId === 'semana-de-ofertas' ? 0 : 2,
            prodNameColor: layout.panelText,
            accentColor: layout.accent,
            splashColor: layout.backgroundDark,
            splashFill: layout.backgroundDark,
            splashTextColor: layout.text,
            priceTextColor: layout.text
        })
        zone.set({
            left: frameLeft + layout.productZone.x * width,
            top: frameTop + layout.productZone.y * height,
            width: zoneWidth,
            height: zoneHeight,
            scaleX: 1,
            scaleY: 1
        })
        const zoneRect = getZoneRect(zone)
        if (zoneRect) {
            zoneRect.set({
                left: 0,
                top: 0,
                width: zoneWidth,
                height: zoneHeight,
                rx: Math.min(zoneWidth, zoneHeight) * layout.productZone.radius,
                ry: Math.min(zoneWidth, zoneHeight) * layout.productZone.radius,
                fill: presetId === 'semana-de-ofertas' ? layout.backgroundDark : layout.panel,
                stroke: presetId === 'semana-de-ofertas' ? layout.accent : layout.accent,
                strokeWidth: presetId === 'semana-de-ofertas' ? 3 : 2,
                strokeDashArray: [12, 8],
                scaleX: 1,
                scaleY: 1
            })
            zoneRect.setCoords?.()
        }
        ensureZoneSanity(zone)
        zone.setCoords?.()
        setActiveProductZone(zone, { syncImportTarget: true })

        const footerHeight = Math.max(76, height * (isStory ? 0.095 : isTv ? 0.16 : 0.12))
        const footerTop = frameTop + height - footerHeight
        addNativeRect(`${presetId}-footer`, 'Forma nativa — rodapé editável', {
            left: frameLeft,
            top: footerTop,
            width,
            height: footerHeight,
            radius: 0
        }, layout.footer)
        const footerFont = Math.max(11, Math.min(25, width * (isTv ? 0.017 : 0.022)))
        addText({
            name: `${presetId}-footer-company`,
            layerName: 'Dado dinâmico — nome da loja no rodapé',
            field: 'companyName',
            text: getFieldSample('companyName'),
            left: frameLeft + width * 0.08,
            top: footerTop + footerHeight * 0.30,
            width: width * 0.28,
            fontSize: footerFont,
            fill: layout.text,
            fontWeight: 900,
            textAlign: 'left',
            originX: 'left'
        })
        addText({
            name: `${presetId}-footer-address`,
            layerName: 'Dado dinâmico — endereço',
            field: 'address',
            text: getFieldSample('address'),
            left: frameLeft + width * 0.08,
            top: footerTop + footerHeight * 0.69,
            width: width * 0.48,
            fontSize: Math.max(10, footerFont * 0.66),
            fill: layout.text,
            fontWeight: 600,
            textAlign: 'left',
            originX: 'left'
        })
        addText({
            name: `${presetId}-footer-whatsapp`,
            layerName: 'Dado dinâmico — WhatsApp',
            field: 'whatsapp',
            text: getFieldSample('whatsapp'),
            left: frameLeft + width * 0.74,
            top: footerTop + footerHeight * 0.32,
            width: width * 0.40,
            fontSize: footerFont,
            fill: layout.accent,
            fontWeight: 900
        })
        addText({
            name: `${presetId}-footer-instagram`,
            layerName: 'Dado dinâmico — Instagram',
            field: 'instagram',
            text: getFieldSample('instagram'),
            left: frameLeft + width * 0.74,
            top: footerTop + footerHeight * 0.70,
            width: width * 0.40,
            fontSize: Math.max(10, footerFont * 0.66),
            fill: layout.text,
            fontWeight: 600
        })

        ensureFramesBelowContents()
        refreshCanvasObjects({ immediate: true })
        zoomToFit({ persist: true })
        safeRequestRenderAll()
        await Promise.resolve(saveCurrentState({
            allowEmptyOverwrite: true,
            reason: `${presetId}-${plan.modelId}-${plan.formatId}`,
            source: 'system',
            skipCoalesce: true,
            skipIfUnchanged: false
        }))
        await flushPersistenceNow(`${presetId}-all-formats`, { force: true })
        return true
    }

    const processQuickEditorSeed = async (): Promise<void> => {
        const pendingQuickSeedProcessing = ctx.getQuickSeedProcessing()
        if (pendingQuickSeedProcessing) return pendingQuickSeedProcessing

        const processing = (async () => {
            try {
                if (typeof window === 'undefined') return

                // Project loading, Fabric boot and the first canvas hydration happen
                // independently. Wait for all three before touching the live canvas.
                for (let attempt = 0; attempt < 160; attempt += 1) {
                    if (isCanvasDestroyed.value) return
                    const projectId = String(project.id || '').trim()
                    const ready = !!projectId &&
                        isProjectLoaded.value &&
                        isFabricReady.value &&
                        !!canvas.value &&
                        !!activePage.value &&
                        isInitialDesignLoadDone.value &&
                        !isDesignLoading.value &&
                        !ctx.getIsCanvasJsonLoadInProgress() &&
                        typeof saveCurrentState === 'function'
                    if (ready) break
                    await new Promise<void>(resolve => window.setTimeout(resolve, 250))
                }

                const projectId = String(project.id || '').trim()
                if (!projectId || !canvas.value) return

                // Projetos rápidos criados antes da biblioteca de blueprints não
                // sabem qual composição pertence a cada formato. Recuperar isso
                // antes do seed também permite reparar páginas já existentes, sem
                // transformar a página atual na fonte de outro formato.
                await repairQuickModeLegacyTemplatePages()

                // Páginas rápidas antigas podem ainda apontar para a miniatura do
                // modelo. Gere a miniatura da cópia ativa para que o rail mostre
                // exatamente o enquadramento do formato aberto.
                const activeQuickPage = activePage.value
                if (activeQuickPage?.canvasData && isTemplateCompositionManagedPage(activeQuickPage)) {
                    await ensureQuickPageThumbnail(activeQuickPage)
                }

                if (quickSeedAppliedForProjectId === projectId) return
                hydrateQuickModeDataFromCanvas()
                const rawSeed = getQuickSeedStorageValue(projectId)
                if (!rawSeed) return

                let seed: QuickEditorSeed
                try {
                    seed = JSON.parse(rawSeed) as QuickEditorSeed
                } catch {
                    clearQuickSeedStorage(projectId)
                    await ensureTemplateProductZone()
                    return
                }
                if (!seed || Number(seed.version) !== QUICK_EDITOR_SEED_VERSION || !Array.isArray(seed.products)) {
                    clearQuickSeedStorage(projectId)
                    return
                }

                const currentObjects = canvas.value.getObjects()
                const isTemplateSeed = String(seed.id || '').startsWith('template-')
                const alreadyMaterialized = currentObjects.some((object: any) =>
                    object?.isQuickGenerated === true && String(object?.quickSeedId || '') === String(seed.id || '')
                )
                if (alreadyMaterialized && !isTemplateSeed) {
                    ctx.setQuickSeedAppliedForProjectId(projectId)
                    clearQuickSeedStorage(projectId)
                    return
                }

                await Promise.allSettled([
                    productZoneStructuresState.isLoaded.value ? Promise.resolve() : productZoneStructuresState.load(),
                    productCardConfigurationState.isLoaded.value ? Promise.resolve() : productCardConfigurationState.load()
                ])
                if (!canvas.value || isCanvasDestroyed.value) return

                const theme = seed.theme || {
                    backgroundColor: '#fff7ed',
                    cardColor: '#ffffff',
                    textColor: '#172033',
                    accentColor: '#ea580c',
                    priceColor: '#e11d48',
                    mutedColor: '#64748b'
                }

                if (isTemplateSeed) {
                    const requestedFormatIds = Array.isArray(seed.formatIds) && seed.formatIds.length
                        ? seed.formatIds
                        : [String(seed.formatId || 'feed')]
                    const modelDefinitions = Array.isArray(seed.models) && seed.models.length
                        ? seed.models.map((model: any, index: number) => ({
                            id: String(model?.id || `model-${index + 1}`).trim() || `model-${index + 1}`,
                            name: String(model?.name || '').trim() || `Modelo ${index + 1}`
                        }))
                        : [{ id: 'model-1', name: 'Modelo 1' }]
                    const firstFormat = getFlyerTemplateFormat(String(requestedFormatIds[0] || 'feed'))
                    const firstModel = modelDefinitions[0] || { id: 'model-1', name: 'Modelo 1' }
                    const page = activePage.value as any
                    if (!page) return

                    if (seed.templatePresetId === 'mes-do-consumidor-3d' || isReferenceFlyerPresetId(seed.templatePresetId)) {
                        const completed = await materializeMesDoConsumidorAllTemplatePages(seed, theme)
                        if (!completed) return
                        ctx.setQuickSeedAppliedForProjectId(projectId)
                        clearQuickSeedStorage(projectId)
                        return
                    }

                    // A seed creates the editable base composition only. The other
                    // models and formats live in template_config and become real
                    // pages only after the user explicitly chooses or duplicates
                    // them in quick mode.
                    page.templateModelId = firstModel.id
                    page.templateModelName = firstModel.name
                    page.templateFormatId = firstFormat.id
                    page.templateFormatLabel = firstFormat.label
                    page.templateThemeId = String(theme.id || 'market-red')
                    page.templateThemeName = String(theme.name || 'Oferta vermelha')
                    page.name = `${firstModel.name} · ${firstFormat.label}`

                    const plan = {
                        modelId: firstModel.id,
                        modelName: firstModel.name,
                        formatId: firstFormat.id,
                        formatLabel: firstFormat.label,
                        modelIndex: 0,
                        formatIndex: 0
                    }
                    const hasSeedObjects = canvas.value?.getObjects?.().some((object: any) =>
                        object?.isQuickGenerated === true && String(object?.quickSeedId || '') === String(seed.id || '')
                    )
                    if (!hasSeedObjects) {
                        await materializeTemplateSeedPage(seed, theme, plan)
                    }
                    ctx.setQuickSeedAppliedForProjectId(projectId)
                    clearQuickSeedStorage(projectId)
                    return
                }

                const width = Math.max(320, Math.round(Number(seed.width || activePage.value?.width || 1080)))
                const height = Math.max(320, Math.round(Number(seed.height || activePage.value?.height || 1350)))
                const horizontalPadding = Math.max(18, Math.min(64, Math.round(width * 0.035)))
                const headerHeight = Math.max(130, Math.min(260, Math.round(height * 0.19)))
                const footerHeight = Math.max(190, Math.min(250, Math.round(height * 0.17)))
                const zoneWidth = Math.max(120, width - horizontalPadding * 2)
                const zoneHeight = Math.max(140, height - headerHeight - footerHeight - horizontalPadding * 2)
                const profile = seed.businessProfile && typeof seed.businessProfile === 'object'
                    ? seed.businessProfile
                    : {}
                quickBusinessProfile.value = { ...profile }
                quickValidityStartDate.value = String(seed.startDate || '').trim()
                quickValidityEndDate.value = String(seed.endDate || '').trim()
                quickValidityMode.value = normalizeOfferValidityMode(
                    seed.validityMode || inferOfferValidityMode(quickValidityStartDate.value, quickValidityEndDate.value)
                )
                quickValidityWhileStocks.value = seed.validityWhileStocks !== false
                quickShowValidity.value = true
                quickOfferScope.value = normalizeOfferValidityScope(seed.offerScope)
                const textColor = String(theme.textColor || '#172033')
                const mutedColor = String(theme.mutedColor || textColor)
                const accentColor = String(theme.accentColor || '#ea580c')
                const frameFill = String(theme.backgroundColor || '#fff7ed')

                addFrame({ width, height })
                const frame = [...canvas.value.getObjects()]
                    .filter((object: any) => object?.isFrame)
                    .slice(-1)[0] as any
                if (!frame) return

                const frameId = String(frame._customId || makeId())
                frame._customId = frameId
                frame.set({
                    name: 'quick-frame',
                    layerName: 'Encarte rápido',
                    fill: frameFill,
                    isQuickGenerated: true,
                    quickSeedId: String(seed.id || '')
                })

                const frameBounds = getFrameBounds(frame) || {
                    left: Number(frame.left || 0) - width / 2,
                    top: Number(frame.top || 0) - height / 2,
                    width,
                    height
                }
                const centerX = frameBounds.left + frameBounds.width / 2
                const frameTop = frameBounds.top
                const frameBottom = frameBounds.top + frameBounds.height
                const addQuickText = (
                    value: unknown,
                    field: string,
                    top: number,
                    fontSize: number,
                    options: Record<string, any> = {}
                ) => {
                    const text = String(value || '').trim()
                    const dataField = String(options.dataField || '').trim()
                    const isBoundField = !!field || !!dataField
                    if (!text && !isBoundField) return null
                    const fieldEnabled = options.quickFieldEnabled !== undefined
                        ? options.quickFieldEnabled !== false
                        : (quickBusinessFieldOverrides.value[field] ?? true)
                    const isVisible = options.visible !== undefined
                        ? !!options.visible
                        : (!isBoundField || !!text || field === 'companyName')
                    const object = new fabric.Textbox(text || 'Sua loja', {
                        left: Number(options.centerX ?? centerX),
                        top,
                        width: Number(options.width || zoneWidth),
                        originX: 'center',
                        originY: 'top',
                        fontFamily: String(options.fontFamily || DEFAULT_EDITOR_FONT_FAMILY),
                        fontSize,
                        fontWeight: options.fontWeight || 700,
                        fill: options.fill || textColor,
                        textAlign: options.textAlign || 'center',
                        lineHeight: Number(options.lineHeight || 1.05),
                        editable: true,
                        selectable: true,
                        evented: true,
                        hasControls: true,
                        hasBorders: true,
                        lockScalingX: false,
                        lockScalingY: false,
                        splitByGrapheme: false,
                        objectCaching: false,
                        statefullCache: false,
                        visible: isVisible && fieldEnabled,
                        isQuickGenerated: true,
                        quickSeedId: String(seed.id || ''),
                        businessProfileField: field || undefined,
                        quickDataField: dataField || undefined,
                        quickFieldEnabled: fieldEnabled,
                        quickValidityStartDate: dataField === 'validity' ? String(options.startDate || '') : undefined,
                        quickValidityEndDate: dataField === 'validity' ? String(options.endDate || '') : undefined,
                        quickValidityMode: dataField === 'validity'
                            ? normalizeOfferValidityMode(options.validityMode || quickValidityMode.value)
                            : undefined,
                        quickValidityWhileStocks: dataField === 'validity'
                            ? options.validityWhileStocks !== false
                            : undefined,
                        quickOfferScope: dataField === 'validity' ? { ...quickOfferScope.value } : undefined,
                        parentFrameId: frameId,
                        ...getDynamicBusinessTextOptions(field || dataField)
                    })
                    object._customId = makeId()
                    if (isDynamicBusinessFieldObject(object)) {
                        configureDynamicBusinessTextObject(object, fabric)
                        fitDynamicBusinessTextObject(object)
                    }
                    canvas.value?.add(object)
                    syncObjectFrameClip(object)
                    object.setCoords?.()
                    return object
                }

                const logoSlot = createQuickLogoSlot({
                    _customId: makeId(),
                    isQuickGenerated: true,
                    quickSeedId: String(seed.id || ''),
                    parentFrameId: frameId,
                    quickFieldEnabled: quickBusinessFieldOverrides.value.logo ?? true
                })
                if (logoSlot) {
                    canvas.value.add(logoSlot)
                    syncObjectFrameClip(logoSlot)
                    logoSlot.setCoords?.()
                }
                const logoMetrics = getQuickLogoSlotMetrics(logoSlot)
                const headerTextWidth = Math.max(140, zoneWidth - logoMetrics.maxWidth - 16)
                const headerTextCenterX = frameBounds.left + horizontalPadding + logoMetrics.maxWidth + 16 + headerTextWidth / 2

                const companyName = getQuickBusinessProfileValue(profile, 'companyName')
                const companyFontSize = Math.max(24, Math.min(62, Math.round(width * 0.052)))
                const titleFontSize = Math.max(20, Math.min(46, Math.round(width * 0.036)))
                const dateFontSize = Math.max(14, Math.min(24, Math.round(width * 0.018)))
                const titleTop = frameTop + horizontalPadding + companyFontSize * 1.25
                const sloganTop = titleTop + titleFontSize * 1.18
                const validityTop = sloganTop + dateFontSize * 1.15
                addQuickText(companyName, 'companyName', frameTop + horizontalPadding, companyFontSize, {
                    centerX: headerTextCenterX,
                    width: headerTextWidth,
                    fill: textColor,
                    fontWeight: 900
                })
                addQuickText(seed.title || 'Ofertas da semana', '', titleTop, titleFontSize, {
                    centerX: headerTextCenterX,
                    width: headerTextWidth,
                    fill: accentColor,
                    fontWeight: 800
                })
                addQuickText(profile.slogan, 'slogan', sloganTop, dateFontSize, {
                    centerX: headerTextCenterX,
                    width: headerTextWidth,
                    fill: mutedColor,
                    fontWeight: 600
                })
                const dateLabel = formatQuickValidity(
                    seed.startDate,
                    seed.endDate,
                    quickOfferScope.value,
                    quickValidityMode.value
                )
                addQuickText(dateLabel, '', validityTop, 20, {
                    dataField: 'validity',
                    startDate: seed.startDate || '',
                    endDate: seed.endDate || '',
                    validityMode: quickValidityMode.value,
                    validityWhileStocks: quickValidityWhileStocks.value,
                    quickFieldEnabled: quickShowValidity.value,
                    visible: quickShowValidity.value && !!dateLabel,
                    centerX: headerTextCenterX,
                    width: headerTextWidth,
                    fill: mutedColor,
                    fontWeight: 600
                })

                const footerTop = frameBottom - horizontalPadding - footerHeight + 12
                const footerFontSize = Math.max(13, Math.round(dateFontSize * 0.76))
                const footerSmallSize = Math.max(10, Math.round(dateFontSize * 0.58))
                const footerRowGap = Math.max(17, Math.round(footerFontSize * 1.35))
                const footerColumnWidth = Math.max(130, zoneWidth * 0.42)
                const footerLeft = frameBounds.left + horizontalPadding
                const footerRight = frameBounds.left + width - horizontalPadding
                const footerLeftCenter = footerLeft + footerColumnWidth / 2
                const footerRightCenter = footerRight - footerColumnWidth / 2
                const footerFullWidth = zoneWidth * 0.92
                addQuickText(getQuickBusinessProfileValue(profile, 'whatsapp'), 'whatsapp', footerTop, footerFontSize, {
                    centerX: footerLeftCenter,
                    width: footerColumnWidth,
                    textAlign: 'left',
                    fill: mutedColor,
                    fontWeight: 700
                })
                addQuickText(profile.phone, 'phone', footerTop, footerFontSize, {
                    centerX: footerRightCenter,
                    width: footerColumnWidth,
                    textAlign: 'right',
                    fill: mutedColor,
                    fontWeight: 700
                })
                addQuickText(getQuickBusinessProfileValue(profile, 'address'), 'address', footerTop + footerRowGap, footerSmallSize, {
                    width: footerFullWidth,
                    fill: mutedColor,
                    fontWeight: 500
                })
                addQuickText(profile.instagram, 'instagram', footerTop + footerRowGap * 2, footerSmallSize, {
                    centerX: footerLeftCenter,
                    width: footerColumnWidth,
                    textAlign: 'left',
                    fill: mutedColor,
                    fontWeight: 600
                })
                addQuickText(profile.facebook, 'facebook', footerTop + footerRowGap * 2, footerSmallSize, {
                    centerX: footerRightCenter,
                    width: footerColumnWidth,
                    textAlign: 'right',
                    fill: mutedColor,
                    fontWeight: 600
                })
                addQuickText(profile.website, 'website', footerTop + footerRowGap * 3, footerSmallSize, {
                    centerX: footerLeftCenter,
                    width: footerColumnWidth,
                    textAlign: 'left',
                    fill: mutedColor,
                    fontWeight: 600
                })
                addQuickText(profile.hours ?? profile.openingHours, 'hours', footerTop + footerRowGap * 3, footerSmallSize, {
                    centerX: footerRightCenter,
                    width: footerColumnWidth,
                    textAlign: 'right',
                    fill: mutedColor,
                    fontWeight: 600
                })
                addQuickText(formatBusinessPaymentMethods(profile.paymentMethods ?? profile.payment_methods), 'paymentMethods', footerTop + footerRowGap * 4, footerSmallSize, {
                    width: footerFullWidth,
                    fill: mutedColor,
                    fontWeight: 600
                })
                addQuickText(profile.paymentNotes ?? profile.payment_notes, 'paymentNotes', footerTop + footerRowGap * 5, Math.max(10, Math.round(dateFontSize * 0.52)), {
                    width: footerFullWidth,
                    fill: mutedColor,
                    fontWeight: 500
                })

                await addGridZone()
                const zone = [...canvas.value.getObjects()]
                    .filter((object: any) => isLikelyProductZone(object) && String(object?.parentFrameId || '').trim() === frameId)
                    .slice(-1)[0] as any
                if (!zone) return

                zone._customId = String(zone._customId || makeCanvasObjectId())
                zone.parentFrameId = frameId
                zone.isQuickGenerated = true
                zone.quickSeedId = String(seed.id || '')
                zone._zoneWidth = zoneWidth
                zone._zoneHeight = zoneHeight
                zone.set({
                    left: centerX,
                    top: frameTop + headerHeight + horizontalPadding + zoneHeight / 2,
                    scaleX: 1,
                    scaleY: 1
                })
                const zoneRect = getZoneRect(zone)
                if (zoneRect) {
                    zoneRect.set({
                        left: 0,
                        top: 0,
                        width: zoneWidth,
                        height: zoneHeight,
                        scaleX: 1,
                        scaleY: 1
                    })
                    zoneRect.setCoords?.()
                }
                zone.set({ width: zoneWidth, height: zoneHeight })
                zone._zoneGlobalStyles = normalizeGlobalStyles({
                    ...(zone._zoneGlobalStyles || {}),
                    cardColor: theme.cardColor || '#ffffff',
                    cardBorderColor: accentColor,
                    cardBorderWidth: 1,
                    prodNameColor: textColor,
                    accentColor,
                    splashColor: theme.priceColor || '#e11d48',
                    splashFill: theme.priceColor || '#e11d48',
                    splashTextColor: '#ffffff',
                    priceTextColor: '#ffffff'
                })
                if (productZoneStructuresState.isLoaded.value) {
                    const previewFormat = getCurrentProductZonePreviewFormat();
                    const structureMaps = productZoneStructuresState.structureMapsByPreviewFormat.value;
                    const structureVariantsByPreviewFormat = productZoneStructuresState.structureVariantsByPreviewFormat.value;
                    zone.structureByProductCountByPreviewFormat = structureMaps;
                    zone.structureByProductCount = structureMaps[previewFormat]
                        || structureMaps[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
                    zone.structureVariantsByProductCountByPreviewFormat = structureVariantsByPreviewFormat;
                    zone.structureVariantsByProductCount = structureVariantsByPreviewFormat[previewFormat]
                        || structureVariantsByPreviewFormat[DEFAULT_PRODUCT_ZONE_PREVIEW_FORMAT];
                    zone.structureVariantByProductCount = {}
                    zone.structureVariantByProductCountByPreviewFormat = {}
                }
                ensureZoneSanity(zone)
                zone.setCoords?.()
                setActiveProductZone(zone, { syncImportTarget: true })

                const products = seed.products.slice(0, 24).filter((product: any) => String(product?.name || '').trim())
                if (products.length) {
                    await simulateSmartGrid(products, { margin: 10, gap: 15, orphanBehavior: 'fill' }, zone, {
                        mode: 'replace',
                        sourceMode: 'paste-list',
                        autoLayout: true,
                        persist: false
                    })
                }

                ensureFramesBelowContents()
                await applyQuickBusinessProfileBindings(profile, { persist: false })
                refreshCanvasObjects({ immediate: true })
                scheduleCenteredZoomToFit()
                safeRequestRenderAll()
                await Promise.resolve(saveCurrentState({
                    allowEmptyOverwrite: true,
                    reason: 'quick-editor-native-seed',
                    source: 'system',
                    skipCoalesce: true,
                    skipIfUnchanged: false
                }))
                await flushPersistenceNow('quick-editor-native-seed', { force: true })
                ctx.setQuickSeedAppliedForProjectId(projectId)
                clearQuickSeedStorage(projectId)
            } catch (error) {
                console.warn('[quick-editor] Falha ao materializar seed nativo:', error)
            } finally {
                ctx.setQuickSeedProcessing(null)
            }
        })()

        ctx.setQuickSeedProcessing(processing)
        return processing
    }

    return {
        materializeMesDoConsumidorTemplatePage,
        materializeReferenceFlyerTemplatePage,
        processQuickEditorSeed
    }
}

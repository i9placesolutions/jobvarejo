/**
 * Lista canonica de propriedades custom que devem ser preservadas
 * pelo Fabric durante toJSON/loadFromJSON e clone. Sem isso, props
 * como `_customId`, `parentZoneId`, `_zoneSlot`, etc. seriam perdidas
 * no roundtrip e o estado dos cards/zonas/frames quebraria.
 *
 * Organizada em secoes (identidade, frames, smart objects, zone
 * metadata, price props, shape utilities, etc) para facilitar
 * manutencao.
 *
 * Cobertura: tests/utils/canvasCustomProps.test.ts
 */

export const CANVAS_CUSTOM_PROPS: ReadonlyArray<string> = [
    // Identity / selection
    'id',
    '_customId',
    'name',
    'layerName',
    'excludeFromExport',
    // User guides (persistent)
    'isUserGuide',
    'guideAxis',

    // Frames
    'isFrame',
    'clipContent',
    'parentFrameId',
    '_frameClipOwner',
    'objectMaskEnabled',
    'objectMaskSourceId',

    // Grid cells (Canva-style grids = multiple frames linked by gridGroupId)
    'isGridCell',
    'gridGroupId',
    'gridCol',
    'gridRow',

    // Smart objects / cards
    'isSmartObject',
    'isProductCard',
    'smartGridId',
    'parentZoneId',
    'productId',
    'productInstanceId',
    'zoneInstanceId',
    '_zoneOrder',
    '_cardWidth',
    '_cardHeight',
    '_productData',
    'imageUrl',
    'subTargetCheck',
    'interactive',
    // Persisted relayout signature — prevents resizeSmartObject from rebuilding card
    // internals on reload when the card dimensions and styles haven't changed.
    '__lastCardRelayoutSignature',
    // When true on a child object, prevents auto-layout from overriding user placement (persisted).
    '__manualTransform',
    '__manualTransformCardW',
    '__manualTransformCardH',
    '__manualTextWidth',
    '__manualTextWidthRatio',
    '__priceLayoutSnapshot',
    '__priceLayoutSnapshotAt',
    '__atacValueVariants',
    '__atacVariantGroups',
    '__preserveManualLayout',
    '__isCustomTemplate',
    '__forceAtacarejoCanonical',
    '__manualTemplateBaseW',
    '__manualTemplateBaseH',
    '__manualGapSingle',
    '__manualGapRetail',
    '__manualGapWholesale',
    '__fontScale',
    '__fontScaleBase',
    '__yOffsetRatio',
    '__manualScaleX',
    '__manualScaleY',
    '__strokeWidth',
    '__roundness',
    '__shadowBlur',
    '__originalWidth',
    '__originalHeight',
    '__originalFontSize',
    '__originalLeft',
    '__originalTop',
    '__originalOriginX',
    '__originalOriginY',
    '__originalScaleX',
    '__originalScaleY',
    '__originalRadius',
    '__originalRx',
    '__originalRy',
    '__originalStrokeWidth',
    '__originalFontFamily',
    '__originalFill',

    // Visibility toggle (setVisible salva scale original antes de colapsar para 0)
    '__visibleScaleX',
    '__visibleScaleY',

    // Text transform (preserva texto original antes de upper/lower case)
    '__rawText',

    // Price text scaling base (referência para splashTextScale)
    '__fontSizeBase',

    // Product zone metadata
    'isGridZone',
    'isProductZone',
    'zoneName',
    'role',
    'contentSource',
    'contentStatus',
    'overflowPolicy',
    '_zoneWidth',
    '_zoneHeight',
    '_zonePadding',
    '_zoneGlobalStyles',
    '_zoneTemplateSnapshotId',
    '_zoneTemplateSnapshot',
    '_zoneStateSnapshot',
    'backgroundColor', // Zone background color
    'padding',
    'gapHorizontal',
    'gapVertical',
    'columns',
    'rows',
    'columnRatio',
    'rowRatio',
    'cardAspectRatio',
    'lastRowBehavior',
    'layoutDirection',
    'verticalAlign',
    'highlightCount',
    'highlightPos',
    'highlightHeight',
    'highlightStyle',
    'splashOffsetByCol',
    'splashOffsetByRow',
    'minCardSize',
    'maxColumns',
    'maxRows',
    // Props da zona que estavam faltando e perdiam no loadFromJSON
    'enabled',
    'isLocked',
    'borderColor',
    'borderWidth',
    'borderRadius',
    'showBorder',

    // Price mode engine
    'priceMode',
    'priceFrom',
    'priceClub',
    'priceWholesale',
    'wholesaleTrigger',
    'wholesaleTriggerUnit',
    'packQuantity',
    'packUnit',
    'packageLabel',

    // Product card pricing / metadata (must survive serialization)
    'price',
    'pricePack',
    'priceUnit',
    'priceSpecial',
    'priceSpecialUnit',
    'specialCondition',
    'unit',
    'unitLabel',
    'limit',

    // Zone slot positioning (card ↔ zone binding)
    '_zoneSlot',

    // Shape utilities (Figma-like)
    '__fillEnabled',
    '__fillBackup',
    '__strokeEnabled',
    '__strokeBackup',
    '__strokeWidthBackup',
    '__strokeDashBackup',
    'cornerRadii',

    // Vector Path properties
    'isVectorPath',
    'isClosedPath',
    'penPathData',
    'strokePosition',
    'strokeMiterLimit',

    // Sticker Outline (alpha-based contour)
    '__stickerOutlineEnabled',
    '__stickerOutlineMode',
    '__stickerOutlineWidth',
    '__stickerOutlineColor',
    '__stickerOutlineOpacity',
    '__stickerNoTransparency',

    // Images: ensure CORS behavior survives reload (needed for pixel-based effects like Sticker Outline)
    'crossOrigin',
    'objectCaching',
    'statefullCache',
    '__originalSrc',

    // Locks (persist cadeado state across reload)
    'lockMovementX',
    'lockMovementY',
    'lockScalingX',
    'lockScalingY',
    'lockRotation',
    'lockScalingFlip',
    'lockSkewingX',
    'lockSkewingY',

    // Template text props (must survive serialization for label templates)
    'charSpacing',
    'fontFamily',

    // Manual template corner radii
    '__originalCornerTL',
    '__originalCornerTR',
    '__originalCornerBL',
    '__originalCornerBR',

    // Manual template anchors
    '__manualSingleAnchors'
]

/**
 * Props extras a serem cloned ao duplicar um objeto Fabric. Inclui
 * tudo de CANVAS_CUSTOM_PROPS + props base de transform/imagem
 * (opacity, scaleX/Y, flipX/Y, src, etc) que nao estao no array
 * principal mas sao essenciais para preservar visual no clone.
 *
 * Caller usa em fabric.Object.clone(callback, ['propsToInclude']).
 */
export const DUPLICATE_CLONE_PROPS: ReadonlyArray<string> = Array.from(new Set([
    ...CANVAS_CUSTOM_PROPS,
    'data',
    'opacity',
    'flipX',
    'flipY',
    'filters',
    'clipPath',
    'src',
    'originX',
    'originY',
    'angle',
    'scaleX',
    'scaleY',
    'parentFrameId',
    'parentZoneId',
    'isSmartObject',
    'isProductCard',
    'name',
    'layerName',
    'clipContent',
    'smartGridId',
    '_cardWidth',
    '_cardHeight',
    '_zoneOrder',
    '_zoneSlot',
    'subTargetCheck',
    'interactive'
]))

/**
 * Offset (em pixels world) aplicado por padrao ao duplicar objetos.
 * O clone aparece deslocado em (DUPLICATE_OFFSET, DUPLICATE_OFFSET) do
 * original — torna obvio que e' uma copia e nao mascara o source.
 */
export const DUPLICATE_OFFSET = 20

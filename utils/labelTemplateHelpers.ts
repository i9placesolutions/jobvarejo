/**
 * Helpers puros para conciliacao/merge de label templates.
 *
 * Funcoes que decidem qual versao de um template usar quando ha
 * conflitos entre store local, banco de dados e snapshot do projeto.
 *
 * Cobertura: tests/utils/labelTemplateHelpers.test.ts
 */

// IDs dos templates built-in (seed do app, nao customizados pelo usuario).
export const BUILTIN_DEFAULT_LABEL_TEMPLATE_ID = 'tpl_default'
export const BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID = 'tpl_atacarejo_10fd'
export const BUILTIN_BLACK_YELLOW_LABEL_TEMPLATE_ID = 'tpl_black_yellow'
export const BUILTIN_RED_BURST_LABEL_TEMPLATE_ID = 'tpl_red_burst'
export const BUILTIN_OFER_AMARELA_LABEL_TEMPLATE_ID = 'tpl_oferta_amarela'
export const BUILTIN_BARLOW_BLACK_LABEL_TEMPLATE_ID = 'tpl_barlow_black'

/**
 * Set de todos os IDs built-in. Templates com id nesse set NUNCA devem
 * ser deletados ou tratados como custom.
 */
export const BUILTIN_LABEL_TEMPLATE_IDS: ReadonlySet<string> = new Set([
    BUILTIN_DEFAULT_LABEL_TEMPLATE_ID,
    BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID,
    BUILTIN_BLACK_YELLOW_LABEL_TEMPLATE_ID,
    BUILTIN_RED_BURST_LABEL_TEMPLATE_ID,
    BUILTIN_OFER_AMARELA_LABEL_TEMPLATE_ID,
    BUILTIN_BARLOW_BLACK_LABEL_TEMPLATE_ID
])

/**
 * Detecta se um id pertence aos templates built-in seedados pelo app.
 * Aceita qualquer valor (coerced para string com trim); retorna false
 * para vazio/whitespace.
 */
export const isBuiltInLabelTemplateId = (value: any): boolean => {
    const id = String(value || '').trim()
    return !!id && BUILTIN_LABEL_TEMPLATE_IDS.has(id)
}

/**
 * Extrai timestamp do template (preferindo updatedAt > createdAt) como
 * numero. Retorna NaN se ambos estiverem ausentes/invalidos — caller
 * deve tratar com `Number.isFinite()`.
 */
export const getLabelTemplateTimestamp = (tpl: any): number => {
    const ts = Date.parse(String(tpl?.updatedAt || tpl?.createdAt || ''))
    return Number.isFinite(ts) ? ts : Number.NaN
}

/**
 * Decide se devemos usar o snapshot "incoming" sobre o "prev" durante
 * hidratacao/merge de templates.
 *
 * Politica:
 *  1. `__localOverride` sempre vence sobre nao-local (proteje edicoes
 *     manuais do usuario que ainda nao subiram para o DB)
 *  2. Mesmo nivel de override: snapshot mais novo (timestamp maior) vence
 *  3. Se um lado tem timestamp e o outro nao: o que tem timestamp vence
 *  4. Nenhum dos dois com timestamp (legacy): manter o incoming
 */
export const shouldUseIncomingTemplateSnapshot = (prev: any, incoming: any): boolean => {
    const prevTs = getLabelTemplateTimestamp(prev)
    const incomingTs = getLabelTemplateTimestamp(incoming)
    const incomingIsLocalOverride = !!(incoming as any)?.__localOverride
    const prevIsLocalOverride = !!(prev as any)?.__localOverride

    if (incomingIsLocalOverride !== prevIsLocalOverride) {
        return incomingIsLocalOverride
    }

    if (Number.isFinite(incomingTs) && Number.isFinite(prevTs)) {
        return incomingTs >= prevTs
    }
    if (Number.isFinite(incomingTs) && !Number.isFinite(prevTs)) return true
    if (!Number.isFinite(incomingTs) && Number.isFinite(prevTs)) return false

    return true
}

/**
 * Chave usada para armazenar o array de label templates dentro do
 * JSON do projeto (project.canvasData[LABEL_TEMPLATES_JSON_KEY]).
 * Prefixo `__` evita colisao com props normais do canvas.
 */
export const LABEL_TEMPLATES_JSON_KEY = '__labelTemplates'

/**
 * Versao do seed do template Atacarejo. Incrementado quando o template
 * built-in muda — projetos antigos que ja seedearam uma versao anterior
 * vao re-seed automaticamente quando esse valor avanca.
 */
export const BUILTIN_ATACAREJO_SEED_VERSION = 4

/**
 * Versao do seed do template Red Burst. Mesma semantica do Atacarejo.
 */
export const BUILTIN_RED_BURST_SEED_VERSION = 2

/**
 * Versao do render do preview de label template. Cada template
 * armazena o ultimo render version usado em `__previewRenderVersion`;
 * quando esse valor diverge da versao atual, o preview e' regenerado.
 *
 * Incrementar este numero forca regeneracao de TODOS os previews
 * (util quando a estrategia de preview muda — fonte, tamanho, etc).
 */
export const LABEL_TEMPLATE_PREVIEW_RENDER_VERSION = 8

/**
 * Versao do snapshot dos manual-single-anchors (offsets cached para
 * posicionar elementos do single-price layout). Cached em
 * `priceGroup.__manualSingleAnchors.__version`. Quando essa constante
 * avanca, caches antigos sao invalidados — forca recomputacao com a
 * nova logica/coordenadas.
 */
export const MANUAL_SINGLE_ANCHOR_VERSION = 2

/**
 * Lista de props extras que devem ser persistidas em label templates
 * (alem das props padrao do Fabric). Inclui customId, name, fontFamily,
 * charSpacing, e todos os flags de manual template (`__preserveManualLayout`,
 * `__atacValueVariants`, etc).
 */
export const LABEL_TEMPLATE_EXTRA_PROPS: ReadonlyArray<string> = [
    '_customId',
    'name',
    'fontFamily',
    'visible',
    'charSpacing',
    '__preserveManualLayout',
    '__forceAtacarejoCanonical',
    '__atacValueVariants',
    '__atacVariantGroups',
    '__fontScale',
    '__yOffsetRatio',
    '__manualScaleX',
    '__manualScaleY',
    '__strokeWidth',
    '__roundness',
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
    '__shadowBlur',
    '__originalFill',
    '__manualTemplateBaseW',
    '__manualTemplateBaseH',
    '__manualGapSingle',
    '__manualGapRetail',
    '__manualGapWholesale',
    '__manualSingleAnchors',
    '__cornerTL',
    '__cornerTR',
    '__cornerBL',
    '__cornerBR',
    '__originalCornerTL',
    '__originalCornerTR',
    '__originalCornerBL',
    '__originalCornerBR'
]

/**
 * Props base de manual template — sao "estaveis" (nao derivam de
 * outros valores) e portanto persistidas as-is. Usado pelo pipeline
 * de save para identificar quais props NAO recalcular ao restaurar.
 */
export const MANUAL_TEMPLATE_STABLE_PROPS: ReadonlyArray<string> = [
    '__manualTemplateBaseW',
    '__manualTemplateBaseH'
]

/**
 * Props derivadas de manual template — sao calculadas a partir de
 * STABLE_PROPS + estado da etiqueta no momento do save. Removidas
 * antes de salvar para evitar drift entre cache e estado real.
 */
export const MANUAL_TEMPLATE_DERIVED_PROPS: ReadonlyArray<string> = [
    '__manualGapSingle',
    '__manualGapRetail',
    '__manualGapWholesale',
    '__manualSingleAnchors'
]

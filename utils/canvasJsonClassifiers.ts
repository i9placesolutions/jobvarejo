/**
 * Classificadores e walkers que operam sobre o JSON serializado do canvas
 * (apos canvas.toJSON()), antes de re-hidratar via loadFromJSON.
 *
 * Espelham os classifiers de runtime em fabricObjectClassifiers.ts mas
 * usam `obj.objects` (campo JSON) em vez de `getObjects()` (metodo Fabric).
 *
 * Util em pre/post-load para reparar/normalizar JSON sem precisar
 * instanciar objetos Fabric reais.
 *
 * Funcoes 100% puras. Cobertura: tests/utils/canvasJsonClassifiers.test.ts
 */

/**
 * Limite de entradas no LRU cache de pre-loaded canvas data por chave.
 * 24 = balanco entre hit-rate (pages tipicamente <= 24 abertas) e memoria.
 */
export const PREPARED_CANVAS_LOAD_CACHE_LIMIT = 24

/**
 * Quando o canvas tem >= esse numero de imagens de produto, o loader
 * passa a usar deferred-load: carrega as primeiras DEFERRED_PRODUCT_IMAGE_LOAD_MAX
 * imediatamente e adia o resto. Evita stress de IO/memoria em projetos
 * com muitas paginas/produtos.
 */
export const DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD = 24

/**
 * Numero maximo de imagens de produto a carregar imediatamente em modo
 * deferred. As demais sao carregadas on-demand quando o usuario navega
 * para a regiao do canvas que as exibe.
 */
export const DEFERRED_PRODUCT_IMAGE_LOAD_MAX = 72

// Espelho da constante exportada por utils/canvasAssetUrls.ts.
// Inlineado aqui para que este modulo pure permaneca livre da
// dependencia transitiva de Nuxt (`#imports`) que canvasAssetUrls
// puxa, e portanto continue testavel em ambiente Node puro (vitest).
export const CANVAS_IMAGE_PLACEHOLDER_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * Detecta uma src "placeholder" que deve ser tratada como vazia:
 *  - vazia/null/undefined
 *  - exatamente igual ao placeholder padrao do canvas
 *
 * Util para decidir se um image object esta com conteudo real ou
 * apenas mostrando um stub temporario (durante carregamento ou
 * apos blob expirar).
 */
export const isLikelyPlaceholderImageSrc = (src: any): boolean => {
    const value = String(src || '').trim()
    if (!value) return true
    return value === CANVAS_IMAGE_PLACEHOLDER_DATA_URL
}

/**
 * DFS no JSON do canvas. Visitor recebe cada nodo (root.objects + descendentes
 * de qualquer profundidade). Implementacao iterativa para evitar stack overflow
 * em projetos com muitos niveis aninhados.
 */
export const walkCanvasObjects = (root: any, visitor: (obj: any) => void): void => {
    if (!root || typeof root !== 'object') return
    const stack: any[] = Array.isArray(root.objects) ? [...root.objects] : []
    while (stack.length > 0) {
        const node = stack.pop()
        if (!node || typeof node !== 'object') continue
        visitor(node)
        if (Array.isArray(node.objects) && node.objects.length) {
            for (let i = node.objects.length - 1; i >= 0; i--) {
                stack.push(node.objects[i])
            }
        }
    }
}

/**
 * Obtem children validos (apenas objetos) de um nodo JSON tipo group.
 * Filtra null/undefined para que callers nao precisem se preocupar.
 */
export const getJsonGroupChildren = (obj: any): any[] =>
    Array.isArray(obj?.objects)
        ? obj.objects.filter((child: any) => !!child && typeof child === 'object')
        : []

/**
 * Versao JSON de isStandalonePriceGroup. Detecta uma etiqueta de preco
 * "solta" em JSON serializado (priceGroup top-level que NAO esta dentro de
 * um card e nao tem imagem/background de card).
 */
export const isStandalonePriceGroupJson = (obj: any): boolean => {
    if (!obj) return false
    if (obj.type !== 'group') return false
    if (String(obj.name || '') !== 'priceGroup') return false
    if (obj.isSmartObject || obj.isProductCard) return false
    if (String((obj as any).parentZoneId || '').trim()) return false
    if (String((obj as any).smartGridId || '').trim()) return false

    const children = getJsonGroupChildren(obj)
    const hasOfferBg = children.some((child: any) => String(child?.name || '') === 'offerBackground')
    const hasSmartImage = children.some((child: any) => {
        const childType = String(child?.type || '').toLowerCase()
        const childName = String(child?.name || '')
        return childType === 'image' || ['smart_image', 'product_image', 'productImage'].includes(childName)
    })

    return !hasOfferBg && !hasSmartImage
}

/**
 * Versao JSON de isLikelyProductCard. Espelha exatamente a heuristica
 * runtime mas opera no JSON serializado.
 */
export const isLikelyProductCardJson = (obj: any): boolean => {
    if (!obj) return false
    if (obj.excludeFromExport || obj.isFrame) return false
    if (obj.type !== 'group') return false
    if (isStandalonePriceGroupJson(obj)) return false

    const parentZoneId = String((obj as any).parentZoneId || '').trim()
    if (parentZoneId) return true

    const cardWidth = Number((obj as any)._cardWidth)
    const cardHeight = Number((obj as any)._cardHeight)
    if (Number.isFinite(cardWidth) && cardWidth > 0 && Number.isFinite(cardHeight) && cardHeight > 0) return true
    if (String((obj as any).smartGridId || '').trim()) return true
    if (String((obj as any).priceMode || '').trim()) return true
    if (obj.isSmartObject || obj.isProductCard) return true

    const children = getJsonGroupChildren(obj)
    if (!children.length) return false

    const isTextLike = (child: any) => String(child?.type || '').toLowerCase().includes('text')
    const hasOfferBg = children.some((child: any) => String(child?.name || '') === 'offerBackground')
    const hasBg =
        hasOfferBg ||
        children.some(
            (child: any) =>
                String(child?.type || '').toLowerCase() === 'rect' &&
                /(offerBackground|background|bg)/i.test(String(child?.name || ''))
        )
    const hasPriceGroup = children.some(
        (child: any) =>
            String(child?.type || '').toLowerCase() === 'group' &&
            String(child?.name || '') === 'priceGroup'
    )
    const hasAnyPriceText = children.some((child: any) =>
        /price_(integer|decimal|value|currency|unit)_text/i.test(String(child?.name || ''))
    )
    const hasImage = children.some((child: any) => {
        const childType = String(child?.type || '').toLowerCase()
        const childName = String(child?.name || '')
        return childType === 'image' || ['smart_image', 'product_image', 'productImage'].includes(childName)
    })
    const hasTitle = children.some(
        (child: any) => isTextLike(child) && /(^smart_title$|^title$|title)/i.test(String(child?.name || ''))
    )
    const textCount = children.filter((child: any) => isTextLike(child)).length
    const nonTextCount = children.length - textCount

    if (hasOfferBg) return true
    if (hasPriceGroup && (hasImage || hasTitle || textCount >= 1)) return true
    if (textCount >= 1 && nonTextCount >= 1 && (hasImage || hasBg || hasAnyPriceText)) return true

    const signals = [hasPriceGroup, hasImage, hasTitle, hasBg, hasAnyPriceText].filter(Boolean).length
    if (hasAnyPriceText && hasImage && textCount >= 1) return true
    return signals >= 3 || (hasAnyPriceText && textCount >= 2)
}

/**
 * Extrai a dimensao "base" do card (largura x altura) a partir do JSON.
 * Tenta na ordem: _cardWidth/_cardHeight > offerBackground > card.width/height.
 * Retorna null se nada estiver disponivel.
 *
 * Usado em containment / collision detection durante post-load.
 */
/**
 * Obtem largura/altura efetivas de um nodo JSON. `opts.scaleX/Y` permite
 * sobrescrever a escala do proprio objeto (uteis quando se quer medir
 * com uma escala-alvo hipotetica). Retorna null para dimensoes invalidas
 * (zero, negativas, NaN/Infinity).
 */
export const getJsonObjectSize = (
    obj: any,
    opts: { scaleX?: number; scaleY?: number } = {}
): { width: number; height: number } | null => {
    const rawWidth = Number(obj?.width ?? 0)
    const rawHeight = Number(obj?.height ?? 0)
    const scaleX = Math.abs(Number(opts.scaleX ?? obj?.scaleX ?? 1)) || 1
    const scaleY = Math.abs(Number(opts.scaleY ?? obj?.scaleY ?? 1)) || 1
    const width = Math.abs(rawWidth * scaleX)
    const height = Math.abs(rawHeight * scaleY)
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return null
    }
    return { width, height }
}

/**
 * Calcula o centro de um nodo JSON no plano do parent, respeitando origem
 * (left/center/right e top/center/bottom). Retorna null para dimensoes
 * invalidas ou left/top nao-finitos.
 */
export const getJsonObjectCenterInParentPlane = (
    obj: any,
    opts: { scaleX?: number; scaleY?: number } = {}
): { x: number; y: number } | null => {
    const size = getJsonObjectSize(obj, opts)
    if (!size) return null

    const left = Number(obj?.left ?? 0)
    const top = Number(obj?.top ?? 0)
    const originX = String(obj?.originX || 'left')
    const originY = String(obj?.originY || 'top')
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null

    const centerX = originX === 'center'
        ? left
        : originX === 'right'
            ? left - (size.width / 2)
            : left + (size.width / 2)
    const centerY = originY === 'center'
        ? top
        : originY === 'bottom'
            ? top - (size.height / 2)
            : top + (size.height / 2)

    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null
    return { x: centerX, y: centerY }
}

/**
 * Define a posicao de um nodo JSON de forma que seu centro fique em
 * (centerX, centerY) no plano do parent. Mantem origem; muta `obj.left`
 * e `obj.top`. Retorna `true` se aplicou, `false` se a operacao nao foi
 * possivel (size invalido, left/top nao-finitos).
 */
export const setJsonObjectCenterInParentPlane = (
    obj: any,
    centerX: number,
    centerY: number,
    opts: { scaleX?: number; scaleY?: number } = {}
): boolean => {
    const size = getJsonObjectSize(obj, opts)
    if (!size) return false

    const originX = String(obj?.originX || 'left')
    const originY = String(obj?.originY || 'top')
    const nextLeft = originX === 'center'
        ? centerX
        : originX === 'right'
            ? centerX + (size.width / 2)
            : centerX - (size.width / 2)
    const nextTop = originY === 'center'
        ? centerY
        : originY === 'bottom'
            ? centerY + (size.height / 2)
            : centerY - (size.height / 2)

    if (!Number.isFinite(nextLeft) || !Number.isFinite(nextTop)) return false
    obj.left = nextLeft
    obj.top = nextTop
    return true
}

/**
 * Versao "retorna array" do walk — retorna lista plana de todos os
 * descendentes do group JSON. Equivalente a:
 *   const out = []; walkCanvasObjects(g, n => out.push(n)); return out;
 * mas reimplementada para evitar overhead de callback em hot-paths.
 */
export const collectTemplateJsonNodes = (root: any): any[] => {
    const out: any[] = []
    const stack: any[] = Array.isArray(root?.objects) ? [...root.objects] : []
    while (stack.length) {
        const cur = stack.pop()
        if (!cur || typeof cur !== 'object') continue
        out.push(cur)
        if (Array.isArray(cur.objects)) {
            for (const child of cur.objects) stack.push(child)
        }
    }
    return out
}

/**
 * Verifica se um template JSON tem o minimo necessario para renderizar.
 * Aceita:
 *  - atacarejo (3 backgrounds: retail/banner/wholesale)
 *  - single-price com price_bg + texto principal de preco
 *  - fallback generico: ao menos 1 rect e 1 texto
 *
 * Util para detectar templates "vazios" em recovery / auto-heal antes
 * de cair em variantes ou fallback default.
 */
export const isTemplateGroupJsonRenderable = (groupJson: any): boolean => {
    if (!groupJson || typeof groupJson !== 'object') return false
    const objects = collectTemplateJsonNodes(groupJson)
    if (!objects.length) return false

    const hasName = (name: string) => objects.some((o: any) => String(o?.name || '') === name)
    const hasAtac =
        hasName('atac_retail_bg') &&
        hasName('atac_banner_bg') &&
        hasName('atac_wholesale_bg')
    if (hasAtac) return true

    const hasSinglePriceCore =
        hasName('price_bg') &&
        (
            hasName('price_integer_text') ||
            hasName('price_value_text') ||
            hasName('smart_price')
        )
    if (hasSinglePriceCore) return true

    let hasRect = false
    let hasText = false
    for (const node of objects) {
        const t = String(node?.type || '').toLowerCase()
        if (t === 'rect') hasRect = true
        if (t === 'text' || t === 'i-text' || t === 'itext' || t === 'textbox') hasText = true
        if (hasRect && hasText) return true
    }
    return false
}

/**
 * Detecta template atacarejo (2-tier) via presenca de `atac_retail_bg`.
 */
export const isAtacarejoTemplateGroupJson = (groupJson: any): boolean => {
    if (!groupJson || typeof groupJson !== 'object') return false
    const nodes = collectTemplateJsonNodes(groupJson)
    return nodes.some((o: any) => String(o?.name || '') === 'atac_retail_bg')
}

/**
 * Tipos de texto Fabric que aparecem em price groups (text, textbox, i-text).
 */
export const PRICE_GROUP_TEXT_TYPES = new Set(['text', 'textbox', 'i-text'])

/**
 * Detecta um src "placeholder" de imagem (data URL gerado quando uma
 * inline image grande foi stripada na serializacao). Heuristica:
 * data:image/* com tamanho < 200 chars (1x1 placeholder).
 *
 * Usado pelo price-group renderable check para nao tratar placeholders
 * como imagens reais que precisam de carregamento.
 */
export const isTinyPlaceholderImageSrc = (src: string): boolean => {
    const normalized = String(src || '').trim()
    return /^data:image\//i.test(normalized) && normalized.length > 0 && normalized.length < 200
}

/**
 * Detecta um nodo JSON do tipo image (case-insensitive).
 */
export const isPriceGroupTemplateImageNode = (node: any): boolean =>
    String(node?.type || '').toLowerCase() === 'image'

/**
 * Detecta uma imagem RENDERAVEL no template do price group (tem image
 * type, src nao-vazio, src nao-stripado e nao-placeholder).
 */
export const isRenderablePriceGroupTemplateImageNode = (node: any): boolean => {
    if (!isPriceGroupTemplateImageNode(node)) return false
    const src = String(node?.src || '').trim()
    if (!src) return false
    if ((node as any)?.__srcStripped === true) return false
    if (isTinyPlaceholderImageSrc(src)) return false
    return true
}

/**
 * Versao JSON de getPreferredProductImageFromGroup. Busca entre
 * `card.objects` a imagem candidata a "Replace Image", priorizando
 * smartType=product-image e nomes conhecidos antes do primeiro
 * candidato qualquer.
 */
export const getPreferredProductImageFromCardJson = (card: any): any | null => {
    const children = getJsonGroupChildren(card)
        .filter((child: any) => isProductCardImageSelectionCandidateJson(child))
    if (!children.length) return null

    const primary = children.find((child: any) => {
        const smartType = String((child as any)?.data?.smartType || '').toLowerCase()
        const name = String((child as any)?.name || '').toLowerCase()
        return smartType === 'product-image' ||
            name === 'smart_image' ||
            name === 'product_image' ||
            name === 'productimage'
    })

    return primary || children[0] || null
}

/**
 * Conta total de objetos e imagens em um canvasData JSON.
 *
 * Walks recursivo (DFS) em `objects` e `clipPath`, com proteção contra
 * referencias circulares via WeakSet visited. Conta TODOS os nodos com
 * `type` (incluindo groups) — entao o total cresce com profundidade.
 */
export const countCanvasJsonObjectsAndImages = (canvasData: any): { objects: number; images: number } => {
    const visited = new Set<any>()
    let objects = 0
    let images = 0

    const walk = (node: any) => {
        if (!node) return
        if (visited.has(node)) return
        if (typeof node === 'object') visited.add(node)

        if (Array.isArray(node)) {
            node.forEach(walk)
            return
        }

        if (typeof node !== 'object') return

        const t = String((node as any).type || '').toLowerCase()
        if (t) objects++
        if (t === 'image') images++

        const children = (node as any).objects
        if (Array.isArray(children)) walk(children)

        const clip = (node as any).clipPath
        if (clip && typeof clip === 'object') walk(clip)
    }

    walk(canvasData)
    return { objects, images }
}

/**
 * Clone defensivo de canvasData antes de loadFromJSON. Tenta
 * structuredClone, depois JSON, e como ultima saida retorna o original
 * (caller deve copiar com cuidado para nao mutar shared state).
 */
export const cloneCanvasDataForLoad = (canvasData: any): any => {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(canvasData)
        }
        return JSON.parse(JSON.stringify(canvasData))
    } catch {
        return canvasData
    }
}

/**
 * Gera um token estavel para cache de canvasData preparado para load.
 * Combina savedAt + objectCount + version. Diferente significa "preparar
 * de novo"; igual significa "reusar o resultado em cache".
 *
 * Aceita savedAt em varias localizacoes (raiz ou meta.savedAt) por
 * compatibilidade com formatos legados.
 */
export const getCanvasLoadCacheToken = (canvasData: any): string => {
    if (!canvasData || typeof canvasData !== 'object') return 'empty'

    const root = canvasData as Record<string, any>
    const directSavedAt = [
        root.__savedAt,
        root._savedAt,
        root.savedAt,
        root.updatedAt
    ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0) || 0
    const metaSavedAt = Number(root?.meta?.savedAt)
    const savedAt = directSavedAt || (Number.isFinite(metaSavedAt) && metaSavedAt > 0 ? metaSavedAt : 0)
    const objectCount = Array.isArray(root.objects) ? root.objects.length : 0
    const version = String(root.version || '')

    return `${savedAt}:${objectCount}:${version}`
}

/**
 * Walk no canvasData JSON coletando todos os nodos image que apontam
 * para Contabo Storage (contabostorage.com / usc1.contabostorage.com).
 *
 * Util para regenerar URLs presignadas em batch antes do load.
 */
export const collectContaboImageNodes = (canvasData: any): any[] => {
    const images: any[] = []
    walkCanvasObjects(canvasData, (node) => {
        const src = String(node?.src || '')
        if (String(node?.type || '').toLowerCase() !== 'image') return
        if (!src) return
        if (!src.includes('contabostorage.com') && !src.includes('usc1.contabostorage.com')) return
        images.push(node)
    })
    return images
}

/**
 * Detecta se um src de imagem e' "potencialmente quebrado" — uma URL
 * remota cuja conexao pode ter expirado ou que precisa de proxy. Util
 * para decidir se vale tentar refresh/proxy antes do load.
 *
 * Aceita:
 *  - blob: URLs (efemeros)
 *  - URLs Contabo / Wasabi
 *  - URLs do proxy interno (/api/storage/proxy ou /api/storage/p)
 *  - qualquer http(s) remoto
 *
 * Rejeita:
 *  - vazio
 *  - data: URLs (inline, nao quebra)
 */
export const isPotentiallyBrokenRemoteImageSrc = (src: string): boolean => {
    const value = String(src || '').trim().toLowerCase()
    if (!value) return false
    if (value.startsWith('data:')) return false
    if (value.startsWith('blob:')) return true
    if (value.includes('contabostorage.com')) return true
    if (value.includes('wasabisys.com')) return true
    if (value.includes('/api/storage/proxy')) return true
    if (value.includes('/api/storage/p')) return true
    if (value.startsWith('http://') || value.startsWith('https://')) return true
    return false
}

/**
 * Substitui src de imagens remotas potencialmente quebradas por placeholder
 * para permitir loadFromJSON quando URLs expiraram (Contabo/Wasabi/proxy
 * 404 etc). Preserva __originalSrc para recovery posterior.
 *
 * Por default clona o canvasData (nao muta input). Use `opts.clone: false`
 * para mutacao in-place quando o caller ja tem copia.
 *
 * Recursivo via walkCanvasObjects — imagens em groups aninhados tambem
 * sao tratadas.
 */
export const replaceContaboImagesWithPlaceholder = (
    canvasData: any,
    opts: { clone?: boolean } = {}
): any => {
    const cloned = opts.clone === false ? canvasData : cloneCanvasDataForLoad(canvasData)
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned

    walkCanvasObjects(cloned, (obj) => {
        const objType = (obj.type || '').toLowerCase()
        if (
            objType === 'image' &&
            typeof obj.src === 'string' &&
            isPotentiallyBrokenRemoteImageSrc(obj.src)
        ) {
            if (!obj.__originalSrc) {
                obj.__originalSrc = obj.src
            }
            obj.src = CANVAS_IMAGE_PLACEHOLDER_DATA_URL
        }
    })
    return cloned
}

/**
 * Decodifica %3A em URLs da Contabo (bucket "tenant%3Abucket" → "tenant:bucket").
 *
 * O Fabric/Vue as vezes serializa com encoding URI no path; o backend
 * Contabo aceita ambos mas as imagens podem nao carregar em alguns
 * navegadores se o path estiver duplamente encoded. Este pre-processo
 * normaliza para a forma decoded.
 *
 * Retorna copia profunda — nao muta o input.
 */
export const decodeContaboUrls = (canvasData: any): any => {
    const cloned = JSON.parse(JSON.stringify(canvasData))
    if (!cloned?.objects || !Array.isArray(cloned.objects)) return cloned

    let count = 0
    const processObject = (obj: any): void => {
        if (!obj) return
        const objType = (obj.type || '').toLowerCase()
        if (objType === 'image' && typeof obj.src === 'string' && obj.src.includes('contabostorage.com')) {
            if (obj.src.includes('%3A')) {
                try {
                    const urlObj = new URL(obj.src)
                    urlObj.pathname = decodeURIComponent(urlObj.pathname)
                    obj.src = urlObj.toString()
                    count++
                } catch {
                    obj.src = obj.src.replace(/\/([^\/]+)%3A([^\/]+)\//, (_match: string, tenant: string, bucket: string) => {
                        return `/${tenant}:${bucket}/`
                    })
                    count++
                }
            }
        }
        if (obj.objects && Array.isArray(obj.objects)) {
            obj.objects.forEach((child: any) => processObject(child))
        }
    }

    cloned.objects.forEach((obj: any) => processObject(obj))
    return cloned
}

/**
 * Remove recursivamente todos os objetos do tipo 'image' da arvore JSON.
 * Util para gerar previews ou validar canvas sem peso de imagens.
 *
 * Operacao MUTATIVA — modifica o `node` recebido. Caller deve passar
 * uma copia se quiser preservar o original.
 */
export const removeImageObjectsDeep = (node: any): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node.objects)) {
        node.objects = node.objects
            .filter((child: any) => String(child?.type || '').toLowerCase() !== 'image')
            .map((child: any) => removeImageObjectsDeep(child))
    }
    return node
}

/**
 * Detecta se um src de imagem e' candidato a "deferred load" — uma URL
 * remota que vale a pena adiar o carregamento ate o frame ficar visivel.
 *
 * Rejeita:
 *  - vazio
 *  - placeholder oficial do editor
 *  - data: URLs (ja inline, nao tem o que adiar)
 *  - blob: URLs (efemeros, podem expirar)
 *
 * Aceita: HTTP(S) e outros que justificam deferral.
 */
export const isDeferredProductImageCandidateSrc = (src: string): boolean => {
    const value = String(src || '').trim()
    if (!value) return false
    if (value === CANVAS_IMAGE_PLACEHOLDER_DATA_URL) return false
    if (value.startsWith('data:')) return false
    if (value.startsWith('blob:')) return false
    return true
}

/**
 * Detecta nodo JSON image que pode ser substituido por imagem nova
 * via "Replace Image" UI. Aceita imagens com smartType=product-image
 * ou nomes conhecidos (smart_image/product_image/productImage), exceto
 * imagens estruturais (price_bg_image, splash_image).
 */
export const isProductCardImageSelectionCandidateJson = (obj: any): boolean => {
    if (!obj || String(obj?.type || '').toLowerCase() !== 'image') return false
    const smartType = String((obj as any)?.data?.smartType || '').toLowerCase()
    const name = String((obj as any)?.name || '').toLowerCase()
    if (name === 'price_bg_image' || name === 'splash_image') return false
    if (smartType === 'product-image') return true
    if (name === 'smart_image' || name === 'product_image' || name === 'productimage') return true
    if (name.startsWith('extra_image_')) return true
    return true
}

/**
 * Normaliza chave de cache de canvas-load (trim de whitespace).
 * Retorna string vazia para null/undefined/whitespace.
 */
export const normalizePreparedCanvasLoadCacheKey = (value?: string | null): string =>
    String(value || '').trim()

/**
 * Estatisticas de "reparo de imagens em cards de produto legacy" geradas
 * durante prepareCanvasDataForLoad. Carregadas no cache de prepared data.
 */
export type LegacyProductCardImageRepairStats = {
    cardsScanned: number
    imagesScanned: number
    imagesRepaired: number
    needsPostLoadRepair: boolean
}

/**
 * Tipo de "modo de reparo" decidido apos analise das stats:
 *  - 'auto': sem dados de reparo (sera decidido em runtime)
 *  - 'force': stats indicam que precisa rodar reparo apos load
 *  - 'skip': reparo ja foi feito (no-op em runtime)
 */
export type LegacyRepairMode = 'auto' | 'force' | 'skip'

/**
 * Decide o modo de reparo a partir das estatisticas guardadas no cache
 * de prepared canvas data. Retorna 'auto' quando nao ha dados (pre-warm
 * incompleto).
 */
export const getLegacyProductCardImageRepairMode = (
    stats: LegacyProductCardImageRepairStats | null | undefined
): LegacyRepairMode => {
    if (!stats) return 'auto'
    return stats.needsPostLoadRepair ? 'force' : 'skip'
}

/**
 * Constroi a chave de cache para o canvasData preparado de uma pagina.
 *
 * Prioridade:
 *  1. `page.canvasDataPath` (path estavel no storage) → `path:<value>`
 *  2. project + page id → `project:<projId>:page:<pageId>`
 *  3. apenas page id → `page:<pageId>`
 *  4. nada disponivel → null
 *
 * Recebe `projectId` como parametro injetado (vez de ler de
 * estado global) para que a funcao continue pura e testavel.
 */
export const buildPreparedCanvasDataCacheKey = (page: any, projectId?: string | null): string | null => {
    const path = String(page?.canvasDataPath || '').trim()
    if (path) return `path:${path}`

    const pageId = String(page?.id || '').trim()
    if (!pageId) return null

    const projId = String(projectId || '').trim()
    if (projId) return `project:${projId}:page:${pageId}`
    return `page:${pageId}`
}

/**
 * Detecta um nodo "shell" visual do price group — qualquer elemento
 * que NAO e' texto, NAO e' group e NAO e' o background de moeda
 * (price_currency_bg, intencionalmente oculto em alguns templates).
 *
 * Util para forcar visibilidade de backgrounds estruturais durante
 * auto-heal de templates corrompidos por viewport culling.
 */
export const isPriceGroupVisualShellNode = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false
    const type = String(node?.type || '').toLowerCase()
    if (!type || PRICE_GROUP_TEXT_TYPES.has(type)) return false
    if (type === 'group') return false
    const name = String(node?.name || '')
    if (name === 'price_currency_bg') return false
    return true
}

/**
 * Detecta template "Red Burst" via combinacao de 6 nomes especificos.
 */
export const isRedBurstTemplateGroupJson = (groupJson: any): boolean => {
    if (!groupJson || typeof groupJson !== 'object') return false
    const nodes = collectTemplateJsonNodes(groupJson)
    const names = new Set(nodes.map((o: any) => String(o?.name || '')))
    return (
        names.has('price_bg') &&
        names.has('price_header_bg') &&
        names.has('price_header_text') &&
        names.has('price_burst_line_a') &&
        names.has('price_integer_text') &&
        names.has('price_decimal_text')
    )
}

/**
 * DFS no JSON retornando uma lista plana { node, parent } de todos os
 * descendentes do group. Util para reparos/normalizacoes que precisam
 * conhecer o pai imediato de cada nodo (ex: re-vincular cards a zones).
 */
export const collectJsonDescendantsWithParent = (group: any): Array<{ node: any; parent: any }> => {
    const out: Array<{ node: any; parent: any }> = []
    const stack: Array<{ node: any; parent: any }> = getJsonGroupChildren(group).map(
        (child: any) => ({ node: child, parent: group })
    )
    while (stack.length > 0) {
        const current = stack.pop()
        if (!current?.node || typeof current.node !== 'object') continue
        out.push(current)
        const children = getJsonGroupChildren(current.node)
        for (let i = children.length - 1; i >= 0; i--) {
            stack.push({ node: children[i], parent: current.node })
        }
    }
    return out
}

/**
 * Clone profundo "best-effort" de metadados (productData, _zone*Snapshot, etc).
 *
 * Tenta JSON.parse(JSON.stringify(...)) primeiro. Se falhar (referencias
 * circulares, valores nao-serializaveis), cai em recursao manual que:
 *  - Preserva arrays
 *  - Preserva objetos descartando entries que sao funcoes
 *  - Retorna primitivos sem mutacao
 *
 * Diferente de cloneTemplateGroupJson: este e' generico para qualquer
 * payload "plain", sem assumir estrutura `{ objects: [...] }`.
 */
export const clonePlainMetadata = (value: any): any => {
    if (value == null) return value
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        if (Array.isArray(value)) return value.map((item) => clonePlainMetadata(item))
        if (typeof value === 'object') {
            const out: Record<string, any> = {}
            Object.entries(value).forEach(([key, entry]: [string, any]) => {
                if (typeof entry === 'function') return
                out[key] = clonePlainMetadata(entry)
            })
            return out
        }
        return value
    }
}

/**
 * Clone profundo de um group JSON (template de etiqueta, normalmente).
 *
 * Estrategia em camadas:
 *  1. structuredClone (preferido — preserva tipos, lida com Map/Set/etc).
 *  2. JSON.parse(JSON.stringify(...)) — fallback comum.
 *  3. Clone raso recursivo de 2 niveis — ultima saida quando os 2 acima
 *     falham (referencias circulares, valores nao-serializaveis tipo
 *     funcao). Preserva apenas a estrutura minima `{...group, objects: [...]}`.
 *
 * Retorna null para entradas nao-objeto.
 *
 * Critico para evitar shared-state entre templates duplicados — o bug
 * historico era que editar variantes em uma copia mutava o template
 * original porque o clone era atribuicao por referencia.
 */
export const cloneTemplateGroupJson = (group: any): any | null => {
    if (!group || typeof group !== 'object') return null
    try {
        return typeof structuredClone === 'function'
            ? structuredClone(group)
            : JSON.parse(JSON.stringify(group))
    } catch {
        try {
            return JSON.parse(JSON.stringify(group))
        } catch {
            // Ultima saida: clone raso de 2 niveis
            const shallow: any = { ...group }
            if (Array.isArray(group.objects)) {
                shallow.objects = group.objects.map((o: any) => {
                    if (!o || typeof o !== 'object') return o
                    const clone: any = { ...o }
                    if (Array.isArray(o.objects)) {
                        clone.objects = o.objects.map((c: any) =>
                            c && typeof c === 'object' ? { ...c } : c
                        )
                    }
                    return clone
                })
            }
            return shallow
        }
    }
}

export const getCardBaseSizeForContainmentJson = (card: any): { w: number; h: number } | null => {
    if (!card) return null
    const storedW = Number((card as any)._cardWidth)
    const storedH = Number((card as any)._cardHeight)
    if (Number.isFinite(storedW) && storedW > 0 && Number.isFinite(storedH) && storedH > 0) {
        return { w: storedW, h: storedH }
    }

    const bg = getJsonGroupChildren(card).find(
        (child: any) =>
            child?.name === 'offerBackground' &&
            String(child?.type || '').toLowerCase() === 'rect'
    )
    const bgW = Number(bg?.width)
    const bgH = Number(bg?.height)
    if (Number.isFinite(bgW) && bgW > 0 && Number.isFinite(bgH) && bgH > 0) {
        return { w: bgW, h: bgH }
    }

    const cardW = Number(card?.width)
    const cardH = Number(card?.height)
    if (Number.isFinite(cardW) && cardW > 0 && Number.isFinite(cardH) && cardH > 0) {
        return { w: cardW, h: cardH }
    }

    return null
}

/**
 * DFS iterativo que retorna lista achatada de TODOS os nodos
 * descendentes (incluindo o root) em um JSON serializado. Diferente
 * de walkCanvasObjects que recebe visitor; este retorna array.
 *
 * Inclui o root no resultado (ao contrario de walkCanvasObjects que
 * comeca de root.objects).
 *
 * Pure: nao acessa canvas/refs.
 */
export const collectTemplateJsonNodesDeep = (root: any): any[] => {
    if (!root || typeof root !== 'object') return []
    const out: any[] = []
    const stack: any[] = [root]
    while (stack.length) {
        const node = stack.pop()
        if (!node || typeof node !== 'object') continue
        out.push(node)
        const objects = Array.isArray((node as any).objects) ? (node as any).objects : []
        for (let i = objects.length - 1; i >= 0; i--) stack.push(objects[i])
    }
    return out
}

/**
 * Restaura props perdidas no enlivenObjects (Fabric v7) a partir do
 * JSON original:
 *  - name (Fabric v7 nao restaura name de children)
 *  - visible=false (Fabric v7 reseta para true em alguns casos)
 *  - props prefixadas com `_` (custom: _zoneSlot, _customId, _cardWidth,
 *    _productData, etc) — apenas se o objeto enlivened nao tiver
 *
 * Recursivo em groups aninhados (via getObjects).
 *
 * Mutativo no array de objects passado. Pure no sentido de nao acessar
 * canvas/refs.
 */
export const restoreNamesFromJson = (objects: any[], jsonArr: any[]): void => {
    for (let i = 0; i < objects.length && i < jsonArr.length; i++) {
        const obj = objects[i]
        const json = jsonArr[i]
        if (!obj || !json) continue
        if (json.name && !obj.name) {
            obj.name = json.name
        }
        if (json.visible === false && obj.visible !== false) {
            obj.visible = false
        }
        for (const key of Object.keys(json)) {
            if (key.startsWith('_') && obj[key] === undefined) {
                obj[key] = json[key]
            }
        }
        const childObjs = typeof obj.getObjects === 'function' ? obj.getObjects() : null
        const childJsons = Array.isArray(json.objects) ? json.objects : null
        if (childObjs && childJsons && childObjs.length > 0 && childJsons.length > 0) {
            restoreNamesFromJson(childObjs, childJsons)
        }
    }
}

/**
 * Repara elementos ocultos dentro de priceGroups em produtos, no JSON
 * pre-load. Viewport culling pode persistir `visible: false` em
 * elementos que deveriam ficar visiveis (backgrounds, texts, imagens).
 *
 * Estrategia:
 *  1. Identifica priceGroups pelo nome 'priceGroup' OU pela estrutura
 *     (Rect + textos com nomes conhecidos)
 *  2. Se ha qualquer texto visivel, restaura visibilidade de TODOS os
 *     elementos estruturais (Rect/Image de fundo, textos de preco)
 *  3. Se NENHUM elemento esta visivel mas ha conteudo, restaura tudo
 *     (caso raro de corrupcao total por culling)
 *  4. Recursivo em sub-grupos (atacarejo retail+wholesale)
 *  5. Repara `price_bg` com fill transparente: restaura
 *     `__originalFill` ou `'#000000'`.
 *
 * Mutates o JSON in place. Retorna numero de elementos reparados.
 */
export const repairHiddenPriceGroupTexts = (json: any): number => {
    if (!json || !Array.isArray(json.objects)) return 0
    let repaired = 0

    const isProductCardGroup = (obj: any): boolean => {
        if (obj?.type !== 'Group' && obj?.type !== 'group') return false
        const children = Array.isArray(obj.objects) ? obj.objects : []
        const hasTextbox = children.some((c: any) => c?.type === 'Textbox')
        const hasNestedGroup = children.some((c: any) => c?.type === 'Group' || c?.type === 'group')
        return hasTextbox && hasNestedGroup
    }

    const PRICE_BG_NAMES = new Set([
        'price_bg', 'price_bg_image', 'splash_image',
        'price_header_bg', 'offerBackground',
        'atac_banner_bg', 'atac_wholesale_bg', 'atac_retail_bg'
    ])
    const PRICE_TEXT_NAMES = new Set([
        'price_currency_text', 'price_integer_text', 'price_decimal_text',
        'price_unit_text', 'price_value_text', 'smart_price',
        'price_header_text', 'price_header_unit_text',
        'priceInteger', 'priceDecimal', 'price_integer', 'price_decimal',
        'atac_retail_price', 'atac_wholesale_price',
        'atac_retail_unit', 'atac_wholesale_unit',
        'atac_retail_label', 'atac_wholesale_label'
    ])

    const isTextType = (t: string) => t === 'IText' || t === 'Textbox' || t === 'Text'
    const isBackgroundType = (t: string) => t === 'Rect' || t === 'Circle' || t === 'Ellipse' || t === 'Image' || t === 'Path'

    const collectAllDeep = (objs: any[]): any[] => {
        const out: any[] = []
        const stack = [...objs]
        while (stack.length) {
            const o = stack.pop()
            if (!o || typeof o !== 'object') continue
            out.push(o)
            if (Array.isArray(o.objects)) {
                for (let i = o.objects.length - 1; i >= 0; i--) stack.push(o.objects[i])
            }
        }
        return out
    }

    const repairPriceGroup = (pg: any) => {
        const children = Array.isArray(pg.objects) ? pg.objects : []
        if (!children.length) return

        const allDeep = collectAllDeep(children)

        const pgName = String(pg.name || '')
        const isPriceGroupByName = pgName === 'priceGroup'
        const hasNamedPriceElements = allDeep.some((o: any) =>
            PRICE_BG_NAMES.has(String(o?.name || '')) || PRICE_TEXT_NAMES.has(String(o?.name || ''))
        )
        if (!isPriceGroupByName && !hasNamedPriceElements) return

        const visibleTexts = allDeep.filter((o: any) => isTextType(String(o?.type || '')) && o.visible !== false)
        const hiddenTexts = allDeep.filter((o: any) => isTextType(String(o?.type || '')) && o.visible === false)
        const hiddenBgs = allDeep.filter((o: any) => {
            if (o.visible !== false) return false
            const name = String(o?.name || '')
            const type = String(o?.type || '')
            if (name === 'price_currency_bg') return false
            return PRICE_BG_NAMES.has(name) || (isBackgroundType(type) && !isTextType(type))
        })

        const hasAnyVisible = visibleTexts.length > 0 || allDeep.some((o: any) => o.visible !== false)
        const shouldRepairBgs = visibleTexts.length > 0 || !hasAnyVisible

        if (shouldRepairBgs) {
            for (const bg of hiddenBgs) {
                bg.visible = true
                repaired++
            }
        }

        for (const txt of hiddenTexts) {
            const name = String(txt?.name || '')
            if (PRICE_TEXT_NAMES.has(name)) {
                txt.visible = true
                repaired++
                continue
            }
            const visibleRects = children.filter((c: any) => c?.type === 'Rect' && c.visible !== false)
            for (const rect of visibleRects) {
                const rTop = rect.top ?? 0
                const rBottom = rTop + (rect.height ?? 0)
                const tTop = txt.top ?? 0
                if (tTop >= rTop - 25 && tTop < rBottom) {
                    txt.visible = true
                    repaired++
                    break
                }
            }
        }

        if (pg.visible === false && allDeep.length > 0) {
            pg.visible = true
            repaired++
        }

        const priceBgNode = allDeep.find((o: any) => o?.name === 'price_bg')
        const hasBgImageNode = allDeep.some((o: any) => isRenderablePriceGroupTemplateImageNode(o))
        if (priceBgNode && !hasBgImageNode) {
            const curFill = priceBgNode.fill
            if (!curFill || curFill === 'transparent' || curFill === '') {
                priceBgNode.fill = priceBgNode.__originalFill || '#000000'
                repaired++
            }
        }

        for (const child of children) {
            if ((child?.type === 'Group' || child?.type === 'group') && Array.isArray(child.objects)) {
                repairPriceGroup(child)
            }
        }
    }

    for (const obj of json.objects) {
        if (!isProductCardGroup(obj)) continue
        const children = Array.isArray(obj.objects) ? obj.objects : []
        for (const child of children) {
            if ((child?.type === 'Group' || child?.type === 'group') && Array.isArray(child.objects)) {
                repairPriceGroup(child)
            }
        }
    }

    return repaired
}

/**
 * Sanitiza arvore JSON Fabric pre-load:
 *  1. Garante que groups com `objects[]` mas sem `type` recebem
 *     `type: 'group'` (Fabric exige type para hidratar)
 *  2. Remove children invalidos (null, non-object, type vazio/'undefined'/'null'/'unknown')
 *  3. Recursivo em `clipPath` e em `objects[]` filhos
 *  4. Aplica em `clipPath` da raiz tambem
 *
 * Mutates a entrada in place. Retorna estatisticas de quantos
 * elementos foram removidos e quantos groups receberam type forcado.
 *
 *  - allowRootWithoutType: se true, NAO forca type='group' no root
 *    (util quando root e' o canvas JSON, nao um group)
 */
export const sanitizeFabricJsonTreeForLoad = (
    root: any,
    opts: { allowRootWithoutType?: boolean } = {}
): { removed: number; fixedGroupTypes: number } => {
    if (!root || typeof root !== 'object') return { removed: 0, fixedGroupTypes: 0 }

    let removed = 0
    let fixedGroupTypes = 0
    const allowRootWithoutType = opts.allowRootWithoutType === true

    const ensureGroupType = (node: any) => {
        if (!node || typeof node !== 'object') return
        if (!Array.isArray((node as any).objects)) return
        const rawType = String((node as any).type || '').trim().toLowerCase()
        if (rawType) return
        (node as any).type = 'group'
        fixedGroupTypes += 1
    }

    const visitClipPath = (clip: any) => {
        if (!clip || typeof clip !== 'object') return
        ensureGroupType(clip)
        sanitizeContainer(clip)
        if ((clip as any).clipPath && typeof (clip as any).clipPath === 'object') {
            visitClipPath((clip as any).clipPath)
        }
    }

    const sanitizeContainer = (container: any) => {
        if (!container || typeof container !== 'object') return
        const children = Array.isArray((container as any).objects) ? (container as any).objects : null
        if (!children) return

        const INVALID_TYPES = new Set(['', 'undefined', 'null', 'unknown'])

        const nextChildren: any[] = []
        for (const child of children) {
            if (!child || typeof child !== 'object') {
                removed += 1
                continue
            }
            ensureGroupType(child)
            const rawType = (child as any).type
            const childType = (rawType == null ? '' : String(rawType)).trim().toLowerCase()
            if (!childType || INVALID_TYPES.has(childType)) {
                removed += 1
                continue
            }
            sanitizeContainer(child)
            if ((child as any).clipPath && typeof (child as any).clipPath === 'object') {
                visitClipPath((child as any).clipPath)
            }
            nextChildren.push(child)
        }

        if (nextChildren.length !== children.length) {
            (container as any).objects = nextChildren
        }
    }

    if (!allowRootWithoutType) ensureGroupType(root)
    sanitizeContainer(root)
    if ((root as any).clipPath && typeof (root as any).clipPath === 'object') {
        visitClipPath((root as any).clipPath)
    }

    return { removed, fixedGroupTypes }
}

/**
 * Constroi o payload "progressivo" para load do canvas: troca o src
 * das imagens de produtos por um placeholder, salvando o src original
 * em `__originalSrc`. Permite o canvas renderizar logo (com placeholders)
 * e carregar as imagens reais em background.
 *
 * Comportamento:
 *  - Aborta cedo se ha < DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD imagens
 *  - Por default clona o canvasData (opts.clone=false reutiliza)
 *  - Aplica defer em ate DEFERRED_PRODUCT_IMAGE_LOAD_MAX cards
 *  - Pula cards/imagens cujo src nao e candidato (data:, blob:, etc)
 *
 * Retorna `{ data, deferredCount, totalImageCount }`.
 */
export const buildProgressiveProductCardImageLoadPayload = (
    canvasData: any,
    opts: { clone?: boolean; totalImageCount?: number | null } = {}
): { data: any; deferredCount: number; totalImageCount: number } => {
    const rootObjects = Array.isArray(canvasData?.objects) ? canvasData.objects : []
    if (!rootObjects.length) {
        return { data: canvasData, deferredCount: 0, totalImageCount: 0 }
    }

    const providedTotalImageCount = Number(opts.totalImageCount)
    const totalImageCount = Number.isFinite(providedTotalImageCount) && providedTotalImageCount > 0
        ? providedTotalImageCount
        : countCanvasJsonObjectsAndImages(canvasData).images

    if (!Number.isFinite(totalImageCount) || totalImageCount < DEFERRED_PRODUCT_IMAGE_LOAD_THRESHOLD) {
        return { data: canvasData, deferredCount: 0, totalImageCount: Number.isFinite(totalImageCount) ? totalImageCount : 0 }
    }

    const cloned = opts.clone === false ? canvasData : cloneCanvasDataForLoad(canvasData)
    const clonedRootObjects = Array.isArray(cloned?.objects) ? cloned.objects : []
    if (!clonedRootObjects.length) {
        return { data: cloned, deferredCount: 0, totalImageCount }
    }

    let deferredCount = 0
    clonedRootObjects.forEach((card: any) => {
        if (deferredCount >= DEFERRED_PRODUCT_IMAGE_LOAD_MAX) return
        if (!isLikelyProductCardJson(card)) return

        const imageNode = getPreferredProductImageFromCardJson(card)
        if (!imageNode) return

        const currentSrc = String((imageNode as any)?.src || '').trim()
        const originalSrc = String((imageNode as any)?.__originalSrc || '').trim()
        const sourceToKeep = originalSrc || currentSrc
        if (!isDeferredProductImageCandidateSrc(sourceToKeep)) return
        if (currentSrc === CANVAS_IMAGE_PLACEHOLDER_DATA_URL) return

        if (!originalSrc) {
            (imageNode as any).__originalSrc = currentSrc
        }
        imageNode.src = CANVAS_IMAGE_PLACEHOLDER_DATA_URL
        imageNode.crossOrigin = 'anonymous'
        deferredCount += 1
    })

    return { data: cloned, deferredCount, totalImageCount }
}

/**
 * Repara legacy product-card image transforms no JSON pre-load.
 * Garante que as imagens de cards de produto:
 *  - Tem scaleX/Y validos (>0, finitos)
 *  - Nao usam flipX/flipY (legacy mirror)
 *  - Tem lockScalingFlip / lockSkewingX/Y = true
 *  - Estao centradas dentro dos bounds do card (constrain)
 *
 * Mutates o JSON in place. Retorna estatisticas da varredura.
 *
 * `needsPostLoadRepair` indica que algum reparo nao pode ser feito no
 * JSON cru (tipicamente: imagem sem width/height intrinseco) e
 * precisa de uma segunda passada apos o load Fabric.
 */
export const normalizeLegacyProductCardImageTransformsInCanvasData = (
    canvasData: any
): { cardsScanned: number; imagesScanned: number; imagesRepaired: number; needsPostLoadRepair: boolean } => {
    const rootObjects = Array.isArray(canvasData?.objects) ? canvasData.objects : []
    if (!rootObjects.length) {
        return { cardsScanned: 0, imagesScanned: 0, imagesRepaired: 0, needsPostLoadRepair: false }
    }

    let cardsScanned = 0
    let imagesScanned = 0
    let imagesRepaired = 0
    let needsPostLoadRepair = false

    rootObjects.forEach((card: any) => {
        if (!isLikelyProductCardJson(card)) return

        cardsScanned += 1
        const cardBase = getCardBaseSizeForContainmentJson(card)
        const descendants = collectJsonDescendantsWithParent(card)

        descendants.forEach(({ node, parent }) => {
            if (String(node?.type || '').toLowerCase() !== 'image') return

            imagesScanned += 1
            let changed = false

            let nextScaleX = Number(node.scaleX ?? 1)
            let nextScaleY = Number(node.scaleY ?? 1)
            if (!Number.isFinite(nextScaleX) || nextScaleX === 0) {
                nextScaleX = 1
                changed = true
            }
            if (!Number.isFinite(nextScaleY) || nextScaleY === 0) {
                nextScaleY = 1
                changed = true
            }
            if (nextScaleX < 0 || nextScaleY < 0) {
                nextScaleX = Math.abs(nextScaleX) || 1
                nextScaleY = Math.abs(nextScaleY) || 1
                changed = true
            }

            if (node.flipX || node.flipY) changed = true
            if (node.lockScalingFlip !== true) changed = true
            if (node.lockSkewingX !== true || node.lockSkewingY !== true) changed = true

            const rawWidth = Number(node.width ?? 0)
            const rawHeight = Number(node.height ?? 0)
            const hasValidIntrinsicSize = Number.isFinite(rawWidth) && rawWidth > 0 && Number.isFinite(rawHeight) && rawHeight > 0
            if (!hasValidIntrinsicSize) {
                needsPostLoadRepair = true
            }

            if (parent === card && cardBase && hasValidIntrinsicSize) {
                const imageSize = getJsonObjectSize(node, { scaleX: nextScaleX, scaleY: nextScaleY })
                const center = getJsonObjectCenterInParentPlane(node, { scaleX: nextScaleX, scaleY: nextScaleY })
                if (imageSize && center) {
                    const cardLeft = -(cardBase.w / 2)
                    const cardTop = -(cardBase.h / 2)
                    const cardRight = cardBase.w / 2
                    const cardBottom = cardBase.h / 2
                    const minCx = Math.min(cardLeft + (imageSize.width / 2), cardRight - (imageSize.width / 2))
                    const maxCx = Math.max(cardLeft + (imageSize.width / 2), cardRight - (imageSize.width / 2))
                    const minCy = Math.min(cardTop + (imageSize.height / 2), cardBottom - (imageSize.height / 2))
                    const maxCy = Math.max(cardTop + (imageSize.height / 2), cardBottom - (imageSize.height / 2))
                    const constrainedCx = Math.min(maxCx, Math.max(minCx, center.x))
                    const constrainedCy = Math.min(maxCy, Math.max(minCy, center.y))
                    if (Math.abs(constrainedCx - center.x) > 0.001 || Math.abs(constrainedCy - center.y) > 0.001) {
                        if (setJsonObjectCenterInParentPlane(node, constrainedCx, constrainedCy, { scaleX: nextScaleX, scaleY: nextScaleY })) {
                            changed = true
                        } else {
                            needsPostLoadRepair = true
                        }
                    }
                } else {
                    needsPostLoadRepair = true
                }
            }

            if (changed) {
                node.scaleX = nextScaleX
                node.scaleY = nextScaleY
                node.flipX = false
                node.flipY = false
                node.lockScalingFlip = true
                node.lockSkewingX = true
                node.lockSkewingY = true
                imagesRepaired += 1
            }
        })
    })

    return { cardsScanned, imagesScanned, imagesRepaired, needsPostLoadRepair }
}

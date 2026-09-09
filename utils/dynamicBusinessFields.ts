/**
 * Regras compartilhadas dos campos dinamicos de dados da loja.
 *
 * Um campo de negocio e um Textbox que pode ter a largura refluida e a altura
 * aumentada como area de edicao. A tipografia continua sendo controlada por
 * `fontSize`/`scaleX`/`scaleY`; aumentar a altura pelos controles superior ou
 * inferior nao deve transformar os glifos.
 */

const TEXT_OBJECT_TYPES = new Set(['text', 'i-text', 'textbox'])

export type DynamicBusinessTextCase = 'none' | 'upper' | 'lower'

/**
 * Normaliza o modo de caixa salvo em objetos do Fabric e em modelos antigos.
 * Os aliases em portugues mantem a leitura de projetos que foram criados pela
 * interface antes de o valor ser padronizado.
 */
export const normalizeDynamicBusinessTextCase = (value: unknown): DynamicBusinessTextCase => {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (normalized === 'upper' || normalized === 'uppercase' || normalized === 'maiuscula' || normalized === 'maiusculas') {
    return 'upper'
  }
  if (normalized === 'lower' || normalized === 'lowercase' || normalized === 'minuscula' || normalized === 'minusculas') {
    return 'lower'
  }
  return 'none'
}

/** Aplica a caixa escolhida sem perder acentos ou caracteres fora de ASCII. */
export const transformDynamicBusinessText = (value: unknown, textCase: unknown): string => {
  const text = String(value ?? '')
  const mode = normalizeDynamicBusinessTextCase(textCase)
  if (mode === 'upper') return text.toLocaleUpperCase('pt-BR')
  if (mode === 'lower') return text.toLocaleLowerCase('pt-BR')
  return text
}

/**
 * Lê a caixa de um campo/texto mesmo quando ele veio de uma versão antiga.
 * `dynamicTextCase` é mantido como alias explícito para cópias que passaram
 * por um serializador que filtrou propriedades com prefixo `__`.
 */
export const getDynamicBusinessTextCase = (object: any): DynamicBusinessTextCase => {
  if (!object) return 'none'
  const persisted = [object.__textCase, object.dynamicTextCase, object.textCase]
    .find(value => value !== undefined && value !== null && String(value).trim() !== '')
  if (persisted !== undefined) return normalizeDynamicBusinessTextCase(persisted)

  // Legacy models stored only the rendered string. Preserve an obvious case
  // choice while they are migrated through the quick-editor binding.
  if (isDynamicBusinessFieldObject(object)) {
    const text = String(object.text ?? '')
    const hasCasedCharacters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text)
    if (hasCasedCharacters) {
      if (text === text.toLocaleUpperCase('pt-BR')) return 'upper'
      if (text === text.toLocaleLowerCase('pt-BR')) return 'lower'
    }
  }
  return 'none'
}

/**
 * Persiste e aplica a caixa ao texto base. O valor original fica em
 * `__rawText`, então uma nova informação do cadastro pode ser renderizada
 * novamente sem acumular transformações (por exemplo, upper sobre upper).
 */
export const applyDynamicBusinessTextCase = (object: any, textCase: unknown): boolean => {
  if (!object) return false

  const mode = normalizeDynamicBusinessTextCase(textCase)
  const currentText = String(object.text ?? '')
  const rawText = typeof object.__rawText === 'string'
    ? object.__rawText
    : currentText
  const nextText = transformDynamicBusinessText(rawText, mode)
  const changed = object.__rawText !== rawText
    || getDynamicBusinessTextCase(object) !== mode
    || object.dynamicTextCase !== mode
    || currentText !== nextText

  setObjectValues(object, {
    __rawText: rawText,
    __textCase: mode,
    dynamicTextCase: mode,
    text: nextText
  })
  // Fabric's `set` normally updates these values, but direct assignment is
  // required by a few legacy objects restored from JSON and keeps the marker
  // available to the save fallback as well.
  object.__rawText = rawText
  object.__textCase = mode
  object.dynamicTextCase = mode
  object.initDimensions?.()
  object.setCoords?.()
  return changed
}

/**
 * Converte a escolha implícita de projetos antigos em metadados persistentes.
 * Só grava quando o texto revela uma caixa inequívoca e ainda não existe um
 * marcador explícito, evitando sobrescrever uma escolha feita pelo usuário.
 */
export const ensureDynamicBusinessTextCaseMetadata = (object: any): boolean => {
  if (!isDynamicBusinessFieldObject(object)) return false
  const hasPersistedCase = [object.__textCase, object.dynamicTextCase, object.textCase]
    .some(value => value !== undefined && value !== null && String(value).trim() !== '')
  if (hasPersistedCase) return false

  const mode = getDynamicBusinessTextCase(object)
  if (mode === 'none') return false
  const rawText = String(object.text ?? '')
  setObjectValues(object, {
    __rawText: rawText,
    __textCase: mode,
    dynamicTextCase: mode
  })
  object.__rawText = rawText
  object.__textCase = mode
  object.dynamicTextCase = mode
  return true
}

export const getDynamicBusinessField = (object: any): string => {
  const businessField = String(object?.businessProfileField || '').trim()
  if (businessField) return businessField

  // A validade criada pelo editor usa `quickDataField` because the dates are
  // stored on the text object itself and do not come from the business
  // profile. It still needs the same editable Textbox controls as the other
  // dynamic store fields.
  const legacyField = String(object?.quickDataField || '').trim()
  return ['validity', 'address', 'instagram', 'whatsapp'].includes(legacyField) ? legacyField : ''
}

export const isDynamicBusinessFieldObject = (object: any): boolean => {
  if (!object || !TEXT_OBJECT_TYPES.has(String(object?.type || '').toLowerCase())) return false
  return !!getDynamicBusinessField(object)
}

export const isDynamicBusinessAddress = (object: any): boolean =>
  isDynamicBusinessFieldObject(object) && getDynamicBusinessField(object) === 'address'

export const isDynamicBusinessValidity = (object: any): boolean =>
  isDynamicBusinessFieldObject(object) && getDynamicBusinessField(object) === 'validity'

/**
 * Configuracao de um campo dinamico. A largura continua usando o reflow nativo
 * do Textbox; altura, fonte e escala ficam disponiveis separadamente.
 */
export const getDynamicBusinessTextOptions = (field: string): Record<string, any> => {
  const normalizedField = String(field || '').trim()
  if (!normalizedField) return {}
  return {
    // O usuario ainda pode usar escala e o painel de tipografia. A altura do
    // campo tem controles proprios, instalados abaixo, sem bloquear escala.
    lockScalingY: false,
    lockScalingFlip: true,
    splitByGrapheme: false,
    objectCaching: false,
    dynamicFieldResizeMode: 'reflow',
    dynamicFieldKey: normalizedField
  }
}

const MIN_DYNAMIC_FONT_SIZE = 8
const FIT_ITERATIONS = 14

const setObjectValues = (object: any, values: Record<string, any>): void => {
  if (!object || !values || Object.keys(values).length === 0) return
  if (typeof object.set === 'function') {
    object.set(values)
  } else {
    Object.assign(object, values)
  }
}

const finitePositive = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/**
 * Guarda a tipografia e a caixa escolhidas no modelo antes de qualquer
 * recalculo do Fabric. O valor de `dynamicFieldBaseFontSize` permite reduzir a
 * fonte para um texto longo e depois voltar ao tamanho do modelo quando o
 * valor ficar curto. `dynamicFieldHeight` e a altura real do campo, e nao a
 * altura natural de uma string especifica.
 */
export const captureDynamicBusinessTextBaseline = (object: any): boolean => {
  if (!isDynamicBusinessFieldObject(object)) return false

  const updates: Record<string, any> = {}
  if (finitePositive(object.dynamicFieldBaseFontSize) == null) {
    const fontSize = finitePositive(object.fontSize)
    if (fontSize != null) updates.dynamicFieldBaseFontSize = fontSize
  }

  if (finitePositive(object.dynamicFieldHeight) == null) {
    const height = finitePositive(object.height)
    if (height != null) updates.dynamicFieldHeight = height
  }

  if (Object.keys(updates).length === 0) return false
  setObjectValues(object, updates)
  return true
}

type FabricControlsUtils = {
  changeHeight?: (...args: any[]) => boolean
}

const dynamicControlsPatched = new WeakSet<object>()

const cloneControl = (control: any): any => {
  if (!control || typeof control !== 'object') return control
  return Object.assign(Object.create(Object.getPrototypeOf(control)), control)
}

/**
 * Configura os controles do campo sem remover os controles de escala.
 *
 * `Textbox` ja usa `changeWidth` nas laterais esquerda/direita. Para cima e
 * para baixo usamos o `changeHeight` do Fabric, que altera `height` diretamente
 * e deixa `scaleY`/`fontSize` intactos. Os cantos permanecem com a escala
 * normal do Fabric, por isso o usuario tambem nao perde essa possibilidade.
 */
const configureDynamicBusinessTextControls = (object: any, fabricNamespace?: any): void => {
  if (typeof object?.setControlsVisibility !== 'function') return

  // Nunca esconder os controles: o painel e os handles continuam oferecendo
  // fonte, escala e transformacao como nos demais textos do editor.
  object.setControlsVisibility({
    tl: true,
    tr: true,
    bl: true,
    br: true,
    mt: true,
    mb: true,
    ml: true,
    mr: true,
    mtr: true,
  })

  const controlsUtils = fabricNamespace?.controlsUtils as FabricControlsUtils | undefined
  const controls = object?.controls
  if (!controls || !controlsUtils || dynamicControlsPatched.has(object)) return

  const changeHeight = controlsUtils.changeHeight
  if (typeof changeHeight !== 'function') return

  // Fabric pode compartilhar a tabela de controles entre instancias. Clone
  // apenas os controles deste objeto antes de trocar os handlers.
  object.controls = { ...controls }
  if (typeof changeHeight === 'function') {
    ;(['mt', 'mb'] as const).forEach((key) => {
      const control = cloneControl(object.controls?.[key])
      if (!control) return
      control.actionHandler = (event: any, transform: any, x: number, y: number) => {
        const changed = changeHeight(event, transform, x, y)
        if (changed) {
          commitDynamicBusinessTextHeight(transform.target)
          transform.target.dirty = true
          transform.target.canvas?.requestRenderAll?.()
        }
        return changed
      }
      control.cursorStyle = 'ns-resize'
      control.actionName = 'resizing'
      object.controls[key] = control
    })
  }
  dynamicControlsPatched.add(object)
}

/**
 * Aplica a configuracao a objetos antigos e a novos objetos sem alterar a
 * composicao. Retorna true quando alguma propriedade foi ajustada.
 */
export const configureDynamicBusinessTextObject = (object: any, fabricNamespace?: any): boolean => {
  if (!isDynamicBusinessFieldObject(object) || typeof object?.set !== 'function') return false
  const field = getDynamicBusinessField(object)
  const options = getDynamicBusinessTextOptions(field)
  if (['validity', 'address', 'instagram'].includes(field) && object.splitByGrapheme === true) {
    options.splitByGrapheme = true
  }
  const caseChanged = ensureDynamicBusinessTextCaseMetadata(object)
  const baselineChanged = captureDynamicBusinessTextBaseline(object)
  let changed = caseChanged || baselineChanged

  Object.entries(options).forEach(([key, value]) => {
    if (object[key] !== value) changed = true
  })
  object.set(options)
  configureDynamicBusinessTextControls(object, fabricNamespace)
  return changed
}

type DynamicBusinessTextFitOptions = {
  /** Limite superior. Por padrao e o tamanho salvo no modelo. */
  maxFontSize?: number
  /** Limite inferior para preservar legibilidade. */
  minFontSize?: number
  /** Largura de campo alternativa, em unidades Fabric. */
  maxWidth?: number
  /** Altura de campo alternativa, em unidades Fabric. */
  maxHeight?: number
}

const getMeasuredLineWidth = (object: any): number => {
  if (typeof object?.getLineWidth !== 'function') return 0
  const lines = Array.isArray(object?._textLines) ? object._textLines : []
  let maxWidth = 0
  for (let index = 0; index < lines.length; index += 1) {
    const width = Number(object.getLineWidth(index))
    if (Number.isFinite(width) && width > maxWidth) maxWidth = width
  }
  return maxWidth
}

const getMeasuredTextHeight = (object: any): number => {
  const measured = typeof object?.calcTextHeight === 'function'
    ? Number(object.calcTextHeight())
    : Number(object?.height)
  return Number.isFinite(measured) && measured > 0 ? measured : 0
}

/**
 * Reduz ou restaura a fonte de um campo dinâmico para que o conteúdo caiba na
 * caixa configurada. O algoritmo altera apenas `fontSize`; largura, escala,
 * posição e estilos continuam sendo os definidos no modelo. A fonte original
 * fica em `dynamicFieldBaseFontSize`, enquanto o resultado atual fica em
 * `dynamicFieldAutoFitFontSize` para que a próxima troca de conteúdo possa
 * recalcular a partir do mesmo tamanho-base.
 */
export const fitDynamicBusinessTextObject = (
  object: any,
  options: DynamicBusinessTextFitOptions = {}
): boolean => {
  if (!isDynamicBusinessFieldObject(object) || typeof object?.set !== 'function') return false

  let changed = captureDynamicBusinessTextBaseline(object)
  const currentFontSize = finitePositive(object.fontSize) || 16
  const baseFontSize = finitePositive(options.maxFontSize)
    || finitePositive(object.dynamicFieldBaseFontSize)
    || currentFontSize
  // Dados de leitura mantêm o tamanho escolhido: ao atingir a largura, o Textbox
  // cria novas linhas e cresce para baixo, em vez de reduzir a fonte.
  if (['validity', 'address', 'instagram'].includes(getDynamicBusinessField(object))) {
    // Formatação por caractere herdada do texto de demonstração pode deixar
    // só o começo grande. Unifica no maior tamanho escolhido, sem apagar cor,
    // peso ou outros estilos do modelo.
    let uniformFontSize = baseFontSize
    let removedInlineSizes = false
    for (const line of Object.values(object.styles || {}) as any[]) {
      for (const style of Object.values(line || {}) as any[]) {
        if (style && typeof style === 'object' && style.fontSize != null) {
          uniformFontSize = Math.max(uniformFontSize, finitePositive(style.fontSize) || 0)
          delete style.fontSize
          removedInlineSizes = true
        }
      }
    }
    const width = finitePositive(options.maxWidth) || finitePositive(object.width)
    const topAnchor = object.getPointByOrigin?.('center', 'top')
    const previousHeight = Number(object.height)
    const previousWidth = Number(object.width)
    setObjectValues(object, {
      fontSize: uniformFontSize,
      dynamicFieldBaseFontSize: uniformFontSize,
      dynamicFieldAutoFitFontSize: uniformFontSize,
      splitByGrapheme: false,
      ...(width != null ? { width } : {})
    })
    object.initDimensions?.()
    // Um token maior que a caixa (ex.: data em coluna estreita) também deve
    // quebrar, sem alargar a caixa nem diminuir a fonte.
    if (width != null && (Number(object.width) > width + 0.5 || getMeasuredLineWidth(object) > width + 0.5)) {
      setObjectValues(object, { width, splitByGrapheme: true })
      object.initDimensions?.()
    }
    syncDynamicBusinessTextHeight(object)
    if (topAnchor) object.setPositionByOrigin?.(topAnchor, 'center', 'top')
    object.setCoords?.()
    return changed || removedInlineSizes || Math.abs(currentFontSize - uniformFontSize) > 0.01
      || previousHeight !== Number(object.height)
      || previousWidth !== Number(object.width)
  }
  const minFontSize = Math.max(
    MIN_DYNAMIC_FONT_SIZE,
    Math.min(baseFontSize, finitePositive(options.minFontSize) || MIN_DYNAMIC_FONT_SIZE)
  )
  const maxWidth = finitePositive(options.maxWidth)
    || finitePositive(object.width)
  const maxHeight = object.dynamicFieldAutoHeight ? null : finitePositive(options.maxHeight)
    || finitePositive(object.dynamicFieldHeight)
    || finitePositive(object.height)

  // Sem conteúdo, restaura o tamanho definido pelo modelo e evita uma fonte
  // reduzida ficar presa no campo quando o dado da loja voltar a ser vazio.
  if (!String(object.text ?? '').trim()) {
    const emptyValues: Record<string, any> = {
      fontSize: baseFontSize,
      dynamicFieldAutoFitFontSize: baseFontSize
    }
    if (Math.abs(currentFontSize - baseFontSize) > 0.01) changed = true
    if (Number(object.dynamicFieldAutoFitFontSize) !== baseFontSize) changed = true
    setObjectValues(object, emptyValues)
    object.initDimensions?.()
    return changed
  }

  const restoreWidth = () => {
    if (maxWidth == null) return false
    const currentWidth = Number(object.width)
    if (!Number.isFinite(currentWidth) || Math.abs(currentWidth - maxWidth) <= 0.01) return false
    setObjectValues(object, { width: maxWidth })
    return true
  }

  const measure = (fontSize: number) => {
    setObjectValues(object, { fontSize })
    object.initDimensions?.()
    // Fabric's Textbox can enlarge itself for an unbroken token. Reapply the
    // model width before reading the final line metrics so URLs/IDs are fitted
    // against the actual field rather than a temporary expanded width.
    const widthChanged = restoreWidth()
    if (widthChanged) object.initDimensions?.()
    return {
      height: getMeasuredTextHeight(object),
      width: getMeasuredLineWidth(object)
    }
  }

  const fits = (metrics: { height: number; width: number }): boolean => {
    const heightFits = maxHeight == null || metrics.height <= maxHeight + 0.5
    const widthFits = maxWidth == null || metrics.width <= maxWidth + 0.5 || metrics.width <= 0
    return heightFits && widthFits
  }

  const maxMetrics = measure(baseFontSize)
  let chosenFontSize = baseFontSize
  if (!fits(maxMetrics)) {
    const minMetrics = measure(minFontSize)
    if (fits(minMetrics)) {
      let low = minFontSize
      let high = baseFontSize
      for (let index = 0; index < FIT_ITERATIONS; index += 1) {
        const middle = (low + high) / 2
        if (fits(measure(middle))) low = middle
        else high = middle
      }
      chosenFontSize = low
    } else {
      // The field is smaller than even the readable minimum. Keep the minimum
      // and let the existing height sync preserve the configured box.
      chosenFontSize = minFontSize
    }
  }

  const roundedFontSize = Math.max(minFontSize, Math.round(chosenFontSize * 100) / 100)
  if (Math.abs(Number(object.fontSize) - roundedFontSize) > 0.01) changed = true
  if (Number(object.dynamicFieldAutoFitFontSize) !== roundedFontSize) changed = true
  setObjectValues(object, {
    fontSize: roundedFontSize,
    dynamicFieldAutoFitFontSize: roundedFontSize
  })
  object.initDimensions?.()
  if (restoreWidth()) object.initDimensions?.()
  syncDynamicBusinessTextHeight(object)
  object.setCoords?.()
  return changed
}

/**
 * Mantem uma altura manual do campo depois que o Fabric recalcula as linhas.
 * `Textbox.initDimensions()` sempre recalcula `height` a partir do texto; a
 * altura salva aqui e apenas uma altura minima visual, nunca uma escala dos
 * glifos.
 */
export const syncDynamicBusinessTextHeight = (object: any): boolean => {
  if (!isDynamicBusinessFieldObject(object) || typeof object?.set !== 'function') return false

  const naturalHeight = typeof object.calcTextHeight === 'function'
    ? Number(object.calcTextHeight())
    : Number(object.height)
  const currentHeight = Number(object.height)
  const storedHeight = Number(object.dynamicFieldHeight)
  const baseHeight = Number.isFinite(naturalHeight) && naturalHeight > 0
    ? naturalHeight
    : (Number.isFinite(currentHeight) && currentHeight > 0 ? currentHeight : 1)
  const nextHeight = !object.dynamicFieldAutoHeight && Number.isFinite(storedHeight) && storedHeight > 0
    ? Math.max(baseHeight, storedHeight)
    : baseHeight

  const changed = Math.abs((Number.isFinite(currentHeight) ? currentHeight : 0) - nextHeight) > 0.01
  if (changed) object.set({ height: nextHeight })
  return changed
}

/**
 * Registra a altura escolhida pelo usuario sem alterar `fontSize`, `scaleX` ou
 * `scaleY`. A altura natural do texto continua sendo o limite inferior para
 * evitar que o campo fique menor que o proprio conteudo.
 */
export const commitDynamicBusinessTextHeight = (object: any): boolean => {
  if (!isDynamicBusinessFieldObject(object) || typeof object?.set !== 'function') return false

  const naturalHeight = typeof object.calcTextHeight === 'function'
    ? Number(object.calcTextHeight())
    : Number(object.height)
  const requestedHeight = Number(object.height)
  const baseHeight = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : 1
  const nextHeight = Math.max(baseHeight, Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : baseHeight)
  const previousStoredHeight = Number(object.dynamicFieldHeight)
  const changed = Math.abs((Number.isFinite(requestedHeight) ? requestedHeight : 0) - nextHeight) > 0.01
    || Math.abs((Number.isFinite(previousStoredHeight) ? previousStoredHeight : 0) - nextHeight) > 0.01
  object.set({
    height: nextHeight,
    dynamicFieldHeight: nextHeight
  })
  object.setCoords?.()
  return changed
}

/**
 * Finaliza redimensionamentos diretos (`resizing`) sem converter escala em
 * largura/altura. Escalas feitas pelos cantos continuam sendo escalas reais e
 * portanto permanecem disponiveis para o usuario ajustar o tamanho do texto.
 */
export const reflowDynamicBusinessTextObject = (
  object: any,
  context: { corner?: string; action?: string } = {}
): boolean => {
  if (!isDynamicBusinessFieldObject(object) || typeof object?.set !== 'function') return false

  const corner = String(context.corner || '').trim().toLowerCase()
  const action = String(context.action || '').trim().toLowerCase()
  const isHeightResize = corner === 'mt' || corner === 'mb'
  const isWidthResize = corner === 'ml' || corner === 'mr'

  if (action === 'resizing' && isHeightResize) {
    const changed = commitDynamicBusinessTextHeight(object)
    return fitDynamicBusinessTextObject(object) || changed
  }

  if (action === 'resizing' && isWidthResize) {
    // changeWidth do Textbox altera a largura sem reempacotar as linhas. O
    // reflow atualiza a altura natural e preserva uma altura manual maior.
    object.initDimensions?.()
    const changed = syncDynamicBusinessTextHeight(object)
    const fitChanged = fitDynamicBusinessTextObject(object)
    object.setCoords?.()
    return changed || fitChanged
  }

  // Compatibilidade com projetos antigos: nao ha mais conversao automatica de
  // escala. Se o objeto ja possui uma altura manual, apenas reaplica o limite.
  return syncDynamicBusinessTextHeight(object) || fitDynamicBusinessTextObject(object)
}

import { describe, expect, it } from 'vitest'
import {
  configureDynamicBusinessTextObject,
  applyDynamicBusinessTextCase,
  ensureDynamicBusinessTextCaseMetadata,
  fitDynamicBusinessTextObject,
  getDynamicBusinessTextCase,
  getDynamicBusinessTextOptions,
  isDynamicBusinessAddress,
  isDynamicBusinessValidity,
  normalizeDynamicBusinessTextCase,
  reflowDynamicBusinessTextObject,
  syncDynamicBusinessTextHeight,
  transformDynamicBusinessText,
} from '~/utils/dynamicBusinessFields'

const textbox = (overrides: Record<string, any> = {}) => {
  const object: any = {
    type: 'textbox',
    businessProfileField: 'address',
    width: 360,
    height: 24,
    scaleX: 1,
    scaleY: 1,
    lockScalingY: false,
    ...overrides,
  }
  object.set = (patch: Record<string, any>) => Object.assign(object, patch)
  object.setControlsVisibility = (patch: Record<string, boolean>) => {
    object.__controlsVisibility = { ...(object.__controlsVisibility || {}), ...patch }
  }
  object.controls = {
    mt: { actionName: 'scale', actionHandler: 'scale-height' },
    mb: { actionName: 'scale', actionHandler: 'scale-height' },
    br: { actionName: 'scale', actionHandler: 'scale-corner' },
  }
  object.initDimensions = () => { object.__initDimensionsCalls = (object.__initDimensionsCalls || 0) + 1 }
  object.setCoords = () => { object.__setCoordsCalls = (object.__setCoordsCalls || 0) + 1 }
  return object
}

describe('dynamicBusinessFields', () => {
  it('mantem as escalas e registra a altura do campo sem esticar o texto', () => {
    const object = textbox({ height: 24, scaleX: 1, scaleY: 1, fontSize: 18 })

    expect(isDynamicBusinessAddress(object)).toBe(true)
    expect(getDynamicBusinessTextOptions('address')).toMatchObject({
      lockScalingY: false,
      lockScalingFlip: true,
      dynamicFieldResizeMode: 'reflow',
    })

    object.height = 96
    reflowDynamicBusinessTextObject(object, { corner: 'mb', action: 'resizing' })

    expect(object.height).toBe(96)
    expect(object.dynamicFieldHeight).toBe(96)
    expect(object.fontSize).toBe(18)
    expect(object.scaleX).toBe(1)
    expect(object.scaleY).toBe(1)
    expect(object.__setCoordsCalls).toBeGreaterThanOrEqual(1)
  })

  it('configura campos legados sem esconder controles ou bloquear escala vertical', () => {
    const object = textbox({ text: 'Rua muito comprida, 100 - Centro' })
    const changeHeight = () => true

    expect(configureDynamicBusinessTextObject(object, { controlsUtils: { changeHeight } })).toBe(true)
    expect(object.text).toBe('Rua muito comprida, 100 - Centro')
    expect(object.width).toBe(360)
    expect(object.lockScalingY).toBe(false)
    expect(object.dynamicFieldKey).toBe('address')
    expect(object.__controlsVisibility).toMatchObject({
      tl: true,
      tr: true,
      mt: true,
      mb: true,
      ml: true,
      mr: true,
    })
    expect(object.controls.mt.actionHandler({}, { target: object }, 0, 50)).toBe(true)
    expect(object.dirty).toBe(true)
    expect(object.controls.mb.actionHandler({}, { target: object }, 0, 50)).toBe(true)
    expect(object.controls.mt.actionName).toBe('resizing')
    expect(object.controls.br.actionName).toBe('scale')
  })

  it('preserva a altura manual depois de uma nova medicao do Textbox', () => {
    const object = textbox({
      height: 120,
      dynamicFieldHeight: 120,
      calcTextHeight: () => 36,
    })

    object.height = 36
    expect(syncDynamicBusinessTextHeight(object)).toBe(true)
    expect(object.height).toBe(120)
    expect(object.dynamicFieldHeight).toBe(120)
  })

  it('trata a validade pela marca quickDataField e mantém a escala liberada', () => {
    const object = textbox({
      businessProfileField: undefined,
      quickDataField: 'validity',
      fontSize: 16,
      lockScalingY: true
    })
    const changeHeight = () => true

    expect(isDynamicBusinessValidity(object)).toBe(true)
    expect(configureDynamicBusinessTextObject(object, { controlsUtils: { changeHeight } })).toBe(true)
    expect(object.dynamicFieldKey).toBe('validity')
    expect(object.lockScalingY).toBe(false)
    expect(object.controls.mt.actionHandler({}, { target: object }, 0, 50)).toBe(true)
    expect(object.dirty).toBe(true)

    object.set({ fontSize: 30, scaleX: 1.4, scaleY: 1.25 })
    object.initDimensions()
    expect(object.fontSize).toBe(30)
    expect(object.scaleX).toBe(1.4)
    expect(object.scaleY).toBe(1.25)
  })

  it('preserva a fonte do modelo mesmo quando o conteúdo cresce', () => {
    const object = textbox({
      businessProfileField: 'slogan',
      text: 'Slogan muito comprido da filial',
      fontSize: 30,
      dynamicFieldHeight: 40,
      _textLines: ['linha 1', 'linha 2'],
      calcTextHeight: () => Number(object.fontSize) * 2,
      getLineWidth: () => Number(object.fontSize) * 8,
    })

    expect(fitDynamicBusinessTextObject(object)).toBe(true)
    expect(object.fontSize).toBe(30)
    expect(object.dynamicFieldBaseFontSize).toBe(30)
    expect(object.dynamicFieldAutoFitFontSize).toBe(object.fontSize)

    object.text = 'Rua 1'
    object._textLines = ['linha única']
    object.calcTextHeight = () => Number(object.fontSize)

    expect(fitDynamicBusinessTextObject(object)).toBe(true)
    expect(object.fontSize).toBe(30)
    expect(object.dynamicFieldBaseFontSize).toBe(30)
  })

  it('respeita a largura do campo para textos sem quebra de linha', () => {
    const object = textbox({
      businessProfileField: 'website',
      text: 'www.exemplo.com.br/promocao-da-semana',
      fontSize: 24,
      width: 120,
      dynamicFieldHeight: 80,
      _textLines: ['linha'],
      calcTextHeight: () => Number(object.fontSize),
      getLineWidth: () => Number(object.fontSize) * 10,
    })

    fitDynamicBusinessTextObject(object)

    expect(object.fontSize).toBe(24)
    expect(object.splitByGrapheme).toBe(true)
    expect(object.width).toBe(120)
  })

  it('mantem a caixa escolhida ao trocar o valor do campo dinamico', () => {
    expect(normalizeDynamicBusinessTextCase('MAIÚSCULAS')).toBe('upper')
    expect(normalizeDynamicBusinessTextCase('lowercase')).toBe('lower')
    expect(transformDynamicBusinessText('Supermercado Rodrigues', 'upper')).toBe('SUPERMERCADO RODRIGUES')
    expect(transformDynamicBusinessText('Rua Garibaldi Leão', 'lower')).toBe('rua garibaldi leão')
    expect(transformDynamicBusinessText('Supermercado Rodrigues', 'none')).toBe('Supermercado Rodrigues')
  })

  it('persiste a caixa no objeto e reaplica a transformacao a partir do texto original', () => {
    const object = textbox({ text: 'Rua São José, 100' })

    expect(applyDynamicBusinessTextCase(object, 'upper')).toBe(true)
    expect(object.text).toBe('RUA SÃO JOSÉ, 100')
    expect(object.__rawText).toBe('Rua São José, 100')
    expect(object.__textCase).toBe('upper')
    expect(object.dynamicTextCase).toBe('upper')
    expect(getDynamicBusinessTextCase(object)).toBe('upper')

    object.text = 'Rua Avenida Nova'
    expect(getDynamicBusinessTextCase({ dynamicTextCase: 'MAIÚSCULAS' })).toBe('upper')
    expect(applyDynamicBusinessTextCase(object, 'lower')).toBe(true)
    expect(object.text).toBe('rua são josé, 100')

    expect(applyDynamicBusinessTextCase(object, 'none')).toBe(true)
    expect(object.text).toBe('Rua São José, 100')
  })

  it('migra textos dinamicos legados que só guardavam a caixa renderizada', () => {
    const upper = textbox({ text: 'RUA SÃO JOSÉ, 100' })
    const lower = textbox({ text: 'rua são josé, 100' })
    expect(getDynamicBusinessTextCase(upper)).toBe('upper')
    expect(getDynamicBusinessTextCase(lower)).toBe('lower')
    expect(ensureDynamicBusinessTextCaseMetadata(upper)).toBe(true)
    expect(upper.__textCase).toBe('upper')
    expect(upper.__rawText).toBe('RUA SÃO JOSÉ, 100')
  })

  it('preserva a tipografia na mesma configuracao que migra a caixa alta', () => {
    const object = textbox({ text: 'RUA SÃO JOSÉ, 100', fontSize: 32, height: 64 })
    configureDynamicBusinessTextObject(object)
    expect(object.dynamicTextCase).toBe('upper')
    expect(object.dynamicFieldBaseFontSize).toBe(32)
    expect(object.dynamicFieldHeight).toBe(64)
  })
})


describe('campos grandes com quebra de linha', () => {
  it.each(['validity', 'address', 'instagram'])('mantém fonte e largura e cresce em altura: %s', field => {
    const object = textbox({ businessProfileField: field, text: 'Texto longo em duas linhas', fontSize: 40,
      width: 360, height: 30, dynamicFieldHeight: 30, _textLines: ['primeira', 'segunda'],
      calcTextHeight: () => 90, getLineWidth: () => 330 })
    fitDynamicBusinessTextObject(object)
    expect(object.fontSize).toBe(40)
    expect(object.width).toBe(360)
    expect(object.height).toBe(90)
    expect(object.splitByGrapheme).toBe(false)
    fitDynamicBusinessTextObject(object)
    expect(object.fontSize).toBe(40)
  })
  it('preserva os tamanhos e estilos por caractere definidos no modelo', () => {
    const object = textbox({ text: 'RUA GARIBALDI LEÃO', fontSize: 18, styles: { 0: {
      0: { fontSize: 40, fill: '#fff' }, 1: { fontSize: 12, fontWeight: 700 }
    } } })
    fitDynamicBusinessTextObject(object)
    expect(object.fontSize).toBe(18)
    expect(object.dynamicFieldBaseFontSize).toBe(18)
    expect(object.styles[0][0]).toEqual({ fontSize: 40, fill: '#fff' })
    expect(object.styles[0][1]).toEqual({ fontSize: 12, fontWeight: 700 })
  })
})

it('preserva quebra de nomes longos do Instagram ao configurar um objeto recarregado', () => {
  const object = textbox({ businessProfileField: 'instagram', splitByGrapheme: true })
  configureDynamicBusinessTextObject(object)
  expect(object.splitByGrapheme).toBe(true)
})

describe('limite de linhas da validade', () => {
  it('preserva o tamanho e as quebras do modelo em caixas estreitas e largas', () => {
    const object = textbox({ businessProfileField: 'validity', text: 'OFERTAS VÁLIDAS\nDE 01/04 A 07/04 ENQUANTO DURAREM OS ESTOQUES', width: 160, fontSize: 20 })
    object.initDimensions = () => {
      const count = Math.ceil(object.text.length * object.fontSize * 0.5 / object.width)
      object.textLines = Array(count).fill('line')
      object.height = count * object.fontSize
    }
    fitDynamicBusinessTextObject(object)
    expect(object.textLines.length).toBeGreaterThan(2)
    expect(object.text).toContain('\n')
    expect(object.dynamicFieldBaseFontSize).toBe(20)
    expect(object.fontSize).toBe(20)
    object.width = 1000
    fitDynamicBusinessTextObject(object)
    expect(object.textLines.length).toBe(1)
    expect(object.fontSize).toBe(20)
  })
})

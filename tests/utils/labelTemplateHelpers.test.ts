import { describe, it, expect } from 'vitest'
import {
  getLabelTemplateTimestamp,
  shouldUseIncomingTemplateSnapshot,
  isBuiltInLabelTemplateId,
  BUILTIN_LABEL_TEMPLATE_IDS,
  BUILTIN_DEFAULT_LABEL_TEMPLATE_ID,
  BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID,
  BUILTIN_RED_BURST_LABEL_TEMPLATE_ID,
  LABEL_TEMPLATE_EXTRA_PROPS,
  MANUAL_TEMPLATE_STABLE_PROPS,
  MANUAL_TEMPLATE_DERIVED_PROPS,
  LABEL_TEMPLATES_JSON_KEY,
  BUILTIN_ATACAREJO_SEED_VERSION,
  BUILTIN_RED_BURST_SEED_VERSION,
  LABEL_TEMPLATE_PREVIEW_RENDER_VERSION,
  MANUAL_SINGLE_ANCHOR_VERSION,
  normalizeLabelTemplateGroupAsManual,
  normalizeLabelTemplateRecordAsManual
} from '~/utils/labelTemplateHelpers'

describe('getLabelTemplateTimestamp', () => {
  it('parse updatedAt como prioridade', () => {
    expect(getLabelTemplateTimestamp({
      updatedAt: '2026-04-30T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z'
    })).toBe(Date.parse('2026-04-30T10:00:00Z'))
  })

  it('cai para createdAt quando nao ha updatedAt', () => {
    expect(getLabelTemplateTimestamp({
      createdAt: '2026-01-01T00:00:00Z'
    })).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('NaN para template sem timestamps', () => {
    expect(Number.isNaN(getLabelTemplateTimestamp({}))).toBe(true)
    expect(Number.isNaN(getLabelTemplateTimestamp(null))).toBe(true)
    expect(Number.isNaN(getLabelTemplateTimestamp(undefined))).toBe(true)
  })

  it('NaN para data invalida', () => {
    expect(Number.isNaN(getLabelTemplateTimestamp({ updatedAt: 'not-a-date' }))).toBe(true)
  })
})

describe('shouldUseIncomingTemplateSnapshot', () => {
  it('local override no incoming sempre vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2030-01-01' }, // prev mais novo, sem override
      { updatedAt: '2020-01-01', __localOverride: true }
    )).toBe(true)
  })

  it('local override no prev mantem prev', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2020-01-01', __localOverride: true },
      { updatedAt: '2030-01-01' }
    )).toBe(false)
  })

  it('mesmo nivel (ambos sem override): mais novo vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-01-01' },
      { updatedAt: '2026-04-30' }
    )).toBe(true)
  })

  it('mesmo nivel (ambos local-override): mais novo vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-04-30', __localOverride: true },
      { updatedAt: '2026-01-01', __localOverride: true }
    )).toBe(false)
  })

  it('empate de timestamp: incoming wins (>=)', () => {
    const ts = '2026-04-30T10:00:00Z'
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: ts },
      { updatedAt: ts }
    )).toBe(true)
  })

  it('apenas incoming tem timestamp: incoming vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      {},
      { updatedAt: '2026-01-01' }
    )).toBe(true)
  })

  it('apenas prev tem timestamp: prev vence', () => {
    expect(shouldUseIncomingTemplateSnapshot(
      { updatedAt: '2026-01-01' },
      {}
    )).toBe(false)
  })

  it('nenhum dos dois tem timestamp: incoming vence (legacy hydration)', () => {
    expect(shouldUseIncomingTemplateSnapshot({}, {})).toBe(true)
    expect(shouldUseIncomingTemplateSnapshot(null, null)).toBe(true)
  })
})

describe('BUILTIN_LABEL_TEMPLATE_IDS', () => {
  it('contem os 6 IDs built-in', () => {
    expect(BUILTIN_LABEL_TEMPLATE_IDS.size).toBe(6)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_default')).toBe(true)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_atacarejo_10fd')).toBe(true)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_black_yellow')).toBe(true)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_red_burst')).toBe(true)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_oferta_amarela')).toBe(true)
    expect(BUILTIN_LABEL_TEMPLATE_IDS.has('tpl_barlow_black')).toBe(true)
  })

  it('constantes individuais batem com IDs do Set', () => {
    expect(BUILTIN_DEFAULT_LABEL_TEMPLATE_ID).toBe('tpl_default')
    expect(BUILTIN_ATACAREJO_LABEL_TEMPLATE_ID).toBe('tpl_atacarejo_10fd')
    expect(BUILTIN_RED_BURST_LABEL_TEMPLATE_ID).toBe('tpl_red_burst')
  })
})

describe('isBuiltInLabelTemplateId', () => {
  it('aceita IDs built-in', () => {
    expect(isBuiltInLabelTemplateId('tpl_default')).toBe(true)
    expect(isBuiltInLabelTemplateId('tpl_atacarejo_10fd')).toBe(true)
    expect(isBuiltInLabelTemplateId('tpl_red_burst')).toBe(true)
  })

  it('rejeita IDs custom', () => {
    expect(isBuiltInLabelTemplateId('tpl_user_123')).toBe(false)
    expect(isBuiltInLabelTemplateId('custom_label')).toBe(false)
  })

  it('aplica trim antes de comparar', () => {
    expect(isBuiltInLabelTemplateId('  tpl_default  ')).toBe(true)
  })

  it('null/undefined/vazio/whitespace retornam false', () => {
    expect(isBuiltInLabelTemplateId(null)).toBe(false)
    expect(isBuiltInLabelTemplateId(undefined)).toBe(false)
    expect(isBuiltInLabelTemplateId('')).toBe(false)
    expect(isBuiltInLabelTemplateId('   ')).toBe(false)
    expect(isBuiltInLabelTemplateId(0)).toBe(false)
  })

  it('case-sensitive (IDs sao em snake_case)', () => {
    expect(isBuiltInLabelTemplateId('TPL_DEFAULT')).toBe(false)
  })
})

describe('LABEL_TEMPLATE_EXTRA_PROPS', () => {
  it('contem props identidade + custom flags', () => {
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('_customId')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('name')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('fontFamily')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('charSpacing')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__preserveManualLayout')
  })

  it('contem manual template flags (__manual*)', () => {
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__manualTemplateBaseW')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__manualTemplateBaseH')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__manualGapSingle')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__manualScaleX')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__manualScaleY')
  })

  it('contem original* (snapshot pre-resize)', () => {
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__originalWidth')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__originalHeight')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__originalFontSize')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__originalScaleX')
  })

  it('contem corner radii custom', () => {
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__cornerTL')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__cornerTR')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__cornerBL')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__cornerBR')
    expect(LABEL_TEMPLATE_EXTRA_PROPS).toContain('__originalCornerTL')
  })

  it('todas as strings unicas', () => {
    expect(new Set(LABEL_TEMPLATE_EXTRA_PROPS).size).toBe(LABEL_TEMPLATE_EXTRA_PROPS.length)
  })
})

describe('MANUAL_TEMPLATE_STABLE_PROPS', () => {
  it('contem apenas BaseW/BaseH', () => {
    expect(MANUAL_TEMPLATE_STABLE_PROPS).toEqual([
      '__manualTemplateBaseW',
      '__manualTemplateBaseH'
    ])
  })
})

describe('MANUAL_TEMPLATE_DERIVED_PROPS', () => {
  it('contem gaps + anchors', () => {
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).toContain('__manualGapSingle')
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).toContain('__manualGapRetail')
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).toContain('__manualGapWholesale')
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).toContain('__manualSingleAnchors')
  })

  it('NAO contem stable props (sao disjuntos)', () => {
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).not.toContain('__manualTemplateBaseW')
    expect(MANUAL_TEMPLATE_DERIVED_PROPS).not.toContain('__manualTemplateBaseH')
  })

  it('STABLE e DERIVED sao disjuntos', () => {
    const stable = new Set(MANUAL_TEMPLATE_STABLE_PROPS)
    const derived = new Set(MANUAL_TEMPLATE_DERIVED_PROPS)
    for (const prop of stable) expect(derived.has(prop)).toBe(false)
    for (const prop of derived) expect(stable.has(prop)).toBe(false)
  })
})

describe('label template version constants', () => {
  it('LABEL_TEMPLATES_JSON_KEY = "__labelTemplates"', () => {
    expect(LABEL_TEMPLATES_JSON_KEY).toBe('__labelTemplates')
  })

  it('BUILTIN_ATACAREJO_SEED_VERSION e numero positivo', () => {
    expect(typeof BUILTIN_ATACAREJO_SEED_VERSION).toBe('number')
    expect(BUILTIN_ATACAREJO_SEED_VERSION).toBeGreaterThan(0)
  })

  it('BUILTIN_RED_BURST_SEED_VERSION e numero positivo', () => {
    expect(typeof BUILTIN_RED_BURST_SEED_VERSION).toBe('number')
    expect(BUILTIN_RED_BURST_SEED_VERSION).toBeGreaterThan(0)
  })

  it('LABEL_TEMPLATE_PREVIEW_RENDER_VERSION e numero positivo', () => {
    expect(typeof LABEL_TEMPLATE_PREVIEW_RENDER_VERSION).toBe('number')
    expect(LABEL_TEMPLATE_PREVIEW_RENDER_VERSION).toBeGreaterThan(0)
  })

  it('JSON_KEY usa prefixo __ (evita colisao com props normais)', () => {
    expect(LABEL_TEMPLATES_JSON_KEY).toMatch(/^__/)
  })
})

describe('MANUAL_SINGLE_ANCHOR_VERSION', () => {
  it('e numero positivo (versao do snapshot dos anchors)', () => {
    expect(typeof MANUAL_SINGLE_ANCHOR_VERSION).toBe('number')
    expect(MANUAL_SINGLE_ANCHOR_VERSION).toBeGreaterThan(0)
    expect(MANUAL_SINGLE_ANCHOR_VERSION).toBe(2)
  })
})

describe('normalizeLabelTemplateGroupAsManual', () => {
  const noopSanitize = (g: any) => g

  it('null/non-object: retorna input', () => {
    expect(normalizeLabelTemplateGroupAsManual(null, noopSanitize)).toBe(null)
    expect(normalizeLabelTemplateGroupAsManual('str', noopSanitize)).toBe('str')
  })

  it('default: forceAtacarejoCanonical=false, preserveManualLayout=true, isCustomTemplate=true', () => {
    const grp: any = {}
    const result = normalizeLabelTemplateGroupAsManual(grp, noopSanitize)
    expect(result.__forceAtacarejoCanonical).toBe(false)
    expect(result.__preserveManualLayout).toBe(true)
    expect(result.__isCustomTemplate).toBe(true)
  })

  it('forceAtacarejoCanonical=true: preserveManualLayout=false, isCustomTemplate=false', () => {
    const grp: any = { __forceAtacarejoCanonical: true }
    const result = normalizeLabelTemplateGroupAsManual(grp, noopSanitize)
    expect(result.__forceAtacarejoCanonical).toBe(true)
    expect(result.__preserveManualLayout).toBe(false)
    expect(result.__isCustomTemplate).toBe(false)
  })

  it('chama sanitize antes de aplicar flags', () => {
    let called = false
    const sanitize = (g: any) => { called = true; return g }
    normalizeLabelTemplateGroupAsManual({}, sanitize)
    expect(called).toBe(true)
  })

  it('respeita boolean ja-existente', () => {
    const grp: any = {
      __forceAtacarejoCanonical: true,
      __preserveManualLayout: true, // explicitamente true mesmo com forceAtac
      __isCustomTemplate: false
    }
    const result = normalizeLabelTemplateGroupAsManual(grp, noopSanitize)
    expect(result.__preserveManualLayout).toBe(true)
    expect(result.__isCustomTemplate).toBe(false)
  })
})

describe('normalizeLabelTemplateRecordAsManual', () => {
  const noopSanitize = (g: any) => g

  it('null/non-object: retorna input', () => {
    expect(normalizeLabelTemplateRecordAsManual(null, noopSanitize)).toBe(null)
    expect(normalizeLabelTemplateRecordAsManual('str', noopSanitize)).toBe('str')
  })

  it('isBuiltIn deduzido pelo id', () => {
    const result = normalizeLabelTemplateRecordAsManual({ id: 'tpl_default' }, noopSanitize)
    expect(result.isBuiltIn).toBe(true)
  })

  it('isBuiltIn=false para id custom', () => {
    const result = normalizeLabelTemplateRecordAsManual({ id: 'tpl_user_123' }, noopSanitize)
    expect(result.isBuiltIn).toBe(false)
  })

  it('isBuiltIn explicit=true sempre vence', () => {
    const result = normalizeLabelTemplateRecordAsManual({ id: 'custom', isBuiltIn: true }, noopSanitize)
    expect(result.isBuiltIn).toBe(true)
  })

  it('group e' + ' normalizado via group helper', () => {
    const result = normalizeLabelTemplateRecordAsManual({ id: 'x', group: {} }, noopSanitize)
    expect(result.group.__forceAtacarejoCanonical).toBe(false)
    expect(result.group.__preserveManualLayout).toBe(true)
  })

  it('retorna novo objeto (nao mutates input)', () => {
    const tpl: any = { id: 'x', name: 'y' }
    const result = normalizeLabelTemplateRecordAsManual(tpl, noopSanitize)
    expect(result).not.toBe(tpl)
    expect(result.id).toBe('x')
    expect(result.name).toBe('y')
  })
})

import { describe, it, expect } from 'vitest'
import { layoutPrice } from '~/utils/priceTagLayout'
import { PRICE_INTEGER_DECIMAL_GAP_PX } from '~/utils/priceTagText'

/**
 * Mock minimo de fabric.Text/IText. Mantem apenas a API consumida pelo
 * layoutPrice: set(), getScaledWidth(), initDimensions(), e os campos de
 * estado relevantes (left, top, scaleX, scaleY, originX, originY, visible).
 *
 * width simula a largura "natural" do texto ao fontSize 1.0; a largura
 * renderizada e width * scaleX (como no Fabric).
 */
type MockText = {
    text: string
    width: number
    left: number
    top: number
    scaleX: number
    scaleY: number
    originX: string
    originY: string
    visible: boolean
    initCalls: number
    set: (k: any, v?: any) => void
    getScaledWidth: () => number
    initDimensions: () => void
}

const makeText = (init: Partial<MockText> & { width: number }): MockText => {
    const obj: MockText = {
        text: init.text ?? '',
        width: init.width,
        left: init.left ?? 0,
        top: init.top ?? 0,
        scaleX: init.scaleX ?? 1,
        scaleY: init.scaleY ?? 1,
        originX: init.originX ?? 'left',
        originY: init.originY ?? 'top',
        visible: init.visible ?? true,
        initCalls: 0,
        set(k: any, v?: any) {
            if (typeof k === 'string') {
                ;(this as any)[k] = v
                return
            }
            Object.assign(this, k)
        },
        getScaledWidth() {
            return this.width * Math.abs(this.scaleX || 1)
        },
        initDimensions() {
            this.initCalls += 1
        }
    }
    return obj
}

describe('layoutPrice — posicionamento horizontal inteiro+centavos+unidade', () => {
    it('retorna null se nao houver inteiro ou decimal', () => {
        const decimal = makeText({ width: 30 })
        expect(layoutPrice({
            priceInteger: null as any,
            priceDecimal: decimal,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })).toBeNull()

        const integer = makeText({ width: 60 })
        expect(layoutPrice({
            priceInteger: integer,
            priceDecimal: null as any,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })).toBeNull()
    })

    it('posiciona decimal usando largura RENDERIZADA do inteiro + gap', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        const result = layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 100,
            intY: 50,
            decY: 50,
            unitY: 50
        })

        expect(result).not.toBeNull()
        expect(integer.left).toBe(100)
        expect(integer.top).toBe(50)
        // centsX = intX(100) + intW(60) + gap(1) = 161
        expect(decimal.left).toBe(100 + 60 + PRICE_INTEGER_DECIMAL_GAP_PX)
        expect(decimal.top).toBe(50)
        expect(result!.centsX).toBe(161)
        expect(result!.intW).toBe(60)
        expect(result!.decW).toBe(30)
    })

    it('REGRESSAO: shrink encolhe inteiro E decimal proporcionalmente quando nao cabe', () => {
        // Bug historico: so o inteiro encolhia, decimal mantinha scale 1 →
        // em 47,99/129,99 o decimal ficava desproporcional ao inteiro.
        const integer = makeText({ width: 200 }) // inteiro grande
        const decimal = makeText({ width: 60 })  // decimal proporcional

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0,
            intY: 0,
            decY: 0,
            unitY: 0,
            maxWidth: 100 // forca shrink
        })

        // Ambos devem ter scaleX < 1 (foram encolhidos juntos)
        expect(integer.scaleX).toBeLessThan(1)
        expect(decimal.scaleX).toBeLessThan(1)
        // E proporcoes sao iguais (mesmo fator de shrink)
        expect(integer.scaleX).toBeCloseTo(decimal.scaleX, 5)
        expect(integer.scaleY).toBeCloseTo(decimal.scaleY, 5)
        // initDimensions chamado em ambos
        expect(integer.initCalls).toBeGreaterThanOrEqual(1)
        expect(decimal.initCalls).toBeGreaterThanOrEqual(1)
    })

    it('shrink minimo respeita piso de 0.35', () => {
        const integer = makeText({ width: 1000 })
        const decimal = makeText({ width: 100 })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0,
            intY: 0,
            decY: 0,
            unitY: 0,
            maxWidth: 50 // forca shrink extremo
        })

        // Piso 0.35 protege contra texto invisivel.
        expect(integer.scaleX).toBeGreaterThanOrEqual(0.35)
        expect(decimal.scaleX).toBeGreaterThanOrEqual(0.35)
    })

    it('NAO shrinkea quando maxWidth ausente ou inteiro cabe', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0, intY: 0, decY: 0, unitY: 0
            // sem maxWidth
        })

        expect(integer.scaleX).toBe(1)
        expect(decimal.scaleX).toBe(1)
    })

    it('respeita gapPx custom (override do template) com clamp', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        const result = layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0, intY: 0, decY: 0, unitY: 0,
            gapPx: 5,
            minGapPx: 0,
            maxGapPx: 10
        })

        expect(result!.gap).toBe(5)
        expect(decimal.left).toBe(0 + 60 + 5)
    })

    it('clampa gapPx no [minGapPx, maxGapPx]', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        const result = layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0, intY: 0, decY: 0, unitY: 0,
            gapPx: 999, // tenta usar valor absurdo
            minGapPx: 0,
            maxGapPx: 8
        })

        expect(result!.gap).toBe(8)
    })

    it('posiciona unidade centralizada no decimal', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        const unit = makeText({ width: 20, text: 'KG' })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 100, intY: 50, decY: 50, unitY: 80
        })

        // centsX = 161, decW = 30 → decCenterX = 176
        expect(unit.left).toBe(176)
        expect(unit.top).toBe(80)
        expect(unit.originX).toBe('center')
        expect(unit.visible).toBe(true)
    })

    it('respeita unit.visible=false (atacarejo collapsed tier)', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        const unit = makeText({ width: 20, text: 'KG', visible: false })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        expect(unit.visible).toBe(false)
    })

    it('esconde unit sem texto', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        const unit = makeText({ width: 0, text: '' })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        expect(unit.visible).toBe(false)
    })

    it('normaliza unit "ML" para vazio (gramatura nao vira UN fantasma)', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        // 'ML' nao mapeia para KG nem UN → normalizeUnitForLabel retorna ''
        const unit = makeText({ width: 20, text: '500ML' })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        expect(unit.text).toBe('')
    })

    it('mantem KG quando o produto eh por peso', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        const unit = makeText({ width: 20, text: 'KG' })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        expect(unit.text).toBe('KG')
        expect(unit.visible).toBe(true)
    })

    it('encolhe unidade quando unitW > decW', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 20 })
        const unit = makeText({ width: 40, text: 'KG' }) // mais largo que decimal

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        // Reduz para decW/unitW = 20/40 = 0.5
        expect(unit.scaleX).toBeCloseTo(0.5, 3)
        expect(unit.scaleY).toBeCloseTo(0.5, 3)
    })

    it('reseta scale da unidade quando unitW <= decW', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })
        const unit = makeText({ width: 20, text: 'UN', scaleX: 0.5, scaleY: 0.5 })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            priceUnit: unit,
            intX: 0, intY: 0, decY: 0, unitY: 0
        })

        // unitW(20*0.5=10) <= decW(30) → reset para scale 1
        expect(unit.scaleX).toBe(1)
        expect(unit.scaleY).toBe(1)
    })

    it('targetCenterX desloca o bloco completo para o centro pedido', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 0,
            intY: 0,
            decY: 0,
            unitY: 0,
            targetCenterX: 200
        })

        // bloco original: integer.left=0 (left, w=60) → 0..60; decimal=61..91; centro = 45.5
        // dx = 200 - 45.5 = 154.5
        expect(integer.left).toBeCloseTo(154.5, 3)
        expect(decimal.left).toBeCloseTo(154.5 + 60 + 1, 3)
    })

    it('sem targetCenterX nao mexe nas posicoes originais', () => {
        const integer = makeText({ width: 60 })
        const decimal = makeText({ width: 30 })

        layoutPrice({
            priceInteger: integer,
            priceDecimal: decimal,
            intX: 100, intY: 50, decY: 50, unitY: 50
        })

        expect(integer.left).toBe(100)
        expect(decimal.left).toBe(161)
    })
})

import { describe, expect, it } from 'vitest'
import type { Product } from '~/types/product-zone'
import {
  buildAutoOfferLayoutPlan,
  buildAutoOfferZoneUpdate,
  estimateAutoOfferCapacity,
  resolveAutoOfferImageRef,
  scoreAutoOfferProduct
} from '~/utils/autoOfferEngine'

const product = (id: string, overrides: Partial<Product> = {}): Partial<Product> => ({
  id,
  name: `Produto ${id}`,
  price: 9.99,
  images: [],
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  ...overrides
})

describe('autoOfferEngine', () => {
  it('gera uma atualizacao de zona automatica a partir da quantidade de produtos', () => {
    const products = Array.from({ length: 10 }, (_, index) => product(String(index + 1)))
    const update = buildAutoOfferZoneUpdate(products, {
      zone: { x: 0, y: 0, width: 900, height: 620 },
      density: 'balanced',
      sourceMode: 'paste-list'
    })

    expect(update.enabled).toBe(true)
    expect(update.contentSource).toBe('paste-list')
    expect(update.contentStatus).toBe('filled')
    expect(update.columns).toBeGreaterThan(1)
    expect(update.rows).toBe(0)
    expect(update.gapHorizontal).toBeGreaterThan(0)
    expect(update.padding).toBeGreaterThan(0)
  })

  it('prioriza produtos com preco especial quando promocao automatica esta ativa', () => {
    const products = [
      product('arroz'),
      product('detergente', { priceSpecialUnit: 1.99, specialCondition: 'Acima de 3 unidades' }),
      product('feijao')
    ]
    const plan = buildAutoOfferLayoutPlan(products, {
      zone: { x: 0, y: 0, width: 720, height: 520 },
      promoteHighlights: true
    })

    expect(plan.zones[0]?.products[0]?.id).toBe('detergente')
    expect(plan.zones[0]?.zone.highlightCount).toBeGreaterThan(0)
    expect(plan.zones[0]?.decisions.find((item) => item.id === 'detergente')?.priority).toBe('primary')
  })

  it('preserva a imagem aprovada ao normalizar produtos para o layout automatico', () => {
    const plan = buildAutoOfferLayoutPlan([
      product('leite', {
        imageUrl: '/api/storage/p?key=produtos/leite.webp',
        images: []
      } as any)
    ], {
      zone: { x: 0, y: 0, width: 720, height: 520 }
    })
    const plannedProduct = plan.zones[0]?.products[0] as any

    expect(plannedProduct.imageUrl).toBe('/api/storage/p?key=produtos/leite.webp')
    expect(resolveAutoOfferImageRef(plannedProduct)).toBe('/api/storage/p?key=produtos/leite.webp')
  })

  it('usa Product.images[] como fallback de imagem quando nao ha imageUrl top-level', () => {
    const plan = buildAutoOfferLayoutPlan([
      product('suco', {
        images: [{ id: 'img-suco', src: 'produtos/suco.webp', x: 0, y: 0, scale: 1 }]
      })
    ], {
      zone: { x: 0, y: 0, width: 720, height: 520 }
    })
    const plannedProduct = plan.zones[0]?.products[0] as any

    expect(plannedProduct.imageUrl).toBe('produtos/suco.webp')
    expect(resolveAutoOfferImageRef(plannedProduct)).toBe('produtos/suco.webp')
  })

  it('preserva ordem comercial quando promocao automatica esta desativada', () => {
    const products = [
      product('arroz'),
      product('detergente', { priceSpecialUnit: 1.99, specialCondition: 'Acima de 3 unidades' }),
      product('feijao')
    ]
    const plan = buildAutoOfferLayoutPlan(products, {
      zone: { x: 0, y: 0, width: 720, height: 520 },
      promoteHighlights: false
    })

    expect(plan.zones[0]?.products.map((item) => item.id)).toEqual(['arroz', 'detergente', 'feijao'])
    expect(plan.zones[0]?.decisions.find((item) => item.id === 'detergente')?.priority).toBe('primary')
  })

  it('marca overflow quando a zona nao comporta a lista com leitura segura', () => {
    const products = Array.from({ length: 12 }, (_, index) => product(String(index + 1)))
    const plan = buildAutoOfferLayoutPlan(products, {
      zone: { x: 0, y: 0, width: 260, height: 240, padding: 18, gapHorizontal: 14, gapVertical: 14 },
      density: 'premium',
      overflowPolicy: 'warn'
    })

    expect(plan.strategy).toBe('review-overflow')
    expect(plan.zones[0]?.zone.contentStatus).toBe('overflow')
    expect(plan.zones[0]?.overflowCount).toBeGreaterThan(0)
    expect(plan.warnings.some((warning) => warning.startsWith('overflow:'))).toBe(true)
  })

  it('quebra em multiplas zonas quando overflowPolicy paginate e limite sao informados', () => {
    const products = Array.from({ length: 7 }, (_, index) => product(String(index + 1)))
    const plan = buildAutoOfferLayoutPlan(products, {
      zone: { x: 0, y: 0, width: 900, height: 620 },
      overflowPolicy: 'paginate',
      maxProductsPerZone: 3
    })

    expect(plan.strategy).toBe('paginate')
    expect(plan.zones).toHaveLength(3)
    expect(plan.zones.map((zone) => zone.products.length)).toEqual([3, 3, 1])
  })

  it('estima capacidade e score de destaque de forma deterministica', () => {
    const capacity = estimateAutoOfferCapacity({ width: 900, height: 600, padding: 20 }, 'balanced')
    const score = scoreAutoOfferProduct(product('leite', {
      priceSpecial: 39.9,
      priceWholesale: 35.9,
      images: [{ id: 'img', src: '/leite.png', x: 0, y: 0, scale: 1 }]
    }), 0)

    expect(capacity).toBeGreaterThan(0)
    expect(score.priority).toBe('primary')
    expect(score.reasons).toContain('special-price')
    expect(score.reasons).toContain('wholesale')
    expect(score.reasons).toContain('image')
  })
})

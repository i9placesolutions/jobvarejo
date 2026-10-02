import { describe, expect, it } from 'vitest'
import { orderFlyerTemplatesForCompany } from '../../utils/companyFlyerTemplateOrder'

const templates = Array.from({ length: 12 }, (_, index) => ({ id: `theme-${index + 1}` }))

describe('orderFlyerTemplatesForCompany', () => {
  it('keeps a stable order for one company regardless of API order', () => {
    const first = orderFlyerTemplatesForCompany(templates, 'company-a').map(item => item.id)
    const second = orderFlyerTemplatesForCompany([...templates].reverse(), 'company-a').map(item => item.id)
    expect(second).toEqual(first)
    expect(new Set(first)).toEqual(new Set(templates.map(item => item.id)))
  })

  it('varies the first themes between companies without changing the source list', () => {
    const original = templates.map(item => item.id)
    const first = orderFlyerTemplatesForCompany(templates, 'company-a').map(item => item.id)
    const second = orderFlyerTemplatesForCompany(templates, 'company-b').map(item => item.id)
    expect(first.slice(0, 3)).not.toEqual(second.slice(0, 3))
    expect(templates.map(item => item.id)).toEqual(original)
  })
})

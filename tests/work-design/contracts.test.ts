import { describe, expect, it } from 'vitest'
import { parseWorkProductList, layoutSchema } from '../../shared/work-design'
import { compileWorkPage, validateWorkLayout } from '../../server/utils/work-design/composition'
import { assertWorkImageKey } from '../../server/utils/work-design/storage'
import { pilotIdentityAllowed, workerTokenMatches } from '../../server/utils/work-design/access'
import { fixtureJob, fixtureLayout, owner, other } from './fixtures'

describe('contrato experimental Work', () => {
  it.each([1, 5, 12])('preserva %i produtos em dois formatos e dois endereços', count => {
    const job = fixtureJob(count), layout = fixtureLayout(job)
    expect(() => validateWorkLayout(job, layoutSchema.parse(layout))).not.toThrow()
    expect(layout.pages.every(p => p.fields.filter(f => f.binding.startsWith('address:')).length === 2)).toBe(true)
  })
  it('rejeita produto omitido, repetido, reordenado, formato faltante e endereço omitido', () => {
    const job = fixtureJob(), valid = fixtureLayout(job)
    for (const mutate of [
      (l: typeof valid) => l.pages[0]!.slots.pop(),
      (l: typeof valid) => { l.pages[0]!.slots[0]!.productId = l.pages[0]!.slots[1]!.productId },
      (l: typeof valid) => l.pages[0]!.slots.reverse(),
      (l: typeof valid) => { l.pages = l.pages.filter(p => p.format !== 'feed') },
      (l: typeof valid) => { l.pages[0]!.fields = l.pages[0]!.fields.filter(f => f.binding !== 'address:unidade-2') }
    ]) { const altered = structuredClone(valid); mutate(altered); expect(() => validateWorkLayout(job, altered)).toThrow() }
  })
  it('rejeita sobreposição e conteúdo fora da página', () => {
    const job = fixtureJob(), layout = fixtureLayout(job)
    layout.pages[0]!.slots[0]!.box.y = 180
    expect(() => validateWorkLayout(job, layout)).toThrow(/sobrepostos/)
    layout.pages[0]!.slots[0]!.box.x = 1080
    expect(() => validateWorkLayout(job, layout)).toThrow(/fora/)
  })
  it('gera dados comerciais como Textbox separados e zonas nativas, sem alterar o pedido', async () => {
    const job = fixtureJob(), snapshot = JSON.stringify(job), page = fixtureLayout(job).pages[0]!
    const canvas = await compileWorkPage(job, page, async () => ({ dataUrl: 'data:image/png;base64,AA==', width: 200, height: 100 }))
    const addresses = canvas.objects.filter(o => o.data?.workBinding?.startsWith('address:'))
    expect(addresses).toHaveLength(2); expect(addresses.every(o => o.type === 'Textbox')).toBe(true)
    expect(canvas.objects.filter(o => o.isProductZone)).toHaveLength(5)
    const richPrice = canvas.__labelTemplates[0]!.group.objects.find((o: any) => o.__priceRichText)
    expect(richPrice.__priceRichIntegerStyle.fill).toBe(page.cardStyle.priceColor)
    expect(richPrice.__priceRichDecimalStyle.fill).toBe(page.cardStyle.priceColor)
    const logo = canvas.objects.find(o => o.name === 'work-logo')
    expect(logo.scaleX).toBe(logo.scaleY)
    expect(JSON.stringify(job)).toBe(snapshot)
  })
  it('valida linhas sem cobrar API e não aceita lista ambígua', () => {
    const products = parseWorkProductList('COXAO MOLE – 48.99\nALMONDEGA BOVINA – 28,99', () => crypto.randomUUID())
    expect(products.map(p => p.price)).toEqual(['48,99', '28,99'])
    expect(() => parseWorkProductList('carne barato', () => crypto.randomUUID())).toThrow(/Linha 1/)
  })
  it('restringe credencial, conta piloto e arquivos privados', () => {
    expect(workerTokenMatches('a'.repeat(40), 'a'.repeat(40))).toBe(true)
    expect(workerTokenMatches('a'.repeat(40), 'b'.repeat(40))).toBe(false)
    expect(workerTokenMatches('short', 'short')).toBe(false)
    const config = { enabled: true, owners: [owner], workerOwner: owner, token: '', n8nToken: '' }
    expect(pilotIdentityAllowed(config, owner, owner)).toBe(true)
    expect(pilotIdentityAllowed(config, owner, other)).toBe(false)
    expect(pilotIdentityAllowed({ ...config, enabled: false }, owner, owner)).toBe(false)
    expect(() => assertWorkImageKey(`projects/${other}/private/photo.png`, owner)).toThrow()
    expect(() => assertWorkImageKey('imagens/../secret.png', owner)).toThrow()
    expect(() => assertWorkImageKey('https://localhost/photo.png', owner)).toThrow()
    expect(() => assertWorkImageKey('imagens/photo.png', owner)).not.toThrow()
  })
})

import { randomUUID } from 'node:crypto'
import { WORK_FORMATS, type WorkJob, type WorkLayout } from '../../shared/work-design'
import { workBindings } from '../../server/utils/work-design/composition'
export const owner = 'eb847e8e-7c19-4bee-8042-376528ce6192'
export const other = 'db847e8e-7c19-4bee-8042-376528ce6192'
export function fixtureJob(count = 5): WorkJob {
  return { id: randomUUID(), owner_id: owner, revision: 1, status: 'pending', business: {
    companyName: 'Supermercado Economia', logo: 'logo/test-logo.png',
    addresses: [{ id: 'unidade-1', label: 'Unidade 1', value: 'Av. José Mário da Costa Resende, Turvelândia — GO' },
      { id: 'unidade-2', label: 'Unidade 2', value: 'Rua de Teste, 200, Centro — GO' }] },
    request: { name: 'Encarte de teste', theme: 'Semana de Ofertas', validity: '07 de outubro', conditions: '', brief: '',
      palette: ['#083A9D', '#FFD215'], formats: ['stories', 'feed'],
      products: Array.from({ length: count }, (_, i) => ({ id: randomUUID(), name: ['Coxão mole', 'Almôndega bovina', 'Costela bovina', 'Suan suína', 'Coxinha da asa'][i % 5]!,
        price: ['48,99', '28,99', '26,99', '13,99', '14,99'][i % 5]!, unit: '', imageKey: `imagens/test-${i % 5}.png` })) },
    source_revision: null, source_snapshot: null, result: null, draft_layout: null, error: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
}
/** Receita de teste, não uma saída obtida do Work. */
export function fixtureLayout(job: WorkJob): WorkLayout {
  const bindings = workBindings(job), pages: WorkLayout['pages'] = []
  for (const format of job.request.formats) {
    const size = WORK_FORMATS[format], scale = Math.min(size.width / 1080, size.height / 1350),
      capacity = Math.min(format === 'stories' ? 9 : 12, job.request.productsPerPage || 16)
    for (let start = 0; start < job.request.products.length; start += capacity) {
      const products = job.request.products.slice(start, start + capacity), cols = products.length === 1 ? 1 : products.length <= 6 ? 2 : 3,
        rows = Math.ceil(products.length / cols), gap = 14 * scale, left = 40 * scale, top = 375 * scale,
        usableHeight = size.height - top - 180 * scale, w = (size.width - 80 * scale - gap * (cols - 1)) / cols,
        h = (usableHeight - gap * (rows - 1)) / rows
      pages.push({ format, background: '#083A9D', decorations: [{ kind: 'rect', color: '#FFD215', radius: 24, box: { x: left, y: 250 * scale, width: size.width - 80 * scale, height: 70 * scale } }],
        heading: { text: 'SEMANA DE\nOFERTAS', box: { x: 330 * scale, y: 45 * scale, width: 700 * scale, height: 125 * scale },
          style: { fontFamily: 'Barlow Condensed', fontSize: 52 * scale, color: '#FFD215', align: 'center', bold: true } },
        fields: bindings.map((b, index) => ({ binding: b.id,
          box: b.id === 'logo' ? { x: 40 * scale, y: 35 * scale, width: 240 * scale, height: 170 * scale }
            : b.id === 'companyName' ? { x: 330 * scale, y: 180 * scale, width: 700 * scale, height: 50 * scale }
              : b.id === 'validity' ? { x: 60 * scale, y: 265 * scale, width: 960 * scale, height: 44 * scale }
                : { x: left, y: size.height - (135 - (index - 3) * 55) * scale, width: size.width - 80 * scale, height: 47 * scale },
          style: { fontFamily: 'Barlow', fontSize: (b.id === 'validity' ? 34 : 26) * scale,
            color: b.id === 'validity' ? '#083A9D' : '#FFFFFF', align: 'center', bold: true } })),
        slots: products.map((product, i) => ({ productId: product.id, box: { x: left + (i % cols) * (w + gap), y: top + Math.floor(i / cols) * (h + gap), width: w, height: h } })),
        cardStyle: { background: '#FFFFFF', nameColor: '#083A9D', priceBackground: '#FFD215', priceColor: '#083A9D' } })
    }
  }
  return { pages }
}

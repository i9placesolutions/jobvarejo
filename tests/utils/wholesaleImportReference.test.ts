import { describe, expect, it } from 'vitest'
import { parseProductsAuto } from '../../server/utils/product-text-parser'
import { extractProductPdfText, toStandalonePdfBuffer } from '../../server/utils/product-pdf-text'
import { getAvailablePrices } from '../../utils/productPriceHelpers'
import { isProductLabelTemplateCompatible, productNeedsMultiPriceLabel } from '../../utils/productLabelCompatibility'

const header = 'POSIÇÃO NA LÂMINA;PRODUTO;EMBALAGEM;QUANT. EMB;PREÇO CX. AVULSA;PREÇO UND. AVULSA;PREÇO ESPECIAL.;PREÇO UND. ESPECIAL;PREÇO ESPECIAL'
const rows = [
  '1;LEITE ITALAC DESNATADO C/ TAMPA 1 LT;CAIXA;12;R$ 61,80;R$ 5,15;R$ 59,88;R$ 4,99;ACIMA DE 2 CAIXAS',
  '2;BALA FLORESTAL MAST SORTIDA 400G;PACOTE;1;;R$ 5,69;;R$ 5,48;ACIMA DE 3 PACOTES',
  '2;AMIDUS SALGADO GRELHADITOS STA HEL 24G;POTE;60;R$ 25,80;R$ 0,43;R$ 24,00;R$ 0,40;ACIMA DE 3 CAIXAS',
  '7;PAPEL HIG BOB PREMIUM SOFT 20M F DUP;PACOTE;12;R$ 7,39;;R$ 7,29;;ACIMA DE 4 PACOTES'
]
const products = () => parseProductsAuto([header, ...rows].join('\n'))

describe('planilha de atacado da referência', () => {
  it('preserva os quatro preços, o nome, a embalagem e a condição sem usar posição como condição', () => {
    const [milk] = products()
    expect(milk).toMatchObject({ name: 'LEITE ITALAC DESNATADO C/ TAMPA 1 LT', pricePack: '61,80', priceUnit: '5,15', priceSpecial: '59,88', priceSpecialUnit: '4,99', packageLabel: 'CX', packQuantity: 12, packUnit: 'UN', specialCondition: 'ACIMA DE 2 CAIXAS', wholesaleTrigger: 2, wholesaleTriggerUnit: 'CX' })
    expect(getAvailablePrices(milk).prices).toHaveLength(4)
  })
  it('reconhece dois preços sem inventar valores nas colunas vazias', () => {
    const [, candy, , paper] = products()
    expect(getAvailablePrices(candy).prices).toHaveLength(2)
    expect(paper).toMatchObject({ pricePack: '7,39', priceUnit: null, priceSpecial: '7,29', priceSpecialUnit: null, packQuantity: 12 })
    expect(getAvailablePrices(paper).prices).toHaveLength(2)
    expect(productNeedsMultiPriceLabel(paper)).toBe(true)
  })
  it('não confunde quantidade interna com unidade do gatilho de atacado', () => {
    expect(products()[2]).toMatchObject({ packageLabel: 'POTE', packQuantity: 60, wholesaleTrigger: 3, wholesaleTriggerUnit: 'CX' })
  })
  it('não deixa posição virar condição quando não há condição informada', () => {
    const [product] = parseProductsAuto('POSIÇÃO NA LÂMINA;PRODUTO;PREÇO UND\n1;ARROZ 5KG;23,98')
    expect(product?.specialCondition).toBeNull()
  })
  it('ignora cabeçalhos repetidos entre páginas', () => {
    expect(parseProductsAuto([header, rows[0], header, rows[1]].join('\n'))).toHaveLength(2)
  })
  it('exige linhas de embalagem nas etiquetas de quatro preços', () => {
    const template = (names: string[]) => ({ group: { objects: names.map(name => ({ name, type: 'text' })) } })
    const base = ['atac_retail_bg', 'atac_wholesale_bg', 'retail_price_text', 'wholesale_price_text']
    expect(isProductLabelTemplateCompatible(products()[0], template(base))).toBe(false)
    expect(isProductLabelTemplateCompatible(products()[0], template([...base, 'retail_pack_line_text', 'wholesale_pack_line_text']))).toBe(true)
  })
  it('mantém colunas vazias ao ler uma tabela PDF com grade', () => {
    const columns = header.split(';')
    const text = (value: string, x: number, y: number) => ({ x, y, R: [{ T: encodeURIComponent(value) }] })
    const pdf = { Pages: [{
      VLines: Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0, l: 10 })),
      Texts: [...columns.map((value, i) => text(value, i * 10 + 1, 1)),
        ...rows[1]!.split(';').flatMap((value, i) => value ? [text(value, i * 10 + 1, 2)] : [])]
    }] }
    const [product] = parseProductsAuto(extractProductPdfText(pdf))
    expect(product).toMatchObject({ name: 'BALA FLORESTAL MAST SORTIDA 400G', pricePack: null, priceUnit: '5,69', priceSpecialUnit: '5,48', specialCondition: 'ACIMA DE 3 PACOTES' })
  })
})

import { resolveWholesalePackPriceState } from '../../utils/wholesalePackOffer'
import { resolveFardoSpecialPriceState } from '../../utils/fardoSpecialPriceHelpers'

describe('isolamento do formato atacado por embalagem', () => {
  it('marca somente tabelas com o conjunto completo de colunas deste formato', () => {
    expect(products().every(product => product.offerFormat === 'wholesale-pack-v1')).toBe(true)
    expect(parseProductsAuto('ARROZ 5KG 23,98')[0]?.offerFormat).toBeUndefined()
    expect(parseProductsAuto('PRODUTO;PREÇO\nARROZ 5KG;23,98')[0]?.offerFormat).toBeUndefined()
  })
  it('mostra os quatro valores originais e preserva o texto de condição', () => {
    const product = products()[0]
    const state = resolveWholesalePackPriceState(product)
    expect(state.retail).toMatchObject({ price: '61,80', packLine: 'CAIXA C/ 12 UNIDADES · UNID R$ 5,15' })
    expect(state.special).toMatchObject({ price: '59,88', packLine: 'CAIXA C/ 12 UNIDADES · UNID R$ 4,99' })
    expect(state.conditionText).toBe('ACIMA DE 2 CAIXAS')
    // A mesma entrada no formato anterior mantém o preço unitário em destaque.
    expect(resolveFardoSpecialPriceState(product).retail.price).toBe('5,15')
  })
  it('não cria preço unitário por divisão quando só existem os preços da embalagem', () => {
    const state = resolveWholesalePackPriceState(products()[3])
    expect(state.retail).toMatchObject({ price: '7,39', packLine: 'PACOTE C/ 12 UNIDADES' })
    expect(state.special).toMatchObject({ price: '7,29', packLine: 'PACOTE C/ 12 UNIDADES' })
  })
  it('colapsa a faixa base ausente e mantém qualquer quantidade', () => {
    const state = resolveWholesalePackPriceState({ priceSpecial: '129,99', priceSpecialUnit: '5,41', packageLabel: 'CX', packQuantity: 24, specialCondition: 'QUALQUER QUANTIDADE' })
    expect(state.showRetail).toBe(false)
    expect(state.special).toMatchObject({ price: '129,99', packLine: 'CAIXA C/ 24 UNIDADES · UNID R$ 5,41' })
    expect(state.conditionText).toBe('QUALQUER QUANTIDADE')
  })
})

import { migrateProduct } from '../../utils/product-zone-helpers'
it('preserva a identificação do formato na conversão e no JSON de produto', () => {
  const migrated = migrateProduct({ ...products()[0], id: 'milk' })
  const reopened = JSON.parse(JSON.stringify(migrated))
  expect(reopened.offerFormat).toBe('wholesale-pack-v1')
  expect(resolveWholesalePackPriceState(reopened).retail.price).toBe('61,80')
  expect(migrateProduct({ id: 'rice', name: 'ARROZ', price: '10,00' }).offerFormat).toBeUndefined()
})

it('extrai um PDF real com tabela e mantém os quatro preços nas colunas corretas', async () => {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const { default: PDFParser } = await import('pdf2json')
  const document = await PDFDocument.create()
  const page = document.addPage([1500, 240])
  const font = await document.embedFont(StandardFonts.Helvetica)
  const boundaries = [10, 110, 580, 700, 800, 930, 1070, 1190, 1330, 1490]
  for (const x of boundaries) page.drawLine({ start: { x, y: 140 }, end: { x, y: 225 }, thickness: 0.5 })
  for (const [rowIndex, row] of [header, rows[0]!].entries()) {
    row.split(';').forEach((cell, index) => page.drawText(cell, { x: boundaries[index]! + 2, y: 210 - rowIndex * 30, size: 7, font }))
  }
  const buffer = Buffer.from(await document.save({ useObjectStreams: false }))
  const parsed = await new Promise<any>((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataReady', resolve)
    parser.on('pdfParser_dataError', reject)
    parser.parseBuffer(toStandalonePdfBuffer(buffer))
  })
  expect(parseProductsAuto(extractProductPdfText(parsed))[0]).toMatchObject({
    offerFormat: 'wholesale-pack-v1', name: 'LEITE ITALAC DESNATADO C/ TAMPA 1 LT', pricePack: '61,80', priceUnit: '5,15', priceSpecial: '59,88', priceSpecialUnit: '4,99', specialCondition: 'ACIMA DE 2 CAIXAS'
  })
})

it('lê uma planilha XLSX real com células monetárias e vazias', async () => {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header.split(';'), ...rows.map(row => row.split(';'))]), 'Ofertas')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const reopened = XLSX.read(buffer, { type: 'buffer' })
  const csv = XLSX.utils.sheet_to_csv(reopened.Sheets.Ofertas!, { FS: ';' })
  const imported = parseProductsAuto(csv)
  expect(imported).toHaveLength(4)
  expect(imported[0]).toMatchObject({ offerFormat: 'wholesale-pack-v1', pricePack: '61,80', priceSpecialUnit: '4,99' })
  expect(imported[3]).toMatchObject({ priceUnit: null, priceSpecialUnit: null, pricePack: '7,39', priceSpecial: '7,29' })
})

it('não mostra preço zero criado pela conversão de um item somente com atacado', () => {
  const product = migrateProduct({ id: 'only-special', name: 'CERVEJA', offerFormat: 'wholesale-pack-v1', priceSpecial: '129,99', priceSpecialUnit: '5,41', packQuantity: 24, packageLabel: 'CX', specialCondition: 'QUALQUER QUANTIDADE' })
  expect(resolveWholesalePackPriceState(product).showRetail).toBe(false)
})

it('reconhece QUANT. EMBALAGEM e CONDIÇÃO DO PREÇO ESPECIAL sem confundir os campos', () => {
  const [product] = parseProductsAuto('PRODUTO;EMBALAGEM;QUANT. EMBALAGEM;PREÇO CX. AVULSA;PREÇO UND. AVULSA;PREÇO ESPECIAL;PREÇO UND. ESPECIAL;CONDIÇÃO DO PREÇO ESPECIAL\nCERVEJA HEINEKEN 330 ML;SIXPACK;6;33.78;5.63;31.74;5.29;ACIMA DE 20 SIXPACK')
  expect(product).toMatchObject({ offerFormat: 'wholesale-pack-v1', packageLabel: 'SIXPACK', packQuantity: 6, pricePack: '33,78', priceUnit: '5,63', priceSpecial: '31,74', priceSpecialUnit: '5,29', specialCondition: 'ACIMA DE 20 SIXPACK' })
  expect(getAvailablePrices(product).prices).toHaveLength(4)
})

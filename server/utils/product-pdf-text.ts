/** Mantém linhas, colunas vazias e cabeçalhos de tabelas de ofertas no PDF. */
type PdfText = { x: number; y: number; R?: Array<{ T?: string }> }
type PdfPage = { Texts?: PdfText[]; VLines?: Array<{ x: number; y: number; l: number }> }
const decode = (value: string) => {
  try { return decodeURIComponent(value) } catch { return value }
}
const cellText = (text: PdfText) => (text.R || []).map(run => decode(run.T || '')).join('')
const quote = (text: string) => `"${text.replace(/"/g, '""')}"`

export const extractProductPdfText = (data: { Pages?: PdfPage[] }, rawFallback = ''): string => {
  const pages: string[] = []
  for (const page of data.Pages || []) {
    const rows: Array<{ y: number; texts: PdfText[] }> = []
    for (const text of [...(page.Texts || [])].sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (!cellText(text).trim()) continue
      const row = rows.find(row => Math.abs(row.y - text.y) < 0.15)
      if (row) row.texts.push(text)
      else rows.push({ y: text.y, texts: [text] })
    }
    rows.forEach(row => row.texts.sort((a, b) => a.x - b.x))
    // Cabeçalhos são dados, não instruções. Só tabelas reconhecíveis definem colunas.
    const header = rows.find(row => row.texts.some(text => /^(PRODUTO|DESCRI[ÇC][ÃA]O|NOME)$/i.test(cellText(text).trim()))
      && row.texts.some(text => /PRE[ÇC]O/i.test(cellText(text))))
    if (!header) {
      pages.push(rows.map(row => row.texts.map(cellText).join(' ')).join('\n'))
      continue
    }
    const boundaries = [...new Set((page.VLines || [])
      .filter(line => line.y <= header.y + 0.5 && line.y + line.l >= header.y)
      .map(line => Math.round(line.x * 100) / 100))].sort((a, b) => a - b)
    // PDFs sem grade usam os inícios de coluna do cabeçalho como âncoras.
    const anchors = header.texts.map(text => text.x)
    const useGrid = boundaries.length >= 3
    const count = useGrid ? boundaries.length - 1 : anchors.length
    const tableRows = rows.filter(row => row.y >= header.y).map(row => {
      const cells = Array.from({ length: count }, () => [] as string[])
      for (const text of row.texts) {
        const index = useGrid
          ? boundaries.findIndex((left, i) => i < count && text.x >= left - 0.15 && text.x < boundaries[i + 1]! - 0.15)
          : anchors.reduce((best, left, i) => text.x >= left - 0.2 ? i : best, 0)
        if (index >= 0) cells[index]!.push(cellText(text))
      }
      return cells.map(cell => quote(cell.join(' ').trim())).join('\t')
    })
    pages.push(tableRows.join('\n'))
  }
  return pages.filter(Boolean).join('\n') || rawFallback
}

/** pdf2json usa o ArrayBuffer inteiro; um Buffer do pool pode ter byteOffset != 0. */
export const toStandalonePdfBuffer = (source: Uint8Array): Buffer => {
  const buffer = Buffer.alloc(source.byteLength)
  buffer.set(source)
  return buffer
}

import { describe, it, expect } from 'vitest'
import { splitTextIntoChunks, CHUNK_CHAR_LIMIT } from '~/utils/textChunking'

describe('CHUNK_CHAR_LIMIT', () => {
  it('= 15.000 chars (default)', () => {
    expect(CHUNK_CHAR_LIMIT).toBe(15_000)
    expect(CHUNK_CHAR_LIMIT).toBeGreaterThan(0)
  })
})

describe('splitTextIntoChunks', () => {
  it('texto curto: retorna [texto] em 1 chunk', () => {
    expect(splitTextIntoChunks('linha unica')).toEqual(['linha unica'])
  })

  it('aplica trim antes de processar', () => {
    expect(splitTextIntoChunks('   abc   ')).toEqual(['abc'])
  })

  it('texto vazio: array vazio', () => {
    expect(splitTextIntoChunks('')).toEqual([])
    expect(splitTextIntoChunks('   ')).toEqual([])
  })

  it('null/undefined: array vazio (defensivo)', () => {
    expect(splitTextIntoChunks(null as any)).toEqual([])
    expect(splitTextIntoChunks(undefined as any)).toEqual([])
  })

  it('texto exatamente no limite: 1 chunk', () => {
    const txt = 'a'.repeat(10)
    expect(splitTextIntoChunks(txt, 10)).toEqual([txt])
  })

  it('texto excede o limite: quebra em multiplos chunks', () => {
    const lines: string[] = []
    for (let i = 0; i < 6; i++) lines.push('linha-' + i + '-' + 'x'.repeat(8))
    const text = lines.join('\n')
    const chunks = splitTextIntoChunks(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(30 + 1))
  })

  it('preserva ordem das linhas no concat (\\n entre linhas dentro do chunk)', () => {
    const text = 'a\nb\nc'
    const chunks = splitTextIntoChunks(text, 100)
    expect(chunks).toEqual(['a\nb\nc'])
  })

  it('linhas individuais maiores que o limite: ainda emitidas (overflow)', () => {
    // Funcao nao quebra dentro de uma linha — preserva limites logicos.
    // Linha sozinha 100 chars com limit 50: emite linha como chunk unico.
    const longLine = 'x'.repeat(100)
    const chunks = splitTextIntoChunks(longLine, 50)
    expect(chunks).toEqual([longLine])
  })

  it('CRLF: chunk unico mantem CRLF intacto (trim apenas, sem re-split)', () => {
    // text fits no limit → retorna trimmed as-is. CRLF preservado.
    expect(splitTextIntoChunks('a\r\nb\r\nc', 100)).toEqual(['a\r\nb\r\nc'])
  })

  it('CRLF acima do limite: quebra usa \\n no rejoin (split aplicou \\r?\\n)', () => {
    // limit 5 forca o branch de quebra; ai re-junta por '\n'
    const chunks = splitTextIntoChunks('a\r\nb\r\nc\r\nd', 5)
    chunks.forEach(c => expect(c).not.toContain('\r'))
  })

  it('default limit aplicado quando omitido', () => {
    const text = 'curto'
    expect(splitTextIntoChunks(text)).toEqual([text])
  })
})

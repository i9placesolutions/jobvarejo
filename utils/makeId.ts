// Gerador de identificadores opacos usado por todo o editor.
//
// Substitui o antigo `Math.random().toString(36).substr(2, 9)` que tinha
// ~47 bits de entropia e casos degenerados (quando Math.random retornava
// um valor pequeno, substr(2, 9) devolvia menos de 9 caracteres).
//
// Prefere crypto.randomUUID (disponivel em todos os browsers alvo e no
// Node 19+). Mantem fallback com crypto.getRandomValues para ambientes
// antigos. O resultado e uma string alfanumerica curta para nao poluir
// payloads/logs — 12 chars de um hex randomUUID ≈ 48 bits, mesma ordem
// do original, mas sem colisao silenciosa por trunc.

const CRYPTO: Crypto | undefined = (() => {
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    return (globalThis as any).crypto as Crypto
  }
  return undefined
})()

export function makeId(): string {
  if (CRYPTO && typeof CRYPTO.randomUUID === 'function') {
    return CRYPTO.randomUUID().replace(/-/g, '').slice(0, 12)
  }
  if (CRYPTO && typeof CRYPTO.getRandomValues === 'function') {
    const bytes = new Uint8Array(8)
    CRYPTO.getRandomValues(bytes)
    let out = ''
    for (let i = 0; i < bytes.length; i += 1) {
      const byte = bytes[i] ?? 0
      out += byte.toString(16).padStart(2, '0')
    }
    return out.slice(0, 12)
  }
  // Ultimo fallback — nao deveria ser alcancado em browsers modernos.
  // Mantem comportamento do codigo legado para nao quebrar execucao.
  return Math.random().toString(36).slice(2, 14).padEnd(12, '0')
}

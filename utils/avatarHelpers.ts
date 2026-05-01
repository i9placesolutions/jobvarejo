/**
 * Helpers puros para gerar avatares fallback (cor + inicial) a partir
 * de uma string identificadora (nome, email, id).
 *
 * Cobertura: tests/utils/avatarHelpers.test.ts
 */

/**
 * Escolhe uma classe Tailwind de bg-color a partir de uma string usando
 * hash deterministico djb2-like. Mesma string sempre retorna mesma cor.
 *
 * Util para colorir avatares de colaboradores sem precisar persistir
 * a cor escolhida.
 */
export const getColorFromString = (str: string): string => {
    const colors: string[] = [
        'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-pink-500',
        'bg-yellow-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500',
        'bg-orange-500', 'bg-cyan-500'
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        if (!isNaN(code)) {
            hash = code + ((hash << 5) - hash)
        }
    }
    return colors[Math.abs(hash) % colors.length] ?? 'bg-gray-500'
}

/**
 * Extrai a inicial (1-2 letras) de um nome.
 *  - "Joao Silva" → "JS"
 *  - "Maria"      → "M"
 *  - ""/null      → "?"
 *
 * Para nomes compostos com 2+ palavras, usa primeira inicial da
 * primeira e da ultima palavra.
 */
export const getInitial = (name: string | null | undefined): string => {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    const firstPart = parts[0]
    const lastPart = parts[parts.length - 1]
    if (parts.length >= 2 && firstPart && lastPart) {
        const first = firstPart[0]
        const last = lastPart[0]
        if (first && last) {
            return (first + last).toUpperCase()
        }
    }
    return name[0]?.toUpperCase() ?? '?'
}

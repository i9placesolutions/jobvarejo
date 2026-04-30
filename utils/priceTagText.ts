/**
 * Helpers puros de texto para a etiqueta de preco.
 * Sem dependencia de Fabric, refs reativos ou estado global —
 * sao seguros para chamar em qualquer contexto e cobertos por testes
 * unitarios em tests/utils/priceTagText.test.ts.
 */

/**
 * Faz parse de preco em formato brasileiro (separador decimal "," ou ".")
 * e retorna o inteiro e os centavos como strings normalizadas.
 *
 * Aceita prefixo "R$", espacos e qualquer caractere extra (descartados).
 *
 * Exemplos:
 *   parsePriceBR("R$ 47,99")   -> { inteiro: "47", centavos: "99" }
 *   parsePriceBR("1.299,99")   -> { inteiro: "1299", centavos: "99" }
 *   parsePriceBR("100")        -> { inteiro: "100", centavos: "00" }
 *   parsePriceBR("")           -> { inteiro: "0",   centavos: "00" }
 */
export const parsePriceBR = (preco: string): { inteiro: string; centavos: string } => {
    const s0 = String(preco ?? '')
        .replace(/R\$\s*/gi, '')
        .replace(/\s+/g, '')
        .trim();
    if (!s0) return { inteiro: '0', centavos: '00' };

    const lastComma = s0.lastIndexOf(',');
    const lastDot = s0.lastIndexOf('.');
    const sepIdx = Math.max(lastComma, lastDot);

    if (sepIdx === -1) {
        const inteiro = s0.replace(/[^\d]/g, '') || '0';
        return { inteiro, centavos: '00' };
    }

    const rawInt = s0.slice(0, sepIdx);
    const rawDec = s0.slice(sepIdx + 1);
    const inteiro = rawInt.replace(/[^\d]/g, '') || '0';
    const centavos = rawDec.replace(/[^\d]/g, '').padEnd(2, '0').slice(0, 2) || '00';
    return { inteiro, centavos };
};

/**
 * Tipo restrito para a unidade visivel na etiqueta. Apenas 'KG' e 'UN'
 * sao permitidos no chip — gramaturas (ML/L/G) seguem no nome do produto.
 */
export type PriceUnitLabel = '' | 'KG' | 'UN';

/**
 * Normaliza uma unidade arbitraria do produto (ou texto livre) para a
 * representacao usada no chip da etiqueta. Retorna string vazia quando
 * o template nao deve mostrar unidade — evita "UN fantasma" em
 * gramaturas como 500ML, 1L ou produtos sem unidade definida.
 *
 * Regra:
 *   - vazio/null/undefined  -> ''
 *   - KG / KILO / KILOS / "1KG" / "2,5KG"  -> 'KG'
 *   - UN / UND / UNID / UNIDADE  -> 'UN'
 *   - ML / L / G / 500ML  -> '' (gramatura segue no nome do produto)
 */
export const normalizeUnitForLabel = (raw: any): PriceUnitLabel => {
    const s0 = String(raw ?? '').trim();
    if (!s0) return '';
    const s = s0.toUpperCase().replace(/\s+/g, '');

    // Remove a leading numeric quantity (e.g. "500ML", "1KG", "2,5KG") so we don't show gramatura.
    const tok = s.replace(/^\d+(?:[.,]\d+)?/, '');

    // Only allow these units on the label.
    if (tok === 'KG' || tok === 'K' || tok === 'KILO' || tok === 'KILOS' || tok.includes('KG')) return 'KG';
    if (tok === 'UN' || tok === 'UND' || tok === 'UNID' || tok === 'UNIDADE' || tok.includes('UN')) return 'UN';

    // Gramaturas (ML/L/G/etc) NAO devem virar 'UN' automatico — gramatura segue
    // no nome do produto. Retornar string vazia evita 'UN' fantasma quando o
    // template nao permite unidade.
    return '';
};

/**
 * Gap padrao em pixels entre o inteiro e os centavos numa etiqueta.
 * Pode ser sobrescrito por variante via __atacValueVariants[key].intDecimalGap.
 */
export const PRICE_INTEGER_DECIMAL_GAP_PX = 1;

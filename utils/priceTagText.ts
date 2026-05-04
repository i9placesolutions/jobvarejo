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
export const PRICE_INTEGER_DECIMAL_GAP_PX = 6;

/**
 * Converte um preco arbitrario (string ou number, em qualquer formato) para
 * centavos como inteiro. Retorna null se a entrada nao for parseavel.
 *
 * Regra de separadores:
 *  - "1.234,56" (BR com milhar) -> 123456
 *  - "1234.56"  (US sem milhar) -> 123456
 *  - "1,234.56" (US com milhar) -> 123456 (virgula = milhar)
 *  - "47,99"                    -> 4799
 *  - "100"                      -> 10000
 */
export const parsePriceToCents = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const s0 = String(v).trim();
    if (!s0) return null;
    const s = s0.replace(/[^\d.,-]/g, '');
    if (!s) return null;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    let normalized = s;
    if (hasComma && hasDot) normalized = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
    else if (hasComma) normalized = s.replace(/\./g, '').replace(',', '.'); // 123,45 -> 123.45
    else normalized = s.replace(/,/g, ''); // 1,234.56 -> 1234.56
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
};

/**
 * Inverso de parsePriceToCents: formata uma quantidade em centavos para
 * string BR "INTEIRO,CENTAVOS" sem prefixo R$.
 *
 * Exemplos:
 *  4799  -> "47,99"
 *  100   -> "1,00"
 *  -50   -> "-0,50"
 *  null  -> null
 */
export const formatCentsToPrice = (cents: number | null): string | null => {
    if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
    const n = Math.round(cents);
    const abs = Math.abs(n);
    const int = Math.floor(abs / 100);
    const dec = String(abs % 100).padStart(2, '0');
    const sign = n < 0 ? '-' : '';
    return `${sign}${int},${dec}`;
};

/**
 * Wrapper sobre parsePriceBR garantindo que { integer, dec } nunca contenham
 * undefined/vazio. Usado em pontos de renderizacao da etiqueta onde precisamos
 * sempre de valores defaults seguros (evita "0,undefined").
 */
export const splitPriceParts = (raw: any): { integer: string; dec: string } => {
    const parsed = parsePriceBR(String(raw ?? ''));
    return {
        integer: parsed.inteiro || '0',
        dec: parsed.centavos || '00'
    };
};

/**
 * Variantes de etiqueta atacarejo conforme o numero de digitos do preco.
 *  - tiny: 1 digito (ex: 1,99)
 *  - normal: 2 digitos (ex: 47,99)
 *  - large: 3+ digitos (ex: 129,99 / 1.299,99)
 *
 * Cada variante carrega defaults proprios de proporcao/gap em
 * DEFAULT_ATAC_VALUE_VARIANTS dentro do EditorCanvas, e pode ser sobrescrita
 * por variante salva em __atacValueVariants[key] do template.
 */
export type AtacVariantKey = 'tiny' | 'normal' | 'large';

export const resolveAtacVariantKeyFromPrice = (raw: any): AtacVariantKey => {
    const parsed = parsePriceBR(String(raw ?? ''));
    const integerDigits = String(parsed.inteiro || '0').replace(/^0+(?=\d)/, '');
    const digitsCount = Math.max(1, integerDigits.length || 1);
    if (digitsCount <= 1) return 'tiny';
    // 3+ digits (e.g. 129,99) require the "large" behavior to avoid overlap.
    if (digitsCount >= 3) return 'large';
    return 'normal';
};

/**
 * Converte preco arbitrario (number ou string) para string no formato BR
 * com virgula decimal, preservando valores ja formatados.
 *
 * Regras:
 *  - null/undefined → ''
 *  - number: toFixed(2) com '.' → ',' (20.99 → "20,99")
 *  - string com ',': preserva (ja BR)
 *  - string com '.' e parts[1] tem 1-2 chars: troca por ','
 *  - string com '.' e parts[1] tem 3+ chars (milhar): preserva
 *  - outros: trim() e retorna
 */
export const formatPriceValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') {
        return value.toFixed(2).replace('.', ',')
    }
    const str = String(value).trim()
    if (!str) return ''
    if (str.includes(',')) return str
    if (str.includes('.')) {
        const parts = str.split('.')
        if (parts.length === 2 && parts[1] && parts[1].length <= 2) {
            return str.replace('.', ',')
        }
    }
    return str
}

/**
 * Forma minima do produto que `inferUnitLabelFromProduct` consome.
 * Aceita dados parciais (qualquer fonte importadora pode preencher subsets).
 */
export type ProductUnitInferenceInput = {
    unit?: any
    name?: any
    weight?: any
    packageLabel?: any
    packUnit?: any
}

/**
 * Infere a unidade visivel ('KG' | 'UN' | '') a partir dos campos do produto,
 * priorizando sinais explicitos antes de heuristica baseada no nome.
 *
 * Ordem de prioridade:
 *  1. product.unit explicito
 *  2. Heuristica do nome/weight/packageLabel:
 *     - "5KG", "500G", "2L" (numero antes da unidade) → UN (vendido por unidade)
 *     - "KG" / "G" / "L" sozinho (sem numero antes) → KG (vendido por peso)
 *  3. packUnit como fallback
 *  4. '' quando nenhum sinal disponivel
 */
export const inferUnitLabelFromProduct = (product: ProductUnitInferenceInput): PriceUnitLabel => {
    const unitRaw = String(product?.unit ?? '').trim();
    if (unitRaw) return normalizeUnitForLabel(unitRaw);

    const name = String(product?.name ?? '');
    const weight = String(product?.weight ?? '');
    const packageLabel = String(product?.packageLabel ?? '');
    const probe = `${name} ${weight} ${packageLabel}`.toUpperCase();

    // CRITICAL: Check if there's a NUMBER before the weight unit (KG, G, ML, L)
    // Pattern like "5KG", "500G", "2L" = sold by unit → use "UN"
    // Pattern like "KG", "G" without number = sold by kilo → use "KG"
    const hasNumberBeforeWeightUnit = /\d+\s*(?:KG|G|ML|L)\b/.test(probe);
    const hasWeightUnitWithoutNumber = /\b(?:KG|G|ML|L)\b/.test(probe) && !hasNumberBeforeWeightUnit;

    if (hasWeightUnitWithoutNumber) return 'KG'; // Vendido por quilo (ex: "ARROZ KG")
    if (hasNumberBeforeWeightUnit) return 'UN'; // Vendido por unidade (ex: "ARROZ 5KG")

    const packUnitRaw = String(product?.packUnit ?? '').trim();
    const packUnitNorm = packUnitRaw ? normalizeUnitForLabel(packUnitRaw) : '';
    if (packUnitNorm === 'KG') return 'KG';
    if (packUnitNorm === 'UN') return 'UN';

    return '';
};

/**
 * Gera o texto de "linha de pack" exibido em etiquetas atacarejo.
 *
 * Exemplos:
 *  - { packageLabel: 'FD', packQuantity: 12, packUnit: 'UN', packPrice: '14,90' }
 *      → "FD C/12UN: R$ 14,90"
 *  - { packageLabel: 'CX', packQuantity: 1, packUnit: 'UN', packPrice: '5,99', itemUnit: 'KG' }
 *      → "1 UN: R$ 5,99"  (q=1 usa formato compacto)
 *  - sem dados suficientes → null (caller esconde o texto)
 *
 * Quando packUnit e' um token de embalagem (FD/CX/PCT), cai para itemUnit
 * — ex: pack "FD" sem unidade explicita do item conta com itemUnit do produto.
 */
export const computePackLine = (opts: {
    packageLabel?: any
    packQuantity?: any
    packUnit?: any
    packPrice?: any
    itemUnit?: any
}): string | null => {
    const label = String(opts.packageLabel ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const q = Number.parseInt(String(opts.packQuantity ?? '').replace(/[^\d]/g, ''), 10);
    const packUnitToken = String(opts.packUnit ?? '').trim().toUpperCase().replace(/\s+/g, '');
    const itemUnit = normalizeUnitForLabel(opts.itemUnit ?? '');
    const packagingTokens = new Set(['FD', 'FARDO', 'FARDOS', 'CX', 'CAIXA', 'CAIXAS', 'PCT', 'PACOTE', 'PACOTES', 'PC']);
    const unit =
        (!packUnitToken || packUnitToken === label || packagingTokens.has(packUnitToken))
            ? itemUnit
            : normalizeUnitForLabel(packUnitToken);
    const price = String(opts.packPrice ?? '').trim();
    if (!label || !Number.isFinite(q) || q <= 0 || !unit || !price) return null;
    if (q === 1) return `1 ${unit}: R$ ${price}`;
    return `${label} C/${q}${unit}: R$ ${price}`;
};

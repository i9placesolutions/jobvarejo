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
 * Unidades comerciais que podem aparecer junto ao preco.
 *
 * A unidade nao e o mesmo que a gramatura do nome: `ARROZ 5KG` continua
 * sendo vendido por `UN`, enquanto `PICANHA KG` e vendida por `KG`. Ainda
 * assim, quando a origem informa uma embalagem explicita (PCT, CX, FD...),
 * ela precisa sobreviver ate a etiqueta para nao transformar tudo em `UN`.
 */
export type PriceUnitLabel =
    | ''
    | 'KG'
    | 'UN'
    | 'CADA'
    | 'PCT'
    | 'CX'
    | 'FD'
    | 'DZ'
    | 'BD'
    | 'SC'
    | 'EMB';

const stripUnitAccents = (value: any): string => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[.;:/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const UNIT_ALIASES: Record<string, PriceUnitLabel> = {
    KG: 'KG', KGS: 'KG', K: 'KG', KILO: 'KG', KILOS: 'KG', QUILO: 'KG', QUILOS: 'KG',
    QUILOGRAMA: 'KG', QUILOGRAMAS: 'KG',
    UN: 'UN', UND: 'UN', UNID: 'UN', UNIDADE: 'UN', UNIDADES: 'UN', UNIT: 'UN',
    PC: 'UN', PCS: 'UN', PECA: 'UN', PECAS: 'UN',
    CADA: 'CADA',
    PCT: 'PCT', PAC: 'PCT', PCTE: 'PCT', PACOTE: 'PCT', PACOTES: 'PCT',
    CX: 'CX', CAIXA: 'CX', CAIXAS: 'CX',
    FD: 'FD', FARDO: 'FD', FARDOS: 'FD',
    DZ: 'DZ', DUZIA: 'DZ', DUZIAS: 'DZ',
    BD: 'BD', BANDEJA: 'BD', BANDEJAS: 'BD',
    SC: 'SC', SACO: 'SC', SACOS: 'SC',
    EMB: 'EMB', EMBALAGEM: 'EMB', EMBALAGENS: 'EMB'
};

const GENERIC_UNIT_TOKENS = new Set(['UN', 'UND', 'UNID', 'UNIDADE', 'UNIDADES', 'UNIT', 'PC', 'PCS', 'PECA', 'PECAS']);

const normalizeUnitToken = (raw: any): { label: PriceUnitLabel; token: string; hasQuantity: boolean } => {
    const normalized = stripUnitAccents(raw).replace(/\s+/g, '');
    if (!normalized) return { label: '', token: '', hasQuantity: false };

    const quantityMatch = normalized.match(/^(\d+(?:[.,]\d+)?)([A-Z]+)$/);
    const hasQuantity = !!quantityMatch;
    const token = quantityMatch?.[2] || normalized;
    const label = UNIT_ALIASES[token] || '';

    // Gramaturas numeradas (500G, 1L, 900ML) descrevem a embalagem, nao a
    // unidade de venda. Mantemos essa regra para evitar o antigo "UN"
    // fantasma virar agora "ML/G/L" na etiqueta.
    if (hasQuantity && ['G', 'GR', 'GRAMA', 'GRAMAS', 'MG', 'L', 'LT', 'LITRO', 'LITROS', 'ML', 'MLS', 'MILILITRO', 'MILILITROS'].includes(token)) {
        return { label: '', token, hasQuantity };
    }

    return { label, token, hasQuantity };
};

/**
 * Normaliza uma unidade arbitraria do produto (ou texto livre) para a
 * representacao usada no chip da etiqueta. Retorna string vazia quando
 * o token e apenas uma gramatura numerada (500ML, 1L, 300G), pois nesses
 * casos a unidade de venda e inferida separadamente a partir do produto.
 *
 * Regra:
 *   - vazio/null/undefined  -> ''
 *   - KG / KILO / KILOS / "1KG" / "2,5KG"  -> 'KG'
 *   - UN / UND / UNID / UNIDADE  -> 'UN'
 *   - CADA, PCT, CX, FD, DZ, BD, SC, EMB -> abreviatura canonica
 *   - ML / L / G / 500ML  -> '' (gramatura segue no nome do produto)
 */
export const normalizeUnitForLabel = (raw: any): PriceUnitLabel => {
    return normalizeUnitToken(raw).label;
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
 * Infere a unidade visivel a partir dos campos do produto, distinguindo
 * unidade de venda de gramatura/volume.
 *
 * Ordem de prioridade:
 *  1. unidade explicita nao-generica (CADA/PCT/CX/...)
 *  2. nome/gramatura (um `KG` sem numero e peso vendido por KG; `5KG` e
 *     embalagem vendida por UN; PCT/CX/CADA preservados)
 *  3. unidade generica explicita (`UN`) ou packUnit/packageLabel
 *  4. '' quando nenhum sinal disponivel
 */
export const inferUnitLabelFromProduct = (product: ProductUnitInferenceInput): PriceUnitLabel => {
    const unitRaw = String(product?.unit ?? '').trim();
    const explicit = normalizeUnitToken(unitRaw);
    const explicitIsGeneric = !!explicit.token && GENERIC_UNIT_TOKENS.has(explicit.token);

    // Uma unidade de embalagem realmente informada deve vencer heuristicas
    // do nome. `UN`/`UND` sao a excecao: varios importadores usam UN como
    // default, entao deixamos um sinal textual mais forte corrigir esse valor.
    if (explicit.label && !explicitIsGeneric) return explicit.label;

    const name = String(product?.name ?? '');
    const weight = String(product?.weight ?? '');
    const packageLabel = String(product?.packageLabel ?? '');
    const packUnit = String(product?.packUnit ?? '');
    // A etiqueta pode receber a gramatura em `weight` ou em `packageLabel`;
    // ambos precisam participar da mesma heuristica (ex.: `500G` => UN).
    const probe = stripUnitAccents(`${name} ${weight} ${packageLabel}`);

    const hasNumberBefore = (units: string): boolean =>
        new RegExp(`\\d+(?:[.,]\\d+)?\\s*(?:${units})\\b`, 'i').test(probe);
    const hasStandalone = (units: string): boolean =>
        new RegExp(`(?:^|\\s|[(/-])(?:${units})(?:\\s|$|[)/,.-])`, 'i').test(probe);

    // A embalagem explicita no nome ("Picanha kg", "ovos cx", "arroz pct")
    // e o campo peso sem quantidade sao sinais comerciais fortes.
    const weightUnits = 'KG|KILO(?:S)?|QUILO(?:S)?|QUILOGRAMA(?:S)?|G|GR(?:AMA)?S?|MG|L|LT(?:S)?|LITRO(?:S)?|ML|MLS|MILILITRO(?:S)?';
    if (hasStandalone(weightUnits) && !hasNumberBefore(weightUnits)) return 'KG';
    if (hasStandalone('CADA')) return 'CADA';
    if (hasStandalone('PCT|PCTE|PAC(?:OTE|OTES)?')) return 'PCT';
    if (hasStandalone('CX|CAIXA(?:S)?')) return 'CX';
    if (hasStandalone('FD|FARDO(?:S)?')) return 'FD';
    if (hasStandalone('DZ|DUZIA(?:S)?')) return 'DZ';
    if (hasStandalone('BD|BANDEJA(?:S)?')) return 'BD';
    if (hasStandalone('SC|SACO(?:S)?')) return 'SC';
    if (hasStandalone('EMB|EMBALAGEM(?:S)?')) return 'EMB';

    // Peso/volume numerado no nome (`5KG`, `500G`, `2L`, `900ML`) representa
    // uma embalagem/produto vendido por unidade. Mantemos UN para esse caso.
    if (hasNumberBefore('KG|KILO(?:S)?|QUILO(?:S)?|QUILOGRAMA(?:S)?|G|GR(?:AMA)?S?|MG|L|LT(?:S)?|LITRO(?:S)?|ML|MLS|MILILITRO(?:S)?')) return 'UN';

    const unitFromWeight = normalizeUnitToken(weight);
    if (unitFromWeight.label) return unitFromWeight.label;

    // `packUnit` normalmente informa a unidade do item dentro da caixa;
    // `packageLabel` informa a embalagem. Nesta ordem, UN continua sendo a
    // escolha correta para `CX C/12 UN`, enquanto CX/PCT sobrevivem quando
    // forem a única informação disponível.
    const packUnitNorm = normalizeUnitForLabel(packUnit);
    if (packUnitNorm) return packUnitNorm;
    const packageNorm = normalizeUnitForLabel(packageLabel);
    if (packageNorm) return packageNorm;

    if (explicit.label) return explicit.label;
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
